import type { NextRequest } from "next/server"
import { generateText } from "ai"
import { openai } from "@/lib/openai-config"

export async function POST(req: NextRequest) {
  try {
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

    if (!questions || questions.length === 0) {
      return Response.json({ error: "No questions provided" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    const model = (selectedModel as string) || "gpt-4o"

    // Generate answers for each question
    const answers = []

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      
      const answerPrompt = [
        `You are a senior business analyst providing comprehensive answers to stakeholder questions based on completed research.`,
        `**Research Topic:** ${context.topic}`,
        `**Question ${i + 1}:** ${question}`,
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
        const response = await generateText({
          model: openai(model),
          prompt: answerPrompt,
          temperature: 0.2, // Lower temperature for more focused, analytical responses
        })

        answers.push({
          question,
          answer: response.text,
          index: i
        })
      } catch (error) {
        console.error(`Error answering question ${i + 1}:`, error)
        answers.push({
          question,
          answer: `Error generating answer: ${error instanceof Error ? error.message : 'Unknown error'}`,
          index: i
        })
      }
    }

    return Response.json({ 
      answers,
      questionCount: questions.length,
      model
    })

  } catch (error: any) {
    console.error("Question answering error:", error)
    return Response.json(
      { error: error.message || "Failed to answer questions" },
      { status: 500 }
    )
  }
}