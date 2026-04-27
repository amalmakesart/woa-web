/**
 * WOA Seed Script
 * Run with: npx ts-node seed.ts
 * Creates 10 realistic artist accounts + 2 gig poster accounts
 */

import { createClient } from '@supabase/supabase-js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Add it to your environment before running the seed script.`);
  }
  return value;
}

const SUPABASE_URL = process.env.SEED_SUPABASE_URL ?? process.env.SUPABASE_URL ?? requireEnv('SUPABASE_URL');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Photos: free Unsplash portrait URLs (no auth needed)

const ARTISTS = [
  {
    email: 'maya.chen@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Maya Chen',
    username: 'mayachen',
    discipline: 'Visual Arts',
    art_types: ['Oil Painting', 'Illustration'],
    tags: ['PORTRAIT PAINTER', 'MURALIST'],
    bio: 'Vancouver-based painter exploring identity through portraiture. Available for commissions and exhibitions.',
    country: 'Canada',
    city: 'Vancouver',
    experience: '7',
    is_available: true,
    instagram: 'https://instagram.com',
    photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&q=80',
  },
  {
    email: 'james.okafor@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'James Okafor',
    username: 'jamesokafor',
    discipline: 'Music',
    art_types: ['Jazz', 'Session Work'],
    tags: ['DRUMMER', 'PRODUCER'],
    bio: 'Toronto drummer with 10 years of session and live performance experience. Worked with independent labels across North America.',
    country: 'Canada',
    city: 'Toronto',
    experience: '10',
    is_available: true,
    instagram: 'https://instagram.com',
    photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',
  },
  {
    email: 'sofia.reyes@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Sofia Reyes',
    username: 'sofiareyes',
    discipline: 'Photography',
    art_types: ['Portrait Photography', 'Fashion Photography'],
    tags: ['FASHION PHOTOGRAPHER', 'PORTRAIT PHOTOGRAPHER'],
    bio: 'Montreal photographer specialising in editorial and fashion. My work has appeared in independent publications across Canada and Europe.',
    country: 'Canada',
    city: 'Montreal',
    experience: '5',
    is_available: false,
    instagram: 'https://instagram.com',
    photo_url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&q=80',
  },
  {
    email: 'daniel.marsh@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Daniel Marsh',
    username: 'danielmarsh',
    discipline: 'Literary Arts',
    art_types: ['Screenwriting', 'Poetry'],
    tags: ['WRITER', 'POET'],
    bio: 'Calgary-based writer and poet. Published in three anthologies. Available for spoken word events and collaborative projects.',
    country: 'Canada',
    city: 'Calgary',
    experience: '8',
    is_available: true,
    photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&q=80',
  },
  {
    email: 'amara.diallo@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Amara Diallo',
    username: 'amaradiallo',
    discipline: 'Dance',
    art_types: ['Contemporary Dance', 'Choreography'],
    tags: ['DANCER', 'CHOREOGRAPHER'],
    bio: 'Contemporary dancer and choreographer based in Ottawa. Trained at the National Ballet School. Open to performance and film collaborations.',
    country: 'Canada',
    city: 'Ottawa',
    experience: '12',
    is_available: true,
    instagram: 'https://instagram.com',
    photo_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80',
  },
  {
    email: 'noah.kim@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Noah Kim',
    username: 'noahkim',
    discipline: 'Visual Arts',
    art_types: ['Digital Art', 'Concept Art'],
    tags: ['CONCEPT ARTIST', 'ANIMATOR'],
    bio: 'Digital artist and animator from Vancouver. Specialise in character design and world-building for indie games and film.',
    country: 'Canada',
    city: 'Vancouver',
    experience: '4',
    is_available: true,
    photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&q=80',
  },
  {
    email: 'lena.wagner@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Lena Wagner',
    username: 'lenawagner',
    discipline: 'Music',
    art_types: ['Vocals', 'Songwriting'],
    tags: ['VOCALIST', 'PRODUCER'],
    bio: 'Singer-songwriter from Winnipeg. Independently released two EPs. Available for session work, live events, and brand partnerships.',
    country: 'Canada',
    city: 'Winnipeg',
    experience: '6',
    is_available: true,
    spotify_url: 'https://open.spotify.com',
    photo_url: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&q=80',
  },
  {
    email: 'carlos.vega@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Carlos Vega',
    username: 'carlosvega',
    discipline: 'Visual Arts',
    art_types: ['Murals', 'Street Art'],
    tags: ['MURALIST', 'ILLUSTRATOR'],
    bio: 'Mural artist based in Toronto. Over 40 commissioned murals across Canada. Interested in community art projects and large-scale installations.',
    country: 'Canada',
    city: 'Toronto',
    experience: '9',
    is_available: false,
    instagram: 'https://instagram.com',
    photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&q=80',
  },
  {
    email: 'priya.sharma@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Priya Sharma',
    username: 'priyasharma',
    discipline: 'Craft & Design',
    art_types: ['Jewellery', 'Textile Art'],
    tags: ['JEWELLERY MAKER', 'TEXTILE ARTIST'],
    bio: 'Craft artist and designer from Edmonton. My jewellery and textile work draws from South Asian textile traditions. Available for markets, pop-ups, and commissions.',
    country: 'Canada',
    city: 'Edmonton',
    experience: '5',
    is_available: true,
    website: 'https://example.com',
    photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&q=80',
  },
  {
    email: 'tom.bellamy@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Tom Bellamy',
    username: 'tombellamy',
    discipline: 'Photography',
    art_types: ['Event Photography', 'Street Photography'],
    tags: ['EVENT PHOTOGRAPHER', 'STREET PHOTOGRAPHER'],
    bio: 'Documentary and event photographer based in Halifax. Covering concerts, community events, and cultural festivals for 8 years.',
    country: 'Canada',
    city: 'Halifax',
    experience: '8',
    is_available: true,
    instagram: 'https://instagram.com',
    photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&q=80',
  },
];

