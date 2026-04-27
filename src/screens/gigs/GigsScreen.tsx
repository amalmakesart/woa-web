import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Platform,
  SafeAreaView,
  RefreshControl,
  Alert,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import GigCard, { Gig, GIG_ART_TYPES, formatBudget } from '../../components/GigCard';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';
import MessageButton from '../../components/MessageButton';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';

function parseLocationParts(location: string | null) {
  const raw = location?.trim();
  if (!raw) return { country: null as string | null, city: null as string | null };
  if (raw.toLowerCase() === 'remote') {
    return { country: 'Remote', city: null };
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(', '),
      country: parts[parts.length - 1],
    };
  }

  return { country: raw, city: null };
}

// ─── Filter Modal (same pattern as Artists tab) ───────────────────────────────

function FilterModal({
  visible, title, options, selected, onSelect, onClear, onClose,
}: {
  visible: boolean; title: string; options: string[]; selected: string | null;
  onSelect: (v: string) => void; onClear: () => void; onClose: () => void;
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
              <TouchableOpacity style={fm.row} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
                <Text style={[fm.rowText, selected === item && fm.rowActive]}>{item.toUpperCase()}</Text>
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  rowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 11 },
});

// ─── Top Bar (shared) ─────────────────────────────────────────────────────────

function TopBar({
  title, avatarUri, onAvatarPress, onBellPress, onMessagePress,
}: {
  title: string;
  avatarUri: string | null;
  onAvatarPress: () => void;
  onBellPress: () => void;
  onMessagePress: () => void;
}) {
  return (
    <View style={s.topBar}>
      <MiniLogo />
      <Text style={s.topBarTitle}>{title}</Text>
      <View style={s.topBarRight}>
        <MessageButton onPress={onMessagePress} />
        <BellButton onPress={onBellPress} />
        <OctagonalImage size={24} imageUri={avatarUri} onPress={onAvatarPress} />
      </View>
    </View>
  );
}

// ─── My Gig Card (Gig Poster view) ───────────────────────────────────────────

