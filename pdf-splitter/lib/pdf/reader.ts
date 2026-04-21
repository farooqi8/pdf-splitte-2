import type { ParsedRow, RawTotals } from '@/types'
import { normalisePermit } from '@/lib/matching/normalise'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'

type ExtractorOutput = { ok: true; text: string } | { ok: false; error: string }

// #region agent log
function agentLog(hypothesisId: string, location: string, message: string, data: Record<string, unknown>) {
  fetch('http://127.0.0.1:7346/ingest/95f67409-f74a-42d6-93d4-9f4b4593246b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '3e99f0' },
    body: JSON.stringify({
      sessionId: '3e99f0',
      runId: process.env.AGENT_RUN_ID ?? 'pre-fix',
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
}
// #endregion

async function extractPdfTextDirect(buffer: Buffer): Promise<string> {
  // #region agent log
  agentLog('A', 'lib/pdf/reader.ts:39', 'extractPdfTextDirect start', {
    node: process.version,
    cwd: process.cwd(),
    bufferBytes: buffer.byteLength,
  })
  // #endregion

  // Importing here ensures Next/Vercel bundles pdfjs-dist into the server function.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')

  // Even with disableWorker=true, PDF.js can still require workerSrc in some environments.
  // We point it at the bundled worker file.
  const { createRequire } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  const require = createRequire(import.meta.url)
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString()

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
  })

  const doc = await loadingTask.promise
  try {
    const outLines: string[] = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const positioned = content.items
        .map((it) => {
          const tr = Array.isArray((it as { transform?: unknown }).transform)
            ? ((it as { transform: number[] }).transform)
            : null
          const x = tr ? tr[4] : 0
          const y = tr ? tr[5] : 0
          const str = String((it as { str?: unknown }).str ?? '').trim()
          return { str, x, y }
        })
        .filter((p) => p.str.length > 0)

      // Same heuristic as scripts/pdf-extract.mjs
      const sorted = [...positioned].sort((a, b) => b.y - a.y || a.x - b.x)
      const lines: Array<{ y: number; parts: typeof positioned }> = []
      const yTol = 2.5
      for (const it of sorted) {
        const last = lines[lines.length - 1]
        if (!last || Math.abs(last.y - it.y) > yTol) {
          lines.push({ y: it.y, parts: [it] })
        } else {
          last.parts.push(it)
        }
      }
      outLines.push(
        ...lines.map((ln) =>
          ln.parts
            .sort((a, b) => a.x - b.x)
            .map((p) => p.str)
            .join(' '),
        ),
      )
      outLines.push(`-- ${pageNum} of ${doc.numPages} --`)
    }

    // #region agent log
    agentLog('A', 'lib/pdf/reader.ts:105', 'extractPdfTextDirect success', {
      pages: doc.numPages,
      lines: outLines.length,
    })
    // #endregion

    return outLines.join('\n')
  } finally {
    await doc.destroy()
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    return await extractPdfTextDirect(buffer)
  } catch (e) {
    // #region agent log
    agentLog('A', 'lib/pdf/reader.ts:122', 'extractPdfTextDirect failed; will fallback to child process', {
      error: e instanceof Error ? e.message : String(e),
    })
    // #endregion
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-splitter-'))
  const pdfPath = path.join(tmpDir, 'input.pdf')
  const scriptPath = path.join(process.cwd(), 'scripts', 'pdf-extract.mjs')

  await fs.writeFile(pdfPath, buffer)

  try {
    // #region agent log
    agentLog('B', 'lib/pdf/reader.ts:137', 'extractPdfText child-process start', {
      node: process.version,
      cwd: process.cwd(),
      scriptPath,
      scriptExists: await fs
        .access(scriptPath)
        .then(() => true)
        .catch(() => false),
    })
    // #endregion

    const out = await new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, [scriptPath, pdfPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (d) => {
        stdout += String(d)
      })
      child.stderr.on('data', (d) => {
        stderr += String(d)
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) return resolve(stdout)
        reject(new Error(stderr || stdout || 'PDF extraction failed'))
      })
    })

    const parsed = JSON.parse(out) as ExtractorOutput
    if (!parsed.ok) {
      throw new Error(parsed.error || 'PDF extraction failed')
    }

    // #region agent log
    agentLog('B', 'lib/pdf/reader.ts:175', 'extractPdfText child-process success', { textBytes: parsed.text.length })
    // #endregion

    return parsed.text
  } finally {
    // best-effort cleanup
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
}

