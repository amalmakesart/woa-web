import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, SafeAreaView, ActivityIndicator, Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { clearLocalSupabaseSession, supabase } from '../../lib/supabase';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

export default function DeleteAccountScreen() {
  const navigation = useNavigation<any>();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentEmail(user.email ?? '');
      const { data } = await supabase.from('profiles').select('username').eq('id', user.id).single();
      if (data) setCurrentUsername((data as any).username ?? '');
    })();
  }, []);

  const usernameMatches = username.trim().toLowerCase() === currentUsername.toLowerCase();
  const canDelete = usernameMatches && password.trim().length > 0;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);

    // Re-authenticate
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: currentEmail, password: password.trim(),
    });
    if (signInErr) {
      setDeleting(false);
      Alert.alert('WRONG PASSWORD', 'Please check your password and try again.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDeleting(false);
      Alert.alert('ERROR', 'COULD NOT VERIFY YOUR ACCOUNT. PLEASE TRY AGAIN.');
      return;
    }

    const { error: deleteError } = await supabase.functions.invoke('delete-account', {
      body: {},
    });

    if (deleteError) {
      setDeleting(false);
      Alert.alert('DELETE FAILED', 'WE COULD NOT DELETE YOUR ACCOUNT RIGHT NOW. PLEASE TRY AGAIN.');
      return;
    }

    await clearLocalSupabaseSession();
    setDeleting(false);
    Alert.alert('ACCOUNT DELETED', 'YOUR WORK(ER) OF ART ACCOUNT HAS BEEN PERMANENTLY DELETED.', [
      {
        text: 'OK',
        onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] }),
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => step === 2 ? setStep(1) : navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>{step === 2 ? 'WARNING' : 'SETTINGS'}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {step === 1 && (
            <View style={s.stepWrap}>
              {/* Icon */}
              <View style={s.iconCircle}>
                <Text style={s.iconX}>✕</Text>
              </View>

              <Text style={s.warningTitle}>ARE YOU SURE?</Text>
              <Text style={s.warningSubtitle}>
                THIS WILL PERMANENTLY DELETE YOUR WOA ACCOUNT AND ALL ASSOCIATED DATA.
              </Text>

              {/* Warning box */}
              <View style={s.warningBox}>
                <Text style={s.warningBoxTitle}>THE FOLLOWING WILL BE DELETED FOREVER</Text>
                {[
                  'YOUR ARTIST PROFILE',
                  'ALL YOUR ART FEED POSTS',
                  'YOUR FOLLOWERS AND FOLLOWING',
                  'ALL MESSAGES',
                  'YOUR RATINGS AND REVIEWS',
                  'ALL GIG APPLICATIONS',
                ].map(item => (
                  <View key={item} style={s.warningItem}>
                    <Text style={s.warningDash}>—</Text>
                    <Text style={s.warningItemText}>{item}</Text>
                  </View>
                ))}
              </View>

              <Text style={s.warningNote}>
                THIS ACTION CANNOT BE UNDONE. YOUR USERNAME WILL BE RELEASED IMMEDIATELY.
              </Text>

              <TouchableOpacity
                style={s.continueBtn}
                onPress={() => setStep(2)}
                activeOpacity={0.7}
              >
                <Text style={s.continueBtnText}>I UNDERSTAND — CONTINUE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 2 && (
            <View style={s.stepWrap}>
              <Text style={s.confirmTitle}>CONFIRM DELETION</Text>
              <Text style={s.confirmSubtitle}>
                TYPE YOUR USERNAME AND PASSWORD TO PERMANENTLY DELETE YOUR ACCOUNT
              </Text>

              {/* Username field */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>TYPE YOUR USERNAME TO CONFIRM *</Text>
                <TextInput
                  style={[s.input, usernameMatches && username.length > 0 && s.inputMatch]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={currentUsername.toUpperCase()}
                  placeholderTextColor="#333333"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={s.fieldNote}>MUST MATCH EXACTLY: {currentUsername.toUpperCase()}</Text>
              </View>

              {/* Password field */}
              <View style={s.field}>
                <Text style={s.fieldLabel}>ENTER YOUR PASSWORD *</Text>
                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="YOUR PASSWORD"
                  placeholderTextColor="#333333"
                  secureTextEntry
                />
              </View>

              {/* Privacy note */}
              <View style={s.privacyNote}>
                <Text style={s.privacyNoteText}>
                  PER APPLE REQUIREMENTS, YOUR DATA WILL BE FULLY ERASED WITHIN 30 DAYS.
                </Text>
              </View>

              {/* Delete button */}
              <TouchableOpacity
                style={[s.deleteBtn, !canDelete && s.deleteBtnDisabled]}
                onPress={handleDelete}
                disabled={!canDelete || deleting}
                activeOpacity={0.7}
              >
                {deleting
                  ? <ActivityIndicator color={colors.red} size="small" />
                  : <Text style={s.deleteBtnText}>DELETE MY ACCOUNT FOREVER</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
              >
                <Text style={s.cancelBtnText}>CANCEL — KEEP MY ACCOUNT</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },

  stepWrap: { paddingHorizontal: 16, paddingTop: 30, alignItems: 'center' },

  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1.5, borderColor: colors.red,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  iconX: { color: colors.red, fontFamily: MONO, fontSize: 16 },

  warningTitle: {
    color: colors.white, fontFamily: MONO,
    fontSize: 12, letterSpacing: 0.3, marginBottom: 12,
  },
  warningSubtitle: {
    color: '#9a9a9a', fontFamily: MONO,
    fontSize: 11, letterSpacing: 0.1, lineHeight: 18,
    textAlign: 'center', marginBottom: 24,
  },

  warningBox: {
    width: '100%', backgroundColor: '#0a0000',
    borderWidth: 1, borderColor: colors.red,
    padding: 16, marginBottom: 20,
  },
  warningBoxTitle: {
    color: colors.red, fontFamily: MONO,
    fontSize: 11, letterSpacing: 0.2, marginBottom: 12,
  },
  warningItem: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  warningDash: { color: '#a33a3a', fontFamily: MONO, fontSize: 11 },
  warningItemText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 17 },

  warningNote: {
    color: '#8f8f8f', fontFamily: MONO,
    fontSize: 11, letterSpacing: 0.1, textAlign: 'center',
    marginBottom: 24, lineHeight: 17,
  },

  continueBtn: {
    width: '100%', borderWidth: 1, borderColor: colors.red,
    height: 48, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  continueBtnText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.25 },

  cancelBtn: {
    width: '100%', borderWidth: 1, borderColor: '#222222',
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },

  confirmTitle: {
    color: colors.white, fontFamily: MONO,
    fontSize: 12, letterSpacing: 0.3, marginBottom: 10,
  },
  confirmSubtitle: {
    color: '#9a9a9a', fontFamily: MONO,
    fontSize: 11, letterSpacing: 0.1, lineHeight: 17,
    textAlign: 'center', marginBottom: 24,
  },

  field: { width: '100%', marginBottom: 20 },
  fieldLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 10 },
  input: {
    borderBottomWidth: 1, borderBottomColor: '#9a9a9a',
    color: '#ffffff', fontFamily: MONO, fontSize: 13,
    paddingBottom: 10,
  },
  inputMatch: { borderBottomColor: '#2a7a4f' },
  fieldNote: { color: '#8f8f8f', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, marginTop: 6, lineHeight: 16 },

  privacyNote: {
    width: '100%', backgroundColor: '#050000',
    borderWidth: 1, borderColor: '#1a0000',
    padding: 14, marginBottom: 24,
  },
  privacyNoteText: {
    color: '#8f8f8f', fontFamily: MONO,
    fontSize: 11, letterSpacing: 0.1, lineHeight: 17, textAlign: 'center',
  },

  deleteBtn: {
    width: '100%', borderWidth: 1, borderColor: colors.red,
    height: 48, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  deleteBtnDisabled: { opacity: 0.3 },
  deleteBtnText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.25 },
});
