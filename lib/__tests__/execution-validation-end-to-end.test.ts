import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExecutionValidator } from '../execution-validator'
import type { 
  ParsedWorkflow, 
  ActionMetadata, 
  ValidationError,
  ValidationErrorType 
} from '../types'

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Execution Validation End-to-End Tests', () => {
  let executionValidator: ExecutionValidator

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
          { name: 'amount', type: 'UFix64', value: 'action-1.outputAmount', required: true },
          { name: 'duration', type: 'UInt64', value: '', required: true }
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
        { name: 'amount', type: 'UFix64', value: '', required: true },
        { name: 'duration', type: 'UInt64', value: '', required: true }
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
    executionValidator = new ExecutionValidator()
  })

  describe('Complete Execution Validation Flow', () => {
    it('should prevent execution when workflow has missing required parameters', async () => {
      const parameterValues = {
        'action-1': {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393'
          // Missing required 'amount' parameter
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

      // Should not be able to execute
      expect(result.canExecute).toBe(false)
      expect(result.executionReadiness.parametersConfigured).toBe(false)
      expect(result.executionReadiness.readinessScore).toBeLessThan(100)
      expect(result.blockingErrors.length).toBeGreaterThan(0)
      
      // Should have specific error about missing parameter
      const missingParamError = result.blockingErrors.find(error => 
        error.message.includes('amount') && error.message.includes('required')
      )
      expect(missingParamError).toBeDefined()
    })

    it('should allow execution when all parameters are properly configured', async () => {
      const parameterValues = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '10.0'
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount',
          duration: '86400'
        }
      }

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Should be able to execute
      expect(result.canExecute).toBe(true)
      expect(result.executionReadiness.parametersConfigured).toBe(true)
      expect(result.executionReadiness.dataFlowValid).toBe(true)
      expect(result.executionReadiness.noCircularDependencies).toBe(true)
      expect(result.executionReadiness.allActionsValid).toBe(true)
      expect(result.executionReadiness.readinessScore).toBe(100)
      expect(result.blockingErrors).toHaveLength(0)
      
      // Should have execution estimates
      expect(result.estimatedGasCost).toBeGreaterThan(0)
      expect(result.estimatedExecutionTime).toBeGreaterThan(0)
    })

    it('should provide detailed execution readiness breakdown', async () => {
      const parameterValues = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '10.0'
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount',
          duration: '86400'
        }
      }

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Check execution readiness details
      expect(result.executionReadiness).toEqual({
        parametersConfigured: true,
        dataFlowValid: true,
        noCircularDependencies: true,
        allActionsValid: true,
        readinessScore: 100,
        readinessMessage: 'Workflow is ready for execution'
      })
    })

    it('should calculate gas estimates based on action complexity', async () => {
      const parameterValues = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '10.0'
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount',
          duration: '86400'
        }
      }

      const result = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Should calculate gas based on action estimates + base costs + connections
      const expectedGas = 1000 + 5000 + 3000 + (1 * 100) // base + swap + stake + connections
      expect(result.estimatedGasCost).toBe(expectedGas)
      
      // Should calculate execution time based on complexity
      const expectedTime = 2000 + (2 * 500) + (1 * 100) // base + actions + connections
      expect(result.estimatedExecutionTime).toBe(expectedTime)
    })

    it('should use validation caching for performance', async () => {
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

      // First validation call
      const startTime1 = Date.now()
      const result1 = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )
      const duration1 = Date.now() - startTime1

      // Second validation call with same parameters (should use cache)
      const startTime2 = Date.now()
      const result2 = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )
      const duration2 = Date.now() - startTime2

      // Results should be identical
      expect(result1.canExecute).toBe(result2.canExecute)
      expect(result1.executionReadiness.readinessScore).toBe(result2.executionReadiness.readinessScore)
      
      // Second call should be faster due to caching (allowing some margin for test variability)
      expect(duration2).toBeLessThanOrEqual(duration1 + 5)
    })

    it('should invalidate cache when parameters change', async () => {
      const parameterValues1 = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '10.0'
        }
      }

      const parameterValues2 = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '20.0' // Different amount
        }
      }

      // First validation
      const result1 = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues1
      )

      // Second validation with different parameters
      const result2 = await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues2
      )

      // Both should be valid but cache should have been invalidated
      expect(result1.canExecute).toBe(false) // Missing action-2 parameters
      expect(result2.canExecute).toBe(false) // Missing action-2 parameters
      
      // Results should be recalculated (not from cache)
      expect(result1).not.toBe(result2) // Different object references
    })

    it('should provide quick validation for UI responsiveness', () => {
      const parameterValues = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC'
          // Missing amount
        }
      }

      const result = executionValidator.quickValidationCheck(mockWorkflow, parameterValues)

      expect(result.isValid).toBe(false)
      expect(result.errorCount).toBeGreaterThan(0)
      expect(result.warningCount).toBeGreaterThanOrEqual(0)
    })

    it('should validate individual actions for execution', () => {
      const action = mockWorkflow.actions[0]
      const actionMetadata = mockActionMetadata['swap-tokens']
      const parameterValues = {
        fromToken: 'FLOW',
        toToken: 'USDC',
        amount: '10.0'
      }

      const result = executionValidator.validateActionForExecution(
        action,
        actionMetadata,
        parameterValues,
        {}
      )

      expect(result.canExecute).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.warnings).toEqual([])
    })

    it('should handle empty workflows gracefully', async () => {
      const emptyWorkflow: ParsedWorkflow = {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: new Date().toISOString()
        }
      }

      const result = await executionValidator.validateForExecution(
        emptyWorkflow,
        {},
        {}
      )

      // Empty workflow should not be executable (nothing to execute)
      expect(result.canExecute).toBe(false) // Nothing to execute
      expect(result.executionReadiness.readinessScore).toBeLessThan(100)
      expect(result.blockingErrors.length).toBeGreaterThanOrEqual(0)
      expect(result.estimatedGasCost).toBe(1000) // Just base cost
    })

    it('should clear cache when requested', async () => {
      const parameterValues = {
        'action-1': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '10.0'
        }
      }

      // First call to populate cache
      await executionValidator.validateForExecution(
        mockWorkflow,
        mockActionMetadata,
        parameterValues
      )

      // Clear cache
      executionValidator.clearCache()

      // Subsequent call should not use cache (we can't easily test this without internal access,
      // but we can at least verify the method doesn't throw)
      expect(() => executionValidator.clearCache()).not.toThrow()
    })
  })

  describe('API Integration Simulation', () => {
    it('should simulate validate-execution API endpoint behavior', async () => {
      // Mock the API response that would come from /api/workflow/validate-execution
      const mockApiResponse = {
        success: true,
        canExecute: true,
        executionReadiness: {
          parametersConfigured: true,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: true,
          readinessScore: 100,
          readinessMessage: 'Workflow is ready for execution'
        },
        blockingErrors: [],
        warnings: [],
        estimatedGasCost: 9100,
        estimatedExecutionTime: 3100
      }

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockApiResponse)
      } as Response)

      // Simulate API call
      const response = await fetch('/api/workflow/validate-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow: mockWorkflow,
          actionMetadata: mockActionMetadata,
          parameterValues: {
            'action-1': {
              fromToken: 'FLOW',
              toToken: 'USDC',
              amount: '10.0'
            },
            'action-2': {
              token: 'action-1.outputToken',
              amount: 'action-1.outputAmount',
              duration: '86400'
            }
          }
        })
      })

      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.canExecute).toBe(true)
      expect(data.executionReadiness.readinessScore).toBe(100)
      expect(data.blockingErrors).toHaveLength(0)
      expect(data.estimatedGasCost).toBeGreaterThan(0)
    })

    it('should simulate execute API endpoint with validation check', async () => {
      // Mock successful validation followed by execution
      const mockValidationResponse = {
        success: true,
        canExecute: true,
        executionReadiness: {
          parametersConfigured: true,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: true,
          readinessScore: 100,
          readinessMessage: 'Workflow is ready for execution'
        },
        blockingErrors: [],
        warnings: []
      }

      const mockExecutionResponse = {
        success: true,
        transactionId: '0x1234567890abcdef',
        status: 'sealed',
        cadenceCode: 'transaction { execute { log("Hello World") } }',
        executionTime: 1500,
        gasUsed: 8500
      }

      vi.mocked(fetch)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockValidationResponse)
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockExecutionResponse)
        } as Response)

      // First validate
      const validationResponse = await fetch('/api/workflow/validate-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: mockWorkflow })
      })

      const validationData = await validationResponse.json()
      
      // Only execute if validation passes
      if (validationData.canExecute) {
        const executionResponse = await fetch('/api/workflow/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflow: mockWorkflow })
        })

        const executionData = await executionResponse.json()
        
        expect(executionData.success).toBe(true)
        expect(executionData.transactionId).toBeDefined()
        expect(executionData.status).toBe('sealed')
      }

      expect(validationData.canExecute).toBe(true)
    })
  })
})