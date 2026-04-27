import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, Platform, SafeAreaView, ActivityIndicator,
  Alert, RefreshControl, Dimensions, ActionSheetIOS,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { Post } from '../../components/PostCard';
import VideoThumbnail from '../../components/VideoThumbnail';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const THUMB_SIZE = (SCREEN_WIDTH - 2) / 3;

function PostThumb({ post, onPress, onLongPress }: {
  post: Post; onPress: () => void; onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={th.wrap} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.85}
    >
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
      {post.type === 'video' && (
        <VideoThumbnail
          uri={post.media_url}
          label="VIDEO"
          cornerTag="▶"
          containerStyle={th.videoBg}
          centerPlayStyle={th.videoPlay}
          labelStyle={th.videoLabel}
          cornerTagStyle={th.tag}
        />
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
  videoBg: { width: '100%', height: '100%' },
  videoPlay: { color: colors.white, fontSize: 18 },
  waveRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  wave: { width: 3, backgroundColor: colors.red, borderRadius: 1, opacity: 0.6 },
  videoLabel: { color: '#ffffff', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  tag: { position: 'absolute', top: 5, right: 6, color: colors.red, fontFamily: MONO, fontSize: 7 },
});

export default function MyPostsScreen() {
  const navigation = useNavigation<any>();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const loadPosts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setCurrentUserId(user.id);

    const { data: me } = await supabase.from('profiles').select('profile_photo_url').eq('id', user.id).single();
    if (me) setCurrentUserAvatar((me as any).profile_photo_url ?? null);

    const { data: ownedPosts } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const { data: collaboratorRows } = await supabase
      .from('post_collaborators')
      .select('post_id')
      .eq('collaborator_id', user.id)
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

    const allPosts = [...(ownedPosts ?? []), ...collaboratorPosts]
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setPosts(allPosts as Post[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadPosts(); }, [loadPosts]));

  const handleDelete = async (post: Post) => {
    Alert.alert('DELETE POST', 'This cannot be undone.', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE', style: 'destructive',
        onPress: async () => {
          setPosts(prev => prev.filter(p => p.id !== post.id));
          await supabase.from('posts').delete().eq('id', post.id);
        },
      },
    ]);
  };

  const handleLongPress = (post: Post) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['CANCEL', 'EDIT', 'DELETE'], cancelButtonIndex: 0, destructiveButtonIndex: 2 },
        idx => {
          if (idx === 1) navigation.navigate('NewPost', { editPost: post });
          if (idx === 2) handleDelete(post);
        }
      );
    } else {
      Alert.alert('POST OPTIONS', '', [
        { text: 'EDIT', onPress: () => navigation.navigate('NewPost', { editPost: post }) },
        { text: 'DELETE', style: 'destructive', onPress: () => handleDelete(post) },
        { text: 'CANCEL', style: 'cancel' },
      ]);
    }
  };

  // Pad to multiple of 3
  const padded = [...posts];
  const rem = padded.length % 3;
  if (rem !== 0) for (let i = 0; i < 3 - rem; i++) padded.push(null as any);

  const renderItem = ({ item }: { item: Post | null }) => {
    if (!item) return <View style={{ width: THUMB_SIZE, height: THUMB_SIZE }} />;
    return (
      <PostThumb
        post={item}
        onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
        onLongPress={() => handleLongPress(item)}
      />
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>MY PROFILE</Text>
        </TouchableOpacity>
        <Text style={s.postCount}>{posts.length} POSTS</Text>
        <OctagonalImage size={24} imageUri={currentUserAvatar} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      ) : posts.length === 0 ? (
        <View style={s.center}>
          <Text style={s.emptyText}>NO POSTS YET</Text>
          <TouchableOpacity
            style={s.newPostBtn}
            onPress={() => navigation.navigate('NewPost')}
            activeOpacity={0.7}
          >
            <Text style={s.newPostBtnText}>CREATE YOUR FIRST POST</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={padded}
          keyExtractor={(item, idx) => item?.id ?? `pad-${idx}`}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={s.columnWrapper}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.white}
              onRefresh={async () => { setRefreshing(true); await loadPosts(); setRefreshing(false); }}
            />
          }
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  postCount: { color: '#8f8f8f', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15 },
  columnWrapper: { gap: 1 },
  emptyText: { color: '#8f8f8f', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },
  newPostBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  newPostBtnText: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.2 },
});
