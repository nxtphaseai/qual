import type { NextRequest } from "next/server"
import { analyzeLocal } from "@/lib/local-analysis"

// Optional AI-enhanced analysis via AI SDK (OpenAI)
import { generateObject } from "ai"
import { openai } from "@/lib/openai-config"
import { z } from "zod"

type Task = "summary" | "themes" | "sentiment" | "entities" | "quotes"

type RecordItem = { id: string; text: string; meta?: Record<string, any> }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data: RecordItem[] = body?.data || []
    const tasks: Task[] = body?.tasks || ["summary", "themes", "sentiment", "entities", "quotes"]
    const questions: string = body?.questions || ""
    const provider: "local" | "openai" = body?.provider || "local"
    const model: string | undefined = body?.model || "o3-mini"
    const reasoningEffort: "low" | "medium" | "high" | undefined = body?.reasoningEffort || "low"

    if (!Array.isArray(data) || data.length === 0) {
      return new Response("Missing data", { status: 400 })
    }

    // If OpenAI key exists and user selected openai, run AI-enhanced; otherwise local.
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY
    let mode: "local" | "openai" = "local"
    let result

    if (provider === "openai" && hasOpenAIKey) {
      mode = "openai"
      // Concatenate content with caps to avoid huge prompts
      const maxChars = 15000
      const joined = data
        .map((d) => d.text)
        .join("\n\n")
        .slice(0, maxChars)
      const sys = `You are a qualitative analysis assistant. Extract actionable insights with clear structure.`
      // Define structured output schema
      const schema = z.object({
        summary: z.array(z.string()).describe("3-8 bullet points summarizing key takeaways"),
        themes: z.array(
          z.object({
            name: z.string(),
            keywords: z.array(z.string()),
            count: z.number(),
            examples: z.array(z.string()),
          }),
        ),
        sentiment: z.object({
          distribution: z.object({
            positive: z.number(),
            neutral: z.number(),
            negative: z.number(),
          }),
          topPositive: z.array(z.string()),
          topNegative: z.array(z.string()),
          average: z.number().describe("Normalized -1..1"),
        }),
        entities: z.object({
          people: z.array(z.string()),
          organizations: z.array(z.string()),
          locations: z.array(z.string()),
          emails: z.array(z.string()),
          urls: z.array(z.string()),
          hashtags: z.array(z.string()),
          money: z.array(z.string()),
          dates: z.array(z.string()),
          misc: z.array(z.string()),
        }),
        quotes: z.array(z.string()),
        keywords: z.array(z.object({ term: z.string(), count: z.number() })),
      })

      const { object } = await generateObject({
        model: openai(model),
        schema,
        prompt: [
          sys,
          `Questions or goals:\n${questions}\n`,
          `Data (truncated to ${maxChars} chars if long):\n"""\n${joined}\n"""`,
          `Respond with the structured JSON matching the schema.`,
        ].join("\n\n"),
        // Reduce reasoning effort for speed by default; configurable.
        providerOptions: { openai: { reasoningEffort } },
      })
      result = object
    } else {
      result = analyzeLocal(data, { tasks, questions })
      mode = "local"
    }

    return Response.json({ mode, result })
  } catch (e: any) {
    return new Response(e?.message || "Server error", { status: 500 })
  }
}
