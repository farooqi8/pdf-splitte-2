import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactNode } from 'react'

export const COLORS = {
  navy: '#1A1A2E',
  teal: '#0F766E',
  white: '#FFFFFF',
  lightGray: '#F3F4F6',
  text: '#374151',
} as const

export const STATION_NAME = 'Killo 14 Station' as const

/** Bumped when report table layout changes; must appear in footer of generated PDFs. */
export const PDF_LAYOUT_MARK = 'v2-4col'

// Use built-in PDF fonts (Helvetica is available by default); no registration needed.

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

export const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    fontFamily: 'Helvetica',
    padding: 18,
    color: COLORS.text,
    fontSize: 10,
  },
  headerWrap: {
    marginBottom: 10,
    padding: 10,
    borderRadius: 6,
    backgroundColor: COLORS.navy,
    color: COLORS.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  headerSub: {
    marginTop: 4,
    fontSize: 11,
    opacity: 0.95,
  },
  headerMetaRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerMeta: {
    fontSize: 9,
    opacity: 0.9,
  },
  table: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.lightGray,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    fontSize: 9,
  },
  cellMono: {
    fontFamily: 'Helvetica',
  },
  totalsRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.teal,
    color: COLORS.white,
    paddingVertical: 8,
    paddingHorizontal: 10,
    justifyContent: 'space-between',
    gap: 12,
  },
  totalsText: {
    fontSize: 10,
    fontWeight: 700,
  },
  grandTotalBox: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  grandTotalText: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: 0.3,
  },
  footer: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 9,
    color: COLORS.text,
  },
})

export function PdfPage({
  children,
}: {
  children: ReactNode
}) {
  return (
    <Page size="A4" orientation="landscape" style={styles.page}>
      {children}
    </Page>
  )
}

export function PdfHeader({
  title,
  jobId,
  reportDate,
}: {
  title: string
  jobId: string
  reportDate: string
}) {
  return (
    <View style={styles.headerWrap}>
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerSub}>{STATION_NAME}</Text>
      <View style={styles.headerMetaRow}>
        <Text style={styles.headerMeta}>Report Date: {reportDate}</Text>
        <Text style={styles.headerMeta}>Job ID: {jobId}</Text>
      </View>
    </View>
  )
}

export function PdfFooter({ generatedAt }: { generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages}`
        }
      />
      <Text>
        Generated: {generatedAt} · {PDF_LAYOUT_MARK}
      </Text>
    </View>
  )
}

export type TableColumn = {
  key: 'row' | 'permit' | 'responses' | 'price'
  label: string
  // percentage width (sum to ~100)
  widthPct: number
  align?: 'left' | 'right' | 'center'
}

export const DEFAULT_COLUMNS: TableColumn[] = [
  { key: 'row', label: 'Row#', widthPct: 8, align: 'center' },
  { key: 'permit', label: 'Permit Number', widthPct: 34, align: 'left' },
  { key: 'responses', label: 'Responses', widthPct: 20, align: 'right' },
  { key: 'price', label: 'Price', widthPct: 38, align: 'right' },
] as const

function alignToJustify(
  align: 'left' | 'right' | 'center' | undefined,
): 'flex-start' | 'flex-end' | 'center' {
  if (align === 'right') return 'flex-end'
  if (align === 'center') return 'center'
  return 'flex-start'
}

export function PdfTable({
  columns = DEFAULT_COLUMNS,
  children,
}: {
  columns?: TableColumn[]
  children: ReactNode
}) {
  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {columns.map((c) => (
          <View
            key={c.key}
            style={{
              width: `${c.widthPct}%`,
              justifyContent: alignToJustify(c.align),
            }}
          >
            <Text style={[styles.cell, { fontWeight: 700 }]}>{c.label}</Text>
          </View>
        ))}
      </View>
      {children}
    </View>
  )
}

export function PdfTableRow({
  columns = DEFAULT_COLUMNS,
  zebra,
  cells,
}: {
  columns?: TableColumn[]
  zebra: boolean
  cells: Record<TableColumn['key'], string>
}) {
  return (
    <View
      style={[
        styles.row,
        zebra ? { backgroundColor: COLORS.white } : { backgroundColor: COLORS.lightGray },
      ]}
    >
      {columns.map((c) => (
        <View
          key={c.key}
          style={{
            width: `${c.widthPct}%`,
            justifyContent: alignToJustify(c.align),
          }}
        >
          <Text
            style={[
              styles.cell,
              ...(c.key === 'permit' ? [styles.cellMono] : []),
            ]}
          >
            {cells[c.key]}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function PdfTotalsRow({
  totalRows,
  totalResponses,
  totalPrice,
}: {
  totalRows: number
  totalResponses: number
  totalPrice: number
}) {
  return (
    <View style={styles.totalsRow}>
      <Text style={styles.totalsText}>Total Rows: {formatNumber(totalRows)}</Text>
      <Text style={styles.totalsText}>
        Total Responses: {formatMoney(totalResponses)}
      </Text>
      <Text style={styles.totalsText}>Total Price: {formatMoney(totalPrice)}</Text>
    </View>
  )
}

export function PdfGrandTotal({ totalPrice }: { totalPrice: number }) {
  return (
    <View style={styles.grandTotalBox}>
      <Text style={styles.grandTotalText}>
        GRAND TOTAL PRICE: {formatMoney(totalPrice)}
      </Text>
    </View>
  )
}

