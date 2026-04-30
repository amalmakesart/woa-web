import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Platform,
  SafeAreaView,
  UIManager,
  LayoutAnimation,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import ArtistCard, { Artist } from '../../components/ArtistCard';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';
import MessageButton from '../../components/MessageButton';
import { DISCIPLINES } from '../../constants/locationData';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 2) / 3;

// ─── Fisher-Yates shuffle ─────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sortByRecent<T>(arr: T[]): T[] {
  return [...arr].sort((a: any, b: any) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
}

function normalizeCity(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? '';
}

function uniqueNormalizedCities(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeCity(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result.sort((a, b) => a.localeCompare(b));
}

// ─── Filter Modal ─────────────────────────────────────────────────────────────

function FilterModal({
  visible, title, options, selected, onSelect, onClear, onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  selected: string | null;
  onSelect: (v: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={fm.overlay} activeOpacity={1} onPress={onClose}>
        <View style={fm.sheet}>
          <View style={fm.header}>
            <Text style={fm.title}>{title}</Text>
            {selected ? (
              <TouchableOpacity onPress={() => { onClear(); onClose(); }}>
                <Text style={fm.clear}>CLEAR</Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={fm.row}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[fm.rowText, selected === item && fm.rowActive]}>
                  {item.toUpperCase()}
                </Text>
                {selected === item && <Text style={fm.check}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#222222', maxHeight: '60%', paddingBottom: 30 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  title: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  clear: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1 },
  rowActive: { color: colors.white, fontWeight: '700' },
  check: { color: colors.red, fontFamily: MONO, fontSize: 12 },
});

// ─── Skeleton Grid ────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonCard} />
      ))}
    </View>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>NO ARTISTS FOUND</Text>
      <Text style={styles.emptySubtitle}>TRY ADJUSTING YOUR FILTERS</Text>
      <TouchableOpacity style={styles.resetButton} onPress={onReset} activeOpacity={0.7}>
        <Text style={styles.resetText}>RESET FILTERS</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Register Banner ──────────────────────────────────────────────────────────

function RegisterBanner({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.banner} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.bannerLeft}>
        <Text style={styles.bannerLine1}>ARE YOU AN ARTIST?</Text>
        <Text style={styles.bannerLine2}>CREATE YOUR PROFILE</Text>
      </View>
      <Text style={styles.bannerArrow}>›</Text>
    </TouchableOpacity>
  );
}

// ─── Suggested Strip ─────────────────────────────────────────────────────────

