import type { NextRequest } from "next/server"
import { z } from "zod"
import { generateObject } from "ai"
import { openai } from "@/lib/openai-config"

type Table = { columns: string[]; rows: (string | number | null)[][] }
type QueryResponse = {
  answer: string
  table?: Table
  fieldsUsed?: string[]
  chart?: { type: "bar" | "line" | "none"; x?: string; y?: string; series?: string }
  mode: "openai" | "local"
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const csvText: string = body?.csvText || ""
    const question: string = body?.question || ""
    const fileName: string = body?.fileName || "uploaded.csv"

    if (!csvText.trim()) return new Response("Missing csvText", { status: 400 })
    if (!question.trim()) return new Response("Missing question", { status: 400 })

    // Parse CSV on server to get header, types, and a small sample we can show to the LLM
    const parsed = parseCSV(csvText)
    if (!parsed.rows.length) return new Response("CSV is empty", { status: 400 })
    const header = parsed.header
    const types = inferTypes(parsed.rows, header)
    const sampleRows = parsed.rows.slice(0, 200) // cap to keep prompt small

    const hasKey = !!process.env.OPENAI_API_KEY
    if (hasKey) {
      // LLM-based schema + intent inference and answer generation
      const schema = z.object({
        answer: z.string().describe("A concise natural-language answer to the user's question"),
        table: z
          .object({
            columns: z.array(z.string()),
            rows: z.array(z.array(z.union([z.string(), z.number(), z.null()]))),
          })
          .optional(),
        fieldsUsed: z.array(z.string()).optional(),
        chart: z
          .object({
            type: z.enum(["bar", "line", "none"]).default("none"),
            x: z.string().optional(),
            y: z.string().optional(),
            series: z.string().optional(),
          })
          .optional(),
      })

      const sys =
        "You are a data analyst. Infer the schema and intent, then compute the answer using the provided CSV schema and sample rows. Prefer precise numeric outputs. If appropriate, include a compact result table."

      const { object } = await generateObject({
        // You can switch models; gpt-4o-mini is a good default for speed/cost
        model: openai.responses("gpt-4o-mini"),
        schema,
        prompt: [
          sys,
          `File name: ${fileName}`,
          `User question:\n${question}`,
          `Columns and inferred types:\n${header.map((h) => `- ${h}: ${types[h]}`).join("\n")}`,
          `Sample rows (JSON array of objects; max 200 rows):\n${JSON.stringify(sampleRows.slice(0, 200), null, 2)}`,
          `Instructions:
- Use column names exactly as provided.
- Be robust to messy text and missing values.
- If the question asks for counts of terms (e.g., colors) and text columns exist, tokenize and count.
- If time windows are involved (e.g., "over 5 days"), use the date-like column(s) and compute deltas where sensible.
- Return a concise 'answer' plus an optional 'table' with machine-readable results. If a chart would help, suggest a 'chart' type with x and y columns.`,
        ].join("\n\n"),
      })

      const resp: QueryResponse = {
        answer: object.answer,
        table: object.table,
        fieldsUsed: object.fieldsUsed,
        chart: object.chart ?? { type: "none" },
        mode: "openai",
      }
      return Response.json(resp)
    }

    // Local fallback for a narrow class of questions (e.g., colors in text)
    const fallback = localStructuredFallback(question, parsed)
    if (!fallback) {
      return new Response(
        "AI not configured. Set OPENAI_API_KEY to enable automatic schema inference and natural-language querying.",
        { status: 400 },
      )
    }
    return Response.json({ ...fallback, mode: "local" } satisfies QueryResponse)
  } catch (e: any) {
    return new Response(e?.message || "Server error", { status: 500 })
  }
}

// ---- CSV utilities ----

