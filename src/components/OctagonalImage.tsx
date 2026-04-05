import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' });

interface OctagonalImageProps {
  size: number;
  imageUri?: string | null;
  style?: any;
  onPress?: () => void;
}

export default function OctagonalImage({ size, imageUri, style, onPress }: OctagonalImageProps) {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size * 0.18,
    overflow: 'hidden' as const,
    backgroundColor: '#1a1a1a',
  };

  const inner = imageUri ? (
    <Image
      source={{ uri: imageUri }}
      style={styles.image}
      resizeMode="cover"
    />
  ) : (
    <View style={[styles.placeholder, { width: size, height: size, backgroundColor: '#1a1a1a' }]}>
      <Text style={{ color: '#333333', fontSize: size * 0.3, fontFamily: MONO }}>{'◈'}</Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={[containerStyle, style]}>
        {inner}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[containerStyle, style]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
