"use client"

import React, { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Combobox } from "@/components/ui/combobox"
import { Square, Trash2, Rocket, Loader2, Lightbulb, ChevronDown, ChevronRight, Clock, Brain } from "lucide-react"
import ReactMarkdown from "react-markdown"
import ResearchReport from "./research-report"
import EntityText from "./entity-text"
import LockedEntityMarkdown from "./locked-entity-markdown"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type PlanStep = {
  title: string
  rationale: string
  queries: string[]
  expectedOutputs: string[]
  include?: boolean
}

type PlanResponse = {
  questions: string[]
  clarifyingQuestions: string[]
  steps: PlanStep[]
}

type StepResult = { title: string; summary: string; sources: Array<{ title?: string; url: string }> }

function sanitizeStep(s: any): PlanStep {
  return {
    title: typeof s?.title === "string" ? s.title : "",
    rationale: typeof s?.rationale === "string" ? s.rationale : "",
    queries: Array.isArray(s?.queries) ? s.queries.filter(Boolean) : [],
    expectedOutputs: Array.isArray(s?.expectedOutputs) ? s.expectedOutputs.filter(Boolean) : [],
    include: s?.include === false ? false : true,
  }
}

const LS_KEYS = {
  topic: "ra_topic",
  context: "ra_context",
  goals: "ra_goals",
  model: "ra_model",
  effort: "ra_effort",
}

type Effort = "low" | "medium" | "high"

const exampleTopics = [
  {
    value: "vacuum-bags",
    label: "Vacuum bags industry basics and landscape",
    topic: "Vacuum bags industry basics and landscape",
    context:
      "I have a call with a vacuum bag manufacturer. I want to understand market overview, key players, product types, materials, use-cases, supply chain, pricing dynamics, regulations, and current trends.",
    goals: "Quickly brief me to sound informed, plus 10 sharp questions I can ask on the call.",
  },
  {
    value: "ai-chips",
    label: "AI chip market and semiconductor trends",
    topic: "AI chip market and semiconductor trends",
    context:
      "Preparing for a meeting with an AI hardware startup. Need to understand the competitive landscape, key technologies (GPUs, TPUs, neuromorphic chips), major players like NVIDIA, AMD, Intel, and emerging startups.",
    goals:
      "Get up to speed on market dynamics, technical differentiators, and investment trends. Prepare insightful questions about their technology stack and go-to-market strategy.",
  },
  {
    value: "sustainable-packaging",
    label: "Sustainable packaging solutions and regulations",
    topic: "Sustainable packaging solutions and regulations",
    context:
      "Meeting with a CPG company exploring eco-friendly packaging alternatives. Need to understand biodegradable materials, recycling technologies, regulatory requirements, and cost implications.",
    goals:
      "Understand the sustainability landscape, key innovations, and regulatory pressures. Prepare questions about implementation challenges and ROI.",
  },
  {
    value: "fintech-payments",
    label: "Digital payments and fintech disruption",
    topic: "Digital payments and fintech disruption",
    context:
      "Due diligence call with a payments startup. Need to understand the competitive landscape, regulatory environment, key technologies (blockchain, APIs, mobile wallets), and market opportunities.",
    goals:
      "Get briefed on payment rails, compliance requirements, and competitive positioning. Prepare technical and business model questions.",
  },
  {
    value: "remote-work-tools",
    label: "Remote work software and collaboration tools",
    topic: "Remote work software and collaboration tools",
    context:
      "Evaluating enterprise software vendors for our remote workforce. Need to understand the market landscape, key players, feature comparisons, security considerations, and pricing models.",
    goals:
      "Compare solutions objectively and understand implementation challenges. Prepare vendor evaluation criteria and negotiation points.",
  },
]

