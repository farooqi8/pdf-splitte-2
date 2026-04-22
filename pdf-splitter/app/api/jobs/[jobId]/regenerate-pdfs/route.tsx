import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'

import type { Group, ParsedRow } from '@/types'
import { ensureJobsBucket, uploadJobPdfToStorage } from '@/lib/jobs/job-pdf-storage'
import { SaadPdf } from '@/lib/pdf-generator/saad'
import { GormanPdf } from '@/lib/pdf-generator/gorman'
import { ExtraPdf } from '@/lib/pdf-generator/extra'
import { requiredServiceRoleKey } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function isGroup(value: unknown): value is Group {
  return value === 'saad' || value === 'gorman' || value === 'extra'
}

type JobRow = {
  permit_number: string
  raw_permit: string
  station: string
  responses: number
  price: number
  row_index: number
  assigned_group: string
}

function toParsedRow(r: JobRow): ParsedRow {
  return {
    permit_number: r.permit_number,
    raw_permit: r.raw_permit,
    station: r.station,
    responses: Number(r.responses),
    price: Number(r.price),
    row_index: r.row_index,
  }
}

export async function POST(
  _req: Request,
  { params }: { params: { jobId: string } },
) {
  try {
    const jobId = params.jobId
    const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = requiredServiceRoleKey()
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .select('id,status')
      .eq('id', jobId)
      .maybeSingle()

    if (jobError || !job) {
      return NextResponse.json(
        { success: false, message: 'Job not found.' },
        { status: 404 },
      )
    }

    if (job.status !== 'complete') {
      return NextResponse.json(
        {
          success: false,
          message: 'PDFs can only be regenerated for completed jobs.',
        },
        { status: 400 },
      )
    }

    const { data: rowData, error: rowsError } = await supabase
      .from('job_rows')
      .select(
        'permit_number,raw_permit,station,responses,price,row_index,assigned_group',
      )
      .eq('job_id', jobId)
      .order('row_index', { ascending: true })

    if (rowsError) {
      return NextResponse.json(
        { success: false, message: 'Failed to load job rows.' },
        { status: 500 },
      )
    }

    const saad: ParsedRow[] = []
    const gorman: ParsedRow[] = []
    const extra: ParsedRow[] = []

    for (const r of (rowData ?? []) as unknown as JobRow[]) {
      if (!isGroup(r.assigned_group)) continue
      const pr = toParsedRow(r)
      if (r.assigned_group === 'saad') saad.push(pr)
      if (r.assigned_group === 'gorman') gorman.push(pr)
      if (r.assigned_group === 'extra') extra.push(pr)
    }

    const reportDate = new Date().toLocaleDateString('en-GB')
    const generatedAt = new Date().toLocaleString('en-GB')

    const [saadPdf, gormanPdf, extraPdf] = await Promise.all([
      renderToBuffer(
        <SaadPdf
          jobId={jobId}
          reportDate={reportDate}
          generatedAt={generatedAt}
          rows={saad}
        />,
      ),
      renderToBuffer(
        <GormanPdf
          jobId={jobId}
          reportDate={reportDate}
          generatedAt={generatedAt}
          rows={gorman}
        />,
      ),
      renderToBuffer(
        <ExtraPdf
          jobId={jobId}
          reportDate={reportDate}
          generatedAt={generatedAt}
          rows={extra}
        />,
      ),
    ])

    await ensureJobsBucket(supabase)
    const [saadPath, gormanPath, extraPath] = await Promise.all([
      uploadJobPdfToStorage({ supabase, jobId, type: 'saad', buffer: saadPdf }),
      uploadJobPdfToStorage({ supabase, jobId, type: 'gorman', buffer: gormanPdf }),
      uploadJobPdfToStorage({ supabase, jobId, type: 'extra', buffer: extraPdf }),
    ])

    const { error: updateError } = await supabase
      .from('processing_jobs')
      .update({
        saad_pdf_url: saadPath,
        gorman_pdf_url: gormanPath,
        extra_pdf_url: extraPath,
      })
      .eq('id', jobId)

    if (updateError) {
      return NextResponse.json(
        { success: false, message: 'Regenerated PDFs but failed to update the job record.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to regenerate PDFs.'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
