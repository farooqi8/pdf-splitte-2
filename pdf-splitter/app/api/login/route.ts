import { NextResponse } from 'next/server'
import { AUTH_COOKIE_NAME, getAuthCookieValue } from '@/lib/auth/session'

export const runtime = 'nodejs'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json()
    const password =
      typeof body === 'object' && body && 'password' in body
        ? String((body as { password?: unknown }).password ?? '')
        : ''

    if (!password) {
      return NextResponse.json(
        { success: false, message: 'Password is required.' },
        { status: 400 },
      )
    }

    const expected = requiredEnv('APP_PASSWORD')
    if (password !== expected) {
      return NextResponse.json(
        { success: false, message: 'Wrong password.' },
        { status: 401 },
      )
    }

    const res = NextResponse.json({ success: true })
    res.cookies.set(AUTH_COOKIE_NAME, getAuthCookieValue(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })
    return res
  } catch {
    return NextResponse.json(
      { success: false, message: 'Login failed. Please try again.' },
      { status: 500 },
    )
  }
}

