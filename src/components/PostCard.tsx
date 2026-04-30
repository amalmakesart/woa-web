import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  Alert,
  Share,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import OctagonalImage from './OctagonalImage';
import VideoThumbnail from './VideoThumbnail';
import { colors } from '../constants/colors';
import { supabase } from '../lib/supabase';
import { reportContent } from '../lib/moderation';
import { buildPostShareUrl } from '../lib/shareLinks';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });
const GOLD = '#f6c55a';
const RED = '#c0392b';

const AVATAR_SIZE = 36;
const INDENT = AVATAR_SIZE + 8 + 14;
const CARD_MEDIA_WIDTH = Dimensions.get('window').width - INDENT - 14;

export interface PostProfile {
  username: string;
  profile_photo_url: string | null;
  art_type: string | null;
  discipline: string | null;
  full_name: string | null;
  role?: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  type: 'image' | 'text' | 'audio' | 'video';
  content: string | null;
  title: string | null;
  media_url: string | null;
  media_urls?: string[] | null;
  tags: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  is_pinned?: boolean;
  profiles?: PostProfile | null;
  collaborators?: (PostProfile & { id: string; accepted?: boolean })[];
}

export function getPostImageUris(post: Pick<Post, 'type' | 'media_url' | 'media_urls'>): string[] {
  if (post.type !== 'image') return [];
  const urls = Array.isArray(post.media_urls)
    ? post.media_urls.filter((uri): uri is string => typeof uri === 'string' && uri.trim().length > 0)
    : [];
  if (urls.length > 0) return urls;
  return post.media_url ? [post.media_url] : [];
}

