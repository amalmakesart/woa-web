import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { Post } from '../../components/PostCard';
import { findOrCreateConversation } from '../../lib/messaging';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_WIDTH - 2) / 3;

interface ArtistProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  art_type: string | null;
  discipline: string | null;
  art_types: string[] | null;
  profile_photo_url: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  experience: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  spotify_url: string | null;
  is_available: boolean;
  follower_count: number;
  rating: number | null;
  rating_count: number;
}

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({ rating, count }: { rating: number | null; count: number }) {
  if (!count || !rating) {
    return <Text style={star.none}>NO RATINGS YET</Text>;
  }
  const filled = Math.round(rating);
  const stars = Array.from({ length: 5 }, (_, i) => (i < filled ? '★' : '☆')).join('');
  return (
    <View style={star.row}>
      <Text style={star.stars}>{stars}</Text>
      <Text style={star.value}>{rating.toFixed(1)}</Text>
    </View>
  );
}

const star = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stars: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 1 },
  value: { color: colors.red, fontFamily: MONO, fontSize: 9 },
  none: { color: '#666666', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
});

// ─── Post Thumbnail ───────────────────────────────────────────────────────────

function PostThumb({ post, onPress }: { post: Post; onPress: () => void }) {
  return (
    <TouchableOpacity style={thumb.wrap} onPress={onPress} activeOpacity={0.85}>
      {post.type === 'image' && (
        post.media_url ? (
          <Image source={{ uri: post.media_url }} style={thumb.img} resizeMode="cover" />
        ) : (
          <View style={[thumb.img, thumb.imgPlaceholder]} />
        )
      )}

      {post.type === 'text' && (
        <View style={thumb.textBg}>
          <Text style={thumb.textContent} numberOfLines={3}>
            {(post.content ?? '').slice(0, 40).toUpperCase()}
          </Text>
          <Text style={thumb.typeTag}>T</Text>
        </View>
      )}

      {post.type === 'audio' && (
        <View style={thumb.audioBg}>
          <Text style={thumb.playTriangle}>▶</Text>
          <View style={thumb.waveRow}>
            {[6, 10, 8, 12, 7].map((h, i) => (
              <View key={i} style={[thumb.wavebar, { height: h }]} />
            ))}
          </View>
          <Text style={thumb.typeTag}>♪</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const thumb = StyleSheet.create({
  wrap: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  imgPlaceholder: {
    backgroundColor: colors.gray2,
  },
  textBg: {
    width: '100%',
    height: '100%',
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  textContent: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 8,
    textAlign: 'center',
    letterSpacing: 0.05,
    lineHeight: 12,
  },
  audioBg: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  playTriangle: {
    color: colors.red,
    fontSize: 18,
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  wavebar: {
    width: 3,
    backgroundColor: colors.red,
    borderRadius: 1,
    opacity: 0.6,
  },
  typeTag: {
    position: 'absolute',
    top: 5,
    right: 6,
    color: colors.red,
    fontFamily: MONO,
    fontSize: 8,
  },
});

// ─── ArtistProfileScreen ──────────────────────────────────────────────────────

export default function ArtistProfileScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const artistId: string = route.params?.userId;

  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [messagingLoading, setMessagingLoading] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string; post_count: number }[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);

      if (uid) {
        const { data: me } = await supabase
          .from('profiles')
          .select('profile_photo_url, role')
          .eq('id', uid)
          .single();
        if (me) {
          setCurrentUserAvatar((me as any).profile_photo_url ?? null);
          setCurrentUserRole((me as any).role ?? null);
        }

        const { data: follow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', uid)
          .eq('following_id', artistId)
          .maybeSingle();
        setIsFollowing(!!follow);
      }

      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, full_name, art_type, discipline, art_types, profile_photo_url, city, country, bio, experience, instagram, facebook, website, spotify_url, is_available, follower_count, rating, rating_count')
        .eq('id', artistId)
        .single();

      const profileData = pErr || !p
        ? await supabase.from('profiles')
            .select('id, username, full_name, art_type, profile_photo_url, city, country, bio, experience, instagram, facebook, website, follower_count, rating, rating_count')
            .eq('id', artistId).single().then(r => r.data ? { ...r.data, discipline: null, art_types: [], spotify_url: null, is_available: false } : null)
        : p;

      if (profileData) {
        setProfile(profileData as ArtistProfile);
        setFollowerCount((profileData as any).follower_count ?? 0);
        setIsAvailable((profileData as any).is_available ?? false);
      }

      // All post types
      const { data: postData } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', artistId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (postData) setPosts(postData as Post[]);

      // Load collections
      const { data: collData } = await supabase.from('collections')
        .select('id, name, post_count').eq('user_id', artistId).gt('post_count', 0).order('name');
      if (collData) setCollections(collData as any[]);

      setLoading(false);
    };

    init();
  }, [artistId]);

  const handleFollow = async () => {
    if (!currentUserId || followLoading) return;
    setFollowLoading(true);
    if (isFollowing) {
      setIsFollowing(false);
      setFollowerCount((c) => Math.max(0, c - 1));
      await supabase
        .from('follows')
        .delete()
        .match({ follower_id: currentUserId, following_id: artistId });
    } else {
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
      await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: artistId });
    }
    setFollowLoading(false);
  };

  const handleToggleAvailability = async (val: boolean) => {
    setIsAvailable(val);
    await supabase.from('profiles').update({ is_available: val }).eq('id', artistId);
  };

  const handleMessage = async () => {
    if (!currentUserId || messagingLoading) return;
    setMessagingLoading(true);
    const convId = await findOrCreateConversation(currentUserId, artistId, null);
    setMessagingLoading(false);
    if (!convId) { return; }
    navigation.navigate('Conversation', {
      conversationId: convId,
      otherUserId: artistId,
      otherUserName: profile?.full_name ?? profile?.username ?? null,
      otherUserUsername: profile?.username ?? null,
      otherUserAvatar: profile?.profile_photo_url ?? null,
      gigId: null,
      gigTitle: null,
    });
  };

  const openURL = (url: string | null) => {
    if (!url) return;
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>ARTISTS</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            <View style={styles.notifDot} />
            <OctagonalImage size={24} imageUri={currentUserAvatar} />
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>ARTISTS</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.notFound}>ARTIST NOT FOUND</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayName = (profile.full_name ?? profile.username ?? 'UNKNOWN').toUpperCase();
  const isOwnProfile = currentUserId === artistId;

  // Filter by collection if active
  const filteredPosts = activeCollection
    ? posts.filter((p: any) => p.collection_id === activeCollection)
    : posts;

  const rem = filteredPosts.length % 3;
  const paddedPosts: (Post | null)[] =
    rem === 0 ? filteredPosts : [...filteredPosts, ...Array<null>(3 - rem).fill(null)];

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>ARTISTS</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <View style={styles.notifDot} />
          <OctagonalImage
            size={24}
            imageUri={currentUserAvatar}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* PROFILE HERO */}
        <View style={styles.hero}>
          <OctagonalImage size={220} imageUri={profile.profile_photo_url} />

          <Text style={styles.heroName}>{displayName}</Text>
          <Text style={styles.heroUsername}>
            @{(profile.username ?? 'unknown').toUpperCase()}
          </Text>
          {(profile.discipline ?? profile.art_type) ? (
            <Text style={styles.heroArtType}>
              {(profile.discipline ?? profile.art_type ?? '').toUpperCase()}
            </Text>
          ) : null}
          {(profile.city || profile.country) ? (
            <View style={styles.locationRow}>
              <View style={styles.locationDot} />
              <Text style={styles.locationText}>
                {[profile.city, profile.country].filter(Boolean).join(' — ').toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>

        {/* STATS BAR */}
        <View style={styles.statsBar}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{posts.length}</Text>
            <Text style={styles.statLabel}>POSTS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{followerCount}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <StarRating rating={profile.rating} count={profile.rating_count} />
            <Text style={styles.statLabel}>RATING</Text>
          </View>
        </View>

        {/* FOLLOW / MESSAGE BUTTONS */}
        {!isOwnProfile && currentUserId ? (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followButtonActive]}
              onPress={handleFollow}
              activeOpacity={0.7}
              disabled={followLoading}
            >
              <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
                {isFollowing ? 'FOLLOWING ✓' : 'FOLLOW'}
              </Text>
            </TouchableOpacity>
            {currentUserRole === 'GIG_POSTER' ? (
              <TouchableOpacity
                style={[styles.messageButton, messagingLoading && styles.messageButtonBusy]}
                onPress={handleMessage}
                activeOpacity={0.7}
                disabled={messagingLoading}
              >
                <Text style={styles.messageButtonText}>
                  {messagingLoading ? '...' : 'MESSAGE'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* SOCIAL LINKS */}
        {(profile.instagram || profile.facebook || profile.website || profile.spotify_url) ? (
          <View style={styles.socialRow}>
            {profile.instagram ? (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => openURL(profile.instagram)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-instagram" size={18} color={colors.white} />
              </TouchableOpacity>
            ) : null}
            {profile.facebook ? (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => openURL(profile.facebook)}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-facebook" size={18} color={colors.white} />
              </TouchableOpacity>
            ) : null}
            {profile.website ? (
              <TouchableOpacity
                style={styles.socialBtn}
                onPress={() => openURL(profile.website)}
                activeOpacity={0.7}
              >
                <Ionicons name="globe-outline" size={18} color={colors.white} />
              </TouchableOpacity>
            ) : null}
            {profile.spotify_url ? (
              <TouchableOpacity
                style={[styles.socialBtn, styles.socialBtnSpotify]}
                onPress={() => openURL(profile.spotify_url)}
                activeOpacity={0.7}
              >
                <Ionicons name="musical-notes" size={18} color="#1DB954" />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* BIO */}
        {profile.bio ? (
          <View style={styles.section}>
            <Text style={styles.bioText}>{profile.bio.toUpperCase()}</Text>
          </View>
        ) : null}

        {/* AVAILABILITY + EXPERIENCE */}
        <View style={styles.section}>
          {isOwnProfile ? (
            <View style={styles.availabilityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.availabilityLabel}>AVAILABLE FOR GIGS</Text>
                <Text style={styles.availabilitySub}>
                  {isAvailable ? 'VISIBLE TO GIG POSTERS' : 'NOT CURRENTLY AVAILABLE'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleToggleAvailability(!isAvailable)}
                activeOpacity={0.8}
                style={[styles.toggleTrack, isAvailable && styles.toggleTrackOn]}
              >
                <View style={[styles.toggleThumb, isAvailable && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>
          ) : (
            isAvailable ? (
              <View style={styles.availabilityRow}>
                <View style={[styles.availabilityDot, styles.availabilityDotActive]} />
                <Text style={[styles.availabilityBadge, styles.availabilityBadgeActive]}>
                  AVAILABLE
                </Text>
              </View>
            ) : null
          )}
          {profile.experience ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>EXPERIENCE</Text>
              <View style={styles.experienceBadge}>
                <Text style={styles.experienceText}>
                  {profile.experience.toUpperCase()} YRS
                </Text>
              </View>
            </View>
          ) : null}
        </View>

        {/* ART TYPES */}
        {profile.art_types && profile.art_types.length > 0 ? (
          <View style={styles.tagsSection}>
            <View style={styles.tagsWrap}>
              {profile.art_types.map(type => (
                <View key={type} style={styles.tagPill}>
                  <Text style={styles.tagText}>{type.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* COLLECTIONS */}
        {collections.length > 0 ? (
          <View style={styles.collectionsSection}>
            <Text style={styles.collectionsSectionLabel}>COLLECTIONS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionsRow}>
              <TouchableOpacity
                style={[styles.collectionPill, activeCollection === null && styles.collectionPillActive]}
                onPress={() => setActiveCollection(null)}
                activeOpacity={0.7}
              >
                <Text style={[styles.collectionPillText, activeCollection === null && styles.collectionPillTextActive]}>ALL</Text>
              </TouchableOpacity>
              {collections.map((col) => (
                <TouchableOpacity
                  key={col.id}
                  style={[styles.collectionPill, activeCollection === col.id && styles.collectionPillActive]}
                  onPress={() => setActiveCollection(col.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.collectionPillText, activeCollection === col.id && styles.collectionPillTextActive]}>
                    {col.name.toUpperCase()} · {col.post_count}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {/* POSTS GRID */}
        <View style={styles.postsSection}>
          <Text style={styles.postsSectionLabel}>ART POSTS</Text>
          {posts.length === 0 ? (
            <View style={styles.noPostsContainer}>
              <Text style={styles.noPostsText}>NO POSTS YET</Text>
            </View>
          ) : (
            <View style={styles.postsGrid}>
              {paddedPosts.map((post, idx) =>
                post ? (
                  <PostThumb
                    key={post.id}
                    post={post}
                    onPress={() =>
                      navigation.navigate('PostDetail', { postId: post.id })
                    }
                  />
                ) : (
                  <View key={`pad-${idx}`} style={styles.thumbPad} />
                )
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.black,
  },
  scroll: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFound: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.2,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  backArrow: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 28,
    lineHeight: 32,
  },
  backLabel: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.18,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  heroName: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 18,
    letterSpacing: 0.2,
    marginTop: 16,
    marginBottom: 0,
    textAlign: 'center',
  },
  heroUsername: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.12,
    marginTop: 6,
  },
  heroArtType: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
    marginTop: 5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 7,
  },
  locationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  locationText: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.1,
  },

  // Stats bar
  statsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#111111',
    marginVertical: 12,
  },
  statValue: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 18,
    letterSpacing: 0.1,
  },
  statLabel: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.2,
  },

  // Action buttons row
  actionButtons: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 10,
  },

  // Follow button
  followButton: {
    flex: 1,
    marginTop: 0,
    borderWidth: 1,
    borderColor: colors.white,
    paddingVertical: 13,
    alignItems: 'center',
  },
  followButtonActive: {
    borderColor: '#333333',
  },
  followText: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.22,
  },
  followTextActive: {
    color: '#444444',
  },

  // Message button (gig posters only)
  messageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: 12,
    alignItems: 'center',
  },
  messageButtonBusy: {
    borderColor: '#333333',
  },
  messageButtonText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.22,
  },

  // Social links
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: '#222222',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialBtnSpotify: {
    borderColor: '#1DB954',
  },

  // Bio & details
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  bioText: {
    color: '#888888',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.08,
    lineHeight: 19,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0a0a0a',
  },
  detailLabel: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.18,
  },
  detailValue: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.1,
  },
  experienceBadge: {
    borderWidth: 1,
    borderColor: '#222222',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  experienceText: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.1,
  },

  // Availability
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0a0a0a',
  },
  availabilityDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#333333',
    marginRight: 10,
  },
  availabilityDotActive: { backgroundColor: '#2a7a4f' },
  availabilityBadge: {
    color: '#444444', fontFamily: MONO, fontSize: 10, letterSpacing: 0.15,
  },
  availabilityBadgeActive: { color: '#2a7a4f' },
  availabilityLabel: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 2 },
  availabilitySub: { color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  toggleTrack: {
    width: 32, height: 18, borderRadius: 9,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: colors.red },
  toggleThumb: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },

  // Tags
  tagsSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: {
    borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  tagText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },

  // Posts grid
  postsSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  postsSectionLabel: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  postsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: '#111111',
  },
  thumbPad: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    backgroundColor: colors.black,
  },
  noPostsContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noPostsText: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.2,
  },

  // Collections
  collectionsSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  collectionsSectionLabel: {
    color: '#444444',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.2,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  collectionsRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    flexDirection: 'row',
  },
  collectionPill: {
    borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 10, paddingVertical: 4,
  },
  collectionPillActive: { borderColor: '#f6c55a' },
  collectionPillText: { color: '#666666', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1 },
  collectionPillTextActive: { color: '#f6c55a' },
});
