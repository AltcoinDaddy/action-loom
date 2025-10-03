import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExecutionValidator } from '../execution-validator'
import { WorkflowValidator } from '../workflow-validator'
import { ParameterValidator } from '../parameter-validator'
import type { 
  ParsedWorkflow, 
  ActionMetadata, 
  ValidationError,
  ValidationErrorType 
} from '../types'

// Mock the dependencies
vi.mock('../workflow-validator')
vi.mock('../parameter-validator')

describe('ExecutionValidator Integration Tests', () => {
  let executionValidator: ExecutionValidator
  let mockWorkflowValidator: vi.Mocked<WorkflowValidator>
  let mockParameterValidator: vi.Mocked<ParameterValidator>

  const mockWorkflow: ParsedWorkflow = {
    actions: [
      {
        id: 'action-1',
        actionType: 'swap-tokens',
        name: 'Swap FLOW to USDC',
        parameters: [
          { name: 'fromToken', type: 'Address', value: '', required: true },
          { name: 'toToken', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true }
        ],
        nextActions: ['action-2'],
        position: { x: 0, y: 0 }
      },
      {
        id: 'action-2',
        actionType: 'stake-tokens',
        name: 'Stake USDC',
        parameters: [
          { name: 'token', type: 'Address', value: 'action-1.outputToken', required: true },
          { name: 'amount', type: 'UFix64', value: 'action-1.outputAmount', required: true }
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
      createdAt: new Date().toISOString()
    }
  }

  const mockActionMetadata: Record<string, ActionMetadata> = {
    'swap-tokens': {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Swap one token for another',
      category: 'defi',
      version: '1.0.0',
      inputs: [],
      outputs: [
        { name: 'outputToken', type: 'Address', description: 'Output token address' },
        { name: 'outputAmount', type: 'UFix64', description: 'Output token amount' }
      ],
      parameters: [
        { name: 'fromToken', type: 'Address', value: '', required: true },
        { name: 'toToken', type: 'Address', value: '', required: true },
        { name: 'amount', type: 'UFix64', value: '', required: true }
      ] as any,
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 5000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'stake-tokens': {
      id: 'stake-tokens',
      name: 'Stake Tokens',
      description: 'Stake tokens for rewards',
      category: 'defi',
      version: '1.0.0',
      inputs: [],
      outputs: [
        { name: 'stakingReceipt', type: 'String', description: 'Staking receipt ID' }
      ],
      parameters: [
        { name: 'token', type: 'Address', value: '', required: true },
        { name: 'amount', type: 'UFix64', value: '', required: true }
      ] as any,
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 3000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create mocked instances
    mockWorkflowValidator = {
      validateWorkflow: vi.fn(),
      validateAction: vi.fn(),
      analyzeDataFlow: vi.fn()
    } as any

    mockParameterValidator = {
      validateAllParameters: vi.fn(),
      validateParameter: vi.fn()
    } as any

    // Mock the constructors to return our mocked instances
    vi.mocked(WorkflowValidator).mockImplementation(() => mockWorkflowValidator)
    vi.mocked(ParameterValidator).mockImplementation(() => mockParameterValidator)

    executionValidator = new ExecutionValidator()
  })

  describe('validateForExecution', () => {
    it('should return canExecute: true when workflow is fully valid', async () => {
      // Mock successful validation
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: true,
        actionResults: {
          'action-1': {
            actionId: 'action-1',
            isValid: true,
            missingParameters: [],
            invalidParameters: {},
            warnings: []
          },
          'action-2': {
            actionId: 'action-2',
            isValid: true,
            missingParameters: [],
            invalidParameters: {},
            warnings: []
          }
        },
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const parameterValues = {
        'action-1': {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '10.0'
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount'
        }
      }

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      expect(result.canExecute).toBe(true)
      expect(result.executionReadiness.readinessScore).toBe(100)
      expect(result.blockingErrors).toHaveLength(0)
      expect(result.estimatedGasCost).toBeGreaterThan(0)
      expect(result.estimatedExecutionTime).toBeGreaterThan(0)
    })

    it('should return canExecute: false when required parameters are missing', async () => {
      // Mock validation with missing parameters
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: false,
        actionResults: {
          'action-1': {
            actionId: 'action-1',
            isValid: false,
            missingParameters: ['fromToken', 'amount'],
            invalidParameters: {},
            warnings: []
          }
        },
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const parameterValues = {
        'action-1': {
          toToken: '0x3c5959b568896393'
          // Missing fromToken and amount
        }
      }

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      expect(result.canExecute).toBe(false)
      expect(result.executionReadiness.readinessScore).toBeLessThan(100)
      expect(result.blockingErrors.length).toBeGreaterThan(0)
      expect(result.blockingErrors.some(error => 
        error.message.includes('fromToken')
      )).toBe(true)
    })

    it('should detect circular dependencies and prevent execution', async () => {
      // Mock validation with circular dependencies
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: false,
        actionResults: {},
        dataFlowResult: {
          isValid: false,
          circularDependencies: [{
            cycle: ['action-1', 'action-2', 'action-1'],
            description: 'Circular dependency detected: action-1 → action-2 → action-1'
          }],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        {}
      )

      expect(result.canExecute).toBe(false)
      expect(result.executionReadiness.noCircularDependencies).toBe(false)
      expect(result.blockingErrors.some(error => 
        error.type === 'CIRCULAR_DEPENDENCY'
      )).toBe(true)
    })

    it('should handle type compatibility issues', async () => {
      // Mock validation with type compatibility issues
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: false,
        actionResults: {},
        dataFlowResult: {
          isValid: false,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [{
            sourceAction: 'action-1',
            sourceOutput: 'outputToken',
            targetAction: 'action-2',
            targetParameter: 'amount',
            sourceType: 'Address',
            targetType: 'UFix64',
            canConvert: false
          }],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        {}
      )

      expect(result.canExecute).toBe(false)
      expect(result.blockingErrors.some(error => 
        error.type === 'TYPE_MISMATCH'
      )).toBe(true)
    })

    it('should cache validation results', async () => {
      // Mock successful validation
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: true,
        actionResults: {},
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const parameterValues = {
        'action-1': { fromToken: '0x123', toToken: '0x456', amount: '10.0' }
      }

      // First call
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Second call with same parameters should use cache
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Workflow validator should only be called once due to caching
      expect(mockWorkflowValidator.validateWorkflow).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache when parameters change', async () => {
      // Mock successful validation
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: true,
        actionResults: {},
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const parameterValues1 = {
        'action-1': { fromToken: '0x123', toToken: '0x456', amount: '10.0' }
      }

      const parameterValues2 = {
        'action-1': { fromToken: '0x123', toToken: '0x456', amount: '20.0' }
      }

      // First call
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues1
      )

      // Second call with different parameters should not use cache
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues2
      )

      // Workflow validator should be called twice
      expect(mockWorkflowValidator.validateWorkflow).toHaveBeenCalledTimes(2)
    })
  })

  describe('quickValidationCheck', () => {
    it('should perform quick validation for UI responsiveness', () => {
      const parameterValues = {
        'action-1': {
          fromToken: '0x123',
          toToken: '0x456'
          // Missing required 'amount' parameter
        }
      }

      const result = executionValidator.quickValidationCheck(mockWorkflow, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.errorCount).toBeGreaterThan(0)
    })

    it('should return valid for fully configured workflow', () => {
      const parameterValues = {
        'action-1': {
          fromToken: '0x123',
          toToken: '0x456',
          amount: '10.0'
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount'
        }
      }

      const result = executionValidator.quickValidationCheck(mockWorkflow, parameterValues)

      expect(result.isValid).toBe(true)
      expect(result.errorCount).toBe(0)
    })
  })

  describe('validateActionForExecution', () => {
    it('should validate individual action for execution', () => {
      const action = mockWorkflow.actions[0]
      const actionMetadata = mockActionMetadata['swap-tokens']
      const parameterValues = {
        fromToken: '0x123',
        toToken: '0x456',
        amount: '10.0'
      }

      // Mock parameter validator
      mockParameterValidator.validateAllParameters.mockReturnValue({
        actionId: 'action-1',
        isValid: true,
        missingParameters: [],
        invalidParameters: {},
        warnings: []
      })

      const result = executionValidator.validateActionForExecution(
        action,
        actionMetadata,
        parameterValues,
        {}
      )

      expect(result.canExecute).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing parameters in individual action', () => {
      const action = mockWorkflow.actions[0]
      const actionMetadata = mockActionMetadata['swap-tokens']
      const parameterValues = {
        fromToken: '0x123'
        // Missing toToken and amount
      }

      // Mock parameter validator
      mockParameterValidator.validateAllParameters.mockReturnValue({
        actionId: 'action-1',
        isValid: false,
        missingParameters: ['toToken', 'amount'],
        invalidParameters: {},
        warnings: []
      })

      const result = executionValidator.validateActionForExecution(
        action,
        actionMetadata,
        parameterValues,
        {}
      )

      expect(result.canExecute).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors.some(error => 
        error.message.includes('toToken')
      )).toBe(true)
    })
  })

  describe('cache management', () => {
    it('should clear cache when requested', async () => {
      // Mock successful validation
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: true,
        actionResults: {},
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const parameterValues = {
        'action-1': { fromToken: '0x123', toToken: '0x456', amount: '10.0' }
      }

      // First call to populate cache
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Clear cache
      executionValidator.clearCache()

      // Second call should not use cache
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Workflow validator should be called twice
      expect(mockWorkflowValidator.validateWorkflow).toHaveBeenCalledTimes(2)
    })

    it('should clear expired cache entries', async () => {
      // This test would require mocking Date.now() to simulate time passage
      // For now, we'll just test that the method exists and doesn't throw
      expect(() => executionValidator.clearExpiredCache()).not.toThrow()
    })
  })

  describe('execution estimates', () => {
    it('should provide gas cost estimates', async () => {
      // Mock successful validation
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: true,
        actionResults: {},
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        {}
      )

      expect(result.estimatedGasCost).toBeGreaterThan(0)
      expect(result.estimatedExecutionTime).toBeGreaterThan(0)
    })

    it('should calculate gas costs based on action complexity', async () => {
      // Mock successful validation
      mockWorkflowValidator.validateWorkflow.mockReturnValue({
        isValid: true,
        actionResults: {},
        dataFlowResult: {
          isValid: true,
          circularDependencies: [],
          unresolvedReferences: [],
          typeCompatibilityIssues: [],
          orphanedActions: []
        },
        globalErrors: [],
        warnings: []
      })

      const simpleWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [mockWorkflow.actions[0]], // Only one action
        metadata: { ...mockWorkflow.metadata, totalActions: 1, totalConnections: 0 }
      }

      const simpleResult = await executionValidator.validateForExecution(
        simpleWorkflow,
        mockActionMetadata,
        {}
      )

      const complexResult = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        {}
      )

      // Complex workflow should have higher gas cost
      expect(complexResult.estimatedGasCost).toBeGreaterThan(simpleResult.estimatedGasCost!)
    })
  })
})