function ImageCarousel({ uris, onPress }: { uris: string[]; onPress: () => void }) {
  const [page, setPage] = useState(0);

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const nextPage = Math.round(event.nativeEvent.contentOffset.x / CARD_MEDIA_WIDTH);
          setPage(nextPage);
        }}
      >
        {uris.map((uri, index) => (
          <TouchableOpacity key={`${uri}-${index}`} activeOpacity={0.9} onPress={onPress}>
            <Image source={{ uri }} style={styles.imageContent} resizeMode="cover" />
          </TouchableOpacity>
        ))}
      </ScrollView>
      {uris.length > 1 ? (
        <View style={styles.carouselDots}>
          {uris.map((_, index) => (
            <View
              key={`dot-${index}`}
              style={[styles.carouselDot, index === page && styles.carouselDotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface PostCardProps {
  post: Post;
  currentUserId: string | null;
  isLiked: boolean;
  isBookmarked?: boolean;
  isFollowing?: boolean;
  isAdmin?: boolean;
  onPress: () => void;
  onAvatarPress: () => void;
  onLike: () => void;
  onBookmark?: () => void | Promise<void>;
  onFollow?: () => void;
  onBlock?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onPin?: () => void;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'NOW';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'NOW';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return diffMin + 'M';
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return diffHour + 'H';
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return diffDay + 'D';
  const diffWeek = Math.floor(diffDay / 7);
  if (diffWeek < 4) return diffWeek + 'W';
  return Math.floor(diffDay / 30) + 'MO';
}

function WaveformBars({ postId }: { postId: string }) {
  let charSum = 0;
  for (let c = 0; c < postId.length; c++) charSum += postId.charCodeAt(c);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 22 }}>
      {Array.from({ length: 40 }, (_, i) => (
        <View key={i} style={{
          width: 2,
          height: 4 + ((charSum + i * 7) % 18),
          backgroundColor: i / 40 < 0.3 ? colors.red : '#222222',
          marginRight: 1,
        }} />
      ))}
    </View>
  );
}

function InlineVideoPlayer({ uri }: { uri: string | null }) {
  const [VideoComponent, setVideoComponent] = useState<any>(null);
  const [posterUri, setPosterUri] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const loadVideo = async () => {
      try {
        const mod = await import('expo-av');
        await mod.Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        if (alive) setVideoComponent(() => mod.Video);
      } catch {
        if (alive) setVideoComponent(null);
      }
    };

    void loadVideo();

    if (uri) {
      void import('expo-video-thumbnails')
        .then((mod) => mod.getThumbnailAsync(uri, { time: 500 }))
        .then(({ uri: nextPosterUri }) => {
          if (alive) setPosterUri(nextPosterUri);
        })
        .catch(() => {
          if (alive) setPosterUri(null);
        });
    } else {
      setPosterUri(null);
    }

    return () => {
      alive = false;
    };
  }, [uri]);

  if (!uri) {
    return (
      <View style={styles.videoContainer}>
        <View style={styles.videoPlaceholder}>
          <Text style={styles.videoPlayIcon}>▶</Text>
        </View>
      </View>
    );
  }

  if (!VideoComponent) {
    return (
      <View style={styles.videoContainer}>
        <VideoThumbnail
          uri={uri}
          containerStyle={styles.videoContent}
          imageStyle={styles.videoContent}
          label="VIDEO"
          centerPlayStyle={styles.videoPlayIcon}
          labelStyle={styles.videoInlineLabel}
          cornerTag="▶"
          cornerTagStyle={styles.videoInlineTag}
        />
      </View>
    );
  }

  return (
    <View style={styles.videoContainer}>
      <VideoComponent
        source={{ uri }}
        style={styles.videoContent}
        resizeMode="cover"
        useNativeControls
        shouldPlay={false}
        isLooping={false}
        usePoster={Boolean(posterUri)}
        posterSource={posterUri ? { uri: posterUri } : undefined}
        posterStyle={styles.videoContent}
      />
    </View>
  );
}

function ThreeDotMenu({
  isOwner, isFollowing, username, isAdmin, isPinned,
  onEdit, onDelete, onFollow, onBlock, onReport, onShare, onPin,
}: {
  isOwner: boolean;
  isFollowing?: boolean;
  username?: string;
  isAdmin?: boolean;
  isPinned?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onFollow?: () => void;
  onBlock?: () => void;
  onReport: () => void;
  onShare: () => void;
  onPin?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const canManage = isOwner || isAdmin;

  const handleDelete = () => {
    setVisible(false);
    Alert.alert('DELETE POST', 'This cannot be undone.', [
      { text: 'CANCEL', style: 'cancel' },
      { text: 'DELETE', style: 'destructive', onPress: onDelete },
    ]);
  };

  const handleBlock = () => {
    setVisible(false);
    const handle = (username ?? 'USER').toUpperCase();
    Alert.alert(
      `BLOCK @${handle}?`,
      'They will not be able to see your profile or posts and you will not see theirs.',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'BLOCK', style: 'destructive', onPress: onBlock },
      ]
    );
  };

  const row = (label: string, onPress: () => void, danger?: boolean) => (
    <TouchableOpacity style={styles.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.menuText, danger && styles.menuTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.threeDotBtn}>
        <View style={styles.dotRed} />
        <View style={styles.dotRed} />
        <View style={[styles.dotRed, { marginBottom: 0 }]} />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.modalBox}>
            {canManage ? (
              <>
                {row('EDIT POST', () => { setVisible(false); onEdit(); })}
                {row('SHARE', () => { setVisible(false); onShare(); })}
                {row('DELETE POST', handleDelete, true)}
              </>
            ) : (
              <>
                {row('SHARE', () => { setVisible(false); onShare(); })}
                {row(
                  isFollowing
                    ? `UNFOLLOW @${(username ?? '').toUpperCase()}`
                    : `FOLLOW @${(username ?? '').toUpperCase()}`,
                  () => { setVisible(false); onFollow?.(); }
                )}
                {row(`BLOCK @${(username ?? '').toUpperCase()}`, handleBlock, true)}
                {row('REPORT POST', () => { setVisible(false); onReport(); }, true)}
              </>
            )}
            {isAdmin ? (
              row(
                isPinned ? 'UNPIN POST' : 'PIN POST',
                () => { setVisible(false); onPin?.(); }
              )
            ) : null}
            {row('CANCEL', () => setVisible(false))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function PostCard({
  post, currentUserId, isLiked, isBookmarked = false, isFollowing = false, isAdmin = false,
  onPress, onAvatarPress, onLike, onBookmark, onFollow, onBlock,
  onDelete, onEdit, onPin,
}: PostCardProps) {
  const [sound, setSound] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [collaborators, setCollaborators] = useState<(PostProfile & { id: string; accepted?: boolean })[]>(post.collaborators ?? []);

  useEffect(() => {
    return () => { if (sound) sound.unloadAsync(); };
  }, [sound]);

  useEffect(() => {
    let alive = true;
    const loadCollaborators = async () => {
      if (post.collaborators) {
        setCollaborators(post.collaborators);
        return;
      }
      const { data: rows } = await supabase
        .from('post_collaborators')
        .select('collaborator_id, accepted')
        .eq('post_id', post.id);
      const collaboratorIds = (rows ?? []).map((row: any) => row.collaborator_id as string);
      if (collaboratorIds.length === 0) {
        if (alive) setCollaborators([]);
        return;
      }
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, profile_photo_url, art_type, discipline, full_name')
        .in('id', collaboratorIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((profile: any) => [profile.id, profile]));
      const merged = (rows ?? [])
        .map((row: any) => ({
          ...(profileMap[row.collaborator_id] ?? {}),
          id: row.collaborator_id,
          accepted: row.accepted,
        }))
        .filter((profile: any) => profile.id);
      if (alive) setCollaborators(merged as (PostProfile & { id: string; accepted?: boolean })[]);
    };
    void loadCollaborators();
    return () => { alive = false; };
  }, [post.id, post.collaborators]);

  const handlePlayAudio = async () => {
    if (!post.media_url) return;
    try {
      const { Audio } = await import('expo-av');
      if (sound) {
        if (isPlaying) { await sound.pauseAsync(); setIsPlaying(false); }
        else { await sound.playAsync(); setIsPlaying(true); }
        return;
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: post.media_url }, { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((s) => {
        if (s.isLoaded && s.didJustFinish) setIsPlaying(false);
      });
    } catch { /* silent fail */ }
  };

  const handleShare = async () => {
    try {
      const username = post.profiles?.username ?? 'artist';
      const title = post.title ?? 'Check out this post';
      const url = buildPostShareUrl(post.id);
      const message = post.content
        ? `${title}\n\n"${post.content.substring(0, 100)}"\n\n— @${username} on WORK(ER) OF ART\n${url}`
        : `${title} by @${username} on WORK(ER) OF ART\n${url}`;
      await Share.share({ message, title, url });
    } catch {
      /* user cancelled */
    }
  };

  const handleBookmarkPress = async () => {
    if (!onBookmark) return;
    await Promise.resolve(onBookmark());
  };

  const handleReportPost = async () => {
    try {
      await reportContent({
        targetType: 'post',
        targetId: post.id,
        targetUserId: post.user_id,
        reason: 'Post reported from feed menu',
      });
      Alert.alert('REPORTED', 'Thank you. We will review this post.');
    } catch (error: any) {
      Alert.alert('REPORT FAILED', (error?.message ?? 'Please try again.').toUpperCase());
    }
  };

  const username = post.profiles?.username ? '@' + post.profiles.username : '@UNKNOWN';
  const discipline = post.profiles?.discipline ?? post.profiles?.art_type ?? null;
  const subtitle = post.profiles?.role === 'COLLECTIVE'
    ? 'ART COLLECTIVE'
    : discipline
      ? discipline.toUpperCase()
      : 'ARTIST';
  const isOwner = currentUserId === post.user_id;
  const visibleCollaborators = collaborators.filter((collaborator) => collaborator.accepted || isOwner);
  const collaboratorText = visibleCollaborators.length > 0
    ? visibleCollaborators
        .slice(0, 2)
        .map((collaborator) => {
          const handle = collaborator.username
            ? `@${collaborator.username.toUpperCase()}`
            : (collaborator.full_name ?? '').toUpperCase();
          return collaborator.accepted ? handle : `${handle} (INVITED)`;
        })
        .join(' + ')
    : null;

  const fullText = post.content ?? '';
  const isLong = fullText.length > 150;
  const displayText = isLong ? fullText.substring(0, 150) + '...' : fullText;
  const imageUris = getPostImageUris(post);

  return (
    <View style={styles.card}>

      {/* PINNED BANNER */}
      {post.is_pinned ? (
        <View style={styles.pinnedBanner}>
          <Text style={styles.pinnedText}>◈ PINNED</Text>
        </View>
      ) : null}

      {/* HEADER */}
      <View style={styles.header}>
        <OctagonalImage size={AVATAR_SIZE} imageUri={post.profiles?.profile_photo_url} onPress={onAvatarPress} />
        <View style={styles.headerInfo}>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>{username.toUpperCase()}</Text>
            {collaboratorText ? <Text style={styles.collaboratorText}> + {collaboratorText}</Text> : null}
          </View>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
        <ThreeDotMenu
          isOwner={isOwner}
          isFollowing={isFollowing}
          username={post.profiles?.username}
          isAdmin={isAdmin}
          isPinned={post.is_pinned}
          onEdit={() => onEdit?.()}
          onDelete={() => onDelete?.()}
          onFollow={onFollow}
          onBlock={onBlock}
          onShare={handleShare}
          onReport={handleReportPost}
          onPin={onPin}
        />
      </View>

      {/* POST BODY — indented to align with header text */}
      <View style={styles.body}>

        {/* TITLE — shown at top for all post types */}
        {post.title ? (
          <Text style={styles.postTitle}>{post.title.toUpperCase()}</Text>
        ) : null}

        {/* IMAGE */}
        {post.type === 'image' && (
          imageUris.length > 0 ? (
            <ImageCarousel uris={imageUris} onPress={onPress} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imagePlaceholderIcon}>◈</Text>
            </View>
          )
        )}

        {/* TEXT */}
        {post.type === 'text' && (
          <View style={styles.textContent}>
            <Text style={styles.textQuote}>
              {'"' + displayText + '"'}
            </Text>
            {isLong ? (
              <TouchableOpacity onPress={onPress}>
                <Text style={styles.readMore}>READ MORE</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* AUDIO */}
        {post.type === 'audio' && (
          <View style={styles.audioContent}>
            <View style={styles.audioRow}>
              <TouchableOpacity style={styles.playButton} onPress={handlePlayAudio} activeOpacity={0.7}>
                <Text style={styles.playIcon}>{isPlaying ? '⏸' : '▶'}</Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <WaveformBars postId={post.id} />
              </View>
              <Text style={styles.durationText}>0:00</Text>
            </View>
          </View>
        )}

        {/* VIDEO */}
        {post.type === 'video' && (
          <InlineVideoPlayer uri={post.media_url} />
        )}

        {/* TAG */}
        {post.tags && post.tags.length > 0 ? (
          <View style={styles.tagWrap}>
            <Text style={styles.tagLabel}>{post.tags[0].toUpperCase()}</Text>
          </View>
        ) : null}

        {/* ACTIONS */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={onLike} style={styles.actionButton}>
            <Text style={{ color: colors.red, fontSize: 18 }}>{isLiked ? '♥' : '♡'}</Text>
            <Text style={[styles.actionCount, { color: colors.red }]}>{post.like_count}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onPress} style={[styles.actionButton, { marginLeft: 20 }]}>
            <Ionicons name="chatbubble-outline" size={18} color={colors.red} />
            <Text style={[styles.actionCount, { color: colors.red }]}>{post.comment_count}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
            <Text style={styles.shareText}>SHARE</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleBookmarkPress} style={styles.bookmarkBtn} activeOpacity={0.7}>
            <Ionicons
              name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={isBookmarked ? GOLD : '#9a9a9a'}
            />
          </TouchableOpacity>
        </View>

      </View>

      {/* SEPARATOR */}
      <View style={styles.separator}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorDot}>●</Text>
        <View style={styles.separatorLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.black,
  },

  pinnedBanner: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 5,
    backgroundColor: '#0d0a00',
    borderBottomWidth: 1, borderBottomColor: '#2a1f00',
  },
  pinnedText: {
    color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.25,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerInfo: { flex: 1, marginLeft: 8 },
  usernameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 4 },
  username: {
    color: colors.white, fontSize: 13, letterSpacing: 0.12, fontFamily: MONO,
  },
  collaboratorText: {
    color: GOLD, fontSize: 11, letterSpacing: 0.08, fontFamily: MONO,
  },
  subtitle: {
    color: GOLD, fontSize: 11, letterSpacing: 0.15, fontFamily: MONO, marginTop: 2,
  },
  timestamp: {
    color: '#9a9a9a', fontSize: 11, fontFamily: MONO, letterSpacing: 0.1, marginRight: 4,
  },

  threeDotBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  dotRed: {
    width: 3, height: 3, backgroundColor: RED, borderRadius: 1.5, marginBottom: 3,
  },

  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBox: {
    backgroundColor: '#111111', borderTopWidth: 1, borderColor: '#2a2a2a', paddingBottom: 30,
  },
  menuRow: {
    paddingVertical: 16, paddingHorizontal: 28,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  menuText: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.2, color: colors.white },
  menuTextDanger: { color: RED },

  // Body — indented to align with header text
  body: {
    paddingLeft: INDENT,
    paddingRight: 14,
  },

  // Title shown above all post types
  postTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.15,
    marginBottom: 8,
  },

  imageContent: { width: CARD_MEDIA_WIDTH, aspectRatio: 1 },
  imagePlaceholder: {
    width: CARD_MEDIA_WIDTH, aspectRatio: 1, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderIcon: { color: '#8f8f8f', fontSize: 24 },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3a3a3a',
  },
  carouselDotActive: {
    backgroundColor: colors.red,
  },

  textContent: {
    paddingVertical: 4,
  },
  textQuote: {
    color: '#cccccc', fontSize: 13, fontFamily: MONO, letterSpacing: 0.1, lineHeight: 21,
  },
  readMore: {
    color: GOLD, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginTop: 6,
  },

  videoContainer: {
    width: '100%', aspectRatio: 16 / 9,
    backgroundColor: '#000000', overflow: 'hidden',
  },
  videoContent: { width: '100%', height: '100%' },
  videoPlaceholder: {
    width: '100%', aspectRatio: 16 / 9, backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  videoPlayIcon: { color: colors.red, fontSize: 28 },
  videoInlineLabel: {
    color: '#ffffff',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.15,
  },
  videoInlineTag: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 11,
  },

  audioContent: {
    backgroundColor: '#0a0a0a', borderWidth: 1,
    borderColor: '#1a1a1a', paddingHorizontal: 12, paddingVertical: 12,
  },
  audioRow: { flexDirection: 'row', alignItems: 'center' },
  playButton: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  playIcon: { color: colors.red, fontSize: 12 },
  durationText: { color: '#b5b5b5', fontSize: 10, fontFamily: MONO, marginLeft: 8 },

  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 13, fontFamily: MONO },
  shareText: { color: GOLD, fontSize: 12, fontFamily: MONO, letterSpacing: 0.15 },
  bookmarkBtn: { padding: 4 },
  bookmarkWrap: { alignItems: 'center', marginLeft: 16 },

  separator: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#111111' },
  separatorDot: { color: colors.red, fontSize: 10, marginHorizontal: 8 },

  tagWrap: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
    marginBottom: 2,
  },
  tagLabel: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
  },
});
