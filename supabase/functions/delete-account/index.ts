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

    const userId = user.id;

    const { data: ownedPostRows } = await adminClient
      .from('posts')
      .select('id')
      .eq('user_id', userId);
    const ownedPostIds = (ownedPostRows ?? []).map((row) => row.id).filter(Boolean);

    const { data: ownedGigRows } = await adminClient
      .from('gigs')
      .select('id')
      .eq('poster_id', userId);
    const ownedGigIds = (ownedGigRows ?? []).map((row) => row.id).filter(Boolean);

    const { data: ownedProjectRows } = await adminClient
      .from('projects')
      .select('id')
      .eq('user_id', userId);
    const ownedProjectIds = (ownedProjectRows ?? []).map((row) => row.id).filter(Boolean);

    const { data: ownedFeatureRows } = await adminClient
      .from('features')
      .select('id')
      .eq('artist_id', userId);
    const ownedFeatureIds = (ownedFeatureRows ?? []).map((row) => row.id).filter(Boolean);

    const operations: Array<Promise<unknown>> = [
      adminClient.from('follows').delete().eq('follower_id', userId),
      adminClient.from('follows').delete().eq('following_id', userId),
      adminClient.from('gig_interests').delete().eq('artist_id', userId),
      adminClient.from('messages').delete().eq('user_id', userId),
      adminClient.from('notifications').delete().eq('user_id', userId),
      adminClient.from('notifications').delete().eq('actor_id', userId),
      adminClient.from('bookmarks').delete().eq('user_id', userId),
      adminClient.from('likes').delete().eq('user_id', userId),
      adminClient.from('comments').delete().eq('user_id', userId),
      adminClient.from('post_collaborators').delete().eq('collaborator_id', userId),
      adminClient.from('collections').delete().eq('user_id', userId),
      adminClient.from('portfolio_sections').delete().eq('user_id', userId),
      adminClient.from('shows').delete().eq('artist_id', userId),
      adminClient.from('reviews').delete().eq('reviewer_id', userId),
      adminClient.from('reviews').delete().eq('reviewee_id', userId),
      adminClient.from('feature_interests').delete().eq('user_id', userId),
      adminClient.from('video_comments').delete().eq('user_id', userId),
      adminClient.from('video_likes').delete().eq('user_id', userId),
      adminClient.from('reports').delete().eq('reporter_id', userId),
      adminClient.from('reports').delete().eq('target_user_id', userId),
      adminClient.from('blocks').delete().eq('blocker_id', userId),
      adminClient.from('blocks').delete().eq('blocked_id', userId),
      adminClient.from('project_comments').delete().eq('user_id', userId),
      adminClient.from('projects').delete().eq('user_id', userId),
      adminClient.from('features').delete().eq('artist_id', userId),
      adminClient.from('conversations').delete().eq('gig_poster_id', userId),
      adminClient.from('conversations').delete().eq('artist_id', userId),
      adminClient.from('gigs').delete().eq('poster_id', userId),
      adminClient.from('posts').delete().eq('user_id', userId),
      adminClient.from('profiles').delete().eq('id', userId),
    ];

    if (ownedPostIds.length > 0) {
      operations.push(
        adminClient.from('comments').delete().in('post_id', ownedPostIds),
        adminClient.from('likes').delete().in('post_id', ownedPostIds),
        adminClient.from('bookmarks').delete().in('post_id', ownedPostIds),
        adminClient.from('post_collaborators').delete().in('post_id', ownedPostIds),
      );
    }

    if (ownedGigIds.length > 0) {
      operations.push(
        adminClient.from('gig_interests').delete().in('gig_id', ownedGigIds),
        adminClient.from('reviews').delete().in('gig_id', ownedGigIds),
        adminClient.from('conversations').delete().in('gig_id', ownedGigIds),
      );
    }

    if (ownedProjectIds.length > 0) {
      operations.push(
        adminClient.from('project_comments').delete().in('project_id', ownedProjectIds),
      );
    }

    if (ownedFeatureIds.length > 0) {
      operations.push(
        adminClient.from('feature_interests').delete().in('video_id', ownedFeatureIds),
        adminClient.from('video_comments').delete().in('video_id', ownedFeatureIds),
        adminClient.from('video_likes').delete().in('video_id', ownedFeatureIds),
      );
    }

    await Promise.allSettled(operations);

    try {
      const avatarPrefix = `${userId}/`;
      const { data: avatarFiles } = await adminClient.storage.from('avatars').list(avatarPrefix, {
        limit: 100,
      });
      if (avatarFiles?.length) {
        await adminClient.storage.from('avatars').remove(
          avatarFiles.map((file) => `${avatarPrefix}${file.name}`)
        );
      }
    } catch {
      // Ignore storage cleanup failures; auth deletion is the priority.
    }

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return jsonResponse({ error: deleteUserError.message }, 500);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('delete-account error', message);
    return jsonResponse({ error: message }, 500);
  }
});
