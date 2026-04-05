import React, { useState, useEffect } from 'react';
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
  Alert,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import { Post } from '../../components/PostCard';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';

interface Collection { id: string; name: string; post_count: number; }

const SUGGESTED_COLLECTIONS = [
  'COMMISSION WORK', 'GIG', 'PERSONAL PROJECT', 'EXHIBITION',
  'ARCHIVE', 'FEATURED WORK', 'COLLABORATION', 'SKETCH WORK',
  'STUDIO SESSIONS', 'PUBLISHED WORK',
];

export default function NewPostScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editPost: Post | undefined = route.params?.editPost;
  const isEditMode = !!editPost;

  const [postType, setPostType] = useState<'image' | 'text' | 'audio'>(editPost?.type ?? 'text');
  const [textContent, setTextContent] = useState<string>(editPost?.type === 'text' ? (editPost.content ?? '') : '');
  const [title, setTitle] = useState<string>(editPost?.title ?? '');
  const [imageUri, setImageUri] = useState<string | null>(editPost?.type === 'image' ? (editPost.media_url ?? null) : null);
  const [audioUri, setAudioUri] = useState<string | null>(editPost?.type === 'audio' ? (editPost.media_url ?? null) : null);
  const [audioName, setAudioName] = useState<string | null>(editPost?.type === 'audio' && editPost.media_url ? 'EXISTING AUDIO' : null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('collections').select('id, name, post_count').eq('user_id', user.id).order('name');
      if (data) setCollections(data as Collection[]);
      // Silently ignore if collections table doesn't exist yet
    })();
  }, []);

  const isLocalUri = (uri: string) => uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('PERMISSION REQUIRED', 'Camera roll access needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      setAudioUri(result.assets[0].uri);
      setAudioName(result.assets[0].name);
    } catch { Alert.alert('ERROR', 'Could not pick audio file.'); }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim() || !userId) return;
    setCreatingCollection(true);
    const { data, error } = await supabase.from('collections')
      .insert({ user_id: userId, name: newCollectionName.trim() })
      .select('id, name, post_count').single();
    setCreatingCollection(false);
    if (!error && data) {
      const col = data as Collection;
      setCollections((prev) => [...prev, col].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedCollectionId(col.id);
      setNewCollectionName('');
      setShowCollectionPicker(false);
    }
  };

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const handlePublish = async () => {
    setPublishError(null);

    if (!title.trim()) { setPublishError('TITLE IS REQUIRED.'); return; }
    const content = postType === 'text' ? textContent : '';
    if (postType === 'text' && !textContent.trim()) { setPublishError('WRITE SOMETHING.'); return; }
    if (postType === 'image' && !imageUri) { setPublishError('PLEASE SELECT AN IMAGE.'); return; }
    if (postType === 'audio' && !audioUri) { setPublishError('PLEASE SELECT AN AUDIO FILE.'); return; }
    if (containsBannedWords(title) || containsBannedWords(content)) {
      setPublishError(getBannedWordError()); return;
    }

    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPublishError('FAILED TO POST — NOT LOGGED IN.'); return; }

      let mediaUrl: string | null = null;

      if (postType === 'image' && imageUri && isLocalUri(imageUri)) {
        const isGif = imageUri.toLowerCase().endsWith('.gif');
        const rawExt = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
        const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
        const mimeType = isGif ? 'image/gif' : ext === 'png' ? 'image/png' : 'image/jpeg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const response = await fetch(imageUri);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage.from('posts').upload(path, arrayBuffer, { contentType: mimeType });
        if (uploadError) { setPublishError(`FAILED TO POST — ${uploadError.message}`); return; }
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      } else if (postType === 'image' && imageUri) {
        mediaUrl = imageUri;
      }

      if (postType === 'audio' && audioUri && isLocalUri(audioUri)) {
        const ext = audioUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'mp3';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const response = await fetch(audioUri);
        const arrayBuffer = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage.from('posts').upload(path, arrayBuffer, { contentType: `audio/${ext}` });
        if (uploadError) { setPublishError(`FAILED TO POST — ${uploadError.message}`); return; }
        const { data: urlData } = supabase.storage.from('posts').getPublicUrl(path);
        mediaUrl = urlData.publicUrl;
      } else if (postType === 'audio' && audioUri) {
        mediaUrl = audioUri;
      }

      const postData = {
        content: postType === 'text' ? textContent : null,
        title: title.trim(),
        media_url: mediaUrl,
        collection_id: selectedCollectionId ?? null,
        char_count: postType === 'text' ? textContent.length : null,
      };

      if (isEditMode && editPost) {
        const { error } = await supabase.from('posts').update(postData).eq('id', editPost.id);
        if (error) {
          // Fallback: save with base fields only (new columns may not exist yet)
          const { error: err2 } = await supabase.from('posts').update({
            content: postType === 'text' ? textContent : null,
            media_url: mediaUrl,
          }).eq('id', editPost.id);
          if (err2) { setPublishError('FAILED TO SAVE — TRY AGAIN'); return; }
        }
      } else {
        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          type: postType,
          ...postData,
        });
        if (error) {
          // Fallback: insert with base fields only (SQL migration not yet run)
          const fallbackContent = postType === 'text' ? textContent : title.trim();
          const { error: err2 } = await supabase.from('posts').insert({
            user_id: user.id,
            type: postType,
            content: fallbackContent,
            media_url: mediaUrl,
          });
          if (err2) { setPublishError('FAILED TO POST — TRY AGAIN'); return; }
        }

        // Increment collection post_count (ignore if RPC doesn't exist yet)
        if (selectedCollectionId) {
          await supabase.rpc('increment_collection_count', { collection_id: selectedCollectionId }).catch(() => {});
        }
      }

      navigation.goBack();
    } catch {
      setPublishError('FAILED TO POST — TRY AGAIN');
    } finally {
      setPublishing(false);
    }
  };

  const titleLimitReached = title.length >= 25;
  const textWarn = textContent.length > 2000;
  const textLimitReached = textContent.length >= 2500;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{isEditMode ? 'EDIT POST' : 'NEW POST'}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.typeSelector}>
          {(['image', 'text', 'audio'] as const).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeTab, postType === type && styles.typeTabActive]}
              onPress={() => setPostType(type)}
              disabled={isEditMode}
            >
              <Text style={[styles.typeTabText, postType === type && styles.typeTabTextActive]}>
                {type.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView style={styles.scrollView} keyboardShouldPersistTaps="handled">

          {/* Image upload */}
          {postType === 'image' && (
            <TouchableOpacity style={styles.uploadZone} onPress={handlePickImage} activeOpacity={0.7}>
              {imageUri ? (
                <Image source={{ uri: imageUri }} style={styles.uploadedImage} resizeMode="cover" />
              ) : (
                <>
                  <Text style={styles.uploadZonePlus}>+</Text>
                  <Text style={styles.uploadZoneLabel}>UPLOAD IMAGE OR GIF</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Text area */}
          {postType === 'text' && (
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                value={textContent}
                onChangeText={(v) => setTextContent(v.slice(0, 2500))}
                multiline
                placeholder="WRITE SOMETHING..."
                placeholderTextColor="#333333"
                textAlignVertical="top"
                maxLength={2500}
              />
              <Text style={[styles.charCount, textWarn && styles.charCountWarn]}>
                {textContent.length}/2500
              </Text>
            </View>
          )}

          {/* Audio upload */}
          {postType === 'audio' && (
            <TouchableOpacity style={styles.uploadZone} onPress={handlePickAudio} activeOpacity={0.7}>
              {audioUri ? (
                <Text style={styles.audioSelectedText}>{audioName ?? 'AUDIO SELECTED'}</Text>
              ) : (
                <>
                  <Text style={styles.audioPlayIcon}>▶</Text>
                  <Text style={styles.uploadZoneLabel}>UPLOAD AUDIO FILE</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Title */}
          <View style={styles.fieldContainer}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>TITLE</Text>
              <Text style={styles.fieldRequired}> *</Text>
            </View>
            <TextInput
              style={styles.fieldInput}
              value={title}
              onChangeText={(v) => setTitle(v.slice(0, 25))}
              placeholder="ADD A TITLE..."
              placeholderTextColor="#333333"
              maxLength={25}
            />
            <Text style={[styles.charCount, titleLimitReached && styles.charCountWarn]}>
              {title.length}/25
            </Text>
          </View>

          {/* Collection picker */}
          <View style={styles.fieldContainer}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>COLLECTION</Text>
              <Text style={styles.fieldOptional}> (OPTIONAL)</Text>
            </View>
            <TouchableOpacity
              style={styles.collectionBtn}
              onPress={() => setShowCollectionPicker(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.collectionBtnText, !selectedCollection && styles.collectionPlaceholder]}>
                {selectedCollection ? selectedCollection.name.toUpperCase() : 'SELECT COLLECTION'}
              </Text>
              <Text style={styles.chevron}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* Disclaimers */}
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              AI-GENERATED ART IS NOT PERMITTED ON WOA. POSTS MUST REPRESENT YOUR OWN ORIGINAL WORK.
            </Text>
            <Text style={[styles.disclaimerText, { marginTop: 4 }]}>
              PROFANE, OFFENSIVE OR INAPPROPRIATE CONTENT WILL RESULT IN ACCOUNT SUSPENSION.
            </Text>
          </View>

          {/* Publish button */}
          <View style={styles.publishContainer}>
            {publishError ? <Text style={styles.publishError}>{publishError}</Text> : null}
            <TouchableOpacity
              style={[styles.publishButton, publishing && styles.publishButtonDisabled]}
              onPress={handlePublish}
              disabled={publishing}
              activeOpacity={0.7}
            >
              <Text style={styles.publishButtonText}>
                {publishing
                  ? (isEditMode ? 'SAVING...' : 'PUBLISHING...')
                  : (isEditMode ? 'SAVE CHANGES' : 'PUBLISH')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Collection picker modal */}
      <Modal visible={showCollectionPicker} transparent animationType="slide" onRequestClose={() => setShowCollectionPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCollectionPicker(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>SELECT COLLECTION</Text>
              <TouchableOpacity onPress={() => { setSelectedCollectionId(null); setShowCollectionPicker(false); }}>
                <Text style={styles.modalClear}>CLEAR</Text>
              </TouchableOpacity>
            </View>

            {collections.length > 0 && (
              <FlatList
                data={collections}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 240 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.collectionRow}
                    onPress={() => { setSelectedCollectionId(item.id); setShowCollectionPicker(false); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.collectionRowText, selectedCollectionId === item.id && styles.collectionRowActive]}>
                      {item.name.toUpperCase()}
                    </Text>
                    {selectedCollectionId === item.id && <Text style={styles.check}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            )}

            {/* Suggested names */}
            <View style={styles.suggestionsContainer}>
              <Text style={styles.suggestionsLabel}>SUGGESTIONS</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsRow}>
                {SUGGESTED_COLLECTIONS.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.suggestionPill}
                    onPress={() => setNewCollectionName(s.slice(0, 30))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.suggestionPillText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Create new */}
            <View style={styles.newCollectionRow}>
              <TextInput
                style={styles.newCollectionInput}
                value={newCollectionName}
                onChangeText={(v) => setNewCollectionName(v.slice(0, 30))}
                placeholder="+ CREATE NEW COLLECTION"
                placeholderTextColor="#555555"
                maxLength={30}
              />
              {newCollectionName.trim() ? (
                <TouchableOpacity onPress={handleCreateCollection} disabled={creatingCollection} activeOpacity={0.7}>
                  <Text style={styles.doneBtn}>{creatingCollection ? '...' : 'DONE'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.black },
  keyboardAvoid: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  backArrow: { color: colors.white, fontFamily: MONO, fontSize: 28, lineHeight: 32 },
  headerTitle: { flex: 1, textAlign: 'center', color: colors.white, fontFamily: MONO, fontSize: 13, letterSpacing: 0.22 },
  headerSpacer: { width: 32 },

  typeSelector: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111111' },
  typeTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  typeTabActive: { borderBottomWidth: 1, borderBottomColor: colors.white },
  typeTabText: { fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, color: '#555555' },
  typeTabTextActive: { color: colors.white },

  scrollView: { flex: 1 },

  uploadZone: {
    height: 130, backgroundColor: '#0a0a0a', margin: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  uploadedImage: { width: '100%', height: '100%' },
  uploadZonePlus: { color: '#2a2a2a', fontSize: 18 },
  uploadZoneLabel: { color: '#2a2a2a', fontFamily: MONO, fontSize: 6, marginTop: 6 },
  audioPlayIcon: { color: colors.red, fontSize: 18 },
  audioSelectedText: { color: '#2a7a4f', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, paddingHorizontal: 12, textAlign: 'center' },

  textAreaContainer: { margin: 16 },
  textArea: {
    height: 120, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a',
    color: colors.white, fontFamily: MONO, fontSize: 11, padding: 12, letterSpacing: 0.1, textAlignVertical: 'top',
  },
  charCount: { color: '#444444', fontFamily: MONO, fontSize: 7, textAlign: 'right', marginTop: 4 },
  charCountWarn: { color: colors.red },

  fieldContainer: { marginHorizontal: 16, marginTop: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  fieldLabel: { color: '#888888', fontFamily: MONO, fontSize: 8, letterSpacing: 0.18 },
  fieldRequired: { color: colors.red, fontFamily: MONO, fontSize: 8 },
  fieldOptional: { color: '#444444', fontFamily: MONO, fontSize: 7 },
  fieldInput: {
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
    color: colors.white, fontFamily: MONO, fontSize: 13, paddingVertical: 6,
  },

  collectionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingVertical: 8,
  },
  collectionBtnText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collectionPlaceholder: { color: '#444444' },
  chevron: { color: '#555555', fontFamily: MONO, fontSize: 10 },

  disclaimer: {
    marginHorizontal: 16, marginTop: 20,
    backgroundColor: '#050505', borderWidth: 1, borderColor: '#1a1a1a',
    padding: 10,
  },
  disclaimerText: {
    color: '#444444', fontFamily: MONO, fontSize: 7, letterSpacing: 0.08,
    textAlign: 'center', lineHeight: 11,
  },

  publishContainer: { marginHorizontal: 16, marginTop: 20, marginBottom: 40 },
  publishError: { color: colors.red, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18, marginBottom: 12, textAlign: 'center' },
  publishButton: { borderWidth: 1, borderColor: colors.white, paddingVertical: 14, alignItems: 'center' },
  publishButtonDisabled: { opacity: 0.5 },
  publishButtonText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.22 },

  // Collection modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#222222', paddingBottom: 34 },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a',
  },
  modalTitle: { color: colors.white, fontFamily: MONO, fontSize: 9, letterSpacing: 0.2 },
  modalClear: { color: colors.red, fontFamily: MONO, fontSize: 8, letterSpacing: 0.15 },
  collectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  collectionRowText: { color: '#555555', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collectionRowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 10 },
  suggestionsContainer: {
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: '#111111',
  },
  suggestionsLabel: { color: '#555555', fontFamily: MONO, fontSize: 7, letterSpacing: 0.18, marginBottom: 8 },
  suggestionsRow: { gap: 6, paddingBottom: 8 },
  suggestionPill: {
    borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 10, paddingVertical: 5,
  },
  suggestionPillText: { color: '#888888', fontFamily: MONO, fontSize: 8, letterSpacing: 0.1 },
  newCollectionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#1a1a1a',
  },
  newCollectionInput: {
    flex: 1, color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1,
  },
  doneBtn: { color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18, marginLeft: 12 },
});