function MyGigRow({ gig, onPress, onDelete, onClose }: {
  gig: Gig; onPress: () => void; onDelete: () => void; onClose: () => void;
}) {
  const isActive = gig.status === 'active';

  const handleDelete = () => {
    Alert.alert(
      'DELETE GIG',
      'Are you sure you want to permanently delete this gig?',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'DELETE', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const handleClose = () => {
    Alert.alert(
      '⚠️ CLOSE GIG',
      'This will permanently close the gig. Artists will no longer be able to express interest. This cannot be undone.',
      [
        { text: 'CANCEL', style: 'cancel' },
        { text: 'CLOSE GIG', style: 'destructive', onPress: onClose },
      ]
    );
  };

  return (
    <TouchableOpacity style={s.myGigRow} onPress={onPress} activeOpacity={0.8}>
      <View style={s.myGigLeft}>
        <Text style={s.myGigTitle} numberOfLines={2}>{gig.title.toUpperCase()}</Text>
        {gig.art_type ? (
          <Text style={s.myGigMetaType}>{gig.art_type.toUpperCase()}</Text>
        ) : null}
        {gig.location ? (
          <View style={s.myGigMetaRow}>
            <Text style={s.myGigMetaIcon}>⌖</Text>
            <Text style={s.myGigMeta} numberOfLines={1}>{gig.location.toUpperCase()}</Text>
          </View>
        ) : null}
        {gig.date_timeframe ? (
          <View style={s.myGigMetaRow}>
            <Text style={s.myGigMetaIcon}>◷</Text>
            <Text style={s.myGigMeta} numberOfLines={2}>{gig.date_timeframe.toUpperCase()}</Text>
          </View>
        ) : null}
        <View style={s.myGigBottomRow}>
          <View style={[s.statusBadge, isActive ? s.statusActive : s.statusClosed]}>
            <Text style={[s.statusText, isActive ? s.statusTextActive : s.statusTextClosed]}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </Text>
          </View>
          {isActive ? (
            <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
              <Text style={s.closeBtnText}>⚠ CLOSE</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete} activeOpacity={0.7}>
            <Text style={s.deleteBtnText}>DELETE</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={s.myGigRight}>
        <Text style={s.interestBig}>{gig.interest_count}</Text>
        <Text style={s.interestSmall}>INTERESTED</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── GIG BOARD VIEW (for Artists) ────────────────────────────────────────────

function GigBoardView({
  navigation, avatarUri,
}: { navigation: any; avatarUri: string | null }) {
  const [allGigs, setAllGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [artTypeFilter, setArtTypeFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'artType' | 'country' | 'city' | null>(null);

  const loadGigs = useCallback(async () => {
    const { data } = await supabase
      .from('gigs')
      .select('*')
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);
    if (!data) { setLoading(false); return; }

    const ids = data.map((g: any) => g.id);
    const { data: interests } = await supabase
      .from('gig_interests')
      .select('gig_id')
      .in('gig_id', ids);

    const countMap: Record<string, number> = {};
    (interests ?? []).forEach((r: any) => {
      countMap[r.gig_id] = (countMap[r.gig_id] ?? 0) + 1;
    });

    setAllGigs(data.map((g: any) => ({ ...g, interest_count: countMap[g.id] ?? 0 })) as Gig[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadGigs(); }, [loadGigs]));

  const availableCountries = useMemo(() =>
    [...new Set(allGigs.map((gig) => parseLocationParts(gig.location).country).filter(Boolean) as string[])].sort(),
    [allGigs]
  );

  const availableCities = useMemo(() => {
    const source = countryFilter
      ? allGigs.filter((gig) => parseLocationParts(gig.location).country === countryFilter)
      : allGigs;
    return [...new Set(source.map((gig) => parseLocationParts(gig.location).city).filter(Boolean) as string[])].sort();
  }, [allGigs, countryFilter]);

  const filtered = useMemo(() => {
    let r = allGigs;
    if (countryFilter) {
      r = r.filter((gig) => parseLocationParts(gig.location).country === countryFilter);
    }
    if (cityFilter) {
      r = r.filter((gig) => parseLocationParts(gig.location).city === cityFilter);
    }
    if (artTypeFilter) r = r.filter((g) => g.art_type === artTypeFilter);
    return r;
  }, [allGigs, artTypeFilter, countryFilter, cityFilter]);

  const handleSelectCountry = (country: string) => {
    setCountryFilter(country);
    setCityFilter(null);
  };

  return (
    <>
      <TopBar title="GIGS" avatarUri={avatarUri} onAvatarPress={() => navigation.navigate('Profile')} onBellPress={() => navigation.navigate('Notifications')} onMessagePress={() => navigation.navigate('Inbox')} />

      <View style={s.descriptionRow}>
        <Text style={s.descriptionText}>FIND PAID OPPORTUNITIES AND APPLY FOR GIGS THAT FIT YOUR CRAFT</Text>
      </View>

      {/* Filters */}
      <View style={s.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterScroll}
        >
          <TouchableOpacity
            style={[s.chip, artTypeFilter && s.chipActive]}
            onPress={() => artTypeFilter ? setArtTypeFilter(null) : setActiveModal('artType')} activeOpacity={0.7}
          >
            <Ionicons name="brush-outline" size={12} color={artTypeFilter ? colors.white : colors.red} style={s.chipIcon} />
            <Text style={[s.chipText, artTypeFilter && s.chipTextActive]} numberOfLines={1}>
              {artTypeFilter ? artTypeFilter.toUpperCase() : 'ART TYPE'}
            </Text>
            {artTypeFilter ? <Text style={s.chipX}> ✕</Text> : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.chip, countryFilter && s.chipActive]}
            onPress={() => countryFilter ? (setCountryFilter(null), setCityFilter(null)) : setActiveModal('country')} activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={12} color={countryFilter ? colors.white : colors.red} style={s.chipIcon} />
            <Text style={[s.chipText, countryFilter && s.chipTextActive]} numberOfLines={1}>
              {countryFilter ? countryFilter.toUpperCase() : 'COUNTRY'}
            </Text>
            {countryFilter ? <Text style={s.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.chip, cityFilter && s.chipActive]}
            onPress={() => cityFilter ? setCityFilter(null) : setActiveModal('city')} activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={12} color={cityFilter ? colors.white : colors.red} style={s.chipIcon} />
            <Text style={[s.chipText, cityFilter && s.chipTextActive]} numberOfLines={1}>
              {cityFilter ? cityFilter.toUpperCase() : 'CITY'}
            </Text>
            {cityFilter ? <Text style={s.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          {(artTypeFilter || countryFilter || cityFilter) ? (
            <TouchableOpacity
              style={s.chipClear}
              onPress={() => { setArtTypeFilter(null); setCountryFilter(null); setCityFilter(null); }}
              activeOpacity={0.7}
            >
              <Text style={s.chipClearText}>CLEAR ALL</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>

      {/* Gig list */}
      {loading ? (
        <View style={s.loadingRow}>
          {[1, 2, 3].map((i) => <View key={i} style={s.skeletonCard} />)}
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyTitle}>NO GIGS FOUND</Text>
          <Text style={s.emptySub}>TRY ADJUSTING YOUR FILTERS</Text>
          {(artTypeFilter || countryFilter || cityFilter) && (
            <TouchableOpacity
              style={s.resetBtn}
              onPress={() => { setArtTypeFilter(null); setCountryFilter(null); setCityFilter(null); }}
              activeOpacity={0.7}
            >
              <Text style={s.resetBtnText}>RESET FILTERS</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <GigCard gig={item} onPress={() => navigation.navigate('GigDetail', { gigId: item.id })} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.white}
              onRefresh={async () => { setRefreshing(true); await loadGigs(); setRefreshing(false); }}
            />
          }
        />
      )}

      <FilterModal
        visible={activeModal === 'artType'}
        title="SELECT ART TYPE"
        options={GIG_ART_TYPES}
        selected={artTypeFilter}
        onSelect={setArtTypeFilter}
        onClear={() => setArtTypeFilter(null)}
        onClose={() => setActiveModal(null)}
      />
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
    </>
  );
}

// ─── MY GIGS VIEW (for Gig Posters) ──────────────────────────────────────────

function MyGigsView({
  navigation, avatarUri,
}: { navigation: any; avatarUri: string | null }) {
  const [myGigs, setMyGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMyGigs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('gigs')
      .select('*')
      .eq('poster_id', user.id)
      .order('created_at', { ascending: false });
    if (!data) { setLoading(false); return; }

    const ids = data.map((g: any) => g.id);
    const { data: interests } = await supabase
      .from('gig_interests')
      .select('gig_id')
      .in('gig_id', ids);

    const countMap: Record<string, number> = {};
    (interests ?? []).forEach((r: any) => {
      countMap[r.gig_id] = (countMap[r.gig_id] ?? 0) + 1;
    });

    const visibleGigs = data.filter((g: any) => g.status !== 'payment_pending');
    setMyGigs(visibleGigs.map((g: any) => ({ ...g, interest_count: countMap[g.id] ?? 0 })) as Gig[]);
    setLoading(false);
  }, []);

  const handleDeleteGig = async (gigId: string) => {
    setMyGigs(prev => prev.filter(g => g.id !== gigId));
    await supabase.from('gigs').delete().eq('id', gigId);
  };

  const handleCloseGig = async (gigId: string) => {
    setMyGigs(prev => prev.map(g => g.id === gigId ? { ...g, status: 'closed' } : g));
    await supabase.from('gigs').update({ status: 'closed' }).eq('id', gigId);
  };

  useFocusEffect(useCallback(() => { loadMyGigs(); }, [loadMyGigs]));

  return (
    <>
      <TopBar title="MY GIGS" avatarUri={avatarUri} onAvatarPress={() => navigation.navigate('Profile')} onBellPress={() => navigation.navigate('Notifications')} onMessagePress={() => navigation.navigate('Inbox')} />

      {loading ? (
        <View style={s.loadingRow}>
          {[1, 2].map((i) => <View key={i} style={s.skeletonCard} />)}
        </View>
      ) : myGigs.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.emptyTitle}>NO GIGS POSTED YET</Text>
          <TouchableOpacity
            style={s.postGigBtn}
            onPress={() => navigation.navigate('PostGig')}
            activeOpacity={0.7}
          >
            <Text style={s.postGigBtnText}>POST YOUR FIRST GIG</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={myGigs}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MyGigRow
              gig={item}
              onPress={() => navigation.navigate('InterestedArtists', { gigId: item.id, gigTitle: item.title })}
              onDelete={() => handleDeleteGig(item.id)}
              onClose={() => handleCloseGig(item.id)}
            />
          )}
          ListFooterComponent={
            <TouchableOpacity
              style={s.postGigBtn}
              onPress={() => navigation.navigate('PostGig')}
              activeOpacity={0.7}
            >
              <Text style={s.postGigBtnText}>+ POST A NEW GIG</Text>
            </TouchableOpacity>
          }
        />
      )}
    </>
  );
}

// ─── Main GigsScreen ──────────────────────────────────────────────────────────

export default function GigsScreen() {
  const navigation = useNavigation<any>();
  const [role, setRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const loadCurrentUserProfile = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    let uid = sessionData.session?.user?.id ?? null;

    if (!uid) {
      const { data: userData } = await supabase.auth.getUser();
      uid = userData.user?.id ?? null;
    }

    if (!uid) {
      setRole(null);
      setAvatarUri(null);
      setRoleLoading(false);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('role, profile_photo_url')
      .eq('id', uid)
      .maybeSingle();

    setRole((data as any)?.role ?? null);
    setAvatarUri((data as any)?.profile_photo_url ?? null);
    setRoleLoading(false);
  }, []);

  useEffect(() => {
    void loadCurrentUserProfile();
  }, [loadCurrentUserProfile]);

  useFocusEffect(
    useCallback(() => {
      void loadCurrentUserProfile();
    }, [loadCurrentUserProfile])
  );

  if (roleLoading) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <Text style={s.topBarTitle}>GIGS</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safeArea}>
      {role === 'GIG_POSTER' ? (
        <MyGigsView navigation={navigation} avatarUri={avatarUri} />
      ) : (
        <GigBoardView navigation={navigation} avatarUri={avatarUri} />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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

  // Description row
  descriptionRow: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  descriptionText: {
    color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2,
  },

  // Filters
  filterBar: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  filterScroll: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2b2b2b',
    paddingHorizontal: 10,
    height: 32,
  },
  chipActive: { borderColor: colors.white, backgroundColor: '#111111' },
  chipIcon: { marginRight: 4 },
  chipText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, maxWidth: 120 },
  chipTextActive: { color: colors.white },
  chipX: { color: colors.white, fontFamily: MONO, fontSize: 11 },
  chipClear: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 32,
    borderWidth: 1,
    borderColor: colors.red,
  },
  chipClearText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },

  // Skeleton / loading
  loadingRow: { paddingTop: 1 },
  skeletonCard: { height: 80, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#111111' },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  emptySub: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, lineHeight: 17 },
  resetBtn: { borderWidth: 1, borderColor: colors.red, paddingVertical: 8, paddingHorizontal: 16 },
  resetBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  myGigBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  closeBtn: {
    borderWidth: 1, borderColor: '#c47a00',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  closeBtnText: { color: '#c47a00', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  deleteBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  deleteBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  statusBadge: {
    alignSelf: 'flex-start', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  myGigRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    minHeight: 44,
  },
  myGigLeft: { flex: 1, marginRight: 12 },
  myGigTitle: { color: colors.white, fontFamily: MONO, fontSize: 14, letterSpacing: 0.12, marginBottom: 4 },
  myGigMetaType: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, marginBottom: 6 },
  myGigMetaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  myGigMetaIcon: { color: colors.red, fontFamily: MONO, fontSize: 11, lineHeight: 16, marginTop: 1 },
  myGigMeta: { flex: 1, color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, marginBottom: 0, lineHeight: 16 },
  statusActive: { borderColor: '#2a7a4f' },
  statusClosed: { borderColor: '#333333' },
  statusText: { fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  statusTextActive: { color: '#2a7a4f' },
  statusTextClosed: { color: '#8f8f8f' },
  myGigRight: { alignItems: 'center' },
  interestBig: { color: colors.red, fontFamily: MONO, fontSize: 22, letterSpacing: 0.1 },
  interestSmall: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  // Post gig button
  postGigBtn: {
    borderWidth: 1, borderColor: colors.red,
    marginHorizontal: 16, marginVertical: 16,
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  postGigBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
});
