import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = 'https://vgejfupypdtwbsbieehi.supabase.co'
const SUPABASE_KEY = 'sb_publishable_Cdka5nFCcqQ3cytZsIVppg_TQS7Aui9'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Ignore Server Component cookie writes
        }
      },
    },
  })
}
