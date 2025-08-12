import type { NextRequest } from "next/server"
import { generateObject, generateText, streamText } from "ai"
import { openai } from "@/lib/openai-config"
import { z } from "zod"

type Step = { title: string; rationale: string; queries: string[]; expectedOutputs: string[] }

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
  } = body as {
    topic: string
    context?: string
    goals?: string
    timebox?: string
    steps: Step[]
    model?: string
    reasoningEffort?: "low" | "medium" | "high"
    clarifyingAnswers?: string
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

        const model = (selectedModel as string) || "gpt-4o"
        // Use Responses API only for gpt-4o/gpt-4o-mini for web_search_preview tool
        const responsesModel =
          typeof model === "string" && model.startsWith("gpt-4o") ? model : "gpt-4o-mini"

        // Collect step outputs for the final report
        const collected: Array<{ title: string; summary: string; sources: Array<{ title?: string; url: string }> }> = []

        const total = Math.max(1, Array.isArray(steps) ? steps.length : 0) // always at least one (final)
        let ranSteps = 0

        if (Array.isArray(steps) && steps.length > 0) {
          for (let i = 0; i < steps.length; i++) {
            if (req.signal.aborted) break

            const step = steps[i]
            send({ type: "progress", current: i + 1, total })
            send({ type: "step-start", index: i, title: step.title })

            // 1) Fetch sources using web_search_preview (non-stream), so we can stream the write-up separately
            const searchPrompt = [
              `You are gathering sources for: ${topic}`,
              context ? `Context: ${context}` : "",
              goals ? `Goals: ${goals}` : "",
              clarifyingAnswers ? `Additional Information Provided: ${clarifyingAnswers}` : "",
              `Current step: ${step.title}`,
              step.queries?.length ? `Queries to consider:\n- ${step.queries.join("\n- ")}` : "",
              `Instructions:
- Use web search to find authoritative, up-to-date sources relevant to this step.
- Prioritize high quality, recent, and authoritative references (documentation, standards, industry reports, reputable news).
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

            send({ type: "step-sources", index: i, sources })

            // 2) Stream the step summary referencing the collected sources
            const sourcesList =
              sources.length > 0
                ? sources.map((s) => `- ${s.title ? `${s.title} — ` : ""}${s.url}`).join("\n")
                : "(no explicit sources captured)"

            let stepSpecificInstructions = ""
            if (i === 0) {
              // Step 1: Focus on definitions and understanding what the user means
              stepSpecificInstructions = `
**Step 1 Focus - Definition & Understanding:**
- Start by clearly defining what "${topic}" means in practical terms
- Explain different interpretations or contexts where this term is used
- Clarify what the user likely means by "${topic}" based on the context provided
- Include real-world examples of how this concept is applied or manifests
- Address any ambiguity or multiple meanings of the term`
            } else if (i === 1) {
              // Step 2: Build on Step 1's findings
              stepSpecificInstructions = `
**Step 2 Focus - Building on Definitions:**
- Expand on the foundational understanding from Step 1
- Dive deeper into the practical applications and real-world usage
- Explore the ecosystem, market, or environment around "${topic}"
- Identify key players, stakeholders, or components involved
- Show how the concept from Step 1 translates into actual practice or implementation`
            } else {
              // Other steps: General real-world focus
              stepSpecificInstructions = `
**Real-World Application Focus:**
- Focus on practical, actionable insights about "${topic}"
- Include current market conditions, trends, or developments
- Identify key stakeholders, companies, or players involved
- Highlight real-world challenges and opportunities`
            }

            const writePrompt = [
              `Write a comprehensive research summary for this step using proper Markdown formatting.`,
              `Topic: ${topic}`,
              context ? `Context: ${context}` : "",
              goals ? `Goals: ${goals}` : "",
              clarifyingAnswers ? `Additional Information Provided: ${clarifyingAnswers}` : "",
              `Step: ${step.title}`,
              step.rationale ? `Why this step: ${step.rationale}` : "",
              stepSpecificInstructions,
              `Use the following sources as grounding (if any):\n${sourcesList}`,
              `**Output Requirements:**
- **Use Markdown formatting** with headers (##), bullet points (-), bold (**text**), and emphasis (*text*)
- Structure with clear sections using ## headers
- 8-12 well-researched bullet points organized under relevant headers
- Include specific facts, figures, definitions, and current trends
- Reference sources inline when citing facts (e.g., "According to [Source Title]...")
- Focus on actionable, real-world insights rather than theoretical concepts
- Avoid marketing language; prioritize factual, analytical content`,
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
              send({ type: "step-chunk", index: i, text: delta })
            }

            if (summaryStream.usage) {
              send({
                type: "step-usage",
                index: i,
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
            send({ type: "step-end", index: i, summary: full })

            collected.push({ title: step.title, summary: full, sources })
            ranSteps++
          }
        }

        if (req.signal.aborted) {
          send({ type: "done" })
          return
        }

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
            collected.length
              ? `Step outputs (title + summary):\n${collected
                  .map((s, i) => `Step ${i + 1}: ${s.title}\nSummary:\n${s.summary}`)
                  .join("\n\n")
                  .slice(0, 120_000)}`
              : `No step outputs were provided. Produce a briefing from scratch based on the topic and context.`,
            `Produce:
- A title.
- An executive summary with 6–10 bullets.
- 3–6 key sections with bullets (e.g., Market overview, Key players, Product categories/materials, Supply chain and pricing, Regulations, Trends and risks).
- 8–12 thoughtful questions to ask on a stakeholder call.
- A compact glossary of key terms (8–15).
- A consolidated list of sources (URLs) from the steps (deduplicate if any).`,
          ]
            .filter(Boolean)
            .join("\n\n"),
          providerOptions: { openai: { reasoningEffort } },
          abortSignal: req.signal,
        })

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
