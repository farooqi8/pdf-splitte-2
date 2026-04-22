'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function RegeneratePdfsButton({ jobId }: { jobId: string }) {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  async function regenerate() {
    setStatus('loading')
    setMessage(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}/regenerate-pdfs`, {
        method: 'POST',
      })
      const data: unknown = await res.json().catch(() => null)
      const msg =
        typeof data === 'object' && data && 'message' in data
          ? String((data as { message?: unknown }).message)
          : null
      if (!res.ok) {
        setStatus('error')
        setMessage(msg || 'Failed to regenerate PDFs.')
        return
      }
      setStatus('done')
      setMessage('PDFs updated. Download again to get the latest layout.')
      router.refresh()
    } catch {
      setStatus('error')
      setMessage('Network error. Try again.')
    }
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
      <p className="text-zinc-700">
        If downloads still show an old table (e.g. extra columns), your files were generated before
        the latest report layout. Regenerate overwrites the stored PDFs for this job using current
        formatting—no need to re-upload the source PDF.
      </p>
      <button
        type="button"
        onClick={regenerate}
        disabled={status === 'loading'}
        className="mt-3 inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'loading' ? 'Regenerating…' : 'Regenerate PDFs for this job'}
      </button>
      {message ? (
        <p
          className={
            status === 'error' ? 'mt-2 text-red-700' : 'mt-2 text-emerald-800'
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
