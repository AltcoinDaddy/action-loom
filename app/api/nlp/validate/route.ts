import { NextRequest, NextResponse } from 'next/server'
import { ActionMappingService, ActionMappingError } from '@/lib/action-mapping-service'
import { defaultActionDiscoveryService } from '@/lib/action-discovery-service'

/**
 * POST /api/nlp/validate
 * Validate extracted parameters against Action schemas and perform type conversion
 */
export async function POST(request: NextRequest) {
  try {
    const { actionId, parameters, intent, entities } = await request.json()

    // Validate required fields
    if (!actionId && !intent) {
      return NextResponse.json(
        { error: 'Either actionId or intent is required' },
        { status: 400 }
      )
    }

    if (!parameters || typeof parameters !== 'object') {
      return NextResponse.json(
        { error: 'Parameters object is required' },
        { status: 400 }
      )
    }

    const mappingService = new ActionMappingService()

    let validationResult
    let actionMetadata

    if (actionId) {
      // Validate against specific Action
      actionMetadata = await defaultActionDiscoveryService.getAction(actionId)
      
      if (!actionMetadata) {
        return NextResponse.json(
          { error: `Action with ID '${actionId}' not found` },
          { status: 404 }
        )
      }

      validationResult = await mappingService.validateActionParameters(actionMetadata, parameters)
    } else if (intent && entities) {
      // Map intent to Actions and validate against best match
      const mappingResults = await mappingService.mapIntentToActions(intent, entities, 1)
      
      if (mappingResults.length === 0) {
        return NextResponse.json(
          { error: 'No matching Actions found for the given intent' },
          { status: 404 }
        )
      }

      actionMetadata = mappingResults[0].action
      validationResult = await mappingService.validateActionParameters(actionMetadata, parameters)
    }

    return NextResponse.json({
      success: true,
      data: {
        action: actionMetadata,
        validation: validationResult,
        recommendations: generateRecommendations(validationResult)
      }
    })

  } catch (error) {
    console.error('Parameter validation error:', error)

    if (error instanceof ActionMappingError) {
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
        error: 'Internal server error during parameter validation'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/nlp/validate/map
 * Map parsed intents to discovered Actions using semantic matching
 */
export async function PUT(request: NextRequest) {
  try {
    const { intent, entities, maxResults = 5 } = await request.json()

    if (!intent || typeof intent !== 'object') {
      return NextResponse.json(
        { error: 'Intent object is required' },
        { status: 400 }
      )
    }

    if (!entities || !Array.isArray(entities)) {
      return NextResponse.json(
        { error: 'Entities array is required' },
        { status: 400 }
      )
    }

    const mappingService = new ActionMappingService()
    const mappingResults = await mappingService.mapIntentToActions(intent, entities, maxResults)

    return NextResponse.json({
      success: true,
      data: {
        mappings: mappingResults,
        totalFound: mappingResults.length,
        bestMatch: mappingResults.length > 0 ? mappingResults[0] : null
      }
    })

  } catch (error) {
    console.error('Action mapping error:', error)

    if (error instanceof ActionMappingError) {
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
        error: 'Internal server error during action mapping'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/nlp/validate
 * Get information about the parameter validation endpoint
 */
export async function GET() {
  return NextResponse.json({
    endpoints: {
      'POST /api/nlp/validate': {
        description: 'Validate extracted parameters against Action schemas',
        parameters: {
          actionId: {
            type: 'string',
            required: false,
            description: 'Specific Action ID to validate against'
          },
          intent: {
            type: 'object',
            required: false,
            description: 'Intent classification result (alternative to actionId)'
          },
          entities: {
            type: 'array',
            required: false,
            description: 'Extracted entities (required when using intent)'
          },
          parameters: {
            type: 'object',
            required: true,
            description: 'Parameters to validate'
          }
        },
        response: {
          success: { type: 'boolean' },
          data: {
            action: { type: 'object', description: 'Action metadata' },
            validation: {
              type: 'object',
              properties: {
                isValid: { type: 'boolean' },
                validatedParams: { type: 'object' },
                errors: { type: 'array' },
                warnings: { type: 'array' },
                missingRequired: { type: 'array' },
                typeConversions: { type: 'array' }
              }
            },
            recommendations: { type: 'array', description: 'Improvement suggestions' }
          }
        }
      },
      'PUT /api/nlp/validate/map': {
        description: 'Map parsed intents to discovered Actions using semantic matching',
        parameters: {
          intent: {
            type: 'object',
            required: true,
            description: 'Intent classification result'
          },
          entities: {
            type: 'array',
            required: true,
            description: 'Extracted entities'
          },
          maxResults: {
            type: 'number',
            required: false,
            default: 5,
            description: 'Maximum number of Action mappings to return'
          }
        },
        response: {
          success: { type: 'boolean' },
          data: {
            mappings: { type: 'array', description: 'Action mapping results' },
            totalFound: { type: 'number' },
            bestMatch: { type: 'object', description: 'Best matching Action' }
          }
        }
      }
    },
    examples: {
      validation: {
        request: {
          actionId: 'swap_usdc_flow',
          parameters: {
            amount: '100',
            fromToken: 'USDC',
            toToken: 'FLOW'
          }
        },
        response: {
          success: true,
          data: {
            validation: {
              isValid: true,
              validatedParams: {
                amount: 100,
                fromToken: 'USDC',
                toToken: 'FLOW'
              },
              typeConversions: [
                {
                  parameter: 'amount',
                  originalValue: '100',
                  convertedValue: 100,
                  originalType: 'string',
                  targetType: 'number'
                }
              ]
            }
          }
        }
      },
      mapping: {
        request: {
          intent: {
            intent: 'swap',
            confidence: 0.9
          },
          entities: [
            { type: 'amount', value: '100' },
            { type: 'token', value: 'USDC' },
            { type: 'token', value: 'FLOW' }
          ]
        },
        response: {
          success: true,
          data: {
            mappings: [
              {
                action: { id: 'swap_usdc_flow', name: 'USDC to FLOW Swap' },
                matchScore: 0.95,
                reasons: ['High semantic similarity', 'Matches intent keyword: swap'],
                parameterMapping: {
                  amount: '100',
                  fromToken: 'USDC',
                  toToken: 'FLOW'
                }
              }
            ],
            bestMatch: { /* ... */ }
          }
        }
      }
    }
  })
}

/**
 * Generate recommendations based on validation results
 */
function generateRecommendations(validationResult: any): string[] {
  const recommendations: string[] = []

  if (!validationResult.isValid) {
    if (validationResult.missingRequired.length > 0) {
      recommendations.push(`Add missing required parameters: ${validationResult.missingRequired.join(', ')}`)
    }

    if (validationResult.errors.length > 0) {
      const typeErrors = validationResult.errors.filter((e: any) => e.type === 'type_conversion')
      if (typeErrors.length > 0) {
        recommendations.push('Check parameter types and formats')
      }

      const rangeErrors = validationResult.errors.filter((e: any) => e.type === 'range_validation')
      if (rangeErrors.length > 0) {
        recommendations.push('Ensure parameter values are within allowed ranges')
      }
    }
  }

  if (validationResult.warnings.length > 0) {
    recommendations.push('Review warnings for potential issues')
  }

  if (validationResult.typeConversions.length > 0) {
    recommendations.push('Parameter types were automatically converted - verify the results')
  }

  if (recommendations.length === 0) {
    recommendations.push('Parameters are valid and ready for execution')
  }

  return recommendations
}