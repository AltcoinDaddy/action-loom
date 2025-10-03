import { NextResponse } from "next/server"
import { ActionDiscoveryService } from "@/lib/action-discovery-service"
import {
  withErrorHandling,
  createSuccessResponse,
  validateParameters,
  throwValidationError
} from "@/lib/api-error-handler"

/**
 * AI Agent API - Action Search Suggestions Endpoint
 * 
 * GET /api/actions/suggestions - Get search suggestions for autocomplete
 */

const discoveryService = new ActionDiscoveryService()

async function handleGET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || searchParams.get('query') || ''
  const limitParam = searchParams.get('limit') || '5'
  
  // Validate limit parameter
  const limit = parseInt(limitParam)
  if (isNaN(limit) || limit < 0) {
    throwValidationError('Invalid limit parameter', 'Limit must be a non-negative integer')
  }
  if (limit > 50) {
    throwValidationError('Limit too large', 'Maximum limit is 50 for suggestions')
  }
  
  // Handle empty query
  if (!query.trim()) {
    return createSuccessResponse(null, {
      suggestions: [],
      query: '',
      total: 0
    })
  }

  // Validate query length
  if (query.length > 100) {
    throwValidationError('Query too long', 'Maximum query length is 100 characters for suggestions')
  }

  console.log(`Getting search suggestions for: ${query}`)
  
  // In development mode, return mock suggestions instead of trying to connect to Flow
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    const mockSuggestions = [
      'swap tokens',
      'mint nft',
      'stake tokens',
      'transfer tokens',
      'vote proposal'
    ].filter(suggestion => 
      suggestion.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit)
    
    return createSuccessResponse(null, {
      query,
      suggestions: mockSuggestions,
      total: mockSuggestions.length
    })
  }
  
  try {
    const suggestions = await discoveryService.getSearchSuggestions(query, limit)
    
    return createSuccessResponse(null, {
      query,
      suggestions,
      total: suggestions.length
    })
  } catch (error) {
    throwValidationError('Failed to get search suggestions', error instanceof Error ? error.message : 'Unknown suggestion error')
  }
}

export const GET = withErrorHandling(handleGET, 'Action Suggestions')