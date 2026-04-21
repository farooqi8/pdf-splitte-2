import type { ParsedRow, RawTotals } from '@/types'
import { normalisePermit } from '@/lib/matching/normalise'
import { spawn } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { promises as fs } from 'node:fs'

type ExtractorOutput = { ok: true; text: string } | { ok: false; error: string }

async function extractPdfText(buffer: Buffer): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-splitter-'))
  const pdfPath = path.join(tmpDir, 'input.pdf')
  const scriptPath = path.join(process.cwd(), 'scripts', 'pdf-extract.mjs')

  await fs.writeFile(pdfPath, buffer)

  try {
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

