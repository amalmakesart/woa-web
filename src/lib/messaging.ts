import { supabase } from './supabase';

/**
 * Find an existing conversation between a gig poster and artist (optionally for a specific gig),
 * or create one if none exists. Returns the conversation id.
 */
export async function findOrCreateConversation(
  gigPosterId: string,
  artistId: string,
  gigId: string | null,
): Promise<string | null> {
  // Search for existing conversation
  let query = supabase
    .from('conversations')
    .select('id')
    .eq('gig_poster_id', gigPosterId)
    .eq('artist_id', artistId);

  if (gigId) {
    query = query.eq('gig_id', gigId);
  } else {
    query = query.is('gig_id', null);
  }

  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;

  // Create new conversation
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ gig_poster_id: gigPosterId, artist_id: artistId, gig_id: gigId ?? null })
    .select('id')
    .single();

  if (error) {
    return null;
  }

  return created?.id ?? null;
}
