import Link from 'next/link'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import type { JobStatus, ProcessingJob } from '@/types'

function statusBadge(status: JobStatus): { label: string; cls: string } {
  switch (status) {
    case 'complete':
      return { label: 'Complete', cls: 'bg-emerald-50 text-emerald-900 border-emerald-200' }
    case 'error':
      return { label: 'Error', cls: 'bg-red-50 text-red-900 border-red-200' }
    case 'processing':
      return { label: 'Processing', cls: 'bg-amber-50 text-amber-900 border-amber-200' }
    case 'pending':
    default:
      return { label: 'Pending', cls: 'bg-zinc-50 text-zinc-900 border-zinc-200' }
  }
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

async function referencesReady(): Promise<boolean> {
  const supabase = createSupabaseAdminClient()
  const [{ count: saad }, { count: gorman }] = await Promise.all([
    supabase.from('reference_files').select('*', { head: true, count: 'exact' }).eq('owner', 'saad'),
    supabase.from('reference_files').select('*', { head: true, count: 'exact' }).eq('owner', 'gorman'),
  ])
  return (saad ?? 0) > 0 && (gorman ?? 0) > 0
}

async function loadJobs(): Promise<ProcessingJob[]> {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('processing_jobs')
    .select(
      'id,filename,status,total_rows,total_responses,total_price,saad_rows,gorman_rows,extra_rows,saad_pdf_url,gorman_pdf_url,extra_pdf_url,error_message,created_at',
    )
    .order('created_at', { ascending: false })
    .limit(50)

  return (data ?? []) as ProcessingJob[]
}

export default async function DashboardPage() {
  try {
    const [ready, jobs] = await Promise.all([referencesReady(), loadJobs()])

    return (
      <div className="space-y-6">
        {!ready ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="font-semibold">Upload both reference files before processing a PDF</div>
            <div className="mt-1 text-sm">
              Go to{' '}
              <Link className="font-semibold underline" href="/references">
                References
              </Link>{' '}
              and upload Saad + Gorman Excel files.
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/references" className="rounded-xl border bg-white p-6 shadow-sm hover:bg-zinc-50">
            <div className="text-lg font-semibold">Manage Reference Files</div>
            <div className="mt-1 text-sm text-zinc-600">Upload and verify the 2 Excel reference files.</div>
          </Link>
          <Link href="/process" className="rounded-xl border bg-white p-6 shadow-sm hover:bg-zinc-50">
            <div className="text-lg font-semibold">Process New PDF</div>
            <div className="mt-1 text-sm text-zinc-600">Upload a station PDF and generate 3 PDFs.</div>
          </Link>
        </div>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">Past Jobs</h2>
              <p className="mt-1 text-xs text-zinc-600">Latest 50 jobs</p>
            </div>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-700">
                <tr>
                  <th className="px-4 py-3">Filename</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Total Rows</th>
                  <th className="px-4 py-3">Total Price</th>
                  <th className="px-4 py-3">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr className="border-t">
                    <td className="px-4 py-4 text-zinc-600" colSpan={6}>
                      No jobs yet. Go to{' '}
                      <Link className="font-semibold text-teal-700 hover:text-teal-800" href="/process">
                        Process
                      </Link>
                      .
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => {
                    const badge = statusBadge(job.status)
                    return (
                      <tr key={job.id} className="border-t">
                        <td className="px-4 py-3">
                          <Link className="font-medium text-zinc-900 hover:underline" href={`/results/${job.id}`}>
                            {job.filename}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{new Date(job.created_at).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${badge.cls}`}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">{job.total_rows ?? 0}</td>
                        <td className="px-4 py-3">
                          {typeof job.total_price === 'number' ? formatMoney(job.total_price) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <a
                              className="text-xs font-semibold text-zinc-900 underline hover:text-zinc-700"
                              href={`/api/download-pdf/${job.id}/saad`}
                            >
                              Saad
                            </a>
                            <a
                              className="text-xs font-semibold text-zinc-900 underline hover:text-zinc-700"
                              href={`/api/download-pdf/${job.id}/gorman`}
                            >
                              Gorman
                            </a>
                            <a
                              className="text-xs font-semibold text-zinc-900 underline hover:text-zinc-700"
                              href={`/api/download-pdf/${job.id}/extra`}
                            >
                              Extra
                            </a>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    )
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    const likelyMissingEnv =
      message.includes('NEXT_PUBLIC_SUPABASE_URL is required') ||
      message.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY is required') ||
      message.includes('SUPABASE_SERVICE_ROLE_KEY is required')

    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="font-semibold">Server configuration error</div>
          <div className="mt-1 text-sm">{message}</div>
        </div>

        {likelyMissingEnv ? (
          <div className="rounded-xl border bg-white p-5 text-sm text-zinc-900 shadow-sm">
            <div className="font-semibold">Fix on Vercel</div>
            <div className="mt-2 text-zinc-700">
              In Vercel go to <span className="font-semibold">Project → Settings → Environment Variables</span> and add:
            </div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-zinc-800">
              <li>
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_URL</span>
              </li>
              <li>
                <span className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</span>
              </li>
              <li>
                <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>
              </li>
              <li>
                <span className="font-mono">APP_PASSWORD</span>
              </li>
            </ul>
            <div className="mt-3 text-zinc-700">After saving, redeploy.</div>
          </div>
        ) : null}
      </div>
    )
  }
}

