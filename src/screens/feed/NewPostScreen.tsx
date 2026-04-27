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
import Constants from 'expo-constants';
import { useNavigation, useRoute } from '@react-navigation/native';
import { colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { containsBannedWords, getBannedWordError } from '../../lib/contentFilter';
import { Post } from '../../components/PostCard';

const MONO = Platform.select({ ios: 'Courier New', android: 'monospace' }) as string;
const GOLD = '#f6c55a';
const VIDEO_MAX_DURATION_MS = 60_000;
const SUPABASE_URL = Constants.expoConfig?.extra?.supabaseUrl as string | undefined;
const SUPABASE_ANON_KEY = Constants.expoConfig?.extra?.supabaseAnonKey as string | undefined;

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  m4v: 'video/x-m4v',
  avi: 'video/x-msvideo',
};

const STORAGE_BUCKETS = {
  image: ['post-images', 'posts'],
  video: ['post-videos', 'posts'],
  audio: ['post-audio', 'posts'],
} as const;

interface Collection { id: string; name: string; post_count: number; }
interface ArtistSuggestion { id: string; username: string | null; full_name: string | null; profile_photo_url: string | null; }

const TAGS = [
  'COMMISSION WORK', 'GIG', 'PERSONAL PROJECT', 'EXHIBITION',
  'ARCHIVE', 'FEATURED WORK', 'COLLABORATION', 'SKETCH WORK',
  'STUDIO SESSIONS', 'PUBLISHED WORK',
];

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = base64.replace(/=+$/, '');
  const bytes: number[] = [];

  for (let bc = 0, bs = 0, idx = 0; idx < str.length; idx++) {
    const buffer = chars.indexOf(str.charAt(idx));
    if (buffer < 0) continue;
    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) {
      bytes.push(255 & (bs >> ((-2 * bc) & 6)));
    }
  }

  return Uint8Array.from(bytes).buffer;
}

async function getLegacyFileSystem() {
  return import('expo-file-system/legacy');
}

async function localUriToArrayBuffer(uri: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(uri);
    return await response.arrayBuffer();
  } catch {
    // Fall back to legacy file reads when fetch cannot open the local asset URI.
  }

  let readableUri = uri;
  const FileSystem = await getLegacyFileSystem();
  if ((uri.startsWith('ph://') || uri.startsWith('content://')) && FileSystem.cacheDirectory) {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'mp4';
    const dest = `${FileSystem.cacheDirectory}video-upload-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    readableUri = dest;
  }

  const base64 = await FileSystem.readAsStringAsync(readableUri, {
    encoding: 'base64',
  });
  return base64ToArrayBuffer(base64);
}

async function ensureUploadableFileUri(uri: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const FileSystem = await getLegacyFileSystem();
  if ((uri.startsWith('ph://') || uri.startsWith('content://')) && FileSystem.cacheDirectory) {
    const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'mp4';
    const dest = `${FileSystem.cacheDirectory}upload-${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  }
  return uri;
}

async function uploadToFirstWorkingBucket(
  buckets: readonly string[],
  path: string,
  data: ArrayBuffer,
  contentType: string
): Promise<string> {
  let lastError: any = null;
  for (const bucket of buckets) {
    const { error } = await supabase.storage.from(bucket).upload(path, data, { contentType });
    if (!error) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return urlData.publicUrl;
    }
    lastError = error;
  }
  throw new Error(lastError?.message ?? 'UPLOAD FAILED');
}

async function uploadLocalFileToFirstWorkingBucket(
  buckets: readonly string[],
  path: string,
  fileUri: string,
  contentType: string,
  accessToken: string
): Promise<string> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('MISSING SUPABASE CONFIG');
  }

  const uploadableUri = await ensureUploadableFileUri(fileUri);
  let lastError: any = null;
  const FileSystem = await getLegacyFileSystem();

  for (const bucket of buckets) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    const url = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;
    const result = await FileSystem.uploadAsync(url, uploadableUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
    });

    if (result.status >= 200 && result.status < 300) {
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(path);
      return urlData.publicUrl;
    }

    lastError = new Error(`UPLOAD ${result.status}${result.body ? ` — ${result.body}` : ''}`);
  }

  throw lastError ?? new Error('UPLOAD FAILED');
}

