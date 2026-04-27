import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

export default function ExpressInterestScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { gigId, gigTitle, posterName, gigLocation } = route.params;

  const [suggestedFee, setSuggestedFee] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string | null>(null);
  const [currentUserArtType, setCurrentUserArtType] = useState<string | null>(null);
  const [currentUserCity, setCurrentUserCity] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: me } = await supabase
        .from('profiles')
        .select('full_name, username, profile_photo_url, art_type, city')
        .eq('id', user.id)
        .single();
      if (me) {
        const p = me as any;
        setCurrentUserAvatar(p.profile_photo_url ?? null);
        setCurrentUserName(p.full_name ?? p.username ?? null);
        setCurrentUserArtType(p.art_type ?? null);
        setCurrentUserCity(p.city ?? null);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!suggestedFee.trim()) {
      Alert.alert('REQUIRED', 'Please enter your suggested fee.');
      return;
    }
    const feeNum = parseFloat(suggestedFee.replace(/[^0-9.]/g, ''));
    if (isNaN(feeNum) || feeNum <= 0) {
      Alert.alert('INVALID FEE', 'Please enter a valid dollar amount.');
      return;
    }
    if (!currentUserId) return;
    if (note.trim() && containsBannedWords(note)) {
      Alert.alert('INAPPROPRIATE LANGUAGE', getBannedWordError());
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('gig_interests').insert({
      gig_id: gigId,
      artist_id: currentUserId,
      suggested_fee: feeNum,
      note: note.trim() || null,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('ALREADY SUBMITTED', 'You have already expressed interest in this gig.');
      } else {
        Alert.alert('ERROR', 'Could not submit. Please try again.');
      }
      return;
    }

    // Notify gig poster
    const { data: gig } = await supabase
      .from('gigs').select('poster_id').eq('id', gigId).single();
    if (gig && (gig as any).poster_id && (gig as any).poster_id !== currentUserId) {
      await supabase.from('notifications').insert({
        user_id: (gig as any).poster_id,
        type: 'gig_interest',
        actor_id: currentUserId,
        reference_id: gigId,
        reference_type: 'gig',
        preview_text: gigTitle ?? null,
        is_read: false,
      });
    }

    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backLabel}>GIG DETAIL</Text>
        </TouchableOpacity>
        <View style={styles.topBarRight}>
          <View style={styles.notifDot} />
          <OctagonalImage
            size={24}
            imageUri={currentUserAvatar}
            onPress={() => navigation.navigate('Profile')}
          />
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.headerSection}>
            <Text style={styles.screenTitle}>EXPRESS INTEREST</Text>
            <Text style={styles.gigTitleSmall} numberOfLines={2}>
              {gigTitle?.toUpperCase()}
            </Text>
            {posterName ? (
              <Text style={styles.gigMeta}>POSTED BY {posterName.toUpperCase()}</Text>
            ) : null}
            {gigLocation ? (
              <Text style={styles.gigMeta}>{gigLocation.toUpperCase()}</Text>
            ) : null}
          </View>

          {/* Profile preview */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR PROFILE WILL BE ATTACHED</Text>
            <View style={styles.profileCard}>
              <OctagonalImage size={40} imageUri={currentUserAvatar} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {(currentUserName ?? 'YOUR NAME').toUpperCase()}
                </Text>
                {currentUserArtType ? (
                  <Text style={styles.profileArtType}>{currentUserArtType.toUpperCase()}</Text>
                ) : null}
                {currentUserCity ? (
                  <Text style={styles.profileCity}>{currentUserCity.toUpperCase()}</Text>
                ) : null}
              </View>
            </View>
          </View>

          {/* Suggested fee */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>SUGGESTED FEE *</Text>
            <View style={styles.feeInputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <TextInput
                style={styles.feeInput}
                placeholder="0"
                placeholderTextColor="#333333"
                keyboardType="decimal-pad"
                value={suggestedFee}
                onChangeText={setSuggestedFee}
                maxLength={10}
              />
            </View>
            <Text style={styles.fieldNote}>THIS IS A SUGGESTION — FINAL RATE IS NEGOTIATED SEPARATELY</Text>
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>NOTE TO POSTER (OPTIONAL)</Text>
            <TextInput
              style={styles.noteInput}
              placeholder="TELL THEM WHY YOU'RE A GREAT FIT..."
              placeholderTextColor="#333333"
              multiline
              value={note}
              onChangeText={setNote}
              maxLength={500}
            />
            <Text style={styles.charCount}>{note.length}/500</Text>
          </View>

          {/* Privacy notice */}
          <View style={styles.privacyBox}>
            <Text style={styles.privacyTitle}>PRIVACY NOTICE</Text>
            <Text style={styles.privacyText}>
              BY SUBMITTING, YOUR PUBLIC PROFILE (NAME, ART TYPE, CITY, PROFILE PHOTO) AND YOUR SUGGESTED FEE WILL BE VISIBLE TO THE GIG POSTER. YOUR NOTE (IF ANY) WILL ALSO BE SHARED. YOUR CONTACT INFORMATION IS NOT SHARED.
            </Text>
          </View>

          {/* Submit */}
          <View style={styles.submitSection}>
            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator color={colors.black} size="small" />
              ) : (
                <Text style={styles.submitBtnText}>SUBMIT INTEREST</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  scroll: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },

  headerSection: {
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  screenTitle: {
    color: colors.white, fontFamily: MONO,
    fontSize: 14, letterSpacing: 0.3, marginBottom: 10,
  },
  gigTitleSmall: {
    color: '#b5b5b5', fontFamily: MONO,
    fontSize: 9, letterSpacing: 0.15, lineHeight: 15, marginBottom: 6,
  },
  gigMeta: {
    color: '#9a9a9a', fontFamily: MONO,
    fontSize: 7, letterSpacing: 0.12, marginTop: 2,
  },

  section: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0,
    borderBottomWidth: 1, borderBottomColor: '#9a9a9a',
  },
  sectionLabel: {
    color: '#b5b5b5', fontFamily: MONO,
    fontSize: 10, letterSpacing: 0.2, marginBottom: 12,
  },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#0a0a0a',
    borderWidth: 1, borderColor: '#1a1a1a',
    padding: 12, marginBottom: 16,
  },
  profileInfo: { flex: 1 },
  profileName: {
    color: colors.white, fontFamily: MONO,
    fontSize: 10, letterSpacing: 0.15, marginBottom: 3,
  },
  profileArtType: {
    color: colors.red, fontFamily: MONO,
    fontSize: 9, letterSpacing: 0.12, marginBottom: 2,
  },
  profileCity: {
    color: '#9a9a9a', fontFamily: MONO,
    fontSize: 8, letterSpacing: 0.1,
  },

  feeInputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#9a9a9a',
    paddingBottom: 14,
  },
  dollarSign: {
    color: '#b5b5b5', fontFamily: MONO,
    fontSize: 16, paddingRight: 10,
  },
  feeInput: {
    flex: 1, color: '#ffffff', fontFamily: MONO,
    fontSize: 16, letterSpacing: 0.1,
  },
  fieldNote: {
    color: '#9a9a9a', fontFamily: MONO,
    fontSize: 7, letterSpacing: 0.1, marginBottom: 14,
  },

  noteInput: {
    backgroundColor: '#111111',
    color: '#ffffff', fontFamily: MONO,
    fontSize: 13, letterSpacing: 0.1, lineHeight: 20,
    padding: 12, minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  charCount: {
    color: '#8f8f8f', fontFamily: MONO,
    fontSize: 6, letterSpacing: 0.1,
    textAlign: 'right', marginBottom: 14,
  },

  privacyBox: {
    margin: 16,
    borderWidth: 1, borderColor: '#1a1a1a',
    backgroundColor: '#050505',
    padding: 14,
  },
  privacyTitle: {
    color: '#9a9a9a', fontFamily: MONO,
    fontSize: 6, letterSpacing: 0.2, marginBottom: 8,
  },
  privacyText: {
    color: '#8f8f8f', fontFamily: MONO,
    fontSize: 6, letterSpacing: 0.08, lineHeight: 11,
  },

  submitSection: { paddingHorizontal: 16, paddingTop: 4 },
  submitBtn: {
    backgroundColor: colors.red,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#5a0000' },
  submitBtnText: {
    color: colors.white, fontFamily: MONO,
    fontSize: 10, letterSpacing: 0.3,
  },
});
