import type { NextRequest } from "next/server"
import { z } from "zod"
import { streamObject } from "ai"
import { openai } from "@/lib/openai-config"

// Streams partial and final plan. Supports cancellation via req.signal [^1].
export async function POST(req: NextRequest) {
  const { topic, context, goals, timebox, model: selectedModel, reasoningEffort } = await req.json()

  const encoder = new TextEncoder()
  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  }

  if (!process.env.OPENAI_API_KEY) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: "OPENAI_API_KEY required" })}\n\n`),
        )
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`))
        controller.close()
      },
    })
    return new Response(stream, { headers })
  }

  const schema = z.object({
    questions: z.array(z.string()),
    clarifyingQuestions: z.array(z.string()).default([]),
    steps: z.array(
      z.object({
        title: z.string(),
        rationale: z.string(),
        queries: z.array(z.string()).default([]),
        expectedOutputs: z.array(z.string()).default([]),
      }),
    ),
  })

  const sys =
    "You are a senior research analyst. Create a concise, practical plan to brief an analyst quickly on a new topic."

  const prompt = [
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
    .join("\n\n")

  const model = (selectedModel as string) || "gpt-4o"

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      }
      try {
        const result = await streamObject({
          model: openai(model),
          schema,
          prompt,
          providerOptions: { openai: { reasoningEffort } },
          // Forward abort from client to model stream per AI SDK [^1]:
          abortSignal: req.signal,
        })

        console.log('Plan generation started for model:', model)

        // Stream partial objects
        for await (const partial of result.partialObjectStream) {
          send({ type: "plan-partial", partial })
        }

        const final = await result.object
        send({ type: "plan-final", plan: final })
        send({ type: "done" })
      } catch (e: any) {
        console.error('Plan generation error:', {
          name: e?.name,
          message: e?.message,
          stack: e?.stack,
          model,
          hasApiKey: !!process.env.OPENAI_API_KEY
        })
        
        // If aborted, just end quietly
        if (e?.name === "AbortError") {
          send({ type: "done" })
        } else {
          const errorMessage = e?.message || "Failed to draft plan"
          send({ type: "error", message: errorMessage })
          send({ type: "done" })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers })
}
