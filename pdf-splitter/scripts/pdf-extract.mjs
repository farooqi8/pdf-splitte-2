import fs from 'node:fs/promises'
import process from 'node:process'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

// Standalone PDF text extractor (runs outside Next.js bundling).
// Usage: node scripts/pdf-extract.mjs <pdfPath>

function groupIntoLines(items) {
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x))
  const lines = []
  const yTol = 2.5

  for (const it of sorted) {
    const last = lines[lines.length - 1]
    if (!last || Math.abs(last.y - it.y) > yTol) {
      lines.push({ y: it.y, parts: [it] })
    } else {
      last.parts.push(it)
    }
  }

  return lines.map((ln) =>
    ln.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join(' '),
  )
}

async function main() {
  const pdfPath = process.argv[2]
  if (!pdfPath) {
    process.stderr.write('Missing pdfPath argument\n')
    process.exit(2)
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  // Even with disableWorker=true, PDF.js expects a workerSrc to be set in some environments.
  // In this standalone Node script we can safely point to the bundled worker file.
  const require = createRequire(import.meta.url)
  const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString()

  const buffer = await fs.readFile(pdfPath)
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  })

  const doc = await loadingTask.promise
  try {
    const outLines = []
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const content = await page.getTextContent()
      const positioned = content.items
        .map((it) => {
          const tr = Array.isArray(it.transform) ? it.transform : null
          const x = tr ? tr[4] : 0
          const y = tr ? tr[5] : 0
          const str = String(it.str ?? '').trim()
          return { str, x, y }
        })
        .filter((p) => p.str.length > 0)

      outLines.push(...groupIntoLines(positioned))
      outLines.push(`-- ${pageNum} of ${doc.numPages} --`)
    }

    process.stdout.write(
      JSON.stringify({ ok: true, text: outLines.join('\n') }),
    )
  } finally {
    await doc.destroy()
  }
}

main().catch((e) => {
  const message = e instanceof Error ? e.message : String(e)
  process.stdout.write(JSON.stringify({ ok: false, error: message }))
  process.exit(1)
})

