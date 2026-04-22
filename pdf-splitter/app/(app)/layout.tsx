import type { ReactNode } from 'react'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AUTH_COOKIE_NAME } from '@/lib/auth/session'

export default function AppLayout({ children }: { children: ReactNode }) {
  const authed = cookies().get(AUTH_COOKIE_NAME)?.value === '1'
  if (!authed) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-10 border-b bg-white/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-zinc-900 sm:text-lg"
          >
            PDF Splitter
          </Link>
          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Link
              href="/references"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              References
            </Link>
            <Link
              href="/process"
              className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              Process
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  )
}

