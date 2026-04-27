import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey =
      Deno.env.get('SB_PUBLISHABLE_KEY') ??
      Deno.env.get('SUPABASE_ANON_KEY') ??
      '';
    const serviceRoleKey =
      Deno.env.get('SB_SECRET_KEY') ??
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
      '';
    const authHeader = req.headers.get('authorization') ?? '';

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const authedClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authedClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { postIds } = await req.json().catch(() => ({ postIds: [] }));
    const ids = Array.isArray(postIds)
      ? postIds.filter((value): value is string => typeof value === 'string' && value.length > 0).slice(0, 100)
      : [];

    if (ids.length === 0) {
      return jsonResponse({ counts: {} });
    }

    const { data: rows, error } = await adminClient
      .from('bookmarks')
      .select('post_id')
      .in('post_id', ids);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }

    const counts: Record<string, number> = {};
    ids.forEach((id) => {
      counts[id] = 0;
    });

    (rows ?? []).forEach((row) => {
      const postId = row.post_id as string | null;
      if (!postId) return;
      counts[postId] = (counts[postId] ?? 0) + 1;
    });

    return jsonResponse({ counts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
