import type { NextRequest } from "next/server"
import { generateText } from "ai"
import { openai } from "@/lib/openai-config"

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
  try {
    const { contextFiles, topic } = await req.json() as {
      contextFiles: RecordItem[]
      topic: string
    }

    if (!contextFiles || contextFiles.length === 0) {
      return Response.json({ error: "No context files provided" }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: "OpenAI API key not configured" }, { status: 500 })
    }

    // Prepare context data summary
    const contextSummary = contextFiles.map(file => {
      let summary = `File: ${file.id}\n`
      summary += `Content: ${file.text}\n`
      
      if (file.businessData) {
        summary += `Data Type: ${file.businessData.type}\n`
        if (file.businessData.metrics) {
          summary += `Metrics: ${file.businessData.metrics.join(', ')}\n`
        }
        if (file.businessData.timeRange) {
          summary += `Time Range: ${file.businessData.timeRange}\n`
        }
      }
      
      if (file.meta?.headers && file.meta?.data) {
        summary += `Sample Data:\n`
        const sampleData = file.meta.data.slice(0, 3) // First 3 rows
        sampleData.forEach((row: any[], index: number) => {
          summary += `Row ${index + 1}: ${file.meta.headers.map((h: string, i: number) => `${h}: ${row[i] || 'N/A'}`).join(', ')}\n`
        })
      }
      
      return summary
    }).join('\n---\n')

    // Professional analyst context analysis prompt
    const analysisPrompt = `You are a senior business analyst conducting a comprehensive context analysis of uploaded business data files. 

**Research Topic:** ${topic}

**Uploaded Context Data:**
${contextSummary}

**Professional Analyst Framework - Apply the Five Essential Questions:**

1. **Current State Analysis**: What is the current business situation based on this data?
2. **Performance Assessment**: What are we doing well that should be continued (but improved)?
3. **Gap Analysis**: What should we be doing that we're not currently doing?
4. **Opportunity Identification**: What opportunities exist that we may not be fully aware of?
5. **Strategic Implications**: What are the forward-looking insights and strategic implications?

**Business Intelligence Analysis Required:**

**A. Data Discovery & Validation**
- What time periods does this data cover?
- What business metrics are present and what do they reveal?
- What trends, patterns, or anomalies are visible?
- What is the data quality and are there any limitations?

**B. Financial/Operational Performance**
- What is the current business performance trajectory?
- Where are the growth opportunities and risk factors?
- How does performance vary across different metrics/time periods?
- What operational insights can be derived?

**C. Strategic Context Formation**
- What hypotheses about market position can be formed from this data?
- What competitive advantages or disadvantages are revealed?
- What strategic questions does this data raise about the research topic "${topic}"?
- What external market factors should be validated against this internal data?

**D. Research Integration Framework**
- What specific external research questions should be prioritized based on this data?
- Where might external market data contradict or validate internal performance?
- What industry benchmarks or competitive analysis would be most valuable?
- What are the key assumptions that need external validation?

**Output Requirements:**
Provide a comprehensive context analysis in markdown format with:

## Executive Summary
- Key findings and strategic implications (3-4 bullets)

## Data Insights
- Performance trends and key metrics analysis
- Notable patterns, anomalies, or concerns
- Data quality assessment and limitations

## Strategic Context
- Business position and competitive implications  
- Growth opportunities and risk factors identified
- Market positioning insights derived from data

## Research Integration Recommendations
- Priority research questions based on data gaps
- External validation needs for key assumptions
- Specific market intelligence required to contextualize internal data
- Recommended research focus areas to maximize strategic value

Use professional analyst language and provide specific, actionable insights that will enhance the upcoming market research.`

    const response = await generateText({
      model: openai("gpt-4o"),
      prompt: analysisPrompt,
      temperature: 0.1, // Lower temperature for more focused analysis
    })

    const analysis = response.text

    if (!analysis) {
      return Response.json({ error: "Failed to generate context analysis" }, { status: 500 })
    }

    return Response.json({ 
      analysis,
      fileCount: contextFiles.length,
      dataTypes: [...new Set(contextFiles.map(f => f.businessData?.type).filter(Boolean))]
    })

  } catch (error: any) {
    console.error("Context analysis error:", error)
    return Response.json(
      { error: error.message || "Failed to analyze context" },
      { status: 500 }
    )
  }
}