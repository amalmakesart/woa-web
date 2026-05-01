import { createBrowserClient } from '@supabase/ssr'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/supabase/config'

type BrowserClient = ReturnType<typeof createBrowserClient>

declare global {
  var __woaSupabaseBrowserClient__: BrowserClient | undefined
}

export function createClient() {
  if (!globalThis.__woaSupabaseBrowserClient__) {
    globalThis.__woaSupabaseBrowserClient__ = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }

  return globalThis.__woaSupabaseBrowserClient__
}
