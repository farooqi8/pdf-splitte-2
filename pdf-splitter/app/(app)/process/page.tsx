'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { ParsedRow, RawTotals } from '@/types'

const formSchema = z.object({
  file: z
    .custom<FileList>((v) => v instanceof FileList, {
      message: 'Please select a PDF file',
    })
    .refine((fl) => fl.length > 0, 'Please select a PDF file')
    .transform((fl) => fl.item(0))
    .refine((f): f is File => f instanceof File, 'Please select a PDF file')
    .refine((f) => f.size > 0, 'Please select a PDF file')
    .refine((f) => /\.pdf$/i.test(f.name), 'File must be a PDF'),
})

type FormValues = z.infer<typeof formSchema>
type FormInput = z.input<typeof formSchema>

type DebugResponse =
  | {
      success: true
      lines: string[]
      parsedPreview: ParsedRow[]
      rawTotals: RawTotals
    }
  | { success: false; message: string }

type ProcessResponse =
  | { success: true; jobId: string }
  | { success: false; message: string; verification?: unknown }

export default function ProcessPage() {
  const router = useRouter()
  const [preview, setPreview] = useState<DebugResponse | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [runLoading, setRunLoading] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
  })

  const selectedFile = watch('file')
  const fileName = useMemo(() => {
    const f = selectedFile?.item?.(0)
    return f?.name ?? null
  }, [selectedFile])

  async function loadPreview(file: File) {
    setPreviewLoading(true)
    setPreview(null)
    try {
      const fd = new FormData()
      fd.set('file', file)
      const res = await fetch('/api/debug-pdf-lines', { method: 'POST', body: fd })
      const data: unknown = await res.json()
      setPreview(data as DebugResponse)
    } catch {
      setPreview({ success: false, message: 'Failed to extract preview. Try again.' })
    } finally {
      setPreviewLoading(false)
    }
  }

  async function onSubmit(values: FormValues) {
    setRunLoading(true)
    setRunError(null)
    try {
      const fd = new FormData()
      fd.set('file', values.file)
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
        <h1 className="text-2xl font-bold tracking-tight">Process New PDF</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Upload the station PDF, preview extracted rows, then run the split.
        </p>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-800">
              Upload Station PDF
            </label>
            <input
              type="file"
              accept="application/pdf"
              className="mt-2 block w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
              {...register('file')}
              onChange={(e) => {
                register('file').onChange(e)
                const f = e.target.files?.item(0)
                if (f) void loadPreview(f)
              }}
            />
            {errors.file ? (
              <p className="mt-2 text-sm text-red-600">{errors.file.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={runLoading || previewLoading}
              className="inline-flex w-full items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {runLoading ? 'Processing…' : 'Run Split'}
            </button>
            <button
              type="button"
              disabled={previewLoading || !selectedFile?.item?.(0)}
              onClick={() => {
                const f = selectedFile?.item?.(0)
                if (f) void loadPreview(f)
              }}
              className="inline-flex w-full items-center justify-center rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {previewLoading ? 'Extracting…' : 'Refresh Preview'}
            </button>
          </div>
        </form>

        {runError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            {runError}
          </div>
        ) : null}

        {fileName ? (
          <p className="text-xs text-zinc-600">Selected: {fileName}</p>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
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
                <div className="overflow-x-auto rounded-lg border">
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
                      {preview.parsedPreview.map((r) => (
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
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                {preview.message}
              </div>
            )
          ) : (
            <div className="text-sm text-zinc-600">
              Upload a PDF to see preview.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

