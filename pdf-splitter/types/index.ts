export type Owner = 'saad' | 'gorman'
export type Group = 'saad' | 'gorman' | 'extra'
export type JobStatus = 'pending' | 'processing' | 'complete' | 'error'

export interface ReferenceRow {
  permit_number: string // normalised
  raw_permit: string
  owner_name: string
  plate_number: string
  tonnage: string
  classification: string
  owner: Owner
}

export type PermitMap = Map<string, ReferenceRow>

export interface ParsedRow {
  permit_number: string // normalised
  raw_permit: string // original from PDF, shown in output PDFs
  station: string
  responses: number
  price: number
  row_index: number
}

export interface RawTotals {
  total_rows: number
  total_responses: number
  total_price: number
}

export interface GroupTotals {
  rows: number
  responses: number
  price: number
}

export interface MatchResult {
  saad: ParsedRow[]
  gorman: ParsedRow[]
  extra: ParsedRow[]
}

export interface VerificationResult {
  passed: boolean
  discrepancy?: string
  combined?: RawTotals
  expected?: RawTotals
}

export interface ProcessingJob {
  id: string
  filename: string
  status: JobStatus
  total_rows: number
  total_responses: number
  total_price: number
  saad_rows: number
  gorman_rows: number
  extra_rows: number
  saad_pdf_url: string | null
  gorman_pdf_url: string | null
  extra_pdf_url: string | null
  error_message: string | null
  created_at: string
}
