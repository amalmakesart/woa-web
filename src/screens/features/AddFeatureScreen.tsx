import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, SafeAreaView, ActivityIndicator,
  Alert, KeyboardAvoidingView, Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;

export default function AddFeatureScreen() {
  const navigation = useNavigation<any>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [location, setLocation] = useState('');
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [artistSearch, setArtistSearch] = useState('');
  const [artistResults, setArtistResults] = useState<any[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const handlePickThumbnail = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setThumbnailUri(result.assets[0].uri);
    }
  };

  const handleSearchArtist = async (query: string) => {
    setArtistSearch(query);
    setSelectedArtist(null);
    if (query.length < 2) { setArtistResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, full_name, profile_photo_url, art_type')
      .ilike('username', `%${query}%`)
      .limit(6);
    setArtistResults(data ?? []);
  };

  const handleSelectArtist = (artist: any) => {
    setSelectedArtist(artist);
    setArtistSearch(artist.username ?? '');
    setArtistResults([]);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('MISSING TITLE', 'Please enter a title before saving.');
      return;
    }

    setSaving(true);

    let thumbnailUrl: string | null = null;

    if (thumbnailUri) {
      try {
        const resp = await fetch(thumbnailUri);
        const buf = await resp.arrayBuffer();
        const ext = thumbnailUri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const filename = `features/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(filename, buf, { contentType: `image/${ext}`, upsert: true });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filename);
          thumbnailUrl = urlData.publicUrl;
        }
      } catch {
        // thumbnail upload failed — continue without thumbnail
      }
    }

    // Auto-calculate next episode number
    const { count } = await supabase
      .from('features')
      .select('*', { count: 'exact', head: true });
    const nextEpisode = (count ?? 0) + 1;

    const { error: insertErr } = await supabase.from('features').insert({
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      duration: location.trim() || null,
      thumbnail_url: thumbnailUrl,
      artist_id: selectedArtist?.id ?? null,
      episode_number: nextEpisode,
    });

    setSaving(false);

    if (insertErr) {
      Alert.alert('ERROR', `Could not save feature.\n\n${insertErr.message}`);
      return;
    }

    Alert.alert('SAVED', 'Feature has been added.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.backArrow}>‹</Text>
          <Text style={s.backLabel}>FEATURES</Text>
        </TouchableOpacity>
        <Text style={s.topBarTitle}>ADD FEATURE</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={[s.saveBtn, saving && s.saveBtnDisabled]}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator color={colors.red} size="small" />
          ) : (
            <Text style={s.saveBtnText}>SAVE</Text>
          )}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Thumbnail picker */}
          <TouchableOpacity style={s.thumbPicker} onPress={handlePickThumbnail} activeOpacity={0.8}>
            {thumbnailUri ? (
              <Image source={{ uri: thumbnailUri }} style={s.thumbPreview} resizeMode="cover" />
            ) : (
              <View style={s.thumbEmpty}>
                <Text style={s.thumbEmptyIcon}>▷</Text>
                <Text style={s.thumbEmptyLabel}>TAP TO ADD THUMBNAIL</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={s.field}>
            <Text style={s.fieldLabel}>TITLE *</Text>
            <TextInput
              style={s.input}
              value={title}
              onChangeText={setTitle}
              placeholder="EPISODE TITLE"
              placeholderTextColor="#333333"
              maxLength={120}
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>DESCRIPTION</Text>
            <TextInput
              style={[s.input, s.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="SHORT DESCRIPTION..."
              placeholderTextColor="#333333"
              multiline
              numberOfLines={4}
              maxLength={600}
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>VIDEO LINK</Text>
            <TextInput
              style={s.input}
              value={videoUrl}
              onChangeText={setVideoUrl}
              placeholder="YOUTUBE / VIMEO / ANY URL"
              placeholderTextColor="#333333"
              autoCapitalize="none"
              keyboardType="url"
              maxLength={500}
            />
          </View>

          <View style={s.field}>
            <Text style={s.fieldLabel}>LOCATION</Text>
            <TextInput
              style={s.input}
              value={location}
              onChangeText={setLocation}
              placeholder="E.G. LONDON, UK"
              placeholderTextColor="#333333"
              maxLength={80}
            />
          </View>

          {/* Artist search */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>LINK ARTIST (OPTIONAL)</Text>
            {selectedArtist ? (
              <View style={s.selectedArtist}>
                <Text style={s.selectedArtistName}>@{selectedArtist.username?.toUpperCase()}</Text>
                <TouchableOpacity onPress={() => { setSelectedArtist(null); setArtistSearch(''); }} activeOpacity={0.7}>
                  <Text style={s.clearArtist}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TextInput
                style={s.input}
                value={artistSearch}
                onChangeText={handleSearchArtist}
                placeholder="SEARCH BY USERNAME"
                placeholderTextColor="#333333"
                autoCapitalize="none"
                maxLength={50}
              />
            )}
            {artistResults.length > 0 && (
              <View style={s.artistDropdown}>
                {artistResults.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    style={s.artistRow}
                    onPress={() => handleSelectArtist(a)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.artistRowName}>@{a.username}</Text>
                    {a.art_type ? <Text style={s.artistRowType}>{a.art_type}</Text> : null}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 60 }} />
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
  topBarTitle: { flex: 1, color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.2, textAlign: 'center' },
  saveBtn: { borderWidth: 1, borderColor: colors.red, paddingHorizontal: 14, paddingVertical: 6 },
  saveBtnDisabled: { borderColor: '#333333' },
  saveBtnText: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.2 },

  thumbPicker: {
    height: 200, backgroundColor: '#0a0a0a',
    borderBottomWidth: 1, borderBottomColor: '#111111',
    overflow: 'hidden',
  },
  thumbPreview: { width: '100%', height: '100%' },
  thumbEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  thumbEmptyIcon: { color: '#222222', fontSize: 40 },
  thumbEmptyLabel: { color: '#333333', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },

  field: {
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  fieldLabel: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, marginBottom: 10 },
  input: {
    color: colors.white, fontFamily: MONO,
    fontSize: 12, letterSpacing: 0.1, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#222222',
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },

  selectedArtist: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.red,
  },
  selectedArtistName: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  clearArtist: { color: '#9a9a9a', fontFamily: MONO, fontSize: 12 },

  artistDropdown: { borderWidth: 1, borderColor: '#1a1a1a', marginTop: 4 },
  artistRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  artistRowName: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  artistRowType: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
});
