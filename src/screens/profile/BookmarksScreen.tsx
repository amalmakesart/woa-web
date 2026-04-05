import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Platform, SafeAreaView, ActivityIndicator,
  Alert, RefreshControl, Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { Post } from '../../components/PostCard';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_WIDTH - 2) / 3;

function PostThumb({ post, onPress, onLongPress }: {
  post: Post; onPress: () => void; onLongPress: () => void;
}) {
  return (
    <TouchableOpacity style={th.wrap} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}>
      {post.type === 'image' && (
        post.media_url
          ? <Image source={{ uri: post.media_url }} style={th.img} resizeMode="cover" />
          : <View style={[th.img, th.placeholder]} />
      )}
      {post.type === 'text' && (
        <View style={th.textBg}>
          <Text style={th.textContent} numberOfLines={3}>{(post.content ?? '').slice(0, 40).toUpperCase()}</Text>
          <Text style={th.tag}>T</Text>
        </View>
      )}
      {post.type === 'audio' && (
        <View style={th.audioBg}>
          <Text style={th.triangle}>▶</Text>
          <View style={th.waveRow}>
            {[6, 10, 8, 12, 7].map((h, i) => <View key={i} style={[th.wave, { height: h }]} />)}
          </View>
          <Text style={th.tag}>♪</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const th = StyleSheet.create({
  wrap: { width: THUMB_SIZE, height: THUMB_SIZE },
  img: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: colors.gray2 },
  textBg: { width: '100%', height: '100%', backgroundColor: '#111111', alignItems: 'center', justifyContent: 'center', padding: 6 },
  textContent: { color: colors.white, fontFamily: MONO, fontSize: 8, textAlign: 'center', letterSpacing: 0.05, lineHeight: 12 },
  audioBg: { width: '100%', height: '100%', backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', gap: 8 },
  triangle: { color: colors.red, fontSize: 18 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wave: { width: 3, backgroundColor: colors.red, borderRadius: 1, opacity: 0.6 },
  tag: { position: 'absolute', top: 5, right: 6, color: colors.red, fontFamily: MONO, fontSize: 7 },
});

export default function BookmarksScreen() {
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadBookmarks = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select('post_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!bookmarks || bookmarks.length === 0) { setPosts([]); setLoading(false); return; }

    const postIds = bookmarks.map((b: any) => b.post_id as string);
    const { data: postsData } = await supabase.from('posts').select('*').in('id', postIds);

    if (postsData) {
      // Sort in same order as bookmarks
      const sorted = postIds
        .map((id) => postsData.find((p: any) => p.id === id))
        .filter(Boolean) as Post[];
      setPosts(sorted);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadBookmarks(); }, [loadBookmarks]));

  const handleRemoveBookmark = async (postId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    await supabase.from('bookmarks').delete().match({ user_id: user.id, post_id: postId });
  };

  const handleLongPress = (post: Post) => {
    Alert.alert('SAVED POST', undefined, [
      { text: 'REMOVE FROM SAVED', style: 'destructive', onPress: () => handleRemoveBookmark(post.id) },
      { text: 'CANCEL', style: 'cancel' },
    ]);
  };

  const paddedPosts = posts.length % 3 === 0 ? posts : [...posts, ...Array<null>(3 - (posts.length % 3)).fill(null)];

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle}>SAVED POSTS</Text>
        </View>
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>SAVED POSTS</Text>
        <View style={{ width: 32 }} />
      </View>

      {posts.length === 0 ? (
        <View style={s.emptyContainer}>
          <Ionicons name="bookmark-outline" size={32} color="#222222" />
          <Text style={s.emptyTitle}>NO SAVED POSTS YET</Text>
          <Text style={s.emptySub}>TAP THE BOOKMARK ICON ON ANY POST TO SAVE IT</Text>
        </View>
      ) : (
        <FlatList
          data={paddedPosts}
          numColumns={3}
          keyExtractor={(item, i) => item?.id ?? `pad-${i}`}
          columnWrapperStyle={s.columnWrapper}
          ItemSeparatorComponent={() => <View style={s.rowSeparator} />}
          style={s.grid}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => { setRefreshing(true); await loadBookmarks(); setRefreshing(false); }}
              tintColor={colors.white}
            />
          }
          renderItem={({ item }) =>
            item ? (
              <PostThumb
                post={item}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
                onLongPress={() => handleLongPress(item)}
              />
            ) : (
              <View style={s.gridPad} />
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: { flex: 1, textAlign: 'center', color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  emptySub: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.12, textAlign: 'center', lineHeight: 14 },
  grid: { flex: 1, backgroundColor: '#111111' },
  columnWrapper: { gap: 1, backgroundColor: '#111111' },
  rowSeparator: { height: 1, backgroundColor: '#111111' },
  gridPad: { flex: 1, backgroundColor: colors.black, aspectRatio: 1 },
});
