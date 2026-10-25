import { createClient, createAdminClient } from './server'

export type SessionClient = Awaited<ReturnType<typeof createClient>>
export type DbClient = SessionClient | NonNullable<ReturnType<typeof createAdminClient>>

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Verifies the active Supabase user session in Server Actions and returns `{ supabase, user }`.
 * Throws `'Not authenticated'` if no valid user session is present.
 */
export async function requireAuthenticatedUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  return { supabase, user }
}
