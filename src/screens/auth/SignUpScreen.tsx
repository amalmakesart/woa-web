import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  SafeAreaView,
  KeyboardAvoidingView,
  Modal,
  FlatList,
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { DISCIPLINES, ART_TYPES_BY_DISCIPLINE, CITIES_BY_COUNTRY } from '../../constants/locationData';
import { containsBannedWords, getBannedWordError, validateUsername } from '../../lib/contentFilter';
import { sendWelcomeExperience } from '../../lib/welcome';
import { clearPendingSignupDraft, savePendingSignupDraft } from '../../lib/signupRecovery';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
type Role = 'ARTIST' | 'GIG_POSTER' | 'COLLECTIVE' | 'ART_LOVER';
type UsernameStatus = 'idle' | 'checking' | 'taken' | 'available';
type Step = 1 | 2 | 3 | 4;
const AUTH_LABEL = '#9a9a9a';
const AUTH_SUBTEXT = '#b0b0b0';
const AUTH_TERTIARY = '#7b7b7b';
const AUTH_PLACEHOLDER = '#7a7a7a';
const EMAIL_REDIRECT_URL = 'https://www.workerofart.com/auth/confirmed';

const COLLECTIVE_TYPES = [
  'GALLERY', 'RECORD LABEL', 'DANCE COMPANY', 'THEATRE COMPANY',
  'FILM COLLECTIVE', 'MUSIC VENUE', 'ART RESIDENCY', 'PUBLISHING HOUSE',
  'CREATIVE AGENCY', 'COMMUNITY ARTS ORG', 'FESTIVAL / EVENT', 'OTHER',
];

const ROLE_OPTIONS: { value: Role; label: string; description: string }[] = [
  {
    value: 'ARTIST',
    label: 'ARTIST',
    description: 'SHARE YOUR WORK, BUILD YOUR PROFILE, CONNECT WITH OTHER CREATIVES, AND APPLY FOR GIGS AND COLLABS.',
  },
  {
    value: 'GIG_POSTER',
    label: 'GIG POSTER',
    description: 'POST PAID OPPORTUNITIES, DISCOVER ARTISTS, REVIEW APPLICANTS, AND HIRE THE RIGHT CREATIVE TEAM.',
  },
  {
    value: 'COLLECTIVE',
    label: 'COLLECTIVE',
    description: 'CREATE A SHARED PRESENCE FOR YOUR GROUP, SHOWCASE MEMBERS, POST COLLABS, AND BE DISCOVERED AS AN ORGANIZATION.',
  },
  {
    value: 'ART_LOVER',
    label: 'ART LOVER',
    description: 'DISCOVER ART, FOLLOW ARTISTS, AND STAY IN THE ARTSY LOOP.',
  },
];

// ─── WOA Logo ────────────────────────────────────────────────────────────────

function WOALogo() {
  return (
    <View style={logo.wrap}>
      <View style={logo.box}>
        <Text style={logo.text}>WORK(ER)</Text>
        <View style={logo.bottomRow}>
          <Text style={logo.text}>OF ART </Text>
          <Text style={logo.dot}>●</Text>
        </View>
      </View>
    </View>
  );
}

