import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supabase auth cookies expire 6 hours after they were last refreshed, so an idle session ends after 6 hours
const SIX_HOURS_IN_SECONDS = 6 * 60 * 60 // 21,600 seconds (6 hours)

// Pages that need a signed-in user
const PROTECTED_PREFIXES = ['/characters', '/campaigns', '/table', '/hub', '/board']

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

  if (!user && isProtected) {
    const nextPath = `${pathname}${search}`
    return redirectToLogin(request, supabaseResponse, nextPath !== '/hub' ? nextPath : null)
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

// Redirect to /login (keeping where the user was headed) while transferring any refreshed Supabase cookies
function redirectToLogin(
  request: NextRequest,
  supabaseResponse: NextResponse,
  nextPath: string | null
): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  if (nextPath) url.searchParams.set('next', nextPath)

  const redirectResponse = NextResponse.redirect(url)
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
