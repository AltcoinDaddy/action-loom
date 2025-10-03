import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowCompatibilityService } from '../workflow-compatibility-service'
import { 
  ParsedWorkflow, 
  ActionMetadata, 
  SecurityLevel,
  ParsedAction 
} from '../types'

describe('WorkflowCompatibilityService', () => {
  let service: WorkflowCompatibilityService
  let mockActionMetadata: ActionMetadata[]
  let mockWorkflow: ParsedWorkflow

  beforeEach(() => {
    service = new WorkflowCompatibilityService()
    
    // Mock action metadata
    mockActionMetadata = [
      {
        id: 'swap-action',
        name: 'Token Swap',
        description: 'Swap tokens',
        category: 'DeFi',
        version: '1.0.0',
        inputs: [
          { name: 'tokenIn', type: 'String', required: true },
          { name: 'amountIn', type: 'UFix64', required: true }
        ],
        outputs: [
          { name: 'tokenOut', type: 'String' },
          { name: 'amountOut', type: 'UFix64' }
        ],
        parameters: [],
        compatibility: {
          requiredCapabilities: ['TokenSwap'],
          supportedNetworks: ['mainnet', 'testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: SecurityLevel.MEDIUM,
        author: 'test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 'stake-action',
        name: 'Token Stake',
        description: 'Stake tokens',
        category: 'DeFi',
        version: '1.0.0',
        inputs: [
          { name: 'token', type: 'String', required: true },
          { name: 'amount', type: 'UFix64', required: true }
        ],
        outputs: [
          { name: 'stakingReceipt', type: 'Resource' }
        ],
        parameters: [],
        compatibility: {
          requiredCapabilities: ['Staking'],
          supportedNetworks: ['mainnet', 'testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1500,
        securityLevel: SecurityLevel.HIGH,
        author: 'test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      {
        id: 'transfer-action',
        name: 'Token Transfer',
        description: 'Transfer tokens',
        category: 'Basic',
        version: '1.0.0',
        inputs: [
          { name: 'token', type: 'String', required: true },
          { name: 'amount', type: 'UFix64', required: true },
          { name: 'recipient', type: 'Address', required: true }
        ],
        outputs: [
          { name: 'success', type: 'Bool' }
        ],
        parameters: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['mainnet', 'testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 500,
        securityLevel: SecurityLevel.LOW,
        author: 'test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    ]

    // Mock workflow with compatible actions
    mockWorkflow = {
      actions: [
        {
          id: 'action-1',
          actionType: 'swap-action',
          name: 'Swap USDC to FLOW',
          parameters: [
            { name: 'tokenIn', type: 'String', value: 'USDC', required: true },
            { name: 'amountIn', type: 'UFix64', value: '100.0', required: true }
          ],
          nextActions: ['action-2'],
          position: { x: 0, y: 0 }
        },
        {
          id: 'action-2',
          actionType: 'stake-action',
          name: 'Stake FLOW',
          parameters: [
            { name: 'token', type: 'String', value: 'FLOW', required: true },
            { name: 'amount', type: 'UFix64', value: '50.0', required: true }
          ],
          nextActions: [],
          position: { x: 200, y: 0 }
        }
      ],
      executionOrder: ['action-1', 'action-2'],
      rootActions: ['action-1'],
      metadata: {
        totalActions: 2,
        totalConnections: 1,
        createdAt: '2024-01-01'
      }
    }
  })

  describe('checkWorkflowCompatibility', () => {
    it('should validate a compatible workflow', async () => {
      const result = await service.checkWorkflowCompatibility(mockWorkflow, mockActionMetadata)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.circularDependencies).toHaveLength(0)
      expect(result.typeCompatibility.compatible).toBe(true)
    })

    it('should detect circular dependencies', async () => {
      // Create workflow with circular dependency
      const circularWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          {
            ...mockWorkflow.actions[0],
            nextActions: ['action-2']
          },
          {
            ...mockWorkflow.actions[1],
            nextActions: ['action-1'] // Creates circular dependency
          }
        ]
      }

      const result = await service.checkWorkflowCompatibility(circularWorkflow, mockActionMetadata)

      expect(result.isValid).toBe(false)
      expect(result.circularDependencies.length).toBeGreaterThan(0)
      expect(result.errors.some(e => e.type === 'CIRCULAR_DEPENDENCY')).toBe(true)
    })

    it('should detect type incompatibility', async () => {
      // Create action metadata with incompatible types
      const incompatibleMetadata: ActionMetadata[] = [
        ...mockActionMetadata,
        {
          id: 'incompatible-action',
          name: 'Incompatible Action',
          description: 'Action with incompatible inputs',
          category: 'Test',
          version: '1.0.0',
          inputs: [
            { name: 'requiredResource', type: 'Resource', required: true }
          ],
          outputs: [],
          parameters: [],
          compatibility: {
            requiredCapabilities: [],
            supportedNetworks: ['mainnet'],
            minimumFlowVersion: '1.0.0',
            conflictsWith: []
          },
          gasEstimate: 100,
          securityLevel: SecurityLevel.LOW,
          author: 'test',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01'
        }
      ]

      const incompatibleWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          mockWorkflow.actions[0], // Outputs String and UFix64
          {
            id: 'action-2',
            actionType: 'incompatible-action',
            name: 'Incompatible Action',
            parameters: [],
            nextActions: [],
            position: { x: 200, y: 0 }
          }
        ]
      }

      const result = await service.checkWorkflowCompatibility(incompatibleWorkflow, incompatibleMetadata)

      expect(result.isValid).toBe(false)
      expect(result.typeCompatibility.compatible).toBe(false)
      expect(result.typeCompatibility.issues.length).toBeGreaterThan(0)
    })

    it('should detect network incompatibility', async () => {
      const networkIncompatibleMetadata: ActionMetadata[] = [
        {
          ...mockActionMetadata[0],
          compatibility: {
            ...mockActionMetadata[0].compatibility,
            supportedNetworks: ['mainnet']
          }
        },
        {
          ...mockActionMetadata[1],
          compatibility: {
            ...mockActionMetadata[1].compatibility,
            supportedNetworks: ['testnet']
          }
        }
      ]

      const result = await service.checkWorkflowCompatibility(mockWorkflow, networkIncompatibleMetadata)

      expect(result.isValid).toBe(false)
      expect(result.typeCompatibility.issues.some(issue => 
        issue.issue.includes('different networks')
      )).toBe(true)
    })

    it('should detect explicit conflicts', async () => {
      const conflictingMetadata: ActionMetadata[] = [
        {
          ...mockActionMetadata[0],
          compatibility: {
            ...mockActionMetadata[0].compatibility,
            conflictsWith: ['stake-action']
          }
        },
        mockActionMetadata[1]
      ]

      const result = await service.checkWorkflowCompatibility(mockWorkflow, conflictingMetadata)

      expect(result.isValid).toBe(false)
      expect(result.typeCompatibility.issues.some(issue => 
        issue.issue.includes('explicitly marked as incompatible')
      )).toBe(true)
    })

    it('should generate warnings for complex workflows', async () => {
      // Create a workflow with many actions
      const largeWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: Array.from({ length: 60 }, (_, i) => ({
          id: `action-${i}`,
          actionType: 'transfer-action',
          name: `Transfer ${i}`,
          parameters: [],
          nextActions: i < 59 ? [`action-${i + 1}`] : [],
          position: { x: i * 100, y: 0 }
        })),
        executionOrder: Array.from({ length: 60 }, (_, i) => `action-${i}`),
        rootActions: ['action-0'],
        metadata: {
          totalActions: 60,
          totalConnections: 59,
          createdAt: '2024-01-01'
        }
      }

      const result = await service.checkWorkflowCompatibility(largeWorkflow, mockActionMetadata)

      expect(result.warnings.some(w => w.includes('Large workflow detected'))).toBe(true)
    })
  })

  describe('buildDependencyGraph', () => {
    it('should build correct dependency graph', async () => {
      const result = await service.checkWorkflowCompatibility(mockWorkflow, mockActionMetadata)
      const graph = result.dependencyGraph

      expect(graph.nodes.size).toBe(2)
      expect(graph.edges).toHaveLength(1)
      expect(graph.edges[0]).toEqual({ from: 'action-1', to: 'action-2' })
      
      const node1 = graph.nodes.get('action-1')
      const node2 = graph.nodes.get('action-2')
      
      expect(node1?.dependencies).toHaveLength(0)
      expect(node1?.dependents).toEqual(['action-2'])
      expect(node2?.dependencies).toEqual(['action-1'])
      expect(node2?.dependents).toHaveLength(0)
    })

    it('should calculate correct node depths', async () => {
      // Create a deeper workflow
      const deepWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          {
            id: 'action-1',
            actionType: 'swap-action',
            name: 'Action 1',
            parameters: [],
            nextActions: ['action-2'],
            position: { x: 0, y: 0 }
          },
          {
            id: 'action-2',
            actionType: 'stake-action',
            name: 'Action 2',
            parameters: [],
            nextActions: ['action-3'],
            position: { x: 100, y: 0 }
          },
          {
            id: 'action-3',
            actionType: 'transfer-action',
            name: 'Action 3',
            parameters: [],
            nextActions: [],
            position: { x: 200, y: 0 }
          }
        ],
        executionOrder: ['action-1', 'action-2', 'action-3'],
        rootActions: ['action-1']
      }

      const result = await service.checkWorkflowCompatibility(deepWorkflow, mockActionMetadata)
      const graph = result.dependencyGraph

      expect(graph.nodes.get('action-1')?.depth).toBe(0)
      expect(graph.nodes.get('action-2')?.depth).toBe(1)
      expect(graph.nodes.get('action-3')?.depth).toBe(2)
      expect(graph.maxDepth).toBe(2)
    })
  })

  describe('getDependencyPath', () => {
    it('should find dependency path between actions', async () => {
      const result = await service.checkWorkflowCompatibility(mockWorkflow, mockActionMetadata)
      const path = service.getDependencyPath(result.dependencyGraph, 'action-1', 'action-2')

      expect(path).toEqual(['action-1', 'action-2'])
    })

    it('should return null for non-connected actions', async () => {
      const result = await service.checkWorkflowCompatibility(mockWorkflow, mockActionMetadata)
      const path = service.getDependencyPath(result.dependencyGraph, 'action-2', 'action-1')

      expect(path).toBeNull()
    })
  })

  describe('suggestOptimizations', () => {
    it('should suggest parallelization opportunities', async () => {
      // Create workflow with parallel actions
      const parallelWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          {
            id: 'action-1',
            actionType: 'swap-action',
            name: 'Action 1',
            parameters: [],
            nextActions: [],
            position: { x: 0, y: 0 }
          },
          {
            id: 'action-2',
            actionType: 'stake-action',
            name: 'Action 2',
            parameters: [],
            nextActions: [],
            position: { x: 100, y: 0 }
          }
        ],
        executionOrder: ['action-1', 'action-2'],
        rootActions: ['action-1', 'action-2']
      }

      const result = await service.checkWorkflowCompatibility(parallelWorkflow, mockActionMetadata)
      const suggestions = service.suggestOptimizations(result)

      expect(suggestions.some(s => s.includes('parallelizing'))).toBe(true)
    })
  })

  describe('type compatibility', () => {
    it('should recognize compatible types', async () => {
      // Test UFix64 to UInt64 compatibility
      const compatibleWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          {
            id: 'action-1',
            actionType: 'swap-action', // outputs UFix64
            name: 'Swap',
            parameters: [],
            nextActions: ['action-2'],
            position: { x: 0, y: 0 }
          },
          {
            id: 'action-2',
            actionType: 'transfer-action', // accepts UFix64
            name: 'Transfer',
            parameters: [],
            nextActions: [],
            position: { x: 100, y: 0 }
          }
        ]
      }

      const result = await service.checkWorkflowCompatibility(compatibleWorkflow, mockActionMetadata)
      expect(result.typeCompatibility.compatible).toBe(true)
    })
  })
})