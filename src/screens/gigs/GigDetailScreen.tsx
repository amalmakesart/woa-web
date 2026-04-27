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
  Image,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
        .from('profiles').select('role, profile_photo_url').eq('id', uid).single();
      if (me) {
        setCurrentUserRole((me as any).role ?? null);
        setCurrentUserAvatar((me as any).profile_photo_url ?? null);
      }
    }

    const { data: gigData } = await supabase
      .from('gigs').select('*').eq('id', gigId).single();

    if (gigData) {
      setGig(gigData as Gig);
      const { data: posterData } = await supabase
        .from('profiles').select('full_name, username, profile_photo_url')
        .eq('id', (gigData as any).poster_id).single();
      if (posterData) setPoster(posterData as Poster);
    }

    const { count } = await supabase
      .from('gig_interests').select('*', { count: 'exact', head: true }).eq('gig_id', gigId);
    setInterestCount(count ?? 0);

    if (uid) {
      const { data: interest } = await supabase
        .from('gig_interests').select('id')
        .eq('gig_id', gigId).eq('artist_id', uid).maybeSingle();
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
            <OctagonalImage size={24} imageUri={currentUserAvatar} />
          </View>
        </View>
        <View style={styles.center}><ActivityIndicator color={colors.white} /></View>
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
        <View style={styles.center}><Text style={styles.notFound}>GIG NOT FOUND</Text></View>
      </SafeAreaView>
    );
  }

  const gigImageUrl = (gig as any).image_url ?? null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>GIGS</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <OctagonalImage
            size={24}
            imageUri={currentUserAvatar}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* GIG IMAGE */}
        {gigImageUrl ? (
          <Image source={{ uri: gigImageUrl }} style={styles.gigImage} resizeMode="cover" />
        ) : null}

        {/* ART TYPE — large red box at top */}
        {gig.art_type ? (
          <View style={styles.artTypeBox}>
            <Text style={styles.artTypeText}>{gig.art_type.toUpperCase()}</Text>
            {gig.is_featured ? (
              <View style={styles.featuredBadge}>
                <Text style={styles.featuredBadgeText}>FEATURED</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* LOCATION — large red with pin icon */}
        {gig.location ? (
          <View style={styles.locationBar}>
            <Ionicons name="location" size={18} color={colors.red} />
            <Text style={styles.locationText}>{gig.location.toUpperCase()}</Text>
          </View>
        ) : null}

        {/* POSTER + TITLE */}
        <View style={styles.titleSection}>
          <OctagonalImage
            size={44}
            imageUri={poster?.profile_photo_url ?? null}
            style={styles.posterPhoto}
          />
          <View style={styles.titleInfo}>
            <Text style={styles.gigTitle}>{gig.title.toUpperCase()}</Text>
            {(gig as any).company_name ? (
              <Text style={styles.companyName}>{(gig as any).company_name.toUpperCase()}</Text>
            ) : null}
            <Text style={styles.posterName}>{posterName.toUpperCase()} · GIG POSTER</Text>
          </View>
        </View>

        {/* DETAILS */}
        <View style={styles.detailsSection}>
          {gig.date_timeframe ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>DATE / TIME</Text>
              <Text style={styles.detailValue}>{gig.date_timeframe.toUpperCase()}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>BUDGET</Text>
            <Text style={styles.budgetValue}>{formatBudget(gig.budget_min, gig.budget_max)}</Text>
          </View>
        </View>

        {/* DESCRIPTION */}
        {gig.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descLabel}>DESCRIPTION</Text>
            <Text style={styles.descText}>{gig.description}</Text>
          </View>
        ) : null}

        {/* INTEREST COUNT */}
        <View style={styles.interestBox}>
          <Text style={styles.interestNumber}>{interestCount}</Text>
          <Text style={styles.interestLabel}>ARTISTS INTERESTED</Text>
        </View>

        {/* EXPRESS INTEREST */}
        {isArtist && !isOwnGig ? (
          <View style={styles.actionSection}>
            <TouchableOpacity
              style={[styles.interestBtn, hasExpressedInterest && styles.interestBtnDone]}
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
              <Text style={[styles.interestBtnText, hasExpressedInterest && styles.interestBtnTextDone]}>
                {hasExpressedInterest ? '✓ INTEREST EXPRESSED' : 'EXPRESS INTEREST'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.interestNote}>YOUR PROFILE WILL BE ATTACHED AUTOMATICALLY</Text>
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
  notFound: { color: '#b5b5b5', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  // Gig image
  gigImage: {
    width: '100%',
    height: 200,
  },

  // Art type — large red box
  artTypeBox: {
    backgroundColor: colors.red,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  artTypeText: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  featuredBadge: {
    borderWidth: 1,
    borderColor: colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  featuredBadgeText: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.12 },

  // Location bar
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  locationText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 16,
    letterSpacing: 0.15,
    fontWeight: '700',
  },

  // Title section — poster photo left of title
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  posterPhoto: { flexShrink: 0, marginTop: 2 },
  titleInfo: { flex: 1 },
  gigTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.15,
    lineHeight: 26,
    marginBottom: 6,
  },
  companyName: {
    color: '#b5b5b5',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.1,
    marginBottom: 6,
  },
  posterName: {
    color: '#b5b5b5',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
  },

  // Details
  detailsSection: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0d0d0d',
  },
  detailLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
  detailValue: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1 },
  budgetValue: { color: colors.white, fontFamily: MONO, fontSize: 16, letterSpacing: 0.12 },

  // Description
  descSection: {
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  descLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 10 },
  descText: { color: '#aaaaaa', fontFamily: MONO, fontSize: 13, letterSpacing: 0.08, lineHeight: 22 },

  // Interest
  interestBox: {
    alignItems: 'center', paddingVertical: 28,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#111111',
  },
  interestNumber: { color: colors.red, fontFamily: MONO, fontSize: 40, letterSpacing: 0.1 },
  interestLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginTop: 6 },

  // Action
  actionSection: { paddingHorizontal: 16, paddingTop: 24 },
  interestBtn: {
    borderWidth: 1, borderColor: colors.red,
    height: 52, alignItems: 'center', justifyContent: 'center',
  },
  interestBtnDone: { borderColor: '#333333' },
  interestBtnText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.22 },
  interestBtnTextDone: { color: '#8f8f8f' },
  interestNote: {
    color: '#b5b5b5', fontFamily: MONO, fontSize: 11,
    letterSpacing: 0.12, textAlign: 'center', marginTop: 12,
  },
});
