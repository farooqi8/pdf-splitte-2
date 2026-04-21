import { createBrowserClient } from '@supabase/ssr'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required`)
  }
  return value
}

export function createSupabaseBrowserClient() {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  return createBrowserClient(url, anonKey)
}

