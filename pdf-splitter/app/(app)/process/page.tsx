'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ParsedRow, RawTotals } from '@/types'

type DebugResponse =
  | {
      success: true
      lines: string[]
      parsedPreview: ParsedRow[]
      rawTotals: RawTotals
      debug?: unknown
    }
  | { success: false; message: string; debug?: unknown }

type ProcessResponse =
  | { success: true; jobId: string }
  | { success: false; message: string; verification?: unknown }

const FILE_INPUT_ID = 'process-station-pdf'

export default function ProcessPage() {
  const router = useRouter()
  const previewIdRef = useRef(0)
  const previewAbortRef = useRef<AbortController | null>(null)

  /** One source of truth — must be useState (triggers re-render) so “Run” enables after pick. */
  const [staged, setStaged] = useState<File | null>(null)

  const [preview, setPreview] = useState<DebugResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [runLoading, setRunLoading] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [fileHint, setFileHint] = useState<string | null>(null)

  function isPdfFile(f: File): boolean {
    const n = f.name.toLowerCase()
    if (n.endsWith('.pdf')) return true
    return f.type === 'application/pdf' || f.type === 'application/x-pdf'
  }

  async function loadPreview(f: File) {
    setStaged(f)
    previewAbortRef.current?.abort()
    const ac = new AbortController()
    previewAbortRef.current = ac
    const id = ++previewIdRef.current

    setPreviewLoading(true)
    setPreview(null)
    setFileHint(null)
    setRunError(null)
    try {
      const fd = new FormData()
      fd.set('file', f)
      const res = await fetch('/api/debug-pdf-lines', {
        method: 'POST',
        body: fd,
        signal: ac.signal,
      })
      if (id !== previewIdRef.current) return

      const data: unknown = await res.json().catch(() => null)
      if (id !== previewIdRef.current) return

      if (data == null) {
        setPreview({
          success: false,
          message: `Server returned a non-JSON response (HTTP ${res.status}).`,
        })
        return
      }
      setPreview(data as DebugResponse)
      setStaged(f)
    } catch (e: unknown) {
      if (id !== previewIdRef.current) return
      if (e instanceof DOMException && e.name === 'AbortError') return
      if (e instanceof Error && e.name === 'AbortError') return
      const msg =
        e instanceof Error
          ? e.message
          : 'Could not reach the server. Check that the app is running, then try again.'
      setPreview({ success: false, message: msg })
    } finally {
      if (id === previewIdRef.current) {
        setPreviewLoading(false)
      }
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.item(0) ?? null
    setRunError(null)
    if (f) {
      if (!isPdfFile(f)) {
        setFileHint('Please use a .pdf file.')
        setStaged(null)
        e.target.value = ''
        setPreview(null)
        return
      }
      setFileHint(null)
      setStaged(f)
      void loadPreview(f)
    } else {
      setStaged(null)
      setPreview(null)
    }
  }

  async function runSplit() {
    if (!staged) {
      setRunError('Pick a PDF with “Choose file”, wait for the preview, then use Run split.')
      return
    }
    setRunLoading(true)
    setRunError(null)
    try {
      const fd = new FormData()
      fd.set('file', staged)
      const res = await fetch('/api/process-pdf', { method: 'POST', body: fd })
      const data: unknown = await res.json()
      const parsed = data as ProcessResponse
      if (!res.ok || !parsed.success) {
        setRunError(
          'message' in parsed && typeof parsed.message === 'string'
            ? parsed.message
            : 'Processing failed.',
        )
        return
      }
      router.push(`/results/${parsed.jobId}`)
    } catch {
      setRunError('Processing failed. Please try again.')
    } finally {
      setRunLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Process New PDF</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Upload the station PDF, preview extracted rows, then run the split.
        </p>
      </div>

      <section className="space-y-4 rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <div>
          <label className="block text-sm font-medium text-zinc-800" htmlFor={FILE_INPUT_ID}>
            Upload Station PDF
          </label>
          <input
            id={FILE_INPUT_ID}
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFileChange}
            className="mt-2 block w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm"
          />
          {staged ? (
            <p className="mt-1 text-sm font-medium text-zinc-800">Ready: {staged.name}</p>
          ) : null}
          {fileHint ? <p className="mt-2 text-sm text-amber-700">{fileHint}</p> : null}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            disabled={runLoading || previewLoading || !staged}
            onClick={() => void runSplit()}
            className="inline-flex w-full items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runLoading ? 'Processing…' : 'Run Split'}
          </button>
          <button
            type="button"
            disabled={previewLoading || !staged}
            onClick={() => {
              if (staged) void loadPreview(staged)
            }}
            className="inline-flex w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {previewLoading ? 'Extracting…' : 'Refresh Preview'}
          </button>
        </div>

        {runError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {runError}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold text-zinc-900">Extracted Preview</h2>
        <p className="mt-1 text-xs text-zinc-600">
          Shows the first 5 extracted rows to confirm parsing is correct.
        </p>

        <div className="mt-3">
          {previewLoading ? (
            <div className="text-sm text-zinc-700">Extracting rows…</div>
          ) : preview ? (
            preview.success ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                  Rows: {preview.rawTotals.total_rows} | Responses:{' '}
                  {preview.rawTotals.total_responses} | Price:{' '}
                  {preview.rawTotals.total_price}
                </div>
                <div className="-mx-1 overflow-x-auto overscroll-x-contain rounded-lg border sm:mx-0">
                  <table className="min-w-[32rem] w-full text-left text-xs sm:min-w-0">
                    <thead className="bg-zinc-50 text-zinc-700">
                      <tr>
                        <th className="whitespace-nowrap px-3 py-2">#</th>
                        <th className="whitespace-nowrap px-3 py-2">Permit</th>
                        <th className="min-w-[8rem] px-3 py-2">Station (raw)</th>
                        <th className="whitespace-nowrap px-3 py-2">Responses</th>
                        <th className="whitespace-nowrap px-3 py-2">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.parsedPreview.map((r) => (
                        <tr key={r.row_index} className="border-t">
                          <td className="px-3 py-2">{r.row_index}</td>
                          <td className="px-3 py-2 font-mono text-[11px]">{r.raw_permit}</td>
                          <td className="max-w-[12rem] truncate px-3 py-2 sm:max-w-none sm:whitespace-normal">
                            {r.station}
                          </td>
                          <td className="px-3 py-2">{r.responses}</td>
                          <td className="px-3 py-2">{r.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                <div className="font-semibold">Preview failed</div>
                <div className="mt-1">{preview.message}</div>
                {'debug' in preview && preview.debug ? (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-red-200 bg-white/60 p-2 text-xs text-red-950">
                    {JSON.stringify(preview.debug, null, 2)}
                  </pre>
                ) : null}
              </div>
            )
          ) : (
            <div className="text-sm text-zinc-600">Upload a PDF to see preview.</div>
          )}
        </div>
      </section>
    </div>
  )
}
