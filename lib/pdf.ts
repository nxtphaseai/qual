import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib"

export type PDFStepResult = { title: string; summary: string; sources: Array<{ title?: string; url: string }> }

// Replace common Unicode punctuation with WinAnsi-safe ASCII to avoid encoding errors.
function sanitizeWinAnsi(input: string): string {
  if (!input) return ""
  return input
    .replace(/\u2018|\u2019/g, "'") // ‘ ’ -> '
    .replace(/\u201C|\u201D/g, '"') // “ ” -> "
    .replace(/\u2013|\u2014|\u2011/g, "-") // – — ‑ -> - Added U+2011 non-breaking hyphen
    .replace(/\u2022|\u25E6|\u25CF|\u25AA/g, "*") // • ◦ ● ▪ -> *
    .replace(/\u2026/g, "...") // … -> ...
    .replace(/\u00A0/g, " ") // nbsp -> space
    .replace(/\u2192/g, "->") // → -> ->
    .replace(/\u2713|\u2714/g, "v") // ✓ ✔ -> v
    .replace(/\u2264/g, "<=") // ≤ -> <=
    .replace(/\u2265/g, ">=") // ≥ -> >=
    .replace(/\u00B1/g, "+/-") // ± -> +/-
    .replace(/\u00D7/g, "x") // × -> x
    .replace(/\u00F7/g, "/") // ÷ -> /
  // You can add more mappings as needed
}

export async function generateResearchPdf(
  report: {
    title: string
    executiveSummary: string[]
    keySections: Array<{ heading: string; bullets: string[] }>
    questionsToAsk: string[]
    glossary: Array<{ term: string; definition: string }>
    sources: Array<{ title?: string; url: string }>
  },
  stepResults: PDFStepResult[] = [],
) {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageMargin = 48
  const titleSize = 20
  const headingSize = 14
  const textSize = 11
  const lineGap = 4

  let page = pdfDoc.addPage()
  let { width, height } = page.getSize()
  let y = height - pageMargin

  function addPage() {
    page = pdfDoc.addPage()
    ;({ width, height } = page.getSize())
    y = height - pageMargin
  }

  function ensureSpace(linesNeeded = 1, size = textSize) {
    const needed = linesNeeded * (size + lineGap)
    if (y - needed < pageMargin) addPage()
  }

  function drawText(text: string, size = textSize, bold = false) {
    const safe = sanitizeWinAnsi(text)
    const usedFont = bold ? fontBold : font
    ensureSpace(1, size)
    page.drawText(safe, { x: pageMargin, y: y - size, size, font: usedFont, color: rgb(0, 0, 0) })
    y -= size + lineGap
  }

  function drawWrapped(text: string, size = textSize, bold = false, indent = 0) {
    const safe = sanitizeWinAnsi(text)
    const usedFont = bold ? fontBold : font
    const maxWidth = width - pageMargin * 2 - indent
    const lines = wrapText(safe, usedFont, size, maxWidth)
    for (const line of lines) {
      ensureSpace(1, size)
      page.drawText(line, {
        x: pageMargin + indent,
        y: y - size,
        size,
        font: usedFont,
        color: rgb(0, 0, 0),
      })
      y -= size + lineGap
    }
  }

  // Bullet lines with ASCII bullet only to avoid encoding errors
  function drawBullet(text: string, size = textSize, bullet = "-") {
    const safeBullet = sanitizeWinAnsi(bullet || "-")
    const usedBullet = safeBullet || "-"
    const safeText = sanitizeWinAnsi(text)
    const bulletWidth = font.widthOfTextAtSize(usedBullet + " ", size)
    const maxWidth = width - pageMargin * 2 - bulletWidth
    const lines = wrapText(safeText, font, size, maxWidth)
    for (let i = 0; i < lines.length; i++) {
      ensureSpace(1, size)
      if (i === 0) {
        page.drawText(usedBullet, { x: pageMargin, y: y - size, size, font, color: rgb(0, 0, 0) })
      }
      page.drawText(lines[i], {
        x: pageMargin + bulletWidth,
        y: y - size,
        size,
        font,
        color: rgb(0, 0, 0),
      })
      y -= size + lineGap
    }
  }

  // Title
  drawWrapped(report.title || "Research Briefing", titleSize, true)

  // Executive Summary
  drawText("Executive Summary", headingSize, true)
  for (const bullet of report.executiveSummary ?? []) {
    drawBullet(bullet)
  }

  // Step Results
  if (stepResults.length) {
    drawText("Research Steps and Outputs", headingSize, true)
    for (let i = 0; i < stepResults.length; i++) {
      const step = stepResults[i]
      drawWrapped(`Step ${i + 1}: ${step.title}`, textSize + 1, true)
      const summaryLines = (step.summary || "").split(/\n+/).filter(Boolean)
      for (const s of summaryLines) {
        // Treat lines starting with common bullet chars as bullets; normalize to ASCII
        const t = s.replace(/^[-*\u2022\u25E6\u25CF\u25AA]+\s*/, "")
        drawBullet(t)
      }
      if (step.sources?.length) {
        drawWrapped("Sources:", textSize, true)
        for (const src of step.sources.slice(0, 20)) {
          const label = (src.title ? `${src.title} — ` : "") + src.url
          drawBullet(label, 10, "-")
        }
      }
    }
  }

  // Key Sections
  if (report.keySections?.length) {
    drawText("Key Sections", headingSize, true)
    for (const section of report.keySections) {
      drawWrapped(section.heading, textSize + 1, true)
      for (const b of section.bullets ?? []) {
        drawBullet(b)
      }
    }
  }

  // Questions to Ask
  if (report.questionsToAsk?.length) {
    drawText("Questions to Ask", headingSize, true)
    for (const q of report.questionsToAsk) {
      drawBullet(q)
    }
  }

  // Glossary
  if (report.glossary?.length) {
    drawText("Glossary", headingSize, true)
    for (const g of report.glossary) {
      drawBullet(`${g.term}: ${g.definition}`)
    }
  }

  // Consolidated Sources
  if (report.sources?.length) {
    drawText("Consolidated Sources", headingSize, true)
    for (const s of report.sources.slice(0, 100)) {
      const label = (s.title ? `${s.title} — ` : "") + s.url
      drawBullet(label, 10, "-")
    }
  }

  const bytes = await pdfDoc.save()
  return new Blob([bytes], { type: "application/pdf" })
}

// Word-wrap helper that assumes input is already sanitized to WinAnsi-safe text
function wrapText(text: string, usedFont: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ""
  for (const w of words) {
    const candidate = current ? current + " " + w : w
    const width = usedFont.widthOfTextAtSize(candidate, size)
    if (width <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      // Long single word fallback: hard break the word
      if (usedFont.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = ""
        for (const ch of w) {
          const test = chunk ? chunk + ch : ch
          if (usedFont.widthOfTextAtSize(test, size) > maxWidth) {
            if (chunk) lines.push(chunk)
            chunk = ch
          } else {
            chunk = test
          }
        }
        current = chunk
      } else {
        current = w
      }
    }
  }
  if (current) lines.push(current)
  return lines
}

export async function downloadResearchPdf(
  filename: string,
  report: Parameters<typeof generateResearchPdf>[0],
  stepResults: Parameters<typeof generateResearchPdf>[1] = [],
) {
  const blob = await generateResearchPdf(report, stepResults)
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
