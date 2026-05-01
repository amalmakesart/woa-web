import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  Modal,
  Share,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { getPostImageUris, Post } from '../../components/PostCard';
import VideoThumbnail from '../../components/VideoThumbnail';
import { blockUser, reportContent } from '../../lib/moderation';
import { buildProfileShareUrl } from '../../lib/shareLinks';

type ProfileTab = 'POSTS' | 'PORTFOLIO' | 'CALENDAR';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_WIDTH - 2) / 3;
const PROFILE_REFRESH_INTERVAL_MS = 30000;
function isPastShow(dateString: string) {
  return new Date(dateString).getTime() < Date.now();
}

function showHasExplicitTime(dateString: string) {
  const date = new Date(dateString);
  return date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0;
}

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
  is_verified: boolean;
  follower_count: number;
  rating: number | null;
  rating_count: number;
  booked_count: number;
  role: string | null;
  collective_type: string | null;
}

interface Show {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  show_date: string;
  ticket_url: string | null;
  description: string | null;
}

interface PortfolioSection {
  id: string;
  title: string;
  cover_image_url: string | null;
  display_order: number;
  items: { id: string; post_id: string; display_order: number; post?: Post }[];
}

interface Review {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  reviewer?: { username: string | null; full_name: string | null; profile_photo_url: string | null };
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
  value: { color: colors.red, fontFamily: MONO, fontSize: 11 },
  none: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
});

// ─── Post Thumbnail ───────────────────────────────────────────────────────────

