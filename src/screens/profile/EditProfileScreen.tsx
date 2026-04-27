import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, SafeAreaView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Modal, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import OctagonalImage from '../../components/OctagonalImage';
import { DISCIPLINES, ART_TYPES_BY_DISCIPLINE, CITIES_BY_COUNTRY } from '../../constants/locationData';
import { containsBannedWords, getBannedWordError, validateUsername } from '../../lib/contentFilter';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const OTHER_CITY = 'OTHER — TYPE BELOW';
const COUNTRIES = Object.keys(CITIES_BY_COUNTRY).sort();

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => readString(item))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizePhotoExtension(photoUri: string) {
  const rawExt = photoUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const normalizedExt = rawExt === 'jpeg' ? 'jpg' : rawExt;
  return normalizedExt && /^[a-z0-9]+$/.test(normalizedExt) ? normalizedExt : 'jpg';
}

async function getLegacyFileSystem() {
  return import('expo-file-system/legacy');
}

async function persistProfilePhotoLocally(photoUri: string) {
  const FileSystem = await getLegacyFileSystem();
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) return photoUri;

  const ext = normalizePhotoExtension(photoUri);
  const destination = `${baseDir}edit-profile-photo-${Date.now()}.${ext}`;

  try {
    await FileSystem.copyAsync({ from: photoUri, to: destination });
    return destination;
  } catch {
    return photoUri;
  }
}

async function uploadProfilePhoto(userId: string, photoUri: string) {
  const ext = normalizePhotoExtension(photoUri);
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const path = `${userId}/avatar.${ext}`;
  const response = await fetch(photoUri);
  const arrayBuffer = await response.arrayBuffer();
  const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, arrayBuffer, {
    contentType: mimeType,
    upsert: true,
  });

  if (uploadErr) {
    throw uploadErr;
  }

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  return urlData.publicUrl;
}

