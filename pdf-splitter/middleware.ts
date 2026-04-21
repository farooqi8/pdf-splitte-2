import { NextResponse, type NextRequest } from 'next/server'

// Edge runtime safe: keep middleware dependency-free (no path aliases).
const AUTH_COOKIE_NAME = 'ps_auth' as const

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true
  if (pathname === '/favicon.ico') return true
  if (pathname === '/favicon.png') return true
  if (pathname === '/robots.txt') return true
  if (pathname === '/sitemap.xml') return true
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/api/login')) return true
  if (pathname.startsWith('/api/logout')) return true
  return false
}

export function middleware(req: NextRequest) {
  try {
    const { pathname } = req.nextUrl
    if (isPublicPath(pathname)) return NextResponse.next()

    const authed = req.cookies.get(AUTH_COOKIE_NAME)?.value === '1'
    if (authed) return NextResponse.next()

    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  } catch (e) {
    // Never block the app due to middleware crash in production.
    const message = e instanceof Error ? e.message : 'middleware_error'
    const res = NextResponse.next()
    res.headers.set('x-middleware-error', message.slice(0, 200))
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}

