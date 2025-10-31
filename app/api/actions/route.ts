import { NextResponse } from "next/server"
import { ActionDiscoveryService } from "@/lib/action-discovery-service"
import { enhancedActionMetadataService } from "@/lib/enhanced-action-metadata-service"
import { getRealFlowActions } from "@/lib/real-flow-actions"
import { withAuth } from "@/lib/api-auth-service"
import {
  ActionMetadata,
  EnhancedActionMetadata,
  DiscoveryResult,
  ValidationResult,
  CompatibilityIssue,
  SecurityLevel
} from "@/lib/types"
import {
  withErrorHandling,
  createSuccessResponse,
  createErrorResponse,
  validateRequiredFields,
  validateParameters,
  throwNotFound,
  throwValidationError,
  ErrorCode
} from "@/lib/api-error-handler"

/**
 * Mock actions for development mode
 */
function getMockActions(): ActionMetadata[] {
  return [
    {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Exchange one token for another using DEX protocols',
      category: 'defi',
      version: '1.0.0',
      inputs: [
        { name: 'fromToken', type: 'String', description: 'Token to swap from', required: true },
        { name: 'toToken', type: 'String', description: 'Token to swap to', required: true },
        { name: 'amount', type: 'UFix64', description: 'Amount to swap', required: true }
      ],
      outputs: [
        { name: 'swappedAmount', type: 'UFix64', description: 'Amount received' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 50000,
      securityLevel: SecurityLevel.MEDIUM,
      author: 'ActionLoom Team',
      createdAt: '2024-01-15',
      updatedAt: '2024-01-15'
    },
    {
      id: 'mint-nft',
      name: 'Mint NFT',
      description: 'Create a new NFT token',
      category: 'nft',
      version: '2.1.0',
      inputs: [
        { name: 'recipient', type: 'Address', description: 'NFT recipient address', required: true },
        { name: 'metadata', type: 'String', description: 'NFT metadata URI', required: true }
      ],
      outputs: [
        { name: 'tokenId', type: 'UInt64', description: 'Minted token ID' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: ['nft-minting'],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 75000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow NFT Team',
      createdAt: '2024-02-01',
      updatedAt: '2024-02-01'
    },
    {
      id: 'stake-tokens',
      name: 'Stake Tokens',
      description: 'Lock tokens to earn rewards',
      category: 'defi',
      version: '1.5.0',
      inputs: [
        { name: 'amount', type: 'UFix64', description: 'Amount to stake', required: true },
        { name: 'duration', type: 'UInt64', description: 'Staking duration in seconds', required: true }
      ],
      outputs: [
        { name: 'stakingId', type: 'UInt64', description: 'Staking position ID' },
        { name: 'expectedReward', type: 'UFix64', description: 'Expected reward amount' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: ['staking'],
        supportedNetworks: ['mainnet'],
        minimumFlowVersion: '1.2.0',
        conflictsWith: []
      },
      gasEstimate: 120000,
      securityLevel: SecurityLevel.HIGH,
      author: 'Flow Staking',
      createdAt: '2024-01-20',
      updatedAt: '2024-01-20'
    },
    {
      id: 'transfer-tokens',
      name: 'Transfer Tokens',
      description: 'Send tokens to another address',
      category: 'token',
      version: '1.0.0',
      inputs: [
        { name: 'recipient', type: 'Address', description: 'Recipient address', required: true },
        { name: 'amount', type: 'UFix64', description: 'Amount to transfer', required: true },
        { name: 'token', type: 'String', description: 'Token type', required: true }
      ],
      outputs: [
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [
        { 
          name: 'recipient', 
          type: 'Address', 
          value: '', 
          required: true,
          description: 'The Flow address to send tokens to (0x followed by 16 hex characters)',
          options: undefined
        },
        { 
          name: 'amount', 
          type: 'UFix64', 
          value: '', 
          required: true,
          description: 'The amount of tokens to transfer - positive decimal number with up to 8 decimal places',
          options: undefined
        },
        { 
          name: 'token', 
          type: 'String', 
          value: 'FLOW', 
          required: true,
          description: 'The type of token to transfer',
          options: ['FLOW', 'USDC', 'FUSD', 'WBTC', 'WETH']
        }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 25000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Core',
      createdAt: '2024-01-10',
      updatedAt: '2024-01-10'
    },
    {
      id: 'vote-proposal',
      name: 'Vote on Proposal',
      description: 'Cast a vote on a governance proposal',
      category: 'governance',
      version: '1.2.0',
      inputs: [
        { name: 'proposalId', type: 'UInt64', description: 'Proposal ID', required: true },
        { name: 'vote', type: 'Bool', description: 'Vote (true for yes, false for no)', required: true },
        { name: 'votingPower', type: 'UFix64', description: 'Voting power to use', required: false }
      ],
      outputs: [
        { name: 'voteId', type: 'UInt64', description: 'Vote record ID' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: ['governance'],
        supportedNetworks: ['mainnet'],
        minimumFlowVersion: '1.1.0',
        conflictsWith: []
      },
      gasEstimate: 45000,
      securityLevel: SecurityLevel.MEDIUM,
      author: 'Flow Governance',
      createdAt: '2024-01-25',
      updatedAt: '2024-01-25'
    }
  ]
}

/**
 * AI Agent API - Action Discovery Endpoint
 * 
 * GET /api/actions - Discover and search Actions
 * POST /api/actions/validate - Validate Action compatibility
 * 
 * Requirements: 5.1, 5.2 - AI Agent API integration
 */

const getDiscoveryService = () => new ActionDiscoveryService()
// Use the singleton instance to ensure proper method binding
const enhancedMetadataService = enhancedActionMetadataService

async function handleGET(request: Request): Promise<NextResponse> {
  // Skip authentication in development mode OR when explicitly disabled
  const useMockData = process.env.USE_MOCK_DATA === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'
  const skipAuth = isDevelopment || process.env.SKIP_AUTH === 'true'

  if (!skipAuth) {
    // Authenticate request in production
    const authResult = await withAuth('actions', 'read')(request)
    if (!authResult.success) {
      return createErrorResponse(
        authResult.error,
        authResult.status,
        authResult.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN
      )
    }
  }

  const { searchParams } = new URL(request.url)

  // Parse and validate query parameters
  const query = searchParams.get('q') || searchParams.get('query')
  const category = searchParams.get('category')
  const actionId = searchParams.get('id')
  const limitParam = searchParams.get('limit')
  const forceRefresh = searchParams.get('refresh') === 'true'
  const similar = searchParams.get('similar')
  const enhanced = searchParams.get('enhanced') === 'true'

  // Validate limit parameter
  let limit = 20
  if (limitParam) {
    const parsedLimit = parseInt(limitParam)
    if (isNaN(parsedLimit) || parsedLimit < 0) {
      throwValidationError('Invalid limit parameter', 'Limit must be a non-negative integer')
    }
    if (parsedLimit > 1000) {
      throwValidationError('Limit too large', 'Maximum limit is 1000')
    }
    limit = parsedLimit
  }

  // Validate actionId format if provided
  if (actionId && !/^[a-zA-Z0-9\-_]+$/.test(actionId)) {
    throwValidationError('Invalid action ID format', 'Action ID must contain only alphanumeric characters, hyphens, and underscores')
  }

  // Get specific Action by ID
  if (actionId) {
    console.log(`Fetching Action: ${actionId}`)

    const actionsToSearch = useMockData ? getMockActions() : getRealFlowActions()
    const action = actionsToSearch.find(a => a.id === actionId)

    if (!action) {
      throwNotFound('Action', actionId)
    }

    // Return enhanced metadata if requested
    if (enhanced) {
      const enhancedAction = enhancedMetadataService.enhanceActionMetadata(action)
      return createSuccessResponse(null, {
        action: enhancedAction,
        enhanced: true
      })
    }

    return createSuccessResponse(null, { action })
  }

  // Find similar Actions
  if (similar) {
    // Validate similar action ID format
    if (!/^[a-zA-Z0-9\-_]+$/.test(similar)) {
      throwValidationError('Invalid similar action ID format', 'Action ID must contain only alphanumeric characters, hyphens, and underscores')
    }

    console.log(`Finding Actions similar to: ${similar}`)
    
    const actionsToSearch = useMockData ? getMockActions() : getRealFlowActions()
    const sourceAction = actionsToSearch.find(a => a.id === similar)
    
    if (!sourceAction) {
      throwNotFound('Action', similar)
    }
    
    // Simple similarity based on category and description keywords
    const similarActions = actionsToSearch
      .filter(action => action.id !== similar)
      .filter(action => 
        action.category === sourceAction.category ||
        action.description.toLowerCase().includes(sourceAction.category.toLowerCase()) ||
        sourceAction.description.toLowerCase().includes(action.category.toLowerCase())
      )
      .slice(0, limit)
    
    return createSuccessResponse(null, {
      actions: similarActions,
      query: similar,
      total: similarActions.length
    })
  }

  // Search Actions by query
  if (query) {
    // Validate query length
    if (query.length > 200) {
      throwValidationError('Query too long', 'Maximum query length is 200 characters')
    }

    console.log(`Searching Actions: ${query}`)

    const actionsToSearch = useMockData ? getMockActions() : getRealFlowActions()
    const filteredActions = actionsToSearch.filter(action =>
      action.name.toLowerCase().includes(query.toLowerCase()) ||
      action.description.toLowerCase().includes(query.toLowerCase()) ||
      action.category.toLowerCase().includes(query.toLowerCase())
    )

    const limitedActions = limit > 0 ? filteredActions.slice(0, limit) : filteredActions

    return createSuccessResponse(null, {
      query,
      actions: limitedActions,
      total: filteredActions.length
    })
  }

  // Get Actions by category
  if (category) {
    // Validate category format
    if (!/^[a-zA-Z0-9\-_]+$/.test(category)) {
      throwValidationError('Invalid category format', 'Category must contain only alphanumeric characters, hyphens, and underscores')
    }

    console.log(`Fetching Actions by category: ${category}`)

    const actionsToFilter = useMockData ? getMockActions() : getRealFlowActions()
    const filteredActions = actionsToFilter.filter(action => action.category === category)

    return createSuccessResponse(null, {
      category,
      actions: filteredActions,
      total: filteredActions.length
    })
  }

  // Discover all Actions
  console.log('Discovering all Actions...')

  // Use mock data if configured, otherwise use real Flow actions
  if (useMockData) {
    const mockActions = getMockActions()
    const limitedActions = limit > 0 ? mockActions.slice(0, limit) : mockActions

    // Enhance actions if requested
    const finalActions = enhanced
      ? limitedActions.map(action => enhancedMetadataService.enhanceActionMetadata(action))
      : limitedActions

    return createSuccessResponse(null, {
      actions: finalActions,
      total: mockActions.length,
      registries: ['mock-registry'],
      lastUpdated: new Date().toISOString(),
      executionTime: 100,
      enhanced
    })
  }

  // Use real Flow actions (curated list of actual Flow blockchain capabilities)
  console.log('Using real Flow blockchain actions...')
  const realActions = getRealFlowActions()
  const limitedActions = limit > 0 ? realActions.slice(0, limit) : realActions

  // Enhance actions if requested
  const finalActions = enhanced
    ? limitedActions.map(action => enhancedMetadataService.enhanceActionMetadata(action))
    : limitedActions

  return createSuccessResponse(null, {
    actions: finalActions,
    total: realActions.length,
    registries: ['flow-foundation'],
    lastUpdated: new Date().toISOString(),
    executionTime: 50,
    enhanced
  })
}

export const GET = withErrorHandling(handleGET, 'Actions Discovery')

async function handlePOST(request: Request): Promise<NextResponse> {
  // Skip authentication in development mode OR when explicitly disabled
  const useMockData = process.env.USE_MOCK_DATA === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'
  const skipAuth = isDevelopment || process.env.SKIP_AUTH === 'true'

  if (!skipAuth) {
    // Authenticate request in production
    const authResult = await withAuth('actions', 'write')(request)
    if (!authResult.success) {
      return createErrorResponse(
        authResult.error,
        authResult.status,
        authResult.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN
      )
    }
  }

  let body: any
  try {
    body = await request.json()
  } catch (error) {
    throwValidationError('Invalid JSON in request body', 'Request body must be valid JSON')
  }

  if (!body || typeof body !== 'object') {
    throwValidationError('Invalid request body', 'Request body must be a JSON object')
  }

  const { action, actionIds, sourceActionId, targetActionId } = body

  // Validate single Action
  if (action) {
    console.log('Validating Action metadata...')
    
    // Validate action structure
    if (typeof action !== 'object') {
      throwValidationError('Invalid action format', 'Action must be an object')
    }

    // Validate required action fields
    validateRequiredFields(action, ['id', 'name', 'category', 'version'])

    // Validate action field formats
    validateParameters(action, {
      id: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_]+$/.test(value) || 'Action ID must contain only alphanumeric characters, hyphens, and underscores',
      name: (value) => typeof value === 'string' && value.length > 0 && value.length <= 100 || 'Action name must be 1-100 characters',
      category: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_]+$/.test(value) || 'Category must contain only alphanumeric characters, hyphens, and underscores',
      version: (value) => typeof value === 'string' && /^\d+\.\d+\.\d+$/.test(value) || 'Version must be in semver format (e.g., 1.0.0)'
    })

    try {
      const validationResult: ValidationResult = getDiscoveryService().validateAction(action)
      return createSuccessResponse(null, { validationResult })
    } catch (error) {
      throwValidationError('Action validation failed', error instanceof Error ? error.message : 'Unknown validation error')
    }
  }

  // Check compatibility between two Actions
  if (sourceActionId && targetActionId) {
    // Validate action ID formats
    validateParameters({ sourceActionId, targetActionId }, {
      sourceActionId: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_]+$/.test(value) || 'Source action ID format is invalid',
      targetActionId: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_]+$/.test(value) || 'Target action ID format is invalid'
    })

    console.log(`Checking compatibility: ${sourceActionId} -> ${targetActionId}`)

    const sourceAction = await getDiscoveryService().getAction(sourceActionId)
    const targetAction = await getDiscoveryService().getAction(targetActionId)

    if (!sourceAction) {
      throwNotFound('Source Action', sourceActionId)
    }

    if (!targetAction) {
      throwNotFound('Target Action', targetActionId)
    }

    try {
      const compatibilityIssues: CompatibilityIssue[] = getDiscoveryService().checkActionCompatibility(
        sourceAction,
        targetAction
      )

      return createSuccessResponse(null, {
        compatible: compatibilityIssues.length === 0,
        issues: compatibilityIssues,
        sourceAction: sourceActionId,
        targetAction: targetActionId
      })
    } catch (error) {
      throwValidationError('Compatibility check failed', error instanceof Error ? error.message : 'Unknown compatibility error')
    }
  }

  // Validate workflow chain of Actions
  if (actionIds && Array.isArray(actionIds)) {
    // Validate actionIds array
    if (actionIds.length === 0) {
      throwValidationError('Empty action chain', 'Action IDs array cannot be empty')
    }

    if (actionIds.length > 50) {
      throwValidationError('Action chain too long', 'Maximum 50 actions allowed in a chain')
    }

    // Validate each action ID format
    for (let i = 0; i < actionIds.length; i++) {
      const actionId = actionIds[i]
      if (typeof actionId !== 'string' || !/^[a-zA-Z0-9\-_]+$/.test(actionId)) {
        throwValidationError(`Invalid action ID at position ${i}`, 'Action IDs must contain only alphanumeric characters, hyphens, and underscores')
      }
    }

    console.log(`Validating workflow chain: ${actionIds.join(' -> ')}`)

    try {
      const chainValidation = await getDiscoveryService().validateWorkflowChain(actionIds)
      return createSuccessResponse(null, {
        chainValidation,
        actionIds,
        chainLength: actionIds.length
      })
    } catch (error) {
      throwValidationError('Workflow chain validation failed', error instanceof Error ? error.message : 'Unknown chain validation error')
    }
  }

  // No valid operation specified
  throwValidationError(
    'Invalid request operation',
    'Request must provide one of: action (for validation), actionIds (for chain validation), or sourceActionId+targetActionId (for compatibility check)'
  )
}

export const POST = withErrorHandling(handlePOST, 'Actions Validation')