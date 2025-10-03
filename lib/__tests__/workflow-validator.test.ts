import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowValidator } from '../workflow-validator'
import { 
  ParsedWorkflow, 
  ParsedAction, 
  ActionMetadata, 
  ActionOutput,
  ValidationErrorType
} from '../types'

describe('WorkflowValidator', () => {
  let validator: WorkflowValidator
  let mockWorkflow: ParsedWorkflow
  let mockActionMetadata: Record<string, ActionMetadata>

  beforeEach(() => {
    validator = new WorkflowValidator()

    // Create mock action metadata
    mockActionMetadata = {
      'swap-tokens': {
        id: 'swap-tokens',
        name: 'Swap Tokens',
        description: 'Swap one token for another',
        category: 'DeFi',
        version: '1.0.0',
        inputs: [],
        outputs: [
          { name: 'swapResult', type: 'UFix64', description: 'Amount received' },
          { name: 'transactionId', type: 'String', description: 'Transaction ID' }
        ],
        parameters: [
          { name: 'fromToken', type: 'Address', value: '', required: true },
          { name: 'toToken', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'slippage', type: 'UFix64', value: '0.01', required: false }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: 'medium' as any,
        author: 'ActionLoom',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      },
      'transfer-tokens': {
        id: 'transfer-tokens',
        name: 'Transfer Tokens',
        description: 'Transfer tokens to another address',
        category: 'Transfer',
        version: '1.0.0',
        inputs: [],
        outputs: [
          { name: 'transferResult', type: 'Bool', description: 'Transfer success' },
          { name: 'transactionId', type: 'String', description: 'Transaction ID' }
        ],
        parameters: [
          { name: 'recipient', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'token', type: 'Address', value: '', required: false }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet', 'mainnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 500,
        securityLevel: 'low' as any,
        author: 'ActionLoom',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01'
      }
    }

    // Create mock workflow
    mockWorkflow = {
      actions: [
        {
          id: 'action1',
          actionType: 'swap-tokens',
          name: 'Swap FLOW to USDC',
          parameters: [],
          nextActions: ['action2'],
          position: { x: 0, y: 0 }
        },
        {
          id: 'action2',
          actionType: 'transfer-tokens',
          name: 'Transfer USDC',
          parameters: [],
          nextActions: [],
          position: { x: 100, y: 0 }
        }
      ],
      executionOrder: ['action1', 'action2'],
      rootActions: ['action1'],
      metadata: {
        totalActions: 2,
        totalConnections: 1,
        createdAt: '2024-01-01'
      }
    }
  })

  describe('validateWorkflow', () => {
    it('should validate a complete workflow successfully', () => {
      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0',
          slippage: '0.01'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: 'action1.swapResult',
          token: '0x3c5959b568896393'
        }
      }

      const result = validator.validateWorkflow(mockWorkflow, mockActionMetadata, parameterValues)

      expect(result.isValid).toBe(true)
      expect(result.globalErrors).toHaveLength(0)
      expect(Object.keys(result.actionResults)).toHaveLength(2)
    })

    it('should detect missing required parameters', () => {
      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          // Missing toToken and amount
        },
        action2: {
          recipient: '0x1654653399040a61'
          // Missing amount
        }
      }

      const result = validator.validateWorkflow(mockWorkflow, mockActionMetadata, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.actionResults.action1.missingParameters).toContain('toToken')
      expect(result.actionResults.action1.missingParameters).toContain('amount')
      expect(result.actionResults.action2.missingParameters).toContain('amount')
    })

    it('should detect invalid parameter types', () => {
      const parameterValues = {
        action1: {
          fromToken: 'invalid-address',
          toToken: '0x3c5959b568896393',
          amount: 'not-a-number'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: '10.0'
        }
      }

      const result = validator.validateWorkflow(mockWorkflow, mockActionMetadata, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.actionResults.action1.invalidParameters.fromToken).toBeDefined()
      expect(result.actionResults.action1.invalidParameters.amount).toBeDefined()
    })

    it('should handle missing action metadata', () => {
      const incompleteMetadata = {
        'swap-tokens': mockActionMetadata['swap-tokens']
        // Missing transfer-tokens metadata
      }

      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: '10.0'
        }
      }

      const result = validator.validateWorkflow(mockWorkflow, incompleteMetadata, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.globalErrors).toHaveLength(1)
      expect(result.globalErrors[0].message).toContain('Action metadata not found')
    })

    it('should validate empty workflow', () => {
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

      const result = validator.validateWorkflow(emptyWorkflow, mockActionMetadata, {})

      expect(result.isValid).toBe(false)
      expect(result.globalErrors).toHaveLength(1)
      expect(result.globalErrors[0].message).toContain('must contain at least one action')
    })
  })

  describe('analyzeDataFlow', () => {
    it('should detect circular dependencies', () => {
      const circularWorkflow: ParsedWorkflow = {
        actions: [
          {
            id: 'action1',
            actionType: 'swap-tokens',
            name: 'Action 1',
            parameters: [],
            nextActions: [],
            position: { x: 0, y: 0 }
          },
          {
            id: 'action2',
            actionType: 'transfer-tokens',
            name: 'Action 2',
            parameters: [],
            nextActions: [],
            position: { x: 100, y: 0 }
          },
          {
            id: 'action3',
            actionType: 'swap-tokens',
            name: 'Action 3',
            parameters: [],
            nextActions: [],
            position: { x: 200, y: 0 }
          }
        ],
        executionOrder: ['action1', 'action2', 'action3'],
        rootActions: ['action1'],
        metadata: {
          totalActions: 3,
          totalConnections: 3,
          createdAt: '2024-01-01'
        }
      }

      // Create parameter-based circular dependencies
      const parameterValues = {
        action1: { 
          fromToken: '0x1654653399040a61', 
          toToken: '0x3c5959b568896393', 
          amount: 'action3.swapResult' // Depends on action3
        },
        action2: { 
          recipient: '0x1654653399040a61', 
          amount: 'action1.swapResult' // Depends on action1
        },
        action3: { 
          fromToken: '0x1654653399040a61', 
          toToken: '0x3c5959b568896393', 
          amount: 'action2.transferResult' // Depends on action2, creating cycle
        }
      }

      const result = validator.analyzeDataFlow(circularWorkflow, mockActionMetadata, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.circularDependencies).toHaveLength(1)
      expect(result.circularDependencies[0].cycle).toContain('action1')
      expect(result.circularDependencies[0].cycle).toContain('action2')
      expect(result.circularDependencies[0].cycle).toContain('action3')
    })

    it('should detect unresolved parameter references', () => {
      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: 'nonexistent.output', // References non-existent action
          token: 'action1.invalidOutput' // References non-existent output
        }
      }

      const result = validator.analyzeDataFlow(mockWorkflow, mockActionMetadata, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.unresolvedReferences).toHaveLength(2)
      
      const unresolvedRefs = result.unresolvedReferences
      expect(unresolvedRefs.some(ref => ref.referencedAction === 'nonexistent')).toBe(true)
      expect(unresolvedRefs.some(ref => ref.referencedOutput === 'invalidOutput')).toBe(true)
    })

    it('should detect type compatibility issues', () => {
      // Create metadata with incompatible types
      const incompatibleMetadata = {
        ...mockActionMetadata,
        'transfer-tokens': {
          ...mockActionMetadata['transfer-tokens'],
          parameters: [
            { name: 'recipient', type: 'Address', value: '', required: true },
            { name: 'amount', type: 'Bool', value: '', required: true }, // Changed to Bool (incompatible with UFix64)
            { name: 'token', type: 'Address', value: '', required: false }
          ]
        }
      }

      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: 'action1.swapResult', // UFix64 -> Bool (incompatible)
          token: '0x3c5959b568896393'
        }
      }

      const result = validator.analyzeDataFlow(mockWorkflow, incompatibleMetadata, parameterValues)

      expect(result.typeCompatibilityIssues).toHaveLength(1)
      expect(result.typeCompatibilityIssues[0].canConvert).toBe(false)
      expect(result.typeCompatibilityIssues[0].sourceType).toBe('UFix64')
      expect(result.typeCompatibilityIssues[0].targetType).toBe('Bool')
    })

    it('should identify orphaned actions', () => {
      const workflowWithOrphans: ParsedWorkflow = {
        actions: [
          {
            id: 'action1',
            actionType: 'swap-tokens',
            name: 'Connected Action',
            parameters: [],
            nextActions: [],
            position: { x: 0, y: 0 }
          },
          {
            id: 'action2',
            actionType: 'transfer-tokens',
            name: 'Orphaned Action',
            parameters: [],
            nextActions: [],
            position: { x: 100, y: 0 }
          }
        ],
        executionOrder: ['action1'],
        rootActions: ['action1'],
        metadata: {
          totalActions: 2,
          totalConnections: 0,
          createdAt: '2024-01-01'
        }
      }

      const parameterValues = {
        action1: { fromToken: '0x1654653399040a61', toToken: '0x3c5959b568896393', amount: '10.0' },
        action2: { recipient: '0x1654653399040a61', amount: '10.0' }
      }

      const result = validator.analyzeDataFlow(workflowWithOrphans, mockActionMetadata, parameterValues)

      expect(result.orphanedActions).toContain('action2')
    })
  })

  describe('validateAction', () => {
    it('should validate a single action successfully', () => {
      const action: ParsedAction = {
        id: 'test-action',
        actionType: 'swap-tokens',
        name: 'Test Swap',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      }

      const parameterValues = {
        fromToken: '0x1654653399040a61',
        toToken: '0x3c5959b568896393',
        amount: '10.0',
        slippage: '0.01'
      }

      const context = {
        workflow: mockWorkflow,
        currentAction: action,
        availableOutputs: {}
      }

      const result = validator.validateAction(
        action,
        mockActionMetadata['swap-tokens'],
        parameterValues,
        context
      )

      expect(result.isValid).toBe(true)
      expect(result.missingParameters).toHaveLength(0)
      expect(Object.keys(result.invalidParameters)).toHaveLength(0)
    })

    it('should detect missing required parameters in single action', () => {
      const action: ParsedAction = {
        id: 'test-action',
        actionType: 'swap-tokens',
        name: 'Test Swap',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      }

      const parameterValues = {
        fromToken: '0x1654653399040a61'
        // Missing toToken and amount
      }

      const context = {
        workflow: mockWorkflow,
        currentAction: action,
        availableOutputs: {}
      }

      const result = validator.validateAction(
        action,
        mockActionMetadata['swap-tokens'],
        parameterValues,
        context
      )

      expect(result.isValid).toBe(false)
      expect(result.missingParameters).toContain('toToken')
      expect(result.missingParameters).toContain('amount')
    })
  })

  describe('workflow structure validation', () => {
    it('should detect duplicate action IDs', () => {
      const workflowWithDuplicates: ParsedWorkflow = {
        actions: [
          {
            id: 'duplicate-id',
            actionType: 'swap-tokens',
            name: 'Action 1',
            parameters: [],
            nextActions: [],
            position: { x: 0, y: 0 }
          },
          {
            id: 'duplicate-id', // Duplicate ID
            actionType: 'transfer-tokens',
            name: 'Action 2',
            parameters: [],
            nextActions: [],
            position: { x: 100, y: 0 }
          }
        ],
        executionOrder: ['duplicate-id'],
        rootActions: ['duplicate-id'],
        metadata: {
          totalActions: 2,
          totalConnections: 0,
          createdAt: '2024-01-01'
        }
      }

      const result = validator.validateWorkflow(workflowWithDuplicates, mockActionMetadata, {})

      expect(result.isValid).toBe(false)
      expect(result.globalErrors.some(error => error.message.includes('Duplicate action IDs'))).toBe(true)
    })

    it('should warn about execution order inconsistencies', () => {
      const workflowWithInconsistentOrder: ParsedWorkflow = {
        ...mockWorkflow,
        executionOrder: ['action1', 'nonexistent-action'] // Contains non-existent action
      }

      const parameterValues = {
        action1: { fromToken: '0x1654653399040a61', toToken: '0x3c5959b568896393', amount: '10.0' },
        action2: { recipient: '0x1654653399040a61', amount: '10.0' }
      }

      const result = validator.validateWorkflow(workflowWithInconsistentOrder, mockActionMetadata, parameterValues)

      expect(result.warnings.some(warning => warning.includes('missing from execution order'))).toBe(true)
      expect(result.warnings.some(warning => warning.includes('Unknown actions in execution order'))).toBe(true)
    })
  })

  describe('parameter reference handling', () => {
    it('should handle valid parameter references', () => {
      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: 'action1.swapResult', // Valid reference
          token: '0x3c5959b568896393'
        }
      }

      const result = validator.validateWorkflow(mockWorkflow, mockActionMetadata, parameterValues)

      expect(result.dataFlowResult.unresolvedReferences).toHaveLength(0)
    })

    it('should handle complex parameter reference formats', () => {
      const parameterValues = {
        action1: {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0'
        },
        action2: {
          recipient: '0x1654653399040a61',
          amount: 'action1.nested.output.value', // Complex reference (should be treated as single output name)
          token: '0x3c5959b568896393'
        }
      }

      // Add nested output to metadata for testing
      const extendedMetadata = {
        ...mockActionMetadata,
        'swap-tokens': {
          ...mockActionMetadata['swap-tokens'],
          outputs: [
            ...mockActionMetadata['swap-tokens'].outputs,
            { name: 'nested.output.value', type: 'UFix64', description: 'Nested output' }
          ]
        }
      }

      const result = validator.validateWorkflow(mockWorkflow, extendedMetadata, parameterValues)

      expect(result.dataFlowResult.unresolvedReferences).toHaveLength(0)
    })
  })
})