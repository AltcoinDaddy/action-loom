import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionMappingService, ActionMappingError } from '../action-mapping-service'
import { ActionDiscoveryService } from '../action-discovery-service'
import { 
  ActionMetadata, 
  Entity, 
  IntentClassification, 
  WorkflowIntent,
  SecurityLevel 
} from '../types'

// Mock the Action Discovery Service
const mockDiscoveryService = {
  searchActions: vi.fn(),
  getAction: vi.fn()
} as unknown as ActionDiscoveryService

// Sample test data
const mockSwapAction: ActionMetadata = {
  id: 'swap_usdc_flow',
  name: 'USDC to FLOW Swap',
  description: 'Swap USDC tokens for FLOW tokens using DEX',
  category: 'defi',
  version: '1.0.0',
  inputs: [
    {
      name: 'amount',
      type: 'number',
      required: true,
      description: 'Amount to swap'
    },
    {
      name: 'fromToken',
      type: 'string',
      required: true,
      description: 'Source token symbol'
    },
    {
      name: 'toToken',
      type: 'string',
      required: true,
      description: 'Destination token symbol'
    }
  ],
  outputs: [],
  parameters: [],
  compatibility: {
    requiredCapabilities: ['defi'],
    supportedNetworks: ['flow-testnet', 'flow-mainnet'],
    minimumFlowVersion: '1.0.0',
    conflictsWith: []
  },
  gasEstimate: 1000,
  securityLevel: SecurityLevel.MEDIUM,
  author: 'test',
  createdAt: '2024-01-01',
  updatedAt: '2024-01-01'
}

const mockSwapIntent: IntentClassification = {
  intent: WorkflowIntent.SWAP,
  confidence: 0.9,
  entities: [],
  parameters: {
    amount: '100',
    fromToken: 'USDC',
    toToken: 'FLOW'
  }
}

const mockSwapEntities: Entity[] = [
  {
    type: 'action',
    value: 'swap',
    confidence: 0.95,
    position: [0, 4]
  },
  {
    type: 'amount',
    value: '100',
    confidence: 0.9,
    position: [5, 8]
  },
  {
    type: 'token',
    value: 'USDC',
    confidence: 0.9,
    position: [9, 13]
  },
  {
    type: 'token',
    value: 'FLOW',
    confidence: 0.9,
    position: [17, 21]
  }
]

describe('ActionMappingService', () => {
  let service: ActionMappingService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ActionMappingService(mockDiscoveryService)
  })

  describe('mapIntentToActions', () => {
    it('should map swap intent to swap actions successfully', async () => {
      // Mock search results
      const mockSearchResults = [
        {
          action: mockSwapAction,
          score: 0.95,
          reasons: ['High semantic similarity']
        }
      ]

      vi.mocked(mockDiscoveryService.searchActions).mockResolvedValue(mockSearchResults)

      const results = await service.mapIntentToActions(mockSwapIntent, mockSwapEntities, 5)

      expect(results).toHaveLength(1)
      expect(results[0].action.id).toBe('swap_usdc_flow')
      expect(results[0].matchScore).toBeGreaterThan(0.9)
    })

    it('should handle empty search results', async () => {
      vi.mocked(mockDiscoveryService.searchActions).mockResolvedValue([])

      const results = await service.mapIntentToActions(mockSwapIntent, mockSwapEntities, 5)

      expect(results).toHaveLength(0)
    })
  })

  describe('validateActionParameters', () => {
    it('should validate valid parameters successfully', async () => {
      const params = {
        amount: '100',
        fromToken: 'USDC',
        toToken: 'FLOW'
      }

      const result = await service.validateActionParameters(mockSwapAction, params)

      expect(result.isValid).toBe(true)
      expect(result.validatedParams.amount).toBe(100)
      expect(result.validatedParams.fromToken).toBe('USDC')
      expect(result.validatedParams.toToken).toBe('FLOW')
    })

    it('should detect missing required parameters', async () => {
      const params = {
        amount: '100'
        // Missing fromToken and toToken
      }

      const result = await service.validateActionParameters(mockSwapAction, params)

      expect(result.isValid).toBe(false)
      expect(result.missingRequired).toContain('fromToken')
      expect(result.missingRequired).toContain('toToken')
    })
  })
})