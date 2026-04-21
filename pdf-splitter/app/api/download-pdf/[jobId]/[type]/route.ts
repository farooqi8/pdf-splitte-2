import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requiredServiceRoleKey } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type PdfType = 'saad' | 'gorman' | 'extra'

function isPdfType(value: string): value is PdfType {
  return value === 'saad' || value === 'gorman' || value === 'extra'
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function GET(
  _req: Request,
  { params }: { params: { jobId: string; type: string } },
) {
  try {
    const { jobId, type } = params
    if (!isPdfType(type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid PDF type.' },
        { status: 400 },
      )
    }

    const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = requiredServiceRoleKey()
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    const column =
      type === 'saad'
        ? 'saad_pdf_url'
        : type === 'gorman'
          ? 'gorman_pdf_url'
          : 'extra_pdf_url'

    const { data, error } = await supabase
      .from('processing_jobs')
      .select(column)
      .eq('id', jobId)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json(
        { success: false, message: 'Job not found.' },
        { status: 404 },
      )
    }

    const objectPath = String((data as Record<string, unknown>)[column] ?? '')
    if (!objectPath) {
      return NextResponse.json(
        { success: false, message: 'PDF is not available yet.' },
        { status: 404 },
      )
    }

    const { data: signed, error: signError } = await supabase.storage
      .from('jobs')
      .createSignedUrl(objectPath, 60 * 10)

    if (signError || !signed?.signedUrl) {
      return NextResponse.json(
        { success: false, message: 'Failed to create download link.' },
        { status: 500 },
      )
    }

    return NextResponse.redirect(signed.signedUrl)
  } catch {
    return NextResponse.json(
      { success: false, message: 'Failed to download PDF.' },
      { status: 500 },
    )
  }
}

