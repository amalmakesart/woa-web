import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, SafeAreaView, Image, RefreshControl, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';
import MessageButton from '../../components/MessageButton';

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
  artist: LinkedArtist | null;
}

interface LinkedArtist {
  id: string;
  username: string | null;
  full_name: string | null;
  profile_photo_url: string | null;
  art_type: string | null;
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

const FIRST_FEATURE = new Date('2026-07-10T00:00:00');

function getTimeLeft() {
  const diff = FIRST_FEATURE.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function ComingSoon({
  isVerified,
  hasExpressedInterest,
  showInterestButton,
  onExpressInterest,
}: {
  isVerified: boolean;
  hasExpressedInterest: boolean;
  showInterestButton: boolean;
  onExpressInterest: () => void;
}) {
  const [time, setTime] = useState(getTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const STEPS = [
    { n: '01', label: 'WE TRAVEL', body: 'THE WOA CREW TRAVELS FROM VANCOUVER TO HALIFAX, FINDING ARTISTS IN EVERY CANADIAN CITY THROUGH THIS APP.' },
    { n: '02', label: 'WE FIND YOU', body: 'ONE ARTIST PER CITY IS SELECTED. ONLY VERIFIED WOA ARTISTS ARE ELIGIBLE TO BE CHOSEN.' },
    { n: '03', label: 'WE FILM', body: 'A SHORT DOCUMENTARY IS MADE ABOUT YOU — YOUR WORK, YOUR PRACTICE, YOUR CITY.' },
    { n: '04', label: 'WE PUBLISH', body: 'YOUR FILM LIVES HERE IN THE FEATURES TAB, PERMANENTLY. A RECORD OF YOUR WORK FOR THE WORLD TO FIND.' },
    { n: '05', label: 'THE REWARD', body: 'YOU RECEIVE THE WOA FEATURE BADGE AND ARE RECOMMENDED TO VENUES AND ARTS ORGANIZATIONS ACROSS CANADA.' },
  ];

  return (
    <View style={cs.container}>
      <View style={cs.missionBlock}>
        <Text style={cs.missionText}>FINDING TALENT IS OUR MISSION</Text>
      </View>

      <View style={cs.stepsBlock}>
        {STEPS.map(step => (
          <View key={step.n} style={cs.step}>
            <View style={cs.stepLeft}>
              <Text style={cs.stepNumber}>{step.n}</Text>
              <View style={cs.stepLine} />
            </View>
            <View style={cs.stepRight}>
              <Text style={cs.stepLabel}>{step.label}</Text>
              <Text style={cs.stepBody}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={cs.countdownBlock}>
        <Text style={cs.countdownKicker}>FIRST FEATURE DROPS IN</Text>
        <View style={cs.clockRow}>
          <View style={cs.clockUnit}>
            <Text style={cs.clockNum}>{pad(time.days)}</Text>
            <Text style={cs.clockLabel}>DAYS</Text>
          </View>
          <Text style={cs.clockSep}>:</Text>
          <View style={cs.clockUnit}>
            <Text style={cs.clockNum}>{pad(time.hours)}</Text>
            <Text style={cs.clockLabel}>HRS</Text>
          </View>
          <Text style={cs.clockSep}>:</Text>
          <View style={cs.clockUnit}>
            <Text style={cs.clockNum}>{pad(time.minutes)}</Text>
            <Text style={cs.clockLabel}>MIN</Text>
          </View>
          <Text style={cs.clockSep}>:</Text>
          <View style={cs.clockUnit}>
            <Text style={cs.clockNum}>{pad(time.seconds)}</Text>
            <Text style={cs.clockLabel}>SEC</Text>
          </View>
        </View>
        <Text style={cs.countdownDate}>JULY 10, 2026 — VANCOUVER ISLAND, BC</Text>
      </View>

      <View style={cs.ctaBlock}>
        {hasExpressedInterest ? (
          <>
            <View style={cs.registeredBadge}>
              <Text style={cs.registeredText}>✓ INTEREST REGISTERED</Text>
            </View>
            <Text style={cs.ctaSub}>WE WILL REACH OUT IF YOU ARE SELECTED FOR YOUR CITY</Text>
          </>
        ) : showInterestButton ? (
          <>
            <Text style={[cs.ctaSub, { marginBottom: 14 }]}>
              {isVerified
                ? 'YOU ARE VERIFIED AND ELIGIBLE TO BE FEATURED'
                : 'REGISTER YOUR INTEREST NOW. VERIFIED ARTISTS ARE ELIGIBLE TO BE SELECTED.'}
            </Text>
            <TouchableOpacity style={cs.expressBtn} onPress={onExpressInterest} activeOpacity={0.8}>
              <Text style={cs.expressBtnText}>EXPRESS INTEREST</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={cs.ctaText}>ONLY ARTISTS CAN EXPRESS INTEREST</Text>
            <Text style={cs.ctaSub}>GET VERIFIED THROUGH YOUR PROFILE SETTINGS</Text>
          </>
        )}
      </View>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1 },

  missionBlock: {
    borderBottomWidth: 1, borderBottomColor: '#111111',
    paddingHorizontal: 20, paddingVertical: 24,
  },
  missionKicker: {
    color: colors.red, fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.3, marginBottom: 10,
  },
  missionText: {
    color: colors.white, fontFamily: MONO, fontSize: 13,
    letterSpacing: 0.14, lineHeight: 22,
  },

  stepsBlock: {
    borderBottomWidth: 1, borderBottomColor: '#111111',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  step: {
    flexDirection: 'row', gap: 14, marginBottom: 20,
  },
  stepLeft: { alignItems: 'center', width: 24 },
  stepNumber: {
    color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2,
  },
  stepLine: {
    flex: 1, width: 1, backgroundColor: '#1e1e1e', marginTop: 6,
  },
  stepRight: { flex: 1, paddingBottom: 4 },
  stepLabel: {
    color: colors.white, fontFamily: MONO, fontSize: 11,
    letterSpacing: 0.2, marginBottom: 5,
  },
  stepBody: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10,
    letterSpacing: 0.1, lineHeight: 16,
  },

  countdownBlock: {
    borderBottomWidth: 1, borderBottomColor: '#111111',
    paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center',
  },
  countdownKicker: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.28, marginBottom: 16,
  },
  clockRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  clockUnit: { alignItems: 'center', minWidth: 48 },
  clockNum: {
    color: colors.red, fontFamily: MONO, fontSize: 32,
    letterSpacing: 0.1,
  },
  clockLabel: {
    color: '#555555', fontFamily: MONO, fontSize: 8,
    letterSpacing: 0.2, marginTop: 2,
  },
  clockSep: {
    color: '#333333', fontFamily: MONO, fontSize: 28,
    marginBottom: 12,
  },
  countdownDate: {
    color: '#555555', fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.2, marginTop: 14,
  },

  ctaBlock: {
    paddingHorizontal: 20, paddingVertical: 24, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#111111',
  },
  ctaText: {
    color: colors.white, fontFamily: MONO, fontSize: 10,
    letterSpacing: 0.2, textAlign: 'center',
  },
  ctaSub: {
    color: '#555555', fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.15, marginTop: 6, textAlign: 'center',
  },
  expressBtn: {
    marginTop: 14, borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 28, paddingVertical: 12,
  },
  expressBtnText: {
    color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2,
  },
  registeredBadge: {
    borderWidth: 1, borderColor: '#2a7a4f',
    paddingHorizontal: 20, paddingVertical: 10, marginBottom: 10,
  },
  registeredText: {
    color: '#2a7a4f', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2,
  },
});

export default function FeaturesScreen() {
  const navigation = useNavigation<any>();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [hasExpressedInterest, setHasExpressedInterest] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);

  const loadData = useCallback(async (forceRefresh = false) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setIsAdmin(user.email === ADMIN_EMAIL);
      setCurrentUserId(user.id);
      const [profileRes, interestRes] = await Promise.all([
        supabase.from('profiles').select('profile_photo_url, is_verified, role').eq('id', user.id).single(),
        supabase.from('feature_interests').select('id').eq('user_id', user.id).maybeSingle(),
      ]);
      if (profileRes.data) {
        setAvatarUri((profileRes.data as any).profile_photo_url ?? null);
        setIsVerified((profileRes.data as any).is_verified === true);
        setCurrentRole((profileRes.data as any).role ?? null);
      }
      setHasExpressedInterest(!!interestRes.data);
    }

    const { data } = await supabase
      .from('features')
      .select('id, title, description, thumbnail_url, video_url, duration, artist_id, created_at')
      .order('created_at', { ascending: false });

    const baseFeatures = ((data as Omit<Feature, 'artist'>[]) ?? []).map(feature => ({
      ...feature,
      artist: null,
    }));

    const artistIds = [...new Set(baseFeatures.map(feature => feature.artist_id).filter(Boolean))] as string[];
    if (artistIds.length === 0) {
      setFeatures(baseFeatures);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const { data: artistRows } = await supabase
      .from('profiles')
      .select('id, username, full_name, profile_photo_url, art_type')
      .in('id', artistIds);

    const artistMap: Record<string, LinkedArtist> = {};
    (artistRows ?? []).forEach((artist: any) => {
      artistMap[artist.id] = artist;
    });

    setFeatures(baseFeatures.map(feature => ({
      ...feature,
      artist: feature.artist_id ? artistMap[feature.artist_id] ?? null : null,
    })));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const handleExpressInterest = useCallback(async () => {
    if (!currentUserId) return;
    if (currentRole !== 'ARTIST') {
      Alert.alert('ARTISTS ONLY', 'ONLY ARTIST ACCOUNTS CAN EXPRESS INTEREST TO BE FEATURED.');
      return;
    }
    const { error } = await supabase
      .from('feature_interests')
      .insert({ user_id: currentUserId });
    if (!error || error.code === '23505') setHasExpressedInterest(true);
  }, [currentUserId]);

  const goToFeature = (feature: Feature) => {
    navigation.navigate('FilmDetail', { feature });
  };

  const goToArtist = (artistId: string) => {
    navigation.navigate('ArtistProfile', { userId: artistId });
  };

  const renderArtistBox = (artist: LinkedArtist | null) => {
    if (!artist) return null;

    const displayName = artist.username ? `@${artist.username.toUpperCase()}` : (artist.full_name?.toUpperCase() ?? 'LINKED ARTIST');

    return (
      <TouchableOpacity
        style={s.artistBox}
        onPress={() => goToArtist(artist.id)}
        activeOpacity={0.8}
      >
        <View style={s.artistBoxHeader}>
          <Text style={s.boxKicker}>TAGGED ARTIST</Text>
          <Text style={s.boxArrow}>›</Text>
        </View>
        <View style={s.artistBoxBody}>
          <OctagonalImage size={34} imageUri={artist.profile_photo_url} />
          <View style={s.artistMeta}>
            <Text style={s.artistHandle} numberOfLines={1}>{displayName}</Text>
            {artist.art_type ? (
              <Text style={s.artistType} numberOfLines={1}>{artist.art_type.toUpperCase()}</Text>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFeatureImage = (feature: Feature, large = false) => (
    <View style={[s.mediaFrame, large && s.mediaFrameLarge]}>
      {feature.thumbnail_url ? (
        <Image source={{ uri: feature.thumbnail_url }} style={s.mediaImage} resizeMode="cover" />
      ) : (
        <View style={[s.mediaImage, s.thumbnailPlaceholder]}>
          <Text style={s.thumbPlaceholderText}>▷</Text>
        </View>
      )}
      <View style={s.playFloat}>
        <PlayCircle size={large ? 42 : 34} />
      </View>
    </View>
  );

  const renderInfoBox = (feature: Feature, episodeNumber: number, latestFeature = false) => (
    <View style={[s.infoBox, latestFeature && s.infoBoxLatest]}>
      <View style={s.infoBoxTop}>
        <Text style={s.boxKicker}>{latestFeature ? 'LATEST FEATURE' : 'FEATURE'}</Text>
        <Text style={s.episodeBadge}>EP. {episodeNumber}</Text>
      </View>
      <Text style={s.featureTitle} numberOfLines={2}>{feature.title.toUpperCase()}</Text>
      {feature.duration ? (
        <View style={s.locationLine}>
          <View style={s.locationDot} />
          <Text style={s.locationText} numberOfLines={1}>{feature.duration.toUpperCase()}</Text>
        </View>
      ) : null}
    </View>
  );

  const latest = features[0] ?? null;
  const rest = features.slice(1);
  const totalCount = features.length;

  const renderEpisode = ({ item, index }: { item: Feature; index: number }) => {
    const epNum = totalCount - (index + 1);
    return (
      <TouchableOpacity style={s.episodeCard} onPress={() => goToFeature(item)} activeOpacity={0.86}>
        {renderFeatureImage(item)}
        <View style={s.cardBoxes}>
          {renderInfoBox(item, epNum)}
          {renderArtistBox(item.artist)}
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
            <>
              <TouchableOpacity
                onPress={() => navigation.navigate('FeatureInterests')}
                style={s.addBtn}
                activeOpacity={0.7}
              >
                <Text style={s.addBtnText}>★</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => navigation.navigate('AddFeature')}
                style={s.addBtn}
                activeOpacity={0.7}
              >
                <Text style={s.addBtnText}>+</Text>
              </TouchableOpacity>
            </>
          )}
          <MessageButton onPress={() => navigation.navigate('Inbox')} />
          <BellButton onPress={() => navigation.navigate('Notifications')} />
          <OctagonalImage size={24} imageUri={avatarUri} onPress={() => navigation.navigate('Profile')} />
        </View>
      </View>

      {loading ? (
        <View>
          {[1, 2, 3].map(i => <View key={i} style={s.skeletonRow} />)}
        </View>
      ) : features.length === 0 ? (
        <ComingSoon
          isVerified={isVerified}
          hasExpressedInterest={hasExpressedInterest}
          showInterestButton={Boolean(currentUserId)}
          onExpressInterest={handleExpressInterest}
        />
      ) : (
        <FlatList
          data={rest}
          keyExtractor={item => item.id}
          renderItem={renderEpisode}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.white} />
          }
          ListHeaderComponent={
            <>
              <ComingSoon
                isVerified={isVerified}
                hasExpressedInterest={hasExpressedInterest}
                showInterestButton={Boolean(currentUserId)}
                onExpressInterest={handleExpressInterest}
              />
              {latest ? (
                <TouchableOpacity style={s.heroCard} onPress={() => goToFeature(latest)} activeOpacity={0.86}>
                  {renderFeatureImage(latest, true)}
                  <View style={s.cardBoxes}>
                    {renderInfoBox(latest, totalCount, true)}
                    {renderArtistBox(latest.artist)}
                  </View>
                </TouchableOpacity>
              ) : null}
            </>
          }
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

  heroCard: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  episodeCard: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0d0d0d',
  },
  mediaFrame: {
    height: 176,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#171717',
    overflow: 'hidden',
  },
  mediaFrameLarge: {
    height: 235,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  playFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  thumbnailPlaceholder: { backgroundColor: '#0d0d0d', alignItems: 'center', justifyContent: 'center' },
  thumbPlaceholderText: { color: '#333333', fontSize: 28 },
  cardBoxes: {
    gap: 8,
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#191919',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  infoBoxLatest: {
    borderColor: '#2a1f00',
    backgroundColor: '#090700',
  },
  infoBoxTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 9,
  },
  boxKicker: {
    color: '#8f8f8f',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.22,
  },
  episodeBadge: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.18,
  },
  featureTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.12,
    lineHeight: 21,
  },
  locationLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
  },
  locationDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.red,
  },
  locationText: {
    color: '#b5b5b5',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.12,
  },
  artistBox: {
    backgroundColor: '#070707',
    borderWidth: 1,
    borderColor: '#191919',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  artistBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  artistBoxBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  boxArrow: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 16,
    lineHeight: 16,
  },
  artistMeta: { flex: 1 },
  artistHandle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12 },
  artistType: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, marginTop: 3 },

  skeletonRow: { height: 72, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#111111' },

});
