import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME } from '@/lib/auth/session'

export const runtime = 'nodejs'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return res
}