function PostThumb({ post, onPress }: { post: Post; onPress: () => void }) {
  const imageUris = getPostImageUris(post);

  return (
    <TouchableOpacity style={thumb.wrap} onPress={onPress} activeOpacity={0.85}>
      {post.type === 'image' && (
        imageUris.length > 0 ? (
          <Image source={{ uri: imageUris[0] }} style={thumb.img} resizeMode="cover" />
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

      {post.type === 'video' && (
        <VideoThumbnail
          uri={post.media_url}
          label="VIDEO"
          cornerTag="▶"
          containerStyle={thumb.videoBg}
          centerPlayStyle={thumb.videoPlay}
          labelStyle={thumb.videoLabel}
          cornerTagStyle={thumb.videoTag}
        />
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
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.05,
    lineHeight: 16,
  },
  audioBg: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  videoBg: {
    width: '100%',
    height: '100%',
  },
  playTriangle: {
    color: colors.red,
    fontSize: 18,
  },
  videoPlay: {
    color: colors.white,
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
    fontSize: 11,
  },
  videoTag: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 11,
  },
  videoLabel: {
    color: '#ffffff',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.1,
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
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string; post_count: number }[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>('POSTS');
  const [selectedShow, setSelectedShow] = useState<Show | null>(null);
  const [shows, setShows] = useState<Show[]>([]);
  const [portfolioSections, setPortfolioSections] = useState<PortfolioSection[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const lastRefreshAtRef = useRef(0);

  useFocusEffect(useCallback(() => {
    const init = async () => {
      setLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;

      setCurrentUserId(uid);

      if (uid) {
        const { data: me } = await supabase
          .from('profiles')
          .select('profile_photo_url')
          .eq('id', uid)
          .single();
        if (me) {
          setCurrentUserAvatar((me as any).profile_photo_url ?? null);
        }

        const { data: follow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', uid)
          .eq('following_id', artistId)
          .maybeSingle();
        setIsFollowing(!!follow);

        // Check mutual follow (they also follow back)
        if (follow) {
          const { data: reverse } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', artistId)
            .eq('following_id', uid)
            .maybeSingle();
          setIsMutualFollow(!!reverse);
        }
      }

      const { data: p, error: pErr } = await supabase
        .from('profiles')
        .select('id, username, full_name, art_type, discipline, art_types, profile_photo_url, city, country, bio, experience, instagram, facebook, website, spotify_url, is_available, is_verified, follower_count, rating, rating_count, booked_count, role, collective_type')
        .eq('id', artistId)
        .single();

      const profileData = pErr || !p
        ? await supabase.from('profiles')
            .select('id, username, full_name, art_type, profile_photo_url, city, country, bio, experience, instagram, facebook, website, follower_count, rating, rating_count, booked_count, role, collective_type')
            .eq('id', artistId).single().then(r => r.data ? { ...r.data, discipline: null, art_types: [], spotify_url: null, is_available: false, is_verified: false, booked_count: 0 } : null)
        : p;

      if (profileData) {
        setProfile(profileData as ArtistProfile);
        setFollowerCount((profileData as any).follower_count ?? 0);
        setIsAvailable((profileData as any).is_available ?? false);
      }

      const { count: following } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', artistId);
      setFollowingCount(following ?? 0);

      // Posts
      const { data: ownedPosts } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', artistId)
        .order('created_at', { ascending: false })
        .limit(30);

      const { data: collaboratorRows } = await supabase
        .from('post_collaborators')
        .select('post_id')
        .eq('collaborator_id', artistId)
        .eq('accepted', true);

      const collaboratorPostIds = [...new Set((collaboratorRows ?? []).map((row: any) => row.post_id as string))]
        .filter((id) => !(ownedPosts ?? []).some((post: any) => post.id === id));

      let collaboratorPosts: any[] = [];
      if (collaboratorPostIds.length > 0) {
        const { data: extraPosts } = await supabase
          .from('posts')
          .select('*')
          .in('id', collaboratorPostIds)
          .order('created_at', { ascending: false });
        collaboratorPosts = extraPosts ?? [];
      }

      const postData = [...(ownedPosts ?? []), ...collaboratorPosts]
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30);
      setPosts(postData as Post[]);

      // Collections
      const { data: collData } = await supabase.from('collections')
        .select('id, name, post_count').eq('user_id', artistId).gt('post_count', 0).order('name');
      if (collData) setCollections(collData as any[]);

      // Shows
      const { data: showData } = await supabase
        .from('shows')
        .select('*')
        .eq('artist_id', artistId)
        .order('show_date', { ascending: true });
      if (showData) setShows(showData as Show[]);

      // Portfolio sections
      const { data: secData } = await supabase
        .from('portfolio_sections')
        .select('id, title, cover_image_url, display_order')
        .eq('artist_id', artistId)
        .order('display_order', { ascending: true });

      const postMap: Record<string, Post> = {};
      postData.forEach((p2: any) => { postMap[p2.id] = p2 as Post; });

      const enrichedSections: PortfolioSection[] = [];
      for (const sec of (secData ?? []) as any[]) {
        const { data: itemData } = await supabase
          .from('portfolio_items')
          .select('id, post_id, display_order')
          .eq('section_id', sec.id)
          .order('display_order', { ascending: true });
        enrichedSections.push({
          ...sec,
          items: (itemData ?? []).map((item: any) => ({ ...item, post: postMap[item.post_id] })),
        });
      }
      setPortfolioSections(enrichedSections);

      // Reviews
      const { data: reviewData } = await supabase
        .from('reviews')
        .select('id, rating, body, created_at, reviewer:reviewer_id(username, full_name, profile_photo_url)')
        .eq('reviewee_id', artistId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (reviewData) setReviews(reviewData as any[]);

      setLoading(false);
      lastRefreshAtRef.current = Date.now();
    };

    if (Date.now() - lastRefreshAtRef.current > PROFILE_REFRESH_INTERVAL_MS || !profile) {
      void init();
    }
    return () => {};
  }, [artistId, profile]));

  const handleFollow = async () => {
    if (!currentUserId || followLoading) return;
    setFollowLoading(true);
    if (isFollowing) {
      setIsFollowing(false);
      setIsMutualFollow(false);
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
      await supabase.from('notifications').insert({
        user_id: artistId,
        type: 'new_follower',
        actor_id: currentUserId,
        reference_id: currentUserId,
        reference_type: 'profile',
        is_read: false,
      });
      // Check if now mutual
      const { data: reverse } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', artistId)
        .eq('following_id', currentUserId)
        .maybeSingle();
      setIsMutualFollow(!!reverse);
    }
    setFollowLoading(false);
  };

  const handleMessage = async () => {
    if (!currentUserId) return;
    if (!isMutualFollow) {
      Alert.alert('FOLLOW EACH OTHER FIRST', 'YOU MUST BOTH FOLLOW EACH OTHER TO START A CONVERSATION.');
      return;
    }
    // Find or create a direct conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('conversation_type', 'direct')
      .or(
        `and(gig_poster_id.eq.${currentUserId},artist_id.eq.${artistId}),and(gig_poster_id.eq.${artistId},artist_id.eq.${currentUserId})`
      )
      .maybeSingle();

    let conversationId = (existing as any)?.id ?? null;
    if (!conversationId) {
      const { data: created } = await supabase
        .from('conversations')
        .insert({
          gig_poster_id: currentUserId,
          artist_id: artistId,
          gig_id: null,
          conversation_type: 'direct',
        })
        .select('id')
        .single();
      conversationId = (created as any)?.id ?? null;
    }
    if (!conversationId) { Alert.alert('ERROR', 'COULD NOT START CONVERSATION.'); return; }
    navigation.navigate('Conversation', {
      conversationId,
      otherUserId: artistId,
      otherUserName: profile?.full_name ?? profile?.username ?? null,
      otherUserUsername: profile?.username ?? null,
      otherUserAvatar: profile?.profile_photo_url ?? null,
      gigId: null,
      gigTitle: null,
    });
  };

  const handleToggleAvailability = async (val: boolean) => {
    setIsAvailable(val);
    await supabase.from('profiles').update({ is_available: val }).eq('id', artistId);
  };

  const openURL = (url: string | null) => {
    if (!url) return;
    const full = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(full).catch(() => {});
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    const url = buildProfileShareUrl(profile.id);
    const name = profile.full_name ?? profile.username ?? 'this artist';
    try {
      await Share.share({
        title: `${name} on WORK(ER) OF ART`,
        message: `${name} on WORK(ER) OF ART\n${url}`,
        url,
      });
    } catch {
      /* user cancelled */
    }
  };

  const handleReportProfile = async () => {
    if (!profile) return;
    try {
      await reportContent({
        targetType: 'profile',
        targetId: profile.id,
        targetUserId: profile.id,
        reason: 'Profile reported from artist profile',
      });
      Alert.alert('REPORTED', 'Thank you. We will review this profile.');
    } catch (error: any) {
      Alert.alert('REPORT FAILED', (error?.message ?? 'Please try again.').toUpperCase());
    }
  };

  const handleBlockProfile = async () => {
    if (!profile || isOwnProfile) return;
    const handle = (profile.username ?? profile.full_name ?? 'THIS USER').toUpperCase();
    Alert.alert(
      `BLOCK ${handle}?`,
      'You will stop seeing their posts and profile in the app.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'BLOCK',
          style: 'destructive',
          onPress: async () => {
            try {
              await blockUser(profile.id);
              Alert.alert('BLOCKED', 'This profile has been blocked.');
              navigation.goBack();
            } catch (error: any) {
              Alert.alert('BLOCK FAILED', (error?.message ?? 'Please try again.').toUpperCase());
            }
          },
        },
      ]
    );
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
  const canInteractWithProfile = !!currentUserId && !isOwnProfile;
  const upcomingShows = shows.filter(show => !isPastShow(show.show_date));
  const pastShows = [...shows.filter(show => isPastShow(show.show_date))].reverse();

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

          <View style={styles.heroNameRow}>
            <Text style={styles.heroName}>{displayName}</Text>
            {profile.is_verified ? (
              <Ionicons name="checkmark-circle" size={18} color="#f6c55a" />
            ) : null}
          </View>
          {profile.is_verified ? (
            <View style={styles.verifiedBanner}>
              <View style={styles.verifiedBox}>
                <Text style={styles.verifiedWoa}>WOA</Text>
                <View style={styles.verifiedDot} />
              </View>
              <Text style={styles.verifiedText}>VERIFIED ARTIST</Text>
            </View>
          ) : null}
          {profile.role === 'COLLECTIVE' ? (
            <View style={styles.collectiveBadge}>
              <Text style={styles.collectiveBadgeIcon}>◈</Text>
              <Text style={styles.collectiveBadgeText}>
                ART COLLECTIVE{profile.collective_type ? ` · ${profile.collective_type.toUpperCase()}` : ''}
              </Text>
            </View>
          ) : null}
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
          <TouchableOpacity
            style={styles.statCell}
            onPress={() => navigation.navigate('FollowList', {
              userId: artistId,
              mode: 'followers',
              title: 'FOLLOWERS',
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>{followerCount}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity
            style={styles.statCell}
            onPress={() => navigation.navigate('FollowList', {
              userId: artistId,
              mode: 'following',
              title: 'FOLLOWING',
            })}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>{followingCount}</Text>
            <Text style={styles.statLabel}>FOLLOWING</Text>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statValue, (profile.booked_count ?? 0) > 0 && styles.statValueGold]}>
              {profile.booked_count ?? 0}
            </Text>
            <Text style={styles.statLabel}>BOOKED</Text>
          </View>
        </View>

        {/* FOLLOW + MESSAGE BUTTONS */}
        {canInteractWithProfile ? (
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
            <TouchableOpacity
              style={[styles.messageButton, !isMutualFollow && styles.messageButtonDimmed]}
              onPress={handleMessage}
              activeOpacity={0.7}
            >
              <Text style={[styles.messageButtonText, !isMutualFollow && styles.messageButtonTextDimmed]}>
                MESSAGE
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.utilityActions}>
          <TouchableOpacity style={styles.utilityButton} onPress={handleShareProfile} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={15} color={colors.white} />
            <Text style={styles.utilityButtonText}>SHARE PROFILE</Text>
          </TouchableOpacity>
          {canInteractWithProfile ? (
            <>
              <TouchableOpacity style={styles.utilityButton} onPress={handleReportProfile} activeOpacity={0.7}>
                <Ionicons name="flag-outline" size={15} color={colors.red} />
                <Text style={[styles.utilityButtonText, styles.utilityButtonDanger]}>REPORT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.utilityButton} onPress={handleBlockProfile} activeOpacity={0.7}>
                <Ionicons name="ban-outline" size={15} color={colors.red} />
                <Text style={[styles.utilityButtonText, styles.utilityButtonDanger]}>BLOCK</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

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

        {/* TAB SWITCHER */}
        <View style={styles.tabBar}>
          {(['POSTS', 'PORTFOLIO', 'CALENDAR'] as ProfileTab[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, activeTab === tab && styles.tabItemActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* POSTS TAB */}
        {activeTab === 'POSTS' ? (
          <>
            {collections.length > 0 ? (
              <View style={styles.collectionsSection}>
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

            <View style={styles.postsSection}>
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
                        onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                      />
                    ) : (
                      <View key={`pad-${idx}`} style={styles.thumbPad} />
                    )
                  )}
                </View>
              )}
            </View>

            {/* Reviews */}
            {reviews.length > 0 ? (
              <View style={styles.reviewsSection}>
                <Text style={styles.reviewsSectionLabel}>REVIEWS · {reviews.length}</Text>
                {reviews.map(r => (
                  <View key={r.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <OctagonalImage size={24} imageUri={(r.reviewer as any)?.profile_photo_url ?? null} />
                      <Text style={styles.reviewerName}>
                        {((r.reviewer as any)?.full_name ?? (r.reviewer as any)?.username ?? 'ANONYMOUS').toUpperCase()}
                      </Text>
                      <Text style={styles.reviewStars}>
                        {Array.from({ length: 5 }, (_, i) => i < r.rating ? '★' : '☆').join('')}
                      </Text>
                    </View>
                    {r.body ? <Text style={styles.reviewBody}>{r.body}</Text> : null}
                    <Text style={styles.reviewDate}>
                      {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase()}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        ) : null}

        {/* PORTFOLIO TAB */}
        {activeTab === 'PORTFOLIO' ? (
          <View style={styles.portfolioTab}>
            {portfolioSections.length === 0 ? (
              <View style={styles.noPostsContainer}>
                <Text style={styles.noPostsText}>NO PORTFOLIO YET</Text>
                <Text style={styles.emptyHint}>
                  {isOwnProfile
                    ? 'CURATE YOUR BEST POSTS INTO PORTFOLIO SECTIONS.'
                    : 'THIS ARTIST HAS NOT CURATED A PORTFOLIO YET.'}
                </Text>
                {isOwnProfile ? (
                  <TouchableOpacity
                    style={styles.emptyAction}
                    onPress={() => navigation.navigate('ManagePortfolio')}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.emptyActionText}>MANAGE PORTFOLIO</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              portfolioSections.map(sec => (
                <View key={sec.id} style={styles.portfolioSection}>
                  <View style={styles.portfolioSectionHeader}>
                    {sec.cover_image_url ? (
                      <Image source={{ uri: sec.cover_image_url }} style={styles.portfolioSectionCover} />
                    ) : null}
                    <Text style={styles.portfolioSectionTitle}>{sec.title.toUpperCase()}</Text>
                    <Text style={styles.portfolioSectionCount}>{sec.items.length} {sec.items.length === 1 ? 'PIECE' : 'PIECES'}</Text>
                  </View>
                  <View style={styles.postsGrid}>
                    {sec.items.map(item => item.post ? (
                      <PostThumb
                        key={item.id}
                        post={item.post}
                        onPress={() => navigation.navigate('PostDetail', { postId: item.post_id })}
                      />
                    ) : null)}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* CALENDAR TAB */}
        {activeTab === 'CALENDAR' ? (
          <View style={styles.showsTab}>
            {shows.length === 0 ? (
              <View style={styles.noPostsContainer}>
                <Text style={styles.noPostsText}>NO SHOWS YET</Text>
              </View>
            ) : (
              <>
                {upcomingShows.length > 0 ? (
                  <>
                    <Text style={styles.showSectionLabel}>UPCOMING</Text>
                    {upcomingShows.map(show => (
                      <TouchableOpacity
                        key={show.id}
                        style={styles.showCard}
                        onPress={() => setSelectedShow(show)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.showDateBadge}>
                          <Text style={styles.showDateDay}>
                            {new Date(show.show_date).toLocaleDateString('en-US', { day: '2-digit' }).toUpperCase()}
                          </Text>
                          <Text style={styles.showDateMonth}>
                            {new Date(show.show_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.showInfo}>
                          <Text style={styles.showTitle}>{show.title.toUpperCase()}</Text>
                          {(show.venue || show.city) ? (
                            <Text style={styles.showMeta}>
                              {[show.venue, show.city].filter(Boolean).join(' · ').toUpperCase()}
                            </Text>
                          ) : null}
                          {show.description ? (
                            <Text style={styles.showDesc} numberOfLines={2}>{show.description}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.showChevron}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : null}

                {pastShows.length > 0 ? (
                  <>
                    <Text style={styles.showSectionLabel}>PAST</Text>
                    {pastShows.map(show => (
                      <TouchableOpacity
                        key={show.id}
                        style={[styles.showCard, styles.showCardPast]}
                        onPress={() => setSelectedShow(show)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.showDateBadge}>
                          <Text style={styles.showDateDay}>
                            {new Date(show.show_date).toLocaleDateString('en-US', { day: '2-digit' }).toUpperCase()}
                          </Text>
                          <Text style={styles.showDateMonth}>
                            {new Date(show.show_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.showInfo}>
                          <Text style={[styles.showTitle, styles.showTitlePast]}>{show.title.toUpperCase()}</Text>
                          {(show.venue || show.city) ? (
                            <Text style={styles.showMeta}>
                              {[show.venue, show.city].filter(Boolean).join(' · ').toUpperCase()}
                            </Text>
                          ) : null}
                          {show.description ? (
                            <Text style={styles.showDesc} numberOfLines={2}>{show.description}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.showChevron}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {/* Show detail modal */}
        {selectedShow ? (
          <Modal
            visible={!!selectedShow}
            animationType="slide"
            transparent
            onRequestClose={() => setSelectedShow(null)}
          >
            <TouchableOpacity
              style={styles.showModalOverlay}
              activeOpacity={1}
              onPress={() => setSelectedShow(null)}
            >
              <View style={styles.showModalSheet} onStartShouldSetResponder={() => true}>
                <View style={styles.showModalHandle} />
                <View style={styles.showModalDateRow}>
                  <View style={styles.showDateBadge}>
                    <Text style={styles.showDateDay}>
                      {new Date(selectedShow.show_date).toLocaleDateString('en-US', { day: '2-digit' }).toUpperCase()}
                    </Text>
                    <Text style={styles.showDateMonth}>
                      {new Date(selectedShow.show_date).toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.showModalYear}>
                      {new Date(selectedShow.show_date).getFullYear()}
                    </Text>
                    <Text style={styles.showModalTime}>
                      {showHasExplicitTime(selectedShow.show_date)
                        ? new Date(selectedShow.show_date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                        : 'TIME TBA'}
                    </Text>
                  </View>
                </View>

                <Text style={styles.showModalTitle}>{selectedShow.title.toUpperCase()}</Text>

                {(selectedShow.venue || selectedShow.city) ? (
                  <Text style={styles.showModalMeta}>
                    {[selectedShow.venue, selectedShow.city].filter(Boolean).join('\n').toUpperCase()}
                  </Text>
                ) : null}

                {selectedShow.description ? (
                  <Text style={styles.showModalDesc}>{selectedShow.description}</Text>
                ) : null}

                <View style={styles.showModalActionRow}>
                  {selectedShow.ticket_url ? (
                    <TouchableOpacity
                      style={[styles.showModalTicketBtn, styles.showModalWideBtn]}
                      onPress={() => openURL(selectedShow.ticket_url)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.showModalTicketText}>GET TICKETS</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.showModalCloseBtn}
                  onPress={() => setSelectedShow(null)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.showModalCloseText}>CLOSE</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>
        ) : null}

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
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
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
    color: '#9a9a9a',
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
    textAlign: 'center',
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 0,
  },
  verifiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  verifiedBox: {
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: '#f6c55a',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
    paddingVertical: 2,
    gap: 3,
  },
  verifiedWoa: {
    color: '#f6c55a',
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  verifiedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  verifiedText: {
    color: '#f6c55a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  collectiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#9B4FDB',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  collectiveBadgeIcon: {
    color: '#9B4FDB',
    fontSize: 12,
  },
  collectiveBadgeText: {
    color: '#9B4FDB',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  heroUsername: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.12,
    marginTop: 6,
  },
  heroArtType: {
    color: '#b5b5b5',
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
    color: '#b5b5b5',
    fontFamily: MONO,
    fontSize: 11,
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
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
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
    fontSize: 11,
    letterSpacing: 0.22,
  },
  followTextActive: {
    color: '#8f8f8f',
  },

  statValueGold: { color: '#f6c55a' },

  // Message button
  messageButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: 12,
    alignItems: 'center',
  },
  messageButtonDimmed: {
    borderColor: '#333333',
  },
  messageButtonText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.22,
  },
  messageButtonTextDimmed: {
    color: '#9a9a9a',
  },
  utilityActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 2,
  },
  utilityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#222222',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  utilityButtonText: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.15,
  },
  utilityButtonDanger: {
    color: colors.red,
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
    color: '#b5b5b5',
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
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.18,
  },
  detailValue: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 11,
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
    fontSize: 11,
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
    color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15,
  },
  availabilityBadgeActive: { color: '#2a7a4f' },
  availabilityLabel: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 2 },
  availabilitySub: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
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
  tagText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },

  // Posts grid
  postsSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  postsSectionLabel: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
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
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  emptyHint: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.12,
    lineHeight: 16,
    marginTop: 10,
    paddingHorizontal: 32,
    textAlign: 'center',
  },
  emptyAction: {
    borderWidth: 1,
    borderColor: '#f6c55a',
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: '#f6c55a',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.18,
  },

  // Collections
  collectionsSection: {
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  collectionsSectionLabel: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
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
  collectionPillText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collectionPillTextActive: { color: '#f6c55a' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabItemActive: { borderBottomWidth: 2, borderBottomColor: colors.white },
  tabText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  tabTextActive: { color: colors.white },

  // Portfolio tab
  portfolioTab: {},
  portfolioSection: { borderBottomWidth: 1, borderBottomColor: '#111111', paddingBottom: 12 },
  portfolioSectionHeader: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, gap: 4,
  },
  portfolioSectionCover: { width: '100%', height: 120, backgroundColor: '#111111', marginBottom: 8 },
  portfolioSectionTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15 },
  portfolioSectionCount: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },

  // Shows tab
  showsTab: { paddingTop: 4 },
  showSectionLabel: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  showCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
  },
  showCardPast: { opacity: 0.58 },
  showDateBadge: {
    width: 40, alignItems: 'center',
    backgroundColor: '#0a0000',
    borderWidth: 1, borderColor: '#1a1a1a',
    paddingVertical: 6,
  },
  showDateDay: { color: colors.red, fontFamily: MONO, fontSize: 16, letterSpacing: 0.1 },
  showDateMonth: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.12 },
  showInfo: { flex: 1 },
  showTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 4 },
  showTitlePast: { color: '#9a9a9a' },
  showMeta: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, marginBottom: 4 },
  showDesc: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.08, lineHeight: 15 },
  showChevron: { color: '#333333', fontFamily: MONO, fontSize: 20 },
  ticketBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  ticketBtnText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },

  // Show detail modal
  showModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  showModalSheet: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1, borderTopColor: '#1a1a1a',
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16,
  },
  showModalHandle: {
    width: 36, height: 3, backgroundColor: '#333333',
    alignSelf: 'center', borderRadius: 2, marginBottom: 20,
  },
  showModalDateRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16,
  },
  showModalYear: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  showModalTime: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, marginTop: 2 },
  showModalTitle: { color: colors.white, fontFamily: MONO, fontSize: 16, letterSpacing: 0.2, marginBottom: 10 },
  showModalMeta: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 17, marginBottom: 12 },
  showModalDesc: { color: '#777777', fontFamily: MONO, fontSize: 11, letterSpacing: 0.08, lineHeight: 18, marginBottom: 20 },
  showModalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  showModalTicketBtn: {
    backgroundColor: colors.red,
    flex: 1,
    height: 46, alignItems: 'center', justifyContent: 'center',
  },
  showModalSecondaryBtn: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  showModalWideBtn: {
    flexBasis: '100%',
  },
  showModalTicketText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3 },
  showModalCloseBtn: {
    borderWidth: 1, borderColor: '#222222',
    height: 40, alignItems: 'center', justifyContent: 'center',
  },
  showModalCloseText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },

  // Reviews
  reviewsSection: {
    paddingTop: 8, borderTopWidth: 1, borderTopColor: '#111111',
  },
  reviewsSectionLabel: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  reviewCard: {
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#0a0a0a',
  },
  reviewHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8,
  },
  reviewerName: { flex: 1, color: '#b5b5b5', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12 },
  reviewStars: { color: '#f6c55a', fontFamily: MONO, fontSize: 11, letterSpacing: 1 },
  reviewBody: { color: '#888888', fontFamily: MONO, fontSize: 11, letterSpacing: 0.08, lineHeight: 17, marginBottom: 6 },
  reviewDate: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
});
