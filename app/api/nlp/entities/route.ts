import { NextRequest, NextResponse } from 'next/server'
import { NLPService, NLPError } from '@/lib/nlp-service'
import { getNLPConfig } from '@/lib/nlp-config'

/**
 * POST /api/nlp/entities
 * Extract entities from natural language input
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

    // Preprocess text and extract entities
    const preprocessed = await nlpService.preprocessText(input)
    const actionEntities = await nlpService.extractEntities(preprocessed.cleanedText)
    const allEntities = [...preprocessed.entities, ...actionEntities]

    return NextResponse.json({
      success: true,
      data: {
        originalText: input,
        cleanedText: preprocessed.cleanedText,
        entities: allEntities,
        metadata: preprocessed.metadata
      }
    })

  } catch (error) {
    console.error('Entity extraction error:', error)

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
        error: 'Internal server error during entity extraction'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/nlp/entities
 * Get information about the entity extraction endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/nlp/entities',
    method: 'POST',
    description: 'Extract entities from natural language input',
    parameters: {
      input: {
        type: 'string',
        required: true,
        description: 'Natural language text to analyze',
        maxLength: 1000
      },
      config: {
        type: 'object',
        required: false,
        description: 'Optional NLP configuration overrides'
      }
    },
    response: {
      success: { type: 'boolean' },
      data: {
        originalText: { type: 'string', description: 'Original input text' },
        cleanedText: { type: 'string', description: 'Cleaned and normalized text' },
        entities: {
          type: 'array',
          description: 'Extracted entities',
          items: {
            type: { type: 'string', enum: ['amount', 'token', 'address', 'action', 'parameter'] },
            value: { type: 'string', description: 'Entity value' },
            confidence: { type: 'number', description: 'Confidence score (0-1)' },
            position: { type: 'array', description: 'Start and end position in text' },
            metadata: { type: 'object', description: 'Additional entity metadata' }
          }
        },
        metadata: {
          wordCount: { type: 'number' },
          characterCount: { type: 'number' },
          language: { type: 'string' }
        }
      }
    },
    entityTypes: {
      amount: 'Numeric values (e.g., "100", "50.5")',
      token: 'Token symbols (e.g., "USDC", "FLOW")',
      address: 'Blockchain addresses (e.g., "0x1234...")',
      action: 'Action verbs (e.g., "swap", "stake", "transfer")',
      parameter: 'Other parameters and values'
    },
    examples: [
      {
        input: 'Swap 100 USDC to FLOW',
        expectedEntities: [
          { type: 'amount', value: '100' },
          { type: 'token', value: 'USDC' },
          { type: 'token', value: 'FLOW' },
          { type: 'action', value: 'swap' }
        ]
      }
    ]
  })
}