function SuggestedStrip({ artists, onPress }: { artists: Artist[]; onPress: (id: string) => void }) {
  if (artists.length === 0) return null;
  return (
    <View style={ss.container}>
      <Text style={ss.label}>SUGGESTED FOR YOU</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.scroll}>
        {artists.map((a) => (
          <TouchableOpacity key={a.id} style={ss.item} onPress={() => onPress(a.id)} activeOpacity={0.7}>
            <OctagonalImage size={56} imageUri={a.profile_photo_url ?? null} />
            <Text style={ss.name} numberOfLines={1}>{(a.username ?? '').toUpperCase()}</Text>
            <Text style={ss.discipline} numberOfLines={1}>{(a.discipline ?? '').toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const ss = StyleSheet.create({
  container: {
    backgroundColor: colors.black,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    paddingTop: 12,
    paddingBottom: 10,
  },
  label: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.18,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  scroll: { paddingHorizontal: 14, gap: 16 },
  item: { alignItems: 'center', width: 64 },
  name: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.1,
    marginTop: 6,
    textAlign: 'center',
    width: 64,
  },
  discipline: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.08,
    marginTop: 2,
    textAlign: 'center',
    width: 64,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ArtistsScreen() {
  const navigation = useNavigation<any>();

  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [displayed, setDisplayed] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [collectivesOnly, setCollectivesOnly] = useState(false);
  const [activeModal, setActiveModal] = useState<'country' | 'city' | 'discipline' | 'tag' | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [currentUserArtTypes, setCurrentUserArtTypes] = useState<string[]>([]);

  const availableCountries = useMemo(() =>
    [...new Set(allArtists.map((a) => a.country).filter(Boolean) as string[])].sort(),
    [allArtists]
  );

  const availableCities = useMemo(() => {
    const source = countryFilter
      ? allArtists.filter((a) => a.country === countryFilter)
      : allArtists;
    return uniqueNormalizedCities(source.map((a) => a.city));
  }, [allArtists, countryFilter]);

  const availableDisciplines = useMemo(() =>
    DISCIPLINES.filter(d => allArtists.some((a) => a.discipline === d)),
    [allArtists]
  );

  const availableTags = useMemo(() =>
    [...new Set(
      allArtists.flatMap((artist) => artist.art_types ?? [])
    )].sort((a, b) => a.localeCompare(b)),
    [allArtists]
  );

  const suggestedArtists = useMemo(() => {
    if (currentUserArtTypes.length === 0) return [];
    const userSet = new Set(currentUserArtTypes.map(t => t.toLowerCase()));
    return allArtists
      .map(a => ({ ...a, _score: (a.art_types ?? []).filter(t => userSet.has(t.toLowerCase())).length }))
      .filter(a => a._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 12);
  }, [allArtists, currentUserArtTypes]);

  const loadArtists = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, role, art_type, art_types, discipline, is_available, is_verified, profile_photo_url, city, country, follower_count, created_at')
      .in('role', ['ARTIST', 'COLLECTIVE'])
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data) {
      const { data: fallback } = await supabase
        .from('profiles')
        .select('id, username, full_name, role, art_type, profile_photo_url, city, country, follower_count, created_at')
        .in('role', ['ARTIST', 'COLLECTIVE'])
        .order('created_at', { ascending: false })
        .limit(200);
      if (fallback) {
        const mapped = sortByRecent((fallback as any[]).map(a => ({ ...a, art_types: [], discipline: null, is_available: false, is_verified: false })));
        setAllArtists(mapped as Artist[]);
        setDisplayed(mapped as Artist[]);
      }
    } else {
      const sorted = sortByRecent(data as Artist[]);
      setAllArtists(sorted);
      setDisplayed(sorted);
    }
    setLoading(false);
  }, []);

  const loadCurrentUserProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let uid = sessionData.session?.user?.id ?? null;

    if (!uid) {
      const { data: userData } = await supabase.auth.getUser();
      uid = userData.user?.id ?? null;
    }

    if (!uid) {
      setCurrentUserRole(null);
      setCurrentUserAvatar(null);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, profile_photo_url, art_types')
      .eq('id', uid)
      .maybeSingle();

    setCurrentUserRole((profile as any)?.role ?? null);
    setCurrentUserAvatar((profile as any)?.profile_photo_url ?? null);
    setCurrentUserArtTypes((profile as any)?.art_types ?? []);
  }, []);

  const refreshArtists = useCallback(async () => {
    await Promise.all([loadArtists(), loadCurrentUserProfile()]);
  }, [loadArtists, loadCurrentUserProfile]);

  useEffect(() => {
    void refreshArtists();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void refreshArtists();
    });

    const channel = supabase.channel('artists-directory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        void refreshArtists();
      })
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [refreshArtists]);

  useFocusEffect(
    useCallback(() => {
      void refreshArtists();
    }, [refreshArtists])
  );

  useEffect(() => {
    let result = allArtists;
    if (countryFilter) result = result.filter((a) => a.country === countryFilter);
    if (cityFilter) result = result.filter((a) => normalizeCity(a.city) === cityFilter);
    if (disciplineFilter) result = result.filter((a) =>
      a.discipline?.toLowerCase() === disciplineFilter.toLowerCase() ||
      (a as any).art_type?.toLowerCase() === disciplineFilter.toLowerCase()
    );
    if (tagFilter) {
      result = result.filter((a) =>
        (a.art_types ?? []).some((tag) => tag.toLowerCase() === tagFilter.toLowerCase())
      );
    }
    if (collectivesOnly) result = result.filter((a) => a.role === 'COLLECTIVE');
    if (availableOnly) result = result.filter((a) => a.is_available);
    if (verifiedOnly) result = result.filter((a) => (a as any).is_verified === true);
    setDisplayed(sortByRecent(result));
  }, [allArtists, countryFilter, cityFilter, disciplineFilter, tagFilter, collectivesOnly, availableOnly, verifiedOnly]);

  const handleSelectCountry = (c: string) => {
    setCountryFilter(c);
    setCityFilter(null);
  };

  const handleShuffle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDisplayed((prev) => shuffleArray(prev));
  };

  const handleResetFilters = () => {
    setCountryFilter(null);
    setCityFilter(null);
    setDisciplineFilter(null);
    setTagFilter(null);
    setCollectivesOnly(false);
    setAvailableOnly(false);
    setVerifiedOnly(false);
  };

  const handleRegisterPress = () => {
    navigation.getParent()?.navigate('SignUp');
  };

  const paddedArtists = useMemo(() => {
    const rem = displayed.length % 3;
    if (rem === 0) return displayed;
    return [...displayed, ...Array<null>(3 - rem).fill(null)];
  }, [displayed]);

  const showBanner = currentUserRole === 'GIG_POSTER' || currentUserRole === 'ART_LOVER';
  const hasFilters = !!(countryFilter || cityFilter || disciplineFilter || tagFilter || availableOnly || verifiedOnly || collectivesOnly);

  return (
    <SafeAreaView style={styles.safeArea}>

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <MiniLogo />
        <Text style={styles.topBarTitle}>ARTIST DIRECTORY</Text>
        <View style={styles.topBarRight}>
          <MessageButton onPress={() => navigation.navigate('Inbox')} />
          <BellButton onPress={() => navigation.navigate('Notifications')} />
          <OctagonalImage
            size={24}
            imageUri={currentUserAvatar}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      {/* FILTER BAR */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[styles.chip, countryFilter && styles.chipActive]}
            onPress={() => countryFilter ? (setCountryFilter(null), setCityFilter(null)) : setActiveModal('country')}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={12} color={countryFilter ? colors.white : colors.red} style={{ marginRight: 4 }} />
            <Text style={[styles.chipText, countryFilter && styles.chipTextActive]} numberOfLines={1}>
              {countryFilter ? countryFilter.toUpperCase() : 'COUNTRY'}
            </Text>
            {countryFilter ? <Text style={styles.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, cityFilter && styles.chipActive]}
            onPress={() => cityFilter ? setCityFilter(null) : setActiveModal('city')}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={12} color={cityFilter ? colors.white : colors.red} style={{ marginRight: 4 }} />
            <Text style={[styles.chipText, cityFilter && styles.chipTextActive]} numberOfLines={1}>
              {cityFilter ? cityFilter.toUpperCase() : 'CITY'}
            </Text>
            {cityFilter ? <Text style={styles.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, disciplineFilter && styles.chipActive]}
            onPress={() => disciplineFilter ? setDisciplineFilter(null) : setActiveModal('discipline')}
            activeOpacity={0.7}
          >
            <Ionicons name="brush-outline" size={12} color={disciplineFilter ? colors.white : colors.red} style={{ marginRight: 4 }} />
            <Text style={[styles.chipText, disciplineFilter && styles.chipTextActive]} numberOfLines={1}>
              {disciplineFilter ? disciplineFilter.toUpperCase() : 'DISCIPLINE'}
            </Text>
            {disciplineFilter ? <Text style={styles.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.chip, tagFilter && styles.chipActive]}
            onPress={() => tagFilter ? setTagFilter(null) : setActiveModal('tag')}
            activeOpacity={0.7}
          >
            <Ionicons name="pricetags-outline" size={12} color={tagFilter ? colors.white : colors.red} style={{ marginRight: 4 }} />
            <Text style={[styles.chipText, tagFilter && styles.chipTextActive]} numberOfLines={1}>
              {tagFilter ? tagFilter.toUpperCase() : 'TAG'}
            </Text>
            {tagFilter ? <Text style={styles.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          {(countryFilter || cityFilter || disciplineFilter || tagFilter) ? (
            <TouchableOpacity style={styles.chipClear} onPress={handleResetFilters} activeOpacity={0.7}>
              <Text style={styles.chipClearText}>CLEAR ALL</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <TouchableOpacity style={styles.shuffleCircle} onPress={handleShuffle} activeOpacity={0.7}>
          <Ionicons name="shuffle" size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* TOGGLE ROW — Available + Verified always visible */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.togglePill, availableOnly && styles.togglePillAvailable]}
          onPress={() => setAvailableOnly(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.availDot, availableOnly && styles.availDotOn]} />
          <Text style={[styles.togglePillText, availableOnly && styles.togglePillTextAvailable]}>
            AVAILABLE
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.togglePill, collectivesOnly && styles.togglePillCollective]}
          onPress={() => setCollectivesOnly(v => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="people-outline"
            size={12}
            color={collectivesOnly ? colors.red : '#9a9a9a'}
          />
          <Text style={[styles.togglePillText, collectivesOnly && styles.togglePillTextCollective]}>
            COLLECTIVES
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.togglePill, verifiedOnly && styles.togglePillVerified]}
          onPress={() => setVerifiedOnly(v => !v)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="checkmark-circle"
            size={12}
            color={verifiedOnly ? '#f6c55a' : '#9a9a9a'}
            style={{ marginRight: 5 }}
          />
          <Text style={[styles.togglePillText, verifiedOnly && styles.togglePillTextVerified]}>
            VERIFIED ONLY
          </Text>
        </TouchableOpacity>
      </View>

      {/* COUNT ROW */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{displayed.length} ARTISTS FOUND</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Search')} activeOpacity={0.7} style={styles.searchBtn}>
          <Ionicons name="search-outline" size={15} color="#9a9a9a" />
          <Text style={styles.searchBtnText}>SEARCH</Text>
        </TouchableOpacity>
      </View>

      {/* GRID */}
      {loading ? (
        <SkeletonGrid />
      ) : displayed.length === 0 ? (
        <EmptyState onReset={handleResetFilters} />
      ) : (
        <FlatList
          data={paddedArtists}
          numColumns={3}
          keyExtractor={(item, index) => item?.id ?? `pad-${index}`}
          columnWrapperStyle={styles.columnWrapper}
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
          style={styles.grid}
          contentContainerStyle={styles.gridContent}
          ListHeaderComponent={!hasFilters && suggestedArtists.length > 0 ? (
            <SuggestedStrip
              artists={suggestedArtists}
              onPress={(id) => navigation.navigate('ArtistProfile', { userId: id })}
            />
          ) : null}
          renderItem={({ item }) =>
            item ? (
              <ArtistCard
                artist={item}
                onPress={() => navigation.navigate('ArtistProfile', { userId: item.id })}
              />
            ) : (
              <View style={styles.gridPad} />
            )
          }
        />
      )}

      {/* REGISTER BANNER */}
      {showBanner && <RegisterBanner onPress={handleRegisterPress} />}

      {/* FILTER MODALS */}
      <FilterModal
        visible={activeModal === 'country'}
        title="SELECT COUNTRY"
        options={availableCountries}
        selected={countryFilter}
        onSelect={handleSelectCountry}
        onClear={() => { setCountryFilter(null); setCityFilter(null); }}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'city'}
        title="SELECT CITY"
        options={availableCities}
        selected={cityFilter}
        onSelect={setCityFilter}
        onClear={() => setCityFilter(null)}
        onClose={() => setActiveModal(null)}
      />
   
      <FilterModal
        visible={activeModal === 'discipline'}
        title="SELECT DISCIPLINE"
        options={availableDisciplines}
        selected={disciplineFilter}
        onSelect={setDisciplineFilter}
        onClear={() => setDisciplineFilter(null)}
        onClose={() => setActiveModal(null)}
      />
      <FilterModal
        visible={activeModal === 'tag'}
        title="SELECT TAG"
        options={availableTags}
        selected={tagFilter}
        onSelect={setTagFilter}
        onClear={() => setTagFilter(null)}
        onClose={() => setActiveModal(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  topBarTitle: {
    flex: 1, color: colors.white, fontFamily: MONO,
    fontSize: 13, letterSpacing: 0.18, marginLeft: 10,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },

  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#111111',
    paddingRight: 12,
  },
  filterScroll: {
    paddingHorizontal: 12, paddingVertical: 10,
    gap: 8, alignItems: 'center',
  },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.red,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipActive: { borderColor: colors.white, backgroundColor: '#111111' },
  chipAvailable: { borderColor: '#2a7a4f', backgroundColor: '#001a0a' },
  chipVerified: { borderColor: '#f6c55a', backgroundColor: '#0a0800' },
  chipText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  chipTextActive: { color: colors.white },
  chipTextAvailable: { color: '#2a7a4f' },
  chipTextVerified: { color: '#f6c55a' },
  chipX: { color: '#ffffff', fontFamily: MONO, fontSize: 11 },
  chipClear: {
    borderWidth: 1, borderColor: colors.red,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  chipClearText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  availDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#333333', marginRight: 6 },
  availDotOn: { backgroundColor: '#2a7a4f' },
  shuffleCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.red,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Toggle row — always visible below chip bar
  toggleRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  togglePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRightWidth: 1,
    borderRightColor: '#111111',
  },
  togglePillAvailable: {
    backgroundColor: '#001a0a',
  },
  togglePillCollective: {
    backgroundColor: '#140404',
  },
  togglePillVerified: {
    backgroundColor: '#0a0800',
  },
  togglePillText: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.12,
  },
  togglePillTextAvailable: { color: '#2a7a4f' },
  togglePillTextCollective: { color: colors.red },
  togglePillTextVerified: { color: '#f6c55a' },

  countRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  countText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  searchBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  searchBtnText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },

  grid: { flex: 1, backgroundColor: '#111111' },
  gridContent: { backgroundColor: '#111111' },
  columnWrapper: { gap: 1, backgroundColor: '#111111' },
  rowSeparator: { height: 1, backgroundColor: '#111111' },
  gridPad: { flex: 1, backgroundColor: colors.black, aspectRatio: 1 },

  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, backgroundColor: '#111111' },
  skeletonCard: { width: CARD_WIDTH, aspectRatio: 1, backgroundColor: '#111111' },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  emptySubtitle: { color: '#b5b5b5', fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },
  resetButton: { marginTop: 8, borderWidth: 1, borderColor: colors.red, paddingVertical: 8, paddingHorizontal: 16 },
  resetText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },

  banner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0a0000', borderTopWidth: 1, borderTopColor: colors.red,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  bannerLeft: { flex: 1 },
  bannerLine1: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  bannerLine2: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, marginTop: 2 },
  bannerArrow: { color: colors.red, fontSize: 20, fontFamily: MONO },
});
