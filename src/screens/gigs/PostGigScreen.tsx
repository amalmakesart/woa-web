import React, { useState, useEffect, useMemo } from 'react';
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
  Switch,
  KeyboardAvoidingView,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import OctagonalImage from '../../components/OctagonalImage';
import { GIG_ART_TYPES, formatBudget } from '../../components/GigCard';
import { CITIES_BY_COUNTRY } from '../../constants/locationData';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

type Step = 'details' | 'review' | 'payment';
const FEATURED_PRICE = 9.99;
const OTHER_CITY = 'OTHER — TYPE BELOW';

const COUNTRIES = ['Remote', ...Object.keys(CITIES_BY_COUNTRY).sort()];

// ─── Picker Modal ─────────────────────────────────────────────────────────────

function PickerModal({
  visible, title, options, selected, onSelect, onClose,
}: {
  visible: boolean; title: string; options: string[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={pm.close}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={pm.row}
                onPress={() => { onSelect(item); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[pm.rowText, selected === item && pm.rowActive]}>
                  {item}
                </Text>
                {selected === item && <Text style={pm.check}>✓</Text>}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const pm = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { backgroundColor: '#0d0d0d', borderTopWidth: 1, borderTopColor: '#222222', maxHeight: '70%', paddingBottom: 34 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  title: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  close: { color: '#555555', fontFamily: MONO, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: '#666666', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  rowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 10 },
});

// ─── Art Type Picker (inline) ─────────────────────────────────────────────────

function InlinePicker({
  options, selected, onSelect,
}: { options: string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <View style={il.list}>
      {options.map((t) => (
        <TouchableOpacity
          key={t}
          style={[il.item, selected === t && il.itemSelected]}
          onPress={() => onSelect(t)}
          activeOpacity={0.7}
        >
          <Text style={[il.itemText, selected === t && il.itemTextSelected]}>
            {t.toUpperCase()}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const il = StyleSheet.create({
  list: { borderWidth: 1, borderColor: '#222222', marginTop: 0 },
  item: { paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#111111' },
  itemSelected: { backgroundColor: '#150000' },
  itemText: { color: '#666666', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  itemTextSelected: { color: colors.red },
});

// ─── Review Row ───────────────────────────────────────────────────────────────

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={rv.row}>
      <Text style={rv.label}>{label}</Text>
      <Text style={rv.value}>{value.toUpperCase()}</Text>
    </View>
  );
}

const rv = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#0a0a0a' },
  label: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.18 },
  value: { color: colors.white, fontFamily: MONO, fontSize: 8, letterSpacing: 0.1, flexShrink: 1, textAlign: 'right', marginLeft: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PostGigScreen() {
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<Step>('details');
  const [submitting, setSubmitting] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [posterName, setPosterName] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [artType, setArtType] = useState('');
  const [dateTimeframe, setDateTimeframe] = useState('');
  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);

  // Location state
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);

  // Art type picker visibility
  const [showArtTypePicker, setShowArtTypePicker] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      const { data: me } = await supabase
        .from('profiles')
        .select('full_name, username, profile_photo_url')
        .eq('id', user.id)
        .single();
      if (me) {
        const p = me as any;
        setCurrentUserAvatar(p.profile_photo_url ?? null);
        setPosterName(p.full_name ?? p.username ?? null);
      }
    })();
  }, []);

  const cityOptions = useMemo(() => {
    if (!selectedCountry || selectedCountry === 'Remote') return [];
    const cities = CITIES_BY_COUNTRY[selectedCountry] ?? [];
    return [...cities, OTHER_CITY];
  }, [selectedCountry]);

  const locationString = useMemo(() => {
    if (!selectedCountry) return null;
    if (selectedCountry === 'Remote') return 'Remote';
    if (!selectedCity) return selectedCountry;
    if (selectedCity === OTHER_CITY) {
      return customCity.trim() ? `${customCity.trim()}, ${selectedCountry}` : selectedCountry;
    }
    return `${selectedCity}, ${selectedCountry}`;
  }, [selectedCountry, selectedCity, customCity]);

  const totalCost = isFeatured ? FEATURED_PRICE : 0;

  const validateDetails = () => {
    if (!title.trim()) {
      Alert.alert('REQUIRED', 'Please enter a gig title.');
      return false;
    }
    if (containsBannedWords(title) || (description.trim() && containsBannedWords(description))) {
      Alert.alert('INAPPROPRIATE LANGUAGE', getBannedWordError());
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'details') {
      if (!validateDetails()) return;
      setStep('review');
    } else if (step === 'review') {
      setStep('payment');
    }
  };

  const handleBack = () => {
    if (step === 'review') setStep('details');
    else if (step === 'payment') setStep('review');
    else navigation.goBack();
  };

  const handleSubmit = async () => {
    if (!currentUserId) return;
    setSubmitting(true);

    const minVal = budgetMin.trim() ? parseFloat(budgetMin.replace(/[^0-9.]/g, '')) : null;
    const maxVal = budgetMax.trim() ? parseFloat(budgetMax.replace(/[^0-9.]/g, '')) : null;

    const { error } = await supabase.from('gigs').insert({
      poster_id: currentUserId,
      title: title.trim(),
      company_name: companyName.trim() || null,
      description: description.trim() || null,
      art_type: artType || null,
      location: locationString,
      date_timeframe: dateTimeframe.trim() || null,
      budget_min: minVal,
      budget_max: maxVal,
      is_featured: isFeatured,
      status: 'active',
      interest_count: 0,
      poster_name: posterName,
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('ERROR', 'Could not post gig. Please try again.');
      return;
    }

    navigation.goBack();
  };

  const backLabel = step === 'details' ? 'MY GIGS' : step === 'review' ? 'DETAILS' : 'REVIEW';
  const progressSteps: Step[] = ['details', 'review', 'payment'];
  const stepIndex = progressSteps.indexOf(step);

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={handleBack} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>{backLabel}</Text>
        </TouchableOpacity>
        <View style={s.topBarRight}>
          <View style={s.notifDot} />
          <OctagonalImage size={24} imageUri={currentUserAvatar} />
        </View>
      </View>

      {/* Progress */}
      <View style={s.progressRow}>
        {progressSteps.map((ps, i) => (
          <View key={ps} style={[s.progressStep, i <= stepIndex && s.progressStepActive]}>
            <Text style={[s.progressLabel, i <= stepIndex && s.progressLabelActive]}>
              {ps.toUpperCase()}
            </Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── STEP 1: DETAILS ─────────────────────────────────────────── */}
        {step === 'details' && (
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.stepHeader}>
              <Text style={s.stepTitle}>GIG DETAILS</Text>
            </View>

            {/* Title */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>TITLE *</Text>
              <TextInput
                style={s.textInput}
                placeholder="WHAT ARE YOU LOOKING FOR?"
                placeholderTextColor="#666666"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>

            {/* Venue / Company */}
            <View style={s.field}>
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldLabel}>VENUE / COMPANY NAME</Text>
                <Text style={s.fieldLabelSub}>OPTIONAL</Text>
              </View>
              <TextInput
                style={s.textInput}
                placeholder="E.G. THE JAZZ ROOM, VOGUE MAGAZINE"
                placeholderTextColor="#666666"
                value={companyName}
                onChangeText={setCompanyName}
                maxLength={80}
              />
            </View>

            {/* Art Type */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>ART TYPE</Text>
              <TouchableOpacity
                style={s.selectBtn}
                onPress={() => setShowArtTypePicker(!showArtTypePicker)}
                activeOpacity={0.7}
              >
                <Text style={[s.selectBtnText, !artType && s.selectBtnPlaceholder]}>
                  {artType ? artType.toUpperCase() : 'SELECT TYPE'}
                </Text>
                <Text style={s.selectChevron}>{showArtTypePicker ? '▲' : '▼'}</Text>
              </TouchableOpacity>
              {showArtTypePicker && (
                <InlinePicker
                  options={GIG_ART_TYPES}
                  selected={artType}
                  onSelect={(v) => { setArtType(v); setShowArtTypePicker(false); }}
                />
              )}
            </View>

            {/* Country */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>COUNTRY</Text>
              <TouchableOpacity
                style={s.selectBtn}
                onPress={() => setShowCountryModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[s.selectBtnText, !selectedCountry && s.selectBtnPlaceholder]}>
                  {selectedCountry || 'SELECT COUNTRY'}
                </Text>
                <Text style={s.selectChevron}>▼</Text>
              </TouchableOpacity>
            </View>

            {/* City — only if country selected and not Remote */}
            {selectedCountry && selectedCountry !== 'Remote' && (
              <View style={s.field}>
                <Text style={s.fieldLabel}>CITY</Text>
                <TouchableOpacity
                  style={s.selectBtn}
                  onPress={() => setShowCityModal(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.selectBtnText, !selectedCity && s.selectBtnPlaceholder]}>
                    {selectedCity || 'SELECT CITY'}
                  </Text>
                  <Text style={s.selectChevron}>▼</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Custom city — only if OTHER selected */}
            {selectedCity === OTHER_CITY && (
              <View style={s.field}>
                <Text style={s.fieldLabel}>CITY NAME</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="ENTER YOUR CITY"
                  placeholderTextColor="#666666"
                  value={customCity}
                  onChangeText={setCustomCity}
                  maxLength={60}
                />
              </View>
            )}

            {/* Date / Timeframe */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>DATE / TIMEFRAME</Text>
              <TextInput
                style={s.textInput}
                placeholder="E.G. JUNE 2025 OR ASAP"
                placeholderTextColor="#666666"
                value={dateTimeframe}
                onChangeText={setDateTimeframe}
                maxLength={60}
              />
            </View>

            {/* Budget */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>BUDGET RANGE</Text>
              <View style={s.budgetRow}>
                <View style={s.budgetInputWrap}>
                  <Text style={s.dollarSign}>$</Text>
                  <TextInput
                    style={s.budgetInput}
                    placeholder="MIN"
                    placeholderTextColor="#666666"
                    keyboardType="decimal-pad"
                    value={budgetMin}
                    onChangeText={setBudgetMin}
                    maxLength={10}
                  />
                </View>
                <Text style={s.budgetDash}>—</Text>
                <View style={s.budgetInputWrap}>
                  <Text style={s.dollarSign}>$</Text>
                  <TextInput
                    style={s.budgetInput}
                    placeholder="MAX"
                    placeholderTextColor="#666666"
                    keyboardType="decimal-pad"
                    value={budgetMax}
                    onChangeText={setBudgetMax}
                    maxLength={10}
                  />
                </View>
              </View>
            </View>

            {/* Description */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>DESCRIPTION</Text>
              <TextInput
                style={s.textArea}
                placeholder="DESCRIBE THE GIG IN DETAIL..."
                placeholderTextColor="#666666"
                multiline
                value={description}
                onChangeText={setDescription}
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={s.charCount}>{description.length}/1000</Text>
            </View>

            {/* Featured toggle */}
            <View style={s.featuredSection}>
              <View style={s.featuredLeft}>
                <Text style={s.featuredTitle}>FEATURED LISTING</Text>
                <Text style={s.featuredDesc}>
                  YOUR GIG APPEARS AT THE TOP OF THE BOARD WITH A FEATURED BADGE
                </Text>
                <Text style={s.featuredPrice}>${FEATURED_PRICE.toFixed(2)} ONE-TIME</Text>
              </View>
              <Switch
                value={isFeatured}
                onValueChange={setIsFeatured}
                trackColor={{ false: '#222222', true: colors.red }}
                thumbColor={colors.white}
              />
            </View>

            {/* Pricing summary */}
            <View style={s.pricingBox}>
              <View style={s.pricingRow}>
                <Text style={s.pricingLabel}>BASE LISTING</Text>
                <Text style={s.pricingValue}>FREE</Text>
              </View>
              {isFeatured && (
                <View style={s.pricingRow}>
                  <Text style={s.pricingLabel}>FEATURED UPGRADE</Text>
                  <Text style={s.pricingValue}>${FEATURED_PRICE.toFixed(2)}</Text>
                </View>
              )}
              <View style={[s.pricingRow, s.pricingTotal]}>
                <Text style={s.pricingTotalLabel}>TOTAL</Text>
                <Text style={s.pricingTotalValue}>
                  {totalCost === 0 ? 'FREE' : `$${totalCost.toFixed(2)}`}
                </Text>
              </View>
            </View>

            <View style={s.nextSection}>
              <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.7}>
                <Text style={s.nextBtnText}>REVIEW ›</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── STEP 2: REVIEW ──────────────────────────────────────────── */}
        {step === 'review' && (
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.stepHeader}>
              <Text style={s.stepTitle}>REVIEW YOUR GIG</Text>
            </View>

            <View style={s.reviewBadgeRow}>
              {artType ? (
                <View style={s.reviewBadge}>
                  <Text style={s.reviewBadgeText}>{artType.toUpperCase()}</Text>
                </View>
              ) : null}
              {isFeatured && (
                <View style={s.reviewFeaturedBadge}>
                  <Text style={s.reviewFeaturedBadgeText}>FEATURED</Text>
                </View>
              )}
            </View>

            <View style={s.reviewTitle}>
              <Text style={s.reviewTitleText}>{title.toUpperCase()}</Text>
              {companyName ? (
                <Text style={s.reviewCompanyName}>{companyName.toUpperCase()}</Text>
              ) : null}
            </View>

            <View style={s.reviewBlock}>
              {locationString ? <ReviewRow label="LOCATION" value={locationString} /> : null}
              {dateTimeframe ? <ReviewRow label="TIMEFRAME" value={dateTimeframe} /> : null}
              <ReviewRow label="BUDGET" value={formatBudget(
                budgetMin ? parseFloat(budgetMin) : null,
                budgetMax ? parseFloat(budgetMax) : null,
              )} />
            </View>

            {description ? (
              <View style={s.reviewDescSection}>
                <Text style={s.reviewDescLabel}>DESCRIPTION</Text>
                <Text style={s.reviewDescText}>{description.toUpperCase()}</Text>
              </View>
            ) : null}

            <View style={s.reviewPricingBox}>
              <Text style={s.reviewPricingLabel}>TOTAL DUE</Text>
              <Text style={s.reviewPricingValue}>
                {totalCost === 0 ? 'FREE' : `$${totalCost.toFixed(2)}`}
              </Text>
            </View>

            <View style={s.nextSection}>
              <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.7}>
                <Text style={s.nextBtnText}>
                  {totalCost === 0 ? 'CONFIRM & POST ›' : 'PAYMENT ›'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* ── STEP 3: PAYMENT ─────────────────────────────────────────── */}
        {step === 'payment' && (
          <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
            <View style={s.stepHeader}>
              <Text style={s.stepTitle}>PAYMENT</Text>
            </View>

            {totalCost === 0 ? (
              <View style={s.freeSection}>
                <Text style={s.freeTitle}>NO PAYMENT REQUIRED</Text>
                <Text style={s.freeDesc}>YOUR GIG LISTING IS FREE. TAP BELOW TO PUBLISH.</Text>
              </View>
            ) : (
              <View style={s.stripeSection}>
                <View style={s.stripeBox}>
                  <Text style={s.stripeTitle}>SECURE PAYMENT</Text>
                  <Text style={s.stripeAmount}>${totalCost.toFixed(2)}</Text>
                  <Text style={s.stripeDesc}>FEATURED LISTING — POWERED BY STRIPE</Text>
                  <View style={s.stripeStub}>
                    <Text style={s.stripeStubText}>STRIPE CHECKOUT COMING SOON</Text>
                    <Text style={s.stripeStubNote}>
                      PAYMENT INTEGRATION WILL BE ENABLED IN THE NEXT RELEASE.{'\n'}
                      YOUR GIG WILL BE POSTED AS A STANDARD LISTING FOR NOW.
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={s.nextSection}>
              <TouchableOpacity
                style={[s.submitBtn, submitting && s.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
                activeOpacity={0.7}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.black} size="small" />
                ) : (
                  <Text style={s.submitBtnText}>PUBLISH GIG</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Country Picker Modal */}
      <PickerModal
        visible={showCountryModal}
        title="SELECT COUNTRY"
        options={COUNTRIES}
        selected={selectedCountry}
        onSelect={(v) => {
          setSelectedCountry(v);
          setSelectedCity('');
          setCustomCity('');
        }}
        onClose={() => setShowCountryModal(false)}
      />

      {/* City Picker Modal */}
      <PickerModal
        visible={showCityModal}
        title="SELECT CITY"
        options={cityOptions}
        selected={selectedCity}
        onSelect={setSelectedCity}
        onClose={() => setShowCityModal(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  scroll: { flex: 1 },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#666666', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },

  progressRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111111' },
  progressStep: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  progressStepActive: { borderBottomColor: colors.red },
  progressLabel: { color: '#333333', fontFamily: MONO, fontSize: 7, letterSpacing: 0.2 },
  progressLabelActive: { color: colors.white },

  stepHeader: {
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  stepTitle: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.3 },

  // Fields
  field: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0,
    borderBottomWidth: 1, borderBottomColor: '#444444',
  },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fieldLabel: { color: '#aaaaaa', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 10 },
  fieldLabelSub: { color: '#444444', fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },

  textInput: {
    color: '#ffffff',
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.1,
    paddingBottom: 14,
    paddingTop: 0,
  },

  selectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14,
  },
  selectBtnText: { color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1 },
  selectBtnPlaceholder: { color: '#666666' },
  selectChevron: { color: '#555555', fontFamily: MONO, fontSize: 10 },

  textArea: {
    backgroundColor: '#111111',
    color: '#ffffff',
    fontFamily: MONO,
    fontSize: 13,
    letterSpacing: 0.1,
    lineHeight: 20,
    padding: 12,
    minHeight: 110,
    marginBottom: 14,
  },
  charCount: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.1, textAlign: 'right', marginBottom: 4 },

  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 },
  budgetInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#444444',
  },
  dollarSign: { color: '#888888', fontFamily: MONO, fontSize: 13, paddingRight: 6 },
  budgetInput: { flex: 1, color: '#ffffff', fontFamily: MONO, fontSize: 13, paddingBottom: 8 },
  budgetDash: { color: '#444444', fontFamily: MONO, fontSize: 13 },

  featuredSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#444444',
  },
  featuredLeft: { flex: 1, paddingRight: 16 },
  featuredTitle: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.15 },
  featuredDesc: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.1, lineHeight: 12, marginTop: 4 },
  featuredPrice: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, marginTop: 6 },

  pricingBox: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 0,
    borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#050505',
  },
  pricingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  pricingLabel: { color: '#444444', fontFamily: MONO, fontSize: 7, letterSpacing: 0.12 },
  pricingValue: { color: colors.white, fontFamily: MONO, fontSize: 8, letterSpacing: 0.1 },
  pricingTotal: { borderBottomWidth: 0 },
  pricingTotalLabel: { color: '#888888', fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  pricingTotalValue: { color: colors.red, fontFamily: MONO, fontSize: 13, letterSpacing: 0.15 },

  nextSection: { paddingHorizontal: 16, paddingTop: 20 },
  nextBtn: {
    borderWidth: 1, borderColor: colors.red,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.3 },

  // Review step
  reviewBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 16 },
  reviewBadge: { borderWidth: 1, borderColor: '#333333', paddingHorizontal: 8, paddingVertical: 4 },
  reviewBadgeText: { color: '#555555', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15 },
  reviewFeaturedBadge: { borderWidth: 1, borderColor: colors.red, backgroundColor: '#0f0000', paddingHorizontal: 8, paddingVertical: 4 },
  reviewFeaturedBadgeText: { color: colors.red, fontFamily: MONO, fontSize: 6, letterSpacing: 0.12 },
  reviewTitle: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  reviewTitleText: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18, lineHeight: 20 },
  reviewCompanyName: { color: '#666666', fontFamily: MONO, fontSize: 7, letterSpacing: 0.1, marginTop: 4 },
  reviewBlock: { borderBottomWidth: 1, borderBottomColor: '#111111', paddingHorizontal: 16 },
  reviewDescSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  reviewDescLabel: { color: '#333333', fontFamily: MONO, fontSize: 6, letterSpacing: 0.2, marginBottom: 8 },
  reviewDescText: { color: '#777777', fontFamily: MONO, fontSize: 7, letterSpacing: 0.08, lineHeight: 13 },
  reviewPricingBox: {
    margin: 16, borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#050505',
    padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  reviewPricingLabel: { color: '#888888', fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },
  reviewPricingValue: { color: colors.red, fontFamily: MONO, fontSize: 14, letterSpacing: 0.15 },

  // Payment step
  freeSection: { paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' },
  freeTitle: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.3, marginBottom: 12 },
  freeDesc: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.12, textAlign: 'center' },
  stripeSection: { paddingHorizontal: 16, paddingTop: 20 },
  stripeBox: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#050505', padding: 20, alignItems: 'center' },
  stripeTitle: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.2, marginBottom: 10 },
  stripeAmount: { color: colors.white, fontFamily: MONO, fontSize: 28, letterSpacing: 0.1 },
  stripeDesc: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.15, marginTop: 6, marginBottom: 20 },
  stripeStub: { borderWidth: 1, borderColor: '#222222', borderStyle: 'dashed', padding: 16, alignItems: 'center', width: '100%' },
  stripeStubText: { color: '#333333', fontFamily: MONO, fontSize: 7, letterSpacing: 0.15, marginBottom: 8 },
  stripeStubNote: { color: '#2a2a2a', fontFamily: MONO, fontSize: 6, letterSpacing: 0.08, lineHeight: 11, textAlign: 'center' },

  submitBtn: { backgroundColor: colors.red, height: 48, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: '#5a0000' },
  submitBtnText: { color: colors.white, fontFamily: MONO, fontSize: 10, letterSpacing: 0.3 },
});
