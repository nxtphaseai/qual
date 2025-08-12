import type { NextRequest } from "next/server"
import { generateObject, generateText } from "ai"
import { openai } from "@/lib/openai-config"
import { z } from "zod"

// Execute plan: run web search per step, then synthesize a final briefing
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { topic, context, goals, timebox, steps } = body as {
      topic: string
      context?: string
      goals?: string
      timebox?: string
      steps: Array<{ title: string; rationale: string; queries: string[]; expectedOutputs: string[] }>
    }

    if (!topic || !Array.isArray(steps) || steps.length === 0) {
      return new Response("Missing topic or steps", { status: 400 })
    }
    if (!process.env.OPENAI_API_KEY) {
      return new Response("OPENAI_API_KEY is required to execute research", { status: 400 })
    }

    // 1) Execute each step using web search tool for grounded results
    const stepResults: Array<{ title: string; summary: string; sources: Array<{ title?: string; url: string }> }> = []

    for (const step of steps) {
      const prompt = [
        `You are conducting research for a briefing on: ${topic}`,
        context ? `Context: ${context}` : "",
        goals ? `Goals: ${goals}` : "",
        `Current step: ${step.title}`,
        step.rationale ? `Why this step: ${step.rationale}` : "",
        step.queries?.length ? `Search queries to consider:\n- ${step.queries.join("\n- ")}` : "",
        `Instructions:
- Use web search to find authoritative, up-to-date sources.
- Cross-check facts; avoid marketing fluff.
- Produce a concise summary (6-10 bullet points) capturing key facts, numbers, definitions, and current trends.
- Include product categories, major players, materials, regulations, and recent developments if relevant.
- Return the summary as plain text bullet points.`,
      ]
        .filter(Boolean)
        .join("\n\n")

      const result = await generateText({
        model: openai.responses("gpt-4o-mini"),
        prompt,
        tools: {
          web_search_preview: openai.tools.webSearchPreview({ searchContextSize: "high" }),
        },
      })

      // Sources are returned when using web_search_preview with the Responses API.
      const sources =
        (result as any).sources?.map((s: any) => ({ title: s.title as string | undefined, url: s.url as string })) ?? []

      stepResults.push({
        title: step.title,
        summary: result.text,
        sources,
      })
    }

    // 2) Synthesize a final report from step results
    const reportSchema = z.object({
      title: z.string(),
      executiveSummary: z.array(z.string()),
      keySections: z.array(z.object({ heading: z.string(), bullets: z.array(z.string()) })),
      questionsToAsk: z.array(z.string()),
      glossary: z.array(z.object({ term: z.string(), definition: z.string() })),
      sources: z.array(z.object({ title: z.string().optional(), url: z.string() })),
    })

    const { object: report } = await generateObject({
      model: openai.responses("gpt-4o-mini"),
      schema: reportSchema,
      prompt: [
        `Synthesize a concise analyst briefing from these step summaries.`,
        `Topic: ${topic}`,
        context ? `Context: ${context}` : "",
        goals ? `Goals: ${goals}` : "",
        timebox ? `Timebox: ${timebox}` : "",
        `Step summaries:`,
        stepResults
          .map(
            (s, i) =>
              `Step ${i + 1}: ${s.title}\nSummary:\n${s.summary}\nSources:\n${s.sources
                .map((x) => `- ${x.title ?? ""} ${x.url}`.trim())
                .join("\n")}`,
          )
          .join("\n\n"),
        `Produce:
- A title.
- An executive summary with 6–10 bullets.
- 3–6 key sections with bullets (e.g., Market overview, Key players, Product categories/materials, Supply chain and pricing, Regulations, Trends and risks).
- 8–12 thoughtful questions to ask on a stakeholder call.
- A compact glossary of key terms (8–15).
- A consolidated list of sources (URLs) from the steps (deduplicate).`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })

    // Deduplicate sources across steps for the final report
    const unique = new Map<string, { title?: string; url: string }>()
    for (const s of stepResults.flatMap((r) => r.sources)) {
      if (!unique.has(s.url)) unique.set(s.url, s)
    }

    return Response.json({
      stepResults,
      report: {
        ...report,
        sources: Array.from(unique.values()),
      },
    })
  } catch (e: any) {
    return new Response(e?.message || "Server error", { status: 500 })
  }
}
