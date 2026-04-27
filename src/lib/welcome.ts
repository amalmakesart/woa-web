import { supabase } from './supabase';

const WELCOME_MESSAGE = `WELCOME TO WORK(ER) OF ART.

WOA IS A PLATFORM BUILT FOR WORKING ARTISTS AND THE PEOPLE WHO HIRE THEM.

ARTISTS CAN BUILD A PROFILE, SHARE POSTS, FOLLOW OTHER CREATIVES, AND EXPRESS INTEREST IN GIGS.
GIG POSTERS CAN POST OPPORTUNITIES, REVIEW INTERESTED ARTISTS, AND MESSAGE APPLICANTS DIRECTLY.
ART LOVERS CAN DISCOVER WORK, FOLLOW ARTISTS, AND SAVE POSTS THEY WANT TO COME BACK TO.

START BY COMPLETING YOUR PROFILE, EXPLORING THE FEED, AND VISITING THE GIGS TAB.

WE'RE GLAD YOU'RE HERE.
TEAM WOA`;

async function findWoaProfile() {
  const candidateUsernames = ['woa', 'workerofart', 'teamwoa', 'workerofartapp'];

  const { data } = await supabase
    .from('profiles')
    .select('id, username, role')
    .in('username', candidateUsernames)
    .limit(1);

  return (data?.[0] as { id: string; username: string | null; role: string | null } | undefined) ?? null;
}

async function createWelcomeNotification(userId: string, actorId: string | null) {
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'new_message',
    actor_id: actorId,
    reference_id: null,
    reference_type: 'welcome',
    preview_text: WELCOME_MESSAGE,
    is_read: false,
  });
}

export async function sendWelcomeExperience(userId: string, role: 'ARTIST' | 'GIG_POSTER' | 'COLLECTIVE' | 'ART_LOVER') {
  const { data: existingWelcome } = await supabase
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('reference_type', 'welcome')
    .limit(1)
    .maybeSingle();

  if (existingWelcome?.id) {
    return;
  }

  const woaProfile = await findWoaProfile();

  if (!woaProfile?.id) {
    await createWelcomeNotification(userId, null);
    return;
  }

  if (role === 'ART_LOVER') {
    await createWelcomeNotification(userId, woaProfile.id);
    return;
  }

  const gigPosterId = role === 'ARTIST' ? woaProfile.id : userId;
  const artistId = role === 'ARTIST' ? userId : woaProfile.id;

  const { data: existingConversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('gig_poster_id', gigPosterId)
    .eq('artist_id', artistId)
    .is('gig_id', null)
    .maybeSingle();

  let conversationId = existingConversation?.id ?? null;

  if (!conversationId) {
    const { data: createdConversation } = await supabase
      .from('conversations')
      .insert({ gig_poster_id: gigPosterId, artist_id: artistId, gig_id: null })
      .select('id')
      .single();

    conversationId = createdConversation?.id ?? null;
  }

  if (!conversationId) {
    await createWelcomeNotification(userId, woaProfile.id);
    return;
  }

  const { error: messageError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender_id: woaProfile.id,
    content: WELCOME_MESSAGE,
  });

  if (messageError) {
    await createWelcomeNotification(userId, woaProfile.id);
    return;
  }

  await createWelcomeNotification(userId, woaProfile.id);
}
