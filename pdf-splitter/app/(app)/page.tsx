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

function formatJobWhen(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 sm:p-5">
            <div className="font-semibold">Upload both reference files before processing a PDF</div>
            <div className="mt-1 text-sm leading-relaxed">
              Go to{' '}
              <Link className="font-semibold underline" href="/references">
                References
              </Link>{' '}
              and upload Saad + Gorman Excel files.
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          <Link
            href="/references"
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm outline-none ring-teal-700/0 transition hover:border-zinc-300 hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-teal-700 sm:p-6"
          >
            <div className="text-base font-semibold sm:text-lg">Manage Reference Files</div>
            <div className="mt-1 text-sm text-zinc-600">Upload and verify the 2 Excel reference files.</div>
          </Link>
          <Link
            href="/process"
            className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm outline-none ring-teal-700/0 transition hover:border-zinc-300 hover:bg-zinc-50/80 focus-visible:ring-2 focus-visible:ring-teal-700 sm:p-6"
          >
            <div className="text-base font-semibold sm:text-lg">Process New PDF</div>
            <div className="mt-1 text-sm text-zinc-600">Upload a station PDF and generate 3 PDFs.</div>
          </Link>
        </div>

        <section className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-zinc-50 sm:px-5 sm:py-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-zinc-900">Past Jobs</h2>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Latest 50 jobs
                  {jobs.length > 0 ? (
                    <span className="text-zinc-500"> · {jobs.length} in list</span>
                  ) : null}
                  <span className="sr-only">. Tap to expand or collapse.</span>
                </p>
              </div>
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 shadow-sm group-open:rotate-180 motion-safe:transition-transform"
                aria-hidden
              >
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </span>
            </summary>

            <div className="border-t border-zinc-100 px-3 pb-4 pt-3 sm:px-4 sm:pb-5">
              {jobs.length === 0 ? (
                <p className="px-1 py-3 text-sm text-zinc-600 sm:px-2">
                  No jobs yet. Go to{' '}
                  <Link className="font-semibold text-teal-700 hover:text-teal-800" href="/process">
                    Process
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div className="space-y-3 md:hidden">
                    {jobs.map((job) => {
                      const badge = statusBadge(job.status)
                      return (
                        <div
                          key={job.id}
                          className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4 shadow-sm"
                        >
                          <Link
                            className="block font-medium text-zinc-900 underline-offset-2 hover:underline"
                            href={`/results/${job.id}`}
                          >
                            {job.filename}
                          </Link>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600">
                            <time dateTime={job.created_at}>{formatJobWhen(job.created_at)}</time>
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Rows</dt>
                              <dd className="font-medium text-zinc-900">{job.total_rows ?? 0}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-zinc-500">Total price</dt>
                              <dd className="font-medium text-zinc-900">
                                {typeof job.total_price === 'number' ? formatMoney(job.total_price) : '—'}
                              </dd>
                            </div>
                          </dl>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <a
                              className="inline-flex min-h-9 min-w-[4.5rem] items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              href={`/api/download-pdf/${job.id}/saad`}
                            >
                              Saad
                            </a>
                            <a
                              className="inline-flex min-h-9 min-w-[4.5rem] items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              href={`/api/download-pdf/${job.id}/gorman`}
                            >
                              Gorman
                            </a>
                            <a
                              className="inline-flex min-h-9 min-w-[4.5rem] items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-900 hover:bg-zinc-50"
                              href={`/api/download-pdf/${job.id}/extra`}
                            >
                              Extra
                            </a>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="hidden overflow-x-auto rounded-lg border border-zinc-200 md:block">
                    <table className="min-w-[44rem] w-full text-left text-sm lg:min-w-0">
                      <thead className="bg-zinc-50 text-zinc-700">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Filename</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold">Date</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold">Total Rows</th>
                          <th className="whitespace-nowrap px-4 py-3 font-semibold">Total Price</th>
                          <th className="px-4 py-3 font-semibold">Downloads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.map((job) => {
                          const badge = statusBadge(job.status)
                          return (
                            <tr key={job.id} className="border-t border-zinc-100">
                              <td className="max-w-[14rem] truncate px-4 py-3 lg:max-w-xs">
                                <Link
                                  className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                                  href={`/results/${job.id}`}
                                  title={job.filename}
                                >
                                  {job.filename}
                                </Link>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 text-zinc-700">
                                {formatJobWhen(job.created_at)}
                              </td>
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
                                    className="text-xs font-semibold text-teal-800 underline decoration-teal-800/30 underline-offset-2 hover:text-teal-950"
                                    href={`/api/download-pdf/${job.id}/saad`}
                                  >
                                    Saad
                                  </a>
                                  <a
                                    className="text-xs font-semibold text-teal-800 underline decoration-teal-800/30 underline-offset-2 hover:text-teal-950"
                                    href={`/api/download-pdf/${job.id}/gorman`}
                                  >
                                    Gorman
                                  </a>
                                  <a
                                    className="text-xs font-semibold text-teal-800 underline decoration-teal-800/30 underline-offset-2 hover:text-teal-950"
                                    href={`/api/download-pdf/${job.id}/extra`}
                                  >
                                    Extra
                                  </a>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </details>
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

