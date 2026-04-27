import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Keyboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';

type Tab = 'artists' | 'gigs' | 'posts';

interface ArtistResult {
  id: string;
  full_name: string | null;
  username: string | null;
  discipline: string | null;
  art_type: string | null;
  art_types: string[] | null;
  city: string | null;
  country: string | null;
  profile_photo_url: string | null;
  is_available: boolean;
}

interface GigResult {
  id: string;
  title: string;
  art_type: string | null;
  location: string | null;
  date_timeframe: string | null;
  budget_min: number | null;
  budget_max: number | null;
  status: string;
  interest_count: number;
}

interface PostResult {
  id: string;
  type: string;
  title: string | null;
  content: string | null;
  media_url: string | null;
  like_count: number;
  user_id: string;
  profiles: {
    username: string | null;
    full_name: string | null;
    profile_photo_url: string | null;
  } | null;
}

// ─── Result Row Components ────────────────────────────────────────────────────

function ArtistRow({ item, onPress }: { item: ArtistResult; onPress: () => void }) {
  const name = (item.full_name ?? item.username ?? 'UNKNOWN').toUpperCase();
  const discipline = (item.discipline ?? item.art_type ?? '').toUpperCase();
  const tags = (item.art_types ?? []).slice(0, 3).join(' · ').toUpperCase();
  const location = [item.city, item.country].filter(Boolean).join(', ').toUpperCase();

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
      <OctagonalImage size={44} imageUri={item.profile_photo_url} />
      <View style={s.rowInfo}>
        <Text style={s.rowTitle} numberOfLines={1}>{name}</Text>
        {discipline ? <Text style={s.rowSub} numberOfLines={1}>{discipline}</Text> : null}
        {tags ? <Text style={s.rowMeta} numberOfLines={1}>TAGS · {tags}</Text> : null}
        {location ? <Text style={s.rowMeta} numberOfLines={1}>{location}</Text> : null}
      </View>
      {item.is_available ? (
        <View style={s.availBadge}>
          <Text style={s.availText}>AVAIL</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function GigRow({ item, onPress }: { item: GigResult; onPress: () => void }) {
  const isActive = item.status === 'active';
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
      <View style={s.gigIconWrap}>
        <Ionicons name="briefcase-outline" size={20} color={colors.red} />
      </View>
      <View style={s.rowInfo}>
        <Text style={s.rowTitle} numberOfLines={1}>{item.title.toUpperCase()}</Text>
        <Text style={s.rowSub} numberOfLines={1}>
          {[item.art_type, item.location].filter(Boolean).join(' · ').toUpperCase()}
        </Text>
        {item.date_timeframe ? (
          <Text style={s.rowMeta} numberOfLines={1}>{item.date_timeframe.toUpperCase()}</Text>
        ) : null}
      </View>
      <View style={[s.statusDot, isActive ? s.statusDotActive : s.statusDotClosed]} />
    </TouchableOpacity>
  );
}

function PostRow({ item, onPress }: { item: PostResult; onPress: () => void }) {
  const name = (item.profiles?.full_name ?? item.profiles?.username ?? '').toUpperCase();
  const preview = item.title ?? (item.content ?? '').slice(0, 60);

  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.8}>
      {item.type === 'image' && item.media_url ? (
        <Image source={{ uri: item.media_url }} style={s.postThumb} resizeMode="cover" />
      ) : (
        <View style={s.postIconWrap}>
          <Ionicons
            name={item.type === 'audio' ? 'musical-notes-outline' : 'document-text-outline'}
            size={20}
            color="#9a9a9a"
          />
        </View>
      )}
      <View style={s.rowInfo}>
        <Text style={s.rowTitle} numberOfLines={1}>{preview.toUpperCase()}</Text>
        <Text style={s.rowMeta} numberOfLines={1}>BY {name}</Text>
      </View>
      <View style={s.likeRow}>
        <Ionicons name="heart-outline" size={11} color="#9a9a9a" />
        <Text style={s.likeCount}>{item.like_count}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Empty / Loading ──────────────────────────────────────────────────────────

function EmptyResults({ query, tab }: { query: string; tab: Tab }) {
  if (!query.trim()) {
    return (
      <View style={s.emptyWrap}>
        <Text style={s.emptyIcon}>⌕</Text>
        <Text style={s.emptyTitle}>SEARCH WORK(ER) OF ART</Text>
        <Text style={s.emptySub}>FIND ARTISTS, GIGS AND POSTS</Text>
      </View>
    );
  }
  return (
    <View style={s.emptyWrap}>
      <Text style={s.emptyTitle}>NO {tab.toUpperCase()} FOUND</Text>
      <Text style={s.emptySub}>TRY A DIFFERENT SEARCH TERM</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('artists');
  const [loading, setLoading] = useState(false);

  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [gigs, setGigs] = useState<GigResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setArtists([]); setGigs([]); setPosts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const term = q.trim().toLowerCase();
    const like = `%${term}%`;

    const [artistRes, gigRes, postRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, username, discipline, art_type, art_types, city, country, profile_photo_url, is_available')
        .eq('role', 'ARTIST')
        .limit(200),

      supabase
        .from('gigs')
        .select('id, title, art_type, location, date_timeframe, budget_min, budget_max, status, interest_count')
        .or(`title.ilike.${like},art_type.ilike.${like},location.ilike.${like},description.ilike.${like}`)
        .limit(20),

      supabase
        .from('posts')
        .select('id, type, title, content, media_url, like_count, user_id, profiles(username, full_name, profile_photo_url)')
        .or(`title.ilike.${like},content.ilike.${like}`)
        .limit(20),
    ]);

    const artistMatches = ((artistRes.data ?? []) as ArtistResult[])
      .filter((artist) => {
        const fields = [
          artist.full_name,
          artist.username,
          artist.discipline,
          artist.art_type,
          artist.city,
          artist.country,
          ...(artist.art_types ?? []),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return fields.includes(term);
      })
      .slice(0, 30);

    setArtists(artistMatches);
    setGigs((gigRes.data ?? []) as GigResult[]);
    setPosts((postRes.data ?? []) as unknown as PostResult[]);
    setLoading(false);
  }, []);

  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(text), 350);
  };

  const handleClear = () => {
    setQuery('');
    setArtists([]); setGigs([]); setPosts([]);
    inputRef.current?.focus();
  };

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'artists', label: 'ARTISTS', count: artists.length },
    { key: 'gigs',    label: 'GIGS',    count: gigs.length },
    { key: 'posts',   label: 'POSTS',   count: posts.length },
  ];

  const renderContent = () => {
    if (loading) {
      return (
        <View style={s.loadingWrap}>
          <ActivityIndicator color={colors.white} size="small" />
        </View>
      );
    }

    if (activeTab === 'artists') {
      return (
        <FlatList
          data={artists}
          keyExtractor={i => i.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <ArtistRow item={item} onPress={() => {
              Keyboard.dismiss();
              navigation.navigate('ArtistProfile', { userId: item.id });
            }} />
          )}
          ListEmptyComponent={<EmptyResults query={query} tab="artists" />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      );
    }

    if (activeTab === 'gigs') {
      return (
        <FlatList
          data={gigs}
          keyExtractor={i => i.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <GigRow item={item} onPress={() => {
              Keyboard.dismiss();
              navigation.navigate('GigDetail', { gigId: item.id });
            }} />
          )}
          ListEmptyComponent={<EmptyResults query={query} tab="gigs" />}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      );
    }

    return (
      <FlatList
        data={posts}
        keyExtractor={i => i.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <PostRow item={item} onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('PostDetail', { postId: item.id });
          }} />
        )}
        ListEmptyComponent={<EmptyResults query={query} tab="posts" />}
        ItemSeparatorComponent={() => <View style={s.separator} />}
      />
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>

      {/* SEARCH BAR */}
      <View style={s.searchBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Ionicons name="search-outline" size={18} color="#9a9a9a" style={s.searchIcon} />
        <TextInput
          ref={inputRef}
          style={s.searchInput}
          placeholder="SEARCH NAMES, TAGS, CITIES, GIGS..."
          placeholderTextColor="#9a9a9a"
          value={query}
          onChangeText={handleQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          autoFocus
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={handleClear} activeOpacity={0.7} style={s.clearBtn}>
            <Ionicons name="close-circle" size={18} color="#9a9a9a" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* TABS */}
      <View style={s.tabBar}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
              {tab.label}
            </Text>
            {query.trim() && tab.count > 0 ? (
              <View style={s.tabBadge}>
                <Text style={s.tabBadgeText}>{tab.count}</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        ))}
      </View>

      {/* RESULTS */}
      {renderContent()}

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },

  // Search bar
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    gap: 10,
  },
  backBtn: { paddingRight: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  searchIcon: { flexShrink: 0 },
  searchInput: {
    flex: 1,
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.1,
    paddingVertical: 6,
  },
  clearBtn: { padding: 2 },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.red },
  tabLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.18 },
  tabLabelActive: { color: colors.white },
  tabBadge: {
    backgroundColor: colors.red,
    borderRadius: 8, minWidth: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: colors.white, fontFamily: MONO, fontSize: 10, fontWeight: '700' },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowInfo: { flex: 1 },
  rowTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12, marginBottom: 3 },
  rowSub: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, marginBottom: 2 },
  rowMeta: { color: '#777777', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  separator: { height: 1, backgroundColor: '#0d0d0d', marginLeft: 72 },

  // Artist row extras
  availBadge: {
    borderWidth: 1, borderColor: '#2a7a4f',
    paddingHorizontal: 6, paddingVertical: 3,
  },
  availText: { color: '#2a7a4f', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },

  // Gig row extras
  gigIconWrap: {
    width: 44, height: 44,
    borderWidth: 1, borderColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusDotActive: { backgroundColor: '#2a7a4f' },
  statusDotClosed: { backgroundColor: '#333333' },

  // Post row extras
  postThumb: { width: 44, height: 44 },
  postIconWrap: {
    width: 44, height: 44,
    backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#1a1a1a',
    alignItems: 'center', justifyContent: 'center',
  },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  likeCount: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11 },

  // Empty / loading
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyIcon: { color: '#222222', fontSize: 48, marginBottom: 8 },
  emptyTitle: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
  emptySub: { color: '#4a4a4a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
});
