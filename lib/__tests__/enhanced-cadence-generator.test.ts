import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { CadenceGenerator, CadenceGenerationResult } from '../cadence-generator'
import { ActionDiscoveryService } from '../action-discovery-service'
import { gracefulErrorHandler, ActionDiscoveryError } from '../graceful-error-handler'
import { logger } from '../logging-service'
import type { ParsedWorkflow, EnhancedWorkflow, ActionMetadata } from '../types'

// Mock dependencies
vi.mock('../action-discovery-service')
vi.mock('../graceful-error-handler')
vi.mock('../logging-service')

describe('Enhanced CadenceGenerator Error Handling', () => {
  let mockDiscoveryService: {
    getAction: Mock
    discoverActions: Mock
  }
  let mockGracefulErrorHandler: {
    createActionDiscoveryError: Mock
    handleDiscoveryError: Mock
  }
  let mockLogger: {
    info: Mock
    warn: Mock
    error: Mock
    generateCorrelationId: Mock
  }

  const sampleWorkflow: ParsedWorkflow = {
    actions: [
      {
        id: 'action-1',
        name: 'Transfer FLOW',
        actionType: 'transfer-flow',
        parameters: [
          { name: 'to', value: '0x123', type: 'Address', required: true },
          { name: 'amount', value: '10.0', type: 'UFix64', required: true }
        ]
      },
      {
        id: 'action-2',
        name: 'Mint NFT',
        actionType: 'mint-nft',
        parameters: [
          { name: 'metadata', value: '{"name": "Test NFT"}', type: 'String', required: true }
        ]
      }
    ],
    executionOrder: ['action-1', 'action-2'],
    metadata: {
      name: 'Test Workflow',
      totalActions: 2
    }
  }

  const sampleActionMetadata: ActionMetadata = {
    id: 'action-1',
    name: 'TransferFlow',
    description: 'Transfer FLOW tokens',
    category: 'Token',
    version: '1.0.0',
    inputs: [
      { name: 'to', type: 'Address', required: true, description: 'Recipient' },
      { name: 'amount', type: 'UFix64', required: true, description: 'Amount' }
    ],
    outputs: [
      { name: 'success', type: 'Bool', description: 'Success status' }
    ],
    parameters: [],
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 1000,
    securityLevel: 'medium' as any,
    author: 'Test',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contractAddress: '0x1234567890abcdef',
    dependencies: []
  }

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Setup mock discovery service
    mockDiscoveryService = {
      getAction: vi.fn(),
      discoverActions: vi.fn()
    }

    // Setup mock graceful error handler
    mockGracefulErrorHandler = {
      createActionDiscoveryError: vi.fn(),
      handleDiscoveryError: vi.fn()
    }

    // Setup mock logger
    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      generateCorrelationId: vi.fn().mockReturnValue('test-correlation-id')
    }

    // Apply mocks
    vi.mocked(gracefulErrorHandler).createActionDiscoveryError = mockGracefulErrorHandler.createActionDiscoveryError
    vi.mocked(gracefulErrorHandler).handleDiscoveryError = mockGracefulErrorHandler.handleDiscoveryError
    vi.mocked(logger).info = mockLogger.info
    vi.mocked(logger).warn = mockLogger.warn
    vi.mocked(logger).error = mockLogger.error
    vi.mocked(logger).generateCorrelationId = mockLogger.generateCorrelationId

    // Set up the discovery service mock on the CadenceGenerator
    ;(CadenceGenerator as any).discoveryService = mockDiscoveryService
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Successful Generation', () => {
    it('should generate transaction successfully when action discovery works', async () => {
      // Setup successful discovery
      mockDiscoveryService.getAction.mockResolvedValue(sampleActionMetadata)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow)

      expect(result.success).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toHaveLength(0)
      expect(result.fallbackUsed).toBe(false)
      expect(result.code).toContain('transaction()')
      expect(result.code).toContain('TransferFlow')
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting Cadence generation',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'cadence-generator'
        })
      )
    })

    it('should include execution time in result', async () => {
      mockDiscoveryService.getAction.mockResolvedValue(sampleActionMetadata)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow)

      expect(result.executionTime).toBeGreaterThan(0)
      expect(typeof result.executionTime).toBe('number')
    })
  })

  describe('Discovery Error Handling', () => {
    it('should handle DISCOVERY_IN_PROGRESS error with fallback', async () => {
      const discoveryError = new Error('Action discovery is already in progress') as ActionDiscoveryError
      discoveryError.code = 'DISCOVERY_IN_PROGRESS'
      discoveryError.retryable = true
      discoveryError.timestamp = Date.now()

      mockDiscoveryService.getAction.mockRejectedValue(discoveryError)
      mockGracefulErrorHandler.createActionDiscoveryError.mockReturnValue(discoveryError)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.success).toBe(true)
      expect(result.fallbackUsed).toBe(true)
      expect(result.warnings).toContain('Generated using fallback method due to action discovery issues')
      expect(result.code).toContain('FALLBACK TRANSACTION')
      expect(mockLogger.warn).toHaveBeenCalled()
    })

    it('should handle API_ERROR with fallback generation', async () => {
      const apiError = new Error('API request failed') as ActionDiscoveryError
      apiError.code = 'API_ERROR'
      apiError.retryable = true
      apiError.timestamp = Date.now()

      mockDiscoveryService.getAction.mockRejectedValue(apiError)
      mockGracefulErrorHandler.createActionDiscoveryError.mockReturnValue(apiError)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.success).toBe(true)
      expect(result.fallbackUsed).toBe(true)
      expect(result.code).toContain('FALLBACK TRANSACTION')
      expect(result.code).toContain('Action discovery unavailable')
    })

    it('should handle NETWORK_ERROR gracefully', async () => {
      const networkError = new Error('Network connection failed') as ActionDiscoveryError
      networkError.code = 'NETWORK_ERROR'
      networkError.retryable = true
      networkError.timestamp = Date.now()

      mockDiscoveryService.getAction.mockRejectedValue(networkError)
      mockGracefulErrorHandler.createActionDiscoveryError.mockReturnValue(networkError)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.success).toBe(true)
      expect(result.fallbackUsed).toBe(true)
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should handle TIMEOUT error with appropriate fallback', async () => {
      const timeoutError = new Error('Request timed out') as ActionDiscoveryError
      timeoutError.code = 'TIMEOUT'
      timeoutError.retryable = true
      timeoutError.timestamp = Date.now()

      mockDiscoveryService.getAction.mockRejectedValue(timeoutError)
      mockGracefulErrorHandler.createActionDiscoveryError.mockReturnValue(timeoutError)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.success).toBe(true)
      expect(result.fallbackUsed).toBe(true)
      expect(result.code).toContain('Static action generation')
    })
  })

  describe('Fallback Generation', () => {
    it('should generate static imports when discovery fails', async () => {
      mockDiscoveryService.getAction.mockRejectedValue(new Error('Discovery failed'))

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.code).toContain('import "FungibleToken"')
      expect(result.code).toContain('import "NonFungibleToken"')
      expect(result.code).toContain('import "FlowToken"')
    })

    it('should generate static action setup when metadata unavailable', async () => {
      mockDiscoveryService.getAction.mockRejectedValue(new Error('Metadata unavailable'))

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.code).toContain('Setup for transfer-flow')
      expect(result.code).toContain('Setup for mint-nft')
      expect(result.fallbackUsed).toBe(true)
    })

    it('should generate static action code when dynamic generation fails', async () => {
      mockDiscoveryService.getAction.mockRejectedValue(new Error('Code generation failed'))

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.code).toContain('FLOW vault reference')
      expect(result.code).toContain('NFT collection reference')
    })
  })

  describe('Error Transaction Generation', () => {
    it('should generate error transaction when fallbacks are disabled', async () => {
      const error = new Error('Discovery completely failed')
      mockDiscoveryService.getAction.mockRejectedValue(error)
      mockGracefulErrorHandler.createActionDiscoveryError.mockReturnValue({
        ...error,
        code: 'UNKNOWN_ERROR',
        retryable: false,
        timestamp: Date.now()
      } as ActionDiscoveryError)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: false
      })

      expect(result.success).toBe(false)
      expect(result.fallbackUsed).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.code).toContain('TRANSACTION GENERATION FAILED')
      expect(result.code).toContain('panic("Cannot execute - transaction generation failed")')
    })

    it('should generate error transaction when fallback also fails', async () => {
      // Mock both primary and fallback failures
      mockDiscoveryService.getAction.mockRejectedValue(new Error('Primary failure'))
      
      // Mock a fallback failure by making static generation throw
      const originalGenerateStaticActionCode = (CadenceGenerator as any).generateStaticActionCode
      ;(CadenceGenerator as any).generateStaticActionCode = vi.fn().mockImplementation(() => {
        throw new Error('Fallback also failed')
      })

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
      expect(result.code).toContain('TRANSACTION GENERATION FAILED')

      // Restore original method
      ;(CadenceGenerator as any).generateStaticActionCode = originalGenerateStaticActionCode
    })
  })

  describe('Timeout Handling', () => {
    it('should timeout generation after specified time', async () => {
      // Mock a slow discovery service
      mockDiscoveryService.getAction.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(sampleActionMetadata), 2000))
      )

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        timeout: 100, // 100ms timeout
        enableFallbacks: true
      })

      expect(result.fallbackUsed).toBe(true)
      expect(result.warnings).toContain('Generated using fallback method due to action discovery issues')
    })
  })

  describe('Summary Generation with Error Information', () => {
    it('should generate summary with discovery status', async () => {
      // Mock one successful and one failed action
      mockDiscoveryService.getAction
        .mockResolvedValueOnce(sampleActionMetadata)
        .mockRejectedValueOnce(new Error('Action not found'))

      const summary = await CadenceGenerator.generateSummary(sampleWorkflow)

      expect(summary).toContain('✓ Transfer FLOW')
      expect(summary).toContain('⚠ Mint NFT')
      expect(summary).toContain('Discovery failed')
      expect(summary).toContain('1 action(s) had discovery issues')
      expect(summary).toContain('Will use fallback generation')
    })

    it('should show success status when all actions discovered', async () => {
      mockDiscoveryService.getAction.mockResolvedValue(sampleActionMetadata)

      const summary = await CadenceGenerator.generateSummary(sampleWorkflow)

      expect(summary).toContain('All actions discovered successfully')
      expect(summary).toContain('Full dynamic generation available')
      expect(summary).not.toContain('WARNING')
    })
  })

  describe('Enhanced Workflow Support', () => {
    it('should handle EnhancedWorkflow with error recovery', async () => {
      const enhancedWorkflow: EnhancedWorkflow = {
        ...sampleWorkflow,
        securityLevel: 'high',
        estimatedGas: 5000,
        requiredBalance: [
          { token: 'FLOW', amount: '10.0' }
        ]
      }

      mockDiscoveryService.getAction.mockRejectedValue(new Error('Discovery failed'))

      const result = await CadenceGenerator.generateTransactionWithDetails(enhancedWorkflow, {
        enableFallbacks: true
      })

      expect(result.success).toBe(true)
      expect(result.fallbackUsed).toBe(true)
      expect(result.code).toContain('Enhanced Workflow')
    })
  })

  describe('Logging and Monitoring', () => {
    it('should log generation start and completion', async () => {
      mockDiscoveryService.getAction.mockResolvedValue(sampleActionMetadata)

      await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Starting Cadence generation',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'cadence-generator',
          operation: 'generate-transaction'
        })
      )

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Cadence generation completed successfully',
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'cadence-generator'
        })
      )
    })

    it('should log warnings for discovery failures', async () => {
      mockDiscoveryService.getAction.mockRejectedValue(new Error('Action not found'))

      await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to get action metadata for code generation, using static fallback',
        expect.objectContaining({
          component: 'cadence-generator',
          operation: 'generate-action-code'
        })
      )
    })

    it('should log errors with correlation IDs', async () => {
      const error = new Error('Critical failure')
      mockDiscoveryService.getAction.mockRejectedValue(error)

      await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: false
      })

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cadence generation failed',
        error,
        expect.objectContaining({
          correlationId: 'test-correlation-id',
          component: 'cadence-generator'
        })
      )
    })
  })

  describe('Configuration Options', () => {
    it('should respect enableFallbacks option', async () => {
      mockDiscoveryService.getAction.mockRejectedValue(new Error('Discovery failed'))

      const resultWithFallbacks = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: true
      })

      const resultWithoutFallbacks = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        enableFallbacks: false
      })

      expect(resultWithFallbacks.success).toBe(true)
      expect(resultWithFallbacks.fallbackUsed).toBe(true)

      expect(resultWithoutFallbacks.success).toBe(false)
      expect(resultWithoutFallbacks.fallbackUsed).toBe(false)
    })

    it('should include comments when requested', async () => {
      mockDiscoveryService.getAction.mockResolvedValue(sampleActionMetadata)

      const result = await CadenceGenerator.generateTransactionWithDetails(sampleWorkflow, {
        includeComments: true
      })

      expect(result.code).toContain('// Action 1:')
      expect(result.code).toContain('// Contract:')
    })
  })
})