const GIG_POSTERS = [
  {
    email: 'venue.northside@woa-seed.com',
    password: 'Seed1234!',
    full_name: 'Northside Arts Collective',
    username: 'northsidearts',
    photo_url: 'https://images.unsplash.com/photo-1574691250077-03a929faece5?w=400&q=80',
  },
  {
    email: 'contact@blueprintmag-seed.com',
    password: 'Seed1234!',
    full_name: 'Blueprint Magazine',
    username: 'blueprintmag',
    photo_url: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&q=80',
  },
];

const SAMPLE_GIGS = [
  {
    title: 'LIVE DRUMMER NEEDED — SATURDAY RESIDENCY',
    art_type: 'Music',
    location: 'Toronto, Canada',
    description: 'We are looking for an experienced drummer for our Saturday night residency starting next month. Must be comfortable with jazz, soul, and funk repertoire.',
    budget_min: 200,
    budget_max: 350,
    date_timeframe: 'Every Saturday from JAN 2026',
    poster_index: 0,
  },
  {
    title: 'EDITORIAL PHOTOGRAPHER FOR SPRING ISSUE',
    art_type: 'Photography',
    location: 'Montreal, Canada',
    description: 'Blueprint Magazine is seeking a fashion and portrait photographer for our upcoming spring editorial. Must have a strong portfolio and experience working with creative direction.',
    budget_min: 800,
    budget_max: 1500,
    date_timeframe: 'FEB - MAR 2026',
    poster_index: 1,
    is_featured: true,
  },
  {
    title: 'MURAL ARTIST WANTED — COMMUNITY CENTRE',
    art_type: 'Visual Arts',
    location: 'Vancouver, Canada',
    description: 'Northside Arts Collective is commissioning a large-scale mural for our new community centre. We are looking for an artist with experience in outdoor murals and community engagement.',
    budget_min: 3000,
    budget_max: 5000,
    date_timeframe: 'APR - MAY 2026',
    poster_index: 0,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createArtist(artist: typeof ARTISTS[0]) {
  console.log(`Creating artist: ${artist.full_name}...`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: artist.email,
    password: artist.password,
    email_confirm: true,
  });

  if (authError) {
    console.error(`  ✗ Auth error for ${artist.full_name}:`, authError.message);
    return null;
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: artist.full_name,
    username: artist.username,
    bio: artist.bio,
    discipline: artist.discipline,
    art_types: artist.art_types,
    tags: artist.tags,
    country: artist.country,
    city: artist.city,
    experience: artist.experience,
    is_available: artist.is_available,
    profile_photo_url: artist.photo_url,
    instagram: (artist as any).instagram ?? null,
    spotify_url: (artist as any).spotify_url ?? null,
    website: (artist as any).website ?? null,
    role: 'ARTIST',
    follower_count: Math.floor(Math.random() * 200) + 10,
  });

  if (profileError) {
    console.error(`  ✗ Profile error for ${artist.full_name}:`, profileError.message);
    return null;
  }

  console.log(`  ✓ ${artist.full_name} created (${userId})`);
  return userId;
}

