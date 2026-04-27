import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Platform, SafeAreaView, RefreshControl, ActivityIndicator, Modal, ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import MiniLogo from '../../components/MiniLogo';
import BellButton from '../../components/BellButton';
import MessageButton from '../../components/MessageButton';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';

function normalizeFilterValue(value: string | null) {
  return value?.trim().replace(/\s+/g, ' ').toUpperCase() ?? '';
}

function getUniqueFilterOptions(values: Array<string | null>) {
  const seen = new Map<string, string>();
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim().replace(/\s+/g, ' ');
    if (!trimmed) continue;
    const normalized = normalizeFilterValue(trimmed);
    if (!seen.has(normalized)) {
      seen.set(normalized, trimmed);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

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

export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string;
  art_types_needed: string[];
  location: string | null;
  discipline: string | null;
  budget: string | null;
  is_closed: boolean;
  comment_count: number;
  created_at: string;
  profiles?: {
    username: string | null;
    profile_photo_url: string | null;
    full_name: string | null;
  } | null;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return 'NOW';
  if (m < 60) return `${m}M`;
  if (h < 24) return `${h}H`;
  return `${d}D`;
}

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

function ProjectCard({
  project, onPress, onAuthorPress,
}: {
  project: Project;
  onPress: () => void;
  onAuthorPress: () => void;
}) {
  const username = project.profiles?.username
    ? `@${project.profiles.username.toUpperCase()}`
    : '@UNKNOWN';

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <OctagonalImage
          size={42}
          imageUri={project.profiles?.profile_photo_url ?? null}
          onPress={onAuthorPress}
        />
        <View style={s.cardHeaderInfo}>
          <Text style={s.cardUsername}>{username}</Text>
          <Text style={s.cardTime}>{timeAgo(project.created_at)}</Text>
        </View>
      </View>
      <Text style={s.cardTitle}>{project.title.toUpperCase()}</Text>
      {project.is_closed ? (
        <View style={s.closedBadge}>
          <Text style={s.closedBadgeText}>CLOSED</Text>
        </View>
      ) : null}
      <Text style={s.cardDesc} numberOfLines={4}>{project.description}</Text>
      {(project.discipline || project.location) ? (
        <View style={s.metaRow}>
          {project.discipline ? <Text style={s.metaText}>{project.discipline.toUpperCase()}</Text> : null}
          {project.discipline && project.location ? <Text style={s.metaDivider}>•</Text> : null}
          {project.location ? <Text style={s.metaText}>{project.location.toUpperCase()}</Text> : null}
        </View>
      ) : null}
      {project.budget ? <Text style={s.budgetText}>BUDGET: {project.budget.toUpperCase()}</Text> : null}
      <Text style={s.commentCount}>
        {project.comment_count} {project.comment_count === 1 ? 'COMMENT' : 'COMMENTS'}
      </Text>
    </TouchableOpacity>
  );
}

