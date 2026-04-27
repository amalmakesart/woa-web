import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Platform,
} from 'react-native';
import OctagonalImage from './OctagonalImage';
import { useUnread, BannerData } from '../contexts/UnreadContext';
import { navigate } from '../lib/navigationRef';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const BANNER_HEIGHT = 64;

interface BannerInnerProps {
  data: BannerData;
  onDismiss: () => void;
}

function BannerInner({ data, onDismiss }: BannerInnerProps) {
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT - 20)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    return () => {
      Animated.timing(translateY, {
        toValue: -BANNER_HEIGHT - 20,
        duration: 200,
        useNativeDriver: true,
      }).start();
    };
  }, []);

  const handlePress = () => {
    onDismiss();
    navigate(data.screen, data.params);
  };

  return (
    <Animated.View style={[s.banner, { transform: [{ translateY }] }]}>
      <TouchableOpacity style={s.inner} onPress={handlePress} activeOpacity={0.85}>
        <OctagonalImage size={28} imageUri={data.actorAvatar} />
        <Text style={s.text} numberOfLines={2}>{data.text}</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={s.close}>×</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function NotificationBanner() {
  const { banner, dismissBanner } = useUnread();
  if (!banner) return null;
  return <BannerInner key={banner.id ?? (banner.text + banner.screen)} data={banner} onDismiss={dismissBanner} />;
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 99,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#c0392b',
    height: BANNER_HEIGHT,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
  },
  text: {
    flex: 1,
    color: '#ffffff',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
    lineHeight: 17,
  },
  close: {
    color: '#9a9a9a',
    fontSize: 18,
    fontFamily: MONO,
  },
});
