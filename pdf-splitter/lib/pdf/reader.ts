import type { ParsedRow, RawTotals } from '@/types'
import { normalisePermit } from '@/lib/matching/normalise'

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
  let stage = 'start'
  // #region agent log
  agentLog('A', 'lib/pdf/reader.ts:39', 'extractPdfTextDirect start', {
    node: process.version,
    cwd: process.cwd(),
    bufferBytes: buffer.byteLength,
  })
  // #endregion

  try {
    stage = 'polyfill_check'
    // #region agent log
    agentLog('C', 'lib/pdf/reader.ts:47', 'polyfill check', {
      hasDOMMatrix: typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix !== 'undefined',
    })
    // #endregion

    // pdfjs-dist expects DOMMatrix in some Node runtimes (e.g. Vercel).
    // Polyfill it only when missing.
    stage = 'polyfill_load'
    if (typeof (globalThis as { DOMMatrix?: unknown }).DOMMatrix === 'undefined') {
      const dom = await import('@thednp/dommatrix')
      ;(globalThis as { DOMMatrix?: unknown }).DOMMatrix = dom.default
    }

    // pdfjs-dist uses DOMMatrix static helpers in some builds.
    // Add shims if the polyfill doesn't provide them.
    stage = 'polyfill_shim'
    {
      const DM = (globalThis as { DOMMatrix?: unknown }).DOMMatrix as unknown as {
        new (init?: unknown): unknown
        fromFloat32Array?: (a: Float32Array) => unknown
        fromFloat64Array?: (a: Float64Array) => unknown
        fromMatrix?: (m: unknown) => unknown
        fromPoint?: (p: unknown) => unknown
      }
      if (DM && typeof DM.fromFloat32Array !== 'function') {
        DM.fromFloat32Array = (a: Float32Array) => new DM(a)
      }
      if (DM && typeof DM.fromFloat64Array !== 'function') {
        DM.fromFloat64Array = (a: Float64Array) => new DM(a)
      }
      if (DM && typeof DM.fromMatrix !== 'function') {
        DM.fromMatrix = (m: unknown) => new DM(m)
      }
      if (DM && typeof DM.fromPoint !== 'function') {
        DM.fromPoint = (p: unknown) => p
      }

      // #region agent log
      agentLog('C', 'lib/pdf/reader.ts:88', 'polyfill shim status', {
        has_fromFloat32Array: typeof DM?.fromFloat32Array === 'function',
        has_fromFloat64Array: typeof DM?.fromFloat64Array === 'function',
        has_fromMatrix: typeof DM?.fromMatrix === 'function',
        has_fromPoint: typeof DM?.fromPoint === 'function',
      })
      // #endregion
    }

    // Load pdfjs without webpack re-bundling (avoids "Object.defineProperty called on non-object").
    stage = 'pdfjs_import'
    const pdfjs = await import(
      /* webpackIgnore: true */
      'pdfjs-dist/legacy/build/pdf.mjs',
    )

    stage = 'getDocument'
    // In Vercel/serverless, worker resolution can break unless we explicitly bundle it.
    stage = 'worker_setup'
    try {
      const { createRequire } = await import('node:module')
      const { pathToFileURL } = await import('node:url')

      await import(
        /* webpackIgnore: true */
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
      )

      const requireA = createRequire(import.meta.url)
      const workerPath = requireA.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
      pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString()

      // #region agent log
      agentLog('D', 'lib/pdf/reader.ts:95', 'workerSrc set', {
        workerPath,
        workerSrcPrefix: String(pdfjs.GlobalWorkerOptions.workerSrc).slice(0, 20),
      })
      // #endregion
    } catch (e) {
      // #region agent log
      agentLog('D', 'lib/pdf/reader.ts:106', 'worker_setup failed', {
        error: e instanceof Error ? e.message : String(e),
      })
      // #endregion
      // Continue; disableWorker may still succeed.
    }

    const getDocument = (pdfjs as unknown as {
      getDocument: (src: { data: Uint8Array; disableWorker?: boolean }) => { promise: Promise<unknown> }
    }).getDocument
    const loadingTask = getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
    })

    stage = 'await_document'
    type PdfJsTextItem = { str?: unknown; transform?: unknown }
    type PdfJsTextContent = { items: PdfJsTextItem[] }
    type PdfJsPage = { getTextContent: () => Promise<PdfJsTextContent> }
    const doc = (await loadingTask.promise) as {
      numPages: number
      getPage: (n: number) => Promise<PdfJsPage>
      destroy: () => Promise<void>
    }
    try {
      const outLines: string[] = []
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        stage = `page_${pageNum}_getPage`
        const page = await doc.getPage(pageNum)
        stage = `page_${pageNum}_getTextContent`
        const content = await page.getTextContent()
        stage = `page_${pageNum}_items`
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
        stage = `page_${pageNum}_groupLines`
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`PDFJS_STAGE=${stage}; ${msg}`)
  }
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    return await extractPdfTextDirect(buffer)
  } catch (e) {
    // #region agent log
    agentLog('A', 'lib/pdf/reader.ts:122', 'extractPdfTextDirect failed (no fallback)', {
      error: e instanceof Error ? e.message : String(e),
      vercel: Boolean(process.env.VERCEL),
    })
    // #endregion
    throw e
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

