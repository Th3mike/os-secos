import { createBrowserClient } from '@supabase/ssr'

const FALLBACK_URL = 'https://vgejfupypdtwbsbieehi.supabase.co'
const FALLBACK_PUBLISHABLE_KEY = 'sb_publishable_Cdka5nFCcqQ3cytZsIVppg_TQS7Aui9'

export const isSupabaseConfigured = () => {
  return true
}

export function createClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    FALLBACK_URL

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    FALLBACK_PUBLISHABLE_KEY

  return createBrowserClient(url, key)
}
