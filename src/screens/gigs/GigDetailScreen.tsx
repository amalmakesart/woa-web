import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { Gig, formatBudget } from '../../components/GigCard';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

interface Poster {
  full_name: string | null;
  username: string | null;
  profile_photo_url: string | null;
}

export default function GigDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { gigId } = route.params;

  const [gig, setGig] = useState<Gig | null>(null);
  const [poster, setPoster] = useState<Poster | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [hasExpressedInterest, setHasExpressedInterest] = useState(false);
  const [interestCount, setInterestCount] = useState(0);

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const uid = user?.id ?? null;
    setCurrentUserId(uid);

    if (uid) {
      const { data: me } = await supabase
        .from('profiles')
        .select('role, profile_photo_url')
        .eq('id', uid)
        .single();
      if (me) {
        setCurrentUserRole((me as any).role ?? null);
        setCurrentUserAvatar((me as any).profile_photo_url ?? null);
      }
    }

    const { data: gigData } = await supabase
      .from('gigs')
      .select('*')
      .eq('id', gigId)
      .single();

    if (gigData) {
      setGig(gigData as Gig);

      const { data: posterData } = await supabase
        .from('profiles')
        .select('full_name, username, profile_photo_url')
        .eq('id', (gigData as any).poster_id)
        .single();
      if (posterData) setPoster(posterData as Poster);
    }

    // Count directly from gig_interests — reliable regardless of trigger status
    const { count } = await supabase
      .from('gig_interests')
      .select('*', { count: 'exact', head: true })
      .eq('gig_id', gigId);
    setInterestCount(count ?? 0);

    if (uid) {
      const { data: interest } = await supabase
        .from('gig_interests')
        .select('id')
        .eq('gig_id', gigId)
        .eq('artist_id', uid)
        .maybeSingle();
      setHasExpressedInterest(!!interest);
    }

    setLoading(false);
  }, [gigId]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const posterName = poster?.full_name ?? poster?.username ?? 'UNKNOWN';
  const isArtist = currentUserRole === 'ARTIST';
  const isOwnGig = currentUserId === gig?.poster_id;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>GIGS</Text>
          </TouchableOpacity>
          <View style={styles.topBarRight}>
            <View style={styles.notifDot} />
            <OctagonalImage size={24} imageUri={currentUserAvatar} />
          </View>
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={colors.white} />
        </View>
      </SafeAreaView>
    );
  }

  if (!gig) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backArrow}>‹</Text>
            <Text style={styles.backLabel}>GIGS</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.center}>
          <Text style={styles.notFound}>GIG NOT FOUND</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>GIGS</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <View style={styles.notifDot} />
          <OctagonalImage
            size={24}
            imageUri={currentUserAvatar}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Type + Location badge */}
        <View style={styles.badgeRow}>
          {gig.art_type ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{gig.art_type.toUpperCase()}</Text>
            </View>
          ) : null}
          {gig.location ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{gig.location.toUpperCase()}</Text>
            </View>
          ) : null}
          {gig.is_featured ? (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredBadgeText}>FEATURED</Text>
            </View>
          ) : null}
        </View>

        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.gigTitle}>{gig.title.toUpperCase()}</Text>
          {(gig as any).company_name ? (
            <Text style={styles.companyName}>{(gig as any).company_name.toUpperCase()}</Text>
          ) : null}
        </View>

        {/* Poster row */}
        <View style={styles.posterRow}>
          <OctagonalImage
            size={22}
            imageUri={poster?.profile_photo_url}
          />
          <View style={styles.posterInfo}>
            <Text style={styles.posterName}>{posterName.toUpperCase()}</Text>
            <Text style={styles.posterRole}>GIG POSTER</Text>
          </View>
        </View>

        {/* Description */}
        {gig.description ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DESCRIPTION</Text>
            <Text style={styles.descriptionText}>{gig.description.toUpperCase()}</Text>
          </View>
        ) : null}

        {/* Details rows */}
        <View style={styles.section}>
          {gig.date_timeframe ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TIMEFRAME</Text>
              <Text style={styles.detailValue}>{gig.date_timeframe.toUpperCase()}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>BUDGET</Text>
            <Text style={styles.budgetValue}>
              {formatBudget(gig.budget_min, gig.budget_max)}
            </Text>
          </View>
        </View>

        {/* Interest count box */}
        <View style={styles.interestBox}>
          <Text style={styles.interestNumber}>{interestCount}</Text>
          <Text style={styles.interestLabel}>ARTISTS HAVE EXPRESSED INTEREST</Text>
        </View>

        {/* Express interest (only for Artists, not own gig) */}
        {isArtist && !isOwnGig ? (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[
                styles.interestBtn,
                hasExpressedInterest && styles.interestBtnDone,
              ]}
              onPress={() => {
                if (!hasExpressedInterest) {
                  navigation.navigate('ExpressInterest', {
                    gigId: gig.id,
                    gigTitle: gig.title,
                    posterName,
                    gigLocation: gig.location,
                  });
                }
              }}
              activeOpacity={hasExpressedInterest ? 1 : 0.7}
              disabled={hasExpressedInterest}
            >
              <Text style={[
                styles.interestBtnText,
                hasExpressedInterest && styles.interestBtnTextDone,
              ]}>
                {hasExpressedInterest ? '✓ INTEREST EXPRESSED' : 'EXPRESS INTEREST'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.interestNote}>
              YOUR PROFILE WILL BE ATTACHED AUTOMATICALLY
            </Text>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  scroll: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFound: { color: '#666666', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#666666', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },

  badgeRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0,
  },
  badge: {
    borderWidth: 1, borderColor: '#333333',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { color: '#555555', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15 },
  featuredBadge: {
    borderWidth: 1, borderColor: colors.red,
    backgroundColor: '#0f0000',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  featuredBadgeText: { color: colors.red, fontFamily: MONO, fontSize: 6, letterSpacing: 0.12 },

  titleSection: {
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  gigTitle: {
    color: colors.white, fontFamily: MONO,
    fontSize: 12, letterSpacing: 0.18, lineHeight: 20,
  },
  companyName: {
    color: '#666666', fontFamily: MONO,
    fontSize: 7, letterSpacing: 0.1, marginTop: 4,
  },

  posterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  posterInfo: { flex: 1 },
  posterName: { color: '#666666', fontFamily: MONO, fontSize: 7, letterSpacing: 0.12 },
  posterRole: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.12, marginTop: 2 },

  section: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  sectionLabel: {
    color: '#333333', fontFamily: MONO, fontSize: 6,
    letterSpacing: 0.2, marginBottom: 8,
  },
  descriptionText: {
    color: '#777777', fontFamily: MONO,
    fontSize: 7, letterSpacing: 0.08, lineHeight: 13,
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#0a0a0a',
  },
  detailLabel: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.18 },
  detailValue: { color: colors.white, fontFamily: MONO, fontSize: 7, letterSpacing: 0.1 },
  budgetValue: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.12 },

  interestBox: {
    alignItems: 'center', paddingVertical: 20,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#111111',
    marginVertical: 0,
  },
  interestNumber: { color: colors.red, fontFamily: MONO, fontSize: 28, letterSpacing: 0.1 },
  interestLabel: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15, marginTop: 4 },

  actionSection: { paddingHorizontal: 16, paddingTop: 20 },
  interestBtn: {
    borderWidth: 1, borderColor: colors.red,
    height: 44, alignItems: 'center', justifyContent: 'center',
  },
  interestBtnDone: { borderColor: '#333333' },
  interestBtnText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.22 },
  interestBtnTextDone: { color: '#333333' },
  interestNote: {
    color: '#333333', fontFamily: MONO, fontSize: 6,
    letterSpacing: 0.12, textAlign: 'center', marginTop: 10,
  },
});
