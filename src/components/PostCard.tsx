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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import OctagonalImage from './OctagonalImage';
import { colors } from '../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });
const GOLD = '#f6c55a';
const RED = '#c0392b';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostProfile {
  username: string;
  profile_photo_url: string | null;
  art_type: string | null;
  discipline: string | null;
  full_name: string | null;
}

export interface Post {
  id: string;
  user_id: string;
  type: 'image' | 'text' | 'audio';
  content: string | null;
  title: string | null;
  media_url: string | null;
  tags: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
  profiles?: PostProfile | null;
}

interface PostCardProps {
  post: Post;
  currentUserId: string | null;
  isLiked: boolean;
  isBookmarked?: boolean;
  isFollowing?: boolean;
  onPress: () => void;
  onAvatarPress: () => void;
  onLike: () => void;
  onBookmark?: () => void;
  onFollow?: () => void;
  onBlock?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── WaveformBars ─────────────────────────────────────────────────────────────

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

// ─── ThreeDotMenu ─────────────────────────────────────────────────────────────

function ThreeDotMenu({
  isOwner, isFollowing, username,
  onEdit, onDelete, onFollow, onBlock, onReport,
}: {
  isOwner: boolean;
  isFollowing?: boolean;
  username?: string;
  onEdit: () => void;
  onDelete: () => void;
  onFollow?: () => void;
  onBlock?: () => void;
  onReport: () => void;
}) {
  const [visible, setVisible] = useState(false);

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
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
    >
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
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalBox}>
            {isOwner ? (
              <>
                {row('EDIT POST', () => { setVisible(false); onEdit(); })}
                {row('DELETE POST', handleDelete, true)}
              </>
            ) : (
              <>
                {row('SHARE', () => { setVisible(false); })}
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
            {row('CANCEL', () => setVisible(false))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// ─── PostCard ─────────────────────────────────────────────────────────────────

export default function PostCard({
  post, currentUserId, isLiked, isBookmarked = false, isFollowing = false,
  onPress, onAvatarPress, onLike, onBookmark, onFollow, onBlock,
  onDelete, onEdit,
}: PostCardProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => { if (sound) sound.unloadAsync(); };
  }, [sound]);

  const handlePlayAudio = async () => {
    if (!post.media_url) return;
    try {
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

  const username = post.profiles?.username ? '@' + post.profiles.username : '@UNKNOWN';
  const discipline = post.profiles?.discipline ?? post.profiles?.art_type ?? null;
  const subtitle = discipline ? discipline.toUpperCase() : 'ARTIST';
  const isOwner = currentUserId === post.user_id;

  const isGif = (url: string | null) => url?.toLowerCase().endsWith('.gif') ?? false;

  // Text truncation
  const fullText = post.content ?? '';
  const isLong = fullText.length > 150;
  const displayText = isLong ? fullText.substring(0, 150) + '...' : fullText;

  return (
    <TouchableOpacity activeOpacity={1} onPress={onPress} style={styles.card}>

      {/* HEADER */}
      <View style={styles.header}>
        <OctagonalImage size={28} imageUri={post.profiles?.profile_photo_url} onPress={onAvatarPress} />
        <View style={styles.headerInfo}>
          <Text style={styles.username}>{username.toUpperCase()}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <Text style={styles.timestamp}>{timeAgo(post.created_at)}</Text>
        <ThreeDotMenu
          isOwner={isOwner}
          isFollowing={isFollowing}
          username={post.profiles?.username}
          onEdit={() => onEdit?.()}
          onDelete={() => onDelete?.()}
          onFollow={onFollow}
          onBlock={onBlock}
          onReport={() => Alert.alert('REPORTED', 'Thank you for your report.')}
        />
      </View>

      {/* IMAGE */}
      {post.type === 'image' && (
        <View style={styles.mediaWrap}>
          <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
            {post.media_url ? (
              <Image
                source={{ uri: post.media_url }}
                style={styles.imageContent}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Text style={styles.imagePlaceholderIcon}>◈</Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Dark gradient overlay for title */}
          {post.title ? (
            <View style={styles.mediaTitleOverlay}>
              <View style={styles.mediaGradient} />
              <Text style={styles.mediaTitleText} numberOfLines={1}>{post.title.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* TEXT */}
      {post.type === 'text' && (
        <View style={styles.textContent}>
          {post.title ? (
            <Text style={styles.textTitle}>{post.title.toUpperCase()}</Text>
          ) : null}
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
        <View style={styles.audioWrap}>
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
          {post.title ? (
            <View style={styles.audioTitleRow}>
              <Text style={styles.mediaTitleText} numberOfLines={1}>{post.title.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>
      )}

      {/* ACTIONS */}
      <View style={styles.actions}>
        <TouchableOpacity onPress={onLike} style={styles.actionButton}>
          <Text style={{ color: colors.red, fontSize: 14 }}>{isLiked ? '♥' : '♡'}</Text>
          <Text style={[styles.actionCount, { color: colors.red }]}>{post.like_count}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onPress} style={[styles.actionButton, { marginLeft: 16 }]}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.red} />
          <Text style={[styles.actionCount, { color: colors.red }]}>{post.comment_count}</Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        <Text style={styles.shareText}>SHARE</Text>

        <TouchableOpacity onPress={onBookmark} style={styles.bookmarkBtn} activeOpacity={0.7}>
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={16}
            color={isBookmarked ? GOLD : '#444444'}
          />
        </TouchableOpacity>
      </View>

      {/* SEPARATOR */}
      <View style={styles.separator}>
        <View style={styles.separatorLine} />
        <Text style={styles.separatorDot}>●</Text>
        <View style={styles.separatorLine} />
      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.black,
    borderLeftWidth: 2,
    borderLeftColor: '#1a1a1a',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  headerInfo: { flex: 1, marginLeft: 8 },
  username: {
    color: colors.white, fontSize: 13, letterSpacing: 0.12, fontFamily: MONO,
  },
  subtitle: {
    color: GOLD, fontSize: 10, letterSpacing: 0.15, fontFamily: MONO,
  },
  timestamp: {
    color: '#333333', fontSize: 10, fontFamily: MONO, letterSpacing: 0.1, marginRight: 4,
  },

  // Three dot menu
  threeDotBtn: {
    width: 44, height: 44, alignItems: 'center', justifyContent: 'center',
  },
  dotRed: {
    width: 3, height: 3, backgroundColor: RED, borderRadius: 1.5, marginBottom: 3,
  },

  // Menu modal
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
  menuText: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.2, color: colors.white },
  menuTextDanger: { color: RED },

  // Media
  mediaWrap: { position: 'relative' },
  imageContent: { width: '100%', aspectRatio: 1 },
  imagePlaceholder: {
    width: '100%', aspectRatio: 1, backgroundColor: '#111111',
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderIcon: { color: '#333333', fontSize: 24 },

  // Title overlay on image/audio
  mediaTitleOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  mediaGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  mediaTitleText: {
    color: '#ffffff', fontFamily: MONO, fontSize: 12, fontWeight: '600',
    letterSpacing: 0.1, paddingHorizontal: 10, paddingBottom: 8, paddingTop: 12,
  },

  // Text content
  textContent: {
    paddingHorizontal: 14, paddingVertical: 12, backgroundColor: colors.black,
  },
  textTitle: {
    color: colors.white, fontFamily: MONO, fontSize: 11, fontWeight: '600',
    letterSpacing: 0.15, marginBottom: 6,
  },
  textQuote: {
    color: '#cccccc', fontSize: 11, fontFamily: MONO, letterSpacing: 0.1, lineHeight: 18,
  },
  readMore: {
    color: GOLD, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15, marginTop: 6,
  },

  // Audio
  audioWrap: {},
  audioContent: {
    backgroundColor: '#0a0a0a', borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#1a1a1a', paddingHorizontal: 14, paddingVertical: 12,
  },
  audioRow: { flexDirection: 'row', alignItems: 'center' },
  playButton: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  playIcon: { color: colors.red, fontSize: 10 },
  durationText: { color: '#444444', fontSize: 6, fontFamily: MONO, marginLeft: 8 },
  audioTitleRow: {
    paddingHorizontal: 14, paddingVertical: 6, backgroundColor: '#0a0a0a',
  },

  // Actions
  actions: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
  },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionCount: { fontSize: 12, fontFamily: MONO },
  shareText: { color: GOLD, fontSize: 10, fontFamily: MONO, letterSpacing: 0.15 },
  bookmarkBtn: { marginLeft: 12, padding: 4 },

  // Separator
  separator: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10,
  },
  separatorLine: { flex: 1, height: 1, backgroundColor: '#111111' },
  separatorDot: { color: colors.red, fontSize: 8, marginHorizontal: 8 },
});
