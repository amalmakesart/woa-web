import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import ArtistCard, { Artist } from '../../components/ArtistCard';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';
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

// ─── Filter Modal ─────────────────────────────────────────────────────────────

function FilterModal({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClear,
  onClose,
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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={fm.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
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
                {selected === item && (
                  <Text style={fm.check}>✓</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const fm = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    maxHeight: '60%',
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  title: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.2,
  },
  clear: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  rowText: {
    color: '#555555',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.1,
  },
  rowActive: {
    color: colors.white,
  },
  check: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 9,
  },
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

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ArtistsScreen() {
  const navigation = useNavigation<any>();

  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [displayed, setDisplayed] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [activeModal, setActiveModal] = useState<'country' | 'city' | 'discipline' | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);

  // Derive filter options from actual data
  const availableCountries = useMemo(() =>
    [...new Set(allArtists.map((a) => a.country).filter(Boolean) as string[])].sort(),
    [allArtists]
  );

  const availableCities = useMemo(() => {
    const source = countryFilter
      ? allArtists.filter((a) => a.country === countryFilter)
      : allArtists;
    return [...new Set(source.map((a) => a.city).filter(Boolean) as string[])].sort();
  }, [allArtists, countryFilter]);

  const availableDisciplines = useMemo(() =>
    DISCIPLINES.filter(d => allArtists.some((a) => a.discipline === d)),
    [allArtists]
  );

  const loadArtists = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, art_type, discipline, is_available, profile_photo_url, city, country, follower_count')
      .eq('role', 'ARTIST')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error || !data) {
      // Fall back to query without new columns if migration hasn't run yet
      const { data: fallback } = await supabase
        .from('profiles')
        .select('id, username, full_name, art_type, profile_photo_url, city, country, follower_count')
        .eq('role', 'ARTIST')
        .order('created_at', { ascending: false })
        .limit(200);
      if (fallback) {
        const mapped = (fallback as any[]).map(a => ({ ...a, discipline: null, is_available: false }));
        setAllArtists(mapped as Artist[]);
        setDisplayed(mapped as Artist[]);
      }
    } else {
      setAllArtists(data as Artist[]);
      setDisplayed(data as Artist[]);
    }
    setLoading(false);
  }, []);

  // Load artists + current user info on mount
  useEffect(() => {
    loadArtists();

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, profile_photo_url')
          .eq('id', user.id)
          .single();
        if (profile) {
          setCurrentUserRole((profile as any).role ?? null);
          setCurrentUserAvatar((profile as any).profile_photo_url ?? null);
        }
      }
    })();
  }, [loadArtists]);

  // Apply filters whenever inputs change
  useEffect(() => {
    let result = allArtists;
    if (countryFilter) result = result.filter((a) => a.country === countryFilter);
    if (cityFilter) result = result.filter((a) => a.city === cityFilter);
    if (disciplineFilter) result = result.filter((a) => a.discipline === disciplineFilter);
    if (availableOnly) result = result.filter((a) => a.is_available);
    setDisplayed(result);
  }, [allArtists, countryFilter, cityFilter, disciplineFilter, availableOnly]);

  const handleSelectCountry = (c: string) => {
    setCountryFilter(c);
    setCityFilter(null); // reset city when country changes
  };

  const handleShuffle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDisplayed((prev) => shuffleArray(prev));
  };

  const handleResetFilters = () => {
    setCountryFilter(null);
    setCityFilter(null);
    setDisciplineFilter(null);
    setAvailableOnly(false);
  };

  const handleRegisterPress = () => {
    navigation.getParent()?.navigate('SignUp');
  };

  // Pad to multiple of 3 for even grid
  const paddedArtists = useMemo(() => {
    const rem = displayed.length % 3;
    if (rem === 0) return displayed;
    return [...displayed, ...Array<null>(3 - rem).fill(null)];
  }, [displayed]);

  const showBanner = currentUserRole !== 'ARTIST';

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <MiniLogo />
        <Text style={styles.topBarTitle}>ARTIST DIRECTORY</Text>
        <View style={styles.topBarRight}>
          <BellButton onPress={() => navigation.navigate('Notifications')} />
          <OctagonalImage
            size={24}
            imageUri={currentUserAvatar}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      {/* FILTER SECTION */}
      <View style={styles.filterSection}>
        <Text style={styles.filterLabel}>FILTER ARTISTS</Text>
        <View style={styles.filterRow}>
          {/* Country */}
          <TouchableOpacity
            style={[styles.filterPill, countryFilter && styles.filterPillActive]}
            onPress={() => setActiveModal('country')}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.filterText, countryFilter && styles.filterTextActive]}
              numberOfLines={1}
            >
              {countryFilter ? countryFilter.toUpperCase() : 'ALL COUNTRIES'}
            </Text>
          </TouchableOpacity>

          {/* City */}
          <TouchableOpacity
            style={[styles.filterPill, cityFilter && styles.filterPillActive]}
            onPress={() => setActiveModal('city')}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.filterText, cityFilter && styles.filterTextActive]}
              numberOfLines={1}
            >
              {cityFilter ? cityFilter.toUpperCase() : 'ALL CITIES'}
            </Text>
          </TouchableOpacity>

          {/* Discipline */}
          <TouchableOpacity
            style={[styles.filterPill, disciplineFilter && styles.filterPillActive]}
            onPress={() => setActiveModal('discipline')}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.filterText, disciplineFilter && styles.filterTextActive]}
              numberOfLines={1}
            >
              {disciplineFilter ? disciplineFilter.toUpperCase() : 'ALL TYPES'}
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[styles.availableToggleRow]}
          onPress={() => setAvailableOnly(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[styles.availableToggleTrack, availableOnly && styles.availableToggleTrackOn]}>
            <View style={[styles.availableToggleThumb, availableOnly && styles.availableToggleThumbOn]} />
          </View>
          <Text style={[styles.availableToggleLabel, availableOnly && styles.availableToggleLabelOn]}>
            AVAILABLE ONLY
          </Text>
        </TouchableOpacity>
      </View>

      {/* SHUFFLE ROW */}
      <View style={styles.shuffleRow}>
        <Text style={styles.countText}>{displayed.length} ARTISTS FOUND</Text>
        <TouchableOpacity style={styles.shuffleButton} onPress={handleShuffle} activeOpacity={0.7}>
          <Text style={styles.shuffleText}>⇄ SHUFFLE</Text>
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
          renderItem={({ item }) =>
            item ? (
              <ArtistCard
                artist={item}
                onPress={() =>
                  navigation.navigate('ArtistProfile', { userId: item.id })
                }
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
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.black,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  topBarTitle: {
    flex: 1,
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.18,
    marginLeft: 10,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notifDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.red,
  },

  // Filters
  filterSection: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  filterLabel: {
    color: '#444444',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
  },
  availableToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  availableToggleTrack: {
    width: 32, height: 18, borderRadius: 9,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  availableToggleTrackOn: { backgroundColor: '#2a7a4f' },
  availableToggleThumb: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#444444',
    alignSelf: 'flex-start',
  },
  availableToggleThumbOn: { backgroundColor: colors.white, alignSelf: 'flex-end' },
  availableToggleLabel: {
    color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.15,
  },
  availableToggleLabelOn: { color: '#2a7a4f' },
  filterPill: {
    flex: 1,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: '#222222',
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    borderColor: colors.white,
  },
  filterText: {
    color: '#555555',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.1,
  },
  filterTextActive: {
    color: colors.white,
  },

  // Shuffle row
  shuffleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  countText: {
    color: '#444444',
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.15,
  },
  shuffleButton: {
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  shuffleText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.15,
  },

  // Grid
  grid: {
    flex: 1,
    backgroundColor: '#111111',
  },
  gridContent: {
    backgroundColor: '#111111',
  },
  columnWrapper: {
    gap: 1,
    backgroundColor: '#111111',
  },
  rowSeparator: {
    height: 1,
    backgroundColor: '#111111',
  },
  gridPad: {
    flex: 1,
    backgroundColor: colors.black,
    aspectRatio: 1,
  },

  // Skeleton
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    backgroundColor: '#111111',
  },
  skeletonCard: {
    width: CARD_WIDTH,
    aspectRatio: 1,
    backgroundColor: '#111111',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  emptySubtitle: {
    color: '#444444',
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.15,
  },
  resetButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.red,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  resetText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.15,
  },

  // Register banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0000',
    borderTopWidth: 1,
    borderTopColor: colors.red,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerLine1: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.1,
  },
  bannerLine2: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.1,
    marginTop: 2,
  },
  bannerArrow: {
    color: colors.red,
    fontSize: 20,
    fontFamily: MONO,
  },
});
