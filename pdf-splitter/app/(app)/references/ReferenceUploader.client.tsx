'use client'

import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Owner, ReferenceRow } from '../../../types'

const formSchema = z.object({
  file: z
    .custom<FileList>((v) => v instanceof FileList, {
      message: 'Please select a file',
    })
    .refine((fl) => fl.length > 0, 'Please select a file')
    .transform((fl) => fl.item(0))
    .refine((f): f is File => f instanceof File, 'Please select a file')
    .refine((f) => f.size > 0, 'Please select a file')
    .refine(
      (f) => /\.(xlsx|xls)$/i.test(f.name),
      'File must be an Excel file (.xlsx or .xls)',
    ),
})

type FormValues = z.infer<typeof formSchema>
type FormInput = z.input<typeof formSchema>

type UploadResponse =
  | {
      success: true
      rowCount: number
      preview: ReferenceRow[]
    }
  | {
      success: false
      message: string
    }

function ownerLabel(owner: Owner): string {
  return owner === 'saad' ? 'Saad Al-Shahri Excel' : 'Moasasat Gorman Excel'
}

export function ReferenceUploader({
  owner,
  current,
}: {
  owner: Owner
  current: { uploadedAt: string | null; rowCount: number } | null
}) {
  const [result, setResult] = useState<UploadResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(formSchema),
  })

  const uploadedLabel = useMemo(() => {
    if (!current?.uploadedAt) return 'Not uploaded yet'
    const d = new Date(current.uploadedAt)
    return `Uploaded: ${d.toLocaleString()} (rows: ${current.rowCount})`
  }, [current?.rowCount, current?.uploadedAt])

  async function onSubmit(values: FormValues) {
    setIsLoading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.set('file', values.file)
      fd.set('owner', owner)

      const res = await fetch('/api/upload-reference', {
        method: 'POST',
        body: fd,
      })

      const data: unknown = await res.json()
      if (!res.ok) {
        const message =
          typeof data === 'object' && data && 'message' in data
            ? String((data as { message?: unknown }).message ?? 'Upload failed')
            : 'Upload failed'
        setResult({ success: false, message })
        return
      }

      const parsed = data as UploadResponse
      setResult(parsed)
      reset()
    } catch {
      setResult({ success: false, message: 'Upload failed. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="rounded-xl border bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold">{ownerLabel(owner)}</h2>
        <p className="mt-1 text-sm text-zinc-600">{uploadedLabel}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-zinc-800">
            Upload Excel
          </label>
          <input
            type="file"
            accept=".xlsx,.xls"
            className="mt-2 block w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
            {...register('file')}
          />
          {errors.file ? (
            <p className="mt-2 text-sm text-red-600">{errors.file.message}</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex w-full items-center justify-center rounded-md bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Uploading…' : 'Upload & Save to Supabase'}
        </button>
      </form>

      {result ? (
        <div className="mt-4">
          {result.success ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              Saved {result.rowCount} rows.
            </div>
          ) : (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              {result.message}
            </div>
          )}
        </div>
      ) : null}

      {result?.success && result.preview.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-900">
            Preview (first 5 rows)
          </h3>
          <div className="mt-2 overflow-x-auto rounded-lg border">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="px-3 py-2">Permit</th>
                  <th className="px-3 py-2">Owner Name</th>
                  <th className="px-3 py-2">Plate</th>
                  <th className="px-3 py-2">Tonnage</th>
                  <th className="px-3 py-2">Classification</th>
                </tr>
              </thead>
              <tbody>
                {result.preview.map((r) => (
                  <tr key={r.permit_number} className="border-t">
                    <td className="px-3 py-2 font-mono">{r.raw_permit}</td>
                    <td className="px-3 py-2">{r.owner_name}</td>
                    <td className="px-3 py-2">{r.plate_number}</td>
                    <td className="px-3 py-2">{r.tonnage}</td>
                    <td className="px-3 py-2">{r.classification}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  )
}

