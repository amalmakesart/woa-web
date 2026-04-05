import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { useUnread } from '../../contexts/UnreadContext';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

type NotifType =
  | 'new_message'
  | 'new_follower'
  | 'post_liked'
  | 'post_comment'
  | 'gig_interest'
  | 'gig_nearby';

interface Notif {
  id: string;
  user_id: string;
  type: NotifType;
  actor_id: string | null;
  reference_id: string | null;
  reference_type: string | null;
  preview_text: string | null;
  is_read: boolean;
  created_at: string;
  // enriched
  actorName: string | null;
  actorUsername: string | null;
  actorAvatar: string | null;
  gigTitle: string | null;
}

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

function notifText(n: Notif): { main: string; sub: string | null } {
  const handle = n.actorUsername
    ? `@${n.actorUsername.toUpperCase()}`
    : n.actorName?.toUpperCase() ?? 'SOMEONE';

  switch (n.type) {
    case 'new_message':
      return {
        main: `${handle} SENT YOU A MESSAGE`,
        sub: n.preview_text ?? null,
      };
    case 'new_follower':
      return {
        main: `${handle} STARTED FOLLOWING YOU`,
        sub: null,
      };
    case 'post_liked':
      return {
        main: `${handle} LIKED YOUR POST`,
        sub: n.preview_text ?? null,
      };
    case 'post_comment':
      return {
        main: `${handle} COMMENTED ON YOUR POST`,
        sub: n.preview_text ?? null,
      };
    case 'gig_interest':
      return {
        main: `${handle} EXPRESSED INTEREST IN YOUR GIG`,
        sub: n.gigTitle ?? n.preview_text ?? null,
      };
    case 'gig_nearby':
      return {
        main: 'NEW GIG POSTED NEAR YOU',
        sub: n.gigTitle ?? n.preview_text ?? null,
      };
    default:
      return { main: 'NEW NOTIFICATION', sub: null };
  }
}

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const { refreshNotifications } = useUnread();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: me } = await supabase
      .from('profiles').select('profile_photo_url').eq('id', user.id).single();
    setCurrentUserAvatar((me as any)?.profile_photo_url ?? null);

    const { data: raw } = await supabase
      .from('notifications')
      .select('id, user_id, type, actor_id, reference_id, reference_type, preview_text, is_read, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(60);

    if (!raw || raw.length === 0) { setNotifs([]); setLoading(false); return; }

    // Fetch actor profiles
    const actorIds = [...new Set((raw as any[]).filter(n => n.actor_id).map((n: any) => n.actor_id))];
    const profileMap: Record<string, any> = {};
    if (actorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, profile_photo_url')
        .in('id', actorIds);
      (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });
    }

    // Fetch gig titles for gig notifications
    const gigIds = [...new Set(
      (raw as any[])
        .filter(n => (n.type === 'gig_interest' || n.type === 'gig_nearby') && n.reference_id)
        .map((n: any) => n.reference_id)
    )];
    const gigMap: Record<string, string> = {};
    if (gigIds.length > 0) {
      const { data: gigs } = await supabase
        .from('gigs').select('id, title').in('id', gigIds);
      (gigs ?? []).forEach((g: any) => { gigMap[g.id] = g.title; });
    }

    const enriched: Notif[] = (raw as any[]).map(n => {
      const actor = n.actor_id ? profileMap[n.actor_id] : null;
      return {
        ...n,
        actorName: actor?.full_name ?? actor?.username ?? null,
        actorUsername: actor?.username ?? null,
        actorAvatar: actor?.profile_photo_url ?? null,
        gigTitle: (n.reference_id && gigMap[n.reference_id]) ? gigMap[n.reference_id] : null,
      };
    });

    setNotifs(enriched);
    setLoading(false);
  }, []);

  const markAllRead = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    refreshNotifications();
  }, [refreshNotifications]);

  useFocusEffect(useCallback(() => {
    loadData();
    // Mark all as read when screen opens
    const markTimer = setTimeout(() => markAllRead(), 800);
    return () => clearTimeout(markTimer);
  }, [loadData, markAllRead]));

  const handleTap = (n: Notif) => {
    switch (n.type) {
      case 'new_message':
        navigation.navigate('Inbox');
        break;
      case 'new_follower':
        if (n.actor_id) navigation.navigate('ArtistProfile', { userId: n.actor_id });
        break;
      case 'post_liked':
      case 'post_comment':
        if (n.reference_id) navigation.navigate('PostDetail', { postId: n.reference_id });
        break;
      case 'gig_interest':
        if (n.reference_id) {
          navigation.navigate('GigDetail', { gigId: n.reference_id });
        }
        break;
      case 'gig_nearby':
        if (n.reference_id) navigation.navigate('GigDetail', { gigId: n.reference_id });
        break;
    }
  };

  const renderItem = ({ item }: { item: Notif }) => {
    const { main, sub } = notifText(item);
    const parts = main.split(/(@\w+)/g);

    return (
      <TouchableOpacity
        style={[s.row, !item.is_read && s.rowUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.8}
      >
        {!item.is_read && <View style={s.unreadDot} />}
        <OctagonalImage size={32} imageUri={item.actorAvatar} />
        <View style={s.rowInfo}>
          <Text style={s.mainText}>
            {parts.map((part, i) =>
              part.startsWith('@')
                ? <Text key={i} style={s.handleText}>{part}</Text>
                : <Text key={i}>{part}</Text>
            )}
          </Text>
          {sub ? (
            <Text style={s.subText} numberOfLines={1}>
              {sub.slice(0, 40).toUpperCase()}
            </Text>
          ) : null}
        </View>
        <Text style={s.timestamp}>{timeAgo(item.created_at)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>NOTIFICATIONS</Text>
        <TouchableOpacity onPress={markAllRead} activeOpacity={0.7}>
          <Text style={s.markAllRead}>MARK ALL READ</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      ) : notifs.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="notifications-outline" size={32} color="#222222" />
          <Text style={s.emptyTitle}>NO NOTIFICATIONS YET</Text>
          <Text style={s.emptySub}>ACTIVITY WILL APPEAR HERE</Text>
        </View>
      ) : (
        <FlatList
          data={notifs}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { marginRight: 10, padding: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  markAllRead: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.15 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    minHeight: 52,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
    gap: 10,
    backgroundColor: colors.black,
  },
  rowUnread: { backgroundColor: '#080808' },
  unreadDot: {
    width: 4, height: 4, borderRadius: 2,
    backgroundColor: '#c0392b',
    position: 'absolute', left: 6,
  },
  rowInfo: { flex: 1 },
  mainText: {
    color: '#666666',
    fontFamily: MONO, fontSize: 8,
    letterSpacing: 0.1, lineHeight: 13,
  },
  handleText: { color: colors.white },
  subText: {
    color: '#444444', fontFamily: MONO,
    fontSize: 6, letterSpacing: 0.08, marginTop: 3,
  },
  timestamp: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.1 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3 },
  emptySub: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.12 },
});
