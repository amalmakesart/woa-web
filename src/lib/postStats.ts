import { supabase } from './supabase';

export async function fetchPostBookmarkCounts(postIds: string[]): Promise<Record<string, number>> {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];
  if (uniquePostIds.length === 0) return {};

  try {
    const { data, error } = await supabase.functions.invoke('post-bookmark-counts', {
      body: { postIds: uniquePostIds },
    });

    if (error) throw error;

    return ((data as { counts?: Record<string, number> } | null)?.counts ?? {});
  } catch {
    return {};
  }
}
