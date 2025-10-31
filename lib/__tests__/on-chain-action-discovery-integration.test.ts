import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FlowAPIClient } from '../flow-api-client'
import { OnChainActionScanner } from '../on-chain-action-scanner'
import { ContractMetadataParser } from '../contract-metadata-parser'
import { ActionRegistryClient } from '../action-registry-client'
import { EnhancedActionDiscoveryService } from '../enhanced-action-discovery-service'
import { RedisCacheManager } from '../redis-cache-manager'
import { ActionMetadata, ActionRegistry, Contract, SecurityLevel } from '../types'

// Mock dependencies
vi.mock('../flow-api-client')
vi.mock('../redis-cache-manager')
vi.mock('../logging-service', () => ({
  logger: {
    generateCorrelationId: () => 'test-correlation-id',
    startTiming: () => 'test-timing-id',
    endTiming: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

describe('On-Chain Action Discovery Integration', () => {
  let mockClient: FlowAPIClient
  let mockCacheManager: RedisCacheManager
  let scanner: OnChainActionScanner
  let parser: ContractMetadataParser
  let registryClient: ActionRegistryClient
  let enhancedService: EnhancedActionDiscoveryService

  const mockRegistry: ActionRegistry = {
    address: '0x1654653399040a61',
    name: 'Test Registry',
    description: 'Test Action Registry',
    actions: ['test-action-1', 'test-action-2']
  }

  const mockActionMetadata: ActionMetadata = {
    id: 'test-action-1',
    name: 'Test Action',
    description: 'A test action',
    category: 'test',
    version: '1.0.0',
    inputs: [
      { name: 'amount', type: 'UFix64', required: true, description: 'Amount to transfer' }
    ],
    outputs: [
      { name: 'success', type: 'Bool', description: 'Success status' }
    ],
    parameters: [
      { name: 'amount', type: 'UFix64', value: '', required: true, description: 'Amount to transfer' }
    ],
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 100,
    securityLevel: SecurityLevel.LOW,
    author: 'Test Author',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const mockContract: Contract = {
    name: 'TestContract',
    code: 'pub contract TestContract {}',
    address: '0x1654653399040a61'
  }

  beforeEach(() => {
    // Setup mocks
    mockClient = {
      getCurrentNetwork: vi.fn().mockReturnValue({ name: 'testnet', endpoint: 'https://rest-testnet.onflow.org' }),
      executeScript: vi.fn(),
      getActionMetadata: vi.fn().mockResolvedValue(mockActionMetadata),
      discoverAllActions: vi.fn(),
      switchNetwork: vi.fn()
    } as any

    mockCacheManager = {
      getCachedDiscoveryResult: vi.fn(),
      cacheDiscoveryResult: vi.fn(),
      getCachedAction: vi.fn(),
      cacheAction: vi.fn(),
      getCachedRegistries: vi.fn().mockResolvedValue([mockRegistry]),
      cacheRegistries: vi.fn(),
      cacheRegistry: vi.fn(),
      invalidateAll: vi.fn(),
      invalidateRegistry: vi.fn(),
      setupCacheStructure: vi.fn(),
      getCacheStats: vi.fn().mockResolvedValue({
        totalKeys: 100,
        actionKeys: 50,
        categoryKeys: 10,
        discoveryKeys: 5
      }),
      isHealthy: vi.fn().mockResolvedValue(true),
      close: vi.fn()
    } as any

    // Initialize components
    scanner = new OnChainActionScanner(mockClient)
    parser = new ContractMetadataParser()
    registryClient = new ActionRegistryClient(mockClient, scanner, parser, mockCacheManager)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('OnChainActionScanner', () => {
    it('should scan registries successfully', async () => {
      // Mock script execution for registry scanning
      mockClient.executeScript = vi.fn().mockResolvedValue({
        value: {
          name: 'Test Registry',
          description: 'Test Action Registry',
          actions: ['test-action-1', 'test-action-2']
        }
      })

      const registries = await scanner.scanRegistries()

      expect(registries).toHaveLength(2) // Known registries from initialization
      expect(mockClient.executeScript).toHaveBeenCalled()
    })

    it('should extract action metadata from contract', async () => {
      // Mock contract interface script
      mockClient.executeScript = vi.fn().mockResolvedValue({
        value: {
          name: 'TestContract',
          description: 'Test contract interface',
          functionName: 'main',
          parameters: [
            { name: 'amount', type: 'UFix64', required: true, description: 'Amount parameter' }
          ],
          returns: [
            { name: 'result', type: 'Bool', description: 'Success result' }
          ],
          complexity: 'low',
          hasStorageOperations: false,
          hasExternalCalls: false,
          hasTokenTransfers: true,
          hasAdminFunctions: false,
          isVerified: true,
          hasSecurityAudit: false,
          version: '1.0.0',
          author: 'Test Author',
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        }
      })

      const actionMetadata = await scanner.extractActionMetadata(mockContract)

      expect(actionMetadata).toBeDefined()
      expect(actionMetadata.id).toContain('TestContract')
      expect(actionMetadata.inputs).toHaveLength(1)
      expect(actionMetadata.outputs).toHaveLength(1)
      expect(actionMetadata.securityLevel).toBe(SecurityLevel.MEDIUM) // Token transfers increase risk
    })

    it('should validate action compatibility', async () => {
      // Mock successful contract interface
      mockClient.executeScript = vi.fn().mockResolvedValue({
        value: {
          name: 'TestContract',
          description: 'Test contract',
          functionName: 'main',
          parameters: [],
          returns: [],
          complexity: 'low',
          hasStorageOperations: false,
          hasExternalCalls: false,
          hasTokenTransfers: false,
          hasAdminFunctions: false,
          isVerified: true,
          hasSecurityAudit: true,
          version: '1.0.0',
          author: 'Test Author',
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        }
      })

      const actionMetadata = await scanner.extractActionMetadata(mockContract)
      const isValid = scanner.validateActionCompatibility(actionMetadata)

      expect(isValid).toBe(true)
    })

    it('should handle scanner errors gracefully', async () => {
      mockClient.executeScript = vi.fn().mockRejectedValue(new Error('Network error'))

      const registries = await scanner.scanRegistries()

      // Should return empty array on error, not throw
      expect(registries).toHaveLength(0)
    })
  })

  describe('ContractMetadataParser', () => {
    it('should parse contract ABI to action metadata', async () => {
      const contractABI = {
        contractName: 'TestContract',
        contractAddress: '0x1654653399040a61',
        version: '1.0.0',
        functions: [
          {
            name: 'transfer',
            type: 'function' as const,
            inputs: [
              { name: 'recipient', type: 'Address', description: 'Recipient address' },
              { name: 'amount', type: 'UFix64', description: 'Amount to transfer' }
            ],
            outputs: [
              { name: 'success', type: 'Bool', description: 'Transfer success' }
            ],
            stateMutability: 'nonpayable' as const,
            visibility: 'public' as const,
            documentation: 'Transfer tokens to recipient'
          }
        ],
        events: [],
        structs: [],
        resources: [],
        interfaces: [],
        imports: []
      }

      const actions = await parser.parseContractABI(contractABI)

      expect(actions).toHaveLength(1)
      expect(actions[0].name).toContain('Transfer')
      expect(actions[0].category).toBe('token')
      expect(actions[0].inputs).toHaveLength(2)
      expect(actions[0].outputs).toHaveLength(1)
    })

    it('should validate action metadata', () => {
      const validationResult = parser.validateActionMetadata(mockActionMetadata)

      expect(validationResult.isValid).toBe(true)
      expect(validationResult.errors).toHaveLength(0)
    })

    it('should detect invalid action metadata', () => {
      const invalidAction = {
        ...mockActionMetadata,
        id: '', // Missing required field
        gasEstimate: -100 // Invalid value
      }

      const validationResult = parser.validateActionMetadata(invalidAction)

      expect(validationResult.isValid).toBe(false)
      expect(validationResult.errors.length).toBeGreaterThan(0)
    })

    it('should check action compatibility', () => {
      const sourceAction = { ...mockActionMetadata, id: 'source-action' }
      const targetAction = {
        ...mockActionMetadata,
        id: 'target-action',
        compatibility: {
          ...mockActionMetadata.compatibility,
          supportedNetworks: ['mainnet'] // Different networks
        }
      }

      const compatibilityResult = parser.checkActionCompatibility(sourceAction, targetAction)

      expect(compatibilityResult.isValid).toBe(false)
      expect(compatibilityResult.errors.length).toBeGreaterThan(0)
    })
  })

  describe('ActionRegistryClient', () => {
    it('should connect to official registries', async () => {
      // Mock scanner to return registries
      vi.spyOn(scanner, 'scanRegistries').mockResolvedValue([mockRegistry])

      const registries = await registryClient.connectToOfficialRegistries()

      expect(registries).toHaveLength(1)
      expect(registries[0]).toEqual(mockRegistry)
    })

    it('should setup intelligent caching', async () => {
      await registryClient.setupIntelligentCaching()

      expect(mockCacheManager.setupCacheStructure).toHaveBeenCalled()
    })

    it('should detect registry updates', async () => {
      // Mock current registry state
      mockClient.executeScript = vi.fn().mockResolvedValue({
        value: {
          name: 'Test Registry',
          description: 'Test Action Registry',
          actions: ['test-action-1', 'test-action-2', 'test-action-3'], // One new action
          version: '1.0.0',
          lastUpdate: 123456789
        }
      })

      const updateInfos = await registryClient.detectRegistryUpdates()

      expect(updateInfos).toHaveLength(1)
      expect(updateInfos[0].hasChanges).toBe(true)
      expect(updateInfos[0].newActions).toContain('test-action-3')
    })

    it('should provide fallback actions when discovery fails', async () => {
      const fallbackActions = await registryClient.getFallbackActions()

      expect(fallbackActions).toHaveLength(2)
      expect(fallbackActions[0].id).toBe('fallback-flow-transfer')
      expect(fallbackActions[1].id).toBe('fallback-account-info')
    })

    it('should get registry statistics', async () => {
      const stats = await registryClient.getStats()

      expect(stats).toHaveProperty('totalRegistries')
      expect(stats).toHaveProperty('healthyRegistries')
      expect(stats).toHaveProperty('totalActions')
      expect(stats).toHaveProperty('cacheHitRate')
      expect(stats).toHaveProperty('averageResponseTime')
    })
  })

  describe('EnhancedActionDiscoveryService', () => {
    beforeEach(() => {
      enhancedService = new EnhancedActionDiscoveryService({
        network: 'testnet',
        enableCaching: true,
        enableBackgroundRefresh: false, // Disable for tests
        enableFallback: true
      })
    })

    afterEach(async () => {
      await enhancedService.cleanup()
    })

    it('should discover actions successfully', async () => {
      // Mock successful discovery
      mockClient.discoverAllActions = vi.fn().mockResolvedValue({
        actions: [mockActionMetadata],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 1000
      })

      const result = await enhancedService.discoverActions()

      expect(result.actions).toHaveLength(1)
      expect(result.registries).toHaveLength(1)
      expect(result.totalFound).toBe(1)
    })

    it('should return cached results when available', async () => {
      const cachedResult = {
        actions: [mockActionMetadata],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 500
      }

      mockCacheManager.getCachedDiscoveryResult = vi.fn().mockResolvedValue(cachedResult)

      const result = await enhancedService.discoverActions()

      expect(result).toEqual(cachedResult)
      expect(mockCacheManager.getCachedDiscoveryResult).toHaveBeenCalled()
    })

    it('should use fallback when discovery fails', async () => {
      // Mock discovery failure
      mockClient.discoverAllActions = vi.fn().mockRejectedValue(new Error('Discovery failed'))
      mockCacheManager.getCachedDiscoveryResult = vi.fn().mockResolvedValue(null)

      const result = await enhancedService.discoverActions()

      expect(result.actions).toHaveLength(2) // Fallback actions
      expect(result.errors).toContain('Primary discovery failed, using fallback actions')
    })

    it('should get action by ID', async () => {
      mockCacheManager.getCachedAction = vi.fn().mockResolvedValue(mockActionMetadata)

      const action = await enhancedService.getAction('test-action-1')

      expect(action).toEqual(mockActionMetadata)
      expect(mockCacheManager.getCachedAction).toHaveBeenCalledWith('test-action-1')
    })

    it('should search actions by query', async () => {
      // Mock discovery result
      mockClient.discoverAllActions = vi.fn().mockResolvedValue({
        actions: [mockActionMetadata],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 1000
      })

      const results = await enhancedService.searchActions('test')

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(mockActionMetadata)
    })

    it('should get actions by category', async () => {
      // Mock discovery result
      mockClient.discoverAllActions = vi.fn().mockResolvedValue({
        actions: [mockActionMetadata],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 1000
      })

      const results = await enhancedService.getActionsByCategory('test')

      expect(results).toHaveLength(1)
      expect(results[0].category).toBe('test')
    })

    it('should get all categories', async () => {
      const testAction2 = { ...mockActionMetadata, id: 'test-action-2', category: 'defi' }
      
      // Mock discovery result with multiple categories
      mockClient.discoverAllActions = vi.fn().mockResolvedValue({
        actions: [mockActionMetadata, testAction2],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 2,
        executionTime: 1000
      })

      const categories = await enhancedService.getCategories()

      expect(categories).toContain('test')
      expect(categories).toContain('defi')
      expect(categories).toHaveLength(2)
    })

    it('should switch networks', async () => {
      await enhancedService.switchNetwork('mainnet')

      expect(mockClient.switchNetwork).toHaveBeenCalledWith('mainnet')
      expect(mockCacheManager.invalidateAll).toHaveBeenCalled()
    })

    it('should force refresh all data', async () => {
      // Mock discovery result
      mockClient.discoverAllActions = vi.fn().mockResolvedValue({
        actions: [mockActionMetadata],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 1000
      })

      const result = await enhancedService.forceRefresh()

      expect(mockCacheManager.invalidateAll).toHaveBeenCalled()
      expect(result.actions).toHaveLength(1)
    })

    it('should provide comprehensive metrics', async () => {
      const metrics = await enhancedService.getMetrics()

      expect(metrics).toHaveProperty('totalDiscoveries')
      expect(metrics).toHaveProperty('successfulDiscoveries')
      expect(metrics).toHaveProperty('failedDiscoveries')
      expect(metrics).toHaveProperty('averageDiscoveryTime')
      expect(metrics).toHaveProperty('cacheHitRate')
      expect(metrics).toHaveProperty('registryHealth')
      expect(metrics).toHaveProperty('lastDiscoveryTime')
      expect(metrics).toHaveProperty('backgroundRefreshStatus')
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete discovery workflow', async () => {
      // Setup mocks for complete workflow
      mockClient.executeScript = vi.fn()
        .mockResolvedValueOnce({ // Registry scan
          value: {
            name: 'Test Registry',
            description: 'Test Action Registry',
            actions: ['test-action-1']
          }
        })
        .mockResolvedValueOnce({ // Action metadata
          value: mockActionMetadata
        })

      mockClient.getActionMetadata = vi.fn().mockResolvedValue(mockActionMetadata)
      mockCacheManager.getCachedDiscoveryResult = vi.fn().mockResolvedValue(null)

      const enhancedService = new EnhancedActionDiscoveryService({
        network: 'testnet',
        enableCaching: true,
        enableBackgroundRefresh: false,
        enableFallback: true
      })

      const result = await enhancedService.discoverActions()

      expect(result.actions.length).toBeGreaterThan(0)
      expect(result.registries.length).toBeGreaterThan(0)
      expect(mockCacheManager.cacheDiscoveryResult).toHaveBeenCalled()

      await enhancedService.cleanup()
    })

    it('should handle network errors gracefully', async () => {
      mockClient.executeScript = vi.fn().mockRejectedValue(new Error('Network timeout'))
      mockCacheManager.getCachedDiscoveryResult = vi.fn().mockResolvedValue(null)

      const enhancedService = new EnhancedActionDiscoveryService({
        network: 'testnet',
        enableCaching: true,
        enableBackgroundRefresh: false,
        enableFallback: true
      })

      // Should not throw, should return fallback
      const result = await enhancedService.discoverActions()

      expect(result.actions).toHaveLength(2) // Fallback actions
      expect(result.errors).toBeDefined()

      await enhancedService.cleanup()
    })

    it('should maintain performance under load', async () => {
      const enhancedService = new EnhancedActionDiscoveryService({
        network: 'testnet',
        enableCaching: true,
        enableBackgroundRefresh: false,
        enableFallback: true
      })

      // Mock fast cached response
      mockCacheManager.getCachedDiscoveryResult = vi.fn().mockResolvedValue({
        actions: [mockActionMetadata],
        registries: [mockRegistry],
        lastUpdated: new Date().toISOString(),
        totalFound: 1,
        executionTime: 100
      })

      const startTime = Date.now()
      
      // Perform multiple concurrent discoveries
      const promises = Array(10).fill(null).map(() => enhancedService.discoverActions())
      const results = await Promise.all(promises)

      const endTime = Date.now()
      const totalTime = endTime - startTime

      // Should complete quickly due to caching
      expect(totalTime).toBeLessThan(1000) // Less than 1 second
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.actions).toHaveLength(1)
      })

      await enhancedService.cleanup()
    })
  })
})