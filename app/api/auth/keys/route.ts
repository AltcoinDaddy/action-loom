import { NextResponse } from "next/server"
import { 
  APIAuthService, 
  createAPIAuthService, 
  APIKey, 
  APIPermission, 
  RateLimit,
  DEFAULT_RATE_LIMITS 
} from "@/lib/api-auth-service"

/**
 * API Key Management Endpoint
 * 
 * GET /api/auth/keys - List user's API keys
 * POST /api/auth/keys - Create new API key
 * DELETE /api/auth/keys - Revoke API key
 * 
 * Requirements: 5.4 - API key management system with proper security
 */

interface CreateKeyRequest {
  name: string
  userId: string
  permissions?: APIPermission[]
  tier?: 'free' | 'pro' | 'enterprise'
  expiresInDays?: number
}

interface RevokeKeyRequest {
  keyId: string
  userId: string
}

const authService = createAPIAuthService()

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: "Missing required parameter: userId"
      }, { status: 400 })
    }

    console.log(`Fetching API keys for user: ${userId}`)
    const keyIds = await authService.getUserAPIKeys(userId)
    
    // In a real implementation, we'd fetch full key details from database
    // For now, return the key IDs
    return NextResponse.json({
      success: true,
      keys: keyIds.map(id => ({
        id,
        name: `API Key ${id.split('_')[1]}`,
        createdAt: new Date().toISOString(),
        lastUsed: null,
        isActive: true
      })),
      total: keyIds.length
    })

  } catch (error) {
    console.error('[API] API keys fetch error:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to fetch API keys",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body: CreateKeyRequest = await request.json()
    
    if (!body.name || !body.userId) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: name, userId"
      }, { status: 400 })
    }

    console.log(`Creating API key for user: ${body.userId}`)

    // Determine rate limits based on tier
    let rateLimit: RateLimit
    switch (body.tier) {
      case 'pro':
        rateLimit = DEFAULT_RATE_LIMITS.pro
        break
      case 'enterprise':
        rateLimit = DEFAULT_RATE_LIMITS.enterprise
        break
      default:
        rateLimit = DEFAULT_RATE_LIMITS.free
    }

    // Set expiration if specified
    let expiresAt: Date | undefined
    if (body.expiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + body.expiresInDays)
    }

    // Generate API key
    const apiKey = authService.generateAPIKey(
      body.name,
      body.userId,
      body.permissions,
      rateLimit,
      expiresAt
    )

    // Store the API key
    await authService.storeAPIKey(apiKey)

    // Return the API key (this is the only time the raw key is returned)
    return NextResponse.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        key: apiKey.key, // Raw key returned only once
        name: apiKey.name,
        permissions: apiKey.permissions,
        rateLimit: apiKey.rateLimit,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt
      },
      message: "API key created successfully. Store this key securely - it won't be shown again."
    })

  } catch (error) {
    console.error('[API] API key creation error:', error)
    return NextResponse.json({
      success: false,
      error: "API key creation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body: RevokeKeyRequest = await request.json()
    
    if (!body.keyId || !body.userId) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: keyId, userId"
      }, { status: 400 })
    }

    console.log(`Revoking API key: ${body.keyId} for user: ${body.userId}`)
    
    const success = await authService.revokeAPIKey(body.keyId, body.userId)
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: "API key not found or already revoked"
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: "API key revoked successfully"
    })

  } catch (error) {
    console.error('[API] API key revocation error:', error)
    return NextResponse.json({
      success: false,
      error: "API key revocation failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}