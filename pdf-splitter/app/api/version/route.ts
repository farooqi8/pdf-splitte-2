import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    ok: true,
    node: process.version,
    vercel: Boolean(process.env.VERCEL),
    git: {
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      repo: process.env.VERCEL_GIT_REPO_SLUG ?? null,
    },
  })
}