export default function ProjectsScreen() {
  const navigation = useNavigation<any>();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isArtist, setIsArtist] = useState(false);
  const [disciplineFilter, setDisciplineFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<'discipline' | 'country' | 'city' | null>(null);

  const loadProjects = useCallback(async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, profiles(username, profile_photo_url, full_name)')
      .order('created_at', { ascending: false })
      .limit(60);
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('role, profile_photo_url')
          .eq('id', user.id)
          .single();
        if (prof) {
          setAvatarUri((prof as any).profile_photo_url ?? null);
          const role = (prof as any).role;
          setIsArtist(role === 'ARTIST' || role === 'COLLECTIVE');
        }
      }
      await loadProjects();
    };
    init();
  }, [loadProjects]));

  const availableDisciplines = useMemo(
    () => getUniqueFilterOptions(projects.map((project) => project.discipline)),
    [projects]
  );

  const availableCountries = useMemo(
    () => getUniqueFilterOptions(projects.map((project) => parseLocationParts(project.location).country)),
    [projects]
  );

  const availableCities = useMemo(() => {
    const source = countryFilter
      ? projects.filter(
          (project) =>
            normalizeFilterValue(parseLocationParts(project.location).country) === normalizeFilterValue(countryFilter)
        )
      : projects;
    return getUniqueFilterOptions(source.map((project) => parseLocationParts(project.location).city));
  }, [projects, countryFilter]);

  const filteredProjects = useMemo(() => projects.filter((project) => {
    const location = parseLocationParts(project.location);
    if (disciplineFilter && normalizeFilterValue(project.discipline) !== normalizeFilterValue(disciplineFilter)) return false;
    if (countryFilter && normalizeFilterValue(location.country) !== normalizeFilterValue(countryFilter)) return false;
    if (cityFilter && normalizeFilterValue(location.city) !== normalizeFilterValue(cityFilter)) return false;
    return true;
  }), [projects, disciplineFilter, countryFilter, cityFilter]);

  const handleSelectCountry = (country: string) => {
    setCountryFilter(country);
    setCityFilter(null);
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <MiniLogo />
        <Text style={s.topBarTitle}>Collab</Text>
        <View style={s.topBarRight}>
          <MessageButton onPress={() => navigation.navigate('Inbox')} />
          <BellButton onPress={() => navigation.navigate('Notifications')} />
          <OctagonalImage
            size={24}
            imageUri={avatarUri}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      <View style={s.descriptionRow}>
        <Text style={s.descriptionText}>POST A PROJECT AND FIND COLLABORATORS FOR YOUR CREATIVE VISION</Text>
      </View>

      {/* Filters */}
      <View style={s.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filterScroll}
        >
          <TouchableOpacity
            style={[s.chip, disciplineFilter && s.chipActive]}
            onPress={() => disciplineFilter ? setDisciplineFilter(null) : setActiveModal('discipline')}
            activeOpacity={0.7}
          >
            <Ionicons name="brush-outline" size={12} color={disciplineFilter ? colors.white : colors.red} style={s.chipIcon} />
            <Text style={[s.chipText, disciplineFilter && s.chipTextActive]} numberOfLines={1}>
              {disciplineFilter ? disciplineFilter.toUpperCase() : 'DISCIPLINE'}
            </Text>
            {disciplineFilter ? <Text style={s.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.chip, countryFilter && s.chipActive]}
            onPress={() => countryFilter ? (setCountryFilter(null), setCityFilter(null)) : setActiveModal('country')}
            activeOpacity={0.7}
          >
            <Ionicons name="globe-outline" size={12} color={countryFilter ? colors.white : colors.red} style={s.chipIcon} />
            <Text style={[s.chipText, countryFilter && s.chipTextActive]} numberOfLines={1}>
              {countryFilter ? countryFilter.toUpperCase() : 'COUNTRY'}
            </Text>
            {countryFilter ? <Text style={s.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.chip, cityFilter && s.chipActive]}
            onPress={() => cityFilter ? setCityFilter(null) : setActiveModal('city')}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={12} color={cityFilter ? colors.white : colors.red} style={s.chipIcon} />
            <Text style={[s.chipText, cityFilter && s.chipTextActive]} numberOfLines={1}>
              {cityFilter ? cityFilter.toUpperCase() : 'CITY'}
            </Text>
            {cityFilter ? <Text style={s.chipX}> ✕</Text> : null}
          </TouchableOpacity>

          {(disciplineFilter || countryFilter || cityFilter) ? (
            <TouchableOpacity style={s.chipClear} onPress={() => {
              setDisciplineFilter(null);
              setCountryFilter(null);
              setCityFilter(null);
            }} activeOpacity={0.7}>
              <Text style={s.chipClearText}>CLEAR ALL</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.white} /></View>
      ) : filteredProjects.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>{projects.length === 0 ? 'NO PROJECTS YET' : 'NO MATCHING COLLABS'}</Text>
          <Text style={s.emptySub}>
            {projects.length === 0
              ? 'BE THE FIRST TO POST A COLLABORATION REQUEST'
              : 'TRY ADJUSTING YOUR LOCATION OR DISCIPLINE FILTERS'}
          </Text>
          {(disciplineFilter || countryFilter || cityFilter) ? (
            <TouchableOpacity
              style={s.resetBtn}
              onPress={() => {
                setDisciplineFilter(null);
                setCountryFilter(null);
                setCityFilter(null);
              }}
              activeOpacity={0.7}
            >
              <Text style={s.resetBtnText}>RESET FILTERS</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={filteredProjects}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProjectCard
              project={item}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id })}
              onAuthorPress={() => navigation.navigate('ArtistProfile', { userId: item.user_id })}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.white}
              onRefresh={async () => {
                setRefreshing(true);
                await loadProjects();
                setRefreshing(false);
              }}
            />
          }
        />
      )}

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

      {isArtist ? (
        <TouchableOpacity
          style={s.fab}
          onPress={() => navigation.navigate('PostProject')}
          activeOpacity={0.8}
        >
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      ) : null}
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
  topBarTitle: {
    flex: 1, color: colors.white, fontFamily: MONO,
    fontSize: 13, letterSpacing: 0.18, marginLeft: 10,
  },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  descriptionRow: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  descriptionText: {
    color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2,
  },
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

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24 },
  emptyTitle: {
    color: colors.white, fontFamily: MONO, fontSize: 12,
    letterSpacing: 0.2, textAlign: 'center',
  },
  emptySub: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10,
    letterSpacing: 0.15, textAlign: 'center', lineHeight: 17,
  },
  resetBtn: { borderWidth: 1, borderColor: colors.red, paddingVertical: 8, paddingHorizontal: 16 },
  resetBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  card: {
    marginHorizontal: 14,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    minHeight: 210,
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: '#181818',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 14, gap: 11,
  },
  cardHeaderInfo: { flex: 1 },
  cardUsername: {
    color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12,
  },
  cardTime: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1, marginTop: 4,
  },
  cardTitle: {
    color: colors.white, fontFamily: MONO, fontSize: 18,
    letterSpacing: 0.12, fontWeight: '700', lineHeight: 25, marginBottom: 10,
  },
  cardDesc: {
    color: '#b5b5b5', fontFamily: MONO, fontSize: 12,
    letterSpacing: 0.08, lineHeight: 20, marginBottom: 14,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 12 },
  metaText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  metaDivider: { color: colors.red, fontFamily: MONO, fontSize: 11 },
  budgetText: { color: GOLD, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, marginBottom: 12 },
  closedBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#555555',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 12,
  },
  closedBadgeText: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.14,
  },
  commentCount: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12,
  },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  fabText: { color: colors.white, fontSize: 22, fontFamily: MONO },
});
