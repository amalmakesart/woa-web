import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { sendWelcomeExperience } from './welcome';

type SignupRole = 'ARTIST' | 'GIG_POSTER' | 'COLLECTIVE' | 'ART_LOVER';

interface PendingSignupDraft {
  userId: string;
  role: SignupRole;
  photoUri: string | null;
}

const PENDING_SIGNUP_KEY = '@woa_pending_signup';
const PENDING_PHOTO_PREFIX = 'pending-signup-photo-';

async function getLegacyFileSystem() {
  return import('expo-file-system/legacy');
}

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeCity(value: unknown) {
  const city = readString(value).toUpperCase();
  return city || '';
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => readString(item)).filter(Boolean) : [];
}

async function readPendingSignupDraft() {
  const raw = await AsyncStorage.getItem(PENDING_SIGNUP_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as PendingSignupDraft;
    if (!parsed?.userId || !parsed?.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function getPendingPhotoPath(ext: string) {
  const FileSystem = await getLegacyFileSystem();
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) return null;
  return `${baseDir}${PENDING_PHOTO_PREFIX}${Date.now()}.${ext}`;
}

async function persistPendingProfilePhoto(photoUri: string | null) {
  if (!photoUri) return null;

  const rawExt = photoUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const normalizedExt = rawExt === 'jpeg' ? 'jpg' : rawExt;
  const ext = normalizedExt && /^[a-z0-9]+$/.test(normalizedExt) ? normalizedExt : 'jpg';
  const destination = await getPendingPhotoPath(ext);

  if (!destination) return photoUri;

  try {
    const FileSystem = await getLegacyFileSystem();
    await FileSystem.copyAsync({ from: photoUri, to: destination });
    return destination;
  } catch {
    return photoUri;
  }
}

async function deletePendingProfilePhoto(photoUri: string | null | undefined) {
  if (!photoUri || !photoUri.includes(PENDING_PHOTO_PREFIX)) return;

  try {
    const FileSystem = await getLegacyFileSystem();
    await FileSystem.deleteAsync(photoUri, { idempotent: true });
  } catch {
    // Ignore cleanup failures; they should never block sign-in.
  }
}

export async function savePendingSignupDraft(draft: PendingSignupDraft) {
  const existingDraft = await readPendingSignupDraft();
  if (existingDraft?.photoUri && existingDraft.photoUri !== draft.photoUri) {
    await deletePendingProfilePhoto(existingDraft.photoUri);
  }

  const persistedPhotoUri = await persistPendingProfilePhoto(draft.photoUri);
  await AsyncStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
    ...draft,
    photoUri: persistedPhotoUri,
  }));
}

export async function clearPendingSignupDraft() {
  const draft = await readPendingSignupDraft();
  await AsyncStorage.removeItem(PENDING_SIGNUP_KEY);
  await deletePendingProfilePhoto(draft?.photoUri);
}

async function uploadPendingProfilePhoto(userId: string, photoUri: string) {
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
}

export async function completePendingSignupExperience() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const pendingDraft = await readPendingSignupDraft();
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, username, full_name, profile_photo_url, bio, discipline, art_types, country, city, experience, instagram, facebook, website, spotify_url, is_available, collective_type, member_count')
    .eq('id', user.id)
    .maybeSingle();

  const updateData: Record<string, unknown> = { id: user.id };

  const metadataUsername = readString(metadata.username);
  if (!readString(profile?.username) && metadataUsername) {
    updateData.username = metadataUsername.toLowerCase();
  }

  const metadataFullName = readString(metadata.full_name);
  if (!readString(profile?.full_name) && metadataFullName) {
    updateData.full_name = metadataFullName;
  }

  const metadataRole = readString(metadata.role).toUpperCase();
  const resolvedRole = (readString(profile?.role) || metadataRole || 'ARTIST').toUpperCase() as SignupRole;
  if (!readString(profile?.role) && metadataRole) {
    updateData.role = metadataRole;
  }

  const metadataBio = readString(metadata.bio);
  if (!readString(profile?.bio) && metadataBio) {
    updateData.bio = metadataBio;
  }

  const metadataCountry = readString(metadata.country);
  if (!readString(profile?.country) && metadataCountry) {
    updateData.country = metadataCountry;
  }

  const metadataCity = normalizeCity(metadata.city);
  if (!readString(profile?.city) && metadataCity) {
    updateData.city = metadataCity;
  }

  if (resolvedRole === 'ARTIST') {
    const metadataDiscipline = readString(metadata.discipline);
    if (!readString(profile?.discipline) && metadataDiscipline) {
      updateData.discipline = metadataDiscipline;
    }

    const metadataArtTypes = readStringArray(metadata.art_types);
    if ((!Array.isArray(profile?.art_types) || profile.art_types.length === 0) && metadataArtTypes.length > 0) {
      updateData.art_types = metadataArtTypes;
    }

    const metadataExperience = readString(metadata.experience);
    if (!readString(profile?.experience) && metadataExperience) {
      updateData.experience = metadataExperience;
    }

    const metadataSpotify = readString(metadata.spotify_url);
    if (!readString(profile?.spotify_url) && metadataSpotify) {
      updateData.spotify_url = metadataSpotify;
    }

    if (typeof profile?.is_available !== 'boolean' && typeof metadata.is_available === 'boolean') {
      updateData.is_available = metadata.is_available;
    }
  }

  if (resolvedRole === 'COLLECTIVE') {
    const metadataCollectiveType = readString(metadata.collective_type);
    if (!readString(profile?.collective_type) && metadataCollectiveType) {
      updateData.collective_type = metadataCollectiveType;
    }

    const metadataMemberCount = readString(metadata.member_count);
    if ((profile?.member_count == null) && metadataMemberCount) {
      const parsed = parseInt(metadataMemberCount, 10);
      if (!Number.isNaN(parsed)) {
        updateData.member_count = parsed;
      }
    }
  }

  const metadataInstagram = readString(metadata.instagram);
  if (!readString(profile?.instagram) && metadataInstagram) {
    updateData.instagram = metadataInstagram;
  }

  const metadataFacebook = readString(metadata.facebook);
  if (!readString(profile?.facebook) && metadataFacebook) {
    updateData.facebook = metadataFacebook;
  }

  const metadataWebsite = readString(metadata.website);
  if (!readString(profile?.website) && metadataWebsite) {
    updateData.website = metadataWebsite;
  }

  if (!readString(profile?.profile_photo_url) && pendingDraft?.userId === user.id && pendingDraft.photoUri) {
    const photoUrl = await uploadPendingProfilePhoto(user.id, pendingDraft.photoUri).catch(() => null);
    if (photoUrl) {
      updateData.profile_photo_url = photoUrl;
    }
  }

  if (Object.keys(updateData).length > 1) {
    await supabase.from('profiles').upsert(updateData);
  }

  await sendWelcomeExperience(user.id, resolvedRole);

  if (pendingDraft?.userId === user.id) {
    await clearPendingSignupDraft();
  }
}
