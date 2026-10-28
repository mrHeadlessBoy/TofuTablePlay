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

export async function resolveUserDisplayName(
  userId: string | null | undefined,
  currentUserId?: string | null
): Promise<string> {
  if (!userId) return 'ผู้สร้างแคมเปญ'
  if (currentUserId && userId === currentUserId) return 'คุณ (You)'

  try {
    const admin = createAdminClient()
    if (admin) {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (!error && data?.user) {
        const u = data.user
        const meta = u.user_metadata || {}
        const name = meta.display_name || meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : null)
        if (name) return name
      }
    }
  } catch {
    // Admin API not reachable or service key not configured
  }

  return `User (${userId.slice(0, 6)})`
}

export async function resolveMultipleUserDisplayNames(
  userIds: (string | null | undefined)[],
  currentUserId?: string | null
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const validIds = Array.from(new Set(userIds.filter((id): id is string => !!id)))

  if (currentUserId) {
    map.set(currentUserId, 'คุณ (You)')
  }

  const idsToFetch = validIds.filter((id) => id !== currentUserId)
  if (idsToFetch.length === 0) return map

  const admin = createAdminClient()
  if (!admin) {
    for (const id of idsToFetch) {
      map.set(id, `User (${id.slice(0, 6)})`)
    }
    return map
  }

  await Promise.all(
    idsToFetch.map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id)
        if (!error && data?.user) {
          const u = data.user
          const meta = u.user_metadata || {}
          const name = meta.display_name || meta.full_name || meta.name || (u.email ? u.email.split('@')[0] : null)
          if (name) {
            map.set(id, name)
            return
          }
        }
      } catch {
        // Fallback below
      }
      map.set(id, `User (${id.slice(0, 6)})`)
    })
  )

  return map
}