function toAsciiDigits(input: string): string {
  // Arabic-Indic digits: ٠١٢٣٤٥٦٧٨٩
  // Eastern Arabic-Indic digits: ۰۱۲۳۴۵۶۷۸۹
  const arabicIndic = '٠١٢٣٤٥٦٧٨٩'
  const easternArabicIndic = '۰۱۲۳۴۵۶۷۸۹'

  let out = input
  for (let i = 0; i < 10; i++) {
    out = out.replaceAll(arabicIndic[i], String(i))
    out = out.replaceAll(easternArabicIndic[i], String(i))
  }
  return out
}

function parseNumber(raw: string): number {
  const s = toAsciiDigits(raw).trim().replace(/,/g, '')
  const n = Number(s)
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid number: "${raw}"`)
  }
  return n
}

function findHeaderIndex(lines: string[]): number {
  const headerKeywords = ['رقمالتصريح', 'المحطة', 'ردود', 'البنك']
  for (let i = 0; i < lines.length; i++) {
    const compact = lines[i].replace(/\s+/g, '').toLowerCase()
    if (headerKeywords.every((k) => compact.includes(k))) return i
  }
  return -1
}

function lineLooksLikePageMarker(line: string): boolean {
  const s = line.trim().toLowerCase()
  return s.startsWith('--') && s.includes('of')
}

function parseDataLine(
  line: string,
  rowIndex: number,
): Omit<ParsedRow, 'row_index'> | null {
  const cleaned = toAsciiDigits(line).replace(/\t+/g, ' ').trim()
  if (!cleaned) return null
  if (lineLooksLikePageMarker(cleaned)) return null

  // Permit number is the only stable anchor (e.g. JD-61780)
  const permitMatch = cleaned.match(/\bJD[\s\-\.]?\d+\b/i)
  if (!permitMatch || permitMatch.index === undefined) return null

  const rawPermit = permitMatch[0].replace(/\s+/g, ' ').trim()
  const permit_number = normalisePermit(rawPermit)

  // Everything after permit should be: responses price
  const after = cleaned.slice(permitMatch.index + permitMatch[0].length).trim()
  const nums = after.split(/\s+/g).filter(Boolean)
  if (nums.length < 2) {
    throw new Error(`Could not parse numbers for row ${rowIndex + 1}: "${line}"`)
  }

  const responses = parseNumber(nums[0])
  const price = parseNumber(nums[1])

  // Station is the text between bank and permit; we keep it as extracted (templates will hardcode)
  const before = cleaned.slice(0, permitMatch.index).trim()
  const beforeTokens = before.split(/\s+/g).filter(Boolean)
  // Heuristic: first token = account, second = bank, rest = station
  const station =
    beforeTokens.length >= 3 ? beforeTokens.slice(2).join(' ') : ''

  return {
    permit_number,
    raw_permit: rawPermit,
    station,
    responses,
    price,
  }
}

export async function readPdf(buffer: Buffer): Promise<{
  rows: ParsedRow[]
  rawTotals: RawTotals
  debugLines: string[]
}> {
  const text = await extractPdfText(buffer)
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const headerIdx = findHeaderIndex(lines)
  const startIdx = headerIdx >= 0 ? headerIdx + 1 : 0

  const rows: ParsedRow[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const parsed = parseDataLine(lines[i], rows.length)
    if (!parsed) continue

    rows.push({
      ...parsed,
      row_index: rows.length + 1,
    })
  }

  const rawTotals: RawTotals = {
    total_rows: rows.length,
    total_responses: rows.reduce((sum, r) => sum + r.responses, 0),
    total_price: rows.reduce((sum, r) => sum + r.price, 0),
  }

  return { rows, rawTotals, debugLines: lines }
}

