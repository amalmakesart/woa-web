import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, SafeAreaView, Alert, ActivityIndicator, Modal, Share,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { buildProfileShareUrl } from '../../lib/shareLinks';
import OctagonalImage from '../../components/OctagonalImage';
import { useUnread } from '../../contexts/UnreadContext';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const ADMIN_EMAIL = 'amalmakesart@gmail.com';
interface Profile {
  is_verified: boolean;
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
  const [followingCount, setFollowingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showVerifiedCheckout, setShowVerifiedCheckout] = useState(false);
  const [checkoutVersion] = useState(() => Date.now().toString());
  const [isAdmin, setIsAdmin] = useState(false);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setIsAdmin((user.email ?? '').toLowerCase() === ADMIN_EMAIL);

    const { data: prof } = await supabase
      .from('profiles')
      .select('id, full_name, username, profile_photo_url, art_type, city, country, role, follower_count, rating, rating_count, is_verified')
      .eq('id', user.id)
      .single();
    if (prof) setProfile(prof as Profile);

    const { count: ownedPostCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    const { count: collaboratorPostCount } = await supabase
      .from('post_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('collaborator_id', user.id)
      .eq('accepted', true);
    setPostCount((ownedPostCount ?? 0) + (collaboratorPostCount ?? 0));

    const { count: following } = await supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id);
    setFollowingCount(following ?? 0);

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

  const handleShareProfile = async () => {
    if (!profile) return;
    const url = buildProfileShareUrl(profile.id);
    const name = profile.full_name ?? profile.username ?? 'My profile';
    try {
      await Share.share({
        title: `${name} on WORK(ER) OF ART`,
        message: `${name} on WORK(ER) OF ART\n${url}`,
        url,
      });
    } catch {
      /* user cancelled */
    }
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

  const normalizedRole = (profile?.role ?? '').toUpperCase();
  const isGigPoster = normalizedRole === 'GIG_POSTER';
  const isCreative = normalizedRole === 'ARTIST' || normalizedRole === 'COLLECTIVE';
  const canBeVerified = normalizedRole === 'ARTIST';
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
          <OctagonalImage
            size={48}
            imageUri={profile?.profile_photo_url ?? null}
            onPress={() => {
              if (isCreative && profile?.id) {
                navigation.navigate('ArtistProfile', { userId: profile.id });
              }
            }}
          />
          <View style={s.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
  <Text style={s.profileName}>{displayName.toUpperCase()}</Text>
  {profile?.is_verified ? (
    <Text style={{ color: '#f6c55a', fontSize: 14 }}>✓</Text>
  ) : null}
</View>
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
          <TouchableOpacity
            style={[s.statCell, s.statCellBorder]}
            onPress={() => navigation.navigate('FollowList', {
              userId: profile?.id,
              mode: 'followers',
              title: 'FOLLOWERS',
            })}
            activeOpacity={0.7}
          >
            <Text style={s.statNumber}>{profile?.follower_count ?? 0}</Text>
            <Text style={s.statLabel}>FOLLOWERS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.statCell, s.statCellBorder]}
            onPress={() => navigation.navigate('FollowList', {
              userId: profile?.id,
              mode: 'following',
              title: 'FOLLOWING',
            })}
            activeOpacity={0.7}
          >
            <Text style={s.statNumber}>{followingCount}</Text>
            <Text style={s.statLabel}>FOLLOWING</Text>
          </TouchableOpacity>
          <View style={s.statCell}>
            <Text style={[s.statNumber, profile?.rating_count ? s.statNumberRed : {}]}>{ratingStr}</Text>
            <Text style={s.statLabel}>RATING</Text>
          </View>
        </View>

        {/* Get Verified banner (artists only) */}
        {canBeVerified && !profile?.is_verified && (
          <TouchableOpacity
            style={s.verifiedBanner}
            onPress={() => {
              const meetsPostReq = postCount >= 6;
              const meetsFollowReq = (profile?.follower_count ?? 0) + followingCount >= 15;
              if (!meetsPostReq || !meetsFollowReq) {
                Alert.alert(
                  'NOT ELIGIBLE YET',
                  `TO GET VERIFIED YOU NEED:\n\n` +
                  `• AT LEAST 6 POSTS  (YOU HAVE ${postCount})\n` +
                  `• AT LEAST 15 FOLLOWERS + FOLLOWING COMBINED  (YOU HAVE ${(profile?.follower_count ?? 0) + followingCount})`,
                  [{ text: 'GOT IT' }]
                );
                return;
              }
              setShowVerifiedCheckout(true);
            }}
            activeOpacity={0.8}
          >
            <View style={s.verifiedBannerLeft}>
              <View style={s.verifiedLogoRow}>
                <View style={s.verifiedBox}>
                  <Text style={s.verifiedWoa}>WOA</Text>
                  <View style={s.verifiedDot} />
                </View>
                <Text style={s.verifiedTitle}>GET VERIFIED</Text>
              </View>
              <Text style={s.verifiedSub}>ONLY VERIFIED ARTISTS WILL BE SCOUTED & FEATURED BY WOA</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.verifiedPrice}>$30</Text>
              <Text style={s.verifiedMonth}>one time payment</Text>
            </View>
          </TouchableOpacity>
        )}


