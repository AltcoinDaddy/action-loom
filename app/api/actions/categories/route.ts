import { NextResponse } from "next/server"
import { ActionDiscoveryService } from "@/lib/action-discovery-service"
import {
  withErrorHandling,
  createSuccessResponse,
  throwValidationError
} from "@/lib/api-error-handler"

/**
 * AI Agent API - Action Categories Endpoint
 * 
 * GET /api/actions/categories - Get all available Action categories
 */

const discoveryService = new ActionDiscoveryService()

async function handleGET(): Promise<NextResponse> {
  console.log('Fetching Action categories...')
  
  // In development mode, return mock categories instead of trying to connect to Flow
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  if (isDevelopment) {
    const mockCategories = [
      { id: 'defi', name: 'DeFi', description: 'Decentralized Finance operations', count: 2 },
      { id: 'nft', name: 'NFT', description: 'Non-Fungible Token operations', count: 1 },
      { id: 'token', name: 'Token', description: 'Token transfer and management', count: 1 },
      { id: 'governance', name: 'Governance', description: 'Voting and governance operations', count: 1 }
    ]
    
    return createSuccessResponse(null, {
      categories: mockCategories,
      total: mockCategories.length
    })
  }
  
  try {
    const categories = await discoveryService.getCategories()
    
    return createSuccessResponse(null, {
      categories,
      total: categories.length
    })
  } catch (error) {
    throwValidationError('Failed to fetch Action categories', error instanceof Error ? error.message : 'Unknown categories error')
  }
}

export const GET = withErrorHandling(handleGET, 'Action Categories')