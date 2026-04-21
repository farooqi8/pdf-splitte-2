'use client'

import { useState } from 'react'
import type { ParsedRow, RawTotals } from '@/types'

type DebugResponse =
  | {
      success: true
      lines: string[]
      parsedPreview: ParsedRow[]
      rawTotals: RawTotals
    }
  | { success: false; message: string }

export default function DebugPdfPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DebugResponse | null>(null)

  async function run() {
    if (!file) {
      setResult({ success: false, message: 'Please select a PDF file.' })
      return
    }

    setLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch('/api/debug-pdf-lines', { method: 'POST', body: fd })
      const data: unknown = await res.json()
      if (!res.ok) {
        const message =
          typeof data === 'object' && data && 'message' in data
            ? String((data as { message?: unknown }).message ?? 'Failed.')
            : 'Failed.'
        setResult({ success: false, message })
        return
      }
      setResult(data as DebugResponse)
    } catch {
      setResult({ success: false, message: 'Failed. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Debug PDF Parsing</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Select a station PDF and click “Parse PDF”. This shows a preview of parsed rows and totals.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.item(0) ?? null)}
          className="block w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="inline-flex w-full items-center justify-center rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Parsing…' : 'Parse PDF'}
        </button>

        {result ? (
          result.success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Parsed OK. Rows: {result.rawTotals.total_rows}, Responses: {result.rawTotals.total_responses}, Price:{' '}
              {result.rawTotals.total_price}
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {result.message}
            </div>
          )
        ) : null}
      </div>

      {result?.success ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Parsed preview (first 5 rows)</h2>
            <div className="mt-3 overflow-x-auto rounded-lg border">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-700">
                  <tr>
                    <th className="px-3 py-2">#</th>
                    <th className="px-3 py-2">Permit</th>
                    <th className="px-3 py-2">Station (raw)</th>
                    <th className="px-3 py-2">Responses</th>
                    <th className="px-3 py-2">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {result.parsedPreview.map((r) => (
                    <tr key={r.row_index} className="border-t">
                      <td className="px-3 py-2">{r.row_index}</td>
                      <td className="px-3 py-2 font-mono">{r.raw_permit}</td>
                      <td className="px-3 py-2">{r.station}</td>
                      <td className="px-3 py-2">{r.responses}</td>
                      <td className="px-3 py-2">{r.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Raw extracted lines (first 40)</h2>
            <pre className="mt-3 max-h-[420px] overflow-auto rounded-lg border bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-800">
              {result.lines.slice(0, 40).join('\n')}
            </pre>
          </section>
        </div>
      ) : null}
    </div>
  )
}