async function createGigPoster(poster: typeof GIG_POSTERS[0]) {
  console.log(`Creating gig poster: ${poster.full_name}...`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: poster.email,
    password: poster.password,
    email_confirm: true,
  });

  if (authError) {
    console.error(`  ✗ Auth error for ${poster.full_name}:`, authError.message);
    return null;
  }

  const userId = authData.user.id;

  const { error: profileError } = await supabase.from('profiles').upsert({
    id: userId,
    full_name: poster.full_name,
    username: poster.username,
    profile_photo_url: poster.photo_url,
    role: 'GIG_POSTER',
  });

  if (profileError) {
    console.error(`  ✗ Profile error for ${poster.full_name}:`, profileError.message);
    return null;
  }

  console.log(`  ✓ ${poster.full_name} created (${userId})`);
  return userId;
}

async function createGig(gig: typeof SAMPLE_GIGS[0], posterUserIds: string[]) {
  const posterId = posterUserIds[gig.poster_index];
  if (!posterId) return;

  const { error } = await supabase.from('gigs').insert({
    poster_id: posterId,
    title: gig.title,
    art_type: gig.art_type,
    location: gig.location,
    description: gig.description,
    budget_min: gig.budget_min,
    budget_max: gig.budget_max,
    date_timeframe: gig.date_timeframe,
    status: 'active',
    is_featured: (gig as any).is_featured ?? false,
    interest_count: Math.floor(Math.random() * 8),
  });

  if (error) {
    console.error(`  ✗ Gig error:`, error.message);
  } else {
    console.log(`  ✓ Gig created: ${gig.title}`);
  }
}

async function createSamplePost(userId: string, name: string) {
  const postTypes = ['text', 'text', 'image'] as const;
  const type = postTypes[Math.floor(Math.random() * postTypes.length)];

  const textPosts = [
    `Just wrapped up a new piece. Six weeks of work and it finally feels right. Excited to share more soon.`,
    `Looking for collaborators on an upcoming project. If you work in visual arts or sound design, reach out.`,
    `Grateful for every person who has supported the work this year. More coming in 2026.`,
    `The best commissions are the ones where the client trusts you completely. Had one of those this week.`,
    `New work in progress. Can't share yet but it's the most ambitious thing I've attempted.`,
  ];

  const content = textPosts[Math.floor(Math.random() * textPosts.length)];

  const { error } = await supabase.from('posts').insert({
    user_id: userId,
    type: 'text',
    content,
    title: name.split(' ')[0].toUpperCase() + ' · NEW WORK',
    like_count: Math.floor(Math.random() * 40),
    comment_count: Math.floor(Math.random() * 8),
  });

  if (error) {
    console.error(`  ✗ Post error:`, error.message);
  } else {
    console.log(`  ✓ Post created for ${name}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎨 WOA SEED SCRIPT STARTING\n');

  // Create artists
  console.log('── CREATING ARTISTS ──────────────────');
  const artistIds: string[] = [];
  for (const artist of ARTISTS) {
    const id = await createArtist(artist);
    if (id) artistIds.push(id);
  }

  // Create gig posters
  console.log('\n── CREATING GIG POSTERS ──────────────');
  const posterIds: string[] = [];
  for (const poster of GIG_POSTERS) {
    const id = await createGigPoster(poster);
    if (id) posterIds.push(id);
  }

  // Create sample posts
  console.log('\n── CREATING POSTS ────────────────────');
  for (let i = 0; i < artistIds.length; i++) {
    await createSamplePost(artistIds[i], ARTISTS[i].full_name);
  }

  // Create gigs
  console.log('\n── CREATING GIGS ─────────────────────');
  for (const gig of SAMPLE_GIGS) {
    await createGig(gig, posterIds);
  }

  // Create some follows between artists
  console.log('\n── CREATING FOLLOWS ──────────────────');
  for (let i = 0; i < artistIds.length; i++) {
    const followTarget = artistIds[(i + 1) % artistIds.length];
    await supabase.from('follows').insert({
      follower_id: artistIds[i],
      following_id: followTarget,
    }).then(() => console.log(`  ✓ Follow: ${ARTISTS[i].username} → ${ARTISTS[(i + 1) % ARTISTS.length].username}`));
  }

  console.log('\n✅ SEED COMPLETE');
  console.log(`   ${artistIds.length} artists created`);
  console.log(`   ${posterIds.length} gig posters created`);
  console.log(`   ${SAMPLE_GIGS.length} gigs created`);
  console.log('\nAll accounts use password: Seed1234!\n');
}

main().catch(console.error);
