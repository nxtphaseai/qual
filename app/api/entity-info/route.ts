import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { openai } from '@/lib/openai-config'

export async function POST(request: NextRequest) {
  try {
    const { entity } = await request.json()

    if (!entity || typeof entity !== 'string') {
      return NextResponse.json(
        { error: 'Entity name is required' },
        { status: 400 }
      )
    }

    // Check if we have OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      // Fall back to mock response if no API key
      const mockResponse = generateMockEntityInfo(entity)
      return NextResponse.json({
        info: mockResponse,
        entity: entity
      })
    }

    try {
      // Use AI to generate entity information with web search
      const result = await generateText({
        model: openai.responses('gpt-4o-mini'),
        prompt: `Provide a concise but comprehensive overview of "${entity}". Include:

1. **What it is**: Brief definition or description
2. **Key facts**: Important details, statistics, or characteristics  
3. **Context**: Why it's significant or relevant in its industry/domain
4. **Current status**: Recent developments or current state (if applicable)

Keep it informative but concise (200-400 words). Use markdown formatting with headers and bullet points where appropriate. Focus on factual, up-to-date information.`,
        tools: {
          web_search_preview: openai.tools.webSearchPreview({ searchContextSize: 'medium' }),
        },
        maxToolRoundtrips: 1,
      })

      return NextResponse.json({
        info: result.text,
        entity: entity
      })

    } catch (aiError) {
      console.error('AI generation failed, falling back to mock:', aiError)
      // Fall back to mock response if AI fails
      const mockResponse = generateMockEntityInfo(entity)
      return NextResponse.json({
        info: mockResponse,
        entity: entity
      })
    }

  } catch (error) {
    console.error('Entity info API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch entity information' },
      { status: 500 }
    )
  }
}

// Mock function - replace with actual LLM API call
function generateMockEntityInfo(entity: string): string {
  const cleanEntity = entity.toLowerCase()
  
  // Common technology/business entities
  if (cleanEntity.includes('nvidia') || cleanEntity.includes('gpu')) {
    return `## NVIDIA Corporation

**What it is**: Leading American technology company specializing in graphics processing units (GPUs) and AI computing.

**Key Facts**:
- Founded in 1993 by Jensen Huang, Chris Malachowsky, and Curtis Priem
- Market cap over $1 trillion (as of 2024)
- Dominates the AI chip market with ~80% market share
- Primary products: GeForce (gaming), Quadro (professional), Tesla (data center)

**Context**: 
NVIDIA has become central to the AI revolution, with their GPUs being essential for training large language models and running AI workloads. The company's CUDA platform and specialized AI chips like the H100 have made it indispensable for AI development.

**Current Status**: 
Experiencing unprecedented growth due to AI boom, with data center revenue reaching record highs. Facing some export restrictions to China but continues to innovate with new architectures like Blackwell.`
  }

  if (cleanEntity.includes('tesla') || cleanEntity.includes('electric vehicle')) {
    return `## Tesla, Inc.

**What it is**: American electric vehicle and clean energy company led by Elon Musk.

**Key Facts**:
- Founded in 2003, went public in 2010
- World's most valuable automaker by market capitalization
- Produces Model S, 3, X, Y vehicles and Cybertruck
- Also manufactures energy storage systems and solar panels

**Context**: 
Tesla pioneered mass-market electric vehicles and sparked the global transition to sustainable transport. The company's direct-sales model and over-the-air updates have disrupted traditional automotive practices.

**Current Status**: 
Expanding global production with Gigafactories worldwide, developing Full Self-Driving technology, and venturing into robotics and AI. Facing increased competition from traditional automakers entering the EV market.`
  }

  // Generic fallback
  return `## ${entity}

**What it is**: ${entity} is a notable entity in its respective field with significant relevance to current business and technology landscapes.

**Key Facts**:
- Recognized as an important player or concept in its domain
- Has implications for market dynamics and industry trends
- Represents current developments in technology, business, or related fields

**Context**: 
This entity is relevant to understanding modern business environments, technological developments, or market conditions. Its significance may relate to competitive landscapes, innovation trends, or strategic considerations.

**Current Status**: 
Information about ${entity} continues to evolve as markets and technologies develop. For the most current and specific information, additional research may be beneficial.

*Note: This is a generic overview. For detailed, current information about ${entity}, please consult authoritative sources or conduct focused research.*`
}