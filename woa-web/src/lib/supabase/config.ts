const FALLBACK_SUPABASE_URL = 'https://tehkoxslqtgofivlcdyk.supabase.co'
const FALLBACK_SUPABASE_ANON_KEY = 'sb_publishable_lwgQsrT4prd3upPoGGu7QA_csHmVUnt'

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY
