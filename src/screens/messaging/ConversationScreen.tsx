import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Platform, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Alert, Dimensions,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { useUnread } from '../../contexts/UnreadContext';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const BUBBLE_MAX = SCREEN_WIDTH * 0.75;

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

type ListItem =
  | (Message & { _type: 'message' })
  | { _type: 'divider'; id: string; label: string };

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'TODAY';
  if (d.toDateString() === yesterday.toDateString()) return 'YESTERDAY';
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  }).toUpperCase();
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function buildListData(messages: Message[]): ListItem[] {
  const items: ListItem[] = [];
  let lastLabel = '';
  for (const msg of messages) {
    const label = formatDateLabel(msg.created_at);
    if (label !== lastLabel) {
      items.push({ _type: 'divider', id: `div_${msg.id}`, label });
      lastLabel = label;
    }
    items.push({ ...msg, _type: 'message' });
  }
  return items;
}

export default function ConversationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    conversationId,
    otherUserId,
    otherUserName,
    otherUserUsername,
    otherUserAvatar,
    gigId,
    gigTitle,
  } = route.params as {
    conversationId: string;
    otherUserId: string;
    otherUserName: string | null;
    otherUserUsername: string | null;
    otherUserAvatar: string | null;
    gigId: string | null;
    gigTitle: string | null;
  };

  const { refreshUnread, setActiveConversationId } = useUnread();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [showGigBanner, setShowGigBanner] = useState(!!gigId);
  const [bookingStatus, setBookingStatus] = useState<'none' | 'in_process' | 'agreement_reached' | 'booked'>('none');
  const [bookedAt, setBookedAt] = useState<string | null>(null);
  const [conversationArtistId, setConversationArtistId] = useState<string | null>(null);

  const markAsRead = useCallback(async (uid: string, role: string) => {
    const isGigPoster = role === 'GIG_POSTER';
    const column = isGigPoster ? 'gig_poster_unread' : 'artist_unread';
    await supabase
      .from('conversations')
      .update({ [column]: 0 })
      .eq('id', conversationId);
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', uid);
    refreshUnread();
  }, [conversationId, refreshUnread]);

  const loadMessages = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: me } = await supabase
      .from('profiles').select('profile_photo_url, role').eq('id', user.id).single();
    const role = (me as any)?.role ?? null;
    setCurrentUserRole(role);
    setCurrentUserAvatar((me as any)?.profile_photo_url ?? null);

    const { data: msgData } = await supabase
      .from('messages')
      .select('id, conversation_id, sender_id, content, is_read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setMessages((msgData as Message[]) ?? []);

    // Load booking status for gig conversations
    if (gigId) {
      const { data: convData } = await supabase
        .from('conversations')
        .select('booking_status, booked_at, artist_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (convData) {
        setBookingStatus((convData as any).booking_status ?? 'none');
        setBookedAt((convData as any).booked_at ?? null);
        setConversationArtistId((convData as any).artist_id ?? null);
      }
    }

    setLoading(false);

    if (role) await markAsRead(user.id, role);
  }, [conversationId, markAsRead]);

  useFocusEffect(useCallback(() => {
    setActiveConversationId(conversationId);
    loadMessages();
    return () => { setActiveConversationId(null); };
  }, [conversationId, loadMessages, setActiveConversationId]));

  // Scroll to bottom after initial load
  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 80);
    }
  }, [loading]);

  // Realtime: new messages
  useEffect(() => {
    const channel = supabase
      .channel(`conv_msgs_${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.find(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
        // Mark as read if from other person
        setCurrentUserId(uid => {
          if (newMsg.sender_id !== uid && uid) {
            setCurrentUserRole(role => {
              if (role) markAsRead(uid, role);
              return role;
            });
          }
          return uid;
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        const updated = payload.new as Message;
        setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, markAsRead]);

  const handleSend = async () => {
    const text = messageText.trim();
    if (!text || !currentUserId || sending) return;
    if (containsBannedWords(text)) {
      setMessageError(getBannedWordError());
      return;
    }
    setSending(true);
    setMessageError(null);
    setMessageText('');

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: currentUserId,
      content: text,
    });

    if (error) {
      setMessageText(text);
      Alert.alert('ERROR', 'Failed to send message. Please try again.');
    }
    setSending(false);
  };

  const listData = buildListData(messages);
  const lastOwnMsgId = [...messages].reverse().find(m => m.sender_id === currentUserId)?.id;

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item._type === 'divider') {
      return (
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerLabel}>{item.label}</Text>
          <View style={s.dividerLine} />
        </View>
      );
    }

    const msg = item as Message & { _type: 'message' };
    const isOwn = msg.sender_id === currentUserId;
    const isLastOwn = msg.id === lastOwnMsgId;

    return (
      <View style={[s.bubbleWrap, isOwn ? s.bubbleWrapRight : s.bubbleWrapLeft]}>
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
          <Text style={[s.bubbleText, isOwn ? s.bubbleTextOwn : s.bubbleTextOther]}>
            {msg.content}
          </Text>
        </View>
        <Text style={[s.bubbleTime, isOwn ? s.timeRight : s.timeLeft]}>
          {formatTime(msg.created_at)}
          {isOwn && isLastOwn ? (msg.is_read ? '  READ' : '  SENT') : ''}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <View style={s.topBarCenter}>
            <Text style={s.topBarName}>{(otherUserName ?? 'UNKNOWN').toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {/* TOP BAR */}
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <View style={s.topBarCenter}>
          <Text style={s.topBarName} numberOfLines={1}>
            {(otherUserName ?? 'UNKNOWN').toUpperCase()}
          </Text>
          {otherUserUsername ? (
            <Text style={s.topBarHandle}>@{otherUserUsername.toUpperCase()}</Text>
          ) : null}
          {gigTitle ? (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => gigId && navigation.navigate('GigDetail', { gigId })}
            >
              <Text style={s.topBarGig} numberOfLines={1}>{gigTitle.toUpperCase()}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <OctagonalImage
          size={28}
          imageUri={otherUserAvatar}
          onPress={() => navigation.navigate('ArtistProfile', { userId: otherUserId })}
        />
      </View>

      {/* GIG CONTEXT BANNER */}
      {showGigBanner && gigTitle ? (
        <View style={s.gigBanner}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => gigId && navigation.navigate('GigDetail', { gigId })}
            activeOpacity={0.8}
          >
            <Text style={s.gigBannerText} numberOfLines={1}>
              RE: {gigTitle.toUpperCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowGigBanner(false)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.gigBannerClose}>×</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* BOOKING STATUS BAR — gig conversations only */}
      {gigId ? (
        <View style={s.bookingBar}>
          {(['in_process', 'agreement_reached', 'booked'] as const).map((status, idx) => {
            const labels: Record<string, string> = {
              in_process: 'IN PROCESS',
              agreement_reached: 'AGREED',
              booked: 'BOOKED',
            };
            const isActive = bookingStatus === status;
            const isPast = (
              (status === 'in_process' && (bookingStatus === 'agreement_reached' || bookingStatus === 'booked')) ||
              (status === 'agreement_reached' && bookingStatus === 'booked')
            );
            const isGigPoster = currentUserRole === 'GIG_POSTER';
            return (
              <React.Fragment key={status}>
                {idx > 0 && <Text style={s.bookingArrow}>›</Text>}
                <TouchableOpacity
                  style={[s.bookingStep, (isActive || isPast) && s.bookingStepDone]}
                  onPress={async () => {
                    if (!isGigPoster || isActive || isPast) return;
                    const updates: Record<string, string | null> = { booking_status: status };
                    if (status === 'booked') updates.booked_at = new Date().toISOString();
                    await supabase.from('conversations').update(updates).eq('id', conversationId);
                    setBookingStatus(status);
                    if (status === 'booked') setBookedAt(new Date().toISOString());
                  }}
                  activeOpacity={isGigPoster && !isActive && !isPast ? 0.7 : 1}
                >
                  <Text style={[s.bookingStepText, (isActive || isPast) && s.bookingStepTextDone]}>
                    {labels[status]}
                  </Text>
                </TouchableOpacity>
              </React.Fragment>
            );
          })}
        </View>
      ) : null}

      {/* Review prompt — 1 week after booked */}
      {gigId && bookingStatus === 'booked' && bookedAt && conversationArtistId && currentUserId &&
        (Date.now() - new Date(bookedAt).getTime() >= 7 * 24 * 60 * 60 * 1000) ? (
        <TouchableOpacity
          style={s.reviewPrompt}
          onPress={() => navigation.navigate('LeaveReview', {
            gigId,
            gigTitle,
            revieweeId: currentUserRole === 'GIG_POSTER' ? conversationArtistId : otherUserId,
            revieweeName: currentUserRole === 'GIG_POSTER' ? otherUserName : otherUserName,
            revieweeAvatar: otherUserAvatar,
          })}
          activeOpacity={0.8}
        >
          <Text style={s.reviewPromptText}>⭐ LEAVE A REVIEW FOR THIS GIG</Text>
        </TouchableOpacity>
      ) : null}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={listData}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.listContent}
          onContentSizeChange={() => {
            flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <View style={s.emptyMessages}>
              <Text style={s.emptyTitle}>NO MESSAGES YET</Text>
              <Text style={s.emptySub}>START THE CONVERSATION</Text>
            </View>
          }
        />

        {/* Input row */}
        <View style={s.inputArea}>
          {messageError ? (
            <Text style={s.inputError}>{messageError}</Text>
          ) : null}
          <View style={s.inputRow}>
            <OctagonalImage size={20} imageUri={currentUserAvatar} />
            <TextInput
              style={s.textInput}
              value={messageText}
              onChangeText={t => {
                setMessageText(t);
                if (messageError) setMessageError(null);
              }}
              placeholder="MESSAGE..."
              placeholderTextColor="#333333"
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!messageText.trim() || sending}
              activeOpacity={0.7}
              style={s.sendBtn}
            >
              <Text style={[s.sendBtnText, messageText.trim() ? s.sendActive : s.sendInactive]}>
                {sending ? '...' : 'SEND'}
              </Text>
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
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    gap: 10,
  },
  backBtn: { padding: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarCenter: { flex: 1 },
  topBarName: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  topBarHandle: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.12, marginTop: 2 },
  topBarGig: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, marginTop: 2 },

  gigBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0000',
    borderBottomWidth: 1, borderBottomColor: colors.red,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  gigBannerText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.12 },
  gigBannerClose: { color: colors.red, fontFamily: MONO, fontSize: 16, paddingLeft: 12 },

  bookingBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#050505',
    borderBottomWidth: 1, borderBottomColor: '#111111',
    paddingHorizontal: 16, paddingVertical: 10, gap: 4,
  },
  bookingArrow: { color: '#333333', fontFamily: MONO, fontSize: 12 },
  bookingStep: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#222222',
  },
  bookingStepDone: { borderColor: '#f6c55a', backgroundColor: '#0a0800' },
  bookingStepText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  bookingStepTextDone: { color: '#f6c55a' },

  reviewPrompt: {
    backgroundColor: '#0a0000', borderBottomWidth: 1, borderBottomColor: colors.red,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  reviewPromptText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.15, textAlign: 'center' },

  listContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },

  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 14, gap: 8,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#111111' },
  dividerLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },

  bubbleWrap: { marginBottom: 8 },
  bubbleWrapRight: { alignItems: 'flex-end' },
  bubbleWrapLeft: { alignItems: 'flex-start' },

  bubble: { maxWidth: BUBBLE_MAX, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1 },
  bubbleOwn: {
    backgroundColor: '#1a1a1a',
    borderColor: '#2a2a2a',
    borderRadius: 12,
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    backgroundColor: '#0d0d0d',
    borderColor: '#1a1a1a',
    borderRadius: 12,
    borderBottomLeftRadius: 2,
  },
  bubbleText: { fontFamily: MONO, fontSize: 13, letterSpacing: 0.08, lineHeight: 20 },
  bubbleTextOwn: { color: colors.white },
  bubbleTextOther: { color: '#cccccc' },

  bubbleTime: { fontFamily: MONO, fontSize: 10, color: '#9a9a9a', marginTop: 4, letterSpacing: 0.1 },
  timeRight: { textAlign: 'right' },
  timeLeft: { textAlign: 'left' },

  emptyMessages: { paddingTop: 80, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
  emptySub: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },

  inputArea: {
    borderTopWidth: 1, borderTopColor: '#111111',
    backgroundColor: colors.black,
  },
  inputError: {
    color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.1,
    paddingHorizontal: 16, paddingTop: 8,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#1a1a1a', borderRadius: 8,
    color: colors.white, fontFamily: MONO,
    fontSize: 13, letterSpacing: 0.06,
    paddingHorizontal: 12, paddingVertical: 10,
    maxHeight: 110,
  },
  sendBtn: { paddingVertical: 8, minWidth: 44, alignItems: 'center' },
  sendBtnText: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  sendActive: { color: colors.red },
  sendInactive: { color: '#333333' },
});
