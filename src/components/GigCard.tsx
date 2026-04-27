import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Image,
} from 'react-native';
import { colors } from '../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });
const RED = '#c0392b';

export const GIG_ART_TYPES = [
  'Photographer',
  'Videographer',
  'Filmmaker',
  'Musician',
  'Singer',
  'DJ',
  'Producer',
  'Model',
  'Actor',
  'Dancer',
  'Choreographer',
  'Visual Artist',
  'Painter',
  'Illustrator',
  'Graphic Designer',
  'Animator',
  'Muralist',
  'Sculptor',
  'Tattoo Artist',
  'Fashion Designer',
  'Makeup Artist',
  'Hair Stylist',
  'Writer',
  'Chef',
  'Performer',
  'Interdisciplinary Artist',
  'Other',
];

export interface Gig {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  art_type: string | null;
  image_url?: string | null;
  location: string | null;
  date_timeframe: string | null;
  budget_min: number | null;
  budget_max: number | null;
  poster_name: string | null;
  company_name: string | null;
  is_featured: boolean;
  status: 'active' | 'closed';
  interest_count: number;
  created_at: string;
}

interface GigCardProps {
  gig: Gig;
  onPress: () => void;
}

export function formatBudget(min: number | null, max: number | null): string {
  if (min && max) return `$${min} — $${max}`;
  if (min) return `FROM $${min}`;
  if (max) return `UP TO $${max}`;
  return 'BUDGET TBD';
}

export default function GigCard({ gig, onPress }: GigCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, gig.is_featured && styles.cardFeatured]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {gig.image_url ? (
        <Image source={{ uri: gig.image_url }} style={styles.image} resizeMode="cover" />
      ) : null}
      {gig.is_featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>FEATURED</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {gig.title.toUpperCase()}
      </Text>
      {(gig.company_name || gig.art_type || gig.location || gig.date_timeframe) ? (
        <View style={styles.infoBox}>
          {gig.company_name ? (
            <Text style={styles.companyName} numberOfLines={1}>
              {gig.company_name.toUpperCase()}
            </Text>
          ) : null}
          {gig.art_type ? (
            <Text style={styles.metaType} numberOfLines={1}>
              {gig.art_type.toUpperCase()}
            </Text>
          ) : null}
          {gig.location ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>⌖</Text>
              <Text style={styles.metaText} numberOfLines={1}>
                {gig.location.toUpperCase()}
              </Text>
            </View>
          ) : null}
          {gig.date_timeframe ? (
            <View style={styles.metaRow}>
              <Text style={styles.metaIcon}>◷</Text>
              <Text style={styles.metaText} numberOfLines={2}>
                {gig.date_timeframe.toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.bottom}>
        <Text style={styles.budget}>
          {formatBudget(gig.budget_min, gig.budget_max)}
        </Text>
        <View style={styles.interestRow}>
          <Text style={styles.interestCount}>{gig.interest_count}</Text>
          <Text style={styles.interestLabel}> INTERESTED</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: '#242424',
    marginHorizontal: 14,
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
    minHeight: 196,
  },
  cardFeatured: {
    borderColor: RED,
  },
  image: {
    width: '100%',
    height: 180,
    marginBottom: 16,
    backgroundColor: '#0d0d0d',
  },
  featuredBadge: {
    position: 'absolute',
    top: 30,
    right: 28,
    backgroundColor: '#0f0000',
    borderWidth: 1,
    borderColor: RED,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 2,
  },
  featuredText: {
    color: RED,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
  },
  title: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 18,
    letterSpacing: 0.14,
    marginBottom: 12,
    paddingRight: 92,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: '#080808',
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 12,
  },
  companyName: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.1,
    marginBottom: 8,
  },
  metaType: {
    color: RED,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  metaIcon: {
    color: RED,
    fontFamily: MONO,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 1,
  },
  metaText: {
    flex: 1,
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
    lineHeight: 16,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  budget: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 16,
    letterSpacing: 0.12,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  interestCount: {
    color: RED,
    fontFamily: MONO,
    fontSize: 11,
  },
  interestLabel: {
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.1,
  },
});
