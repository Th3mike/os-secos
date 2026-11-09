import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://vgejfupypdtwbsbieehi.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Cdka5nFCcqQ3cytZsIVppg_TQS7Aui9'

export const isSupabaseConfigured = () => {
  return true
}

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY)
}