const logo = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 32 },
  box: {
    borderWidth: 1,
    borderColor: colors.white,
    width: 124,
    height: 124,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.25 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { color: colors.red, fontSize: 13 },
});

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = ['CREDENTIALS', 'PROFILE', 'LINKS'];
  return (
    <View style={si.row}>
      {steps.map((label, i) => {
        const num = (i + 1) as 1 | 2 | 3;
        const active = num === step;
        const past = num < step;
        return (
          <React.Fragment key={label}>
            <Text style={[si.label, active && si.active, past && si.past]}>{label}</Text>
            {i < steps.length - 1 && <Text style={si.arrow}> › </Text>}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const si = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 28 },
  label: { color: AUTH_TERTIARY, fontFamily: MONO, fontSize: 12, letterSpacing: 0.2 },
  active: { color: colors.white },
  past: { color: AUTH_LABEL },
  arrow: { color: AUTH_TERTIARY, fontFamily: MONO, fontSize: 12 },
});

// ─── Field ───────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  required?: boolean;
  optional?: boolean;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address' | 'url' | 'number-pad';
  borderColor?: string;
  hint?: string;
  hintColor?: string;
  textColor?: string;
  multiline?: boolean;
  numberOfLines?: number;
  placeholder?: string;
  maxLength?: number;
}

function Field({
  label, value, onChangeText, required, optional, secureTextEntry,
  autoCapitalize = 'none', keyboardType = 'default', borderColor = colors.border,
  hint, hintColor = colors.red, textColor = colors.white, multiline, numberOfLines,
  placeholder, maxLength,
}: FieldProps) {
  return (
    <View style={field.wrap}>
      <Text style={field.label}>
        {label}
        {required && <Text style={field.required}> *</Text>}
        {optional && <Text style={field.optional}> (OPTIONAL)</Text>}
      </Text>
      <TextInput
        style={[
          field.input,
          { borderBottomColor: borderColor, color: textColor },
          multiline && { height: 80, textAlignVertical: 'top' },
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={AUTH_PLACEHOLDER}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
        multiline={multiline}
        numberOfLines={numberOfLines}
        maxLength={maxLength}
      />
      {hint ? <Text style={[field.hint, { color: hintColor }]}>{hint}</Text> : null}
    </View>
  );
}

const field = StyleSheet.create({
  wrap: { marginBottom: 22 },
  label: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18, marginBottom: 8 },
  required: { color: colors.red },
  optional: { color: AUTH_TERTIARY },
  input: {
    color: colors.white, fontFamily: MONO, fontSize: 16,
    borderBottomWidth: 1, paddingVertical: 8, letterSpacing: 0.12,
  },
  hint: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.16, marginTop: 6 },
});

// ─── Octagon Upload ──────────────────────────────────────────────────────────

function OctagonUpload({ photoUri, onPress }: { photoUri: string | null; onPress: () => void }) {
  return (
    <TouchableOpacity style={oct.wrap} onPress={onPress} activeOpacity={0.7}>
      {photoUri ? (
        <Image source={{ uri: photoUri }} style={oct.image} resizeMode="cover" />
      ) : (
        <View style={oct.shape} />
      )}
      <Text style={[oct.label, photoUri ? oct.labelSelected : oct.labelDefault]}>
        {photoUri ? '✓ PHOTO SELECTED' : '+ UPLOAD PHOTO *'}
      </Text>
    </TouchableOpacity>
  );
}

const oct = StyleSheet.create({
  wrap: { alignItems: 'center', marginBottom: 28 },
  shape: { width: 102, height: 102, backgroundColor: colors.gray2, borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginBottom: 10 },
  image: { width: 102, height: 102, borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  label: { fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  labelDefault: { color: colors.red },
  labelSelected: { color: '#2a7a4f' },
});

// ─── Dropdown Field ──────────────────────────────────────────────────────────

function DropdownField({ label, value, placeholder, onPress, required, disabled }: {
  label: string; value: string; placeholder: string;
  onPress: () => void; required?: boolean; disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[dd.wrap, disabled && dd.disabled]}
      onPress={disabled ? undefined : onPress}
      activeOpacity={disabled ? 1 : 0.7}
    >
      <Text style={dd.label}>
        {label}{required && <Text style={dd.required}> *</Text>}
      </Text>
      <View style={dd.row}>
        <Text style={[dd.value, !value && dd.placeholder]}>{value || placeholder}</Text>
        <Text style={dd.chevron}>›</Text>
      </View>
      <View style={dd.border} />
    </TouchableOpacity>
  );
}

const dd = StyleSheet.create({
  wrap: { marginBottom: 22 },
  disabled: { opacity: 0.3 },
  label: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18, marginBottom: 8 },
  required: { color: colors.red },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  value: { color: colors.white, fontFamily: MONO, fontSize: 16, letterSpacing: 0.12, flex: 1 },
  placeholder: { color: AUTH_PLACEHOLDER },
  chevron: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 17, marginLeft: 8 },
  border: { height: 1, backgroundColor: colors.border },
});

// ─── Single-select Modal Picker ───────────────────────────────────────────────

function ModalPicker({ visible, onClose, options, selected, onSelect, title, searchValue, onSearchChange }: {
  visible: boolean; onClose: () => void; options: string[]; selected: string;
  onSelect: (item: string) => void; title: string; searchValue: string; onSearchChange: (v: string) => void;
}) {
  const filtered = options.filter(item => item.toLowerCase().includes(searchValue.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={mp.safe}>
        <View style={mp.header}>
          <Text style={mp.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={mp.close}>✕ CLOSE</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={mp.search} value={searchValue} onChangeText={onSearchChange}
          placeholder="SEARCH..." placeholderTextColor={AUTH_PLACEHOLDER}
          autoCapitalize="none" autoCorrect={false}
        />
        <FlatList
          data={filtered}
          keyExtractor={item => item}
          renderItem={({ item }) => (
            <TouchableOpacity style={mp.row} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
              <Text style={[mp.rowText, selected === item && mp.rowTextSelected]}>{item}</Text>
            </TouchableOpacity>
          )}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </Modal>
  );
}

const mp = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.2 },
  close: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  search: { backgroundColor: colors.black, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 28, paddingVertical: 12 },
  row: { paddingVertical: 14, paddingHorizontal: 28, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  rowTextSelected: { color: colors.red },
});

// ─── Multi-select Art Type Modal ──────────────────────────────────────────────

const ALL_ART_TYPES = [...new Set(Object.values(ART_TYPES_BY_DISCIPLINE).flat())].sort();

function ArtTypeModal({ visible, onClose, discipline, selected, onToggle, onClear, allTags, maxTags = 5 }: {
  visible: boolean; onClose: () => void; discipline: string;
  selected: string[]; onToggle: (item: string) => void; onClear: () => void;
  allTags?: string[]; maxTags?: number;
}) {
  const [search, setSearch] = useState('');
  const baseOptions = allTags ?? (ART_TYPES_BY_DISCIPLINE[discipline] ?? []);
  const options = baseOptions.filter(
    item => item.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={atm.safe}>
        <View style={atm.header}>
          <Text style={atm.title}>TAGS / INTERESTS <Text style={atm.titleSub}>UP TO {maxTags}</Text></Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={atm.done}>DONE</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={atm.search} value={search} onChangeText={setSearch}
          placeholder="SEARCH..." placeholderTextColor={AUTH_PLACEHOLDER}
          autoCapitalize="none" autoCorrect={false}
        />
        {selected.length >= maxTags ? (
          <View style={atm.maxBanner}>
            <Text style={atm.maxText}>MAXIMUM {maxTags} TAGS SELECTED</Text>
          </View>
        ) : null}
        <FlatList
          data={options}
          keyExtractor={item => item}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isSelected = selected.includes(item);
            return (
              <TouchableOpacity
                style={atm.row}
                onPress={() => onToggle(item)}
                activeOpacity={0.7}
              >
                <Text style={[atm.rowText, isSelected && atm.rowTextSelected]}>{item}</Text>
                {isSelected ? <Text style={atm.check}>✓</Text> : null}
              </TouchableOpacity>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const atm = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 28, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.2 },
  titleSub: { color: AUTH_TERTIARY, fontSize: 11 },
  done: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  search: { backgroundColor: colors.black, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 28, paddingVertical: 12 },
  maxBanner: { backgroundColor: '#1a0000', paddingHorizontal: 28, paddingVertical: 10 },
  maxText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 28, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1, flex: 1 },
  rowTextSelected: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 12 },
});

