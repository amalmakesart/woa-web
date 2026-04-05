import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { findOrCreateConversation } from '../../lib/messaging';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface Interest {
  id: string;
  artist_id: string;
  suggested_fee: number | null;
  note: string | null;
  created_at: string;
  // merged
  full_name: string | null;
  username: string | null;
  profile_photo_url: string | null;
  art_type: string | null;
  city: string | null;
}

export default function InterestedArtistsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { gigId, gigTitle } = route.params;

  const [interests, setInterests] = useState<Interest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [messagingArtistId, setMessagingArtistId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data: me } = await supabase
        .from('profiles')
        .select('profile_photo_url')
        .eq('id', user.id)
        .single();
      if (me) setCurrentUserAvatar((me as any).profile_photo_url ?? null);
    }

    const { data: interestData } = await supabase
      .from('gig_interests')
      .select('id, artist_id, suggested_fee, note, created_at')
      .eq('gig_id', gigId)
      .order('created_at', { ascending: false });

    if (!interestData || interestData.length === 0) {
      setInterests([]);
      setLoading(false);
      return;
    }

    const artistIds = interestData.map((i: any) => i.artist_id);
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_photo_url, art_type, city')
      .in('id', artistIds);

    const profileMap: Record<string, any> = {};
    (profilesData ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    const merged: Interest[] = interestData.map((i: any) => {
      const p = profileMap[i.artist_id] ?? {};
      return {
        ...i,
        full_name: p.full_name ?? null,
        username: p.username ?? null,
        profile_photo_url: p.profile_photo_url ?? null,
        art_type: p.art_type ?? null,
        city: p.city ?? null,
      };
    });

    setInterests(merged);
    setLoading(false);
  }, [gigId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleMessage = async (item: Interest) => {
    if (!currentUserId) return;
    setMessagingArtistId(item.artist_id);
    const convId = await findOrCreateConversation(currentUserId, item.artist_id, gigId);
    setMessagingArtistId(null);
    if (!convId) { Alert.alert('ERROR', 'Could not open conversation.'); return; }
    navigation.navigate('Conversation', {
      conversationId: convId,
      otherUserId: item.artist_id,
      otherUserName: item.full_name ?? item.username,
      otherUserUsername: item.username,
      otherUserAvatar: item.profile_photo_url,
      gigId,
      gigTitle,
    });
  };

  const renderItem = ({ item }: { item: Interest }) => {
    const displayName = (item.full_name ?? item.username ?? 'UNKNOWN').toUpperCase();
    const feeStr = item.suggested_fee != null ? `$${item.suggested_fee}` : 'TBD';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => navigation.navigate('ArtistProfile', { userId: item.artist_id })}
        activeOpacity={0.8}
      >
        <OctagonalImage size={36} imageUri={item.profile_photo_url} />

        <View style={styles.rowInfo}>
          <Text style={styles.artistName} numberOfLines={1}>{displayName}</Text>
          <View style={styles.metaRow}>
            {item.art_type ? (
              <Text style={styles.artType}>{item.art_type.toUpperCase()}</Text>
            ) : null}
            {item.city ? (
              <Text style={styles.city}>{item.city.toUpperCase()}</Text>
            ) : null}
          </View>
          {item.note ? (
            <Text style={styles.notePreview} numberOfLines={2}>
              "{item.note.toUpperCase()}"
            </Text>
          ) : null}
        </View>

        <View style={styles.rowRight}>
          <Text style={styles.fee}>{feeStr}</Text>
          <Text style={styles.feeLabel}>FEE</Text>
          <TouchableOpacity
            style={[styles.messageBtn, messagingArtistId === item.artist_id && styles.messageBtnBusy]}
            onPress={() => handleMessage(item)}
            disabled={messagingArtistId === item.artist_id}
            activeOpacity={0.7}
          >
            <Text style={styles.messageBtnText}>
              {messagingArtistId === item.artist_id ? '...' : 'MESSAGE ›'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>MY GIGS</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <View style={styles.notifDot} />
          <OctagonalImage size={24} imageUri={currentUserAvatar} />
        </View>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>INTERESTED ARTISTS</Text>
        {gigTitle ? (
          <Text style={styles.headerSub} numberOfLines={1}>{gigTitle.toUpperCase()}</Text>
        ) : null}
        {!loading && (
          <Text style={styles.headerCount}>{interests.length} APPLICANT{interests.length !== 1 ? 'S' : ''}</Text>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : interests.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>NO ARTISTS YET</Text>
          <Text style={styles.emptySubText}>CHECK BACK SOON</Text>
        </View>
      ) : (
        <FlatList
          data={interests}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },

  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  headerTitle: {
    color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.3,
  },
  headerSub: {
    color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.12, marginTop: 4,
  },
  headerCount: {
    color: colors.red, fontFamily: MONO, fontSize: 7, letterSpacing: 0.15, marginTop: 6,
  },

  row: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    gap: 12,
  },
  rowInfo: { flex: 1 },
  artistName: {
    color: colors.white, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15, marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  artType: { color: colors.red, fontFamily: MONO, fontSize: 6, letterSpacing: 0.12 },
  city: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.1 },
  notePreview: {
    color: '#555555', fontFamily: MONO, fontSize: 6, letterSpacing: 0.08, lineHeight: 10,
    fontStyle: 'italic',
  },

  rowRight: { alignItems: 'flex-end', justifyContent: 'flex-start', gap: 4, minWidth: 70 },
  fee: { color: colors.red, fontFamily: MONO, fontSize: 14, letterSpacing: 0.1 },
  feeLabel: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.12 },
  messageBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 8, paddingVertical: 5, marginTop: 6,
  },
  messageBtnBusy: { borderColor: '#333333' },
  messageBtnText: { color: colors.red, fontFamily: MONO, fontSize: 6, letterSpacing: 0.15 },

  emptyText: {
    color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, marginBottom: 6,
  },
  emptySubText: {
    color: '#2a2a2a', fontFamily: MONO, fontSize: 7, letterSpacing: 0.15,
  },
});