function parseCSV(text: string): { header: string[]; rows: Record<string, string>[] } {
  const rows: string[][] = []
  let i = 0
  const len = text.length
  let field = ""
  let row: string[] = []
  let inQuotes = false

  while (i < len) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        field += c
        i++
        continue
      }
    } else {
      if (c === '"') {
        inQuotes = true
        i++
        continue
      }
      if (c === ",") {
        row.push(field)
        field = ""
        i++
        continue
      }
      if (c === "\n" || c === "\r") {
        // handle CRLF/LF
        // finalize field
        row.push(field)
        field = ""
        rows.push(row)
        row = []
        // consume \r\n
        if (c === "\r" && text[i + 1] === "\n") i += 2
        else i++
        continue
      }
      field += c
      i++
    }
  }
  // last field
  row.push(field)
  rows.push(row)

  // remove empty trailing rows
  while (rows.length && rows[rows.length - 1].every((v) => v === "")) rows.pop()

  if (!rows.length) return { header: [], rows: [] }

  const header = rows[0].map((h) => (h || "").trim())
  const dataRows = rows.slice(1).filter((r) => r.some((v) => (v || "").trim().length > 0))
  const out: Record<string, string>[] = dataRows.map((r) => {
    const obj: Record<string, string> = {}
    for (let j = 0; j < header.length; j++) {
      obj[header[j]] = (r[j] ?? "").trim()
    }
    return obj
  })
  return { header, rows: out }
}

function inferTypes(rows: Record<string, string>[], header: string[]) {
  const types: Record<string, "number" | "date" | "text"> = {}
  for (const h of header) {
    const sample = rows
      .slice(0, 200)
      .map((r) => r[h])
      .filter((v) => v !== undefined && v !== "")
    let numCount = 0
    let dateCount = 0
    for (const v of sample) {
      const n = Number(v.replace(/[, ]/g, ""))
      if (!Number.isNaN(n) && v !== "") numCount++
      if (isLikelyDate(v)) dateCount++
    }
    if (dateCount >= Math.max(3, Math.ceil(sample.length * 0.3))) types[h] = "date"
    else if (numCount >= Math.max(3, Math.ceil(sample.length * 0.5))) types[h] = "number"
    else types[h] = "text"
  }
  return types
}

function isLikelyDate(v: string) {
  if (!v) return false
  // ISO or common formats
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{2}\/\d{2}\/\d{4}$/.test(v) || /^[A-Za-z]{3,9}\s+\d{1,2},\s*\d{4}$/.test(v)
  )
}

// ---- Local fallback: colors term frequency across text columns ----

const COLORS = [
  "red",
  "blue",
  "green",
  "yellow",
  "black",
  "white",
  "orange",
  "purple",
  "pink",
  "brown",
  "gray",
  "grey",
  "teal",
  "cyan",
  "magenta",
  "navy",
  "maroon",
  "beige",
  "gold",
  "silver",
  "violet",
  "indigo",
  "turquoise",
  "lavender",
  "olive",
  "lime",
  "peach",
  "tan",
  "aqua",
]

function localStructuredFallback(
  question: string,
  parsed: { header: string[]; rows: Record<string, string>[] },
): Omit<QueryResponse, "mode"> | null {
  const q = question.toLowerCase()
  const textCols = parsed.header.filter((h) => !allNumeric(parsed.rows.map((r) => r[h])))
  if ((q.includes("colour") || q.includes("color")) && textCols.length) {
    const counts = new Map<string, number>()
    for (const row of parsed.rows.slice(0, 5000)) {
      for (const col of textCols) {
        const val = (row[col] || "").toLowerCase()
        for (const c of COLORS) {
          const re = new RegExp(`\\b${c}\\b`, "g")
          const matches = val.match(re)
          if (matches) counts.set(c, (counts.get(c) || 0) + matches.length)
        }
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)
    const table: Table = {
      columns: ["color", "count"],
      rows: sorted.map(([c, n]) => [c, n]),
    }
    const answer = `Top ${sorted.length} colors in text columns: ` + sorted.map(([c, n]) => `${c} (${n})`).join(", ")
    return { answer, table, fieldsUsed: textCols, chart: { type: "bar", x: "color", y: "count" } }
  }
  return null
}

function allNumeric(vals: string[]) {
  let ok = 0
  for (const v of vals.slice(0, 50)) {
    const n = Number((v || "").replace(/[, ]/g, ""))
    if (!Number.isNaN(n) && v !== "") ok++
  }
  return ok >= Math.max(3, Math.ceil(Math.min(50, vals.length) * 0.7))
}
