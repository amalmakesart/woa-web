import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import OctagonalImage from '../../components/OctagonalImage';
import { Project } from './ProjectsScreen';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';

interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: { username: string | null; profile_photo_url: string | null } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'NOW';
  if (m < 60) return `${m}M AGO`;
  if (h < 24) return `${h}H AGO`;
  return `${d}D AGO`;
}

export default function ProjectDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { projectId } = route.params;

  const [project, setProject] = useState<Project | null>(null);
  const [comments, setComments] = useState<ProjectComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const uid = user?.id ?? null;
      setCurrentUserId(uid);
      currentUserIdRef.current = uid;

      if (uid) {
        const { data: prof } = await supabase
          .from('profiles').select('profile_photo_url, role').eq('id', uid).single();
        if (prof) {
          setCurrentUserAvatar((prof as any).profile_photo_url ?? null);
          setCurrentUserRole((prof as any).role ?? null);
        }
      }

      const { data: proj } = await supabase
        .from('projects')
        .select('*, profiles(username, profile_photo_url, full_name)')
        .eq('id', projectId)
        .single();
      if (proj) setProject(proj as unknown as Project);

      const { data: rawComments } = await supabase
        .from('project_comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (rawComments && rawComments.length > 0) {
        const uids = [...new Set((rawComments as any[]).map((c: any) => c.user_id as string))];
        const { data: profiles } = await supabase
          .from('profiles').select('id, username, profile_photo_url').in('id', uids);
        const pMap: Record<string, any> = {};
        (profiles ?? []).forEach((p: any) => { pMap[p.id] = p; });
        setComments(
          (rawComments as any[]).map((c: any) => ({ ...c, profiles: pMap[c.user_id] ?? null }))
        );
      }

      setLoading(false);
    };

    init();

    const channel = supabase
      .channel(`project-comments-${projectId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'project_comments',
        filter: `project_id=eq.${projectId}`,
      }, async (payload) => {
        const newRow = payload.new as any;
        if (newRow.user_id === currentUserIdRef.current) return;
        const { data: p } = await supabase
          .from('profiles').select('username, profile_photo_url')
          .eq('id', newRow.user_id).single();
        setComments((prev) => [...prev, { ...newRow, profiles: p ?? null }]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !project) return;
    if (project.is_closed) {
      setCommentError('THIS COLLAB IS CLOSED — COMMENTS ARE DISABLED');
      return;
    }
    if (currentUserRole !== 'ARTIST' && currentUserRole !== 'COLLECTIVE') {
      setCommentError('ONLY ARTISTS AND COLLECTIVES CAN COMMENT ON COLLABS');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    const authorId = currentUserId ?? user?.id ?? null;
    if (!authorId) return;
    const content = commentText.trim();
    if (containsBannedWords(content)) {
      setCommentError(getBannedWordError());
      return;
    }
    setSubmitting(true);
    setCommentError(null);
    setCommentText('');

    const { data: inserted, error } = await supabase
      .from('project_comments')
      .insert({ project_id: project.id, user_id: authorId, content })
      .select('id, project_id, user_id, content, created_at')
      .single();

    if (!inserted) {
      setCommentText(content);
      setCommentError(
        `FAILED TO POST COMMENT${error?.message ? ` — ${String(error.message).toUpperCase()}` : ''}`
      );
      setSubmitting(false);
      return;
    }

    const { data: prof } = await supabase
      .from('profiles').select('username, profile_photo_url').eq('id', authorId).single();

    setComments((prev) => [...prev, { ...(inserted as any), profiles: prof ?? null }]);
    setProject((prev) => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);

    // Notify project owner
    if (authorId !== project.user_id) {
      await supabase.from('notifications').insert({
        user_id: project.user_id,
        type: 'project_comment',
        actor_id: authorId,
        reference_id: project.id,
        reference_type: 'project',
        preview_text: content.slice(0, 40),
        is_read: false,
      });
    }

    setSubmitting(false);
  };

  const handleCloseProject = () => {
    if (!project || project.is_closed || closing) return;

    Alert.alert(
      'CLOSE COLLAB',
      'This will keep the collab visible, but artists will no longer be able to comment. This cannot be undone.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'CLOSE',
          style: 'destructive',
          onPress: async () => {
            setClosing(true);
            const { error } = await supabase
              .from('projects')
              .update({ is_closed: true })
              .eq('id', project.id);

            if (error) {
              setCommentError('FAILED TO CLOSE COLLAB');
              setClosing(false);
              return;
            }

            setProject((prev) => prev ? { ...prev, is_closed: true } : prev);
            setClosing(false);
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.center}>
          <Text style={s.notFound}>PROJECT NOT FOUND</Text>
        </View>
      </SafeAreaView>
    );
  }

  const username = project.profiles?.username
    ? `@${project.profiles.username.toUpperCase()}`
    : '@UNKNOWN';
  const isOwner = currentUserId === project.user_id;
  const canComment = currentUserRole === 'ARTIST' || currentUserRole === 'COLLECTIVE';

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle} numberOfLines={1}>PROJECT</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Project Details */}
          <View style={s.projectHeader}>
            <View style={s.authorRow}>
              <OctagonalImage
                size={36}
                imageUri={project.profiles?.profile_photo_url ?? null}
                onPress={() => navigation.navigate('ArtistProfile', { userId: project.user_id })}
              />
              <View style={s.authorInfo}>
                <Text style={s.authorName}>{username}</Text>
                <Text style={s.authorTime}>{timeAgo(project.created_at)}</Text>
              </View>
            </View>

            <Text style={s.projectTitle}>{project.title.toUpperCase()}</Text>
            {project.is_closed ? (
              <View style={s.closedBadge}>
                <Text style={s.closedBadgeText}>COLLAB CLOSED</Text>
              </View>
            ) : null}
            {isOwner && !project.is_closed ? (
              <TouchableOpacity
                style={[s.closeBtn, closing && s.closeBtnDisabled]}
                onPress={handleCloseProject}
                disabled={closing}
                activeOpacity={0.7}
              >
                <Text style={s.closeBtnText}>{closing ? 'CLOSING...' : 'CLOSE COLLAB'}</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={s.projectDesc}>{project.description}</Text>

            {(project.discipline || project.location) ? (
              <View style={s.metaRow}>
                {project.discipline ? <Text style={s.metaText}>{project.discipline.toUpperCase()}</Text> : null}
                {project.discipline && project.location ? <Text style={s.metaDivider}>•</Text> : null}
                {project.location ? <Text style={s.metaText}>{project.location.toUpperCase()}</Text> : null}
              </View>
            ) : null}
            {project.budget ? <Text style={s.budgetText}>BUDGET: {project.budget.toUpperCase()}</Text> : null}
          </View>

          <View style={s.divider} />
          <Text style={s.commentsLabel}>
            {project.is_closed
              ? 'COMMENTS DISABLED — THIS COLLAB IS CLOSED'
              : 'COMMENTS — EXPRESS INTEREST OR ASK QUESTIONS'}
          </Text>

          {!project.is_closed && comments.length === 0 ? (
            <Text style={s.noComments}>BE THE FIRST TO COMMENT</Text>
          ) : null}

          {comments.map((c) => (
            <View key={c.id} style={s.commentRow}>
              <OctagonalImage
                size={28}
                imageUri={c.profiles?.profile_photo_url ?? null}
                onPress={() => navigation.navigate('ArtistProfile', { userId: c.user_id })}
              />
              <View style={s.commentBody}>
                <View style={s.commentMeta}>
                  <Text style={s.commentUsername}>
                    @{(c.profiles?.username ?? 'UNKNOWN').toUpperCase()}
                  </Text>
                  <Text style={s.commentTime}>{timeAgo(c.created_at)}</Text>
                </View>
                <Text style={s.commentText}>{c.content}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 20 }} />
        </ScrollView>

        {commentError ? (
          <View style={s.errorRow}>
            <Text style={s.errorText}>{commentError}</Text>
          </View>
        ) : null}

        {project.is_closed ? (
          <View style={s.closedNoticeRow}>
            <Text style={s.closedNoticeText}>THIS COLLAB IS CLOSED. COMMENTING HAS BEEN DISABLED.</Text>
          </View>
        ) : !canComment ? (
          <View style={s.closedNoticeRow}>
            <Text style={s.closedNoticeText}>ONLY ARTISTS AND COLLECTIVES CAN COMMENT ON COLLABS.</Text>
          </View>
        ) : (
          <View style={s.inputRow}>
            <OctagonalImage
              size={28}
              imageUri={currentUserAvatar}
              onPress={() => navigation.navigate('Profile')}
            />
            <TextInput
              style={s.commentInput}
              value={commentText}
              onChangeText={setCommentText}
              placeholder="COMMENT OR EXPRESS INTEREST..."
              placeholderTextColor="#333333"
              returnKeyType="send"
              onSubmitEditing={handleSubmitComment}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={submitting}
              activeOpacity={0.7}
            >
              <Text style={s.postBtn}>POST</Text>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#9a9a9a', fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { marginRight: 10, padding: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: {
    flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18,
  },

  projectHeader: { padding: 16 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  authorInfo: { flex: 1 },
  authorName: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12 },
  authorTime: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, marginTop: 2,
  },
  projectTitle: {
    color: colors.white, fontFamily: MONO, fontSize: 16,
    fontWeight: '700', letterSpacing: 0.15, marginBottom: 10,
  },
  closedBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#555555',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 10,
  },
  closedBadgeText: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.14,
  },
  closeBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  closeBtnDisabled: {
    opacity: 0.5,
  },
  closeBtnText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.14,
  },
  projectDesc: {
    color: '#cccccc', fontFamily: MONO, fontSize: 12,
    letterSpacing: 0.1, lineHeight: 20, marginBottom: 14,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 14 },
  metaText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12 },
  metaDivider: { color: '#555555', fontFamily: MONO, fontSize: 10 },
  budgetText: { color: GOLD, fontFamily: MONO, fontSize: 10, letterSpacing: 0.12, marginBottom: 14 },
  lookingForLabel: {
    color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, marginBottom: 8,
  },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { borderWidth: 1, borderColor: GOLD, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.12 },

  divider: {
    height: 1, backgroundColor: '#111111', marginHorizontal: 16, marginBottom: 4,
  },
  commentsLabel: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  noComments: {
    color: '#333333', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2,
    paddingHorizontal: 16, paddingVertical: 14,
  },

  commentRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
    gap: 10,
  },
  commentBody: { flex: 1 },
  commentMeta: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  commentUsername: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  commentTime: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  commentText: {
    color: '#cccccc', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 17,
  },

  errorRow: {
    backgroundColor: colors.red, paddingHorizontal: 16, paddingVertical: 8,
  },
  errorText: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  closedNoticeRow: {
    borderTopWidth: 1, borderTopColor: '#111111',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  closedNoticeText: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10,
    letterSpacing: 0.12, lineHeight: 16, textAlign: 'center',
  },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#111111',
  },
  commentInput: {
    flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#222222',
    color: colors.white, fontFamily: MONO, fontSize: 11,
    paddingHorizontal: 10, paddingVertical: 8, letterSpacing: 0.1,
  },
  postBtn: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
});
