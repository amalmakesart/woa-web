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

async function createPaymentIntent(amount: number, currency: string, metadata: Record<string, string>, description: string, email?: string) {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
  
  const body = new URLSearchParams({
    amount: String(amount),
    currency,
    description,
    'metadata[type]': metadata.type,
    'metadata[user_id]': metadata.user_id,
  });
  
  if (metadata.gig_id) body.append('metadata[gig_id]', metadata.gig_id);
  if (metadata.is_featured) body.append('metadata[is_featured]', metadata.is_featured);
  if (email) body.append('receipt_email', email);

  const res = await fetch('https://api.stripe.com/v1/payment_intents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? 'Stripe error');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!isAuthorizedRequest(req)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { type, user_id, is_featured, gig_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        3000, 'cad',
        { type: 'verified_artist', user_id },
        `WOA Verified Artist`,
        email,
      );
      return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (type === 'gig') {
      const featured = is_featured === true || is_featured === 'true';
      const intent = await createPaymentIntent(
        featured ? 1400 : 600, 'cad',
        { type: 'gig_post', user_id, gig_id: gig_id ?? '', is_featured: featured ? 'true' : 'false' },
        `WOA Gig Post${featured ? ' (Featured)' : ''}`,
        email,
      );
      return new Response(JSON.stringify({ clientSecret: intent.client_secret }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown type' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
