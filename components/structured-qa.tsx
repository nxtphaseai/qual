"use client"

import { useMemo, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/hooks/use-toast"
import { Upload, HelpCircle, Sparkles, Download } from "lucide-react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Bar, LineChart, Line } from "recharts"

type QueryResponse = {
  answer: string
  table?: { columns: string[]; rows: (string | number | null)[][] }
  fieldsUsed?: string[]
  chart?: { type: "bar" | "line" | "none"; x?: string; y?: string; series?: string }
  mode: "openai" | "local"
}

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
        row.push(field)
        field = ""
        rows.push(row)
        row = []
        if (c === "\r" && text[i + 1] === "\n") i += 2
        else i++
        continue
      }
      field += c
      i++
    }
  }
  row.push(field)
  rows.push(row)

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

export default function StructuredQA() {
  const [csvText, setCsvText] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  const [question, setQuestion] = useState<string>("What are the top 25 colours mentioned in the text columns?")
  const [loading, setLoading] = useState(false)
  const [resp, setResp] = useState<QueryResponse | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const preview = useMemo(() => {
    if (!csvText.trim()) return null
    try {
      const { header, rows } = parseCSV(csvText)
      return { header, rows }
    } catch {
      return null
    }
  }, [csvText])

  const onPick = async (file?: File) => {
    try {
      const f = file ?? fileRef.current?.files?.[0]
      if (!f) return
      if (!f.name.toLowerCase().endsWith(".csv")) {
        toast({ title: "Unsupported file", description: "Please upload a .csv file", variant: "destructive" })
        return
      }
      const text = await f.text()
      setCsvText(text)
      setFileName(f.name)
      toast({ title: "File loaded", description: `${f.name}` })
    } catch (e: any) {
      toast({ title: "Failed to read file", description: e?.message || "Please try again", variant: "destructive" })
    }
  }

  const ask = async () => {
    if (!csvText.trim()) {
      toast({ title: "Add a CSV", description: "Upload a .csv file first", variant: "destructive" })
      return
    }
    if (!question.trim()) {
      toast({
        title: "Add a question",
        description: "Ask something like 'biggest gainer over 5 days'",
        variant: "destructive",
      })
      return
    }
    setLoading(true)
    setResp(null)
    try {
      const res = await fetch("/api/structured/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, question, fileName }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Query failed")
      }
      const json = await res.json()
      setResp(json as QueryResponse)
    } catch (e: any) {
      toast({ title: "Query error", description: e?.message || "Please try again", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const downloadTable = () => {
    if (!resp?.table) return
    const { columns, rows } = resp.table
    const csv = [columns.join(","), ...rows.map((r) => r.map((v) => String(v ?? "")).join(","))].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "query-result.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Prepare data for charts
  const chartData = useMemo(() => {
    if (!resp?.table || !resp.chart || resp.chart.type === "none") return null
    const { columns, rows } = resp.table
    const xKey = resp.chart.x
    const yKey = resp.chart.y
    if (!xKey || !yKey) return null
    const xi = columns.indexOf(xKey)
    const yi = columns.indexOf(yKey)
    if (xi < 0 || yi < 0) return null
    return rows.map((r) => ({ [xKey]: r[xi], [yKey]: typeof r[yi] === "string" ? Number(r[yi]) : r[yi] }))
  }, [resp])

  return (
    <div className="mt-4">
      <Alert className="mb-6">
        <HelpCircle className="h-4 w-4" />
        <AlertTitle>Ask questions over CSV</AlertTitle>
        <AlertDescription>
          The tool infers schema intent with an LLM via the AI SDK (OpenAI) when available. Otherwise, a limited local
          fallback is used. You can ask things like “biggest gainer over 5 days” or “top 25 colours mentioned in the
          text.” [^1][^2][^3]
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Upload & Ask</CardTitle>
          <CardDescription>Upload a .csv and ask a natural-language question</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              CSV file
            </Label>
            <div className="flex items-center gap-2">
              <Input ref={fileRef} type="file" accept=".csv" onChange={() => onPick()} />
              {fileName && <Badge variant="secondary">{fileName}</Badge>}
            </div>
            {preview && preview.header.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Preview: {preview.rows.length} rows, {preview.header.length} columns. Showing first{" "}
                  {Math.min(20, preview.rows.length)} rows.
                </div>
                <div className="overflow-auto rounded border max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {preview.header.map((c) => (
                          <th key={c} className="px-2 py-1 text-left font-medium">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.slice(0, 20).map((r, i) => (
                        <tr key={i} className="border-t">
                          {preview.header.map((c) => (
                            <td key={c} className="px-2 py-1">
                              {String(r[c] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="question">Your question</Label>
            <Textarea
              id="question"
              rows={3}
              placeholder='e.g., "Who was the biggest gainer over 5 days?" or "Top 25 colours mentioned in review_text"'
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={ask} disabled={loading || !csvText}>
              <Sparkles className="h-4 w-4 mr-2" />
              {loading ? "Thinking..." : "Ask"}
            </Button>
            {resp?.table && (
              <Button variant="outline" onClick={downloadTable}>
                <Download className="h-4 w-4 mr-2" />
                Export result CSV
              </Button>
            )}
          </div>

          <Separator />

          {resp ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline">{resp.mode === "openai" ? "AI-enhanced" : "Local"}</Badge>
                {resp.fieldsUsed && resp.fieldsUsed.length > 0 && (
                  <div className="text-xs text-muted-foreground">Fields used: {resp.fieldsUsed.join(", ")}</div>
                )}
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Answer</div>
                <p className="text-sm">{resp.answer}</p>
              </div>

              {resp.table && (
                <div className="space-y-3">
                  <div className="text-sm font-medium">Result table</div>
                  <div className="overflow-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          {resp.table.columns.map((c) => (
                            <th key={c} className="px-2 py-1 text-left font-medium">
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {resp.table.rows.slice(0, 100).map((r, i) => (
                          <tr key={i} className="border-t">
                            {r.map((v, j) => (
                              <td key={j} className="px-2 py-1">
                                {String(v ?? "")}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {resp.table.rows.length > 100 && (
                    <div className="text-xs text-muted-foreground">Showing first 100 rows.</div>
                  )}
                </div>
              )}

              {chartData && resp?.chart && (
                <Card>
                  <CardHeader>
                    <CardTitle>Chart</CardTitle>
                    <CardDescription>
                      {resp.chart.type === "bar" ? "Bar chart" : resp.chart.type === "line" ? "Line chart" : ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer
                      config={{
                        series: { label: "Value", color: "hsl(var(--chart-3))" },
                      }}
                      className="h-[280px]"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        {resp.chart.type === "bar" ? (
                          <BarChart data={chartData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey={resp.chart.x!} axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Bar dataKey={resp.chart.y!} fill="var(--color-series)" radius={[4, 4, 0, 0]} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </BarChart>
                        ) : (
                          <LineChart data={chartData}>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            <XAxis dataKey={resp.chart.x!} axisLine={false} tickLine={false} />
                            <YAxis axisLine={false} tickLine={false} />
                            <Line dataKey={resp.chart.y!} stroke="var(--color-series)" strokeWidth={2} dot={false} />
                            <ChartTooltip content={<ChartTooltipContent />} />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </ChartContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              Upload a CSV and ask a question. Examples:
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Which stock had the biggest gainer over 5 days?</li>
                <li>Top 25 colours mentioned in the text columns</li>
                <li>Average satisfaction by region last quarter</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
