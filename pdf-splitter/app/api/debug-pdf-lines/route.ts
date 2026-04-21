import { NextResponse } from 'next/server'
import { readPdf } from '@/lib/pdf/reader'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, message: 'PDF file is required.' },
        { status: 400 },
      )
    }

    const ab = await file.arrayBuffer()
    const buffer = Buffer.from(ab)
    const { debugLines, rawTotals, rows } = await readPdf(buffer)

    return NextResponse.json({
      success: true,
      lines: debugLines,
      parsedPreview: rows.slice(0, 5),
      rawTotals,
      debug: {
        node: process.version,
        vercel: Boolean(process.env.VERCEL),
        git: {
          commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
          repo: process.env.VERCEL_GIT_REPO_SLUG ?? null,
        },
      },
    })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Failed to read PDF.'
    const stack = e instanceof Error ? e.stack ?? null : null
    const name = e instanceof Error ? e.name : 'UnknownError'
    return NextResponse.json(
      {
        success: false,
        message,
        debug: {
          name,
          stack,
          node: process.version,
          vercel: Boolean(process.env.VERCEL),
          cwd: process.cwd(),
          git: {
            commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
            repo: process.env.VERCEL_GIT_REPO_SLUG ?? null,
          },
        },
      },
      { status: 500 },
    )
  }
}

