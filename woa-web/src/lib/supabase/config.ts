const FALLBACK_SUPABASE_URL = 'https://tehkoxslqtgofivlcdyk.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_lwgQsrT4prd3upPoGGu7QA_csHmVUnt'

function readEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  return process.env[name]?.trim()
}

// These are public values, so we keep a stable baked-in fallback for hosting
// providers that fail to expose NEXT_PUBLIC_* vars consistently at build/runtime.
export const SUPABASE_URL =
  readEnv('NEXT_PUBLIC_SUPABASE_URL') || FALLBACK_SUPABASE_URL

export const SUPABASE_ANON_KEY =
  readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || FALLBACK_SUPABASE_ANON_KEY

export const publicSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
} as const