// ─── Available Toggle ─────────────────────────────────────────────────────────

function AvailableToggle({ value, onValueChange }: { value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <TouchableOpacity
      style={[tog.track, value ? tog.trackOn : tog.trackOff]}
      onPress={() => onValueChange(!value)}
      activeOpacity={0.8}
    >
      <View style={[tog.thumb, value ? tog.thumbRight : tog.thumbLeft]} />
    </TouchableOpacity>
  );
}

const tog = StyleSheet.create({
  track: { width: 32, height: 18, borderRadius: 9, justifyContent: 'center' },
  trackOn: { backgroundColor: colors.red },
  trackOff: { backgroundColor: '#1a1a1a' },
  thumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ffffff', position: 'absolute' },
  thumbRight: { right: 2 },
  thumbLeft: { left: 2 },
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

interface Props { navigation: any }

export default function SignUpScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<Role>('ARTIST');

  // Step 1
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2
  const [fullName, setFullName] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [selectedArtTypes, setSelectedArtTypes] = useState<string[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [experience, setExperience] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Step 2 — Collective only
  const [collectiveType, setCollectiveType] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const [collectiveTypePickerVisible, setCollectiveTypePickerVisible] = useState(false);
  const [collectiveTypeSearch, setCollectiveTypeSearch] = useState('');

  // Step 3
  const [bio, setBio] = useState('');
  const [instagram, setInstagram] = useState('');
  const [spotify, setSpotify] = useState('');
  const [facebook, setFacebook] = useState('');
  const [website, setWebsite] = useState('');

  // Picker visibility
  const [disciplinePickerVisible, setDisciplinePickerVisible] = useState(false);
  const [artTypeModalVisible, setArtTypeModalVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [cityPickerVisible, setCityPickerVisible] = useState(false);

  // Search state
  const [disciplineSearch, setDisciplineSearch] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [citySearch, setCitySearch] = useState('');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildProfilePayload = useCallback((signupRole: Role, profilePhotoUrl: string | null = null) => {
    const basePayload: Record<string, any> = {
      username: username.toLowerCase(),
      full_name: fullName.trim(),
      profile_photo_url: profilePhotoUrl,
      role: signupRole,
    };

    if (signupRole === 'ARTIST') {
      return {
        ...basePayload,
        discipline,
        art_types: selectedArtTypes,
        country,
        city,
        experience,
        bio,
        instagram: instagram.trim() || null,
        spotify_url: spotify.trim() || null,
        facebook: facebook.trim() || null,
        website: website.trim() || null,
        is_available: isAvailable,
      };
    }

    if (signupRole === 'COLLECTIVE') {
      return {
        ...basePayload,
        collective_type: collectiveType,
        member_count: memberCount ? parseInt(memberCount, 10) : null,
        country,
        city,
        bio: bio.trim() || null,
        instagram: instagram.trim() || null,
        website: website.trim() || null,
      };
    }

    if (signupRole === 'ART_LOVER') {
      return { ...basePayload, art_types: selectedArtTypes };
    }

    return basePayload;
  }, [
    bio,
    city,
    collectiveType,
    country,
    discipline,
    facebook,
    fullName,
    instagram,
    isAvailable,
    memberCount,
    selectedArtTypes,
    spotify,
    username,
    website,
    experience,
  ]);

  const uploadProfilePhoto = useCallback(async (userId: string) => {
    if (!photoUri) return null;

    const rawExt = photoUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
    const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const path = `${userId}/avatar.${ext}`;
    const response = await fetch(photoUri);
    const arrayBuffer = await response.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, arrayBuffer, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return null;
    }

    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
    return urlData.publicUrl;
  }, [photoUri]);

  const finalizeAuthenticatedSignUp = useCallback(async (userId: string, signupRole: Role) => {
    const profilePhotoUrl = await uploadProfilePhoto(userId);
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      ...buildProfilePayload(signupRole, profilePhotoUrl),
    });

    if (profileError) {
      throw profileError;
    }

    await sendWelcomeExperience(userId, signupRole);
    await clearPendingSignupDraft();
    navigation.replace('Permissions');
  }, [buildProfilePayload, navigation, uploadProfilePhoto]);

  const handlePendingEmailConfirmation = useCallback(async (userId: string, signupRole: Role) => {
    await savePendingSignupDraft({
      userId,
      role: signupRole,
      photoUri,
    });
    Alert.alert(
      'CHECK YOUR EMAIL',
      'We created your account, but you need to confirm your email before the app can finish signing you in. If no confirmation email arrives, your Supabase project likely still needs custom SMTP configured.',
      [{ text: 'OK', onPress: () => navigation.replace('Login') }]
    );
  }, [navigation, photoUri]);

  const handleUsernameChange = useCallback((val: string) => {
    // Strip spaces and any non-alphanumeric/underscore characters
    const sanitized = val.replace(/[^a-zA-Z0-9_]/g, '');
    setUsername(sanitized);
    if (!sanitized) { setUsernameStatus('idle'); return; }
    setUsernameStatus('checking');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', sanitized.toLowerCase())
          .maybeSingle();
        setUsernameStatus(data ? 'taken' : 'available');
      } catch {
        setUsernameStatus('idle');
      }
    }, 500);
  }, []);

  const usernameBorderColor = () => {
    if (usernameStatus === 'taken') return colors.red;
    if (usernameStatus === 'available') return '#2a7a4f';
    if (usernameStatus === 'checking') return colors.gray5;
    return colors.border;
  };

  const usernameHint = () => {
    if (usernameStatus === 'checking') return 'CHECKING...';
    if (usernameStatus === 'taken') return '✕  ALREADY TAKEN';
    if (usernameStatus === 'available') return '✓  AVAILABLE';
    return '';
  };

  const usernameHintColor = () => {
    if (usernameStatus === 'taken') return colors.red;
    if (usernameStatus === 'available') return '#2a7a4f';
    return colors.gray5;
  };

  const usernameValidationError = validateUsername(username);
  const canCreateAccount = Boolean(
    agreed &&
    email.trim() &&
    password.trim() &&
    username.trim() &&
    !usernameValidationError &&
    usernameStatus === 'available'
  );

  const handleCreateAccount = async () => {
    setError('');
    if (!agreed) { setError('YOU MUST AGREE TO THE TERMS.'); return; }
    if (usernameStatus !== 'available') { setError('CHOOSE AN AVAILABLE USERNAME.'); return; }
    const usernameErr = validateUsername(username);
    if (usernameErr) { setError(usernameErr); return; }
    if (!email || !password) { setError('EMAIL AND PASSWORD REQUIRED.'); return; }

    setStep(3);
  };

  const maxArtTypes = role === 'ART_LOVER' ? 7 : 5;

  const toggleArtType = (item: string) => {
    setSelectedArtTypes(prev => {
      if (prev.includes(item)) return prev.filter(t => t !== item);
      if (prev.length >= maxArtTypes) return prev;
      return [...prev, item];
    });
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('PERMISSION REQUIRED', 'Camera roll access is needed to upload a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };

  const handleLaunchProfile = async () => {
    setError('');
    setLoading(true);
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: buildProfilePayload('ARTIST'),
          emailRedirectTo: EMAIL_REDIRECT_URL,
        },
      });
      if (signUpError) { setError(signUpError.message.toUpperCase()); return; }
      const user = signUpData.user;
      if (!user) { setError('SIGN UP FAILED — TRY AGAIN.'); return; }

      if (!signUpData.session) {
        await handlePendingEmailConfirmation(user.id, 'ARTIST');
        return;
      }

      await finalizeAuthenticatedSignUp(user.id, 'ARTIST');
    } catch (e: any) {
      setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchProfileWithFilter = async () => {
    if (bio.trim() && containsBannedWords(bio)) {
      setError(getBannedWordError());
      return;
    }
    handleLaunchProfile();
  };

  // ── STEP 1: ROLE ────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
            <View style={[s.formInner, isTablet && s.formInnerTablet]}>
              <WOALogo />

              <Text style={s.sectionLabel}>CHOOSE YOUR ROLE</Text>
              <Text style={s.roleIntro}>
                PICK THE WAY YOU WANT TO USE WORK(ER) OF ART. YOU CAN ALWAYS EXPAND LATER.
              </Text>

              <View style={s.roleColumn}>
                {ROLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[s.roleCard, role === option.value && s.roleCardActive]}
                    onPress={() => setRole(option.value)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.roleCardTitle, role === option.value && s.roleCardTitleActive]}>
                      {option.label}
                    </Text>
                    <Text style={s.roleCardDescription}>{option.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={s.btn} onPress={() => setStep(2)} activeOpacity={0.7}>
                <Text style={s.btnText}>CONTINUE</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.replace('Login')} style={s.linkRow}>
                <Text style={s.linkText}>
                  ALREADY HAVE AN ACCOUNT?{' '}
                  <Text style={s.linkBold}>LOG IN</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── STEP 2: CREDENTIALS ─────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
            <View style={[s.formInner, isTablet && s.formInnerTablet]}>
              <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn} activeOpacity={0.7}>
                <Text style={s.backText}>← BACK</Text>
              </TouchableOpacity>

              <Text style={s.gigPosterStepLabel}>ROLE › CREDENTIALS</Text>

              <Field
                label="USERNAME"
                value={username}
                onChangeText={handleUsernameChange}
                required
                autoCapitalize="none"
                borderColor={usernameBorderColor()}
                hint={usernameHint()}
                hintColor={usernameHintColor()}
                textColor={colors.red}
              />
              <Field label="EMAIL" value={email} onChangeText={setEmail} required keyboardType="email-address" />
              <Field label="PASSWORD" value={password} onChangeText={setPassword} required secureTextEntry />

              <TouchableOpacity style={s.checkRow} onPress={() => setAgreed(!agreed)} activeOpacity={0.7}>
                <View style={[s.checkbox, agreed && s.checkboxChecked]} />
                <Text style={s.checkText}>
                  I AGREE TO THE{' '}
                  <Text style={s.link}>TERMS OF SERVICE</Text>
                  {' AND '}
                  <Text style={s.link}>PRIVACY POLICY</Text>
                  {'. I AM 13 YEARS OF AGE OR OLDER.'}
                </Text>
              </TouchableOpacity>

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.btn, !canCreateAccount && s.btnDisabled]}
                onPress={handleCreateAccount}
                activeOpacity={0.7}
                disabled={!canCreateAccount}
              >
                <Text style={s.btnText}>CONTINUE</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── STEP 3 ──────────────────────────────────────────────────────────────────
  if (step === 3) {

    // ── GIG POSTER / ART LOVER: just photo + name, then create account ─────
    if (role === 'GIG_POSTER' || role === 'ART_LOVER') {
      const isArtLover = role === 'ART_LOVER';
      const canLaunchSimpleProfile = Boolean(fullName.trim() && !loading);

      const handleSimpleRoleLaunch = async () => {
        if (!fullName.trim()) { setError('FULL NAME IS REQUIRED.'); return; }
        setError('');
        setLoading(true);
        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: buildProfilePayload(role),
              emailRedirectTo: EMAIL_REDIRECT_URL,
            },
          });
          if (signUpError) { setError(signUpError.message.toUpperCase()); return; }
          const user = signUpData.user;
          if (!user) { setError('SIGN UP FAILED — TRY AGAIN.'); return; }

          if (!signUpData.session) {
            await handlePendingEmailConfirmation(user.id, role);
            return;
          }

          await finalizeAuthenticatedSignUp(user.id, role);
        } catch (e: any) {
          setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.');
        } finally {
          setLoading(false);
        }
      };

      return (
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
              <View style={[s.formInner, isTablet && s.formInnerTablet]}>
              <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn} activeOpacity={0.7}>
                <Text style={s.backText}>← BACK</Text>
              </TouchableOpacity>

              <Text style={s.gigPosterStepLabel}>CREDENTIALS › PROFILE</Text>

              <OctagonUpload photoUri={photoUri} onPress={handlePickPhoto} />

              <Field
                label="FULL NAME"
                value={fullName}
                onChangeText={setFullName}
                required
                autoCapitalize="words"
              />

              {isArtLover && (
                <View style={s.artTypeSection}>
                  <View style={s.tagIntro}>
                    <Text style={s.tagIntroTitle}>WHAT ART ARE YOU INTO?</Text>
                    <Text style={s.tagIntroText}>
                      PICK UP TO 7 TAGS. WE'LL USE THESE TO PERSONALISE YOUR FEED.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={s.artTypeField}
                    onPress={() => setArtTypeModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    <View style={s.artTypeFieldTop}>
                      <Text style={s.artTypeLabel}>
                        INTERESTS <Text style={s.artTypeLimit}>UP TO 7 — OPTIONAL</Text>
                      </Text>
                      <Text style={s.artTypeChevron}>›</Text>
                    </View>
                    {selectedArtTypes.length === 0 ? (
                      <Text style={s.artTypePlaceholder}>E.G. PORTRAIT PHOTOGRAPHY, HIP HOP, STREET ART...</Text>
                    ) : null}
                    <View style={s.artTypeBorder} />
                  </TouchableOpacity>
                  {selectedArtTypes.length > 0 && (
                    <View style={s.pillsWrap}>
                      {selectedArtTypes.map(t => (
                        <TouchableOpacity
                          key={t}
                          style={s.pill}
                          onPress={() => toggleArtType(t)}
                          activeOpacity={0.7}
                        >
                          <Text style={s.pillText}>{t.toUpperCase()}</Text>
                          <Text style={s.pillX}> ×</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  <ArtTypeModal
                    visible={artTypeModalVisible}
                    onClose={() => setArtTypeModalVisible(false)}
                    discipline=""
                    allTags={ALL_ART_TYPES}
                    maxTags={7}
                    selected={selectedArtTypes}
                    onToggle={toggleArtType}
                    onClear={() => setSelectedArtTypes([])}
                  />
                </View>
              )}

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.ctaBtn, (!canLaunchSimpleProfile || loading) && s.btnDisabled]}
                onPress={handleSimpleRoleLaunch}
                activeOpacity={0.7}
                disabled={!canLaunchSimpleProfile || loading}
              >
                <Text style={s.ctaText}>
                  {loading
                    ? 'CREATING PROFILE...'
                    : isArtLover
                      ? 'ENTER WORK(ER) OF ART'
                      : 'LAUNCH MY PROFILE'}
                </Text>
              </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    }

    // ── COLLECTIVE: org profile ──────────────────────────────────────────────
    if (role === 'COLLECTIVE') {
      const canLaunchCollective = Boolean(
        fullName.trim() &&
        collectiveType &&
        country &&
        city &&
        !loading
      );

      const handleCollectiveLaunch = async () => {
        if (!fullName.trim()) { setError('ORGANIZATION NAME IS REQUIRED.'); return; }
        if (!collectiveType) { setError('PLEASE SELECT YOUR ORGANIZATION TYPE.'); return; }
        if (!country) { setError('PLEASE SELECT YOUR COUNTRY.'); return; }
        if (!city) { setError('PLEASE SELECT YOUR CITY.'); return; }
        setError('');
        setLoading(true);
        try {
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: buildProfilePayload('COLLECTIVE'),
              emailRedirectTo: EMAIL_REDIRECT_URL,
            },
          });
          if (signUpError) { setError(signUpError.message.toUpperCase()); return; }
          const user = signUpData.user;
          if (!user) { setError('SIGN UP FAILED — TRY AGAIN.'); return; }

          if (!signUpData.session) {
            await handlePendingEmailConfirmation(user.id, 'COLLECTIVE');
            return;
          }

          await finalizeAuthenticatedSignUp(user.id, 'COLLECTIVE');
        } catch (e: any) {
          setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.');
        } finally {
          setLoading(false);
        }
      };

      return (
        <SafeAreaView style={s.safe}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
              <View style={[s.formInner, isTablet && s.formInnerTablet]}>
              <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn} activeOpacity={0.7}>
                <Text style={s.backText}>← BACK</Text>
              </TouchableOpacity>

              <Text style={s.gigPosterStepLabel}>CREDENTIALS › ORG PROFILE</Text>

              <OctagonUpload photoUri={photoUri} onPress={handlePickPhoto} />

              <Field label="ORGANIZATION NAME" value={fullName} onChangeText={setFullName} required autoCapitalize="words" />

              <DropdownField
                label="ORGANIZATION TYPE"
                value={collectiveType}
                placeholder="SELECT TYPE"
                onPress={() => { setCollectiveTypeSearch(''); setCollectiveTypePickerVisible(true); }}
                required
              />

              <Field
                label="NUMBER OF MEMBERS"
                value={memberCount}
                onChangeText={v => setMemberCount(v.replace(/[^0-9]/g, ''))}
                keyboardType="number-pad"
                optional
                placeholder="E.G. 12"
                maxLength={5}
              />

              <DropdownField
                label="COUNTRY"
                value={country}
                placeholder="SELECT COUNTRY"
                onPress={() => { setCountrySearch(''); setCountryPickerVisible(true); }}
                required
              />

              <DropdownField
                label="CITY"
                value={city}
                placeholder="SELECT CITY"
                onPress={() => { setCitySearch(''); setCityPickerVisible(true); }}
                required
                disabled={!country}
              />

              <Field label="BIO / ABOUT YOUR COLLECTIVE" value={bio} onChangeText={setBio} optional multiline numberOfLines={4} autoCapitalize="sentences" />
              <Field label="INSTAGRAM URL" value={instagram} onChangeText={setInstagram} optional keyboardType="url" />
              <Field label="WEBSITE URL" value={website} onChangeText={setWebsite} optional keyboardType="url" />

              {error ? <Text style={s.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[s.ctaBtn, (!canLaunchCollective || loading) && s.btnDisabled]}
                onPress={handleCollectiveLaunch}
                activeOpacity={0.7}
                disabled={!canLaunchCollective || loading}
              >
                <Text style={s.ctaText}>{loading ? 'CREATING PROFILE...' : 'LAUNCH OUR PROFILE'}</Text>
              </TouchableOpacity>

              <ModalPicker
                visible={collectiveTypePickerVisible}
                onClose={() => setCollectiveTypePickerVisible(false)}
                options={COLLECTIVE_TYPES}
                selected={collectiveType}
                onSelect={(item) => setCollectiveType(item)}
                title="SELECT TYPE"
                searchValue={collectiveTypeSearch}
                onSearchChange={setCollectiveTypeSearch}
              />

              <ModalPicker
                visible={countryPickerVisible}
                onClose={() => setCountryPickerVisible(false)}
                options={Object.keys(CITIES_BY_COUNTRY).sort()}
                selected={country}
                onSelect={(item) => { setCountry(item); setCity(''); }}
                title="SELECT COUNTRY"
                searchValue={countrySearch}
                onSearchChange={setCountrySearch}
              />

              <ModalPicker
                visible={cityPickerVisible}
                onClose={() => setCityPickerVisible(false)}
                options={CITIES_BY_COUNTRY[country] ?? []}
                selected={city}
                onSelect={(item) => setCity(item)}
                title="SELECT CITY"
                searchValue={citySearch}
                onSearchChange={setCitySearch}
              />

              <View style={{ height: 40 }} />
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      );
    }

    // ── ARTIST: full step 2 form ─────────────────────────────────────────────
    const canContinueStep2 = Boolean(
      photoUri &&
      fullName.trim() &&
      discipline &&
      country &&
      city &&
      experience.trim()
    );

    const handleStep2Continue = () => {
      if (!photoUri) { setError('PLEASE UPLOAD A PROFILE PHOTO.'); return; }
      if (!fullName.trim()) { setError('FULL NAME IS REQUIRED.'); return; }
      if (!discipline) { setError('PLEASE SELECT YOUR DISCIPLINE.'); return; }
      if (!country) { setError('PLEASE SELECT YOUR COUNTRY.'); return; }
      if (!city) { setError('PLEASE SELECT YOUR CITY.'); return; }
      if (!experience.trim()) { setError('YEARS OF EXPERIENCE IS REQUIRED.'); return; }
      setError('');
      setStep(4);
    };

    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
            <View style={[s.formInner, isTablet && s.formInnerTablet]}>
            <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn} activeOpacity={0.7}>
              <Text style={s.backText}>← BACK</Text>
            </TouchableOpacity>

            <StepIndicator step={2} />

            <OctagonUpload photoUri={photoUri} onPress={handlePickPhoto} />

            <Field
              label="FULL NAME"
              value={fullName}
              onChangeText={setFullName}
              required
              autoCapitalize="words"
            />

            {/* Discipline dropdown */}
            <DropdownField
              label="DISCIPLINE"
              value={discipline}
              placeholder="SELECT DISCIPLINE"
              onPress={() => { setDisciplineSearch(''); setDisciplinePickerVisible(true); }}
              required
            />

            {discipline ? (
              <View style={s.tagIntro}>
                <Text style={s.tagIntroTitle}>NOW ADD TAGS</Text>
                <Text style={s.tagIntroText}>
                  PICK UP TO 5 SPECIALTIES SO PEOPLE CAN FIND YOU BY WHAT YOU ACTUALLY DO.
                </Text>
              </View>
            ) : null}

            {/* Tags multi-select — only shown after discipline selected */}
            {discipline ? (
              <View style={s.artTypeSection}>
                <TouchableOpacity
                  style={s.artTypeField}
                  onPress={() => setArtTypeModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={s.artTypeFieldTop}>
                    <Text style={s.artTypeLabel}>
                      TAGS / SPECIALTIES <Text style={s.artTypeLimit}>UP TO 5</Text>
                    </Text>
                    <Text style={s.artTypeChevron}>›</Text>
                  </View>
                  {selectedArtTypes.length === 0 ? (
                    <Text style={s.artTypePlaceholder}>SELECT THE TAGS THAT BEST FIT YOUR PRACTICE</Text>
                  ) : null}
                  <View style={s.artTypeBorder} />
                </TouchableOpacity>

                {selectedArtTypes.length > 0 ? (
                  <View style={s.pillsWrap}>
                    {selectedArtTypes.map(t => (
                      <TouchableOpacity
                        key={t}
                        style={s.pill}
                        onPress={() => toggleArtType(t)}
                        activeOpacity={0.7}
                      >
                        <Text style={s.pillText}>{t.toUpperCase()}</Text>
                        <Text style={s.pillX}> ×</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            <DropdownField
              label="COUNTRY"
              value={country}
              placeholder="SELECT COUNTRY"
              onPress={() => { setCountrySearch(''); setCountryPickerVisible(true); }}
              required
            />

            <DropdownField
              label="CITY"
              value={city}
              placeholder="SELECT CITY"
              onPress={() => { setCitySearch(''); setCityPickerVisible(true); }}
              required
              disabled={!country}
            />

            <Field
              label="YEARS OF EXPERIENCE"
              value={experience}
              onChangeText={v => setExperience(v.replace(/[^0-9]/g, ''))}
              required
              keyboardType="number-pad"
              placeholder="E.G. 5"
              maxLength={3}
            />

            {/* Available for work toggle */}
            <View style={s.availRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.availLabel}>AVAILABLE FOR WORK</Text>
                <Text style={s.availSub}>LET GIG POSTERS KNOW YOU ARE AVAILABLE</Text>
              </View>
              <AvailableToggle value={isAvailable} onValueChange={setIsAvailable} />
            </View>

            {error ? <Text style={s.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, !canContinueStep2 && s.btnDisabled]}
              onPress={handleStep2Continue}
              activeOpacity={0.7}
              disabled={!canContinueStep2}
            >
              <Text style={s.btnText}>CONTINUE</Text>
            </TouchableOpacity>

            <ModalPicker
              visible={disciplinePickerVisible}
              onClose={() => setDisciplinePickerVisible(false)}
              options={DISCIPLINES}
              selected={discipline}
              onSelect={(item) => { setDiscipline(item); setSelectedArtTypes([]); }}
              title="SELECT DISCIPLINE"
              searchValue={disciplineSearch}
              onSearchChange={setDisciplineSearch}
            />

            <ArtTypeModal
              visible={artTypeModalVisible}
              onClose={() => setArtTypeModalVisible(false)}
              discipline={discipline}
              selected={selectedArtTypes}
              onToggle={toggleArtType}
              onClear={() => setSelectedArtTypes([])}
            />

            <ModalPicker
              visible={countryPickerVisible}
              onClose={() => setCountryPickerVisible(false)}
              options={Object.keys(CITIES_BY_COUNTRY).sort()}
              selected={country}
              onSelect={(item) => { setCountry(item); setCity(''); }}
              title="SELECT COUNTRY"
              searchValue={countrySearch}
              onSearchChange={setCountrySearch}
            />

            <ModalPicker
              visible={cityPickerVisible}
              onClose={() => setCityPickerVisible(false)}
              options={CITIES_BY_COUNTRY[country] ?? []}
              selected={city}
              onSelect={(item) => setCity(item)}
              title="SELECT CITY"
              searchValue={citySearch}
              onSearchChange={setCitySearch}
            />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── STEP 4 ──────────────────────────────────────────────────────────────────
  const canLaunchArtist = Boolean(bio.trim() && !loading);

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[s.scroll, isTablet && s.scrollTablet]} keyboardShouldPersistTaps="handled">
          <View style={[s.formInner, isTablet && s.formInnerTablet]}>
          <TouchableOpacity onPress={() => setStep(3)} style={s.backBtn} activeOpacity={0.7}>
            <Text style={s.backText}>← BACK</Text>
          </TouchableOpacity>

          <StepIndicator step={3} />

          <Field label="BIO" value={bio} onChangeText={setBio} required multiline numberOfLines={4} autoCapitalize="sentences" />
          <Field label="INSTAGRAM URL" value={instagram} onChangeText={setInstagram} optional keyboardType="url" />
          <View style={s.spotifyWrap}>
            <Text style={s.spotifyLabel}>SPOTIFY URL <Text style={s.spotifyOpt}>(OPTIONAL)</Text></Text>
            <TextInput
              style={s.spotifyInput}
              value={spotify}
              onChangeText={setSpotify}
              placeholder="OPEN.SPOTIFY.COM/ARTIST/..."
              placeholderTextColor={AUTH_PLACEHOLDER}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
          </View>
          <Field label="FACEBOOK URL" value={facebook} onChangeText={setFacebook} optional keyboardType="url" />
          <Field label="WEBSITE / PORTFOLIO" value={website} onChangeText={setWebsite} optional keyboardType="url" />

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.ctaBtn, (!canLaunchArtist || loading) && s.btnDisabled]}
            onPress={handleLaunchProfileWithFilter}
            activeOpacity={0.7}
            disabled={!canLaunchArtist || loading}
          >
            <Text style={s.ctaText}>{loading ? 'CREATING PROFILE...' : 'LAUNCH MY PROFILE'}</Text>
          </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 60 },
  scrollTablet: { paddingHorizontal: 48, paddingTop: 60, paddingBottom: 96, alignItems: 'center' },
  formInner: { width: '100%' },
  formInnerTablet: { maxWidth: 620 },
  sectionLabel: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 13, letterSpacing: 0.2, marginBottom: 12 },
  roleIntro: { color: AUTH_TERTIARY, fontFamily: MONO, fontSize: 11, letterSpacing: 0.14, lineHeight: 18, marginBottom: 18 },
  roleColumn: { gap: 12, marginBottom: 28 },
  roleCard: { borderWidth: 1, borderColor: '#9a9a9a', paddingHorizontal: 16, paddingVertical: 16 },
  roleCardActive: { borderColor: colors.red },
  roleCardTitle: { color: colors.white, fontFamily: MONO, fontSize: 14, letterSpacing: 0.16, marginBottom: 8 },
  roleCardTitleActive: { color: colors.white },
  roleCardDescription: { color: '#d9d9d9', fontFamily: MONO, fontSize: 10, letterSpacing: 0.12, lineHeight: 17 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: '#777777', marginTop: 1, flexShrink: 0 },
  checkboxChecked: { borderColor: colors.red, backgroundColor: colors.red },
  checkText: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12, flex: 1, lineHeight: 21 },
  link: { color: colors.white },
  errorText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.16, marginBottom: 16 },
  btn: { borderWidth: 1, borderColor: colors.white, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: colors.white, fontFamily: MONO, fontSize: 14, letterSpacing: 0.2 },
  ctaBtn: { borderWidth: 1, borderColor: colors.red, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  ctaText: { color: colors.red, fontFamily: MONO, fontSize: 14, letterSpacing: 0.2 },
  linkRow: { alignItems: 'center' },
  linkText: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.12 },
  linkBold: { color: colors.white },
  backBtn: { marginBottom: 20 },
  backText: { color: colors.white, fontFamily: MONO, fontSize: 14, letterSpacing: 0.18 },

  gigPosterStepLabel: {
    color: AUTH_LABEL, fontFamily: MONO, fontSize: 12,
    letterSpacing: 0.2, marginBottom: 28,
  },
  tagIntro: {
    marginTop: -6,
    marginBottom: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f1f1f',
    backgroundColor: '#090909',
  },
  tagIntroTitle: {
    color: colors.white,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.18,
    marginBottom: 6,
  },
  tagIntroText: {
    color: AUTH_SUBTEXT,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 0.12,
    lineHeight: 19,
  },
  artTypeSection: { marginBottom: 22 },
  artTypeField: {},
  artTypeFieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  artTypeLabel: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18 },
  artTypeLimit: { color: AUTH_TERTIARY, fontSize: 11 },
  artTypeChevron: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 17 },
  artTypePlaceholder: { color: AUTH_PLACEHOLDER, fontFamily: MONO, fontSize: 16, letterSpacing: 0.12, paddingBottom: 8 },
  artTypeBorder: { height: 1, backgroundColor: colors.border },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.red, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: colors.red, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1 },
  pillX: { color: colors.red, fontFamily: MONO, fontSize: 12 },

  // Available toggle
  availRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  availLabel: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.14, marginBottom: 3 },
  availSub: { color: AUTH_SUBTEXT, fontFamily: MONO, fontSize: 12, letterSpacing: 0.08 },

  // Spotify field
  spotifyWrap: { marginBottom: 22 },
  spotifyLabel: { color: AUTH_LABEL, fontFamily: MONO, fontSize: 12, letterSpacing: 0.18, marginBottom: 8 },
  spotifyOpt: { color: AUTH_TERTIARY, fontSize: 11 },
  spotifyInput: { color: colors.white, fontFamily: MONO, fontSize: 16, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, letterSpacing: 0.12 },
});
