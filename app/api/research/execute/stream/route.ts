import type { NextRequest } from "next/server"
import { generateObject, generateText, streamText } from "ai"
import { openai } from "@/lib/openai-config"
import { z } from "zod"

type Step = { title: string; rationale: string; queries: string[]; expectedOutputs: string[] }

type RecordItem = {
  id: string
  text: string
  meta?: Record<string, any>
  businessData?: {
    type: 'financial' | 'sales' | 'operational' | 'general'
    metrics?: string[]
    timeRange?: string
    summary?: string
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    topic,
    context,
    goals,
    timebox,
    steps,
    model: selectedModel,
    reasoningEffort,
    clarifyingAnswers,
    contextFiles,
    includeContextAnalysis,
  } = body as {
    topic: string
    context?: string
    goals?: string
    timebox?: string
    steps: Step[]
    model?: string
    reasoningEffort?: "low" | "medium" | "high"
    clarifyingAnswers?: string
    contextFiles?: RecordItem[]
    includeContextAnalysis?: boolean
  }

  const encoder = new TextEncoder()
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  }

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }

      try {
        if (!process.env.OPENAI_API_KEY) {
          send({ type: "error", message: "OPENAI_API_KEY required to execute research" })
          send({ type: "done" })
          return
        }
        if (!topic) {
          send({ type: "error", message: "Missing topic" })
          send({ type: "done" })
          return
        }

        const model = (selectedModel as string) || "gpt-5"
        // Use Responses API only for gpt-5/gpt-4o/gpt-4o-mini for web_search_preview tool
        const responsesModel =
          typeof model === "string" && (model.startsWith("gpt-5") || model.startsWith("gpt-4o")) ? model : "gpt-4o-mini"

        // Collect step outputs for the final report
        const collected: Array<{ title: string; summary: string; sources: Array<{ title?: string; url: string }> }> = []
        let contextAnalysisResult: string = ""

        // Calculate total steps (including context analysis if enabled)
        const contextSteps = (includeContextAnalysis && contextFiles?.length) ? 1 : 0
        const researchSteps = Array.isArray(steps) ? steps.length : 0
        const total = Math.max(1, contextSteps + researchSteps) // always at least one (final)
        let ranSteps = 0

        // Step 0: Context Analysis (if enabled and files provided)
        if (includeContextAnalysis && contextFiles?.length) {
          send({ type: "progress", current: 1, total })
          send({ type: "step-start", index: 0, title: "Context Analysis: Business Data Review" })

          try {
            // Call context analysis API
            const contextResponse = await fetch(new URL('/api/context-analysis', req.url).toString(), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contextFiles, topic }),
              signal: req.signal
            })

            if (!contextResponse.ok) {
              throw new Error(`Context analysis failed: ${contextResponse.statusText}`)
            }

            const contextData = await contextResponse.json()
            contextAnalysisResult = contextData.analysis

            // Stream the context analysis result
            send({ type: "step-chunk", index: 0, text: contextAnalysisResult })
            send({ type: "step-end", index: 0, summary: contextAnalysisResult })

            collected.push({ 
              title: "Context Analysis: Business Data Review", 
              summary: contextAnalysisResult, 
              sources: [] 
            })
            ranSteps++

          } catch (error: any) {
            const errorMsg = `Context analysis error: ${error.message}`
            send({ type: "step-chunk", index: 0, text: errorMsg })
            send({ type: "step-end", index: 0, summary: errorMsg })
            contextAnalysisResult = errorMsg
          }
        }

        if (Array.isArray(steps) && steps.length > 0) {
          for (let i = 0; i < steps.length; i++) {
            if (req.signal.aborted) break

            const step = steps[i]
            const stepIndex = contextSteps + i
            const progressCurrent = contextSteps + i + 1
            send({ type: "progress", current: progressCurrent, total })
            send({ type: "step-start", index: stepIndex, title: step.title })

            // 1) Fetch sources using web_search_preview (non-stream), so we can stream the write-up separately
            const searchPrompt = [
              `You are gathering sources for: ${topic}`,
              context ? `Context: ${context}` : "",
              goals ? `Goals: ${goals}` : "",
              clarifyingAnswers ? `Additional Information Provided: ${clarifyingAnswers}` : "",
              contextAnalysisResult ? `**Internal Context Analysis Results:**\n${contextAnalysisResult}\n\n**Research Focus:** Use this internal business context to guide external source collection. Prioritize sources that can validate, benchmark, or provide market intelligence relevant to the internal data patterns identified above.` : "",
              `Current step: ${step.title}`,
              step.queries?.length ? `Queries to consider:\n- ${step.queries.join("\n- ")}` : "",
              `Instructions:
- Use web search to find authoritative, up-to-date sources relevant to this step.
- Prioritize high quality, recent, and authoritative references (documentation, standards, industry reports, reputable news).
${contextAnalysisResult ? "- Focus on external market intelligence that can contextualize the internal business data insights." : ""}
- You will NOT output the summary here, only collect sources.`,
            ]
              .filter(Boolean)
              .join("\n\n")

            const search = await generateText({
              model: openai.responses(responsesModel),
              prompt: searchPrompt,
              tools: {
                web_search_preview: openai.tools.webSearchPreview({ searchContextSize: "high" }),
              },
              providerOptions: { openai: { reasoningEffort } },
              abortSignal: req.signal,
            })

            const sources =
              (search as any).sources?.map((s: any) => ({
                title: s.title as string | undefined,
                url: s.url as string,
              })) ?? []

            send({ type: "step-sources", index: stepIndex, sources })

            // 2) Stream the step summary referencing the collected sources
            const sourcesList =
              sources.length > 0
                ? sources.map((s) => `- ${s.title ? `${s.title} — ` : ""}${s.url}`).join("\n")
                : "(no explicit sources captured)"

            let stepSpecificInstructions = ""
            if (i === 0) {
              // Step 1: Focus on definitions and understanding what the user means
              stepSpecificInstructions = `
**Step 1 Focus - Analytical Foundation & Understanding:**
- **First-Principles Approach**: Break down "${topic}" to its fundamental components and core principles
- **Systems Context**: Define how "${topic}" fits within larger industry/market/technological systems
- **Root Cause Analysis**: Identify what drives the emergence and evolution of "${topic}"
- **Multiple Perspectives**: Analyze different stakeholder viewpoints and interpretations
- **Critical Assessment**: Evaluate evidence quality and potential definitional biases
- **Real-World Manifestation**: Provide concrete examples of how this concept materializes in practice`
            } else if (i === 1) {
              // Step 2: Build on Step 1's findings
              stepSpecificInstructions = `
**Step 2 Focus - Ecosystem Analysis & Practical Application:**
- **Systems Mapping**: Map the interconnected ecosystem around "${topic}" (players, relationships, dependencies)
- **Hypothesis Formation**: Based on Step 1, form testable hypotheses about market behavior or trends
- **Stakeholder Analysis**: Identify key players, their incentives, and how they influence the system
- **Value Chain Analysis**: Trace how value flows through the "${topic}" ecosystem
- **Evidence Validation**: Test Step 1 hypotheses with real-world data and examples
- **Implementation Patterns**: Analyze how theory translates to practical application across contexts`
            } else {
              // Other steps: Advanced analytical focus
              stepSpecificInstructions = `
**Advanced Analytical Focus:**
- **Pattern Recognition**: Identify recurring patterns, trends, and anomalies in "${topic}" data
- **Causal Analysis**: Apply root cause analysis to understand why trends exist and what drives changes
- **Scenario Planning**: Develop multiple plausible future scenarios based on current evidence
- **Risk Assessment**: Systematically evaluate risks, uncertainties, and potential black swan events
- **Competitive Dynamics**: Analyze how different players respond to market forces and each other
- **Strategic Implications**: Connect findings to actionable strategic insights and decision frameworks
- **Bias Check**: Actively look for cognitive biases, data limitations, and alternative explanations`
            }

            const writePrompt = [
              `Write a comprehensive research summary for this step using proper Markdown formatting.`,
              `Topic: ${topic}`,
              context ? `Context: ${context}` : "",
              goals ? `Goals: ${goals}` : "",
              clarifyingAnswers ? `Additional Information Provided: ${clarifyingAnswers}` : "",
              contextAnalysisResult ? `**Internal Business Context:**\n${contextAnalysisResult}\n\n**Integration Requirement:** Connect external market research with the internal business data insights above. Validate internal patterns against market trends, benchmark performance, and identify strategic opportunities.` : "",
              `Step: ${step.title}`,
              step.rationale ? `Why this step: ${step.rationale}` : "",
              stepSpecificInstructions,
              `Use the following sources as grounding (if any):\n${sourcesList}`,
              `**Analytical Framework:**
Apply professional analytical thinking throughout your research:
- **Systems Thinking**: Consider this topic within larger interconnected systems and market dynamics
- **Root Cause Analysis**: Look beyond surface-level symptoms to identify underlying drivers and causes
- **First-Principles Thinking**: Break down complex concepts to fundamental truths, then build logical conclusions
- **Critical Thinking Loop**: Observe data → Interpret patterns → Evaluate evidence → Draw conclusions → Review for bias
- **Scientific Method**: Form hypotheses about trends/relationships, then validate with evidence from sources
${contextAnalysisResult ? "- **Context Integration**: Continuously reference and build upon the internal business context analysis, using external research to validate, benchmark, and expand upon internal insights" : ""}

**Output Requirements:**
- **Use Markdown formatting** with headers (##), bullet points (-), bold (**text**), and emphasis (*text*)
- Structure with clear analytical sections using ## headers
- 8-12 well-researched bullet points organized under relevant headers
- Include specific facts, figures, definitions, and current trends with proper context
- Reference sources inline when citing facts (e.g., "According to (Source: Source Title)...")
${contextAnalysisResult ? "- **Internal-External Integration**: For each finding, explicitly connect to internal business context where relevant, noting validation, contradictions, or gaps" : ""}
- **Analytical Depth**: For each key point, explain the "why" and "what this means" implications
- **Systems Perspective**: Connect findings to broader market forces, stakeholder impacts, and interdependencies
- **Evidence-Based**: Support conclusions with data, cite methodology limitations where relevant
- **Forward-Looking**: Include implications, potential scenarios, and strategic considerations
- Avoid marketing language; prioritize rigorous analytical content`,
            ]
              .filter(Boolean)
              .join("\n\n")

            const summaryStream = await streamText({
              model: openai(model),
              prompt: writePrompt,
              providerOptions: {
                openai: {
                  reasoningEffort,
                  // Force streaming even for reasoning models when possible
                  stream: true,
                },
              },
              abortSignal: req.signal,
            })

            let full = ""
            for await (const delta of summaryStream.textStream) {
              if (req.signal.aborted) break
              full += delta
              send({ type: "step-chunk", index: stepIndex, text: delta })
            }

            if (summaryStream.usage) {
              send({
                type: "step-usage",
                index: stepIndex,
                usage: await summaryStream.usage,
              })
            }

            // Ensure the stream is finalized
            try {
              await summaryStream.response
            } catch {
              // ignore errors if aborted
            }

            // Announce step end
            send({ type: "step-end", index: stepIndex, summary: full })

            collected.push({ title: step.title, summary: full, sources })
            ranSteps++
          }
        }

        if (req.signal.aborted) {
          send({ type: "done" })
          return
        }

        // Announce final briefing generation
        const finalStepIndex = contextSteps + researchSteps
        send({ type: "progress", current: finalStepIndex, total: finalStepIndex + 1 })
        send({ type: "step-start", index: finalStepIndex, title: "Generating Executive Briefing" })

        // Build the final report using collected summaries and sources
        const reportSchema = z.object({
          title: z.string(),
          executiveSummary: z.array(z.string()),
          keySections: z.array(z.object({ heading: z.string(), bullets: z.array(z.string()) })),
          questionsToAsk: z.array(z.string()),
          glossary: z.array(z.object({ term: z.string(), definition: z.string() })),
          sources: z.array(z.object({ title: z.string().optional(), url: z.string() })),
        })

        // Deduplicate sources across steps
        const unique = new Map<string, { title?: string; url: string }>()
        for (const s of collected.flatMap((r) => r.sources)) {
          if (!unique.has(s.url)) unique.set(s.url, s)
        }

        const { object: report } = await generateObject({
          model: openai(model),
          schema: reportSchema,
          prompt: [
            `Synthesize a concise analyst briefing from these executed step outputs.`,
            `Topic: ${topic}`,
            context ? `Context: ${context}` : "",
            goals ? `Goals: ${goals}` : "",
            clarifyingAnswers ? `Additional Information Provided: ${clarifyingAnswers}` : "",
            timebox ? `Timebox: ${timebox}` : "",
            contextAnalysisResult ? `**Internal Business Context Foundation:**\nThe following context analysis was performed on uploaded business data files:\n${contextAnalysisResult}\n\n**Synthesis Instruction:** Integrate this internal context with external research findings to provide comprehensive strategic insights.` : "",
            collected.length
              ? `Step outputs (title + summary):\n${collected
                  .map((s, i) => `Step ${i + 1}: ${s.title}\nSummary:\n${s.summary}`)
                  .join("\n\n")
                  .slice(0, 120_000)}`
              : `No step outputs were provided. Produce a briefing from scratch based on the topic and context.`,
            `**Analytical Synthesis Framework:**
Apply rigorous analytical thinking to synthesize insights:
- **Systems Integration**: Connect findings across steps to reveal system-level patterns and interdependencies
- **Root Cause Synthesis**: Identify fundamental drivers behind observed trends and patterns
- **Critical Evaluation**: Assess evidence strength, identify knowledge gaps, and acknowledge limitations
- **Strategic Perspective**: Frame insights for decision-makers with actionable implications
- **Forward-Looking Analysis**: Project likely scenarios and strategic considerations
${contextAnalysisResult ? "- **Internal-External Synthesis**: Create integrated insights that combine internal business context with external market intelligence, identifying strategic gaps, validation opportunities, and competitive positioning" : ""}

**Deliverable Requirements:**
- **Title**: Concise, analytical title that captures core insight${contextAnalysisResult ? " and integration of internal-external intelligence" : ""}
- **Executive Summary**: 6-10 evidence-based bullets highlighting key findings, implications, and strategic considerations${contextAnalysisResult ? " with explicit internal context integration" : ""}
- **Key Analytical Sections**: 3-6 sections with bullets structured around analytical themes:
  * Market/competitive dynamics and underlying forces
  * Stakeholder ecosystem and value chain analysis  
  * Critical success factors and risk assessment
  * Regulatory/technological drivers and constraints
  * Strategic implications and scenario planning
${contextAnalysisResult ? "  * Internal data validation and competitive benchmarking\n  * Strategic gap analysis between internal capabilities and market opportunities" : ""}
- **Stakeholder Questions**: 8-12 hypothesis-driven questions for stakeholder validation/testing${contextAnalysisResult ? " including questions that test internal assumptions against market realities" : ""}
- **Analytical Glossary**: 8-15 key terms with definitions that include analytical context
- **Evidence Base**: Consolidated, deduplicated source list with quality assessment`,
          ]
            .filter(Boolean)
            .join("\n\n"),
          providerOptions: { openai: { reasoningEffort } },
          abortSignal: req.signal,
        })

        // Announce briefing completion
        send({ type: "step-end", index: finalStepIndex, summary: "Executive briefing generated successfully" })
        send({ type: "progress", current: finalStepIndex + 1, total: finalStepIndex + 1 })

        send({ type: "report", report: { ...report, sources: Array.from(unique.values()) } })
        send({ type: "done" })
      } catch (e: any) {
        if (e?.name === "AbortError") {
          try {
            send({ type: "done" })
          } catch {}
        } else {
          send({ type: "error", message: e?.message || "Execution failed" })
          send({ type: "done" })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers })
}
