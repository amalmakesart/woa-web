import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getServerKey(): string {
  return Deno.env.get('SB_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
}

function isAuthorizedRequest(req: Request): boolean {
  const requestKey = req.headers.get('apikey') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const publishableKey = Deno.env.get('SB_PUBLISHABLE_KEY') ?? '';
  const legacyAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  return [publishableKey, legacyAnonKey].filter(Boolean).some((key) =>
    key === requestKey || key === bearerToken
  );
}

async function stripePost(path: string, body: URLSearchParams) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Stripe error');
  return data;
}

async function stripeGet(path: string) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  const res = await fetch(`https://api.stripe.com${path}`, {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Stripe error');
  return data;
}

async function createPaymentIntent(
  amount: number,
  currency: string,
  metadata: Record<string, string>,
  description: string,
  email?: string,
) {
  const body = new URLSearchParams({
    amount: String(amount),
    currency,
    description,
    'metadata[type]': metadata.type,
    'metadata[user_id]': metadata.user_id,
  });

  if (metadata.gig_id) body.append('metadata[gig_id]', metadata.gig_id);
  if (metadata.is_featured) body.append('metadata[is_featured]', metadata.is_featured);
  if (metadata.coupon_code) body.append('metadata[coupon_code]', metadata.coupon_code);
  if (email) body.append('receipt_email', email);

  return stripePost('/v1/payment_intents', body);
}

type ResolvedCoupon = {
  code: string;
  source: 'promotion_code' | 'coupon';
  coupon: Record<string, any>;
};

async function resolveCoupon(code: string): Promise<ResolvedCoupon | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const promotionCodeQuery = new URLSearchParams({
    code: trimmed,
    active: 'true',
    limit: '1',
    'expand[]': 'data.coupon',
  });
  const promotionCodes = await stripeGet(`/v1/promotion_codes?${promotionCodeQuery.toString()}`);

  const promotion = promotionCodes.data?.[0];
  if (promotion?.coupon) {
    return {
      code: String(promotion.code ?? trimmed).toUpperCase(),
      source: 'promotion_code',
      coupon: promotion.coupon,
    };
  }

  try {
    const coupon = await stripeGet(`/v1/coupons/${encodeURIComponent(trimmed)}`);
    if (coupon?.valid) {
      return {
        code: trimmed.toUpperCase(),
        source: 'coupon',
        coupon,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function describeDiscount(coupon: Record<string, any>): string | null {
  if (typeof coupon.percent_off === 'number') {
    return `${coupon.percent_off}% OFF`;
  }

  if (typeof coupon.amount_off === 'number') {
    return `$${(coupon.amount_off / 100).toFixed(2)} OFF`;
  }

  return null;
}

function discountAmountForCoupon(originalAmount: number, coupon: Record<string, any>): number {
  if (typeof coupon.percent_off === 'number') {
    return Math.round(originalAmount * (coupon.percent_off / 100));
  }

  if (typeof coupon.amount_off === 'number') {
    const currency = String(coupon.currency ?? '').toLowerCase();
    if (currency && currency !== 'cad') {
      throw new Error('This coupon does not apply to CAD gig payments.');
    }
    return coupon.amount_off;
  }

  throw new Error('This coupon does not include a usable discount.');
}

async function resolveGigPricing(isFeatured: boolean, couponCode?: string) {
  const originalAmount = isFeatured ? 1400 : 600;
  const trimmedCode = couponCode?.trim() ?? '';

  if (!trimmedCode) {
    return {
      amount: originalAmount,
      originalAmount,
      free: false,
      coupon: null,
      discountDescription: null,
    };
  }

  const resolvedCoupon = await resolveCoupon(trimmedCode);
  if (!resolvedCoupon) {
    throw new Error('Coupon code not found.');
  }

  const discountAmount = discountAmountForCoupon(originalAmount, resolvedCoupon.coupon);
  const amount = Math.max(0, originalAmount - discountAmount);

  return {
    amount,
    originalAmount,
    free: amount === 0,
    coupon: {
      code: resolvedCoupon.code,
      source: resolvedCoupon.source,
    },
    discountDescription: describeDiscount(resolvedCoupon.coupon),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!isAuthorizedRequest(req)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      type,
      user_id,
      is_featured,
      gig_id,
      coupon_code,
      preview_only,
    } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      getServerKey(),
    );

    const { data: authUser } = await supabase.auth.admin.getUserById(user_id);
    const email = authUser?.user?.email ?? undefined;

    if (type === 'verified') {
      const intent = await createPaymentIntent(
        3000,
        'cad',
        { type: 'verified_artist', user_id },
        'WOA Verified Artist',
        email,
      );
      return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'gig') {
      const featured = is_featured === true || is_featured === 'true';
      const pricing = await resolveGigPricing(featured, coupon_code);

      if (preview_only || pricing.free) {
        return new Response(JSON.stringify(pricing), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const intent = await createPaymentIntent(
        pricing.amount,
        'cad',
        {
          type: 'gig_post',
          user_id,
          gig_id: gig_id ?? '',
          is_featured: featured ? 'true' : 'false',
          coupon_code: pricing.coupon?.code ?? '',
        },
        `WOA Gig Post${featured ? ' (Featured)' : ''}`,
        email,
      );

      return new Response(JSON.stringify({
        clientSecret: intent.client_secret,
        ...pricing,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown type' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
