import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { ProcessingJob } from '@/types'

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n)
}

async function getJob(jobId: string): Promise<ProcessingJob | null> {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('processing_jobs')
    .select(
      'id,filename,status,total_rows,total_responses,total_price,saad_rows,gorman_rows,extra_rows,saad_pdf_url,gorman_pdf_url,extra_pdf_url,error_message,created_at',
    )
    .eq('id', jobId)
    .maybeSingle()

  if (error || !data) return null
  return data as ProcessingJob
}

export default async function ResultsPage({
  params,
}: {
  params: { jobId: string }
}) {
  const job = await getJob(params.jobId)
  if (!job) return notFound()

  if (job.status === 'error') {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <h1 className="text-xl font-bold text-red-900">Verification failed</h1>
          <p className="mt-2 text-sm text-red-900">
            {job.error_message ?? 'Totals verification failed.'}
          </p>
        </div>
        <Link href="/process" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
          Process Another PDF
        </Link>
      </div>
    )
  }

  if (job.status !== 'complete') {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Results</h1>
        <p className="text-sm text-zinc-700">
          This job is still processing. Refresh in a few seconds.
        </p>
        <Link href="/process" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
          Process Another PDF
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
        <h1 className="text-xl font-bold text-emerald-900">
          Totals verified — all groups match input PDF
        </h1>
        <p className="mt-2 text-sm text-emerald-900">
          File: <span className="font-semibold">{job.filename}</span>
        </p>
      </div>

      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-zinc-900">Summary</h2>
        <div className="mt-3 overflow-x-auto rounded-lg border">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-700">
              <tr>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Rows</th>
                <th className="px-4 py-3">Responses</th>
                <th className="px-4 py-3">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-4 py-3 font-medium">Saad</td>
                <td className="px-4 py-3">{formatNumber(job.saad_rows)}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-3 font-medium">Gorman</td>
                <td className="px-4 py-3">{formatNumber(job.gorman_rows)}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
              </tr>
              <tr className="border-t">
                <td className="px-4 py-3 font-medium">Extra</td>
                <td className="px-4 py-3">{formatNumber(job.extra_rows)}</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3">—</td>
              </tr>
              <tr className="border-t bg-zinc-50 font-semibold">
                <td className="px-4 py-3">TOTAL</td>
                <td className="px-4 py-3">{formatNumber(job.total_rows)}</td>
                <td className="px-4 py-3">{formatMoney(job.total_responses)}</td>
                <td className="px-4 py-3">{formatMoney(job.total_price)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-600">
          Note: group responses/price breakdown will be shown in Step 14.5 when we compute totals per group.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <a
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          href={`/api/download-pdf/${job.id}/saad`}
        >
          Download Saad PDF
        </a>
        <a
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          href={`/api/download-pdf/${job.id}/gorman`}
        >
          Download Gorman PDF
        </a>
        <a
          className="inline-flex items-center justify-center rounded-md bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
          href={`/api/download-pdf/${job.id}/extra`}
        >
          Download Extra PDF
        </a>
      </section>

      <Link href="/process" className="text-sm font-semibold text-teal-700 hover:text-teal-800">
        Process Another PDF
      </Link>
    </div>
  )
}

