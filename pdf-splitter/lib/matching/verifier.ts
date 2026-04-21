import type { MatchResult, ParsedRow, RawTotals, VerificationResult } from '@/types'

function sum(rows: ParsedRow[], key: 'responses' | 'price'): number {
  return rows.reduce((acc, r) => acc + r[key], 0)
}

function fixed2(n: number): string {
  return n.toFixed(2)
}

export function verifyTotals(
  matchResult: MatchResult,
  rawTotals: RawTotals,
): VerificationResult {
  const combined: RawTotals = {
    total_rows:
      matchResult.saad.length + matchResult.gorman.length + matchResult.extra.length,
    total_responses:
      sum(matchResult.saad, 'responses') +
      sum(matchResult.gorman, 'responses') +
      sum(matchResult.extra, 'responses'),
    total_price:
      sum(matchResult.saad, 'price') +
      sum(matchResult.gorman, 'price') +
      sum(matchResult.extra, 'price'),
  }

  const rowsMatch = combined.total_rows === rawTotals.total_rows
  const responsesMatch = fixed2(combined.total_responses) === fixed2(rawTotals.total_responses)
  const priceMatch = fixed2(combined.total_price) === fixed2(rawTotals.total_price)

  if (rowsMatch && responsesMatch && priceMatch) return { passed: true }

  let discrepancy = ''
  if (!rowsMatch) {
    discrepancy = `Rows: expected ${rawTotals.total_rows} got ${combined.total_rows}`
  } else if (!responsesMatch) {
    discrepancy = `Responses: expected ${fixed2(rawTotals.total_responses)} got ${fixed2(
      combined.total_responses,
    )}`
  } else {
    discrepancy = `Price: expected ${fixed2(rawTotals.total_price)} got ${fixed2(
      combined.total_price,
    )}`
  }

  return {
    passed: false,
    discrepancy,
    combined,
    expected: rawTotals,
  }
}

