import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import PostCard, { Post } from '../../components/PostCard';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null; profile_photo_url: string | null } | null;
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}S AGO`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}M AGO`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}H AGO`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}D AGO`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}W AGO`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}MO AGO`;
  const years = Math.floor(days / 365);
  return `${years}Y AGO`;
}

export default function PostDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { postId } = route.params;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [commentText, setCommentText] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState<boolean>(false);
  const [isBookmarked, setIsBookmarked] = useState<boolean>(false);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);

  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);
      currentUserIdRef.current = uid;

      if (uid) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_photo_url')
          .eq('id', uid)
          .single();
        if (profile) {
          setCurrentUserAvatar((profile as any).profile_photo_url ?? null);
        }
      }

      const { data: postData } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (postData) {
        const { data: postProfile } = await supabase
          .from('profiles')
          .select('username, profile_photo_url, art_type, full_name, role')
          .eq('id', postData.user_id)
          .single();
        setPost({
          ...postData,
          profiles: postProfile ?? null,
        } as Post);
      }

      const { data: commentsData } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (commentsData && commentsData.length > 0) {
        const commentUserIds = [...new Set(commentsData.map((c: any) => c.user_id as string))];
        const { data: commentProfiles } = await supabase
          .from('profiles')
          .select('id, username, profile_photo_url')
          .in('id', commentUserIds);
        const profileMap: Record<string, any> = {};
        if (commentProfiles) {
          for (const p of commentProfiles) profileMap[p.id] = p;
        }
        setComments(
          commentsData.map((c: any) => ({
            ...c,
            content: c.content ?? c.body ?? '',
            profiles: profileMap[c.user_id] ?? null,
          })) as Comment[]
        );
      }

      if (uid) {
        const { data: likeData } = await supabase
          .from('likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', uid)
          .maybeSingle();
        setIsLiked(!!likeData);

        const { data: bookmarkData } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', uid)
          .maybeSingle();
        setIsBookmarked(!!bookmarkData);
      }

      setLoading(false);
    };

    init();

    const channel = supabase
      .channel(`post-detail-comments-${postId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `post_id=eq.${postId}`,
        },
        async (payload) => {
          const newRow = payload.new as any;
          if (newRow.user_id === currentUserIdRef.current) return;
          const { data: commentRow } = await supabase
            .from('comments')
            .select('*')
            .eq('id', newRow.id)
            .single();
          if (commentRow) {
            const { data: p } = await supabase
              .from('profiles')
              .select('username, profile_photo_url')
              .eq('id', newRow.user_id)
              .single();
            setComments((prev) => [
              ...prev,
              { ...commentRow, content: (commentRow as any).content ?? (commentRow as any).body ?? '', profiles: p ?? null } as Comment,
            ]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postId]);

  const handleLike = async () => {
    if (!currentUserId || !post) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setPost((prev) =>
      prev ? { ...prev, like_count: prev.like_count + (wasLiked ? -1 : 1) } : prev
    );
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

  const handleBookmark = async () => {
    if (!currentUserId || !post) return;
    const wasBookmarked = isBookmarked;
    setIsBookmarked(!wasBookmarked);

    if (wasBookmarked) {
      await supabase.from('bookmarks').delete().match({ post_id: post.id, user_id: currentUserId });
      return;
    }

    const { error } = await supabase.from('bookmarks').insert({ post_id: post.id, user_id: currentUserId });
    if (error) {
      setIsBookmarked(false);
      Alert.alert('SAVE FAILED', 'PLEASE TRY AGAIN.');
    }
  };

  const handleDelete = async () => {
    if (!post || currentUserId !== post.user_id) return;
    await supabase.from('posts').delete().eq('id', post.id);
    navigation.goBack();
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !post) return;
    const { data: { user } } = await supabase.auth.getUser();
    const authorId = currentUserId ?? user?.id ?? null;
    if (!authorId) {
      setCommentError('FAILED TO POST COMMENT — NOT LOGGED IN');
      return;
    }
    const content = commentText.trim();
    if (containsBannedWords(content)) {
      setCommentError(getBannedWordError());
      return;
    }
    setSubmitting(true);
    setCommentError(null);
    setCommentText('');

    const { data: insertedRow, error: insertError } = await supabase
      .from('comments')
      .insert({ post_id: post.id, user_id: authorId, content })
      .select('id, post_id, user_id, content, created_at')
      .single();

    if (!insertedRow) {
      setCommentText(content);
      setCommentError(`FAILED TO POST COMMENT${insertError?.message ? ` — ${String(insertError.message).toUpperCase()}` : ''}`);
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username, profile_photo_url')
      .eq('id', authorId)
      .single();

    setComments((prev) => [
      ...prev,
      {
        ...(insertedRow as any),
        content: (insertedRow as any).content ?? content,
        profiles: profile ?? null,
      } as Comment,
    ]);
    setPost((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
    try {
      await supabase.rpc('increment_comment_count', { post_id: post.id });
    } catch {
      // Keep the new comment visible even if the aggregate counter RPC fails.
    }
    if (authorId !== post.user_id) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        type: 'post_comment',
        actor_id: authorId,
        reference_id: post.id,
        reference_type: 'post',
        preview_text: content.slice(0, 40),
        is_read: false,
      });
    }
    setSubmitting(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {'@' + (post?.profiles?.username ?? '...')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.scrollView}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : post ? (
            <PostCard
              post={post}
              currentUserId={currentUserId}
              isLiked={isLiked}
              onPress={() => {}}
              onAvatarPress={() => navigation.navigate('ArtistProfile', { userId: post.user_id })}
              onLike={handleLike}
              isBookmarked={isBookmarked}
              onBookmark={handleBookmark}
              onDelete={handleDelete}
              onEdit={() => navigation.navigate('NewPost', { editPost: post })}
            />
          ) : null}

          <View style={styles.divider} />
          <Text style={styles.commentsLabel}>COMMENTS</Text>

          {comments.map((comment) => (
            <View key={comment.id} style={styles.commentRow}>
              <View style={styles.commentTopRow}>
                <OctagonalImage size={32} imageUri={comment.profiles?.profile_photo_url ?? null} />
                <View style={styles.commentMeta}>
                  <Text style={styles.commentUsername}>
                    {'@' + (comment.profiles?.username ?? '...')}
                  </Text>
              <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
                </View>
              </View>
              <Text style={styles.commentText}>{comment.content}</Text>
            </View>
          ))}
        </ScrollView>

        {commentError ? (
          <View style={styles.commentErrorRow}>
            <Text style={styles.commentErrorText}>{commentError}</Text>
          </View>
        ) : null}

        <View style={styles.inputRow}>
          <OctagonalImage size={32} imageUri={currentUserAvatar} />
          <TextInput
            style={styles.commentInput}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="ADD A COMMENT..."
            placeholderTextColor="#333333"
            returnKeyType="send"
            onSubmitEditing={handleSubmitComment}
          />
          <TouchableOpacity onPress={handleSubmitComment} disabled={submitting} activeOpacity={0.7}>
            <Text style={styles.postButton}>POST</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  keyboardAvoid: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  headerTitle: {
    flex: 1, textAlign: 'center',
    color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.15,
  },
  headerSpacer: { width: 32 },

  scrollView: { flex: 1 },
  loadingContainer: { paddingTop: 60, alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#111111' },

  commentsLabel: {
    color: '#f6c55a',
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  commentRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  commentTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  commentMeta: { marginLeft: 10, flexDirection: 'column' },
  commentUsername: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.12,
  },
  commentTime: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 10,
    marginTop: 3,
  },
  commentText: {
    color: '#aaaaaa',
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 0.08,
    lineHeight: 22,
    paddingLeft: 42,
  },

  inputRow: {
    borderTopWidth: 1,
    borderTopColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black,
  },
  commentInput: {
    flex: 1,
    marginHorizontal: 12,
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
    paddingVertical: 6,
  },
  postButton: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.18,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  commentErrorRow: {
    borderTopWidth: 1,
    borderTopColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.black,
  },
  commentErrorText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.15,
  },
});
