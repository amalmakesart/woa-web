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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { DISCIPLINES, ART_TYPES_BY_DISCIPLINE, CITIES_BY_COUNTRY } from '../../constants/locationData';
import { containsBannedWords, getBannedWordError, validateUsername } from '../../lib/contentFilter';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
type Role = 'ARTIST' | 'GIG_POSTER';
type UsernameStatus = 'idle' | 'checking' | 'taken' | 'available';
type Step = 1 | 2 | 3;

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
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.25 },
  bottomRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { color: colors.red, fontSize: 12 },
});

// ─── Step Indicator ──────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps = ['CREDENTIALS', 'PROFILE', 'LINKS'];
  return (
    <View style={si.row}>
      {steps.map((label, i) => {
        const num = (i + 1) as Step;
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
  label: { color: colors.gray5, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  active: { color: colors.white },
  past: { color: colors.gray6 },
  arrow: { color: colors.gray5, fontFamily: MONO, fontSize: 10 },
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
        placeholderTextColor={colors.gray5}
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
  label: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, marginBottom: 8 },
  required: { color: colors.red },
  optional: { color: colors.gray4 },
  input: {
    color: colors.white, fontFamily: MONO, fontSize: 15,
    borderBottomWidth: 1, paddingVertical: 8, letterSpacing: 0.12,
  },
  hint: { fontFamily: MONO, fontSize: 10, letterSpacing: 0.18, marginTop: 6 },
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
  shape: { width: 90, height: 90, backgroundColor: colors.gray2, borderWidth: 1, borderColor: colors.border, borderRadius: 16, marginBottom: 10 },
  image: { width: 90, height: 90, borderRadius: 16, overflow: 'hidden', marginBottom: 10 },
  label: { fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },
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
  label: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, marginBottom: 8 },
  required: { color: colors.red },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  value: { color: colors.white, fontFamily: MONO, fontSize: 15, letterSpacing: 0.12, flex: 1 },
  placeholder: { color: colors.gray5 },
  chevron: { color: colors.gray5, fontFamily: MONO, fontSize: 16, marginLeft: 8 },
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
          placeholder="SEARCH..." placeholderTextColor={colors.gray5}
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
  title: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
  close: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  search: { backgroundColor: colors.black, color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 28, paddingVertical: 12 },
  row: { paddingVertical: 14, paddingHorizontal: 28, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
  rowTextSelected: { color: colors.red },
});

// ─── Multi-select Art Type Modal ──────────────────────────────────────────────

function ArtTypeModal({ visible, onClose, discipline, selected, onToggle, onClear }: {
  visible: boolean; onClose: () => void; discipline: string;
  selected: string[]; onToggle: (item: string) => void; onClear: () => void;
}) {
  const [search, setSearch] = useState('');
  const options = (ART_TYPES_BY_DISCIPLINE[discipline] ?? []).filter(
    item => item.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={atm.safe}>
        <View style={atm.header}>
          <Text style={atm.title}>ART TYPE <Text style={atm.titleSub}>UP TO 5</Text></Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={atm.done}>DONE</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={atm.search} value={search} onChangeText={setSearch}
          placeholder="SEARCH..." placeholderTextColor={colors.gray5}
          autoCapitalize="none" autoCorrect={false}
        />
        {selected.length >= 5 ? (
          <View style={atm.maxBanner}>
            <Text style={atm.maxText}>MAXIMUM 5 ART TYPES SELECTED</Text>
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
  title: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },
  titleSub: { color: '#444444', fontSize: 9 },
  done: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },
  search: { backgroundColor: colors.black, color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 28, paddingVertical: 12 },
  maxBanner: { backgroundColor: '#1a0000', paddingHorizontal: 28, paddingVertical: 10 },
  maxText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.15 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 28, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: '#666666', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1, flex: 1 },
  rowTextSelected: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 11 },
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

  const handleCreateAccount = async () => {
    setError('');
    if (!agreed) { setError('YOU MUST AGREE TO THE TERMS.'); return; }
    if (usernameStatus !== 'available') { setError('CHOOSE AN AVAILABLE USERNAME.'); return; }
    const usernameErr = validateUsername(username);
    if (usernameErr) { setError(usernameErr); return; }
    if (!email || !password) { setError('EMAIL AND PASSWORD REQUIRED.'); return; }

    if (role === 'ARTIST') {
      setStep(2);
    } else {
      setLoading(true);
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) { setError(signUpError.message.toUpperCase()); return; }
        const user = signUpData.user;
        if (user) {
          await supabase.from('profiles').upsert({ id: user.id, username: username.toLowerCase(), role: 'GIG_POSTER' });
        }
        navigation.replace('Permissions');
      } catch (e: any) {
        setError(e.message?.toUpperCase() ?? 'SOMETHING WENT WRONG.');
      } finally {
        setLoading(false);
      }
    }
  };

  const toggleArtType = (item: string) => {
    setSelectedArtTypes(prev => {
      if (prev.includes(item)) return prev.filter(t => t !== item);
      if (prev.length >= 5) return prev; // max 5
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
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) { setError(signUpError.message.toUpperCase()); return; }
      const user = signUpData.user;
      if (!user) { setError('SIGN UP FAILED — TRY AGAIN.'); return; }

      let profilePhotoUrl: string | null = null;
      if (photoUri) {
        const rawExt = photoUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
        const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        const path = `${user.id}/avatar.${ext}`;
        const response = await fetch(photoUri);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, arrayBuffer, { contentType: mimeType, upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          profilePhotoUrl = urlData.publicUrl;
        }
      }

      await supabase.from('profiles').upsert({
        id: user.id,
        username: username.toLowerCase(),
        full_name: fullName,
        discipline,
        art_types: selectedArtTypes,
        profile_photo_url: profilePhotoUrl,
        country,
        city,
        experience,
        bio,
        instagram: instagram.trim() || null,
        spotify_url: spotify.trim() || null,
        facebook: facebook.trim() || null,
        website: website.trim() || null,
        is_available: isAvailable,
        role: 'ARTIST',
      });

      navigation.replace('Permissions');
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

  // ── STEP 1 ──────────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <WOALogo />

            <Text style={s.sectionLabel}>I AM A</Text>
            <View style={s.roleRow}>
              {(['ARTIST', 'GIG_POSTER'] as Role[]).map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[s.roleBtn, role === r && s.roleBtnActive]}
                  onPress={() => setRole(r)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.roleText, role === r && s.roleTextActive]}>
                    {r === 'ARTIST' ? 'ARTIST' : 'GIG POSTER'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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

            <TouchableOpacity style={s.btn} onPress={handleCreateAccount} activeOpacity={0.7}>
              <Text style={s.btnText}>CREATE ACCOUNT</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.replace('Login')} style={s.linkRow}>
              <Text style={s.linkText}>
                ALREADY HAVE AN ACCOUNT?{' '}
                <Text style={s.linkBold}>LOG IN</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── STEP 2 ──────────────────────────────────────────────────────────────────
  if (step === 2) {
    const handleStep2Continue = () => {
      if (!photoUri) { setError('PLEASE UPLOAD A PROFILE PHOTO.'); return; }
      if (!fullName.trim()) { setError('FULL NAME IS REQUIRED.'); return; }
      if (!discipline) { setError('PLEASE SELECT YOUR DISCIPLINE.'); return; }
      if (!country) { setError('PLEASE SELECT YOUR COUNTRY.'); return; }
      if (!city) { setError('PLEASE SELECT YOUR CITY.'); return; }
      if (!experience.trim()) { setError('YEARS OF EXPERIENCE IS REQUIRED.'); return; }
      setError('');
      setStep(3);
    };

    return (
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn} activeOpacity={0.7}>
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

            {/* Art Type multi-select — only shown after discipline selected */}
            {discipline ? (
              <View style={s.artTypeSection}>
                <TouchableOpacity
                  style={s.artTypeField}
                  onPress={() => setArtTypeModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <View style={s.artTypeFieldTop}>
                    <Text style={s.artTypeLabel}>
                      ART TYPE <Text style={s.artTypeLimit}>UP TO 5</Text>
                    </Text>
                    <Text style={s.artTypeChevron}>›</Text>
                  </View>
                  {selectedArtTypes.length === 0 ? (
                    <Text style={s.artTypePlaceholder}>SELECT YOUR ART TYPES</Text>
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

            <TouchableOpacity style={s.btn} onPress={handleStep2Continue} activeOpacity={0.7}>
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
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── STEP 3 ──────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn} activeOpacity={0.7}>
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
              placeholderTextColor={colors.gray5}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
          </View>
          <Field label="FACEBOOK URL" value={facebook} onChangeText={setFacebook} optional keyboardType="url" />
          <Field label="WEBSITE / PORTFOLIO" value={website} onChangeText={setWebsite} optional keyboardType="url" />

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.ctaBtn, loading && { opacity: 0.5 }]}
            onPress={handleLaunchProfileWithFilter}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={s.ctaText}>{loading ? 'CREATING PROFILE...' : 'LAUNCH MY PROFILE'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 60 },
  sectionLabel: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  roleBtn: { flex: 1, borderWidth: 1, borderColor: colors.gray4, paddingVertical: 14, alignItems: 'center' },
  roleBtnActive: { borderColor: colors.white },
  roleText: { color: colors.gray5, fontFamily: MONO, fontSize: 13, letterSpacing: 0.2 },
  roleTextActive: { color: colors.white },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 24, gap: 12 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.gray4, marginTop: 1, flexShrink: 0 },
  checkboxChecked: { borderColor: colors.red, backgroundColor: colors.red },
  checkText: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, flex: 1, lineHeight: 18 },
  link: { color: colors.white },
  errorText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, marginBottom: 16 },
  btn: { borderWidth: 1, borderColor: colors.white, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  btnText: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.22 },
  ctaBtn: { borderWidth: 1, borderColor: colors.red, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
  ctaText: { color: colors.red, fontFamily: MONO, fontSize: 13, letterSpacing: 0.22 },
  linkRow: { alignItems: 'center' },
  linkText: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },
  linkBold: { color: colors.white },
  backBtn: { marginBottom: 20 },
  backText: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.2 },

  // Art type multi-select
  artTypeSection: { marginBottom: 22 },
  artTypeField: {},
  artTypeFieldTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  artTypeLabel: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },
  artTypeLimit: { color: '#444444', fontSize: 9 },
  artTypeChevron: { color: colors.gray5, fontFamily: MONO, fontSize: 16 },
  artTypePlaceholder: { color: colors.gray5, fontFamily: MONO, fontSize: 15, letterSpacing: 0.12, paddingBottom: 8 },
  artTypeBorder: { height: 1, backgroundColor: colors.border },
  pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.red, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  pillX: { color: colors.red, fontFamily: MONO, fontSize: 11 },

  // Available toggle
  availRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 22, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  availLabel: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 3 },
  availSub: { color: '#444444', fontFamily: MONO, fontSize: 6, letterSpacing: 0.1 },

  // Spotify field
  spotifyWrap: { marginBottom: 22 },
  spotifyLabel: { color: colors.gray5, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, marginBottom: 8 },
  spotifyOpt: { color: '#333333', fontSize: 9 },
  spotifyInput: { color: colors.white, fontFamily: MONO, fontSize: 15, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 8, letterSpacing: 0.12 },
});
