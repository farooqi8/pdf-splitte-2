import { Suspense } from 'react'
import { LoginForm } from './LoginForm.client'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-700">Loading…</div>}>
      <LoginForm />
    </Suspense>
  )
}

