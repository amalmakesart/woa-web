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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import OctagonalImage from '../../components/OctagonalImage';
import { GIG_ART_TYPES, formatBudget } from '../../components/GigCard';
import { CITIES_BY_COUNTRY } from '../../constants/locationData';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

type Step = 'details' | 'review' | 'payment';
type ValueOption = { label: string; value: string };
type SchedulePicker = 'startDate' | 'startTime' | 'endDate' | 'endTime' | null;
const STANDARD_PRICE = 6.00;
const FEATURED_PRICE = 14.00;
const OTHER_CITY = 'OTHER — TYPE BELOW';

const COUNTRIES = ['Remote', ...Object.keys(CITIES_BY_COUNTRY).sort()];

function normalizeLocationValue(value: string | null) {
  return value?.trim().replace(/\s+/g, ' ').toUpperCase() ?? '';
}

function parseLocationParts(location: string | null) {
  const raw = location?.trim();
  if (!raw) return { country: null as string | null, city: null as string | null };
  if (raw.toLowerCase() === 'remote') {
    return { country: 'Remote', city: null };
  }

  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      city: parts.slice(0, -1).join(', '),
      country: parts[parts.length - 1],
    };
  }

  return { country: raw, city: null };
}

function formatDateLabel(value: string) {
  if (!value) return '';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimeLabel(value: string) {
  if (!value) return '';
  const [hour, minute] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function buildDateOptions(daysAhead = 730): ValueOption[] {
  return Array.from({ length: daysAhead }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + index);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const value = `${year}-${month}-${day}`;

    return {
      value,
      label: formatDateLabel(value).toUpperCase(),
    };
  });
}

function buildTimeOptions(intervalMinutes = 30): ValueOption[] {
  const options: ValueOption[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
    const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
    const minute = String(minutes % 60).padStart(2, '0');
    const value = `${hour}:${minute}`;

    options.push({
      value,
      label: formatTimeLabel(value).toUpperCase(),
    });
  }

  return options;
}

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
  close: { color: '#9a9a9a', fontFamily: MONO, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  rowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 10 },
});

