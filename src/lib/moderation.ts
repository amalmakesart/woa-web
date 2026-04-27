import { supabase } from './supabase';

export type ReportTargetType = 'profile' | 'post' | 'gig' | 'project' | 'message' | 'feature';

export async function reportContent({
  targetType,
  targetId,
  targetUserId,
  reason = 'Reported from app',
}: {
  targetType: ReportTargetType;
  targetId: string;
  targetUserId?: string | null;
  reason?: string;
}) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error('You must be signed in to report content.');

  const { error } = await supabase.from('reports').insert({
    reporter_id: user.id,
    target_type: targetType,
    target_id: targetId,
    target_user_id: targetUserId ?? null,
    reason,
  });

  if (error) throw error;
}

export async function blockUser(blockedId: string) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error('You must be signed in to block a user.');
  if (blockedId === user.id) throw new Error('You cannot block your own profile.');

  const { error } = await supabase.from('blocks').upsert(
    { blocker_id: user.id, blocked_id: blockedId },
    { onConflict: 'blocker_id,blocked_id' }
  );

  if (error) throw error;
}
