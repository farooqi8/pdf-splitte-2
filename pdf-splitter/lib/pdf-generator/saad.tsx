import { Document } from '@react-pdf/renderer'
import type { ParsedRow, PermitMap } from '@/types'
import {
  PdfFooter,
  PdfGrandTotal,
  PdfHeader,
  PdfPage,
  PdfTable,
  PdfTableRow,
  PdfTotalsRow,
  formatMoney,
} from '@/lib/pdf-generator/shared'

function safeString(v: string | null | undefined): string {
  return v ? String(v) : ''
}

export function SaadPdf({
  jobId,
  reportDate,
  generatedAt,
  rows,
  saadMap,
}: {
  jobId: string
  reportDate: string
  generatedAt: string
  rows: ParsedRow[]
  saadMap: PermitMap
}) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.rows += 1
      acc.responses += r.responses
      acc.price += r.price
      return acc
    },
    { rows: 0, responses: 0, price: 0 },
  )

  return (
    <Document>
      <PdfPage>
        <PdfHeader
          title="Saad Al-Shahri — Station Report"
          jobId={jobId}
          reportDate={reportDate}
        />

        <PdfTable>
          {rows.map((r, idx) => {
            const ref = saadMap.get(r.permit_number)
            const ownerName = safeString(ref?.owner_name)
            const plate = safeString(ref?.plate_number)

            return (
              <PdfTableRow
                key={`${r.permit_number}-${r.row_index}`}
                zebra={idx % 2 === 0}
                cells={{
                  row: String(r.row_index),
                  permit: r.raw_permit,
                  plate,
                  owner: ownerName,
                  responses: formatMoney(r.responses),
                  price: formatMoney(r.price),
                }}
              />
            )
          })}
        </PdfTable>

        <PdfTotalsRow
          totalRows={totals.rows}
          totalResponses={totals.responses}
          totalPrice={totals.price}
        />

        <PdfGrandTotal totalPrice={totals.price} />

        <PdfFooter generatedAt={generatedAt} />
      </PdfPage>
    </Document>
  )
}