function ValuePickerModal({
  visible, title, options, selectedValue, onSelect, onClose,
}: {
  visible: boolean;
  title: string;
  options: ValueOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onClose: () => void;
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
            keyExtractor={(item) => item.value}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={pm.row}
                onPress={() => { onSelect(item.value); onClose(); }}
                activeOpacity={0.7}
              >
                <Text style={[pm.rowText, selectedValue === item.value && pm.rowActive]}>
                  {item.label}
                </Text>
                {selectedValue === item.value ? <Text style={pm.check}>✓</Text> : null}
              </TouchableOpacity>
            )}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

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
  label: { color: '#9a9a9a', fontFamily: MONO, fontSize: 6, letterSpacing: 0.18 },
  value: { color: colors.white, fontFamily: MONO, fontSize: 8, letterSpacing: 0.1, flexShrink: 1, textAlign: 'right', marginLeft: 16 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PostGigScreen() {
  const navigation = useNavigation<any>();

  const [step, setStep] = useState<Step>('details');
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentWebView, setShowPaymentWebView] = useState(false);
  const [pendingGigId, setPendingGigId] = useState<string | null>(null);
  const [usesLegacyPostPaymentCreate, setUsesLegacyPostPaymentCreate] = useState(false);
  const [checkoutVersion] = useState(() => Date.now().toString());

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [posterName, setPosterName] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [description, setDescription] = useState('');
  const [artType, setArtType] = useState('');
  const [gigImageUri, setGigImageUri] = useState<string | null>(null);
  const [gigImageUrl, setGigImageUrl] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
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
  const [showArtTypeModal, setShowArtTypeModal] = useState(false);
  const [activeSchedulePicker, setActiveSchedulePicker] = useState<SchedulePicker>(null);

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

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const timeOptions = useMemo(() => buildTimeOptions(), []);

  const scheduleFromLabel = [
    startDate ? formatDateLabel(startDate) : null,
    startTime ? formatTimeLabel(startTime) : null,
  ].filter(Boolean).join(' · ');

  const scheduleToLabel = [
    endDate ? formatDateLabel(endDate) : null,
    endTime ? formatTimeLabel(endTime) : null,
  ].filter(Boolean).join(' · ');

  const dateTimeframe = scheduleFromLabel && scheduleToLabel
    ? `${scheduleFromLabel} — ${scheduleToLabel}`
    : scheduleFromLabel;

  const totalCost = isFeatured ? FEATURED_PRICE : STANDARD_PRICE;

  const handlePickGigImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('PERMISSION REQUIRED', 'Camera roll access is needed to upload a gig image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.85,
      aspect: [4, 3],
    });

    if (!result.canceled) {
      setGigImageUri(result.assets[0].uri);
      setGigImageUrl(null);
    }
  };

  const uploadGigImageIfNeeded = async () => {
    if (!gigImageUri || !currentUserId) return gigImageUrl;
    if (gigImageUrl && !gigImageUri.startsWith('file://') && !gigImageUri.startsWith('ph://')) {
      return gigImageUrl;
    }

    const rawExt = gigImageUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path = `${currentUserId}/gig-${Date.now()}.${ext}`;

    const response = await fetch(gigImageUri);
    const arrayBuffer = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(path, arrayBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      Alert.alert('ERROR', 'Your gig image could not be uploaded.');
      return null;
    }

    const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
    const publicUrl = urlData.publicUrl;
    setGigImageUrl(publicUrl);
    return publicUrl;
  };

  const validateDetails = () => {
    if (!title.trim()) {
      Alert.alert('REQUIRED', 'Please enter a gig title.');
      return false;
    }
    if (!artType) {
      Alert.alert('REQUIRED', 'Please select the kind of artist you need.');
      return false;
    }
    if (!startDate || !startTime) {
      Alert.alert('REQUIRED', 'Please choose a start date and time.');
      return false;
    }
    if ((endDate && !endTime) || (!endDate && endTime)) {
      Alert.alert('COMPLETE THE SCHEDULE', 'Please choose both an end date and an end time.');
      return false;
    }
    if (endDate && endTime) {
      const startValue = new Date(`${startDate}T${startTime}:00`).getTime();
      const endValue = new Date(`${endDate}T${endTime}:00`).getTime();
      if (endValue < startValue) {
        Alert.alert('CHECK THE TIMEFRAME', 'The end date and time needs to be after the start date and time.');
        return false;
      }
    }
    if (!selectedCountry) {
      Alert.alert('REQUIRED', 'Please choose where the gig takes place.');
      return false;
    }
    if (!budgetMin.trim() && !budgetMax.trim()) {
      Alert.alert('REQUIRED', 'Please enter a budget range.');
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

  const handleSubmit = () => {
    void (async () => {
      setSubmitting(true);
      const result = await createOrUpdatePendingGig();
      setSubmitting(false);
      if (result.shouldOpenCheckout) {
        setShowPaymentWebView(true);
      }
    })();
  };

  const getGigDraft = (status: 'payment_pending' | 'active') => {
    const minVal = budgetMin.trim() ? parseFloat(budgetMin.replace(/[^0-9.]/g, '')) : null;
    const maxVal = budgetMax.trim() ? parseFloat(budgetMax.replace(/[^0-9.]/g, '')) : null;

    return {
      poster_id: currentUserId,
      title: title.trim(),
      company_name: companyName.trim() || null,
      description: description.trim() || null,
      art_type: artType || null,
      image_url: gigImageUrl || null,
      location: locationString,
      date_timeframe: dateTimeframe || null,
      budget_min: minVal,
      budget_max: maxVal,
      is_featured: isFeatured,
      status,
      interest_count: 0,
      poster_name: posterName,
    };
  };

  const isPendingStatusSchemaError = (message: string) => {
    const lower = message.toLowerCase();
    return (
      lower.includes('payment_pending') ||
      lower.includes('invalid input value for enum') ||
      lower.includes('check constraint') ||
      lower.includes('violates check constraint')
    );
  };

  const createOrUpdatePendingGig = async (): Promise<{ gigId: string | null; shouldOpenCheckout: boolean }> => {
    if (!currentUserId) {
      Alert.alert('ERROR', 'Please log in again before posting a gig.');
      return { gigId: null, shouldOpenCheckout: false };
    }
    const draft = getGigDraft('payment_pending');
    const uploadedGigImage = await uploadGigImageIfNeeded();
    if (gigImageUri && !uploadedGigImage) {
      return { gigId: null, shouldOpenCheckout: false };
    }
    draft.image_url = uploadedGigImage || null;

    if (pendingGigId) {
      const { error } = await supabase.from('gigs').update(draft).eq('id', pendingGigId);
      if (error) {
        Alert.alert('ERROR', 'Gig draft could not be prepared for payment.');
        return { gigId: null, shouldOpenCheckout: false };
      }
      return { gigId: pendingGigId, shouldOpenCheckout: true };
    }

    const { data, error } = await supabase
      .from('gigs')
      .insert(draft)
      .select('id')
      .single();

    if (error) {
      if (isPendingStatusSchemaError(error.message ?? '')) {
        setUsesLegacyPostPaymentCreate(true);
        return { gigId: null, shouldOpenCheckout: true };
      }
      Alert.alert('ERROR', 'Gig draft could not be prepared for payment.');
      return { gigId: null, shouldOpenCheckout: false };
    }

    const gigId = (data as { id: string } | null)?.id ?? null;
    setPendingGigId(gigId);
    setUsesLegacyPostPaymentCreate(false);
    return { gigId, shouldOpenCheckout: true };
  };

  const activatePendingGig = async (gigId: string) => {
    const { error } = await supabase
      .from('gigs')
      .update({ status: 'active', is_featured: isFeatured })
      .eq('id', gigId);

    if (error) {
      Alert.alert('ERROR', 'Payment was received, but the gig still needs to be activated.');
      return;
    }

    await notifyNearbyArtists(gigId);

    setPendingGigId(null);
    Alert.alert('GIG POSTED ✓', 'Your gig is now live on WORK(ER) OF ART.',
      [{ text: 'VIEW GIGS', onPress: () => navigation.goBack() }]);
  };

  const createGigAfterPayment = async () => {
    const { data, error } = await supabase
      .from('gigs')
      .insert(getGigDraft('active'))
      .select('id')
      .single();

    if (error) {
      Alert.alert('ERROR', 'Payment succeeded, but the gig could not be created automatically.');
      return;
    }

    const createdGigId = (data as { id: string } | null)?.id ?? null;
    if (createdGigId) {
      await notifyNearbyArtists(createdGigId);
    }

    setUsesLegacyPostPaymentCreate(false);
    Alert.alert('GIG POSTED ✓', 'Your gig is now live on WORK(ER) OF ART.',
      [{ text: 'VIEW GIGS', onPress: () => navigation.goBack() }]);
  };

  const notifyNearbyArtists = async (gigId: string) => {
    if (!currentUserId || !locationString) return;

    const location = parseLocationParts(locationString);
    if (!location.country || location.country === 'Remote') return;

    const { data: candidateProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, city, country')
      .neq('id', currentUserId)
      .not('role', 'eq', 'GIG_POSTER');

    if (profileError || !candidateProfiles?.length) return;

    const normalizedCountry = normalizeLocationValue(location.country);
    const normalizedCity = normalizeLocationValue(location.city);

    const matchingUserIds = candidateProfiles
      .filter((profile: any) => {
        if (!['ARTIST', 'COLLECTIVE'].includes((profile.role ?? '').toUpperCase())) return false;
        if (normalizeLocationValue(profile.country) !== normalizedCountry) return false;
        if (normalizedCity) {
          return normalizeLocationValue(profile.city) === normalizedCity;
        }
        return true;
      })
      .map((profile: any) => profile.id)
      .filter(Boolean);

    if (!matchingUserIds.length) return;

    const notificationRows = matchingUserIds.map((userId: string) => ({
      user_id: userId,
      type: 'gig_nearby',
      actor_id: currentUserId,
      reference_id: gigId,
      reference_type: 'gig',
      preview_text: title.trim() || null,
      is_read: false,
    }));

    await supabase.from('notifications').insert(notificationRows);
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
                placeholderTextColor="#9a9a9a"
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
                placeholderTextColor="#9a9a9a"
                value={companyName}
                onChangeText={setCompanyName}
                maxLength={80}
              />
            </View>

            {/* Gig image */}
            <View style={s.field}>
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldLabel}>GIG IMAGE</Text>
                <Text style={s.fieldLabelSub}>OPTIONAL</Text>
              </View>
              <TouchableOpacity style={s.imagePicker} onPress={handlePickGigImage} activeOpacity={0.7}>
                {gigImageUri ? (
                  <Image source={{ uri: gigImageUri }} style={s.imagePreview} resizeMode="cover" />
                ) : (
                  <View style={s.imagePlaceholder}>
                    <Text style={s.imagePlaceholderTitle}>ADD A VISUAL</Text>
                    <Text style={s.imagePlaceholderText}>POSTER, REFERENCE, MOOD, OR EVENT IMAGE</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Art Type */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>ART TYPE</Text>
              <TouchableOpacity
                style={s.selectBtn}
                onPress={() => setShowArtTypeModal(true)}
                activeOpacity={0.7}
              >
                <Text style={[s.selectBtnText, !artType && s.selectBtnPlaceholder]}>
                  {artType ? artType.toUpperCase() : 'SELECT TYPE'}
                </Text>
                <Text style={s.selectChevron}>▼</Text>
              </TouchableOpacity>
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
                  placeholderTextColor="#9a9a9a"
                  value={customCity}
                  onChangeText={setCustomCity}
                  maxLength={60}
                />
              </View>
            )}

            {/* Schedule */}
            <View style={s.field}>
              <View style={s.fieldLabelRow}>
                <Text style={s.fieldLabel}>SCHEDULE *</Text>
                <Text style={s.fieldLabelSub}>FROM / TO</Text>
              </View>

              <View style={s.scheduleCard}>
                <Text style={s.scheduleLabel}>FROM</Text>
                <View style={s.scheduleRow}>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => setActiveSchedulePicker('startDate')}
                    activeOpacity={0.7}
                  >
                    <Text style={s.scheduleBtnLabel}>DATE</Text>
                    <Text style={[s.scheduleBtnValue, !startDate && s.selectBtnPlaceholder]}>
                      {startDate ? formatDateLabel(startDate).toUpperCase() : 'SELECT DATE'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => setActiveSchedulePicker('startTime')}
                    activeOpacity={0.7}
                  >
                    <Text style={s.scheduleBtnLabel}>TIME</Text>
                    <Text style={[s.scheduleBtnValue, !startTime && s.selectBtnPlaceholder]}>
                      {startTime ? formatTimeLabel(startTime).toUpperCase() : 'SELECT TIME'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.scheduleCard}>
              <View style={s.scheduleHeader}>
                <Text style={[s.scheduleLabel, { marginBottom: 0 }]}>TO</Text>
              </View>
                <View style={s.scheduleRow}>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => setActiveSchedulePicker('endDate')}
                    activeOpacity={0.7}
                  >
                    <Text style={s.scheduleBtnLabel}>DATE</Text>
                    <Text style={[s.scheduleBtnValue, !endDate && s.selectBtnPlaceholder]}>
                      {endDate ? formatDateLabel(endDate).toUpperCase() : 'SELECT DATE'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.scheduleBtn}
                    onPress={() => setActiveSchedulePicker('endTime')}
                    activeOpacity={0.7}
                  >
                    <Text style={s.scheduleBtnLabel}>TIME</Text>
                    <Text style={[s.scheduleBtnValue, !endTime && s.selectBtnPlaceholder]}>
                      {endTime ? formatTimeLabel(endTime).toUpperCase() : 'SELECT TIME'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {dateTimeframe ? (
                <Text style={s.schedulePreview}>{dateTimeframe.toUpperCase()}</Text>
              ) : null}
            </View>

            {/* Budget */}
            <View style={s.field}>
              <Text style={s.fieldLabel}>BUDGET RANGE *</Text>
              <View style={s.budgetRow}>
                <View style={s.budgetInputWrap}>
                  <Text style={s.dollarSign}>$</Text>
                  <TextInput
                    style={s.budgetInput}
                    placeholder="MIN"
                    placeholderTextColor="#9a9a9a"
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
                    placeholderTextColor="#9a9a9a"
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
                placeholderTextColor="#9a9a9a"
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
                <Text style={s.pricingValue}>$6.00</Text>
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
                  {`$${totalCost.toFixed(2)}`}
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
              {gigImageUri ? (
                <Image source={{ uri: gigImageUri }} style={s.reviewImage} resizeMode="cover" />
              ) : null}
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
                {`$${totalCost.toFixed(2)}`}
              </Text>
            </View>

            <View style={s.nextSection}>
              <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.7}>
                <Text style={s.nextBtnText}>
                  {'PAYMENT ›'}
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

            <View style={s.paymentSummary}>
              <Text style={s.paymentSummaryLabel}>TOTAL DUE</Text>
              <Text style={s.paymentSummaryAmount}>${totalCost.toFixed(2)}</Text>
              <Text style={s.paymentSummaryNote}>
                {isFeatured ? 'FEATURED GIG — PINNED TO TOP FOR 7 DAYS' : 'STANDARD GIG LISTING'}
              </Text>
            </View>

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
                  <Text style={s.submitBtnText}>PROCEED TO PAYMENT ›</Text>
                )}
              </TouchableOpacity>
            </View>

            <Modal
              visible={showPaymentWebView}
              animationType="slide"
              onRequestClose={() => setShowPaymentWebView(false)}
            >
              <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
                <View style={s.webViewTopBar}>
                  <TouchableOpacity onPress={() => setShowPaymentWebView(false)} style={s.webViewCloseBtn} activeOpacity={0.7}>
                    <Text style={s.webViewCloseText}>✕ CANCEL</Text>
                  </TouchableOpacity>
                  <Text style={s.webViewTitle}>POST A GIG</Text>
                  <View style={{ width: 80 }} />
                </View>
                <WebView
                  source={{
                    uri: `https://workerofart.com/checkout/gig.html?v=${checkoutVersion}&user_id=${currentUserId}&featured=${isFeatured}${
                      pendingGigId ? `&gig_id=${pendingGigId}` : ''
                    }`,
                  }}
                  style={{ flex: 1 }}
                  cacheEnabled={false}
                  incognito
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      if (data.type === 'gig_payment_success' && pendingGigId) {
                        setShowPaymentWebView(false);
                        void activatePendingGig(pendingGigId);
                      } else if (data.type === 'gig_payment_success' && usesLegacyPostPaymentCreate) {
                        setShowPaymentWebView(false);
                        void createGigAfterPayment();
                      }
                    } catch {}
                  }}
                />
              </SafeAreaView>
            </Modal>

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
      <PickerModal
        visible={showArtTypeModal}
        title="SELECT ART TYPE"
        options={GIG_ART_TYPES}
        selected={artType}
        onSelect={setArtType}
        onClose={() => setShowArtTypeModal(false)}
      />
      <ValuePickerModal
        visible={activeSchedulePicker === 'startDate'}
        title="SELECT START DATE"
        options={dateOptions}
        selectedValue={startDate}
        onSelect={setStartDate}
        onClose={() => setActiveSchedulePicker(null)}
      />
      <ValuePickerModal
        visible={activeSchedulePicker === 'startTime'}
        title="SELECT START TIME"
        options={timeOptions}
        selectedValue={startTime}
        onSelect={setStartTime}
        onClose={() => setActiveSchedulePicker(null)}
      />
      <ValuePickerModal
        visible={activeSchedulePicker === 'endDate'}
        title="SELECT END DATE"
        options={dateOptions}
        selectedValue={endDate}
        onSelect={setEndDate}
        onClose={() => setActiveSchedulePicker(null)}
      />
      <ValuePickerModal
        visible={activeSchedulePicker === 'endTime'}
        title="SELECT END TIME"
        options={timeOptions}
        selectedValue={endTime}
        onSelect={setEndTime}
        onClose={() => setActiveSchedulePicker(null)}
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
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notifDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },

  progressRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111111' },
  progressStep: { flex: 1, alignItems: 'center', paddingVertical: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  progressStepActive: { borderBottomColor: colors.red },
  progressLabel: { color: '#8f8f8f', fontFamily: MONO, fontSize: 7, letterSpacing: 0.2 },
  progressLabelActive: { color: colors.white },

  stepHeader: {
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  stepTitle: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.3 },

  // Fields
  field: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 0,
    borderBottomWidth: 1, borderBottomColor: '#9a9a9a',
  },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  fieldLabel: { color: '#aaaaaa', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 10 },
  fieldLabelSub: { color: '#9a9a9a', fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },

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
  selectBtnPlaceholder: { color: '#b5b5b5' },
  selectChevron: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11 },
  imagePicker: {
    borderWidth: 1,
    borderColor: '#222222',
    backgroundColor: '#080808',
    marginBottom: 14,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#0d0d0d',
  },
  imagePlaceholder: {
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  imagePlaceholderTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.18,
    marginBottom: 6,
  },
  imagePlaceholderText: {
    color: '#b5b5b5',
    fontFamily: MONO,
    fontSize: 11,
    letterSpacing: 0.12,
    textAlign: 'center',
    lineHeight: 17,
  },
  scheduleCard: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#080808',
    padding: 12,
    marginBottom: 10,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  scheduleLabel: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18, marginBottom: 10 },
  scheduleOptional: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  scheduleRow: { flexDirection: 'row', gap: 10 },
  scheduleBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#222222',
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  scheduleBtnLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.14, marginBottom: 6 },
  scheduleBtnValue: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1 },
  schedulePreview: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, marginTop: 4 },

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
  charCount: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, textAlign: 'right', marginBottom: 4 },

  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 14 },
  budgetInputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#9a9a9a',
  },
  dollarSign: { color: '#b5b5b5', fontFamily: MONO, fontSize: 13, paddingRight: 6 },
  budgetInput: { flex: 1, color: '#ffffff', fontFamily: MONO, fontSize: 13, paddingBottom: 8 },
  budgetDash: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13 },

  featuredSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: '#9a9a9a',
  },
  featuredLeft: { flex: 1, paddingRight: 16 },
  featuredTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15 },
  featuredDesc: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, lineHeight: 16, marginTop: 4 },
  featuredPrice: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, marginTop: 6 },

  pricingBox: {
    marginHorizontal: 16, marginTop: 16, marginBottom: 0,
    borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#050505',
  },
  pricingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  pricingLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  pricingValue: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  pricingTotal: { borderBottomWidth: 0 },
  pricingTotalLabel: { color: '#aaaaaa', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  pricingTotalValue: { color: colors.red, fontFamily: MONO, fontSize: 13, letterSpacing: 0.15 },

  nextSection: { paddingHorizontal: 16, paddingTop: 20 },
  nextBtn: {
    borderWidth: 1, borderColor: colors.red,
    height: 48, alignItems: 'center', justifyContent: 'center',
  },
  nextBtnText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.3 },

  // Review step
  reviewBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingTop: 16 },
  reviewBadge: { borderWidth: 1, borderColor: '#333333', paddingHorizontal: 8, paddingVertical: 4 },
  reviewBadgeText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  reviewFeaturedBadge: { borderWidth: 1, borderColor: colors.red, backgroundColor: '#0f0000', paddingHorizontal: 8, paddingVertical: 4 },
  reviewFeaturedBadgeText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  reviewTitle: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  reviewImage: { width: '100%', height: 180, marginBottom: 14, backgroundColor: '#0d0d0d' },
  reviewTitleText: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18, lineHeight: 20 },
  reviewCompanyName: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, marginTop: 4 },
  reviewBlock: { borderBottomWidth: 1, borderBottomColor: '#111111', paddingHorizontal: 16 },
  reviewDescSection: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  reviewDescLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 8 },
  reviewDescText: { color: '#999999', fontFamily: MONO, fontSize: 11, letterSpacing: 0.08, lineHeight: 17 },
  reviewPricingBox: {
    margin: 16, borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#050505',
    padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  reviewPricingLabel: { color: '#aaaaaa', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  reviewPricingValue: { color: colors.red, fontFamily: MONO, fontSize: 14, letterSpacing: 0.15 },

  // Payment step
  freeSection: { paddingHorizontal: 16, paddingVertical: 40, alignItems: 'center' },
  freeTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.3, marginBottom: 12 },
  freeDesc: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, textAlign: 'center' },
  stripeSection: { paddingHorizontal: 16, paddingTop: 20 },
  stripeBox: { borderWidth: 1, borderColor: '#1a1a1a', backgroundColor: '#050505', padding: 20, alignItems: 'center' },
  stripeTitle: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 10 },
  stripeAmount: { color: colors.white, fontFamily: MONO, fontSize: 28, letterSpacing: 0.1 },
  stripeDesc: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginTop: 6, marginBottom: 20 },
  stripeStub: { borderWidth: 1, borderColor: '#222222', borderStyle: 'dashed', padding: 16, alignItems: 'center', width: '100%' },
  stripeStubText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 8 },
  stripeStubNote: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.08, lineHeight: 15, textAlign: 'center' },

  paymentSummary: {
    marginHorizontal: 16, marginTop: 20,
    borderWidth: 1, borderColor: '#1a1a1a',
    backgroundColor: '#050505', padding: 20, alignItems: 'center',
  },
  paymentSummaryLabel: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 8 },
  paymentSummaryAmount: { color: colors.white, fontFamily: MONO, fontSize: 32, letterSpacing: 0.1, marginBottom: 8 },
  paymentSummaryNote: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12 },
  webViewTopBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111', backgroundColor: '#000000',
  },
  webViewCloseBtn: { padding: 4, minWidth: 80 },
  webViewCloseText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  webViewTitle: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  submitBtn: { backgroundColor: colors.red, height: 48, alignItems: 'center', justifyContent: 'center' },
  submitBtnDisabled: { backgroundColor: '#5a0000' },
  submitBtnText: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.3 },
});
