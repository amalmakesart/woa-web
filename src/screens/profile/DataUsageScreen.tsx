import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, SafeAreaView, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

function Section({ label, items }: { label: string; items: string[] }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {items.map((item, i) => (
        <View key={i} style={s.item}>
          <Text style={s.itemDash}>—</Text>
          <Text style={s.itemText}>{item.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

export default function DataUsageScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>SETTINGS</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>DATA USAGE</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Text style={s.mainTitle}>HOW WE USE YOUR DATA</Text>
        <Text style={s.intro}>
          WOA COLLECTS ONLY WHAT'S NEEDED TO RUN THE PLATFORM. WE DO NOT SELL YOUR DATA. EVER.
        </Text>

        <Section
          label="WHAT WE COLLECT"
          items={[
            'Name, username, and email address',
            'Profile photo and bio',
            'City and country (not precise GPS)',
            'Posts, comments, and interactions',
            'Device type for app performance',
          ]}
        />

        <Section
          label="WHAT WE NEVER DO"
          items={[
            'Sell your data to third parties',
            'Share your email without consent',
            'Track your precise location',
            'Serve third-party ads',
          ]}
        />

        <Section
          label="YOUR RIGHTS"
          items={[
            'Request a copy of your data anytime',
            'Delete your account and all data',
            'Opt out of non-essential emails',
          ]}
        />

        <View style={s.footer}>
          <Text style={s.footerText}>
            FOR FULL DETAILS READ OUR PRIVACY POLICY OR EMAIL{' '}
          </Text>
          <TouchableOpacity onPress={() => Linking.openURL('mailto:privacy@workerofart.com')} activeOpacity={0.7}>
            <Text style={s.footerEmail}>PRIVACY@WORKEROFART.COM</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#666666', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarTitle: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },

  mainTitle: {
    color: colors.white, fontFamily: MONO,
    fontSize: 14, letterSpacing: 0.3, marginBottom: 14,
  },
  intro: {
    color: '#666666', fontFamily: MONO,
    fontSize: 10, letterSpacing: 0.08, lineHeight: 17,
    marginBottom: 24,
  },

  section: { marginBottom: 24 },
  sectionLabel: {
    color: colors.red, fontFamily: MONO,
    fontSize: 8, letterSpacing: 0.2, marginBottom: 12,
  },
  item: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  itemDash: { color: '#333333', fontFamily: MONO, fontSize: 9 },
  itemText: { flex: 1, color: '#555555', fontFamily: MONO, fontSize: 9, letterSpacing: 0.08, lineHeight: 14 },

  footer: {
    borderTopWidth: 1, borderTopColor: '#111111',
    paddingTop: 20, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center',
  },
  footerText: { color: '#333333', fontFamily: MONO, fontSize: 7, letterSpacing: 0.1, lineHeight: 13 },
  footerEmail: { color: colors.red, fontFamily: MONO, fontSize: 7, letterSpacing: 0.1 },
});
