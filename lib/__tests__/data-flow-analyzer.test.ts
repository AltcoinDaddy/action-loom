import { describe, it, expect, beforeEach } from 'vitest'
import { DataFlowAnalyzer } from '../data-flow-analyzer'
import { 
  ParsedWorkflow, 
  ActionMetadata, 
  ParameterType 
} from '../types'

describe('DataFlowAnalyzer', () => {
  let analyzer: DataFlowAnalyzer
  let mockWorkflow: ParsedWorkflow
  let mockActionMetadata: Record<string, ActionMetadata>
  let mockParameterValues: Record<string, Record<string, any>>

  beforeEach(() => {
    analyzer = new DataFlowAnalyzer()

    // Create mock action metadata
    mockActionMetadata = {
      'swap-tokens': {
        id: 'swap-tokens',
        name: 'Swap Tokens',
        description: 'Swap one token for another',
        category: 'DeFi',
        version: '1.0.0',
        parameters: [
          {
            name: 'tokenIn',
            type: 'Address',
            required: true,
            value: ''
          },
          {
            name: 'tokenOut', 
            type: 'Address',
            required: true,
            value: ''
          },
          {
            name: 'amountIn',
            type: 'UFix64',
            required: true,
            value: ''
          }
        ],
        outputs: [
          {
            name: 'amountOut',
            type: 'UFix64',
            description: 'Amount of tokens received'
          },
          {
            name: 'transactionId',
            type: 'String',
            description: 'Transaction ID'
          }
        ],
        inputs: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: 'medium' as any,
        author: 'test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      'stake-tokens': {
        id: 'stake-tokens',
        name: 'Stake Tokens',
        description: 'Stake tokens for rewards',
        category: 'DeFi',
        version: '1.0.0',
        parameters: [
          {
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          },
          {
            name: 'validator',
            type: 'Address',
            required: true,
            value: ''
          }
        ],
        outputs: [
          {
            name: 'stakingId',
            type: 'String',
            description: 'Staking position ID'
          }
        ],
        inputs: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 800,
        securityLevel: 'medium' as any,
        author: 'test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      'transfer-tokens': {
        id: 'transfer-tokens',
        name: 'Transfer Tokens',
        description: 'Transfer tokens to another address',
        category: 'Basic',
        version: '1.0.0',
        parameters: [
          {
            name: 'recipient',
            type: 'Address',
            required: true,
            value: ''
          },
          {
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          }
        ],
        outputs: [
          {
            name: 'success',
            type: 'Bool',
            description: 'Transfer success status'
          }
        ],
        inputs: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 500,
        securityLevel: 'low' as any,
        author: 'test',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    }

    // Create mock workflow
    mockWorkflow = {
      actions: [
        {
          id: 'action-1',
          actionType: 'swap-tokens',
          name: 'Swap FLOW to USDC',
          parameters: [],
          nextActions: ['action-2'],
          position: { x: 100, y: 100 }
        },
        {
          id: 'action-2',
          actionType: 'stake-tokens',
          name: 'Stake USDC',
          parameters: [],
          nextActions: [],
          position: { x: 300, y: 100 }
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

    // Create mock parameter values with dependencies
    mockParameterValues = {
      'action-1': {
        tokenIn: '0x1654653399040a61',
        tokenOut: '0x3c5959b568896393',
        amountIn: '100.0'
      },
      'action-2': {
        amount: 'action-1.amountOut', // Parameter dependency
        validator: '0x8624b52f9ddcd04a'
      }
    }
  })

  describe('analyzeDataFlow', () => {
    it('should perform complete data flow analysis', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result).toHaveProperty('dependencies')
      expect(result).toHaveProperty('connections')
      expect(result).toHaveProperty('circularDependencies')
      expect(result).toHaveProperty('unresolvedReferences')
      expect(result).toHaveProperty('typeCompatibilityIssues')
      expect(result).toHaveProperty('orphanedActions')
      expect(result).toHaveProperty('executionOrder')
      expect(result).toHaveProperty('dataFlowGraph')
    })

    it('should identify parameter dependencies correctly', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result.dependencies['action-2'].dependsOn).toContain('action-1')
      expect(result.dependencies['action-2'].parameterDependencies).toHaveLength(1)
      expect(result.dependencies['action-2'].parameterDependencies[0]).toMatchObject({
        parameterName: 'amount',
        sourceActionId: 'action-1',
        sourceOutputName: 'amountOut',
        isTypeCompatible: true
      })
    })

    it('should analyze parameter connections', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result.connections).toHaveLength(1)
      expect(result.connections[0]).toMatchObject({
        sourceActionId: 'action-1',
        sourceOutputName: 'amountOut',
        targetActionId: 'action-2',
        targetParameterName: 'amount',
        sourceType: 'UFix64',
        targetType: 'UFix64',
        isTypeCompatible: true
      })
    })

    it('should calculate execution order based on dependencies', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result.executionOrder).toEqual(['action-1', 'action-2'])
    })

    it('should build data flow graph with nodes and edges', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result.dataFlowGraph.nodes.length).toBeGreaterThan(0)
      expect(result.dataFlowGraph.edges.length).toBeGreaterThan(0)
      
      // Should have action nodes
      const actionNodes = result.dataFlowGraph.nodes.filter(n => n.type === 'action')
      expect(actionNodes).toHaveLength(2)
      
      // Should have parameter and output nodes
      const paramNodes = result.dataFlowGraph.nodes.filter(n => n.type === 'parameter')
      const outputNodes = result.dataFlowGraph.nodes.filter(n => n.type === 'output')
      expect(paramNodes.length).toBeGreaterThan(0)
      expect(outputNodes.length).toBeGreaterThan(0)
    })
  })

  describe('circular dependency detection', () => {
    it('should detect circular dependencies', () => {
      // Create a circular dependency
      const circularParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: 'action-2.stakingId' // Creates circular dependency
        },
        'action-2': {
          amount: 'action-1.amountOut',
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, circularParameterValues)

      expect(result.circularDependencies.length).toBeGreaterThan(0)
      expect(result.circularDependencies[0].cycle).toContain('action-1')
      expect(result.circularDependencies[0].cycle).toContain('action-2')
    })

    it('should provide breaking suggestions for circular dependencies', () => {
      const circularParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: 'action-2.stakingId'
        },
        'action-2': {
          amount: 'action-1.amountOut',
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, circularParameterValues)

      expect(result.circularDependencies[0].breakingSuggestions.length).toBeGreaterThan(0)
    })
  })

  describe('type compatibility analysis', () => {
    it('should detect type compatibility issues', () => {
      // Create type mismatch
      const incompatibleParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'action-1.transactionId', // String -> UFix64 (incompatible)
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, incompatibleParameterValues)

      expect(result.typeCompatibilityIssues.length).toBeGreaterThan(0)
      expect(result.typeCompatibilityIssues[0]).toMatchObject({
        sourceType: 'String',
        targetType: 'UFix64',
        canConvert: true // String can be converted to UFix64
      })
    })

    it('should provide transformation suggestions for type mismatches', () => {
      const incompatibleParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'action-1.transactionId',
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, incompatibleParameterValues)

      expect(result.typeCompatibilityIssues[0].suggestion).toBeDefined()
      expect(result.typeCompatibilityIssues[0].autoFixAvailable).toBeDefined()
    })
  })

  describe('unresolved references detection', () => {
    it('should detect unresolved action references', () => {
      const invalidParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'nonexistent-action.amountOut', // Invalid action reference
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, invalidParameterValues)

      expect(result.unresolvedReferences.length).toBeGreaterThan(0)
      expect(result.unresolvedReferences[0]).toMatchObject({
        actionId: 'action-2',
        parameterName: 'amount',
        referencedAction: 'nonexistent-action',
        reason: 'Referenced action does not exist in workflow'
      })
    })

    it('should detect unresolved output references', () => {
      const invalidParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'action-1.nonexistentOutput', // Invalid output reference
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, invalidParameterValues)

      expect(result.unresolvedReferences.length).toBeGreaterThan(0)
      expect(result.unresolvedReferences[0]).toMatchObject({
        actionId: 'action-2',
        parameterName: 'amount',
        referencedOutput: 'nonexistentOutput',
        reason: 'Referenced output does not exist on the specified action'
      })
    })

    it('should provide helpful suggestions for unresolved references', () => {
      const invalidParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'action-1.wrongOutput',
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, invalidParameterValues)

      expect(result.unresolvedReferences[0].suggestions.length).toBeGreaterThan(0)
      expect(result.unresolvedReferences[0].suggestions[0]).toContain('Available outputs:')
    })
  })

  describe('orphaned actions detection', () => {
    it('should detect orphaned actions', () => {
      // Add an orphaned action
      const workflowWithOrphan = {
        ...mockWorkflow,
        actions: [
          ...mockWorkflow.actions,
          {
            id: 'orphaned-action',
            actionType: 'transfer-tokens',
            name: 'Orphaned Transfer',
            parameters: [],
            nextActions: [],
            position: { x: 500, y: 100 }
          }
        ]
      }

      const parameterValuesWithOrphan = {
        ...mockParameterValues,
        'orphaned-action': {
          recipient: '0x1234567890abcdef',
          amount: '50.0' // No dependency on other actions
        }
      }

      const result = analyzer.analyzeDataFlow(workflowWithOrphan, mockActionMetadata, parameterValuesWithOrphan)

      expect(result.orphanedActions).toContain('orphaned-action')
    })

    it('should not mark connected actions as orphaned', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result.orphanedActions).not.toContain('action-1')
      expect(result.orphanedActions).not.toContain('action-2')
    })
  })

  describe('connection strength calculation', () => {
    it('should calculate higher strength for compatible types', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      const connection = result.connections.find(c => 
        c.sourceActionId === 'action-1' && c.targetActionId === 'action-2'
      )

      expect(connection?.connectionStrength).toBeGreaterThan(0.5)
      expect(connection?.isTypeCompatible).toBe(true)
    })

    it('should calculate lower strength for incompatible types', () => {
      const incompatibleParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'action-1.transactionId', // String -> UFix64
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, incompatibleParameterValues)

      const connection = result.connections.find(c => 
        c.sourceActionId === 'action-1' && c.targetActionId === 'action-2'
      )

      expect(connection?.connectionStrength).toBeLessThan(0.9) // Lower than perfect compatibility
      expect(connection?.isTypeCompatible).toBe(false)
    })
  })

  describe('data flow graph generation', () => {
    it('should generate nodes for actions, parameters, and outputs', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      const actionNodes = result.dataFlowGraph.nodes.filter(n => n.type === 'action')
      const paramNodes = result.dataFlowGraph.nodes.filter(n => n.type === 'parameter')
      const outputNodes = result.dataFlowGraph.nodes.filter(n => n.type === 'output')

      expect(actionNodes.length).toBe(2)
      expect(paramNodes.length).toBeGreaterThan(0)
      expect(outputNodes.length).toBeGreaterThan(0)
    })

    it('should generate edges with proper styling based on compatibility', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      const dataFlowEdges = result.dataFlowGraph.edges.filter(e => e.type === 'data-flow')
      expect(dataFlowEdges.length).toBeGreaterThan(0)

      const edge = dataFlowEdges[0]
      expect(edge.style).toBeDefined()
      expect(edge.style?.color).toBeDefined()
      expect(edge.style?.width).toBeGreaterThan(0)
    })

    it('should identify action clusters', () => {
      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, mockParameterValues)

      expect(result.dataFlowGraph.clusters.length).toBeGreaterThan(0)
      expect(result.dataFlowGraph.clusters[0].actionIds).toContain('action-1')
      expect(result.dataFlowGraph.clusters[0].actionIds).toContain('action-2')
    })
  })

  describe('edge cases', () => {
    it('should handle empty workflow', () => {
      const emptyWorkflow: ParsedWorkflow = {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: '2024-01-01'
        }
      }

      const result = analyzer.analyzeDataFlow(emptyWorkflow, {}, {})

      expect(result.dependencies).toEqual({})
      expect(result.connections).toEqual([])
      expect(result.circularDependencies).toEqual([])
      expect(result.unresolvedReferences).toEqual([])
      expect(result.typeCompatibilityIssues).toEqual([])
      expect(result.orphanedActions).toEqual([])
      expect(result.executionOrder).toEqual([])
    })

    it('should handle workflow with no parameter dependencies', () => {
      const independentParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: '50.0', // No dependency
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, independentParameterValues)

      expect(result.connections).toEqual([])
      expect(result.dependencies['action-2'].dependsOn).toEqual([])
    })

    it('should handle invalid parameter reference formats', () => {
      const invalidParameterValues = {
        'action-1': {
          tokenIn: '0x1654653399040a61',
          tokenOut: '0x3c5959b568896393',
          amountIn: '100.0'
        },
        'action-2': {
          amount: 'invalid-reference', // Invalid format (no dot)
          validator: '0x8624b52f9ddcd04a'
        }
      }

      const result = analyzer.analyzeDataFlow(mockWorkflow, mockActionMetadata, invalidParameterValues)

      expect(result.connections).toEqual([])
      expect(result.dependencies['action-2'].dependsOn).toEqual([])
    })
  })
})