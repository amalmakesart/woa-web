import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Platform, SafeAreaView, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Modal, FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import { CITIES_BY_COUNTRY, DISCIPLINES } from '../../constants/locationData';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const COUNTRIES = ['Remote', ...Object.keys(CITIES_BY_COUNTRY).sort()];

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
  rowText: { color: '#b5b5b5', fontFamily: MONO, fontSize: 11, letterSpacing: 0.08 },
  rowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 11 },
});

export default function PostProjectScreen() {
  const navigation = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [showDisciplineModal, setShowDisciplineModal] = useState(false);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const cityOptions = selectedCountry && selectedCountry !== 'Remote'
    ? (CITIES_BY_COUNTRY[selectedCountry] ?? [])
    : [];

  const location = selectedCountry === 'Remote'
    ? 'Remote'
    : (selectedCountry && selectedCity ? `${selectedCity}, ${selectedCountry}` : '');

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('REQUIRED', 'Please add a project title.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('REQUIRED', 'Please add a project description.');
      return;
    }
    if (!discipline) {
      Alert.alert('REQUIRED', 'Please select a discipline for this collab.');
      return;
    }
    if (!selectedCountry) {
      Alert.alert('REQUIRED', 'Please select a location for this collab.');
      return;
    }
    if (selectedCountry !== 'Remote' && !selectedCity) {
      Alert.alert('REQUIRED', 'Please select a city for this collab.');
      return;
    }
    if (containsBannedWords(title) || containsBannedWords(description)) {
      Alert.alert('INAPPROPRIATE LANGUAGE', getBannedWordError());
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setSubmitting(true);
    const { error } = await supabase.from('projects').insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      art_types_needed: [],
      discipline,
      budget: budget.trim() || null,
      location,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('ERROR', 'Could not post project. Please try again.');
      return;
    }

    navigation.goBack();
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>POST A PROJECT</Text>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={s.postBtn}
          activeOpacity={0.7}
        >
          {submitting
            ? <ActivityIndicator color={colors.white} size="small" />
            : <Text style={s.postBtnText}>POST</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.sectionLabel}>PROJECT TITLE *</Text>
          <TextInput
            style={s.input}
            value={title}
            onChangeText={setTitle}
            placeholder="NAME YOUR PROJECT..."
            placeholderTextColor="#333333"
            maxLength={100}
          />

          <Text style={s.sectionLabel}>DESCRIPTION *</Text>
          <Text style={s.sectionHint}>
            DESCRIBE YOUR PROJECT AND WHAT COLLABORATORS YOU ARE LOOKING FOR.
          </Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="E.G. I AM A WRITER AND I WROTE A SCREENPLAY THAT I'D LIKE TO PRODUCE. I AM LOOKING FOR 2 VIDEOGRAPHERS AND 5 ACTORS..."
            placeholderTextColor="#333333"
            multiline
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={s.charCount}>{description.length}/1000</Text>

          <Text style={s.sectionLabel}>DISCIPLINE *</Text>
          <Text style={s.sectionHint}>SELECT THE MAIN DISCIPLINE THIS COLLAB IS FOR.</Text>
          <TouchableOpacity
            style={s.selectInput}
            onPress={() => setShowDisciplineModal(true)}
            activeOpacity={0.7}
          >
            <Text style={discipline ? s.selectValue : s.selectPlaceholder}>
              {discipline ? discipline.toUpperCase() : 'SELECT DISCIPLINE'}
            </Text>
            <Text style={s.selectArrow}>›</Text>
          </TouchableOpacity>

          <Text style={s.sectionLabel}>BUDGET</Text>
          <Text style={s.sectionHint}>OPTIONAL. ADD A BUDGET OR BUDGET RANGE FOR THIS COLLAB.</Text>
          <TextInput
            style={s.input}
            value={budget}
            onChangeText={setBudget}
            placeholder="E.G. $500 OR $500 - $1,000"
            placeholderTextColor="#333333"
            maxLength={80}
          />

          <Text style={s.sectionLabel}>LOCATION *</Text>
          <Text style={s.sectionHint}>SELECT WHERE THIS COLLAB IS HAPPENING.</Text>
          <TouchableOpacity
            style={s.selectInput}
            onPress={() => setShowCountryModal(true)}
            activeOpacity={0.7}
          >
            <Text style={selectedCountry ? s.selectValue : s.selectPlaceholder}>
              {selectedCountry ? selectedCountry.toUpperCase() : 'SELECT COUNTRY'}
            </Text>
            <Text style={s.selectArrow}>›</Text>
          </TouchableOpacity>

          {selectedCountry && selectedCountry !== 'Remote' ? (
            <TouchableOpacity
              style={[s.selectInput, { marginTop: 10 }]}
              onPress={() => setShowCityModal(true)}
              activeOpacity={0.7}
            >
              <Text style={selectedCity ? s.selectValue : s.selectPlaceholder}>
                {selectedCity ? selectedCity.toUpperCase() : 'SELECT CITY'}
              </Text>
              <Text style={s.selectArrow}>›</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={showDisciplineModal}
        title="SELECT DISCIPLINE"
        options={DISCIPLINES}
        selected={discipline}
        onSelect={setDiscipline}
        onClose={() => setShowDisciplineModal(false)}
      />
      <PickerModal
        visible={showCountryModal}
        title="SELECT COUNTRY"
        options={COUNTRIES}
        selected={selectedCountry}
        onSelect={(value) => {
          setSelectedCountry(value);
          setSelectedCity('');
        }}
        onClose={() => setShowCountryModal(false)}
      />
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

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backBtn: { marginRight: 10, padding: 4 },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  topBarTitle: {
    flex: 1, color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.18,
  },
  postBtn: {
    borderWidth: 1, borderColor: colors.white,
    paddingHorizontal: 16, paddingVertical: 8,
    minWidth: 60, alignItems: 'center',
  },
  postBtnText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },

  sectionLabel: {
    color: colors.white, fontFamily: MONO, fontSize: 11,
    letterSpacing: 0.2, marginTop: 20, marginBottom: 6,
  },
  sectionHint: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 10,
    letterSpacing: 0.12, marginBottom: 8, lineHeight: 16,
  },
  input: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#222222',
    color: colors.white, fontFamily: MONO, fontSize: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    letterSpacing: 0.1,
  },
  textArea: { minHeight: 130, paddingTop: 10 },
  selectInput: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#222222',
    paddingHorizontal: 12, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectPlaceholder: {
    color: '#333333', fontFamily: MONO, fontSize: 12, letterSpacing: 0.1,
  },
  selectValue: {
    color: colors.white, fontFamily: MONO, fontSize: 12, letterSpacing: 0.1,
  },
  selectArrow: { color: '#9a9a9a', fontFamily: MONO, fontSize: 18, lineHeight: 18 },
  charCount: {
    color: '#9a9a9a', fontFamily: MONO, fontSize: 9,
    letterSpacing: 0.1, textAlign: 'right', marginTop: 4,
  },
});
