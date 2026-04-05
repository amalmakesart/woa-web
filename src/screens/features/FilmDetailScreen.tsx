import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, SafeAreaView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Image, Linking,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import { Feature } from './FeaturesScreen';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const ADMIN_EMAIL = 'amalmakesart@gmail.com';

interface VideoComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string | null;
  profile_photo_url: string | null;
}

export default function FilmDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { feature } = route.params as { feature: Feature };

  const [artist, setArtist] = useState<any>(null);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const featureId = feature.id;

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setCurrentUserId(uid);
    setIsAdmin(user?.email === ADMIN_EMAIL);

    if (uid) {
      const { data: me } = await supabase
        .from('profiles').select('profile_photo_url').eq('id', uid).single();
      if (me) setCurrentUserAvatar((me as any).profile_photo_url ?? null);
    }

    // Load linked artist profile if any
    if (feature.artist_id) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, full_name, username, profile_photo_url, art_type, city')
        .eq('id', feature.artist_id)
        .single();
      if (prof) setArtist(prof);
    }

    // Likes
    const { count: lc } = await supabase
      .from('video_likes')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', featureId);
    setLikeCount(lc ?? 0);

    if (uid) {
      const { data: myLike } = await supabase
        .from('video_likes')
        .select('id')
        .eq('video_id', featureId)
        .eq('user_id', uid)
        .maybeSingle();
      setLiked(!!myLike);

      if (feature.artist_id) {
        const { data: follow } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', uid)
          .eq('following_id', feature.artist_id)
          .maybeSingle();
        setFollowing(!!follow);
      }
    }

    // Comments
    const { data: commData } = await supabase
      .from('video_comments')
      .select('id, user_id, content, created_at')
      .eq('video_id', featureId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (commData && commData.length > 0) {
      const userIds = [...new Set(commData.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, username, profile_photo_url').in('id', userIds);
      const pm: Record<string, any> = {};
      (profiles ?? []).forEach((p: any) => { pm[p.id] = p; });
      setComments(commData.map((c: any) => ({
        ...c,
        username: pm[c.user_id]?.username ?? null,
        profile_photo_url: pm[c.user_id]?.profile_photo_url ?? null,
      })));
    } else {
      setComments([]);
    }

    setLoading(false);
  }, [featureId, feature.artist_id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleLike = async () => {
    if (!currentUserId) return;
    if (liked) {
      setLiked(false); setLikeCount(c => Math.max(0, c - 1));
      await supabase.from('video_likes').delete()
        .eq('video_id', featureId).eq('user_id', currentUserId);
    } else {
      setLiked(true); setLikeCount(c => c + 1);
      await supabase.from('video_likes').insert({ video_id: featureId, user_id: currentUserId });
    }
  };

  const handleFollow = async () => {
    if (!currentUserId || !artist) return;
    if (following) {
      setFollowing(false);
      await supabase.from('follows').delete()
        .eq('follower_id', currentUserId).eq('following_id', artist.id);
    } else {
      setFollowing(true);
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: artist.id });
    }
  };

  const handleWatch = () => {
    if (!feature.video_url) return;
    Linking.openURL(feature.video_url);
  };

  const handleDelete = async () => {
    Alert.alert('DELETE FEATURE', 'Are you sure you want to delete this feature?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'DELETE', style: 'destructive', onPress: async () => {
          await supabase.from('features').delete().eq('id', featureId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text || !currentUserId) return;
    if (containsBannedWords(text)) {
      setCommentError(getBannedWordError());
      return;
    }
    setPosting(true);
    setCommentError(null);
    const { data: inserted } = await supabase
      .from('video_comments')
      .insert({ video_id: featureId, user_id: currentUserId, content: text })
      .select('id, user_id, content, created_at').single();
    if (inserted) {
      const { data: prof } = await supabase
        .from('profiles').select('username, profile_photo_url').eq('id', currentUserId).single();
      setComments(prev => [...prev, {
        ...(inserted as any),
        username: (prof as any)?.username ?? null,
        profile_photo_url: (prof as any)?.profile_photo_url ?? null,
      }]);
      setCommentText('');
    }
    setPosting(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>FEATURES</Text>
          </TouchableOpacity>
        </View>
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>FEATURES</Text>
        </TouchableOpacity>
        <View style={s.topBarRight}>
          {isAdmin && (
            <TouchableOpacity onPress={handleDelete} activeOpacity={0.7}>
              <Text style={s.deleteBtn}>DELETE</Text>
            </TouchableOpacity>
          )}
          <View style={s.notifDot} />
          <OctagonalImage size={24} imageUri={currentUserAvatar} onPress={() => navigation.navigate('Profile')} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Thumbnail */}
          {feature.thumbnail_url ? (
            <Image source={{ uri: feature.thumbnail_url }} style={s.thumbnail} resizeMode="cover" />
          ) : (
            <View style={s.thumbnailPlaceholder}>
              <Text style={s.thumbPlaceholderText}>▷</Text>
            </View>
          )}

          {/* Info */}
          <View style={s.infoSection}>
            <Text style={s.filmTitle}>{feature.title.toUpperCase()}</Text>
            {feature.duration ? <Text style={s.durationText}>{feature.duration.toUpperCase()}</Text> : null}

            {/* Watch button */}
            {feature.video_url ? (
              <TouchableOpacity style={s.watchBtn} onPress={handleWatch} activeOpacity={0.8}>
                <Text style={s.watchBtnText}>▷  WATCH NOW</Text>
              </TouchableOpacity>
            ) : null}

            {/* Artist row */}
            {artist ? (
              <View style={s.artistRow}>
                <TouchableOpacity
                  style={s.artistLeft}
                  onPress={() => navigation.navigate('ArtistProfile', { userId: artist.id })}
                  activeOpacity={0.8}
                >
                  <OctagonalImage size={22} imageUri={artist.profile_photo_url} />
                  <View style={{ flex: 1 }}>
                    {artist.username ? (
                      <Text style={s.artistHandle}>@{artist.username.toUpperCase()}</Text>
                    ) : null}
                    {artist.art_type ? (
                      <Text style={s.artistType}>{artist.art_type.toUpperCase()}</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.followBtn, following && s.followBtnDone]}
                  onPress={handleFollow}
                  activeOpacity={0.7}
                >
                  <Text style={[s.followBtnText, following && s.followBtnTextDone]}>
                    {following ? 'FOLLOWING ✓' : 'FOLLOW +'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Description */}
            {feature.description ? (
              <Text style={s.description}>{feature.description}</Text>
            ) : null}

            {/* Actions */}
            <View style={s.actionsRow}>
              <TouchableOpacity style={s.actionBtn} onPress={handleLike} activeOpacity={0.7}>
                <Text style={[s.actionText, liked && s.actionTextLiked]}>
                  {liked ? '♥' : '♡'} {likeCount}
                </Text>
              </TouchableOpacity>
              <View style={s.actionBtn}>
                <Text style={s.actionText}>○ {comments.length}</Text>
              </View>
              <TouchableOpacity
                style={s.reportBtn}
                onPress={() => Alert.alert('REPORT', 'Thank you. Our team will review this episode.')}
                activeOpacity={0.7}
              >
                <Text style={s.reportText}>REPORT</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Comments */}
          <View style={s.commentsSection}>
            <Text style={s.commentsLabel}>COMMENTS</Text>
            {comments.map(c => (
              <View key={c.id} style={s.commentRow}>
                <OctagonalImage size={18} imageUri={c.profile_photo_url} />
                <View style={{ flex: 1 }}>
                  {c.username ? (
                    <Text style={s.commentUser}>@{c.username.toUpperCase()}</Text>
                  ) : null}
                  <Text style={s.commentContent}>{c.content}</Text>
                </View>
              </View>
            ))}
            {comments.length === 0 && (
              <Text style={s.noComments}>NO COMMENTS YET</Text>
            )}
          </View>

          <View style={{ height: 80 }} />
        </ScrollView>

        {/* Comment input */}
        <View style={s.inputArea}>
          {commentError ? <Text style={s.commentErr}>{commentError}</Text> : null}
          <View style={s.inputRow}>
            <OctagonalImage size={22} imageUri={currentUserAvatar} />
            <TextInput
              style={s.commentInput}
              placeholder="ADD A COMMENT..."
              placeholderTextColor="#333333"
              value={commentText}
              onChangeText={t => { setCommentText(t); if (commentError) setCommentError(null); }}
              maxLength={300}
            />
            <TouchableOpacity
              style={[s.postBtn, (!commentText.trim() || posting) && s.postBtnDisabled]}
              onPress={handlePostComment}
              disabled={!commentText.trim() || posting}
              activeOpacity={0.7}
            >
              <Text style={s.postBtnText}>POST</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#666666', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },
  deleteBtn: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },

  thumbnail: { width: '100%', height: 220, backgroundColor: '#060606' },
  thumbnailPlaceholder: {
    width: '100%', height: 220, backgroundColor: '#060606',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbPlaceholderText: { color: '#222222', fontSize: 40 },

  infoSection: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  filmTitle: {
    color: colors.white, fontFamily: MONO,
    fontSize: 14, letterSpacing: 0.14, lineHeight: 20, marginBottom: 4,
  },
  durationText: { color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, marginBottom: 12 },

  watchBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingVertical: 12, alignItems: 'center', marginBottom: 14,
  },
  watchBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },

  artistRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  artistLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  artistHandle: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.12 },
  artistType: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1 },
  followBtn: { borderWidth: 1, borderColor: colors.white, paddingHorizontal: 10, paddingVertical: 4 },
  followBtnDone: { borderColor: '#333333' },
  followBtnText: { color: colors.white, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },
  followBtnTextDone: { color: '#333333' },

  description: {
    color: '#666666', fontFamily: MONO,
    fontSize: 10, letterSpacing: 0.06, lineHeight: 16, marginBottom: 12,
  },

  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { marginRight: 16 },
  actionText: { color: '#444444', fontFamily: MONO, fontSize: 11 },
  actionTextLiked: { color: colors.red },
  reportBtn: { marginLeft: 'auto' as any },
  reportText: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.18 },

  commentsSection: { paddingHorizontal: 16, paddingTop: 14 },
  commentsLabel: { color: '#333333', fontFamily: MONO, fontSize: 8, letterSpacing: 0.15, marginBottom: 10 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentUser: { color: '#555555', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, marginBottom: 2 },
  commentContent: { color: '#888888', fontFamily: MONO, fontSize: 10, letterSpacing: 0.06, lineHeight: 15 },
  noComments: { color: '#2a2a2a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.12, marginBottom: 10 },

  inputArea: { borderTopWidth: 1, borderTopColor: '#111111', backgroundColor: colors.black },
  commentErr: {
    color: '#c0392b', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1,
    paddingHorizontal: 16, paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  commentInput: {
    flex: 1, color: colors.white, fontFamily: MONO,
    fontSize: 11, letterSpacing: 0.06, paddingVertical: 8,
  },
  postBtn: { borderWidth: 1, borderColor: colors.red, paddingHorizontal: 12, paddingVertical: 8 },
  postBtnDisabled: { borderColor: '#333333' },
  postBtnText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },
});
