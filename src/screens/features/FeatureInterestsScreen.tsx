import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface InterestedArtist {
  id: string;
  user_id: string;
  created_at: string;
  profile: {
    username: string | null;
    full_name: string | null;
    profile_photo_url: string | null;
    discipline: string | null;
    city: string | null;
    country: string | null;
    is_verified: boolean;
    follower_count: number | null;
  } | null;
}

export default function FeatureInterestsScreen() {
  const navigation = useNavigation<any>();
  const [artists, setArtists] = useState<InterestedArtist[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInterests = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('feature_interests')
      .select('id, user_id, created_at')
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      setArtists([]);
      setLoading(false);
      return;
    }

    const userIds = data.map((r: any) => r.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, full_name, profile_photo_url, discipline, city, country, is_verified, follower_count')
      .in('id', userIds);

    const profileMap: Record<string, any> = {};
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = p; });

    const merged: InterestedArtist[] = data.map((r: any) => ({
      ...r,
      profile: profileMap[r.user_id] ?? null,
    }));

    merged.sort((a, b) => {
      const cityA = a.profile?.city ?? a.profile?.country ?? 'ZZZ';
      const cityB = b.profile?.city ?? b.profile?.country ?? 'ZZZ';
      return cityA.localeCompare(cityB);
    });

    setArtists(merged);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadInterests(); }, [loadInterests]));

  const renderItem = ({ item, index }: { item: InterestedArtist; index: number }) => {
    const p = item.profile;
    const name = p?.username ? `@${p.username}` : (p?.full_name ?? 'UNKNOWN');
    const location = [p?.city, p?.country].filter(Boolean).join(', ');
    const registeredDate = new Date(item.created_at).toLocaleDateString('en-CA', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={s.row}
        onPress={() => navigation.navigate('ArtistProfile', { userId: item.user_id })}
        activeOpacity={0.8}
      >
        <Text style={s.indexNum}>{String(index + 1).padStart(2, '0')}</Text>
        <OctagonalImage size={42} imageUri={p?.profile_photo_url ?? null} />
        <View style={s.info}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{name.toUpperCase()}</Text>
            {p?.is_verified && <Text style={s.verified}>✓</Text>}
          </View>
          <Text style={s.discipline} numberOfLines={1}>
            {p?.discipline?.toUpperCase() ?? '—'}
          </Text>
          <Text style={s.location} numberOfLines={1}>
            {location ? location.toUpperCase() : 'NO LOCATION SET'}
          </Text>
        </View>
        <View style={s.meta}>
          <Text style={s.followers}>{p?.follower_count ?? 0}</Text>
          <Text style={s.followersLabel}>FOLLOWERS</Text>
          <Text style={s.date}>{registeredDate.toUpperCase()}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>FEATURE INTERESTS</Text>
        <View style={s.countBadge}>
          <Text style={s.countText}>{artists.length}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loader}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : artists.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyText}>NO ARTISTS HAVE EXPRESSED INTEREST YET</Text>
        </View>
      ) : (
        <>
          <View style={s.sortNote}>
            <Text style={s.sortNoteText}>SORTED BY CITY — {artists.length} ARTIST{artists.length !== 1 ? 'S' : ''}</Text>
          </View>
          <FlatList
            data={artists}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={<View style={{ height: 40 }} />}
          />
        </>
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
    gap: 10,
  },
  backBtn: { paddingRight: 4 },
  backText: { color: colors.white, fontFamily: MONO, fontSize: 22, lineHeight: 24 },
  title: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  countBadge: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  countText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },

  sortNote: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  sortNoteText: { color: '#555555', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
    gap: 12,
  },
  indexNum: { color: '#333333', fontFamily: MONO, fontSize: 10, width: 20, letterSpacing: 0.1 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  name: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12, flexShrink: 1 },
  verified: { color: '#f6c55a', fontFamily: MONO, fontSize: 10 },
  discipline: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, marginBottom: 2 },
  location: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },

  meta: { alignItems: 'flex-end', gap: 2 },
  followers: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1 },
  followersLabel: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.1 },
  date: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1, marginTop: 4 },

  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#333333', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
});
