import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, SafeAreaView, Image, RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const ADMIN_EMAIL = 'amalmakesart@gmail.com';

export interface Feature {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  video_url: string | null;
  duration: string | null;
  artist_id: string | null;
  created_at: string;
}

function PlayCircle({ size }: { size: number }) {
  return (
    <View style={[pc.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <View style={[pc.triangle, {
        borderLeftWidth: size * 0.3,
        borderTopWidth: size * 0.2,
        borderBottomWidth: size * 0.2,
      }]} />
    </View>
  );
}

const pc = StyleSheet.create({
  circle: { borderWidth: 1.5, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  triangle: {
    borderTopColor: 'transparent', borderBottomColor: 'transparent',
    borderLeftColor: colors.red, marginLeft: 3,
  },
});

export default function FeaturesScreen() {
  const navigation = useNavigation<any>();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setIsAdmin(user.email === ADMIN_EMAIL);
      const { data: me } = await supabase
        .from('profiles').select('profile_photo_url').eq('id', user.id).single();
      if (me) setAvatarUri((me as any).profile_photo_url ?? null);
    }

    const { data } = await supabase
      .from('features')
      .select('id, title, description, thumbnail_url, video_url, duration, artist_id, created_at')
      .order('created_at', { ascending: false });

    setFeatures((data as Feature[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const goToFeature = (feature: Feature) => {
    navigation.navigate('FilmDetail', { feature });
  };

  const latest = features[0] ?? null;
  const rest = features.slice(1);
  const totalCount = features.length;

  const renderEpisode = ({ item, index }: { item: Feature; index: number }) => {
    const epNum = totalCount - (index + 1);
    return (
      <TouchableOpacity style={s.episodeRow} onPress={() => goToFeature(item)} activeOpacity={0.8}>
        {item.thumbnail_url ? (
          <Image source={{ uri: item.thumbnail_url }} style={s.thumbnail} resizeMode="cover" />
        ) : (
          <View style={[s.thumbnail, s.thumbnailPlaceholder]}>
            <Text style={s.thumbPlaceholderText}>▷</Text>
          </View>
        )}
        <View style={s.episodeInfo}>
          <Text style={s.epNumber}>EP. {epNum}</Text>
          <Text style={s.epTitle} numberOfLines={2}>{item.title.toUpperCase()}</Text>
          {item.duration ? <Text style={s.epMeta}>{item.duration.toUpperCase()}</Text> : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <MiniLogo />
        <Text style={s.topBarTitle}>FEATURES</Text>
        <View style={s.topBarRight}>
          {isAdmin && (
            <TouchableOpacity
              onPress={() => navigation.navigate('AddFeature')}
              style={s.addBtn}
              activeOpacity={0.7}
            >
              <Text style={s.addBtnText}>+</Text>
            </TouchableOpacity>
          )}
          <BellButton onPress={() => navigation.navigate('Notifications')} />
          <OctagonalImage size={24} imageUri={avatarUri} onPress={() => navigation.navigate('Profile')} />
        </View>
      </View>

      {loading ? (
        <View>
          {[1, 2, 3].map(i => <View key={i} style={s.skeletonRow} />)}
        </View>
      ) : features.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>COMING SOON</Text>
          <Text style={s.emptySub}>WE ARE SCOUTING ARTISTS AROUND THE WORLD</Text>
          <View style={s.logoMark}>
            <Text style={s.logoText}>WORK(ER){'\n'}OF ART ●</Text>
          </View>
        </View>
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.id}
          renderItem={renderEpisode}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.white} />
          }
          ListHeaderComponent={latest ? (
            <TouchableOpacity style={s.hero} onPress={() => goToFeature(latest)} activeOpacity={0.85}>
              {latest.thumbnail_url ? (
                <Image source={{ uri: latest.thumbnail_url }} style={s.heroThumb} resizeMode="cover" />
              ) : null}
              <View style={s.heroOverlay}>
                <PlayCircle size={36} />
                <View style={s.heroInfo}>
                  <Text style={s.heroEpLabel}>LATEST — EP. {totalCount}</Text>
                  <Text style={s.heroTitle} numberOfLines={2}>{latest.title.toUpperCase()}</Text>
                  {latest.duration ? <Text style={s.heroDuration}>{latest.duration.toUpperCase()}</Text> : null}
                </View>
              </View>
            </TouchableOpacity>
          ) : null}
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
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18, marginLeft: 10 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },
  addBtn: { borderWidth: 1, borderColor: colors.red, width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { color: colors.red, fontFamily: MONO, fontSize: 16, lineHeight: 20 },

  hero: {
    height: 200, backgroundColor: '#060606',
    borderBottomWidth: 1, borderBottomColor: '#111111', overflow: 'hidden',
  },
  heroThumb: { width: '100%', height: '100%', position: 'absolute' },
  heroOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, gap: 16,
  },
  heroInfo: { flex: 1 },
  heroEpLabel: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15, marginBottom: 6 },
  heroTitle: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.14, lineHeight: 18, marginBottom: 6 },
  heroDuration: { color: '#888888', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },

  episodeRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#0d0d0d', minHeight: 80,
  },
  thumbnail: { width: 110, height: 72 },
  thumbnailPlaceholder: { backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { color: '#333333', fontSize: 18 },
  episodeInfo: { flex: 1, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  epNumber: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15, marginBottom: 3 },
  epTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 15, marginBottom: 5 },
  epMeta: { color: '#444444', fontFamily: MONO, fontSize: 8 },

  skeletonRow: { height: 72, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#111111' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3, textAlign: 'center' },
  emptySub: { color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.12, textAlign: 'center' },
  logoMark: { borderWidth: 1, borderColor: '#222222', padding: 14, marginTop: 16 },
  logoText: { color: '#222222', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, textAlign: 'center', lineHeight: 16 },
});
