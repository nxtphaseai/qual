"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Progress } from "@/components/ui/progress"
import { Download, Copy, FileText, Brain, ChevronDown, ChevronRight, Loader2, Square } from "lucide-react"
import { downloadResearchPdf } from "@/lib/pdf"
import EntityText from "./entity-text"
import TextSelectionMenu from "./text-selection-menu"
import EntityModal from "./entity-modal"
import CitationMarkdown from "./citation-markdown"
import AIAnswersPanel from "./ai-answers-panel"

export type ResearchReport = {
  title: string
  executiveSummary: string[]
  keySections: Array<{ heading: string; bullets: string[] }>
  questionsToAsk: string[]
  glossary: Array<{ term: string; definition: string }>
  sources: Array<{ title?: string; url: string }>
}

type StepResult = { title: string; summary: string; sources: Array<{ title?: string; url: string }> }

type QuestionAnswer = {
  question: string
  answer: string
  index: number
}

export default function ResearchReportView({
  report,
  stepResults = [],
  researchContext,
}: {
  report: ResearchReport
  stepResults?: StepResult[]
  researchContext?: {
    topic: string
    contextAnalysis?: string
    model?: string
  }
}) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  
  // AI Question Answering state
  const [questionAnswers, setQuestionAnswers] = useState<QuestionAnswer[]>([])
  const [isAnswering, setIsAnswering] = useState(false)
  const [answersExpanded, setAnswersExpanded] = useState(false)
  const [hasAnswers, setHasAnswers] = useState(false)
  const [answerProgress, setAnswerProgress] = useState({ current: 0, total: 0 })
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(-1)
  const [answerController, setAnswerController] = useState<AbortController | null>(null)
  const [splitPanelOpen, setSplitPanelOpen] = useState(false)

  const handleExplainSelected = (selectedText: string) => {
    setSelectedEntity(selectedText)
    setModalOpen(true)
  }

  // Event stream reader utility
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
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (line.trim() === "") continue
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              onEvent(data)
            } catch (e) {
              console.warn("Failed to parse event:", line)
            }
          }
        }
      }
    } finally {
      try {
        reader.releaseLock()
      } catch {}
    }
  }

  const handleAnswerQuestions = async () => {
    if (!researchContext || report.questionsToAsk.length === 0) return
    
    setIsAnswering(true)
    setSplitPanelOpen(true) // Open the split panel
    setAnswerProgress({ current: 0, total: report.questionsToAsk.length })
    setCurrentQuestionIndex(-1)
    setQuestionAnswers([]) // Reset previous answers
    
    const ctrl = new AbortController()
    setAnswerController(ctrl)
    
    try {
      const response = await fetch('/api/answer-questions/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questions: report.questionsToAsk,
          context: {
            topic: researchContext.topic,
            report: report,
            stepResults: stepResults,
            contextAnalysis: researchContext.contextAnalysis
          },
          model: researchContext.model
        }),
        signal: ctrl.signal
      })

      if (!response.ok) {
        throw new Error(`Failed to answer questions: ${response.statusText}`)
      }

      await readEventStream(response, (evt) => {
        if (evt.type === "error") {
          alert("Question answering error: " + (evt.message || "Failed to answer questions"))
        } else if (evt.type === "progress") {
          setAnswerProgress({ current: evt.current, total: evt.total })
        } else if (evt.type === "question-start") {
          setCurrentQuestionIndex(evt.index)
          // Initialize answer for this question
          setQuestionAnswers(prev => {
            const newAnswers = [...prev]
            newAnswers[evt.index] = { question: evt.question, answer: "", index: evt.index }
            return newAnswers
          })
        } else if (evt.type === "question-chunk") {
          // Append chunk to the current question's answer
          setQuestionAnswers(prev => {
            const newAnswers = [...prev]
            if (newAnswers[evt.index]) {
              newAnswers[evt.index] = {
                ...newAnswers[evt.index],
                answer: newAnswers[evt.index].answer + evt.text
              }
            } else {
              // Create answer if it doesn't exist
              newAnswers[evt.index] = {
                question: report.questionsToAsk[evt.index],
                answer: evt.text,
                index: evt.index
              }
            }
            return newAnswers
          })
        } else if (evt.type === "question-end") {
          // Mark question as complete
          setQuestionAnswers(prev => {
            const newAnswers = [...prev]
            newAnswers[evt.index] = {
              question: evt.question,
              answer: evt.answer,
              index: evt.index
            }
            return newAnswers
          })
        } else if (evt.type === "done") {
          setCurrentQuestionIndex(-1)
          setHasAnswers(true)
        }
      }, ctrl.signal)

    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.log("Question answering cancelled")
      } else {
        console.error('Error answering questions:', error)
        alert('Failed to generate answers. Please try again.')
      }
    } finally {
      setIsAnswering(false)
      setAnswerController(null)
    }
  }

  const stopAnswering = () => {
    if (answerController) {
      answerController.abort()
    }
  }

  const closeSplitPanel = () => {
    setSplitPanelOpen(false)
    // Stop answering if currently in progress
    if (isAnswering) {
      stopAnswering()
    }
  }
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "research-brief.json"
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyText = () => {
    const parts: string[] = []
    parts.push(`# ${report.title}`)
    parts.push(`\nExecutive summary:`)
    parts.push(...report.executiveSummary.map((b) => `- ${b}`))
    parts.push(`\nKey sections:`)
    for (const s of report.keySections) {
      parts.push(`\n## ${s.heading}`)
      parts.push(...s.bullets.map((b) => `- ${b}`))
    }
    parts.push(`\nQuestions to ask:`)
    parts.push(...report.questionsToAsk.map((q) => `- ${q}`))
    parts.push(`\nGlossary:`)
    parts.push(...report.glossary.map((g) => `- ${g.term}: ${g.definition}`))
    parts.push(`\nSources:`)
    parts.push(...report.sources.map((s) => `- ${s.title ?? ""} ${s.url}`.trim()))
    navigator.clipboard.writeText(parts.join("\n"))
  }

  const exportPDF = async () => {
    await downloadResearchPdf("research-brief.pdf", report, stepResults)
  }

  return (
    <>
      <div 
        className={`transition-all duration-500 ease-in-out ${splitPanelOpen ? 'w-1/2 overflow-x-auto' : 'w-full'}`}
        onClick={splitPanelOpen ? closeSplitPanel : undefined}
      >
        <div className={`${splitPanelOpen ? 'opacity-75 pointer-events-none min-w-[800px]' : ''}`}>
          <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle>4. Briefing</CardTitle>
            <CardDescription>Executive summary, key sections, questions, and sources</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportPDF}>
              <FileText className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={exportJSON}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
            <Button variant="ghost" size="sm" onClick={copyText}>
              <Copy className="h-4 w-4 mr-2" />
              Copy as text
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="text-2xl font-semibold">{report.title}</div>
        </div>

        <div>
          <div className="text-sm font-medium mb-1">Executive summary</div>
          <ul className="list-disc pl-5 space-y-1">
            {report.executiveSummary.map((b, i) => (
              <li key={i}>
                <EntityText text={b} className="text-sm" />
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          {report.keySections.map((s, i) => (
            <div key={i} className="rounded border p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{i + 1}</Badge>
                <div className="font-medium">{s.heading}</div>
              </div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {s.bullets.map((b, j) => (
                  <li key={j}>
                    <EntityText text={b} className="text-sm" />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {report.questionsToAsk.length > 0 && (
          <div>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <div className="text-sm font-medium text-blue-900">Questions to ask</div>
                </div>
                {researchContext && (
                  <Button 
                    onClick={() => setSplitPanelOpen(true)}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Answer with AI
                  </Button>
                )}
              </div>
              <ul className="list-disc pl-5 text-sm space-y-2">
                {report.questionsToAsk.map((q, i) => (
                  <li key={i} className="text-gray-700">
                    <EntityText text={q} className="text-sm" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {report.glossary.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-3">Glossary</div>
            <div className="space-y-3">
              {report.glossary.map((g, i) => (
                <div key={i} className="border-l-4 border-blue-200 pl-4 py-2 bg-gray-50 rounded-r-lg">
                  <div className="font-semibold text-blue-900 mb-1">
                    <EntityText text={g.term} className="font-semibold text-blue-900" />
                  </div>
                  <div className="text-gray-700 text-sm leading-relaxed">
                    <EntityText text={g.definition} className="text-gray-700" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {report.sources.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-3">Sources</div>
            <div className="space-y-2">
              {report.sources.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200 flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <a 
                    className="text-blue-600 hover:text-blue-800 underline decoration-solid underline-offset-2 cursor-pointer transition-colors duration-200 flex-1 text-sm" 
                    href={s.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    {s.title ?? s.url}
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
          </CardContent>
          </Card>
        </div>
      </div>

      {/* Split Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-[50vw] bg-white shadow-2xl transform transition-transform duration-500 ease-in-out z-30 ${
          splitPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <AIAnswersPanel
          questions={report.questionsToAsk}
          questionAnswers={questionAnswers}
          isAnswering={isAnswering}
          answerProgress={answerProgress}
          currentQuestionIndex={currentQuestionIndex}
          onStartAnswering={handleAnswerQuestions}
          onStopAnswering={stopAnswering}
          onClose={closeSplitPanel}
          researchContext={researchContext}
        />
      </div>


      <TextSelectionMenu onExplain={handleExplainSelected} />
      
      <EntityModal
        entity={selectedEntity}
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setSelectedEntity(null)
        }}
      />
    </>
  )
}
