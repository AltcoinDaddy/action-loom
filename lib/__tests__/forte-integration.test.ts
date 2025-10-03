/**
 * Basic tests for Forte integration foundation
 */

import { 
  createForteIntegration,
  validateForteAction,
  parseForteMetadata,
  areActionsCompatible,
  FLOW_NETWORKS,
  SecurityLevel
} from '../forte-integration'

describe('Forte Integration Foundation', () => {
  describe('createForteIntegration', () => {
    it('should create integration with default configuration', () => {
      const integration = createForteIntegration()
      
      expect(integration.flowClient).toBeDefined()
      expect(integration.discoveryService).toBeDefined()
    })

    it('should create integration with custom configuration', () => {
      const integration = createForteIntegration({
        apiKey: 'test-key',
        network: FLOW_NETWORKS.testnet
      })
      
      expect(integration.flowClient).toBeDefined()
      expect(integration.discoveryService).toBeDefined()
    })
  })

  describe('parseForteMetadata', () => {
    it('should parse valid metadata', () => {
      const rawData = {
        id: 'test-action-1',
        name: 'Test Action',
        description: 'A test action',
        version: '1.0.0',
        category: 'test',
        inputs: [
          { name: 'amount', type: 'UFix64', required: true }
        ],
        outputs: [
          { name: 'result', type: 'String' }
        ],
        gasEstimate: 1000,
        securityLevel: 'medium',
        author: 'test-author'
      }

      const metadata = parseForteMetadata(rawData)
      
      expect(metadata).not.toBeNull()
      expect(metadata?.id).toBe('test-action-1')
      expect(metadata?.name).toBe('Test Action')
      expect(metadata?.version).toBe('1.0.0')
      expect(metadata?.inputs).toHaveLength(1)
      expect(metadata?.outputs).toHaveLength(1)
    })

    it('should return null for invalid metadata', () => {
      const rawData = {
        // Missing required fields
        description: 'Invalid action'
      }

      const metadata = parseForteMetadata(rawData)
      expect(metadata).toBeNull()
    })
  })

  describe('validateForteAction', () => {
    it('should validate a secure action', () => {
      const action = {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test',
        category: 'test',
        inputs: [],
        outputs: [],
        version: '1.0.0',
        contractAddress: '0x1234567890abcdef',
        metadata: {} as any,
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityAudit: {
          status: 'passed' as const,
          score: 85,
          findings: []
        },
        dependencies: [],
        tags: []
      }

      const result = validateForteAction(action)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject action with low security score', () => {
      const action = {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test',
        category: 'test',
        inputs: [],
        outputs: [],
        version: '1.0.0',
        contractAddress: '0x1234567890abcdef',
        metadata: {} as any,
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityAudit: {
          status: 'failed' as const,
          score: 30, // Below minimum threshold
          findings: []
        },
        dependencies: [],
        tags: []
      }

      const result = validateForteAction(action)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('areActionsCompatible', () => {
    const createTestAction = (id: string, overrides: any = {}) => ({
      id,
      name: `Action ${id}`,
      description: 'Test action',
      category: 'test',
      inputs: [],
      outputs: [],
      version: '1.0.0',
      contractAddress: '0x1234567890abcdef',
      metadata: {} as any,
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 1000,
      securityAudit: {
        status: 'passed' as const,
        score: 85,
        findings: []
      },
      dependencies: [],
      tags: [],
      ...overrides
    })

    it('should find compatible actions', () => {
      const action1 = createTestAction('1')
      const action2 = createTestAction('2')

      const result = areActionsCompatible(action1, action2)
      expect(result.compatible).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect explicit conflicts', () => {
      const action1 = createTestAction('1', {
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: ['2'] // Conflicts with action 2
        }
      })
      const action2 = createTestAction('2')

      const result = areActionsCompatible(action1, action2)
      expect(result.compatible).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('should detect network incompatibility', () => {
      const action1 = createTestAction('1', {
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        }
      })
      const action2 = createTestAction('2', {
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'], // Different network
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        }
      })

      const result = areActionsCompatible(action1, action2)
      expect(result.compatible).toBe(false)
      expect(result.issues.some(issue => issue.includes('common networks'))).toBe(true)
    })
  })
})