import React, { useEffect, useState } from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { colors } from '../constants/colors';

const thumbnailCache = new Map<string, string>();

interface VideoThumbnailProps {
  uri?: string | null;
  containerStyle?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  label?: string | null;
  labelStyle?: StyleProp<TextStyle>;
  cornerTag?: string | null;
  cornerTagStyle?: StyleProp<TextStyle>;
  showCenterPlay?: boolean;
  centerPlayStyle?: StyleProp<TextStyle>;
}

export default function VideoThumbnail({
  uri,
  containerStyle,
  imageStyle,
  label = null,
  labelStyle,
  cornerTag = null,
  cornerTagStyle,
  showCenterPlay = true,
  centerPlayStyle,
}: VideoThumbnailProps) {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(
    uri ? thumbnailCache.get(uri) ?? null : null
  );

  useEffect(() => {
    if (!uri) {
      setThumbnailUri(null);
      return;
    }

    const cached = thumbnailCache.get(uri);
    if (cached) {
      setThumbnailUri(cached);
      return;
    }

    let cancelled = false;

    VideoThumbnails.getThumbnailAsync(uri, { time: 500 })
      .then(({ uri: nextUri }) => {
        if (cancelled) return;
        thumbnailCache.set(uri, nextUri);
        setThumbnailUri(nextUri);
      })
      .catch(() => {
        if (!cancelled) setThumbnailUri(null);
      });

    return () => {
      cancelled = true;
    };
  }, [uri]);

  return (
    <View style={[styles.container, containerStyle]}>
      {thumbnailUri ? (
        <Image source={{ uri: thumbnailUri }} style={[styles.image, imageStyle]} resizeMode="cover" />
      ) : (
        <View style={styles.placeholder} />
      )}
      {showCenterPlay ? <Text style={[styles.centerPlay, centerPlayStyle]}>▶</Text> : null}
      {label ? <Text style={[styles.label, labelStyle]}>{label}</Text> : null}
      {cornerTag ? <Text style={[styles.cornerTag, cornerTagStyle]}>{cornerTag}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0a0a0a',
  },
  centerPlay: {
    color: colors.white,
    fontSize: 18,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  label: {
    position: 'absolute',
    bottom: 8,
    color: '#ffffff',
    fontSize: 9,
    letterSpacing: 0.12,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cornerTag: {
    position: 'absolute',
    top: 5,
    right: 6,
    color: colors.red,
    fontSize: 11,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});
