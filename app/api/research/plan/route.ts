import type { NextRequest } from "next/server"
import { z } from "zod"
import { generateObject } from "ai"
import { openai } from "@/lib/openai-config"

// Draft a plan: questions to answer + steps with rationale, queries, expected outputs
export async function POST(req: NextRequest) {
  try {
    const { topic, context, goals, timebox } = await req.json()

    if (!topic || typeof topic !== "string") {
      return new Response("Missing topic", { status: 400 })
    }

    const schema = z.object({
      questions: z.array(z.string()).describe("Key questions to answer about the topic"),
      clarifyingQuestions: z.array(z.string()).describe("Optional clarifying questions to ask the user"),
      steps: z.array(
        z.object({
          title: z.string(),
          rationale: z.string(),
          queries: z.array(z.string()),
          expectedOutputs: z.array(z.string()),
        }),
      ),
    })

    const sys =
      "You are a senior research analyst. Create a concise, practical plan to brief an analyst quickly on a new topic."

    const { object } = await generateObject({
      model: openai.responses("gpt-4o-mini"),
      schema,
      prompt: [
        sys,
        `Topic: ${topic}`,
        context ? `Context: ${context}` : "",
        goals ? `Goals: ${goals}` : "",
        timebox ? `Timebox: ${timebox}` : "",
        `Constraints:
- Prefer authoritative, recent sources.
- Avoid fluff; use actionable steps.
- Include ~4–7 steps max with clear queries and expected outputs.`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    })

    return Response.json(object)
  } catch (e: any) {
    return new Response(e?.message || "Server error", { status: 500 })
  }
}
