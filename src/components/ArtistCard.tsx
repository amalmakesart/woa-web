import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { colors } from '../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });

export interface Artist {
  id: string;
  username: string | null;
  full_name: string | null;
  art_type: string | null;
  discipline: string | null;
  is_available: boolean;
  profile_photo_url: string | null;
  city: string | null;
  country: string | null;
  follower_count: number;
}

interface ArtistCardProps {
  artist: Artist;
  onPress: () => void;
}

export default function ArtistCard({ artist, onPress }: ArtistCardProps) {
  const displayName = (artist.full_name ?? artist.username ?? 'UNKNOWN').toUpperCase();
  const discipline = (artist.discipline ?? artist.art_type ?? '').toUpperCase();
  const city = (artist.city ?? '').toUpperCase();
  const followers = artist.follower_count ?? 0;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
      {artist.profile_photo_url ? (
        <Image source={{ uri: artist.profile_photo_url }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={styles.photoPlaceholder} />
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
        {discipline ? <Text style={styles.artType} numberOfLines={1}>{discipline}</Text> : null}
        <View style={styles.bottomRow}>
          <Text style={styles.followers}>↑ {followers}</Text>
          {city ? <Text style={styles.city} numberOfLines={1}>{city}</Text> : null}
        </View>
        {artist.is_available ? (
          <View style={styles.availableRow}>
            <View style={styles.availableDot} />
            <Text style={styles.availableText}>AVAILABLE</Text>
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
  photo: {
    width: '100%',
    aspectRatio: 1,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.gray2,
  },
  info: {
    paddingHorizontal: 5,
    paddingVertical: 5,
  },
  name: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 6,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  artType: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 5,
    textAlign: 'center',
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 3,
  },
  followers: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 5,
  },
  city: {
    color: colors.red,
    fontFamily: MONO,
    fontSize: 5,
    flex: 1,
    textAlign: 'right',
  },
  availableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 3,
  },
  availableDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2a7a4f',
  },
  availableText: {
    color: '#2a7a4f',
    fontFamily: MONO,
    fontSize: 5,
    letterSpacing: 0.1,
  },
});