function PickerModal({ visible, title, options, selected, onSelect, onClose }: {
  visible: boolean; title: string; options: string[];
  selected: string; onSelect: (v: string) => void; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={onClose}>
        <View style={pm.sheet}>
          <View style={pm.header}>
            <Text style={pm.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}><Text style={pm.close}>✕</Text></TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity style={pm.row} onPress={() => { onSelect(item); onClose(); }} activeOpacity={0.7}>
                <Text style={[pm.rowText, selected === item && pm.rowActive]}>{item}</Text>
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

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: boolean; children: React.ReactNode;
}) {
  return (
    <View style={[f.wrap, error && f.wrapError]}>
      <Text style={f.label}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

const f = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: '#9a9a9a' },
  wrapError: { borderBottomColor: colors.red },
  label: { color: '#b5b5b5', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2, marginBottom: 8 },
});

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [isGigPosterProfile, setIsGigPosterProfile] = useState(false);

  const [userId, setUserId] = useState('');

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [selectedArtTypes, setSelectedArtTypes] = useState<string[]>([]);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [experience, setExperience] = useState('');
  const [instagram, setInstagram] = useState('');
  const [facebook, setFacebook] = useState('');
  const [website, setWebsite] = useState('');
  const [spotify, setSpotify] = useState('');
  const [isAvailable, setIsAvailable] = useState(false);

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [showDisciplinePicker, setShowDisciplinePicker] = useState(false);
  const [showArtTypeModal, setShowArtTypeModal] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  const normalizedRole = (userRole ?? '').toUpperCase();
  const isGigPoster = isGigPosterProfile;
  const isArtLover = normalizedRole === 'ART_LOVER';
  const isCollective = normalizedRole === 'COLLECTIVE';
  const showArtistFields = normalizedRole === 'ARTIST';

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

      const { data, error } = await supabase.from('profiles')
        .select('full_name, username, profile_photo_url, bio, discipline, art_type, art_types, city, country, experience, instagram, facebook, website, spotify_url, is_available, role, company_name, collective_type, member_count')
        .eq('id', user.id).single();

      const baseData = error || !data
        ? await supabase.from('profiles')
            .select('full_name, username, profile_photo_url, bio, discipline, art_type, art_types, city, country, experience, instagram, facebook, website, role, collective_type, member_count')
            .eq('id', user.id).single().then(r => r.data)
        : null;

      const p = (data ?? baseData) as any;
      if (p) {
        setPhotoUri(p.profile_photo_url ?? null);
        setFullName(p.full_name ?? '');
        setUsername(p.username ?? '');
        setBio(p.bio ?? '');
        // Normalize discipline to match DISCIPLINES list (case-insensitive match)
        const rawDiscipline = readString(p.discipline) || readString(p.art_type) || readString(metadata.discipline);
        const matchedDiscipline = DISCIPLINES.find(
          d => d.toLowerCase() === rawDiscipline.toLowerCase()
        ) ?? rawDiscipline;
        setDiscipline(matchedDiscipline);
        setSelectedArtTypes(readStringArray(p.art_types).length > 0 ? readStringArray(p.art_types) : readStringArray(metadata.art_types));
        setCountry(readString(p.country) || readString(metadata.country));
        setCity(readString(p.city) || readString(metadata.city));
        setExperience(readString(p.experience) || readString(metadata.experience));
        setInstagram(p.instagram ?? '');
        setFacebook(p.facebook ?? '');
        setWebsite(p.website ?? '');
        setSpotify(readString(p.spotify_url) || readString(metadata.spotify_url));
        setIsAvailable(typeof p.is_available === 'boolean' ? p.is_available : Boolean(metadata.is_available));
        const metadataRole = readString(metadata.role).toUpperCase();
        const resolvedRole = (
          readString(p.role).toUpperCase() ||
          metadataRole ||
          (readString(p.collective_type) || p.member_count != null ? 'COLLECTIVE' : '')
        );
        setUserRole(resolvedRole || null);
        setCompanyName(p.company_name ?? '');
        const hasArtistFields = Boolean(
          readString(p.bio) ||
          rawDiscipline ||
          readStringArray(p.art_types).length > 0 ||
          readString(p.country) ||
          readString(p.city) ||
          readString(p.experience) ||
          readString(p.instagram) ||
          readString(p.facebook) ||
          readString(p.website) ||
          readString(p.spotify_url)
        );
        setIsGigPosterProfile(
          resolvedRole === 'GIG_POSTER' ||
          (!!readString(p.company_name) && !['ARTIST', 'COLLECTIVE'].includes(resolvedRole)) ||
          (!resolvedRole && !hasArtistFields)
        );
      } else {
        setUserRole('ARTIST');
        setIsGigPosterProfile(false);
      }

      setLoading(false);
    })();
  }, []);

  const cityOptions = useMemo(() => {
    if (!country) return [];
    return [...(CITIES_BY_COUNTRY[country] ?? []), OTHER_CITY];
  }, [country]);

  const handleChangePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const persistedUri = await persistProfilePhotoLocally(result.assets[0].uri);
      setPhotoUri(persistedUri);
    }
  };

  const toggleArtType = (type: string) => {
    setSelectedArtTypes(prev =>
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : prev.length < 5 ? [...prev, type] : prev
    );
  };

  const validate = () => {
    const e: Record<string, boolean> = {};
    if (!fullName.trim()) e.fullName = true;
    if (!isGigPoster && !isArtLover) {
      if (!bio.trim()) e.bio = true;
      if (!country) e.country = true;
      if (showArtistFields) {
        if (!discipline) e.discipline = true;
        if (!experience.trim()) e.experience = true;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { Alert.alert('REQUIRED FIELDS', 'Please fill in all required fields.'); return; }
    if (bio.trim() && containsBannedWords(bio)) { Alert.alert('INAPPROPRIATE LANGUAGE', getBannedWordError()); return; }
    setSaving(true);

    let photoUrl: string | null = photoUri;

    if (photoUri && (photoUri.startsWith('file://') || photoUri.startsWith('ph://'))) {
      try {
        photoUrl = await uploadProfilePhoto(userId, photoUri);
      } catch {
        Alert.alert('PHOTO UPLOAD FAILED', 'We could not save your new profile photo. Please try again.');
        setSaving(false);
        return;
      }
    }

    const finalCity = city === OTHER_CITY ? customCity.trim() : city;

    // Build update — never update username (it's locked)
    const updateData: Record<string, any> = {
      full_name: fullName.trim(),
      profile_photo_url: photoUrl,
    };

    if (!isGigPoster && !isArtLover) {
      updateData.bio = bio.trim();
      updateData.city = finalCity;
      updateData.country = country;
      updateData.instagram = instagram.trim() || null;
      updateData.facebook = facebook.trim() || null;
      updateData.website = website.trim() || null;
      if (showArtistFields) {
        updateData.discipline = discipline || null;
        updateData.art_type = discipline || null;
        updateData.art_types = selectedArtTypes;
        updateData.experience = experience.trim();
        updateData.spotify_url = spotify.trim() || null;
        updateData.is_available = isAvailable;
      }
    }

    const { error } = await supabase.from('profiles')
      .update(updateData)
      .eq('id', userId);

    if (error) {
      Alert.alert('ERROR', 'Could not save. Please try again.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setSuccess(true);
    setTimeout(() => { setSuccess(false); navigation.goBack(); }, 1200);
  };

  if (loading) return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}><Text style={s.topBarTitle}>EDIT PROFILE</Text></View>
      <View style={s.center}><ActivityIndicator color={colors.white} /></View>
    </SafeAreaView>
  );

  // ── GIG POSTER / ART LOVER: separate minimal form — photo + name only ────
  if (isGigPoster || isArtLover) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>MY PROFILE</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle}>EDIT PROFILE</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.photoSection}>
              <OctagonalImage size={72} imageUri={photoUri} />
              <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.7}>
                <Text style={s.changePhoto}>CHANGE PHOTO</Text>
              </TouchableOpacity>
            </View>
            <Field label="FULL NAME" required error={errors.fullName}>
              <TextInput style={s.input} value={fullName} onChangeText={setFullName}
                placeholder="YOUR FULL NAME" placeholderTextColor="#9a9a9a" maxLength={80}
                autoCapitalize="words" />
            </Field>
            <View style={s.saveBtnWrap}>
              <TouchableOpacity
                style={[s.saveBtnLarge, saving && s.saveBtnDisabled]}
                onPress={handleSave} disabled={saving} activeOpacity={0.7}
              >
                {saving
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={s.saveBtnLargeText}>{success ? '✓ SAVED' : 'SAVE CHANGES'}</Text>}
              </TouchableOpacity>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (isCollective) {
    return (
      <SafeAreaView style={s.safeArea}>
        <View style={s.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backArrow}>‹</Text>
            <Text style={s.backLabel}>MY PROFILE</Text>
          </TouchableOpacity>
          <Text style={s.topBarTitle}>EDIT PROFILE</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.photoSection}>
              <OctagonalImage size={52} imageUri={photoUri} />
              <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.7}>
                <Text style={s.changePhoto}>CHANGE PHOTO</Text>
              </TouchableOpacity>
            </View>

            <Field label="ORGANIZATION NAME" required error={errors.fullName}>
              <TextInput style={s.input} value={fullName} onChangeText={setFullName}
                placeholder="YOUR COLLECTIVE NAME" placeholderTextColor="#9a9a9a" maxLength={80}
                autoCapitalize="words" />
            </Field>

            <Field label="USERNAME">
              <View style={s.lockedField}>
                <Text style={s.lockedText}>@{username.toUpperCase()}</Text>
                <Text style={s.lockedBadge}>LOCKED</Text>
              </View>
            </Field>

            <Field label="BIO" required error={errors.bio}>
              <TextInput style={s.textarea} value={bio} onChangeText={setBio}
                placeholder="TELL PEOPLE ABOUT YOUR COLLECTIVE..." placeholderTextColor="#9a9a9a"
                multiline maxLength={500} textAlignVertical="top" />
              <Text style={s.charCount}>{bio.length}/500</Text>
            </Field>

            <Field label="COUNTRY" required error={errors.country}>
              <TouchableOpacity style={s.selectBtn} onPress={() => setShowCountryPicker(true)} activeOpacity={0.7}>
                <Text style={[s.selectText, !country && s.selectPlaceholder]}>{country || 'SELECT COUNTRY'}</Text>
                <Text style={s.chevron}>▼</Text>
              </TouchableOpacity>
            </Field>

            {country ? (
              <Field label="CITY">
                <TouchableOpacity style={s.selectBtn} onPress={() => setShowCityPicker(true)} activeOpacity={0.7}>
                  <Text style={[s.selectText, !city && s.selectPlaceholder]}>{city || 'SELECT CITY'}</Text>
                  <Text style={s.chevron}>▼</Text>
                </TouchableOpacity>
              </Field>
            ) : null}

            {city === OTHER_CITY ? (
              <Field label="CITY NAME">
                <TextInput style={s.input} value={customCity} onChangeText={setCustomCity}
                  placeholder="ENTER YOUR CITY" placeholderTextColor="#9a9a9a" maxLength={60} />
              </Field>
            ) : null}

            <View style={s.sectionHeader}>
              <Text style={s.sectionHeaderText}>SOCIAL LINKS (OPTIONAL)</Text>
            </View>

            <Field label="INSTAGRAM URL">
              <TextInput style={s.input} value={instagram} onChangeText={setInstagram}
                placeholder="HTTPS://INSTAGRAM.COM/..." placeholderTextColor="#9a9a9a"
                autoCapitalize="none" keyboardType="url" maxLength={200} />
            </Field>
            <Field label="FACEBOOK URL">
              <TextInput style={s.input} value={facebook} onChangeText={setFacebook}
                placeholder="HTTPS://FACEBOOK.COM/..." placeholderTextColor="#9a9a9a"
                autoCapitalize="none" keyboardType="url" maxLength={200} />
            </Field>
            <Field label="WEBSITE / PORTFOLIO">
              <TextInput style={s.input} value={website} onChangeText={setWebsite}
                placeholder="HTTPS://..." placeholderTextColor="#9a9a9a"
                autoCapitalize="none" keyboardType="url" maxLength={200} />
            </Field>

            <View style={s.saveBtnWrap}>
              <TouchableOpacity
                style={[s.saveBtnLarge, saving && s.saveBtnDisabled]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.7}
              >
                {saving
                  ? <ActivityIndicator color={colors.white} size="small" />
                  : <Text style={s.saveBtnLargeText}>{success ? '✓ SAVED' : 'SAVE CHANGES'}</Text>}
              </TouchableOpacity>
            </View>

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>

        <PickerModal visible={showCountryPicker} title="SELECT COUNTRY" options={COUNTRIES}
          selected={country} onSelect={v => { setCountry(v); setCity(''); setCustomCity(''); }}
          onClose={() => setShowCountryPicker(false)} />
        <PickerModal visible={showCityPicker} title="SELECT CITY" options={cityOptions}
          selected={city} onSelect={setCity} onClose={() => setShowCityPicker(false)} />
      </SafeAreaView>
    );
  }

  // ── ARTIST: full form ──────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>MY PROFILE</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>EDIT PROFILE</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Photo */}
          <View style={s.photoSection}>
            <OctagonalImage size={52} imageUri={photoUri} />
            <TouchableOpacity onPress={handleChangePhoto} activeOpacity={0.7}>
              <Text style={s.changePhoto}>CHANGE PHOTO</Text>
            </TouchableOpacity>
          </View>

          {/* Full name */}
          <Field label="FULL NAME" required error={errors.fullName}>
            <TextInput style={s.input} value={fullName} onChangeText={setFullName}
              placeholder="YOUR FULL NAME" placeholderTextColor="#9a9a9a" maxLength={80} />
          </Field>

          {/* Username — always locked */}
          <Field label="USERNAME">
            <View style={s.lockedField}>
              <Text style={s.lockedText}>@{username.toUpperCase()}</Text>
              <Text style={s.lockedBadge}>LOCKED</Text>
            </View>
          </Field>

          {/* Bio */}
              <Field label="BIO" required error={errors.bio}>
                <TextInput style={s.textarea} value={bio} onChangeText={setBio}
                  placeholder="TELL THE WORLD ABOUT YOUR WORK..." placeholderTextColor="#9a9a9a"
                  multiline maxLength={500} textAlignVertical="top" />
                <Text style={s.charCount}>{bio.length}/500</Text>
              </Field>

              {showArtistFields ? (
                <>
                  <Field label="DISCIPLINE" required error={errors.discipline}>
                    <TouchableOpacity style={s.selectBtn} onPress={() => setShowDisciplinePicker(!showDisciplinePicker)} activeOpacity={0.7}>
                      <Text style={[s.selectText, !discipline && s.selectPlaceholder]}>
                        {discipline || 'SELECT YOUR DISCIPLINE'}
                      </Text>
                      <Text style={s.chevron}>{showDisciplinePicker ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {showDisciplinePicker && (
                      <View style={s.inlineList}>
                        {DISCIPLINES.map(d => (
                          <TouchableOpacity key={d}
                            style={[s.inlineItem, discipline === d && s.inlineItemSelected]}
                            onPress={() => { setDiscipline(d); setSelectedArtTypes([]); setShowDisciplinePicker(false); }}
                            activeOpacity={0.7}>
                            <Text style={[s.inlineItemText, discipline === d && s.inlineItemTextSelected]}>
                              {d.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </Field>

                  {discipline ? (
                    <Field label="TAGS / SPECIALTIES (UP TO 5)">
                      <TouchableOpacity style={s.selectBtn} onPress={() => setShowArtTypeModal(true)} activeOpacity={0.7}>
                        <Text style={[s.selectText, selectedArtTypes.length === 0 && s.selectPlaceholder]}>
                          {selectedArtTypes.length > 0 ? `${selectedArtTypes.length} SELECTED` : 'SELECT TAGS'}
                        </Text>
                        <Text style={s.chevron}>▼</Text>
                      </TouchableOpacity>
                      {selectedArtTypes.length > 0 && (
                        <View style={s.artTypePillsRow}>
                          {selectedArtTypes.map(type => (
                            <TouchableOpacity key={type} style={s.artTypePill} onPress={() => toggleArtType(type)} activeOpacity={0.7}>
                              <Text style={s.artTypePillText}>{type.toUpperCase()} ×</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </Field>
                  ) : null}
                </>
              ) : null}

              {/* Country */}
              <Field label="COUNTRY" required error={errors.country}>
                <TouchableOpacity style={s.selectBtn} onPress={() => setShowCountryPicker(true)} activeOpacity={0.7}>
                  <Text style={[s.selectText, !country && s.selectPlaceholder]}>{country || 'SELECT COUNTRY'}</Text>
                  <Text style={s.chevron}>▼</Text>
                </TouchableOpacity>
              </Field>

              {country ? (
                <Field label="CITY">
                  <TouchableOpacity style={s.selectBtn} onPress={() => setShowCityPicker(true)} activeOpacity={0.7}>
                    <Text style={[s.selectText, !city && s.selectPlaceholder]}>{city || 'SELECT CITY'}</Text>
                    <Text style={s.chevron}>▼</Text>
                  </TouchableOpacity>
                </Field>
              ) : null}

              {city === OTHER_CITY ? (
                <Field label="CITY NAME">
                  <TextInput style={s.input} value={customCity} onChangeText={setCustomCity}
                    placeholder="ENTER YOUR CITY" placeholderTextColor="#9a9a9a" maxLength={60} />
                </Field>
              ) : null}

              {showArtistFields ? (
                <>
                  <Field label="YEARS OF EXPERIENCE" required error={errors.experience}>
                    <TextInput style={s.input} value={experience}
                      onChangeText={v => setExperience(v.replace(/[^0-9]/g, ''))}
                      placeholder="E.G. 5" placeholderTextColor="#9a9a9a" maxLength={3}
                      keyboardType="number-pad" />
                  </Field>

                  <View style={s.availabilityRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.availabilityLabel}>AVAILABLE FOR GIGS</Text>
                      <Text style={s.availabilitySub}>VISIBLE ON YOUR PUBLIC PROFILE</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => setIsAvailable(v => !v)}
                      activeOpacity={0.8}
                      style={[s.toggleTrack, isAvailable && s.toggleTrackOn]}
                    >
                      <View style={[s.toggleThumb, isAvailable && s.toggleThumbOn]} />
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              <View style={s.sectionHeader}>
                <Text style={s.sectionHeaderText}>SOCIAL LINKS (OPTIONAL)</Text>
              </View>

              <Field label="INSTAGRAM URL">
                <TextInput style={s.input} value={instagram} onChangeText={setInstagram}
                  placeholder="HTTPS://INSTAGRAM.COM/..." placeholderTextColor="#9a9a9a"
                  autoCapitalize="none" keyboardType="url" maxLength={200} />
              </Field>
              <Field label="FACEBOOK URL">
                <TextInput style={s.input} value={facebook} onChangeText={setFacebook}
                  placeholder="HTTPS://FACEBOOK.COM/..." placeholderTextColor="#9a9a9a"
                  autoCapitalize="none" keyboardType="url" maxLength={200} />
              </Field>
              <Field label="WEBSITE / PORTFOLIO">
                <TextInput style={s.input} value={website} onChangeText={setWebsite}
                  placeholder="HTTPS://..." placeholderTextColor="#9a9a9a"
                  autoCapitalize="none" keyboardType="url" maxLength={200} />
              </Field>
              {showArtistFields ? (
                <Field label="SPOTIFY PROFILE">
                  <TextInput style={s.input} value={spotify} onChangeText={setSpotify}
                    placeholder="HTTPS://OPEN.SPOTIFY.COM/ARTIST/..." placeholderTextColor="#9a9a9a"
                    autoCapitalize="none" keyboardType="url" maxLength={200} />
                </Field>
              ) : null}

          {/* Large save button */}
          <View style={s.saveBtnWrap}>
            <TouchableOpacity
              style={[s.saveBtnLarge, saving && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.7}
            >
              {saving
                ? <ActivityIndicator color={colors.white} size="small" />
                : <Text style={s.saveBtnLargeText}>{success ? '✓ SAVED' : 'SAVE CHANGES'}</Text>}
            </TouchableOpacity>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal visible={showCountryPicker} title="SELECT COUNTRY" options={COUNTRIES}
        selected={country} onSelect={v => { setCountry(v); setCity(''); setCustomCity(''); }}
        onClose={() => setShowCountryPicker(false)} />
      <PickerModal visible={showCityPicker} title="SELECT CITY" options={cityOptions}
        selected={city} onSelect={setCity} onClose={() => setShowCityPicker(false)} />

      <Modal visible={showArtTypeModal} transparent animationType="slide"
        onRequestClose={() => setShowArtTypeModal(false)}>
        <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={() => setShowArtTypeModal(false)}>
          <View style={pm.sheet}>
            <View style={pm.header}>
              <Text style={pm.title}>SELECT TAGS / SPECIALTIES (UP TO 5)</Text>
              <TouchableOpacity onPress={() => setShowArtTypeModal(false)}>
                <Text style={pm.close}>DONE</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={discipline ? (ART_TYPES_BY_DISCIPLINE[discipline] ?? []) : []}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const active = selectedArtTypes.includes(item);
                return (
                  <TouchableOpacity style={pm.row} onPress={() => toggleArtType(item)} activeOpacity={0.7}>
                    <Text style={[pm.rowText, active && pm.rowActive]}>{item.toUpperCase()}</Text>
                    {active && <Text style={pm.check}>✓</Text>}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 6 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  backLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18, textAlign: 'center' },

  photoSection: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#111111', gap: 10 },
  changePhoto: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15 },

  input: { color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1, paddingBottom: 14 },
  textarea: { backgroundColor: '#111111', color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1, lineHeight: 20, padding: 12, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  charCount: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, textAlign: 'right', marginBottom: 4 },

  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  selectText: { color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1 },
  selectPlaceholder: { color: '#b5b5b5' },
  chevron: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11 },

  inlineList: { borderWidth: 1, borderColor: '#222222' },
  inlineItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111111' },
  inlineItemSelected: { backgroundColor: '#150000' },
  inlineItemText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  inlineItemTextSelected: { color: colors.red },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#111111' },
  sectionHeaderText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.2 },

  availabilityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  availabilityLabel: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 3 },
  availabilitySub: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  toggleTrack: { width: 32, height: 18, borderRadius: 9, backgroundColor: '#1a1a1a', justifyContent: 'center', paddingHorizontal: 2 },
  toggleTrackOn: { backgroundColor: colors.red },
  toggleThumb: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.white, alignSelf: 'flex-start' },
  toggleThumbOn: { alignSelf: 'flex-end' },

  lockedField: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  lockedText: { color: colors.red, fontFamily: MONO, fontSize: 13, letterSpacing: 0.1 },
  lockedBadge: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.18, borderWidth: 1, borderColor: '#4a4a4a', paddingHorizontal: 6, paddingVertical: 2 },

  gigPosterNote: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#111111' },
  gigPosterNoteText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.12, lineHeight: 17 },

  saveBtnWrap: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  saveBtnLarge: { backgroundColor: colors.red, height: 52, alignItems: 'center', justifyContent: 'center' },
  saveBtnDisabled: { backgroundColor: '#5a0000' },
  saveBtnLargeText: { color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.3, fontWeight: '700' },

  artTypePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 12 },
  artTypePill: { borderWidth: 1, borderColor: colors.red, paddingHorizontal: 8, paddingVertical: 4 },
  artTypePillText: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
});
