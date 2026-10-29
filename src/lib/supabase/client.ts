import { createBrowserClient } from '@supabase/ssr'

const SIX_HOURS_IN_SECONDS = 6 * 60 * 60 // 21,600 seconds (6 hours)

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: SIX_HOURS_IN_SECONDS,
      },
    }
  )
}
