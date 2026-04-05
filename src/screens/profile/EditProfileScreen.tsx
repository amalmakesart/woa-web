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
  close: { color: '#555555', fontFamily: MONO, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111' },
  rowText: { color: '#666666', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
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
  wrap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 0, borderBottomWidth: 1, borderBottomColor: '#444444' },
  wrapError: { borderBottomColor: colors.red },
  label: { color: '#888888', fontFamily: MONO, fontSize: 10, letterSpacing: 0.2, marginBottom: 8 },
});

export default function EditProfileScreen() {
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [originalUsername, setOriginalUsername] = useState('');
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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase.from('profiles')
        .select('full_name, username, profile_photo_url, bio, discipline, art_types, city, country, experience, instagram, facebook, website, spotify_url, is_available')
        .eq('id', user.id).single();

      // If new columns don't exist yet, fall back to base columns
      const baseData = error || !data
        ? await supabase.from('profiles')
            .select('full_name, username, profile_photo_url, bio, art_type, city, country, experience, instagram, facebook, website')
            .eq('id', user.id).single().then(r => r.data)
        : null;

      const p = (data ?? baseData) as any;
      if (p) {
        setPhotoUri(p.profile_photo_url ?? null);
        setFullName(p.full_name ?? '');
        setUsername(p.username ?? '');
        setOriginalUsername(p.username ?? '');
        setBio(p.bio ?? '');
        setDiscipline(p.discipline ?? '');
        setSelectedArtTypes(p.art_types ?? []);
        setCountry(p.country ?? '');
        setCity(p.city ?? '');
        setExperience(p.experience ?? '');
        setInstagram(p.instagram ?? '');
        setFacebook(p.facebook ?? '');
        setWebsite(p.website ?? '');
        setSpotify(p.spotify_url ?? '');
        setIsAvailable(p.is_available ?? false);
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
    if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
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
    if (!username.trim()) e.username = true;
    if (!bio.trim()) e.bio = true;
    if (!discipline) e.discipline = true;
    if (!country) e.country = true;
    if (!experience.trim()) e.experience = true;
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) { Alert.alert('REQUIRED FIELDS', 'Please fill in all required fields.'); return; }
    const usernameErr = validateUsername(username.trim());
    if (usernameErr) { Alert.alert('USERNAME ERROR', usernameErr); return; }
    if (bio.trim() && containsBannedWords(bio)) { Alert.alert('INAPPROPRIATE LANGUAGE', getBannedWordError()); return; }
    setSaving(true);

    let photoUrl: string | null = photoUri;

    // Upload new photo if local URI
    if (photoUri && (photoUri.startsWith('file://') || photoUri.startsWith('ph://'))) {
      try {
        const resp = await fetch(photoUri);
        const buf = await resp.arrayBuffer();
        const ext = photoUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${userId}/avatar.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('avatars').upload(path, buf, {
          contentType: `image/${ext}`, upsert: true,
        });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          photoUrl = urlData.publicUrl;
        }
      } catch {}
    }

    const finalCity = city === OTHER_CITY ? customCity.trim() : city;

    const baseUpdate = {
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      city: finalCity,
      country,
      experience: experience.trim(),
      instagram: instagram.trim() || null,
      facebook: facebook.trim() || null,
      website: website.trim() || null,
      profile_photo_url: photoUrl,
    };

    const { error } = await supabase.from('profiles').update({
      ...baseUpdate,
      discipline: discipline || null,
      art_types: selectedArtTypes,
      spotify_url: spotify.trim() || null,
      is_available: isAvailable,
    }).eq('id', userId);

    // If update failed due to missing columns, fall back to base fields only
    if (error) {
      const { error: fallbackError } = await supabase.from('profiles').update(baseUpdate).eq('id', userId);
      if (fallbackError) { Alert.alert('ERROR', 'Could not save. Please try again.'); setSaving(false); return; }
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

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>MY PROFILE</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={saving} activeOpacity={0.7}>
          {saving
            ? <ActivityIndicator color={colors.red} size="small" />
            : <Text style={s.saveBtn}>{success ? 'SAVED ✓' : 'SAVE'}</Text>}
        </TouchableOpacity>
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
              placeholder="YOUR FULL NAME" placeholderTextColor="#444444" maxLength={80} />
          </Field>

          {/* Username */}
          <Field label="USERNAME" required error={errors.username}>
            <TextInput style={s.input} value={username} onChangeText={setUsername}
              placeholder="YOUR USERNAME" placeholderTextColor="#444444" maxLength={30}
              autoCapitalize="none" />
          </Field>

          {/* Bio */}
          <Field label="BIO" required error={errors.bio}>
            <TextInput style={s.textarea} value={bio} onChangeText={setBio}
              placeholder="TELL THE WORLD ABOUT YOUR WORK..." placeholderTextColor="#444444"
              multiline maxLength={500} textAlignVertical="top" />
            <Text style={s.charCount}>{bio.length}/500</Text>
          </Field>

          {/* Discipline */}
          <Field label="DISCIPLINE" required error={errors.discipline}>
            <TouchableOpacity style={s.selectBtn} onPress={() => setShowDisciplinePicker(!showDisciplinePicker)} activeOpacity={0.7}>
              <Text style={[s.selectText, !discipline && s.selectPlaceholder]}>{discipline || 'SELECT YOUR DISCIPLINE'}</Text>
              <Text style={s.chevron}>{showDisciplinePicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showDisciplinePicker && (
              <View style={s.inlineList}>
                {DISCIPLINES.map(d => (
                  <TouchableOpacity key={d} style={[s.inlineItem, discipline === d && s.inlineItemSelected]}
                    onPress={() => { setDiscipline(d); setSelectedArtTypes([]); setShowDisciplinePicker(false); }} activeOpacity={0.7}>
                    <Text style={[s.inlineItemText, discipline === d && s.inlineItemTextSelected]}>{d.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </Field>

          {/* Art Types multi-select */}
          {discipline ? (
            <Field label="ART TYPES (UP TO 5)">
              <TouchableOpacity style={s.selectBtn} onPress={() => setShowArtTypeModal(true)} activeOpacity={0.7}>
                <Text style={[s.selectText, selectedArtTypes.length === 0 && s.selectPlaceholder]}>
                  {selectedArtTypes.length > 0 ? `${selectedArtTypes.length} SELECTED` : 'SELECT ART TYPES'}
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

          {/* Country */}
          <Field label="COUNTRY" required error={errors.country}>
            <TouchableOpacity style={s.selectBtn} onPress={() => setShowCountryPicker(true)} activeOpacity={0.7}>
              <Text style={[s.selectText, !country && s.selectPlaceholder]}>{country || 'SELECT COUNTRY'}</Text>
              <Text style={s.chevron}>▼</Text>
            </TouchableOpacity>
          </Field>

          {/* City */}
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
                placeholder="ENTER YOUR CITY" placeholderTextColor="#444444" maxLength={60} />
            </Field>
          ) : null}

          {/* Years of experience */}
          <Field label="YEARS OF EXPERIENCE" required error={errors.experience}>
            <TextInput style={s.input} value={experience} onChangeText={v => setExperience(v.replace(/[^0-9]/g, ''))}
              placeholder="E.G. 5" placeholderTextColor="#444444" maxLength={3}
              keyboardType="number-pad" />
          </Field>

          {/* Availability toggle */}
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

          {/* Optional social */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionHeaderText}>SOCIAL LINKS (OPTIONAL)</Text>
          </View>

          <Field label="INSTAGRAM URL">
            <TextInput style={s.input} value={instagram} onChangeText={setInstagram}
              placeholder="HTTPS://INSTAGRAM.COM/..." placeholderTextColor="#444444"
              autoCapitalize="none" keyboardType="url" maxLength={200} />
          </Field>
          <Field label="FACEBOOK URL">
            <TextInput style={s.input} value={facebook} onChangeText={setFacebook}
              placeholder="HTTPS://FACEBOOK.COM/..." placeholderTextColor="#444444"
              autoCapitalize="none" keyboardType="url" maxLength={200} />
          </Field>
          <Field label="WEBSITE / PORTFOLIO">
            <TextInput style={s.input} value={website} onChangeText={setWebsite}
              placeholder="HTTPS://..." placeholderTextColor="#444444"
              autoCapitalize="none" keyboardType="url" maxLength={200} />
          </Field>
          <Field label="SPOTIFY PROFILE">
            <TextInput style={s.input} value={spotify} onChangeText={setSpotify}
              placeholder="HTTPS://OPEN.SPOTIFY.COM/ARTIST/..." placeholderTextColor="#444444"
              autoCapitalize="none" keyboardType="url" maxLength={200} />
          </Field>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal visible={showCountryPicker} title="SELECT COUNTRY" options={COUNTRIES}
        selected={country} onSelect={v => { setCountry(v); setCity(''); setCustomCity(''); }}
        onClose={() => setShowCountryPicker(false)} />
      <PickerModal visible={showCityPicker} title="SELECT CITY" options={cityOptions}
        selected={city} onSelect={setCity} onClose={() => setShowCityPicker(false)} />

      {/* Art Type Multi-Select Modal */}
      <Modal visible={showArtTypeModal} transparent animationType="slide" onRequestClose={() => setShowArtTypeModal(false)}>
        <TouchableOpacity style={pm.overlay} activeOpacity={1} onPress={() => setShowArtTypeModal(false)}>
          <View style={pm.sheet}>
            <View style={pm.header}>
              <Text style={pm.title}>SELECT ART TYPES (UP TO 5)</Text>
              <TouchableOpacity onPress={() => setShowArtTypeModal(false)}><Text style={pm.close}>DONE</Text></TouchableOpacity>
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
  backLabel: { color: '#666666', fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18 },
  saveBtn: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },

  photoSection: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#111111', gap: 10 },
  changePhoto: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },

  input: { color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1, paddingBottom: 14 },
  textarea: { backgroundColor: '#111111', color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1, lineHeight: 20, padding: 12, minHeight: 100, textAlignVertical: 'top', marginBottom: 8 },
  charCount: { color: '#333333', fontFamily: MONO, fontSize: 6, textAlign: 'right', marginBottom: 4 },

  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14 },
  selectText: { color: '#ffffff', fontFamily: MONO, fontSize: 13, letterSpacing: 0.1 },
  selectPlaceholder: { color: '#444444' },
  chevron: { color: '#555555', fontFamily: MONO, fontSize: 10 },

  inlineList: { borderWidth: 1, borderColor: '#222222' },
  inlineItem: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111111' },
  inlineItemSelected: { backgroundColor: '#150000' },
  inlineItemText: { color: '#666666', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  inlineItemTextSelected: { color: colors.red },

  sectionHeader: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#111111' },
  sectionHeaderText: { color: '#333333', fontFamily: MONO, fontSize: 8, letterSpacing: 0.2 },

  availabilityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  availabilityLabel: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.15, marginBottom: 3 },
  availabilitySub: { color: '#444444', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  toggleTrack: {
    width: 32, height: 18, borderRadius: 9,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: colors.red },
  toggleThumb: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.white,
    alignSelf: 'flex-start',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
  artTypePillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: 12 },
  artTypePill: {
    borderWidth: 1, borderColor: colors.red,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  artTypePillText: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
});
