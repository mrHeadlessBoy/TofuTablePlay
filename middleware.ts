import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const SIX_HOURS_IN_SECONDS = 6 * 60 * 60 // 21,600 seconds (6 hours)
const SIX_HOURS_IN_MS = SIX_HOURS_IN_SECONDS * 1000
const SESSION_START_COOKIE = 'dnd_session_start'

// Pages that need a signed-in user
const PROTECTED_PREFIXES = ['/characters', '/campaigns', '/table', '/hub', '/board']

const SESSION_START_COOKIE_OPTIONS = {
  path: '/',
  maxAge: SIX_HOURS_IN_SECONDS,
  httpOnly: true,
  sameSite: 'lax',
} as const

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        maxAge: SIX_HOURS_IN_SECONDS,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: SIX_HOURS_IN_SECONDS,
            })
          )
        },
      },
    }
  )

  // IMPORTANT: Use getUser() instead of getSession() to securely validate the token with Supabase
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname, search } = request.nextUrl
  const isProtected = PROTECTED_PREFIXES.some((path) => pathname.startsWith(path))
  const nextPath = `${pathname}${search}`

  if (user) {
    // 6-hour session expiration enforcement
    if (isSessionExpired(request, user, supabaseResponse)) {
      await supabase.auth.signOut()
      return redirectToLogin(request, supabaseResponse, {
        reason: 'session-expired',
        nextPath: isProtected && nextPath !== '/hub' ? nextPath : null,
        clearSessionCookie: true,
      })
    }
  } else if (request.cookies.get(SESSION_START_COOKIE)) {
    // If no authenticated user, ensure session cookie is cleared
    supabaseResponse.cookies.set(SESSION_START_COOKIE, '', { path: '/', maxAge: 0 })
  }

  if (!user && isProtected) {
    return redirectToLogin(request, supabaseResponse, {
      nextPath: nextPath && nextPath !== '/hub' ? nextPath : null,
    })
  }

  // If user is already logged in and visits /login, send them to next or /hub
  if (user && pathname === '/login') {
    const nextParam = request.nextUrl.searchParams.get('next')
    const targetPath =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/hub'
    return NextResponse.redirect(new URL(targetPath, request.url))
  }

  return supabaseResponse
}

// True once the session is older than 6 hours (from our own start cookie, else Supabase's last sign-in).
// Stamps the start cookie on `response` when it is missing and the session is still valid.
function isSessionExpired(
  request: NextRequest,
  user: { last_sign_in_at?: string },
  response: NextResponse
): boolean {
  const sessionStartStr = request.cookies.get(SESSION_START_COOKIE)?.value

  if (sessionStartStr) {
    const sessionStart = parseInt(sessionStartStr, 10)
    return isNaN(sessionStart) || Date.now() - sessionStart > SIX_HOURS_IN_MS
  }

  if (user.last_sign_in_at) {
    const lastSignIn = new Date(user.last_sign_in_at).getTime()
    if (!isNaN(lastSignIn) && Date.now() - lastSignIn > SIX_HOURS_IN_MS) {
      return true
    }
    // Stamp session start time cookie if not already set
    response.cookies.set(
      SESSION_START_COOKIE,
      (lastSignIn || Date.now()).toString(),
      SESSION_START_COOKIE_OPTIONS
    )
    return false
  }

  response.cookies.set(SESSION_START_COOKIE, Date.now().toString(), SESSION_START_COOKIE_OPTIONS)
  return false
}

// Redirect to /login while transferring any refreshed Supabase cookies
function redirectToLogin(
  request: NextRequest,
  supabaseResponse: NextResponse,
  options: { nextPath: string | null; reason?: string; clearSessionCookie?: boolean }
): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  if (options.reason) url.searchParams.set('reason', options.reason)
  if (options.nextPath) url.searchParams.set('next', options.nextPath)

  const redirectResponse = NextResponse.redirect(url)
  if (options.clearSessionCookie) {
    redirectResponse.cookies.set(SESSION_START_COOKIE, '', { path: '/', maxAge: 0 })
  }
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value)
  })
  return redirectResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
