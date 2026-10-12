import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SIX_HOURS_IN_SECONDS = 6 * 60 * 60 // 21,600 seconds (6 hours)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/hub'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const redirectResponse = NextResponse.redirect(`${origin}${next}`)
      redirectResponse.cookies.set('dnd_session_start', Date.now().toString(), {
        path: '/',
        maxAge: SIX_HOURS_IN_SECONDS,
        httpOnly: true,
        sameSite: 'lax',
      })
      return redirectResponse
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth-failed`)
}