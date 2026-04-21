import type { ReactNode } from 'react'
import Link from 'next/link'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            PDF Splitter
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium text-zinc-700">
            <Link href="/references" className="hover:text-zinc-950">
              References
            </Link>
            <Link href="/process" className="hover:text-zinc-950">
              Process
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}

