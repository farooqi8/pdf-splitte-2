import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export function createSupabaseServerClient() {
  const cookieStore = cookies()

  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

export function requiredServiceRoleKey(): string {
  return requiredEnv('SUPABASE_SERVICE_ROLE_KEY')
}

export function createSupabaseAdminClient(): SupabaseClient {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requiredServiceRoleKey()
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  })
}

