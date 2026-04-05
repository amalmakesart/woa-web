import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const supabaseUrl =
  (Constants.expoConfig?.extra?.supabaseUrl as string) ||
  'https://tehkoxslqtgofivlcdyk.supabase.co';

const supabaseAnonKey =
  (Constants.expoConfig?.extra?.supabaseAnonKey as string) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlaGtveHNscXRnb2ZpdmxjZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxODc1MTAsImV4cCI6MjA5MDc2MzUxMH0.QcPHGGF4HRzKWCv0CgEg2qh7vcbEsLLJd4Xh7LIYE4Y';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
