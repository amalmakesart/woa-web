import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

export default function WelcomeMessageScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const body = (route.params?.body as string | undefined)?.trim()
    || 'WELCOME TO WORK(ER) OF ART.';

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>WELCOME</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <View style={s.badge}>
          <Text style={s.badgeText}>WOA</Text>
        </View>
        <Text style={s.title}>WELCOME TO WORK(ER) OF ART</Text>
        <Text style={s.body}>{body.toUpperCase()}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  backBtn: { width: 32, alignItems: 'flex-start' },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    color: colors.white,
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.18,
  },
  scroll: { flex: 1 },
  content: { padding: 20 },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.red,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
  title: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 16,
    letterSpacing: 0.2,
    marginBottom: 16,
    lineHeight: 22,
  },
  body: {
    color: '#cfcfcf',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.08,
    lineHeight: 20,
  },
});
