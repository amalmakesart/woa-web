import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

export default function MiniLogo() {
  return (
    <View style={s.box}>
      <Text style={s.text}>WOA<Text style={s.dot}>●</Text></Text>
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.white,
    paddingHorizontal: 7,
    paddingVertical: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  dot: {
    color: colors.red,
    fontSize: 11,
  },
});
