import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

type Mode = 'followers' | 'following';

interface FollowArtist {
  id: string;
  username: string | null;
  full_name: string | null;
  discipline: string | null;
  art_type: string | null;
  art_types: string[] | null;
  profile_photo_url: string | null;
  city: string | null;
  country: string | null;
  is_verified: boolean;
}

function FollowRow({ artist, onPress }: { artist: FollowArtist; onPress: () => void }) {
  const name = (artist.full_name ?? artist.username ?? 'UNKNOWN').toUpperCase();
  const discipline = (artist.discipline ?? artist.art_type ?? '').toUpperCase();
  const tags = (artist.art_types ?? []).slice(0, 2).join(' · ').toUpperCase();
  const location = [artist.city, artist.country].filter(Boolean).join(', ').toUpperCase();

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
      <OctagonalImage size={48} imageUri={artist.profile_photo_url} />
      <View style={s.rowInfo}>
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
          {artist.is_verified ? <Ionicons name="checkmark-circle" size={12} color="#f6c55a" /> : null}
        </View>
        {discipline ? <Text style={s.discipline} numberOfLines={1}>{discipline}</Text> : null}
        {tags ? <Text style={s.tags} numberOfLines={1}>TAGS · {tags}</Text> : null}
        {location ? <Text style={s.location} numberOfLines={1}>{location}</Text> : null}
      </View>
      <Text style={s.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function FollowListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode: Mode = route.params?.mode === 'followers' ? 'followers' : 'following';
  const sourceUserId: string | null = route.params?.userId ?? null;
  const title = route.params?.title ?? (mode === 'followers' ? 'FOLLOWERS' : 'FOLLOWING');

  const [artists, setArtists] = useState<FollowArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const emptyTitle = useMemo(
    () => (mode === 'followers' ? 'NO FOLLOWERS YET' : 'NOT FOLLOWING ANYONE YET'),
    [mode]
  );

  const loadData = useCallback(async () => {
    if (!sourceUserId) {
      setArtists([]);
      setLoading(false);
      return;
    }

    const query = mode === 'followers'
      ? supabase.from('follows').select('follower_id, created_at').eq('following_id', sourceUserId)
      : supabase.from('follows').select('following_id, created_at').eq('follower_id', sourceUserId);

    const { data } = await query.order('created_at', { ascending: false });

    const ids = (data ?? []).map((row: any) =>
      mode === 'followers' ? row.follower_id as string : row.following_id as string
    );

    if (ids.length === 0) {
      setArtists([]);
      setLoading(false);
      return;
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, discipline, art_type, art_types, profile_photo_url, city, country, is_verified')
      .in('id', ids);

    const profileMap = new Map(
      ((profiles ?? []) as FollowArtist[]).map((artist) => [artist.id, artist])
    );

    const sorted = ids.map((id) => profileMap.get(id)).filter(Boolean) as FollowArtist[];
    setArtists(sorted);
    setLoading(false);
  }, [mode, sourceUserId]);

  useFocusEffect(useCallback(() => {
    void loadData();
  }, [loadData]));

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle}>{title}</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>{title}</Text>
        <Text style={s.topBarCount}>{artists.length}</Text>
      </View>

      {artists.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="people-outline" size={32} color="#222222" />
          <Text style={s.emptyTitle}>{emptyTitle}</Text>
          <Text style={s.emptyText}>ARTIST CONNECTIONS WILL SHOW UP HERE.</Text>
        </View>
      ) : (
        <FlatList
          data={artists}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await loadData();
                setRefreshing(false);
              }}
              tintColor={colors.white}
            />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <FollowRow
              artist={item}
              onPress={() => navigation.navigate('ArtistProfile', { userId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: { flex: 1, textAlign: 'center', color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarCount: { width: 32, textAlign: 'right', color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  name: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, flexShrink: 1 },
  discipline: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, marginBottom: 3 },
  tags: { color: '#8d8d8d', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1, marginBottom: 3 },
  location: { color: '#9a9a9a', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1 },
  rowArrow: { color: '#8f8f8f', fontFamily: MONO, fontSize: 18 },
  separator: { height: 1, backgroundColor: '#111111' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2, textAlign: 'center' },
  emptyText: { color: '#8f8f8f', fontFamily: MONO, fontSize: 8, letterSpacing: 0.12, textAlign: 'center', lineHeight: 14 },
});
