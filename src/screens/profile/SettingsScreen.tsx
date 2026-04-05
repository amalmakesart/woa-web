import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Platform, SafeAreaView, Alert, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const NOTIF_KEY = '@woa_notif_settings';

interface NotifSettings {
  nearbyGigs: boolean;
  newFollowers: boolean;
  likesComments: boolean;
  messages: boolean;
}

function SectionLabel({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <View style={s.sectionLabel}>
      <Text style={[s.sectionLabelText, danger && s.sectionLabelDanger]}>{label}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onValueChange }: {
  label: string; value: boolean; onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#1a1a1a', true: colors.red }}
        thumbColor={colors.white}
        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
      />
    </View>
  );
}

function LinkRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowArrow}>›</Text>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [notif, setNotif] = useState<NotifSettings>({
    nearbyGigs: true, newFollowers: true, likesComments: true, messages: true,
  });

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_KEY).then(val => {
      if (val) setNotif(JSON.parse(val));
    });
  }, []);

  const updateNotif = (key: keyof NotifSettings, val: boolean) => {
    const updated = { ...notif, [key]: val };
    setNotif(updated);
    AsyncStorage.setItem(NOTIF_KEY, JSON.stringify(updated));
  };

  const handleChangePassword = () => {
    Alert.prompt(
      'CHANGE PASSWORD',
      'Enter your email to receive a reset link.',
      async (email) => {
        if (!email?.trim()) return;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
        if (error) Alert.alert('ERROR', error.message);
        else Alert.alert('EMAIL SENT', 'Check your inbox for a password reset link.');
      },
      'plain-text',
    );
  };

  const handleChangeEmail = () => {
    Alert.prompt(
      'CHANGE EMAIL',
      'Enter your new email address.',
      async (newEmail) => {
        if (!newEmail?.trim()) return;
        const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
        if (error) Alert.alert('ERROR', error.message);
        else Alert.alert('CONFIRM EMAIL', 'A confirmation link has been sent to your new email.');
      },
      'plain-text',
    );
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>MY PROFILE</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>SETTINGS</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        <SectionLabel label="NOTIFICATIONS" />
        <ToggleRow label="NEW GIGS NEAR ME" value={notif.nearbyGigs} onValueChange={v => updateNotif('nearbyGigs', v)} />
        <ToggleRow label="NEW FOLLOWERS" value={notif.newFollowers} onValueChange={v => updateNotif('newFollowers', v)} />
        <ToggleRow label="POST LIKES & COMMENTS" value={notif.likesComments} onValueChange={v => updateNotif('likesComments', v)} />
        <ToggleRow label="MESSAGES" value={notif.messages} onValueChange={v => updateNotif('messages', v)} />

        <SectionLabel label="PRIVACY & DATA" />
        <LinkRow label="PRIVACY POLICY" onPress={() => Linking.openURL('https://workerofart.com/privacy')} />
        <LinkRow label="TERMS OF SERVICE" onPress={() => Linking.openURL('https://workerofart.com/terms')} />
        <LinkRow label="DATA USAGE" onPress={() => navigation.navigate('DataUsage')} />
        <LinkRow label="MANAGE PERMISSIONS" onPress={() => Linking.openSettings()} />

        <SectionLabel label="ACCOUNT" />
        <LinkRow label="CHANGE PASSWORD" onPress={handleChangePassword} />
        <LinkRow label="CHANGE EMAIL" onPress={handleChangeEmail} />
        <View style={s.row}>
          <Text style={s.rowLabel}>APP VERSION</Text>
          <Text style={s.versionText}>1.0.0</Text>
        </View>

        <SectionLabel label="DANGER ZONE" danger />
        <TouchableOpacity style={s.row} onPress={() => navigation.navigate('DeleteAccount')} activeOpacity={0.7}>
          <Text style={s.deleteLabel}>DELETE ACCOUNT</Text>
          <Text style={[s.rowArrow, { color: colors.red }]}>›</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 12 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#666666', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarTitle: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },

  sectionLabel: {
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
  },
  sectionLabelText: { color: '#333333', fontFamily: MONO, fontSize: 8, letterSpacing: 0.2 },
  sectionLabelDanger: { color: colors.red },

  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, height: 44,
    borderBottomWidth: 1, borderBottomColor: '#0d0d0d',
  },
  rowLabel: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  rowArrow: { color: '#333333', fontFamily: MONO, fontSize: 14 },
  versionText: { color: '#333333', fontFamily: MONO, fontSize: 8 },
  deleteLabel: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
});