        {/* Verified checkout WebView modal */}
        <Modal
          visible={showVerifiedCheckout}
          animationType="slide"
          onRequestClose={() => setShowVerifiedCheckout(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
            <View style={s.webViewTopBar}>
              <TouchableOpacity
                onPress={() => setShowVerifiedCheckout(false)}
                style={s.webViewCloseBtn}
                activeOpacity={0.7}
              >
                <Text style={s.webViewCloseText}>✕ CLOSE</Text>
              </TouchableOpacity>
              <Text style={s.webViewTitle}>GET VERIFIED</Text>
              <View style={{ width: 80 }} />
            </View>
            <WebView
              source={{ uri: `https://workerofart.com/checkout/verified.html?v=${checkoutVersion}&user_id=${profile?.id}` }}
              style={{ flex: 1 }}
              cacheEnabled={false}
              incognito
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.type === 'verified_success') {
                    setShowVerifiedCheckout(false);
                    Alert.alert(
                      "YOU'RE VERIFIED ✓",
                      'Your WOA verified badge is now active.',
                      [{ text: 'GREAT', onPress: () => loadData() }]
                    );
                  }
                } catch {}
              }}
            />
          </SafeAreaView>
        </Modal>

        {/* Menu */}
        <View style={s.menuSection}>
          {isCreative ? (
            <>
              <MenuRow label="MY POSTS" onPress={() => navigation.navigate('MyPosts')} />
              <MenuRow label="MY PORTFOLIO" onPress={() => navigation.navigate('ManagePortfolio')} />
              <MenuRow label="MY SHOWS" onPress={() => navigation.navigate('ManageShows')} />
              <MenuRow label="SAVED POSTS" onPress={() => navigation.navigate('Bookmarks')} />
              <MenuRow label="SHARE PROFILE" onPress={handleShareProfile} />
              <MenuRow label="EDIT PROFILE" onPress={() => navigation.navigate('EditProfile')} />
              <MenuRow label="MESSAGES" badge={unreadCount || undefined} onPress={() => navigation.navigate('Inbox')} />
              <MenuRow label="NOTIFICATIONS" onPress={() => navigation.navigate('Notifications')} />
              {isAdmin ? <MenuRow label="MODERATION" onPress={() => navigation.navigate('Moderation')} /> : null}
              <MenuRow label="SETTINGS" onPress={() => navigation.navigate('Settings')} />
            </>
          ) : isGigPoster ? (
            <>
              <MenuRow label="SAVED POSTS" onPress={() => navigation.navigate('Bookmarks')} />
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
              <MenuRow label="SHARE PROFILE" onPress={handleShareProfile} />
              <MenuRow label="EDIT PROFILE" onPress={() => navigation.navigate('EditProfile')} />
              {isAdmin ? <MenuRow label="MODERATION" onPress={() => navigation.navigate('Moderation')} /> : null}
              <MenuRow label="SETTINGS" onPress={() => navigation.navigate('Settings')} />
            </>
          ) : (
            <>
              <MenuRow label="SAVED POSTS" onPress={() => navigation.navigate('Bookmarks')} />
              <MenuRow label="SHARE PROFILE" onPress={handleShareProfile} />
              <MenuRow label="EDIT PROFILE" onPress={() => navigation.navigate('EditProfile')} />
              <MenuRow label="NOTIFICATIONS" onPress={() => navigation.navigate('Notifications')} />
              {isAdmin ? <MenuRow label="MODERATION" onPress={() => navigation.navigate('Moderation')} /> : null}
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
  topBarHandle: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },

  profileTop: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  profileInfo: { flex: 1 },
  profileName: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.16, marginBottom: 4 },
  profileHandle: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, marginBottom: 4 },
  profileMeta: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 16 },
  editBtn: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 10, paddingVertical: 6,
  },
  editBtnText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  statsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statCellBorder: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#111111' },
  statNumber: { color: colors.white, fontFamily: MONO, fontSize: 16, letterSpacing: 0.1 },
  statNumberRed: { color: colors.red },
  statLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginTop: 4 },

  verifiedBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 16,
    backgroundColor: '#0a0800',
    borderWidth: 1, borderColor: '#f6c55a',
    padding: 14,
  },
  verifiedBannerLeft: { flex: 1, paddingRight: 12 },
  verifiedLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  verifiedBox: {
    backgroundColor: colors.black,
    borderWidth: 1, borderColor: '#f6c55a',
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 4, paddingVertical: 2, gap: 3,
  },
  verifiedWoa: { color: '#f6c55a', fontFamily: MONO, fontSize: 11, fontWeight: '700', letterSpacing: 0.1 },
  verifiedDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.red },
  verifiedTitle: { color: '#f6c55a', fontFamily: MONO, fontSize: 12, letterSpacing: 0.2, fontWeight: '700' },
  verifiedSub: { color: '#d6b95a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 16 },
  verifiedPrice: { color: '#f6c55a', fontFamily: MONO, fontSize: 16, letterSpacing: 0.1 },
  verifiedMonth: { color: '#d6b95a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },

  menuSection: { marginTop: 16 },
  menuRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 52,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
  },
  menuLabel: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15 },
  menuLabelDanger: { color: colors.red },
  menuArrow: { color: '#9a9a9a', fontFamily: MONO, fontSize: 18 },
  badge: {
    backgroundColor: colors.red, borderRadius: 8,
    paddingHorizontal: 5, paddingVertical: 1,
    minWidth: 16, alignItems: 'center',
  },
  badgeText: { color: colors.white, fontFamily: MONO, fontSize: 11 },
  webViewTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
    backgroundColor: '#000000',
  },
  webViewCloseBtn: { padding: 4, minWidth: 80 },
  webViewCloseText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  webViewTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
});
