import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const FALLBACK_SUPABASE_URL = 'https://tehkoxslqtgofivlcdyk.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_lwgQsrT4prd3upPoGGu7QA_csHmVUnt';

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

const supabaseUrl =
  readString(Constants.expoConfig?.extra?.supabaseUrl) ||
  readString(process.env.EXPO_PUBLIC_SUPABASE_URL) ||
  FALLBACK_SUPABASE_URL;

const supabaseAnonKey =
  readString(Constants.expoConfig?.extra?.supabaseAnonKey) ||
  readString(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) ||
  FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export function isInvalidRefreshTokenError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return message.toLowerCase().includes('invalid refresh token');
}

export async function clearLocalSupabaseSession() {
  try {
    await supabase.auth.signOut({ scope: 'local' as any });
  } catch {
    // If signOut itself fails, remove any persisted Supabase auth payloads manually.
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys);
    }
  }
}
