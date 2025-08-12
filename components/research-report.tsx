"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Copy, FileText } from "lucide-react"
import { downloadResearchPdf } from "@/lib/pdf"
import EntityText from "./entity-text"
import TextSelectionMenu from "./text-selection-menu"
import EntityModal from "./entity-modal"

export type ResearchReport = {
  title: string
  executiveSummary: string[]
  keySections: Array<{ heading: string; bullets: string[] }>
  questionsToAsk: string[]
  glossary: Array<{ term: string; definition: string }>
  sources: Array<{ title?: string; url: string }>
}

type StepResult = { title: string; summary: string; sources: Array<{ title?: string; url: string }> }

export default function ResearchReportView({
  report,
  stepResults = [],
}: {
  report: ResearchReport
  stepResults?: StepResult[]
}) {
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleExplainSelected = (selectedText: string) => {
    setSelectedEntity(selectedText)
    setModalOpen(true)
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
            <div className="text-sm font-medium mb-1">Questions to ask</div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {report.questionsToAsk.map((q, i) => (
                <li key={i}>
                  <EntityText text={q} className="text-sm" />
                </li>
              ))}
            </ul>
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
