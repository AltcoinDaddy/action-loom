import { NextRequest, NextResponse } from 'next/server'
import { NLPService, NLPError } from '@/lib/nlp-service'
import { getNLPConfig } from '@/lib/nlp-config'

/**
 * POST /api/nlp/classify
 * Classify the intent of natural language input
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
        { status: 1000 }
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

    // Classify intent using the private method through parseWorkflow
    const result = await nlpService.parseWorkflow(input)

    return NextResponse.json({
      success: true,
      data: {
        originalText: input,
        cleanedText: preprocessed.cleanedText,
        entities: allEntities,
        intent: result.steps.length > 0 ? result.steps[0].actionName : 'unknown',
        confidence: result.confidence,
        ambiguities: result.ambiguities,
        suggestions: result.suggestions,
        processingTime: result.processingTime
      }
    })

  } catch (error) {
    console.error('Intent classification error:', error)

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
        error: 'Internal server error during intent classification'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/nlp/classify
 * Get information about the intent classification endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/nlp/classify',
    method: 'POST',
    description: 'Classify the intent of natural language input and extract entities',
    parameters: {
      input: {
        type: 'string',
        required: true,
        description: 'Natural language text to classify',
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
          description: 'Extracted entities with enhanced confidence scoring'
        },
        intent: { type: 'string', description: 'Classified workflow intent' },
        confidence: { type: 'number', description: 'Overall confidence score (0-1)' },
        ambiguities: { type: 'array', description: 'Detected ambiguities' },
        suggestions: { type: 'array', description: 'Improvement suggestions' },
        processingTime: { type: 'number', description: 'Processing time in milliseconds' }
      }
    },
    supportedIntents: [
      'swap', 'stake', 'unstake', 'mint', 'transfer', 
      'bridge', 'lend', 'borrow', 'compound', 'custom'
    ],
    examples: [
      {
        input: 'Swap 100 USDC to FLOW',
        expectedOutput: {
          intent: 'swap',
          confidence: 0.9,
          entities: [
            { type: 'action', value: 'swap' },
            { type: 'amount', value: '100' },
            { type: 'token', value: 'USDC' },
            { type: 'token', value: 'FLOW' }
          ]
        }
      },
      {
        input: 'Stake 1000 FLOW in validator pool',
        expectedOutput: {
          intent: 'stake',
          confidence: 0.85,
          entities: [
            { type: 'action', value: 'stake' },
            { type: 'amount', value: '1000' },
            { type: 'token', value: 'FLOW' }
          ]
        }
      },
      {
        input: 'Transfer 50 USDC to 0x1234567890abcdef',
        expectedOutput: {
          intent: 'transfer',
          confidence: 0.9,
          entities: [
            { type: 'action', value: 'transfer' },
            { type: 'amount', value: '50' },
            { type: 'token', value: 'USDC' },
            { type: 'address', value: '0x1234567890abcdef' }
          ]
        }
      }
    ]
  })
}