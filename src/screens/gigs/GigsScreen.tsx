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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import GigCard, { Gig, GIG_ART_TYPES, formatBudget } from '../../components/GigCard';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

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
  title: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },
  clear: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: '#555555', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  rowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 9 },
});

// ─── Top Bar (shared) ─────────────────────────────────────────────────────────

function TopBar({
  title, avatarUri, onAvatarPress, onBellPress,
}: { title: string; avatarUri: string | null; onAvatarPress: () => void; onBellPress: () => void }) {
  return (
    <View style={s.topBar}>
      <MiniLogo />
      <Text style={s.topBarTitle}>{title}</Text>
      <View style={s.topBarRight}>
        <BellButton onPress={onBellPress} />
        <OctagonalImage size={24} imageUri={avatarUri} onPress={onAvatarPress} />
      </View>
    </View>
  );
}

// ─── My Gig Card (Gig Poster view) ───────────────────────────────────────────

function MyGigRow({ gig, onPress }: { gig: Gig; onPress: () => void }) {
  const meta = [gig.art_type, gig.location, gig.date_timeframe]
    .filter(Boolean).join(' · ').toUpperCase();
  const isActive = gig.status === 'active';

  return (
    <TouchableOpacity style={s.myGigRow} onPress={onPress} activeOpacity={0.8}>
      <View style={s.myGigLeft}>
        <Text style={s.myGigTitle} numberOfLines={2}>{gig.title.toUpperCase()}</Text>
        <Text style={s.myGigMeta}>{meta}</Text>
        <View style={[s.statusBadge, isActive ? s.statusActive : s.statusClosed]}>
          <Text style={[s.statusText, isActive ? s.statusTextActive : s.statusTextClosed]}>
            {isActive ? 'ACTIVE' : 'CLOSED'}
          </Text>
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
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'artType' | 'location' | null>(null);

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

  const availableLocations = useMemo(() =>
    [...new Set(allGigs.map((g) => g.location).filter(Boolean) as string[])].sort(),
    [allGigs]
  );

  const filtered = useMemo(() => {
    let r = allGigs;
    if (artTypeFilter) r = r.filter((g) => g.art_type === artTypeFilter);
    if (locationFilter) r = r.filter((g) => g.location === locationFilter);
    return r;
  }, [allGigs, artTypeFilter, locationFilter]);

  return (
    <>
      <TopBar title="GIGS" avatarUri={avatarUri} onAvatarPress={() => navigation.navigate('Profile')} onBellPress={() => navigation.navigate('Notifications')} />

      {/* Filters */}
      <View style={s.filterSection}>
        <Text style={s.filterLabel}>FILTER GIGS</Text>
        <View style={s.filterRow}>
          <TouchableOpacity
            style={[s.filterPill, artTypeFilter && s.filterPillActive]}
            onPress={() => setActiveModal('artType')} activeOpacity={0.7}
          >
            <Text style={[s.filterText, artTypeFilter && s.filterTextActive]} numberOfLines={1}>
              {artTypeFilter ? artTypeFilter.toUpperCase() : 'ALL TYPES'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.filterPill, locationFilter && s.filterPillActive]}
            onPress={() => setActiveModal('location')} activeOpacity={0.7}
          >
            <Text style={[s.filterText, locationFilter && s.filterTextActive]} numberOfLines={1}>
              {locationFilter ? locationFilter.toUpperCase() : 'ALL LOCATIONS'}
            </Text>
          </TouchableOpacity>
        </View>
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
          {(artTypeFilter || locationFilter) && (
            <TouchableOpacity
              style={s.resetBtn}
              onPress={() => { setArtTypeFilter(null); setLocationFilter(null); }}
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
        visible={activeModal === 'location'}
        title="SELECT LOCATION"
        options={['Remote', ...availableLocations]}
        selected={locationFilter}
        onSelect={setLocationFilter}
        onClear={() => setLocationFilter(null)}
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

    setMyGigs(data.map((g: any) => ({ ...g, interest_count: countMap[g.id] ?? 0 })) as Gig[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadMyGigs(); }, [loadMyGigs]));

  return (
    <>
      <TopBar title="MY GIGS" avatarUri={avatarUri} onAvatarPress={() => navigation.navigate('Profile')} onBellPress={() => navigation.navigate('Notifications')} />

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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, profile_photo_url')
          .eq('id', user.id)
          .single();
        if (data) {
          setRole((data as any).role ?? 'ARTIST');
          setAvatarUri((data as any).profile_photo_url ?? null);
        }
      }
      setRoleLoading(false);
    })();
  }, []);

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

  // Filters
  filterSection: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  filterLabel: { color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, marginBottom: 8 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: {
    flex: 1, backgroundColor: colors.black, borderWidth: 1, borderColor: '#222222',
    minHeight: 44, paddingVertical: 10, paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  filterPillActive: { borderColor: colors.white },
  filterText: { color: '#555555', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  filterTextActive: { color: colors.white },

  // Skeleton / loading
  loadingRow: { paddingTop: 1 },
  skeletonCard: { height: 80, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#111111' },

  // Empty
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyTitle: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  emptySub: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },
  resetBtn: { borderWidth: 1, borderColor: colors.red, paddingVertical: 8, paddingHorizontal: 16 },
  resetBtnText: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },

  // My Gig Row
  myGigRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    minHeight: 44,
  },
  myGigLeft: { flex: 1, marginRight: 12 },
  myGigTitle: { color: colors.white, fontFamily: MONO, fontSize: 14, letterSpacing: 0.12, marginBottom: 4 },
  myGigMeta: { color: '#444444', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12, marginBottom: 8 },
  statusBadge: {
    alignSelf: 'flex-start', borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  statusActive: { borderColor: '#2a7a4f' },
  statusClosed: { borderColor: '#333333' },
  statusText: { fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  statusTextActive: { color: '#2a7a4f' },
  statusTextClosed: { color: '#333333' },
  myGigRight: { alignItems: 'center' },
  interestBig: { color: colors.red, fontFamily: MONO, fontSize: 22, letterSpacing: 0.1 },
  interestSmall: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },

  // Post gig button
  postGigBtn: {
    borderWidth: 1, borderColor: colors.red,
    marginHorizontal: 16, marginVertical: 16,
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  postGigBtnText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18 },
});