export default function NewPostScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const editPost: Post | undefined = route.params?.editPost;
  const isEditMode = !!editPost;

  const [postType, setPostType] = useState<'image' | 'text' | 'audio' | 'video'>(editPost?.type ?? 'text');
  const [textContent, setTextContent] = useState<string>(editPost?.type === 'text' ? (editPost.content ?? '') : '');
  const [title, setTitle] = useState<string>(editPost?.title ?? '');
  const [imageUris, setImageUris] = useState<string[]>(
    editPost?.type === 'image'
      ? (
          (Array.isArray(editPost.media_urls) && editPost.media_urls.length > 0
            ? editPost.media_urls
            : editPost.media_url
              ? [editPost.media_url]
              : []
          ).filter(Boolean) as string[]
        )
      : []
  );
  const [audioUri, setAudioUri] = useState<string | null>(editPost?.type === 'audio' ? (editPost.media_url ?? null) : null);
  const [audioName, setAudioName] = useState<string | null>(editPost?.type === 'audio' && editPost.media_url ? 'EXISTING AUDIO' : null);
  const [videoUri, setVideoUri] = useState<string | null>(editPost?.type === 'video' ? (editPost.media_url ?? null) : null);
  const [videoFileName, setVideoFileName] = useState<string | null>(null);
  const [videoMimeType, setVideoMimeType] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  // Collections
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(
    editPost?.tags?.length ? editPost.tags[0] : null
  );
  const [userId, setUserId] = useState<string | null>(null);

  // Co-post collaborator
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [collaboratorSuggestions, setCollaboratorSuggestions] = useState<ArtistSuggestion[]>([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState<ArtistSuggestion | null>(null);
  const [searchingCollab, setSearchingCollab] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('collections').select('id, name, post_count').eq('user_id', user.id).order('name');
      if (data) setCollections(data as Collection[]);
    })();
  }, []);

  // Artist search for co-post
  useEffect(() => {
    if (!collaboratorQuery.trim() || collaboratorQuery.length < 2) {
      setCollaboratorSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearchingCollab(true);
      const q = collaboratorQuery.trim().toLowerCase();
      // Two separate queries then merge — more reliable than .or() + .in() combo
      // Role filter done in JS (not Supabase) so NULL roles are not silently excluded
      const [byUsername, byName] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_photo_url, role')
          .ilike('username', `%${q}%`)
          .limit(10),
        supabase
          .from('profiles')
          .select('id, username, full_name, profile_photo_url, role')
          .ilike('full_name', `%${q}%`)
          .limit(10),
      ]);
      const combined = [...(byUsername.data ?? []), ...(byName.data ?? [])];
      const seen = new Set<string>();
      const unique = combined.filter((p: any) => {
        if (seen.has(p.id)) return false;
        if (p.id === userId) return false;
        if (p.role === 'GIG_POSTER' || p.role === 'ART_LOVER') return false;
        seen.add(p.id);
        return true;
      });
      setCollaboratorSuggestions(unique.slice(0, 6) as ArtistSuggestion[]);
      setSearchingCollab(false);
    }, 400);
    return () => clearTimeout(timer);
  }, [collaboratorQuery, userId]);

  const isLocalUri = (uri: string) => uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('PERMISSION REQUIRED', 'Camera roll access needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 4,
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUris(result.assets.map(asset => asset.uri).filter(Boolean).slice(0, 4));
    }
  };

  const handlePickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('PERMISSION REQUIRED', 'Camera roll access needed.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: false,
      quality: 0.8,
      videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    // expo-image-picker returns duration in milliseconds
    const duration = asset.duration ?? 0;
    if (duration > VIDEO_MAX_DURATION_MS) {
      Alert.alert('VIDEO TOO LONG', 'VIDEOS MUST BE UNDER 60 SECONDS.');
      return;
    }
    setVideoUri(asset.uri);
    setVideoFileName(asset.fileName ?? null);
    setVideoMimeType(asset.mimeType ?? null);
  };

  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      setAudioUri(result.assets[0].uri);
      setAudioName(result.assets[0].name);
    } catch { Alert.alert('ERROR', 'Could not pick audio file.'); }
  };

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  const handlePublish = async () => {
    setPublishError(null);

    if (!title.trim()) { setPublishError('TITLE IS REQUIRED.'); return; }
    const content = postType === 'text' ? textContent : '';
    if (postType === 'text' && !textContent.trim()) { setPublishError('WRITE SOMETHING.'); return; }
    if (postType === 'image' && imageUris.length === 0) { setPublishError('PLEASE SELECT AT LEAST ONE IMAGE.'); return; }
    if (postType === 'audio' && !audioUri) { setPublishError('PLEASE SELECT AN AUDIO FILE.'); return; }
    if (postType === 'video' && !videoUri) { setPublishError('PLEASE SELECT A VIDEO.'); return; }
    if (containsBannedWords(title) || containsBannedWords(content)) {
      setPublishError(getBannedWordError()); return;
    }

    setPublishing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setPublishError('FAILED TO POST — NOT LOGGED IN.'); return; }
      let mediaUrl: string | null = null;
      let mediaUrls: string[] = [];

      if (postType === 'image' && imageUris.length > 0) {
        const uploadedImageUrls: string[] = [];
        for (const [index, imageUri] of imageUris.entries()) {
          if (isLocalUri(imageUri)) {
            const isGif = imageUri.toLowerCase().endsWith('.gif');
            const rawExt = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
            const ext = rawExt === 'jpeg' ? 'jpg' : rawExt;
            const mimeType = isGif ? 'image/gif' : ext === 'png' ? 'image/png' : 'image/jpeg';
            const path = `${user.id}/${Date.now()}-${index}.${ext}`;
            const response = await fetch(imageUri);
            const arrayBuffer = await response.arrayBuffer();
            uploadedImageUrls.push(
              await uploadToFirstWorkingBucket(STORAGE_BUCKETS.image, path, arrayBuffer, mimeType)
            );
          } else {
            uploadedImageUrls.push(imageUri);
          }
        }
        mediaUrls = uploadedImageUrls;
        mediaUrl = uploadedImageUrls[0] ?? null;
      }

      if (postType === 'audio' && audioUri && isLocalUri(audioUri)) {
        const ext = audioUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'mp3';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const response = await fetch(audioUri);
        const arrayBuffer = await response.arrayBuffer();
        mediaUrl = await uploadToFirstWorkingBucket(STORAGE_BUCKETS.audio, path, arrayBuffer, `audio/${ext}`);
      } else if (postType === 'audio' && audioUri) {
        mediaUrl = audioUri;
      }

      if (postType === 'video' && videoUri && isLocalUri(videoUri)) {
        const rawExt = videoFileName?.split('.').pop()?.toLowerCase()
          ?? videoMimeType?.split('/').pop()?.toLowerCase()
          ?? videoUri.split('.').pop()?.split('?')[0]?.toLowerCase()
          ?? 'mp4';
        const ext = ['mp4', 'mov', 'avi', 'm4v'].includes(rawExt) ? rawExt : 'mp4';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const contentType = videoMimeType ?? VIDEO_CONTENT_TYPES[ext] ?? 'video/mp4';
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          throw new Error('MISSING AUTH TOKEN FOR VIDEO UPLOAD');
        }
        try {
          mediaUrl = await uploadLocalFileToFirstWorkingBucket(
            STORAGE_BUCKETS.video,
            path,
            videoUri,
            contentType,
            session.access_token
          );
        } catch (nativeUploadError: any) {
          const arrayBuffer = await localUriToArrayBuffer(videoUri);
          mediaUrl = await uploadToFirstWorkingBucket(
            STORAGE_BUCKETS.video,
            path,
            arrayBuffer,
            contentType
          );
        }
      } else if (postType === 'video' && videoUri) {
        mediaUrl = videoUri;
      }

      const normalizedTitle = title.trim() || null;
      const normalizedContent = postType === 'text' ? (textContent.trim() || null) : null;
      const postData = {
        content: normalizedContent,
        title: normalizedTitle,
        media_url: mediaUrl,
        media_urls: mediaUrls,
        collection_id: selectedCollectionId ?? null,
        char_count: postType === 'text' ? textContent.length : null,
        tags: selectedTag ? [selectedTag] : [],
      };

      let insertedPostId: string | null = null;

      if (isEditMode && editPost) {
        const { error } = await supabase.from('posts').update(postData).eq('id', editPost.id);
        if (error) {
          if ((mediaUrls?.length ?? 0) > 1) {
            setPublishError('MULTI-IMAGE POSTS NEED THE LATEST SUPABASE MIGRATION APPLIED.');
            return;
          }
          const { error: err2 } = await supabase.from('posts').update({
            content: normalizedContent,
            media_url: mediaUrl,
          }).eq('id', editPost.id);
          if (err2) { setPublishError(`FAILED TO SAVE — ${err2.message}`); return; }
        }
        insertedPostId = editPost.id;
      } else {
        const createPayload = {
          user_id: user.id,
          type: postType,
          ...postData,
          like_count: 0,
          comment_count: 0,
        };

        const { error } = await supabase.from('posts').insert(createPayload);

        if (error) {
          if ((mediaUrls?.length ?? 0) > 1) {
            setPublishError('MULTI-IMAGE POSTS NEED THE LATEST SUPABASE MIGRATION APPLIED.');
            return;
          }
          const { error: err2 } = await supabase.from('posts').insert({
            user_id: user.id,
            type: postType,
            title: normalizedTitle,
            content: normalizedContent,
            media_url: mediaUrl,
            media_urls: mediaUrls,
            tags: selectedTag ? [selectedTag] : [],
            like_count: 0,
            comment_count: 0,
          });
          if (err2) { setPublishError(`FAILED TO POST — ${err2.message}`); return; }
        }

        if (selectedCollectionId) {
          try {
            await supabase.rpc('increment_collection_count', { collection_id: selectedCollectionId });
          } catch { /* ignore */ }
        }

        if (selectedCollaborator) {
          const { data: latestPost } = await supabase
            .from('posts')
            .select('id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          insertedPostId = latestPost?.id ?? null;
        }
      }

      // Co-post: invite collaborator
      let coPostFailed = false;
      if (insertedPostId && selectedCollaborator) {
        const { error: collaboratorError } = await supabase.from('post_collaborators').insert({
          post_id: insertedPostId,
          collaborator_id: selectedCollaborator.id,
          accepted: false,
        });
        if (collaboratorError) {
          coPostFailed = true;
        } else {
          try {
            await supabase.from('notifications').insert({
              user_id: selectedCollaborator.id,
              type: 'co_post_invite',
              actor_id: user.id,
              reference_id: insertedPostId,
              reference_type: 'post',
              preview_text: 'TAP TO ACCEPT THIS CO-POST INVITE.',
              is_read: false,
            });
          } catch { /* ignore */ }
        }
      }

      if (coPostFailed) {
        Alert.alert(
          'POST PUBLISHED',
          'YOUR POST WENT LIVE, BUT THE CO-POST COULD NOT BE ADDED. MAKE SURE THE LATEST SUPABASE MIGRATION HAS BEEN APPLIED.'
        );
      }

      navigation.goBack();
    } catch (error: any) {
      setPublishError(`FAILED TO POST — ${(error?.message ?? 'TRY AGAIN').toUpperCase()}`);
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
          <TouchableOpacity
            onPress={handlePublish}
            disabled={publishing}
            activeOpacity={0.7}
            style={[styles.headerDoneBtn, publishing && { opacity: 0.4 }]}
          >
            <Text style={styles.headerDoneText}>{isEditMode ? 'SAVE' : 'DONE'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.typeSelector}>
          {(['image', 'video', 'text', 'audio'] as const).map((type) => (
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
              {imageUris.length > 0 ? (
                <View style={styles.multiImagePreview}>
                  {imageUris.map((uri, index) => (
                    <Image key={`${uri}-${index}`} source={{ uri }} style={styles.uploadedImageThumb} resizeMode="cover" />
                  ))}
                  <Text style={styles.multiImageHint}>
                    {imageUris.length}/4 IMAGES SELECTED — TAP TO CHANGE
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.uploadZonePlus}>+</Text>
                  <Text style={styles.uploadZoneLabel}>UPLOAD UP TO 4 IMAGES OR GIFS</Text>
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

          {/* Video upload */}
          {postType === 'video' && (
            <TouchableOpacity style={styles.uploadZone} onPress={handlePickVideo} activeOpacity={0.7}>
              {videoUri ? (
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <Text style={styles.audioPlayIcon}>▶</Text>
                  <Text style={styles.audioSelectedText}>VIDEO SELECTED — TAP TO CHANGE</Text>
                  <Text style={[styles.uploadZoneLabel, { color: '#9a9a9a' }]}>MAX 60 SECONDS</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.audioPlayIcon}>▶</Text>
                  <Text style={styles.uploadZoneLabel}>UPLOAD VIDEO (MAX 60 SECONDS)</Text>
                </>
              )}
            </TouchableOpacity>
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

          {/* Tag selector */}
          <View style={styles.fieldContainer}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>TAG</Text>
              <Text style={styles.fieldOptional}> (OPTIONAL · CHOOSE ONE)</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
              {TAGS.map((tag) => {
                const active = selectedTag === tag;
                return (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagPill, active && styles.tagPillActive]}
                    onPress={() => setSelectedTag(active ? null : tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.tagPillText, active && styles.tagPillTextActive]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Co-post: tag a collaborator */}
          {!isEditMode && (
            <View style={styles.fieldContainer}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>CO-POST WITH</Text>
                <Text style={styles.fieldOptional}> (OPTIONAL — TAG ANOTHER ARTIST)</Text>
              </View>
              {selectedCollaborator ? (
                <View style={styles.collabSelected}>
                  <Text style={styles.collabSelectedName}>
                    @{selectedCollaborator.username ?? selectedCollaborator.full_name ?? ''}
                  </Text>
                  <TouchableOpacity onPress={() => { setSelectedCollaborator(null); setCollaboratorQuery(''); }} activeOpacity={0.7}>
                    <Text style={styles.collabRemove}>× REMOVE</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TextInput
                    style={styles.fieldInput}
                    value={collaboratorQuery}
                    onChangeText={setCollaboratorQuery}
                    placeholder="SEARCH BY NAME OR @USERNAME..."
                    placeholderTextColor="#333333"
                    autoCapitalize="none"
                  />
                  {collaboratorSuggestions.length > 0 && (
                    <View style={styles.collabSuggestList}>
                      {collaboratorSuggestions.map(a => (
                        <TouchableOpacity
                          key={a.id}
                          style={styles.collabSuggestRow}
                          onPress={() => { setSelectedCollaborator(a); setCollaboratorQuery(''); setCollaboratorSuggestions([]); }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.collabSuggestName}>
                            {a.full_name ? a.full_name.toUpperCase() : ''}
                          </Text>
                          {a.username ? (
                            <Text style={styles.collabSuggestHandle}> @{a.username}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

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
  headerDoneBtn: { paddingHorizontal: 4, paddingVertical: 4 },
  headerDoneText: { color: GOLD, fontFamily: MONO, fontSize: 11, letterSpacing: 0.18 },

  typeSelector: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#111111' },
  typeTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  typeTabActive: { borderBottomWidth: 1, borderBottomColor: colors.white },
  typeTabText: { fontFamily: MONO, fontSize: 9, letterSpacing: 0.2, color: '#9a9a9a' },
  typeTabTextActive: { color: colors.white },

  scrollView: { flex: 1 },

  uploadZone: {
    height: 130, backgroundColor: '#0a0a0a', margin: 16,
    borderWidth: 1, borderColor: '#2a2a2a',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  uploadedImage: { width: '100%', height: '100%' },
  multiImagePreview: {
    width: '100%',
    height: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadedImageThumb: {
    width: '48%',
    aspectRatio: 1,
  },
  multiImageHint: {
    width: '100%',
    color: '#9a9a9a',
    fontFamily: MONO,
    fontSize: 9,
    letterSpacing: 0.12,
    textAlign: 'center',
    marginTop: 4,
  },
  uploadZonePlus: { color: '#2a2a2a', fontSize: 18 },
  uploadZoneLabel: { color: '#2a2a2a', fontFamily: MONO, fontSize: 6, marginTop: 6 },
  audioPlayIcon: { color: colors.red, fontSize: 18 },
  audioSelectedText: { color: '#2a7a4f', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1, paddingHorizontal: 12, textAlign: 'center' },

  textAreaContainer: { margin: 16 },
  textArea: {
    height: 120, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a',
    color: colors.white, fontFamily: MONO, fontSize: 11, padding: 12, letterSpacing: 0.1, textAlignVertical: 'top',
  },
  charCount: { color: '#9a9a9a', fontFamily: MONO, fontSize: 7, textAlign: 'right', marginTop: 4 },
  charCountWarn: { color: colors.red },

  fieldContainer: { marginHorizontal: 16, marginTop: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 },
  fieldLabel: { color: '#888888', fontFamily: MONO, fontSize: 8, letterSpacing: 0.18 },
  fieldRequired: { color: colors.red, fontFamily: MONO, fontSize: 8 },
  fieldOptional: { color: '#9a9a9a', fontFamily: MONO, fontSize: 7 },
  fieldInput: {
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
    color: colors.white, fontFamily: MONO, fontSize: 13, paddingVertical: 6,
  },

  collectionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingVertical: 8,
  },
  collectionBtnText: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collectionPlaceholder: { color: '#9a9a9a' },
  chevron: { color: '#9a9a9a', fontFamily: MONO, fontSize: 10 },

  disclaimer: {
    marginHorizontal: 16, marginTop: 20,
  },
  disclaimerText: {
    color: colors.red, fontFamily: MONO, fontSize: 7, letterSpacing: 0.08,
    textAlign: 'left', lineHeight: 13,
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
  collectionRowText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collectionRowActive: { color: colors.white },
  check: { color: colors.red, fontFamily: MONO, fontSize: 10 },
  doneBtn: { color: GOLD, fontFamily: MONO, fontSize: 9, letterSpacing: 0.18, marginLeft: 12 },

  // co-post
  collabSelected: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1, borderBottomColor: '#2a2a2a', paddingVertical: 8,
  },
  collabSelectedName: { color: colors.red, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collabRemove: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  collabSuggestList: {
    backgroundColor: '#0a0a0a', borderWidth: 1, borderTopWidth: 0, borderColor: '#2a2a2a',
  },
  collabSuggestRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#111111',
  },
  collabSuggestName: { color: colors.white, fontFamily: MONO, fontSize: 11, letterSpacing: 0.1 },
  collabSuggestHandle: { color: colors.red, fontFamily: MONO, fontSize: 10, letterSpacing: 0.1 },
  tagRow: { gap: 8, paddingVertical: 8 },
  tagPill: {
    borderWidth: 1, borderColor: '#2a2a2a',
    paddingHorizontal: 12, paddingVertical: 7,
  },
  tagPillActive: { borderColor: colors.red, backgroundColor: '#0f0000' },
  tagPillText: { color: '#9a9a9a', fontFamily: MONO, fontSize: 9, letterSpacing: 0.1 },
  tagPillTextActive: { color: colors.red },
});
