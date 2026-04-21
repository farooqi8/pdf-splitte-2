import * as xlsx from 'xlsx'
import type { Owner, PermitMap, ReferenceRow } from '@/types'
import { normalisePermit } from '../matching/normalise'

type ExcelJsonRow = Record<string, unknown>

function normaliseHeaderKey(key: string): string {
  return key.toLowerCase().trim().replace(/[\s_\-]/g, '')
}

function getStringField(row: ExcelJsonRow, candidates: string[], fallback = ''): string {
  const rowKeys = Object.keys(row)
  for (const candidate of candidates) {
    const candNorm = normaliseHeaderKey(candidate)
    const matchKey = rowKeys.find((k) => normaliseHeaderKey(k) === candNorm)
    if (!matchKey) continue
    const value = row[matchKey]
    if (value === null || value === undefined) return fallback
    return String(value).trim()
  }
  return fallback
}

export function readExcel(buffer: Buffer, owner: Owner): PermitMap {
  const workbook = xlsx.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const raw = xlsx.utils.sheet_to_json(sheet, { defval: '' }) as unknown

  if (!Array.isArray(raw)) {
    throw new Error('Invalid Excel format: expected rows array')
  }

  const map: PermitMap = new Map<string, ReferenceRow>()

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as ExcelJsonRow

    const rawPermit = getStringField(row, [
      // English headers
      'permit number',
      'permit_number',
      'permit',
      'permitno',
      'permit no',
      // Arabic headers
      'رقم التصريح',
    ])
    const permit_number = normalisePermit(rawPermit)
    if (!permit_number) continue

    const referenceRow: ReferenceRow = {
      permit_number,
      raw_permit: rawPermit,
      owner_name: getStringField(row, [
        // English
        'owner name',
        'owner_name',
        'owner',
        // Arabic
        'مالك الناقلة',
      ]),
      plate_number: getStringField(row, [
        // English
        'plate number',
        'plate_number',
        'plate',
        // Arabic
        'رقم اللوحة',
      ]),
      tonnage: getStringField(row, [
        // English
        'tonnage',
        'ton',
        // Arabic
        'الحمولة بالطن',
      ]),
      classification: getStringField(row, [
        // English
        'classification',
        'class',
        // Arabic
        'تصنيف',
      ]),
      owner,
    }

    map.set(permit_number, referenceRow)
  }

  return map
}

