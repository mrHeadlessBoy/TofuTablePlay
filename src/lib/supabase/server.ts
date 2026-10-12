import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { connection } from 'next/server'

const SIX_HOURS_IN_SECONDS = 6 * 60 * 60 // 21,600 seconds (6 hours)

export async function createClient() {
  // Supabase auth uses Date.now() internally (e.g. session expiry checks).
  // connection() tells Next.js the rest only runs at request time, so those
  // calls aren't flagged as unstable values during (partial) prerendering.
  await connection()
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: SIX_HOURS_IN_SECONDS,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                maxAge: SIX_HOURS_IN_SECONDS,
              })
            )
          } catch {
            // Handled in Next.js Server Components / Middleware
          }
        },
      },
    }
  )
}

export function createAdminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}