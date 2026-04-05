import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { colors } from '../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });

export const GIG_ART_TYPES = [
  'Musician',
  'Visual Artist',
  'Photographer',
  'Illustrator',
  'Sculptor',
  'Dancer',
  'Writer',
  'Animator',
  'Other',
];

export interface Gig {
  id: string;
  poster_id: string;
  title: string;
  description: string | null;
  art_type: string | null;
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
  const meta = [gig.art_type, gig.location, gig.date_timeframe]
    .filter(Boolean)
    .join(' · ')
    .toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.card, gig.is_featured && styles.cardFeatured]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {gig.is_featured && (
        <View style={styles.featuredBadge}>
          <Text style={styles.featuredText}>FEATURED</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {gig.title.toUpperCase()}
      </Text>
      {gig.company_name ? (
        <Text style={styles.companyName} numberOfLines={1}>
          {gig.company_name.toUpperCase()}
        </Text>
      ) : null}
      <Text style={styles.meta} numberOfLines={1}>{meta}</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  cardFeatured: {
    borderLeftWidth: 2,
    borderLeftColor: colors.red,
    paddingLeft: 12,
  },
  featuredBadge: {
    position: 'absolute',
    top: 16,
    right: 14,
    backgroundColor: '#0f0000',
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  featuredText: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.12,
  },
  title: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 0.14,
    marginBottom: 3,
    paddingRight: 80,
  },
  companyName: {
    color: '#666666',
    fontFamily: MONO,
    fontSize: 7,
    letterSpacing: 0.1,
    marginBottom: 5,
  },
  meta: {
    color: '#555555',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.12,
    marginBottom: 10,
  },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budget: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 0.12,
  },
  interestRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  interestCount: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 10,
  },
  interestLabel: {
    color: '#555555',
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.1,
  },
});
