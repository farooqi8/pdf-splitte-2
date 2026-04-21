import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Owner, ReferenceRow } from '@/types'
import { readExcel } from '@/lib/excel/reader'
import { requiredServiceRoleKey } from '@/lib/supabase/server'

function isOwner(value: string): value is Owner {
  return value === 'saad' || value === 'gorman'
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const ownerRaw = form.get('owner')
    const file = form.get('file')

    if (typeof ownerRaw !== 'string' || !isOwner(ownerRaw)) {
      return NextResponse.json(
        { success: false, message: 'Invalid owner value.' },
        { status: 400 },
      )
    }
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'Excel file is required.' },
        { status: 400 },
      )
    }

    const ab = await file.arrayBuffer()
    const buffer = Buffer.from(ab)
    const permitMap = readExcel(buffer, ownerRaw)
    const rows = Array.from(permitMap.values())

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No rows found in the Excel file.' },
        { status: 400 },
      )
    }

    const url = requiredEnv('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = requiredServiceRoleKey()
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    })

    const { error: delError } = await supabase
      .from('reference_files')
      .delete()
      .eq('owner', ownerRaw)
    if (delError) {
      return NextResponse.json(
        { success: false, message: 'Failed to replace existing reference rows.' },
        { status: 500 },
      )
    }

    const payload: ReferenceRow[] = rows.map((r) => r)
    const { error: insError } = await supabase
      .from('reference_files')
      .insert(payload)
    if (insError) {
      return NextResponse.json(
        { success: false, message: 'Failed to save reference rows to Supabase.' },
        { status: 500 },
      )
    }

    const preview = payload.slice(0, 5)

    return NextResponse.json({
      success: true,
      rowCount: payload.length,
      preview,
    })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Upload failed. Please try again.' },
      { status: 500 },
    )
  }
}

