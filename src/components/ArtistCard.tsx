import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });
const GOLD = '#f6c55a';

export interface Artist {
  id: string;
  username: string | null;
  full_name: string | null;
  role?: string | null;
  art_type: string | null;
  art_types?: string[] | null;
  discipline: string | null;
  is_available: boolean;
  is_verified: boolean;
  profile_photo_url: string | null;
  city: string | null;
  country: string | null;
  follower_count: number;
}

// WOA verified mark — small rectangle overlay on photo corner
function VerifiedBadge() {
  return (
    <View style={vb.wrap}>
      <View style={vb.box}>
        <Text style={vb.woa}>WOA</Text>
        <View style={vb.dot} />
      </View>
    </View>
  );
}

const vb = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
  },
  box: {
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: GOLD,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    gap: 2,
  },
  woa: {
    color: GOLD,
    fontFamily: MONO,
    fontSize: 8,
    letterSpacing: 0.1,
    fontWeight: '700',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.red,
  },
});

interface ArtistCardProps {
  artist: Artist;
  onPress: () => void;
}

export default function ArtistCard({ artist, onPress }: ArtistCardProps) {
  const displayName = (artist.full_name ?? artist.username ?? 'UNKNOWN').toUpperCase();
  const discipline = (
    artist.role === 'COLLECTIVE'
      ? 'ART COLLECTIVE'
      : (artist.discipline ?? artist.art_type ?? '')
  ).toUpperCase();
  const city = artist.city ?? '';
  const country = artist.country ?? '';
  const location = [city, country].filter(Boolean).join(', ').toUpperCase();

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {/* Photo with verified overlay */}
      <View style={styles.photoWrap}>
        {artist.profile_photo_url ? (
          <Image source={{ uri: artist.profile_photo_url }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="person-outline" size={22} color="#333333" />
          </View>
        )}
        {artist.is_verified ? <VerifiedBadge /> : null}
      </View>

      <View style={styles.info}>
        {/* Name with inline verified checkmark */}
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          {artist.is_verified ? (
            <Ionicons name="checkmark-circle" size={10} color={GOLD} />
          ) : null}
        </View>

        {discipline ? (
          <Text style={styles.discipline} numberOfLines={1}>{discipline}</Text>
        ) : null}

        {location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={8} color="#9a9a9a" />
            <Text style={styles.location} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}

      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.black,
  },
  photoWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    paddingHorizontal: 6,
    paddingTop: 7,
    paddingBottom: 8,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  name: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.08,
    textAlign: 'center',
    flexShrink: 1,
  },
  discipline: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 10,
    textAlign: 'center',
    letterSpacing: 0.05,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  location: {
    color: GOLD,
    fontFamily: MONO,
    fontSize: 10,
    letterSpacing: 0.05,
    flexShrink: 1,
  },
});
