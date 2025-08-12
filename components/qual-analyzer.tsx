"use client"

import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { Upload, FileText, Sparkles, Wand2, Trash2, Download, Copy, Info, HelpCircle } from "lucide-react"
import ResultsView, { type AnalyzeResult } from "./results-view"
import FileDrop from "./file-drop"

type Task = "summary" | "themes" | "sentiment" | "entities" | "quotes"

type RecordItem = {
  id: string
  text: string
  meta?: Record<string, any>
}

const DEFAULT_TASKS: Task[] = ["summary", "themes", "sentiment", "entities", "quotes"]

export default function QualAnalyzer() {
  const [pastedText, setPastedText] = useState<string>("")
  const [records, setRecords] = useState<RecordItem[]>([])
  const [questions, setQuestions] = useState<string>("What are the main themes and actionable insights?")
  const [selectedTasks, setSelectedTasks] = useState<Task[]>(DEFAULT_TASKS)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [modeUsed, setModeUsed] = useState<"local" | "openai">("local")
  const [providerChoice, setProviderChoice] = useState<"local" | "openai">("local")

  const combinedPreview = useMemo(() => {
    const pastePreview = pastedText.trim()
    const filePreview = records
      .slice(0, 5)
      .map((r) => r.text)
      .join("\n\n")
    return [pastePreview, filePreview].filter(Boolean).join("\n\n")
  }, [pastedText, records])

  const onClearAll = () => {
    setPastedText("")
    setRecords([])
    setQuestions("What are the main themes and actionable insights?")
    setSelectedTasks(DEFAULT_TASKS)
    setResult(null)
    setModeUsed("local")
  }

  const addSample = async () => {
    try {
      const res = await fetch("/data/sample.txt")
      const txt = await res.text()
      // Split into paragraph records
      const chunks = txt
        .split(/\n\s*\n/g)
        .map((t, i) => ({ id: `sample-${i + 1}`, text: t.trim() }))
        .filter((r) => r.text.length > 0)
      setRecords((prev) => [...prev, ...chunks])
      toast({ title: "Sample data added", description: `${chunks.length} entries loaded.` })
    } catch (e) {
      toast({ title: "Failed to load sample", description: "Please try again.", variant: "destructive" })
    }
  }

  const onFilesParsed = (items: RecordItem[]) => {
    if (items.length === 0) {
      toast({ title: "No readable content found", description: "Supported: .txt, .csv, .json", variant: "destructive" })
      return
    }
    setRecords((prev) => [...prev, ...items])
    toast({ title: "Files added", description: `${items.length} records parsed.` })
  }

  const removeRecord = (id: string) => {
    setRecords((prev) => prev.filter((r) => r.id !== id))
  }

  const toggleTask = (task: Task) => {
    setSelectedTasks((prev) => (prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]))
  }

  const buildPayload = useCallback(() => {
    const pastedRecs: RecordItem[] = pastedText.trim().length
      ? pastedText
          .split(/\n\s*\n/g)
          .map((t, i) => ({ id: `paste-${i + 1}`, text: t.trim() }))
          .filter((r) => r.text.length > 0)
      : []
    const all = [...pastedRecs, ...records]
    // Deduplicate by identical text
    const seen = new Set<string>()
    const deduped = all.filter((r) => {
      const key = r.text
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    return deduped
  }, [pastedText, records])

  const analyze = async () => {
    const data = buildPayload()
    if (data.length === 0) {
      toast({ title: "Add some data", description: "Paste text or upload files to analyze.", variant: "destructive" })
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data,
          tasks: selectedTasks,
          questions,
          provider: providerChoice, // "local" or "openai"
          model: providerChoice === "openai" ? "o3-mini" : undefined,
          reasoningEffort: providerChoice === "openai" ? "low" : undefined,
        }),
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Analysis failed")
      }
      const json = await res.json()
      setResult(json.result as AnalyzeResult)
      setModeUsed(json.mode as "local" | "openai")
      toast({
        title: "Analysis complete",
        description: json.mode === "openai" ? "AI-enhanced insights generated." : "Local analysis complete.",
      })
    } catch (e: any) {
      toast({ title: "Analysis error", description: e.message || "Please try again.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const exportJSON = () => {
    if (!result) return
    const blob = new Blob([JSON.stringify({ result, questions, tasks: selectedTasks }, null, 2)], {
      type: "application/json",
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "qual-analysis.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Qualitative Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Paste text or upload files, then extract themes, summaries, sentiment, entities, and quotes. Use Local mode
          (no API) or enable AI-enhanced analysis on the server with an OpenAI key.
        </p>
      </div>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Modes</AlertTitle>
        <AlertDescription>
          AI-enhanced mode uses the AI SDK with OpenAI models and supports structured outputs and adjustable reasoning
          effort for o3-mini. Configure OPENAI_API_KEY on the server to enable it [^1][^2][^3].
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Data</CardTitle>
            <CardDescription>Paste text or upload .txt, .csv, .json files</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="pasted" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Pasted text
              </Label>
              <Textarea
                id="pasted"
                placeholder="Paste your notes, feedback, transcripts, tickets, etc."
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                rows={8}
              />
              <div className="text-xs text-muted-foreground">
                Tip: Separate items with a blank line for better segmentation.
              </div>
            </div>

            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload files
              </Label>
              <FileDrop onParsed={onFilesParsed} />
              {records.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{records.length} items loaded</span>
                      <Button variant="ghost" size="sm" onClick={() => setRecords([])}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear files
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-auto rounded border">
                      <ul className="divide-y text-sm">
                        {records.slice(0, 50).map((r) => (
                          <li key={r.id} className="p-2 flex items-start justify-between gap-2">
                            <span className="line-clamp-2 text-left">{r.text}</span>
                            <Button
                              aria-label="Remove item"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRecord(r.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {records.length > 50 && (
                      <div className="text-xs text-muted-foreground">Showing first 50 items.</div>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={addSample}>
                <Wand2 className="h-4 w-4 mr-2" />
                Add sample data
              </Button>
              <Button variant="ghost" onClick={onClearAll}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear all
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Guide the analysis</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="questions" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Questions or goals
              </Label>
              <Textarea
                id="questions"
                rows={4}
                placeholder="E.g., What are top themes? What should we improve? What surprised users?"
                value={questions}
                onChange={(e) => setQuestions(e.target.value)}
              />
            </div>

            <div className="grid gap-3">
              <Label>Tasks</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["summary", "themes", "sentiment", "entities", "quotes"] as Task[]).map((task) => (
                  <label
                    key={task}
                    className={cn(
                      "flex items-center gap-2 rounded border p-2 text-sm cursor-pointer",
                      selectedTasks.includes(task) ? "bg-muted" : "",
                    )}
                  >
                    <Checkbox
                      checked={selectedTasks.includes(task)}
                      onCheckedChange={() => toggleTask(task)}
                      aria-label={`Toggle ${task}`}
                    />
                    <span className="capitalize">{task}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Mode</Label>
              <Tabs value={providerChoice} onValueChange={(v) => setProviderChoice(v as "local" | "openai")}>
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger value="local">Local (no API)</TabsTrigger>
                  <TabsTrigger value="openai">AI-enhanced (OpenAI)</TabsTrigger>
                </TabsList>
                <TabsContent value="local" className="text-sm text-muted-foreground">
                  Fast heuristic analysis. No setup required.
                </TabsContent>
                <TabsContent value="openai" className="text-sm text-muted-foreground">
                  Requires OPENAI_API_KEY on the server. Falls back to Local if unavailable.
                </TabsContent>
              </Tabs>
            </div>

            <div className="flex items-center gap-2">
              <Button className="w-full" onClick={analyze} disabled={loading}>
                <Sparkles className="h-4 w-4 mr-2" />
                {loading ? "Analyzing..." : "Run analysis"}
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Preview of your data (first few items):
              <br />
              <code className="block max-h-24 overflow-auto rounded bg-muted p-2">{combinedPreview || "—"}</code>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 space-y-4">
        {result ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="secondary">{modeUsed === "openai" ? "AI-enhanced" : "Local"}</Badge>
                <span className="text-muted-foreground">
                  Based on {records.length + (pastedText.trim() ? pastedText.split(/\n\s*\n/g).length : 0)} items
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportJSON}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy result
                </Button>
              </div>
            </div>
            <ResultsView result={result} />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No results yet</CardTitle>
              <CardDescription>Run an analysis to see insights here.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                <li>Paste text or upload .txt/.csv/.json files</li>
                <li>Add your questions to guide the analysis</li>
                <li>Choose Local or AI-enhanced mode</li>
                <li>Click Run analysis</li>
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
