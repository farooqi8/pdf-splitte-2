import type { MatchResult, ParsedRow, PermitMap } from '@/types'

export function matchingEngine(
  rows: ParsedRow[],
  saadMap: PermitMap,
  gormanMap: PermitMap,
): MatchResult {
  const saadRows: ParsedRow[] = []
  const gormanRows: ParsedRow[] = []
  const extraRows: ParsedRow[] = []

  for (const row of rows) {
    if (saadMap.has(row.permit_number)) {
      saadRows.push(row)
      continue
    }
    if (gormanMap.has(row.permit_number)) {
      gormanRows.push(row)
      continue
    }
    extraRows.push(row)
  }

  return { saad: saadRows, gorman: gormanRows, extra: extraRows }
}

