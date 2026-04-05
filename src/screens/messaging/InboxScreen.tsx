import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, SafeAreaView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'NOW';
  if (m < 60) return `${m}M`;
  if (h < 24) return `${h}H`;
  return `${d}D`;
}

interface Conversation {
  id: string;
  gig_poster_id: string;
  artist_id: string;
  gig_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  gig_poster_unread: number;
  artist_unread: number;
  // enriched
  otherUserId: string;
  otherUserName: string | null;
  otherUserUsername: string | null;
  otherUserAvatar: string | null;
  gigTitle: string | null;
  unread: number;
}

export default function InboxScreen() {
  const navigation = useNavigation<any>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [isGigPoster, setIsGigPoster] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: me } = await supabase
      .from('profiles').select('role, profile_photo_url').eq('id', user.id).single();
    const gigPoster = (me as any)?.role === 'GIG_POSTER';
    setIsGigPoster(gigPoster);
    setCurrentUserAvatar((me as any)?.profile_photo_url ?? null);

    const idColumn = gigPoster ? 'gig_poster_id' : 'artist_id';
    const { data: convData } = await supabase
      .from('conversations')
      .select('id, gig_poster_id, artist_id, gig_id, last_message, last_message_at, gig_poster_unread, artist_unread')
      .eq(idColumn, user.id)
      .order('last_message_at', { ascending: false });

    if (!convData || convData.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Fetch other user profiles
    const otherIds = (convData as any[]).map(c => gigPoster ? c.artist_id : c.gig_poster_id);
    const uniqueIds = [...new Set(otherIds)];
    const { data: profiles } = await supabase
      .from('profiles').select('id, full_name, username, profile_photo_url').in('id', uniqueIds);
    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    // Fetch gig titles
    const gigIds = (convData as any[]).filter(c => c.gig_id).map((c: any) => c.gig_id);
    const gigMap: Record<string, string> = {};
    if (gigIds.length > 0) {
      const { data: gigs } = await supabase.from('gigs').select('id, title').in('id', gigIds);
      (gigs ?? []).forEach((g: any) => { gigMap[g.id] = g.title; });
    }

    const enriched: Conversation[] = (convData as any[]).map(c => {
      const otherId = gigPoster ? c.artist_id : c.gig_poster_id;
      const other = profileMap[otherId] ?? {};
      const unread = gigPoster ? (c.gig_poster_unread ?? 0) : (c.artist_unread ?? 0);
      return {
        ...c,
        otherUserId: otherId,
        otherUserName: other.full_name ?? other.username ?? null,
        otherUserUsername: other.username ?? null,
        otherUserAvatar: other.profile_photo_url ?? null,
        gigTitle: c.gig_id ? (gigMap[c.gig_id] ?? null) : null,
        unread,
      };
    });

    setConversations(enriched);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const openConversation = (conv: Conversation) => {
    navigation.navigate('Conversation', {
      conversationId: conv.id,
      otherUserId: conv.otherUserId,
      otherUserName: conv.otherUserName,
      otherUserUsername: conv.otherUserUsername,
      otherUserAvatar: conv.otherUserAvatar,
      gigId: conv.gig_id,
      gigTitle: conv.gigTitle,
    });
  };

  const renderItem = ({ item }: { item: Conversation }) => {
    const preview = item.last_message
      ? (item.last_message.length > 50
        ? item.last_message.slice(0, 50).toUpperCase() + '...'
        : item.last_message.toUpperCase())
      : 'NO MESSAGES YET';

    return (
      <TouchableOpacity style={s.row} onPress={() => openConversation(item)} activeOpacity={0.8}>
        <OctagonalImage size={36} imageUri={item.otherUserAvatar} />
        <View style={s.rowInfo}>
          {item.gigTitle ? (
            <Text style={s.gigLabel} numberOfLines={1}>RE: {item.gigTitle.toUpperCase()}</Text>
          ) : null}
          <Text style={s.otherName} numberOfLines={1}>
            {(item.otherUserName ?? 'UNKNOWN').toUpperCase()}
          </Text>
          {item.otherUserUsername ? (
            <Text style={s.otherHandle}>@{item.otherUserUsername.toUpperCase()}</Text>
          ) : null}
          <Text style={s.preview} numberOfLines={1}>{preview}</Text>
        </View>
        <View style={s.rowRight}>
          {item.last_message_at ? (
            <Text style={s.timestamp}>{timeAgo(item.last_message_at)}</Text>
          ) : null}
          {item.unread > 0 ? (
            <View style={s.badge}>
              <Text style={s.badgeText}>{item.unread > 9 ? '9+' : item.unread}</Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>MESSAGES</Text>
        <OctagonalImage
          size={24}
          imageUri={currentUserAvatar}
          onPress={() => navigation.navigate('Profile')}
        />
      </View>

      {loading ? (
        <View>
          {[1, 2, 3].map(i => <View key={i} style={s.skeletonRow} />)}
        </View>
      ) : conversations.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>NO MESSAGES YET</Text>
          <Text style={s.emptySub}>
            {isGigPoster
              ? 'MESSAGE ARTISTS FROM THE GIGS TAB'
              : 'GIG POSTERS WILL CONTACT YOU HERE'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={<View style={{ height: 40 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { marginRight: 12, padding: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 60,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    gap: 12,
  },
  rowInfo: { flex: 1 },
  gigLabel: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.12, marginBottom: 2 },
  otherName: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.12, marginBottom: 2 },
  otherHandle: { color: colors.red, fontFamily: MONO, fontSize: 7, letterSpacing: 0.12, marginBottom: 3 },
  preview: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.06 },

  rowRight: { alignItems: 'flex-end', gap: 6 },
  timestamp: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.1 },
  badge: {
    backgroundColor: colors.red, borderRadius: 7,
    minWidth: 14, height: 14,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: colors.white, fontFamily: MONO, fontSize: 7 },

  skeletonRow: {
    height: 60, backgroundColor: '#0a0a0a',
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3 },
  emptySub: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.12, textAlign: 'center' },
});
