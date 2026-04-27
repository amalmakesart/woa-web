import React, { useCallback, useState } from 'react';
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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface FollowedArtist {
  id: string;
  username: string | null;
  full_name: string | null;
  discipline: string | null;
  art_type: string | null;
  art_types: string[] | null;
  profile_photo_url: string | null;
  city: string | null;
  country: string | null;
  is_available: boolean;
  is_verified: boolean;
}

function FollowingRow({
  artist,
  onPress,
  onUnfollow,
}: {
  artist: FollowedArtist;
  onPress: () => void;
  onUnfollow: () => void;
}) {
  const name = (artist.full_name ?? artist.username ?? 'UNKNOWN').toUpperCase();
  const discipline = (artist.discipline ?? artist.art_type ?? '').toUpperCase();
  const tags = (artist.art_types ?? []).slice(0, 2).join(' · ').toUpperCase();
  const location = [artist.city, artist.country].filter(Boolean).join(', ').toUpperCase();

  return (
    <View style={s.row}>
      <TouchableOpacity style={s.rowMain} onPress={onPress} activeOpacity={0.8}>
        <OctagonalImage size={52} imageUri={artist.profile_photo_url} />
        <View style={s.rowInfo}>
          <View style={s.nameRow}>
            <Text style={s.name} numberOfLines={1}>{name}</Text>
            {artist.is_verified ? (
              <Ionicons name="checkmark-circle" size={12} color="#f6c55a" />
            ) : null}
          </View>
          {discipline ? <Text style={s.discipline} numberOfLines={1}>{discipline}</Text> : null}
          {tags ? <Text style={s.tags} numberOfLines={1}>TAGS · {tags}</Text> : null}
          {location ? <Text style={s.location} numberOfLines={1}>{location}</Text> : null}
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={s.followingPill} onPress={onUnfollow} activeOpacity={0.7}>
        <Text style={s.followingPillText}>FOLLOWING</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function FollowingScreen() {
  const navigation = useNavigation<any>();
  const [artists, setArtists] = useState<FollowedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFollowing = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setArtists([]);
      setLoading(false);
      return;
    }

    const { data: followRows } = await supabase
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', user.id)
      .order('created_at', { ascending: false });

    if (!followRows || followRows.length === 0) {
      setArtists([]);
      setLoading(false);
      return;
    }

    const followedIds = followRows.map((row: any) => row.following_id as string);
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, full_name, discipline, art_type, art_types, profile_photo_url, city, country, is_available, is_verified')
      .in('id', followedIds);

    const profilesById = new Map(
      ((profileRows ?? []) as FollowedArtist[]).map((artist) => [artist.id, artist])
    );

    const sortedArtists = followedIds
      .map((id) => profilesById.get(id))
      .filter(Boolean) as FollowedArtist[];

    setArtists(sortedArtists);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void loadFollowing();
  }, [loadFollowing]));

  const handleUnfollow = async (artistId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setArtists((prev) => prev.filter((artist) => artist.id !== artistId));
    await supabase
      .from('follows')
      .delete()
      .match({ follower_id: user.id, following_id: artistId });
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle}>FOLLOWING</Text>
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
        <Text style={s.topBarTitle}>FOLLOWING</Text>
        <Text style={s.topBarCount}>{artists.length}</Text>
      </View>

      {artists.length === 0 ? (
        <View style={s.emptyWrap}>
          <Ionicons name="people-outline" size={32} color="#222222" />
          <Text style={s.emptyTitle}>YOU AREN'T FOLLOWING ANYONE YET</Text>
          <Text style={s.emptyText}>FOLLOW ARTISTS YOU WANT TO KEEP AN EYE ON FROM THEIR PROFILE.</Text>
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
                await loadFollowing();
                setRefreshing(false);
              }}
              tintColor={colors.white}
            />
          }
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <FollowingRow
              artist={item}
              onPress={() => navigation.navigate('ArtistProfile', { userId: item.id })}
              onUnfollow={() => handleUnfollow(item.id)}
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
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.18,
  },
  topBarCount: {
    width: 32,
    textAlign: 'right',
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  name: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.12,
    flexShrink: 1,
  },
  discipline: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.1,
    marginBottom: 3,
  },
  tags: {
    color: '#8d8d8d',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.1,
    marginBottom: 3,
  },
  location: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.1,
  },
  followingPill: {
    borderWidth: 1,
    borderColor: '#2b2b2b',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  followingPillText: {
    color: '#bbbbbb',
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.16,
  },
  separator: { height: 1, backgroundColor: '#111111' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  emptyText: {
    color: '#8f8f8f',
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.12,
    textAlign: 'center',
    lineHeight: 14,
  },
});
