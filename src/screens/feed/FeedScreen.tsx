import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import PostCard, { Post } from '../../components/PostCard';
import OctagonalImage from '../../components/OctagonalImage';
import BellButton from '../../components/BellButton';
import MessageButton from '../../components/MessageButton';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';

type FeedTab = 'foryou' | 'following' | 'arttype' | 'location';

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'foryou', label: 'FOR YOU' },
  { key: 'following', label: 'FOLLOWING' },
  { key: 'arttype', label: 'ART TYPE' },
  { key: 'location', label: 'LOCATION' },
];

// ─── Header ───────────────────────────────────────────────────────────────────

function FeedHeader({
  onAvatarPress, onBellPress, onMessagePress, avatarUri,
}: {
  onAvatarPress: () => void;
  onBellPress: () => void;
  onMessagePress: () => void;
  avatarUri: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerLogo}>WOA</Text>
        <Text style={styles.headerDot}>●</Text>
      </View>
      <View style={styles.headerRight}>
        <MessageButton onPress={onMessagePress} />
        <BellButton onPress={onBellPress} />
        <OctagonalImage size={24} imageUri={avatarUri} onPress={onAvatarPress} />
      </View>
    </View>
  );
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────

function TabBar({ active, onChange }: { active: FeedTab; onChange: (t: FeedTab) => void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.tabBar}
      contentContainerStyle={styles.tabBarContent}
    >
      {TABS.map(({ key, label }) => (
        <TouchableOpacity
          key={key}
          style={styles.tabItem}
          onPress={() => onChange(key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabLabel, active === key && styles.tabLabelActive]}>
            {label}
          </Text>
          {active === key && <View style={styles.tabUnderline} />}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.skeletonCard}>
      <View style={styles.skeletonBarWide} />
      <View style={styles.skeletonBarWide} />
      <View style={styles.skeletonContent} />
      <View style={styles.skeletonBarNarrow} />
    </View>
  );
}

function sortPostsWithPinnedFirst(items: Post[]) {
  return [...items].sort((a, b) => {
    const pinDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
    if (pinDelta !== 0) return pinDelta;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

function scoreForYouPosts(items: Post[], userArtTypes: string[]): Post[] {
  if (userArtTypes.length === 0) return sortPostsWithPinnedFirst(items);
  const userSet = new Set(userArtTypes.map(t => t.toLowerCase()));
  return [...items].sort((a, b) => {
    const pinDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
    if (pinDelta !== 0) return pinDelta;
    const aScore = ((a.profiles as any)?.art_types ?? []).filter((t: string) => userSet.has(t.toLowerCase())).length;
    const bScore = ((b.profiles as any)?.art_types ?? []).filter((t: string) => userSet.has(t.toLowerCase())).length;
    if (bScore !== aScore) return bScore - aScore;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function FeedScreen() {
  const navigation = useNavigation<any>();

  const [activeTab, setActiveTab] = useState<FeedTab>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [likedPostIds, setLikedPostIds] = useState<Set<string>>(new Set());
  const [bookmarkedPostIds, setBookmarkedPostIds] = useState<Set<string>>(new Set());
  const [followingUserIds, setFollowingUserIds] = useState<Set<string>>(new Set());
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userProfile, setUserProfile] = useState<{
    discipline: string | null;
    city: string | null;
    country: string | null;
    art_types: string[];
  }>({ discipline: null, city: null, country: null, art_types: [] });

  const [toast, setToast] = useState<string | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  };

  // ── Load social state ────────────────────────────────────────────────────

  const loadSocialState = useCallback(async (uid: string) => {
    const [likes, bookmarks, following, blocks] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', uid),
      supabase.from('bookmarks').select('post_id').eq('user_id', uid),
      supabase.from('follows').select('following_id').eq('follower_id', uid),
      supabase.from('blocks').select('blocked_id').eq('blocker_id', uid),
    ]);
    if (likes.data) setLikedPostIds(new Set(likes.data.map((l: any) => l.post_id as string)));
    if (bookmarks.data) setBookmarkedPostIds(new Set(bookmarks.data.map((b: any) => b.post_id as string)));
    if (following.data) setFollowingUserIds(new Set(following.data.map((f: any) => f.following_id as string)));
    if (blocks.data) setBlockedUserIds(new Set(blocks.data.map((b: any) => b.blocked_id as string)));
  }, []);

  // ── Query posts by tab ───────────────────────────────────────────────────

  const fetchPostsForTab = useCallback(async (
    tab: FeedTab,
    uid: string | null,
    profile: { discipline: string | null; city: string | null; country: string | null; art_types: string[] },
    blocked: Set<string>,
  ): Promise<Post[]> => {
    let userIds: string[] | null = null;

    if (tab === 'following' && uid) {
      const { data } = await supabase.from('follows').select('following_id').eq('follower_id', uid);
      userIds = data?.map((f: any) => f.following_id) ?? [];
      if (userIds.length === 0) return [];
    }

    if (tab === 'arttype' && uid && profile.discipline) {
      const { data } = await supabase.from('profiles')
        .select('id').eq('discipline', profile.discipline).neq('id', uid);
      userIds = data?.map((p: any) => p.id) ?? [];
      if (userIds.length === 0) return [];
    }

    if (tab === 'location' && uid && (profile.city || profile.country)) {
      let q = supabase.from('profiles').select('id').neq('id', uid);
      if (profile.city) {
        q = q.or(`city.eq.${profile.city},country.eq.${profile.country ?? ''}`);
      } else if (profile.country) {
        q = q.eq('country', profile.country);
      }
      const { data } = await q;
      userIds = data?.map((p: any) => p.id) ?? [];
      if (userIds.length === 0) return [];
    }

    let query = supabase
      .from('posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50);
    if (userIds !== null) query = query.in('user_id', userIds);

    const { data: ownedPosts, error } = await query;
    if (error || !ownedPosts) return [];

    let collaboratorPosts: any[] = [];
    if (userIds !== null && userIds.length > 0) {
      const { data: collaboratorRows } = await supabase
        .from('post_collaborators')
        .select('post_id')
        .eq('accepted', true)
        .in('collaborator_id', userIds);

      const collaboratorPostIds = [...new Set((collaboratorRows ?? []).map((row: any) => row.post_id as string))]
        .filter((id) => !(ownedPosts as any[]).some((post) => post.id === id));

      if (collaboratorPostIds.length > 0) {
        const { data: extraPosts } = await supabase
          .from('posts')
          .select('*')
          .in('id', collaboratorPostIds)
          .order('created_at', { ascending: false });
        collaboratorPosts = extraPosts ?? [];
      }
    }

    const postsData = [...ownedPosts, ...collaboratorPosts]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // Filter blocked users
    const filtered = postsData.filter((p: any) => !blocked.has(p.user_id));

    // Fetch profiles
    const ids = [...new Set(filtered.map((p: any) => p.user_id as string))];
    let profileMap: Record<string, any> = {};
    if (ids.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles').select('id, username, profile_photo_url, art_type, art_types, discipline, full_name, role').in('id', ids);
      if (profilesData) profileMap = Object.fromEntries(profilesData.map((p: any) => [p.id, p]));
    }

    const mapped = filtered.map((p: any) => ({ ...p, profiles: profileMap[p.user_id] ?? null })) as Post[];
    if (tab === 'foryou') return scoreForYouPosts(mapped, profile.art_types);
    return sortPostsWithPinnedFirst(mapped);
  }, []);

  // ── Load posts ───────────────────────────────────────────────────────────

  const loadPosts = useCallback(async (tab: FeedTab, showTabLoader = false) => {
    if (showTabLoader) setTabLoading(true);
    const uid = currentUserIdRef.current;
    const blocked = blockedUserIds;
    const posts = await fetchPostsForTab(tab, uid, userProfile, blocked);
    setPosts(posts);
    if (showTabLoader) setTabLoading(false);
  }, [fetchPostsForTab, blockedUserIds, userProfile]);

  // ── Init on mount ────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);
      currentUserIdRef.current = uid;

      if (uid) {
        const [profResult, authResult] = await Promise.all([
          supabase.from('profiles')
            .select('profile_photo_url, discipline, city, country, role, art_types').eq('id', uid).single(),
          supabase.auth.getUser(),
        ]);
        if (profResult.data) {
          setAvatarUri((profResult.data as any).profile_photo_url ?? null);
          setUserRole((profResult.data as any).role ?? null);
          setUserProfile({
            discipline: (profResult.data as any).discipline ?? null,
            city: (profResult.data as any).city ?? null,
            country: (profResult.data as any).country ?? null,
            art_types: (profResult.data as any).art_types ?? [],
          });
        }
        if (authResult.data.user?.email === 'amalmakesart@gmail.com') {
          setIsAdmin(true);
        }
        await loadSocialState(uid);
      }
    };
    init();

    const channel = supabase.channel('feed-posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' },
        async (payload) => {
          const newRow = payload.new as Post;
          if (blockedUserIds.has(newRow.user_id)) return;
          const { data } = await supabase.from('posts')
            .select('*, profiles(username, profile_photo_url, art_type, discipline, full_name, role)')
            .eq('id', newRow.id).single();
          if (data) {
            setPosts((prev) => {
              if (prev.some((p) => p.id === (data as Post).id)) return prev;
              return [data as Post, ...prev];
            });
          }
        }
      ).subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Reload on focus ──────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      const uid = currentUserIdRef.current;
      const run = async () => {
        const blocked = uid
          ? await supabase.from('blocks').select('blocked_id').eq('blocker_id', uid)
              .then(r => new Set((r.data ?? []).map((b: any) => b.blocked_id as string)))
          : new Set<string>();
        setBlockedUserIds(blocked);
        const p = await fetchPostsForTab(activeTab, uid, userProfile, blocked);
        setPosts(p);
        if (uid) await loadSocialState(uid);
        setLoading(false);
      };
      run();
    }, [activeTab, userProfile, fetchPostsForTab, loadSocialState])
  );

  // ── Tab change ───────────────────────────────────────────────────────────

  const handleTabChange = (tab: FeedTab) => {
    setActiveTab(tab);
    loadPosts(tab, true);
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleLike = async (post: Post) => {
    if (!currentUserId) return;
    const wasLiked = likedPostIds.has(post.id);
    setLikedPostIds((prev) => {
      const next = new Set(prev);
      wasLiked ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    setPosts((prev) => prev.map((p) =>
      p.id === post.id ? { ...p, like_count: p.like_count + (wasLiked ? -1 : 1) } : p
    ));
    if (wasLiked) {
      await supabase.from('likes').delete().match({ post_id: post.id, user_id: currentUserId });
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: currentUserId });
      if (currentUserId !== post.user_id) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          type: 'post_liked',
          actor_id: currentUserId,
          reference_id: post.id,
          reference_type: 'post',
          preview_text: post.title ?? post.content?.slice(0, 40) ?? null,
          is_read: false,
        });
      }
    }
  };

  const handlePin = async (post: Post) => {
    const newPinned = !post.is_pinned;
    setPosts((prev) => {
      const updated = prev.map((p) => p.id === post.id ? { ...p, is_pinned: newPinned } : p);
      return sortPostsWithPinnedFirst(updated);
    });

    const { data, error } = await supabase
      .from('posts')
      .update({ is_pinned: newPinned })
      .eq('id', post.id)
      .select('id, is_pinned')
      .single();

    if (error || !data) {
      setPosts((prev) => sortPostsWithPinnedFirst(
        prev.map((p) => p.id === post.id ? { ...p, is_pinned: post.is_pinned } : p)
      ));
      showToast('PIN UPDATE FAILED');
      return;
    }

    setPosts((prev) => sortPostsWithPinnedFirst(
      prev.map((p) => p.id === post.id ? { ...p, is_pinned: (data as any).is_pinned } : p)
    ));
    showToast(newPinned ? 'POST PINNED' : 'POST UNPINNED');
  };

  const handleBookmark = async (post: Post) => {
    if (!currentUserId) return;
    const wasSaved = bookmarkedPostIds.has(post.id);
    // Optimistic update
    setBookmarkedPostIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(post.id) : next.add(post.id);
      return next;
    });
    if (wasSaved) {
      await supabase.from('bookmarks').delete().match({ post_id: post.id, user_id: currentUserId });
    } else {
      const { error } = await supabase.from('bookmarks').insert({ post_id: post.id, user_id: currentUserId });
      if (error) {
        // Revert optimistic update on failure
        setBookmarkedPostIds((prev) => {
          const next = new Set(prev);
          next.delete(post.id);
          return next;
        });
        showToast('RUN SQL MIGRATION TO ENABLE BOOKMARKS');
      }
    }
  };

  const handleFollow = async (post: Post) => {
    if (!currentUserId) return;
    const isFollowing = followingUserIds.has(post.user_id);
    setFollowingUserIds((prev) => {
      const next = new Set(prev);
      isFollowing ? next.delete(post.user_id) : next.add(post.user_id);
      return next;
    });
    if (isFollowing) {
      await supabase.from('follows').delete().match({ follower_id: currentUserId, following_id: post.user_id });
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: post.user_id });
    }
  };

  const handleBlock = async (post: Post) => {
    if (!currentUserId) return;
    await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: post.user_id });
    setBlockedUserIds((prev) => new Set([...prev, post.user_id]));
    setPosts((prev) => prev.filter((p) => p.user_id !== post.user_id));
    showToast('USER BLOCKED');
  };

  const handleDelete = async (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.from('posts').delete().eq('id', postId);
    showToast('POST DELETED');
  };

  // ── Empty states ─────────────────────────────────────────────────────────

  const renderEmpty = () => {
    if (activeTab === 'following') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>FOLLOW ARTISTS TO SEE THEIR POSTS HERE</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => navigation.navigate('Artists')}
            activeOpacity={0.7}
          >
            <Text style={styles.emptyBtnText}>BROWSE ARTISTS</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (activeTab === 'arttype') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>NO POSTS FROM FELLOW ARTISTS YET</Text>
        </View>
      );
    }
    if (activeTab === 'location') {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>NO POSTS FROM YOUR AREA YET</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>NO POSTS YET</Text>
      </View>
    );
  };

  const locationHeader = activeTab === 'location' && (userProfile.city || userProfile.country)
    ? `ARTISTS NEAR YOU — ${[userProfile.city, userProfile.country].filter(Boolean).join(', ').toUpperCase()}`
    : null;

  const artTypeHeader = activeTab === 'arttype' && userProfile.discipline
    ? `POSTS FROM FELLOW ${userProfile.discipline.toUpperCase()}S`
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <FeedHeader
        onAvatarPress={() => navigation.navigate('Profile')}
        onBellPress={() => navigation.navigate('Notifications')}
        onMessagePress={() => navigation.navigate('Inbox')}
        avatarUri={avatarUri}
      />
      <TabBar active={activeTab} onChange={handleTabChange} />

      <View style={styles.body}>
        {(locationHeader || artTypeHeader) ? (
          <Text style={styles.tabContextLabel}>{locationHeader ?? artTypeHeader}</Text>
        ) : null}

        {loading ? (
          <View>
            <SkeletonCard /><SkeletonCard /><SkeletonCard />
          </View>
        ) : tabLoading ? (
          <View style={styles.tabLoadingContainer}>
            <ActivityIndicator color={colors.white} size="small" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserId={currentUserId}
                isLiked={likedPostIds.has(item.id)}
                isBookmarked={bookmarkedPostIds.has(item.id)}
                isFollowing={followingUserIds.has(item.user_id)}
                isAdmin={isAdmin}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                onAvatarPress={() => navigation.navigate('ArtistProfile', { userId: item.user_id })}
                onLike={() => handleLike(item)}
                onBookmark={() => handleBookmark(item)}
                onFollow={() => handleFollow(item)}
                onBlock={() => handleBlock(item)}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => navigation.navigate('NewPost', { editPost: item })}
                onPin={() => handlePin(item)}
              />
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={async () => {
                  setRefreshing(true);
                  await loadPosts(activeTab);
                  setRefreshing(false);
                }}
                tintColor={colors.white}
              />
            }
            ListEmptyComponent={renderEmpty()}
          />
        )}

        {userRole === 'ARTIST' || userRole === 'COLLECTIVE' ? (
          <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('NewPost')} activeOpacity={0.8}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        ) : null}

        {toast ? (
          <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    backgroundColor: '#000000',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerLogo: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  headerDot: { color: colors.red, fontSize: 8, marginLeft: 3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Tab bar
  tabBar: {
    backgroundColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    flexGrow: 0,
  },
  tabBarContent: { paddingHorizontal: 8 },
  tabItem: {
    paddingHorizontal: 12, paddingVertical: 10,
    alignItems: 'center', position: 'relative',
  },
  tabLabel: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.14, textTransform: 'uppercase',
  },
  tabLabelActive: { color: colors.white },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 12, right: 12,
    height: 2, backgroundColor: GOLD,
  },

  // Context label
  tabContextLabel: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 8, letterSpacing: 0.12,
    paddingHorizontal: 14, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },

  body: { flex: 1 },

  tabLoadingContainer: { paddingTop: 60, alignItems: 'center' },

  skeletonCard: {
    backgroundColor: '#000000', borderBottomWidth: 1, borderColor: '#111111', padding: 14,
  },
  skeletonBarWide: { height: 8, backgroundColor: '#111111', borderRadius: 2, marginBottom: 6, width: '40%' },
  skeletonContent: { height: 120, backgroundColor: '#0a0a0a', marginVertical: 10 },
  skeletonBarNarrow: { height: 6, backgroundColor: '#111111', width: '30%' },

  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 12 },
  emptyText: { color: '#333333', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, textAlign: 'center' },
  emptyBtn: {
    borderWidth: 1, borderColor: GOLD, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4,
  },
  emptyBtnText: { color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18 },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: colors.white, fontSize: 22, fontFamily: MONO },

  toast: {
    position: 'absolute', bottom: 80, alignSelf: 'center',
    backgroundColor: colors.red, paddingHorizontal: 16, paddingVertical: 8,
  },
  toastText: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18 },
});
