import { NextRequest, NextResponse } from 'next/server'
import { NLPService, NLPError } from '@/lib/nlp-service'
import { getNLPConfig } from '@/lib/nlp-config'

/**
 * POST /api/nlp/parse
 * Parse natural language input into structured workflow steps
 */
export async function POST(request: NextRequest) {
  try {
    const { input, config } = await request.json()

    if (!input || typeof input !== 'string') {
      return NextResponse.json(
        { error: 'Input text is required and must be a string' },
        { status: 400 }
      )
    }

    if (input.length > 1000) {
      return NextResponse.json(
        { error: 'Input text is too long (max 1000 characters)' },
        { status: 400 }
      )
    }

    // Create NLP service with configuration
    const nlpConfig = {
      ...getNLPConfig(),
      ...config
    }
    
    const nlpService = new NLPService(nlpConfig)

    // Parse the workflow
    const result = await nlpService.parseWorkflow(input)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('NLP parsing error:', error)

    if (error instanceof NLPError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error during NLP processing'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/nlp/parse
 * Get information about the NLP parsing endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/nlp/parse',
    method: 'POST',
    description: 'Parse natural language input into structured workflow steps',
    parameters: {
      input: {
        type: 'string',
        required: true,
        description: 'Natural language description of the workflow',
        maxLength: 1000
      },
      config: {
        type: 'object',
        required: false,
        description: 'Optional NLP configuration overrides',
        properties: {
          timeout: { type: 'number', description: 'Request timeout in milliseconds' },
          confidenceThreshold: { type: 'number', description: 'Minimum confidence threshold (0-1)' },
          temperature: { type: 'number', description: 'Model temperature for generation' }
        }
      }
    },
    response: {
      success: { type: 'boolean' },
      data: {
        confidence: { type: 'number', description: 'Overall confidence score' },
        steps: { type: 'array', description: 'Parsed workflow steps' },
        ambiguities: { type: 'array', description: 'Detected ambiguities' },
        suggestions: { type: 'array', description: 'Improvement suggestions' },
        processingTime: { type: 'number', description: 'Processing time in milliseconds' }
      }
    },
    examples: [
      {
        input: 'Swap 100 USDC to FLOW',
        expectedOutput: {
          confidence: 0.9,
          steps: [
            {
              actionId: 'swap_0',
              actionName: 'swap',
              parameters: {
                amount: '100',
                fromToken: 'USDC',
                toToken: 'FLOW'
              },
              confidence: 0.9
            }
          ]
        }
      },
      {
        input: 'Transfer 50 FLOW to 0x1234567890abcdef',
        expectedOutput: {
          confidence: 0.9,
          steps: [
            {
              actionId: 'transfer_0',
              actionName: 'transfer',
              parameters: {
                amount: '50',
                fromToken: 'FLOW',
                address: '0x1234567890abcdef'
              },
              confidence: 0.9
            }
          ]
        }
      }
    ]
  })
}