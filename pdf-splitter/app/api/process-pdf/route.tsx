import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { renderToBuffer } from '@react-pdf/renderer'

import type { Group, Owner, ParsedRow, PermitMap, ReferenceRow } from '@/types'
import { readPdf } from '@/lib/pdf/reader'
import { matchingEngine } from '@/lib/matching/engine'
import { verifyTotals } from '@/lib/matching/verifier'
import { requiredServiceRoleKey } from '@/lib/supabase/server'
import { SaadPdf } from '@/lib/pdf-generator/saad'
import { GormanPdf } from '@/lib/pdf-generator/gorman'
import { ExtraPdf } from '@/lib/pdf-generator/extra'

export const runtime = 'nodejs'

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

function isOwner(value: unknown): value is Owner {
  return value === 'saad' || value === 'gorman'
}

function nowIso(): string {
  return new Date().toISOString()
}

function toPermitMap(rows: ReferenceRow[]): PermitMap {
  const map: PermitMap = new Map()
  for (const r of rows) map.set(r.permit_number, r)
  return map
}

async function ensureJobsBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets()
  if (error) throw new Error('Failed to access Supabase Storage buckets.')
  const exists = buckets.some((b) => b.name === 'jobs')
  if (exists) return

  const { error: createError } = await supabase.storage.createBucket('jobs', {
    public: false,
  })
  if (createError) {
    throw new Error(
      'Storage bucket "jobs" is missing. Create it in Supabase Storage and try again.',
    )
  }
}

async function uploadPdfAndStorePath(params: {
  supabase: SupabaseClient
  jobId: string
  type: Group
  buffer: Buffer
}): Promise<string> {
  const filename = `${params.type}.pdf`
  const objectPath = `${params.jobId}/${filename}`

  const { error } = await params.supabase.storage
    .from('jobs')
    .upload(objectPath, params.buffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (error) {
    throw new Error(`Failed to upload ${params.type.toUpperCase()} PDF to storage.`)
  }

  return objectPath
}

function assignGroup(
  row: ParsedRow,
  saadMap: PermitMap,
  gormanMap: PermitMap,
): Group {
  if (saadMap.has(row.permit_number)) return 'saad'
  if (gormanMap.has(row.permit_number)) return 'gorman'
  return 'extra'
}

export async function POST(req: Request) {
  const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
  const serviceKey = requiredServiceRoleKey()
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  })

  let jobId: string | null = null

  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'PDF file is required.' },
        { status: 400 },
      )
    }

    // 1) Create job (processing)
    const { data: created, error: createError } = await supabase
      .from('processing_jobs')
      .insert({
        filename: file.name,
        status: 'processing',
        created_at: nowIso(),
      })
      .select('id')
      .single()

    if (createError || !created?.id) {
      throw new Error('Failed to create processing job.')
    }
    jobId = String(created.id)

    // 2) Parse PDF
    const buffer = Buffer.from(await file.arrayBuffer())
    const { rows, rawTotals } = await readPdf(buffer)

    // 3) Load reference rows for both owners
    const { data: refRows, error: refError } = await supabase
      .from('reference_files')
      .select(
        'permit_number,raw_permit,owner_name,plate_number,tonnage,classification,owner',
      )

    if (refError) {
      throw new Error('Failed to load reference files from Supabase.')
    }

    const saadRows: ReferenceRow[] = []
    const gormanRows: ReferenceRow[] = []
    for (const r of (refRows ?? []) as unknown[]) {
      const owner = (r as { owner?: unknown }).owner
      if (!isOwner(owner)) continue
      const row = r as ReferenceRow
      if (owner === 'saad') saadRows.push(row)
      if (owner === 'gorman') gormanRows.push(row)
    }
    const saadMap = toPermitMap(saadRows)
    const gormanMap = toPermitMap(gormanRows)

    // 4) Match
    const matchResult = matchingEngine(rows, saadMap, gormanMap)

    // 5) Verify totals
    const verification = verifyTotals(matchResult, rawTotals)
    if (!verification.passed) {
      await supabase
        .from('processing_jobs')
        .update({
          status: 'error',
          error_message: verification.discrepancy ?? 'Totals verification failed.',
          total_rows: rawTotals.total_rows,
          total_responses: rawTotals.total_responses,
          total_price: rawTotals.total_price,
          saad_rows: matchResult.saad.length,
          gorman_rows: matchResult.gorman.length,
          extra_rows: matchResult.extra.length,
        })
        .eq('id', jobId)

      return NextResponse.json(
        {
          success: false,
          message: verification.discrepancy ?? 'Totals verification failed.',
          verification,
        },
        { status: 400 },
      )
    }

    // 6) Insert job_rows
    const jobRowsPayload = rows.map((r) => ({
      job_id: jobId,
      permit_number: r.permit_number,
      raw_permit: r.raw_permit,
      station: r.station,
      responses: r.responses,
      price: r.price,
      assigned_group: assignGroup(r, saadMap, gormanMap),
      row_index: r.row_index,
    }))

    const { error: jobRowsError } = await supabase
      .from('job_rows')
      .insert(jobRowsPayload)
    if (jobRowsError) {
      throw new Error('Failed to save job rows.')
    }

    // 7) Generate PDFs
    const reportDate = new Date().toLocaleDateString('en-GB')
    const generatedAt = new Date().toLocaleString('en-GB')

    const saadPdf = await renderToBuffer(
      <SaadPdf
        jobId={jobId}
        reportDate={reportDate}
        generatedAt={generatedAt}
        rows={matchResult.saad}
        saadMap={saadMap}
      />,
    )

    const gormanPdf = await renderToBuffer(
      <GormanPdf
        jobId={jobId}
        reportDate={reportDate}
        generatedAt={generatedAt}
        rows={matchResult.gorman}
        gormanMap={gormanMap}
      />,
    )

    const extraPdf = await renderToBuffer(
      <ExtraPdf
        jobId={jobId}
        reportDate={reportDate}
        generatedAt={generatedAt}
        rows={matchResult.extra}
      />,
    )

    // 8) Upload PDFs to Supabase Storage
    await ensureJobsBucket(supabase)
    const [saadPath, gormanPath, extraPath] = await Promise.all([
      uploadPdfAndStorePath({ supabase, jobId, type: 'saad', buffer: saadPdf }),
      uploadPdfAndStorePath({
        supabase,
        jobId,
        type: 'gorman',
        buffer: gormanPdf,
      }),
      uploadPdfAndStorePath({ supabase, jobId, type: 'extra', buffer: extraPdf }),
    ])

    // 9) Update job as complete
    const { error: updateError } = await supabase
      .from('processing_jobs')
      .update({
        status: 'complete',
        total_rows: rawTotals.total_rows,
        total_responses: rawTotals.total_responses,
        total_price: rawTotals.total_price,
        saad_rows: matchResult.saad.length,
        gorman_rows: matchResult.gorman.length,
        extra_rows: matchResult.extra.length,
        saad_pdf_url: saadPath,
        gorman_pdf_url: gormanPath,
        extra_pdf_url: extraPath,
        error_message: null,
      })
      .eq('id', jobId)

    if (updateError) {
      throw new Error('Processing completed, but failed to update job status.')
    }

    return NextResponse.json({ success: true, jobId })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Processing failed.'

    if (jobId) {
      await supabase
        .from('processing_jobs')
        .update({ status: 'error', error_message: message })
        .eq('id', jobId)
    }

    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

