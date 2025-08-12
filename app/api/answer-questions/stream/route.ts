import type { NextRequest } from "next/server"
import { streamText } from "ai"
import { openai } from "@/lib/openai-config"

export async function POST(req: NextRequest) {
  const { questions, context, model: selectedModel } = await req.json() as {
    questions: string[]
    context: {
      topic: string
      report: any
      stepResults?: any[]
      contextAnalysis?: string
    }
    model?: string
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
          send({ type: "error", message: "OPENAI_API_KEY required to answer questions" })
          send({ type: "done" })
          return
        }
        
        if (!questions || questions.length === 0) {
          send({ type: "error", message: "No questions provided" })
          send({ type: "done" })
          return
        }

        const model = (selectedModel as string) || "gpt-4o"
        const total = questions.length

        // Send initial progress
        send({ type: "progress", current: 0, total })

        // Process each question
        for (let i = 0; i < questions.length; i++) {
          if (req.signal.aborted) break

          const question = questions[i]
          
          // Announce question start
          send({ type: "question-start", index: i, question })
          
          const answerPrompt = [
            `You are a senior business analyst providing comprehensive answers to stakeholder questions based on completed research.`,
            `**Research Topic:** ${context.topic}`,
            `**Question ${i + 1} of ${total}:** ${question}`,
            context.contextAnalysis ? `**Internal Business Context:**\n${context.contextAnalysis}` : "",
            `**Research Report Summary:**\n${JSON.stringify(context.report, null, 2).slice(0, 8000)}`,
            context.stepResults ? `**Detailed Research Findings:**\n${context.stepResults.map((step, idx) => 
              `Step ${idx + 1}: ${step.title}\n${step.summary.slice(0, 2000)}`
            ).join('\n\n').slice(0, 10000)}` : "",
            `**Analysis Framework:**
Apply professional analytical thinking to provide comprehensive answers:
- **Evidence-Based Response**: Ground your answer in the research findings and data provided
- **Strategic Perspective**: Frame answers with strategic implications and decision-making context
- **Risk Assessment**: Address potential risks, uncertainties, and mitigation strategies where relevant
- **Actionable Insights**: Provide specific, actionable recommendations where appropriate
- **Multiple Scenarios**: Consider different scenarios or approaches when relevant
- **Implementation Considerations**: Address practical implementation challenges and requirements

**Answer Requirements:**
- **Comprehensive Analysis**: Provide thorough, multi-faceted answers that demonstrate deep thinking
- **Structured Response**: Use clear headings and bullet points for readability
- **Evidence References**: Reference specific findings from the research when making points
- **Strategic Implications**: Explain the "why" and "what this means" for decision-makers
- **Forward-Looking**: Include implications for future strategy and planning
- **Professional Tone**: Use executive-level language appropriate for senior stakeholders
- **Markdown Formatting**: Use proper markdown with ##, bullets (-), **bold**, and *emphasis*

Answer the question comprehensively using the research context provided above.`
          ].filter(Boolean).join('\n\n')

          try {
            const answerStream = await streamText({
              model: openai(model),
              prompt: answerPrompt,
              temperature: 0.2, // Lower temperature for more focused, analytical responses
              abortSignal: req.signal,
            })

            let fullAnswer = ""
            for await (const delta of answerStream.textStream) {
              if (req.signal.aborted) break
              fullAnswer += delta
              send({ type: "question-chunk", index: i, text: delta })
            }

            if (answerStream.usage) {
              send({
                type: "question-usage",
                index: i,
                usage: await answerStream.usage,
              })
            }

            // Ensure the stream is finalized
            try {
              await answerStream.response
            } catch {
              // ignore errors if aborted
            }

            // Announce question end
            send({ type: "question-end", index: i, question, answer: fullAnswer })
            send({ type: "progress", current: i + 1, total })

          } catch (error: any) {
            const errorMsg = `Error answering question ${i + 1}: ${error.message}`
            send({ type: "question-chunk", index: i, text: errorMsg })
            send({ type: "question-end", index: i, question, answer: errorMsg })
            send({ type: "progress", current: i + 1, total })
          }
        }

        if (req.signal.aborted) {
          send({ type: "done" })
          return
        }

        send({ type: "done" })
      } catch (e: any) {
        if (e?.name === "AbortError") {
          try {
            send({ type: "done" })
          } catch {}
        } else {
          send({ type: "error", message: e?.message || "Failed to answer questions" })
          send({ type: "done" })
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers })
}