export default function ResearchAgent() {
  // Defaults used when nothing is in localStorage
  const defaultTopic = exampleTopics[0].topic
  const defaultContext = exampleTopics[0].context
  const defaultGoals = exampleTopics[0].goals

  const [topic, setTopic] = useState(defaultTopic)
  const [context, setContext] = useState(defaultContext)
  const [goals, setGoals] = useState(defaultGoals)
  const [timebox, setTimebox] = useState("20 minutes")

  // Model/effort
  const [model, setModel] = useState<string>("gpt-4o")
  const [effort, setEffort] = useState<Effort>("low")

  // Plan state
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [planCtrl, setPlanCtrl] = useState<AbortController | null>(null)

  // Execution state
  const [executing, setExecuting] = useState(false)
  const [execCtrl, setExecCtrl] = useState<AbortController | null>(null)
  const [stepResults, setStepResults] = useState<StepResult[]>([])
  const [execReport, setExecReport] = useState(null)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  
  // UI state
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set())
  const [thinkingSteps, setThinkingSteps] = useState<Set<number>>(new Set())
  const [thinkingActivity, setThinkingActivity] = useState<Record<number, string>>({})
  const [planStepsExpanded, setPlanStepsExpanded] = useState(true)
  const [briefExpanded, setBriefExpanded] = useState(true)
  
  // Thinking activities that rotate
  const thinkingActivities = [
    "Analyzing sources and gathering insights...",
    "Researching authoritative references...",
    "Cross-referencing information...",
    "Synthesizing key findings...",
    "Evaluating source credibility...",
    "Connecting related concepts...",
    "Identifying patterns and trends...",
    "Distilling complex information...",
    "Organizing research findings...",
    "Validating information accuracy...",
    "Exploring different perspectives...",
    "Contextualizing the data...",
    "Drawing meaningful conclusions...",
    "Structuring the analysis...",
    "Refining the insights...",
    "Considering implications...",
    "Weighing evidence...",
    "Formulating recommendations...",
    "Building comprehensive understanding...",
    "Connecting the dots..."
  ];
  

  const activeSteps = plan?.steps?.filter((s) => s.include !== false) ?? []
  
  // Function to get a random thinking activity
  const getRandomThinkingActivity = useCallback(() => {
    return thinkingActivities[Math.floor(Math.random() * thinkingActivities.length)]
  }, [])
  
  // Effect to rotate thinking activities with random timing (5-10 seconds)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout
    
    const scheduleNextUpdate = () => {
      // Random interval between 5-10 seconds (5000-10000ms)
      const randomDelay = Math.floor(Math.random() * 5000) + 5000
      
      timeoutId = setTimeout(() => {
        setThinkingActivity(prev => {
          const newActivities = { ...prev }
          Object.keys(prev).forEach(key => {
            const stepIndex = parseInt(key)
            if (thinkingSteps.has(stepIndex)) {
              newActivities[stepIndex] = getRandomThinkingActivity()
            }
          })
          return newActivities
        })
        // Schedule the next update
        scheduleNextUpdate()
      }, randomDelay)
    }
    
    // Start the first update cycle
    scheduleNextUpdate()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [thinkingSteps, getRandomThinkingActivity])

  // Load last values on mount
  useEffect(() => {
    try {
      const t = localStorage.getItem(LS_KEYS.topic)
      const c = localStorage.getItem(LS_KEYS.context)
      const g = localStorage.getItem(LS_KEYS.goals)
      const m = localStorage.getItem(LS_KEYS.model)
      const e = localStorage.getItem(LS_KEYS.effort)
      if (t && t.trim()) setTopic(t)
      if (c && c.trim()) setContext(c)
      if (g && g.trim()) setGoals(g)
      if (m && m.trim()) setModel(m)
      if (e && ["low", "medium", "high"].includes(e)) setEffort(e as Effort)
    } catch {
      // ignore
    }
  }, [])

  // Persist values with a small debounce
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(LS_KEYS.topic, topic || "")
        localStorage.setItem(LS_KEYS.context, context || "")
        localStorage.setItem(LS_KEYS.goals, goals || "")
        localStorage.setItem(LS_KEYS.model, model || "")
        localStorage.setItem(LS_KEYS.effort, effort || "low")
      } catch {
        // ignore
      }
    }, 300)
    return () => clearTimeout(id)
  }, [topic, context, goals, model, effort])

  // SSE reader (abort-safe)
  async function readEventStream(res: Response, onEvent: (evt: any) => void, signal?: AbortSignal) {
    if (!res.body) throw new Error("No response body")
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    const cancelOnAbort = async () => {
      try {
        await reader.cancel()
      } catch {}
    }
    if (signal) {
      if (signal.aborted) {
        await cancelOnAbort()
        return
      }
      signal.addEventListener("abort", cancelOnAbort, { once: true })
    }

    try {
      while (true) {
        let chunk
        try {
          chunk = await reader.read()
        } catch (e: any) {
          const msg = e?.message || ""
          if (signal?.aborted || e?.name === "AbortError" || /aborted/i.test(msg)) {
            break
          }
          throw e
        }
        const { value, done } = chunk
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        let idx
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const part = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const lines = part.split("\n")
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim()
              if (dataStr === "[DONE]") continue
              try {
                const obj = JSON.parse(dataStr)
                onEvent(obj)
              } catch {
                // ignore partial JSON fragments
              }
            }
          }
        }

        if (signal?.aborted) break
      }
    } finally {
      try {
        reader.releaseLock()
      } catch {}
      if (signal) {
        signal.removeEventListener("abort", cancelOnAbort)
      }
    }
  }

  async function generatePlanStream() {
    if (!topic.trim()) {
      alert("Add a topic")
      return
    }
    setLoadingPlan(true)
    setPlan({ questions: [], clarifyingQuestions: [], steps: [] })
    setStepResults([])
    setExecReport(null)
    setProgress(null)
    const ctrl = new AbortController()
    setPlanCtrl(ctrl)
    try {
      const res = await fetch("/api/research/plan/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context, goals, timebox, model, reasoningEffort: effort }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Failed to draft plan")
      }
      await readEventStream(
        res,
        (evt) => {
          if (evt.type === "error") {
            alert("Plan error: " + (evt.message || "Failed to draft plan"))
          } else if (evt.type === "plan-partial") {
            const p = evt.partial
            setPlan((prev) => {
              const merged = {
                questions: p.questions ?? prev?.questions ?? [],
                clarifyingQuestions: p.clarifyingQuestions ?? prev?.clarifyingQuestions ?? [],
                steps: p.steps ? p.steps.map((s: any) => sanitizeStep(s)) : (prev?.steps ?? []),
              }
              return merged
            })
          } else if (evt.type === "plan-final") {
            const finalPlan = evt.plan
            setPlan({
              questions: finalPlan.questions ?? [],
              clarifyingQuestions: finalPlan.clarifyingQuestions ?? [],
              steps: (finalPlan.steps ?? []).map((s: any) => sanitizeStep(s)),
            })
          }
        },
        ctrl.signal,
      )
    } catch (e: any) {
      const msg = e?.message || ""
      if (e?.name === "AbortError" || /BodyStreamBuffer was aborted/i.test(msg)) {
        alert("Plan canceled")
      } else {
        alert("Failed to draft plan: " + (msg || "Please try again"))
      }
    } finally {
      setLoadingPlan(false)
      setPlanCtrl(null)
    }
  }

  async function executePlanStream() {
    if (!plan) {
      alert("No plan yet")
      return
    }
    setExecuting(true)
    setStepResults([])
    setExecReport(null)
    setProgress({ current: 0, total: Math.max(1, activeSteps.length) }) // at least 1 for final
    setThinkingSteps(new Set())
    setExpandedSteps(new Set())
    setThinkingActivity({})
    setPlanStepsExpanded(false) // Collapse plan steps when execution starts
    setBriefExpanded(false) // Collapse brief section when execution starts
    const ctrl = new AbortController()
    setExecCtrl(ctrl)
    try {
      const res = await fetch("/api/research/execute/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, context, goals, timebox, steps: activeSteps, model, reasoningEffort: effort }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || "Execution failed")
      }
      await readEventStream(
        res,
        (evt) => {
          if (evt.type === "error") {
            alert("Execution error: " + (evt.message || "Failed to execute"))
          } else if (evt.type === "progress") {
            setProgress({ current: evt.current, total: evt.total })
          } else if (evt.type === "step-start") {
            const index = evt.index
            const title = evt.title
            setThinkingSteps(prev => new Set(prev).add(index))
            setThinkingActivity(prev => ({
              ...prev,
              [index]: getRandomThinkingActivity()
            }))
            setStepResults((prev) => {
              const next = [...prev]
              next[index] = { title, summary: "", sources: [] }
              return next
            })
            // Auto-expand the current step
            setExpandedSteps(prev => {
              const newSet = new Set(prev)
              newSet.add(index)
              return newSet
            })
          } else if (evt.type === "step-sources") {
            const index = evt.index
            const sources = evt.sources ?? []
            setStepResults((prev) => {
              const next = [...prev]
              const existing = next[index] ?? { title: `Step ${index + 1}`, summary: "", sources: [] }
              next[index] = { ...existing, sources }
              return next
            })
          } else if (evt.type === "step-chunk") {
            const index = evt.index
            const text = evt.text ?? ""
            // Remove from thinking state when first chunk arrives
            setThinkingSteps(prev => {
              const newSet = new Set(prev)
              newSet.delete(index)
              return newSet
            })
            // Clean up thinking activity
            setThinkingActivity(prev => {
              const newActivity = { ...prev }
              delete newActivity[index]
              return newActivity
            })
            setStepResults((prev) => {
              const next = [...prev]
              const existing = next[index] ?? { title: `Step ${index + 1}`, summary: "", sources: [] }
              next[index] = { ...existing, summary: (existing.summary || "") + text }
              return next
            })
          } else if (evt.type === "step-end") {
            const index = evt.index
            const summary = evt.summary ?? ""
            setStepResults((prev) => {
              const next = [...prev]
              const existing = next[index] ?? { title: `Step ${index + 1}`, summary: "", sources: [] }
              next[index] = { ...existing, summary: summary || existing.summary }
              return next
            })
            // Close the completed step after a brief delay (3 seconds)
            setTimeout(() => {
              setExpandedSteps(prev => {
                const newSet = new Set(prev)
                newSet.delete(index)
                return newSet
              })
            }, 3000)
          } else if (evt.type === "step") {
            const step = evt.step
            setStepResults((prev) => [...prev, step])
          } else if (evt.type === "report") {
            setExecReport(evt.report)
          }
        },
        ctrl.signal,
      )
    } catch (e: any) {
      const msg = e?.message || ""
      if (e?.name === "AbortError" || /BodyStreamBuffer was aborted/i.test(msg)) {
        alert("Execution canceled")
      } else {
        alert("Execution failed: " + (msg || "Please try again"))
      }
    } finally {
      setExecuting(false)
      setExecCtrl(null)
    }
  }

  function addManualStep() {
    const newStep = {
      title: "Custom step",
      rationale: "",
      queries: [],
      expectedOutputs: [],
      include: true,
    }
    setPlan((prev) =>
      prev
        ? { ...prev, steps: [...prev.steps, newStep] }
        : { questions: [], clarifyingQuestions: [], steps: [newStep] },
    )
  }

  function deleteStep(idx: number) {
    setPlan((prev) => (prev ? { ...prev, steps: prev.steps.filter((_, i) => i !== idx) } : prev))
  }

  const handleTopicSelect = (value: string) => {
    const selected = exampleTopics.find((t) => t.value === value)
    if (selected) {
      setTopic(selected.topic)
      setContext(selected.context)
      setGoals(selected.goals)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-blue-100 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="bg-blue-500 text-white p-2 rounded-lg">
            <Rocket className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Qualitative Research Agent (QRA)</h2>
            <p className="text-sm">
              Drafts a plan, lets you review, and executes research with streaming updates and sources.
            </p>
          </div>
        </div>
      </div>

      {/* Step 1: Intake */}
      <Card>
        <CardHeader 
          className="cursor-pointer"
          onClick={() => setBriefExpanded(!briefExpanded)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {briefExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                1. Define the brief
              </CardTitle>
              <CardDescription>Provide topic, context, goals, and model settings.</CardDescription>
            </div>
            <span className="text-sm text-gray-500">
              {briefExpanded ? "Click to collapse" : "Click to expand"}
            </span>
          </div>
        </CardHeader>
        {briefExpanded && (
          <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="topic">Topic</Label>
            <Combobox
              options={exampleTopics.map((t) => ({ value: t.value, label: t.label }))}
              value={exampleTopics.find((t) => t.topic === topic)?.value || ""}
              onSelect={handleTopicSelect}
              placeholder="Select an example or type your own..."
              searchPlaceholder="Search topics..."
              emptyText="No topics found."
              className="w-full"
            />
            <Input
              id="topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Or enter a custom topic..."
              className="mt-2"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="context">Context</Label>
            <Textarea id="context" rows={3} value={context} onChange={(e) => setContext(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="goals">Goals</Label>
            <Textarea id="goals" rows={3} value={goals} onChange={(e) => setGoals(e.target.value)} />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label>Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="o1-preview">o1-preview</SelectItem>
                  <SelectItem value="o1-mini">o1-mini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Reasoning effort</Label>
              <Select value={effort} onValueChange={(value) => setEffort(value as Effort)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select effort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-gray-500">
                Used when supported (e.g., o3-mini). May increase cost/latency.
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="timebox">Timebox</Label>
              <Select value={timebox} onValueChange={setTimebox}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timebox" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10 minutes">10 minutes</SelectItem>
                  <SelectItem value="20 minutes">20 minutes</SelectItem>
                  <SelectItem value="30 minutes">30 minutes</SelectItem>
                  <SelectItem value="45 minutes">45 minutes</SelectItem>
                  <SelectItem value="1 hour">1 hour</SelectItem>
                  <SelectItem value="2 hours">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={generatePlanStream} disabled={loadingPlan}>
              {loadingPlan ? (
                <div className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Drafting plan...
                </div>
              ) : (
                "Draft a plan"
              )}
            </Button>
            {loadingPlan && planCtrl && (
              <Button
                variant="outline"
                onClick={() => {
                  planCtrl.abort()
                  setPlanCtrl(null)
                }}
              >
                <div className="flex items-center">
                  <div className="mr-2">⏹️</div>
                  Cancel
                </div>
              </Button>
            )}
          </div>
          </CardContent>
        )}
      </Card>

      {/* Step 2: Plan */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>2. Review the plan</CardTitle>
            <CardDescription>Toggle, edit, or add steps. Final step always runs.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={addManualStep}>
              <div className="flex items-center">
                <div className="mr-2">➕</div>
                Add step
              </div>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!plan ? (
            <div className="text-sm text-gray-500">Draft a plan or add a step to start.</div>
          ) : (
            <>
              {plan.questions.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Key questions to answer</div>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {plan.questions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}

              {plan.clarifyingQuestions.length > 0 && (
                <div>
                  <div className="text-sm font-medium mb-1">Clarifying questions</div>
                  <ul className="list-disc pl-5 text-sm space-y-1">
                    {plan.clarifyingQuestions.map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <Separator />

              <div className="flex items-center justify-between cursor-pointer" onClick={() => setPlanStepsExpanded(!planStepsExpanded)}>
                <div className="flex items-center gap-2">
                  {planStepsExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <span className="font-medium">Plan Steps ({plan.steps.length})</span>
                </div>
                <span className="text-sm text-gray-500">
                  {planStepsExpanded ? "Click to collapse" : "Click to expand"}
                </span>
              </div>

              {planStepsExpanded && (
                <div className="space-y-3">
                  {plan.steps.map((s, i) => (
                  <div key={i} className="rounded border p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">Step {i + 1}</Badge>
                        <Input
                          value={s.title}
                          onChange={(e) =>
                            setPlan((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    steps: prev.steps.map((x, idx) =>
                                      idx === i ? { ...x, title: e.target.value } : x,
                                    ),
                                  }
                                : prev,
                            )
                          }
                          className="h-8 w-[22rem]"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={s.include === false ? "secondary" : "outline"}
                          onClick={() =>
                            setPlan((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    steps: prev.steps.map((x, idx) =>
                                      idx === i ? { ...x, include: x.include === false ? true : false } : x,
                                    ),
                                  }
                                : prev,
                            )
                          }
                        >
                          {s.include === false ? "Include" : "Skip"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteStep(i)}
                          aria-label={`Delete step ${i + 1}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <Label className="text-xs">Rationale</Label>
                      <Textarea
                        rows={2}
                        value={s.rationale}
                        onChange={(e) =>
                          setPlan((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  steps: prev.steps.map((x, idx) =>
                                    idx === i ? { ...x, rationale: e.target.value } : x,
                                  ),
                                }
                              : prev,
                          )
                        }
                      />
                    </div>
                    <div className="mt-2 grid md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs">Queries</Label>
                        <Textarea
                          rows={3}
                          value={(s.queries ?? []).join("\n")}
                          onChange={(e) =>
                            setPlan((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    steps: prev.steps.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            queries: e.target.value
                                              .split("\n")
                                              .map((l) => l.trim())
                                              .filter(Boolean),
                                          }
                                        : x,
                                    ),
                                  }
                                : prev,
                            )
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Expected outputs</Label>
                        <Textarea
                          rows={3}
                          value={(s.expectedOutputs ?? []).join("\n")}
                          onChange={(e) =>
                            setPlan((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    steps: prev.steps.map((x, idx) =>
                                      idx === i
                                        ? {
                                            ...x,
                                            expectedOutputs: e.target.value
                                              .split("\n")
                                              .map((l) => l.trim())
                                              .filter(Boolean),
                                          }
                                        : x,
                                    ),
                                  }
                                : prev,
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {/* Final step (always runs) */}
                <div className="rounded border p-3 bg-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Final</Badge>
                      <div className="font-medium">Synthesize briefing & Export PDF</div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Square className="h-4 w-4" />
                      Always runs
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Compiles an executive summary, key sections, glossary, questions, and sources into a briefing and
                    enables PDF export.
                  </div>
                </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button onClick={executePlanStream} disabled={executing}>
                  {executing ? (
                    <div className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Executing...
                    </div>
                  ) : (
                    "Approve & Execute"
                  )}
                </Button>
                {executing && execCtrl && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      execCtrl.abort()
                      setExecCtrl(null)
                    }}
                  >
                    <div className="flex items-center">
                      <div className="mr-2">⏹️</div>
                      Cancel
                    </div>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setPlan(null)
                    setStepResults([])
                    setExecReport(null)
                    setProgress(null)
                  }}
                >
                  Reset plan
                </Button>
              </div>
              {executing && progress && (
                <div className="text-xs text-gray-500">
                  Running step {progress.current} of {progress.total}...
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Step 3 & 4: Results stream in */}
      {(stepResults.length > 0 || execReport) && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>3. Step results</CardTitle>
              <CardDescription>Summaries and sources stream in as each step completes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stepResults.map((r, idx) => {
                const isExpanded = expandedSteps.has(idx)
                const isThinking = thinkingSteps.has(idx)
                const hasContent = r.summary && r.summary.trim().length > 0
                
                return (
                  <div key={idx} className="rounded border">
                    <div 
                      className="p-3 cursor-pointer hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        setExpandedSteps(prev => {
                          const newSet = new Set(prev)
                          if (isExpanded) {
                            newSet.delete(idx)
                          } else {
                            newSet.add(idx)
                          }
                          return newSet
                        })
                      }}
                    >
                      {isExpanded ? 
                        <ChevronDown className="h-4 w-4 text-gray-500" /> : 
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      }
                      <Badge variant="secondary">Step {idx + 1}</Badge>
                      <div className="font-medium flex-1">{r.title}</div>
                      {isThinking && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Brain className="h-4 w-4 animate-pulse" />
                          <span>Thinking...</span>
                        </div>
                      )}
                      {!isThinking && hasContent && (
                        <div className="flex items-center gap-1 text-sm text-green-600">
                          <div className="h-2 w-2 bg-green-500 rounded-full" />
                          <span>Complete</span>
                        </div>
                      )}
                    </div>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        {isThinking ? (
                          <div className="flex items-center gap-2 py-4 text-gray-500">
                            <Loader2 className="animate-spin h-4 w-4" />
                            <span>{thinkingActivity[idx] || "Processing step and gathering sources..."}</span>
                          </div>
                        ) : (
                          <>
                            <div className="prose prose-sm dark:prose-invert max-w-none overflow-hidden">
                              <LockedEntityMarkdown 
                                className="text-sm leading-relaxed"
                                isComplete={!isThinking && hasContent}
                              >
                                {r.summary || "Waiting for content..."}
                              </LockedEntityMarkdown>
                            </div>
                            {r.sources.length > 0 && (
                              <div className="mt-2 text-xs border-t pt-2">
                                <div className="font-medium mb-1">Sources</div>
                                <ul className="list-disc pl-5 space-y-1">
                                  {r.sources.map((s, i) => (
                                    <li key={i}>
                                      <a 
                                        className="text-blue-600 hover:text-blue-800 underline decoration-solid underline-offset-2 cursor-pointer transition-colors duration-200" 
                                        href={s.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                      >
                                        {s.title || s.url}
                                      </a>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {execReport && <ResearchReport report={execReport} stepResults={stepResults} />}
        </div>
      )}
      </div>
    </div>
  )
}
