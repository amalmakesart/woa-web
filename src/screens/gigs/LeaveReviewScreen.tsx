import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, SafeAreaView, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

export default function LeaveReviewScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const {
    gigId,
    gigTitle,
    revieweeId,
    revieweeName,
    revieweeAvatar,
  } = route.params as {
    gigId: string;
    gigTitle: string | null;
    revieweeId: string;
    revieweeName: string | null;
    revieweeAvatar: string | null;
  };

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('RATING REQUIRED', 'PLEASE SELECT A STAR RATING.');
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      gig_id: gigId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      body: body.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        Alert.alert('ALREADY REVIEWED', 'YOU HAVE ALREADY LEFT A REVIEW FOR THIS GIG.');
        navigation.goBack();
      } else {
        Alert.alert('ERROR', 'COULD NOT SUBMIT REVIEW. TRY AGAIN.');
      }
      return;
    }

    Alert.alert('REVIEW SUBMITTED', 'THANK YOU FOR YOUR FEEDBACK.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>BACK</Text>
        </TouchableOpacity>
        <Text style={s.topTitle}>LEAVE A REVIEW</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Who you're reviewing */}
        <View style={s.revieweeSection}>
          <OctagonalImage size={48} imageUri={revieweeAvatar} />
          <View style={s.revieweeInfo}>
            <Text style={s.revieweeLabel}>REVIEWING</Text>
            <Text style={s.revieweeName}>{(revieweeName ?? 'UNKNOWN').toUpperCase()}</Text>
            {gigTitle ? (
              <Text style={s.gigTitle} numberOfLines={1}>RE: {gigTitle.toUpperCase()}</Text>
            ) : null}
          </View>
        </View>

        {/* Star rating */}
        <View style={s.ratingSection}>
          <Text style={s.sectionLabel}>YOUR RATING *</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map(n => (
              <TouchableOpacity key={n} onPress={() => setRating(n)} activeOpacity={0.7} style={s.starBtn}>
                <Text style={[s.star, n <= rating && s.starFilled]}>
                  {n <= rating ? '★' : '☆'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 ? (
            <Text style={s.ratingLabel}>
              {['', 'POOR', 'FAIR', 'GOOD', 'GREAT', 'EXCELLENT'][rating]}
            </Text>
          ) : null}
        </View>

        {/* Written review */}
        <View style={s.bodySection}>
          <Text style={s.sectionLabel}>WRITTEN REVIEW (OPTIONAL)</Text>
          <TextInput
            style={s.bodyInput}
            value={body}
            onChangeText={setBody}
            placeholder="SHARE YOUR EXPERIENCE..."
            placeholderTextColor="#333333"
            multiline
            maxLength={500}
          />
          <Text style={s.charCount}>{body.length}/500</Text>
        </View>

        <View style={s.notice}>
          <Text style={s.noticeText}>
            YOUR REVIEW WILL BE VISIBLE ON THIS ARTIST'S PUBLIC PROFILE.
            REVIEWS CANNOT BE DELETED AFTER SUBMISSION.
          </Text>
        </View>

        <TouchableOpacity
          style={[s.submitBtn, (submitting || rating === 0) && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting || rating === 0}
          activeOpacity={0.7}
        >
          {submitting ? (
            <ActivityIndicator color={colors.black} />
          ) : (
            <Text style={s.submitBtnText}>SUBMIT REVIEW</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },

  revieweeSection: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    padding: 20, borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  revieweeInfo: { flex: 1 },
  revieweeLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, marginBottom: 4 },
  revieweeName: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.15, marginBottom: 3 },
  gigTitle: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },

  ratingSection: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  sectionLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2, marginBottom: 14 },
  starsRow: { flexDirection: 'row', gap: 12 },
  starBtn: { padding: 4 },
  star: { color: '#333333', fontSize: 32 },
  starFilled: { color: '#f6c55a' },
  ratingLabel: { color: '#f6c55a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginTop: 10 },

  bodySection: {
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  bodyInput: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a',
    color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.08,
    padding: 12, minHeight: 100, textAlignVertical: 'top',
  },
  charCount: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, textAlign: 'right', marginTop: 6 },

  notice: { margin: 20, backgroundColor: '#050505', borderWidth: 1, borderColor: '#1a1a1a', padding: 12 },
  noticeText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.08, lineHeight: 14 },

  submitBtn: {
    backgroundColor: colors.red, marginHorizontal: 20, marginTop: 4,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnDisabled: { backgroundColor: '#5a0000' },
  submitBtnText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3 },
});
