import { NextResponse, type NextRequest } from 'next/server'

// Edge runtime safe: keep middleware dependency-free (no path aliases).
const AUTH_COOKIE_NAME = 'ps_auth' as const

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return true
  if (pathname.startsWith('/favicon.ico')) return true
  if (pathname.startsWith('/login')) return true
  if (pathname.startsWith('/api/login')) return true
  return false
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()

  const authed = req.cookies.get(AUTH_COOKIE_NAME)?.value === '1'
  if (authed) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}

