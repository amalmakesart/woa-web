import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { useUnread } from '../../contexts/UnreadContext';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  profile_photo_url: string | null;
  art_type: string | null;
  city: string | null;
  country: string | null;
  role: string | null;
  follower_count: number;
  rating: number | null;
  rating_count: number;
}

function MenuRow({ label, badge, onPress, danger }: {
  label: string; badge?: number; onPress: () => void; danger?: boolean;
}) {
  return (
    <TouchableOpacity style={s.menuRow} onPress={onPress} activeOpacity={0.7}>
      <Text style={[s.menuLabel, danger && s.menuLabelDanger]}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        {badge ? (
          <View style={s.badge}><Text style={s.badgeText}>{badge}</Text></View>
        ) : null}
        <Text style={s.menuArrow}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { unreadCount } = useUnread();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_photo_url, art_type, city, country, role, follower_count, rating, rating_count')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof as Profile);

    const { count } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setPostCount(count ?? 0);

    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const handleLogOut = () => {
    Alert.alert('LOG OUT', 'Are you sure you want to log out?', [
      { text: 'CANCEL', style: 'cancel' },
      {
        text: 'LOG OUT', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] });
        },
      },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>MY PROFILE</Text>
      </View>
      <View style={s.center}><ActivityIndicator color={colors.white} /></View>
    </SafeAreaView>
  );

  const isArtist = profile?.role !== 'GIG_POSTER';
  const displayName = profile?.full_name ?? profile?.username ?? '—';
  const location = [profile?.city, profile?.country].filter(Boolean).join(', ');
  const ratingStr = profile?.rating_count
    ? `★ ${(profile.rating ?? 0).toFixed(1)}`
    : '—';

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>MY PROFILE</Text>
        {profile?.username ? (
          <Text style={s.topBarHandle}>@{profile.username.toUpperCase()}</Text>
        ) : null}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Profile top */}
        <View style={s.profileTop}>
          <OctagonalImage size={48} imageUri={profile?.profile_photo_url ?? null} />
          <View style={s.profileInfo}>
            <Text style={s.profileName}>{displayName.toUpperCase()}</Text>
            {profile?.username ? (
              <Text style={s.profileHandle}>@{profile.username.toUpperCase()}</Text>
            ) : null}
            {(profile?.art_type || location) ? (
              <Text style={s.profileMeta}>
                {[profile?.art_type, location].filter(Boolean).join(' · ').toUpperCase()}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            style={s.editBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
          >
            <Text style={s.editBtnText}>EDIT</Text>
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCell}>
            <Text style={s.statNumber}>{postCount}</Text>
            <Text style={s.statLabel}>POSTS</Text>
          </View>
          <View style={[s.statCell, s.statCellBorder]}>
            <Text style={s.statNumber}>{profile?.follower_count ?? 0}</Text>
            <Text style={s.statLabel}>FOLLOWERS</Text>
          </View>
          <View style={s.statCell}>
            <Text style={[s.statNumber, profile?.rating_count ? s.statNumberRed : {}]}>{ratingStr}</Text>
            <Text style={s.statLabel}>RATING</Text>
          </View>
        </View>

        {/* Pro banner (artists only, always show for now — stripe pending) */}
        {isArtist && (
          <TouchableOpacity
            style={s.proBanner}
            onPress={() => Alert.alert('ARTIST PRO', 'Stripe subscription coming soon.')}
            activeOpacity={0.8}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.proTitle}>UPGRADE TO ARTIST PRO</Text>
              <Text style={s.proSub}>BOOST YOUR PROFILE VISIBILITY</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.proPrice}>$3.99</Text>
              <Text style={s.proMonth}>/MONTH</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Menu */}
        <View style={s.menuSection}>
          {isArtist ? (
            <>
              <MenuRow label="MY POSTS" onPress={() => navigation.navigate('MyPosts')} />
              <MenuRow label="SAVED POSTS" onPress={() => navigation.navigate('Bookmarks')} />
              <MenuRow label="EDIT PROFILE" onPress={() => navigation.navigate('EditProfile')} />
              <MenuRow label="MESSAGES" badge={unreadCount || undefined} onPress={() => navigation.navigate('Inbox')} />
              <MenuRow label="NOTIFICATIONS" onPress={() => Alert.alert('NOTIFICATIONS', 'Notifications coming soon.')} />
              <MenuRow label="SETTINGS" onPress={() => navigation.navigate('Settings')} />
            </>
          ) : (
            <>
              <MenuRow label="MESSAGES" badge={unreadCount || undefined} onPress={() => navigation.navigate('Inbox')} />
              <MenuRow label="MY GIGS" onPress={() => navigation.reset({
                index: 0,
                routes: [{
                  name: 'Main',
                  state: {
                    index: 2,
                    routes: [
                      { name: 'Feed' },
                      { name: 'Artists' },
                      { name: 'Gigs' },
                      { name: 'Features' },
                    ],
                  },
                }],
              })} />
              <MenuRow label="EDIT PROFILE" onPress={() => navigation.navigate('EditProfile')} />
              <MenuRow label="SETTINGS" onPress={() => navigation.navigate('Settings')} />
            </>
          )}
          <MenuRow label="LOG OUT" onPress={handleLogOut} danger />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { marginRight: 8, padding: 4 },
  backArrow: { color: colors.white, fontSize: 28, lineHeight: 32, fontFamily: MONO },
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarHandle: { color: '#444444', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12 },

  profileTop: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  profileInfo: { flex: 1 },
  profileName: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.16, marginBottom: 4 },
  profileHandle: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.12, marginBottom: 3 },
  profileMeta: { color: '#444444', fontFamily: MONO, fontSize: 7, letterSpacing: 0.1 },
  editBtn: {
    borderWidth: 1, borderColor: '#333333',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  editBtnText: { color: '#555555', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15 },

  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#111111' },
  statNumber: { color: colors.white, fontFamily: MONO, fontSize: 16, letterSpacing: 0.1 },
  statNumberRed: { color: colors.red },
  statLabel: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15, marginTop: 3 },

  proBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#0a0000',
    borderWidth: 1, borderColor: colors.red,
    padding: 14,
  },
  proTitle: { color: colors.red, fontFamily: MONO, fontSize: 7, letterSpacing: 0.15, marginBottom: 3 },
  proSub: { color: colors.red, fontFamily: MONO, fontSize: 6, letterSpacing: 0.12, opacity: 0.7 },
  proPrice: { color: colors.red, fontFamily: MONO, fontSize: 16, letterSpacing: 0.1 },
  proMonth: { color: colors.red, fontFamily: MONO, fontSize: 5, letterSpacing: 0.12, opacity: 0.7 },

  menuSection: { marginTop: 16 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 44,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
  },
  menuLabel: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  menuLabelDanger: { color: '#555555' },
  menuArrow: { color: '#333333', fontFamily: MONO, fontSize: 14 },
  badge: {
    backgroundColor: colors.red, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
    minWidth: 16, alignItems: 'center',
  },
  badgeText: { color: colors.white, fontFamily: MONO, fontSize: 7 },
});
