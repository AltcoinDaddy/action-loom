import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ParameterValidator } from '../parameter-validator'
import { EnhancedWorkflowValidator } from '../enhanced-workflow-validator'
import { DataFlowAnalyzer } from '../data-flow-analyzer'
import { ParameterSuggestionEngine } from '../parameter-suggestion-engine'
import type {
  ParsedWorkflow,
  ActionMetadata,
  EnhancedActionParameter,
  ValidationContext,
  ParameterType,
  ActionValidationResult,
  WorkflowValidationResult
} from '../types'

describe('Comprehensive Parameter Validation Test Suite', () => {
  let parameterValidator: ParameterValidator
  let workflowValidator: EnhancedWorkflowValidator
  let dataFlowAnalyzer: DataFlowAnalyzer
  let suggestionEngine: ParameterSuggestionEngine

  // Mock complex workflow with multiple connected actions
  const createComplexWorkflow = (): ParsedWorkflow => ({
    actions: [
      {
        id: 'action-1',
        actionType: 'swap-tokens',
        name: 'Swap FLOW to USDC',
        parameters: [
          { name: 'fromToken', type: 'Address', value: '', required: true },
          { name: 'toToken', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'slippage', type: 'UFix64', value: '', required: false }
        ],
        nextActions: ['action-2', 'action-3'],
        position: { x: 0, y: 0 }
      },
      {
        id: 'action-2',
        actionType: 'stake-tokens',
        name: 'Stake USDC',
        parameters: [
          { name: 'token', type: 'Address', value: 'action-1.outputToken', required: true },
          { name: 'amount', type: 'UFix64', value: 'action-1.outputAmount', required: true },
          { name: 'duration', type: 'UInt64', value: '', required: true },
          { name: 'autoRenew', type: 'Bool', value: '', required: false }
        ],
        nextActions: ['action-4'],
        position: { x: 200, y: 0 }
      },
      {
        id: 'action-3',
        actionType: 'mint-nft',
        name: 'Mint NFT with USDC',
        parameters: [
          { name: 'paymentToken', type: 'Address', value: 'action-1.outputToken', required: true },
          { name: 'price', type: 'UFix64', value: '', required: true },
          { name: 'metadata', type: 'String', value: '', required: true },
          { name: 'recipient', type: 'Address', value: '', required: false }
        ],
        nextActions: ['action-4'],
        position: { x: 200, y: 100 }
      },
      {
        id: 'action-4',
        actionType: 'transfer-tokens',
        name: 'Transfer Remaining USDC',
        parameters: [
          { name: 'token', type: 'Address', value: 'action-1.outputToken', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'recipient', type: 'Address', value: '', required: true }
        ],
        nextActions: [],
        position: { x: 400, y: 50 }
      }
    ],
    executionOrder: ['action-1', 'action-2', 'action-3', 'action-4'],
    rootActions: ['action-1'],
    metadata: {
      totalActions: 4,
      totalConnections: 4,
      createdAt: new Date().toISOString()
    }
  })

  const createActionMetadata = (): Record<string, ActionMetadata> => ({
    'swap-tokens': {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Swap one token for another on DEX',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [
        {
          name: 'fromToken',
          type: 'Address',
          required: true,
          value: '',
          description: 'Source token address',
          validation: {
            required: true,
            type: ParameterType.ADDRESS,
            constraints: {
              pattern: /^0x[a-fA-F0-9]{16}$/
            }
          }
        },
        {
          name: 'toToken',
          type: 'Address',
          required: true,
          value: '',
          description: 'Destination token address',
          validation: {
            required: true,
            type: ParameterType.ADDRESS,
            constraints: {
              pattern: /^0x[a-fA-F0-9]{16}$/
            }
          }
        },
        {
          name: 'amount',
          type: 'UFix64',
          required: true,
          value: '',
          description: 'Amount to swap',
          validation: {
            required: true,
            type: ParameterType.UFIX64,
            constraints: {
              min: 0.000001,
              decimals: 8
            }
          }
        },
        {
          name: 'slippage',
          type: 'UFix64',
          required: false,
          value: '',
          description: 'Maximum slippage tolerance',
          validation: {
            required: false,
            type: ParameterType.UFIX64,
            constraints: {
              min: 0.001,
              max: 0.5,
              decimals: 3
            }
          },
          defaultValue: '0.01'
        }
      ] as EnhancedActionParameter[],
      inputs: [],
      outputs: [
        { name: 'outputToken', type: 'Address', description: 'Output token address' },
        { name: 'outputAmount', type: 'UFix64', description: 'Output token amount' }
      ],
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
      category: 'DeFi',
      version: '1.0.0',
      parameters: [
        {
          name: 'token',
          type: 'Address',
          required: true,
          value: '',
          description: 'Token to stake',
          validation: {
            required: true,
            type: ParameterType.ADDRESS
          }
        },
        {
          name: 'amount',
          type: 'UFix64',
          required: true,
          value: '',
          description: 'Amount to stake',
          validation: {
            required: true,
            type: ParameterType.UFIX64,
            constraints: {
              min: 1.0
            }
          }
        },
        {
          name: 'duration',
          type: 'UInt64',
          required: true,
          value: '',
          description: 'Staking duration in seconds',
          validation: {
            required: true,
            type: ParameterType.UINT64,
            constraints: {
              min: 86400, // 1 day minimum
              max: 31536000 // 1 year maximum
            }
          }
        },
        {
          name: 'autoRenew',
          type: 'Bool',
          required: false,
          value: '',
          description: 'Auto-renew staking period',
          validation: {
            required: false,
            type: ParameterType.BOOL
          },
          defaultValue: false
        }
      ] as EnhancedActionParameter[],
      inputs: [],
      outputs: [
        { name: 'stakingReceipt', type: 'String', description: 'Staking receipt ID' }
      ],
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
    },
    'mint-nft': {
      id: 'mint-nft',
      name: 'Mint NFT',
      description: 'Mint a new NFT',
      category: 'NFT',
      version: '1.0.0',
      parameters: [
        {
          name: 'paymentToken',
          type: 'Address',
          required: true,
          value: '',
          description: 'Payment token address',
          validation: {
            required: true,
            type: ParameterType.ADDRESS
          }
        },
        {
          name: 'price',
          type: 'UFix64',
          required: true,
          value: '',
          description: 'NFT price',
          validation: {
            required: true,
            type: ParameterType.UFIX64,
            constraints: {
              min: 0.1
            }
          }
        },
        {
          name: 'metadata',
          type: 'String',
          required: true,
          value: '',
          description: 'NFT metadata JSON',
          validation: {
            required: true,
            type: ParameterType.STRING,
            constraints: {
              minLength: 10,
              maxLength: 1000
            }
          }
        },
        {
          name: 'recipient',
          type: 'Address',
          required: false,
          value: '',
          description: 'NFT recipient (defaults to minter)',
          validation: {
            required: false,
            type: ParameterType.ADDRESS
          }
        }
      ] as EnhancedActionParameter[],
      inputs: [],
      outputs: [
        { name: 'nftId', type: 'UInt64', description: 'Minted NFT ID' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 4000,
      securityLevel: 'low' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'transfer-tokens': {
      id: 'transfer-tokens',
      name: 'Transfer Tokens',
      description: 'Transfer tokens to another address',
      category: 'Token',
      version: '1.0.0',
      parameters: [
        {
          name: 'token',
          type: 'Address',
          required: true,
          value: '',
          description: 'Token to transfer',
          validation: {
            required: true,
            type: ParameterType.ADDRESS
          }
        },
        {
          name: 'amount',
          type: 'UFix64',
          required: true,
          value: '',
          description: 'Amount to transfer',
          validation: {
            required: true,
            type: ParameterType.UFIX64,
            constraints: {
              min: 0.000001
            }
          }
        },
        {
          name: 'recipient',
          type: 'Address',
          required: true,
          value: '',
          description: 'Recipient address',
          validation: {
            required: true,
            type: ParameterType.ADDRESS,
            constraints: {
              pattern: /^0x[a-fA-F0-9]{16}$/
            }
          }
        }
      ] as EnhancedActionParameter[],
      inputs: [],
      outputs: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 2000,
      securityLevel: 'low' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    parameterValidator = new ParameterValidator()
    workflowValidator = new EnhancedWorkflowValidator()
    dataFlowAnalyzer = new DataFlowAnalyzer()
    suggestionEngine = new ParameterSuggestionEngine()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('End-to-End Parameter Validation Workflow', () => {
    it('should validate complete workflow with all parameter types', async () => {
      const workflow = createComplexWorkflow()
      const actionMetadata = createActionMetadata()
      
      const parameterValues = {
        'action-1': {
          fromToken: '0x1654653399040a61', // FLOW
          toToken: '0x3c5959b568896393',   // USDC
          amount: '100.0',
          slippage: '0.01'
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount',
          duration: '604800', // 1 week
          autoRenew: true
        },
        'action-3': {
          paymentToken: 'action-1.outputToken',
          price: '50.0',
          metadata: '{"name": "Test NFT", "description": "A test NFT"}',
          recipient: '0xf8d6e0586b0a20c7'
        },
        'action-4': {
          token: 'action-1.outputToken',
          amount: '25.0',
          recipient: '0xf8d6e0586b0a20c7'
        }
      }

      // Validate each action individually
      const actionResults: Record<string, ActionValidationResult> = {}
      
      for (const action of workflow.actions) {
        const metadata = actionMetadata[action.actionType]
        const values = parameterValues[action.id]
        
        const context: ValidationContext = {
          workflow,
          currentAction: action,
          availableOutputs: {
            'action-1.outputToken': { name: 'outputToken', type: 'Address', description: 'Output token' },
            'action-1.outputAmount': { name: 'outputAmount', type: 'UFix64', description: 'Output amount' }
          }
        }
        
        actionResults[action.id] = parameterValidator.validateAllParameters(
          metadata,
          values,
          context
        )
      }

      // All actions should be valid
      Object.values(actionResults).forEach(result => {
        expect(result.isValid).toBe(true)
        expect(result.missingParameters).toHaveLength(0)
        expect(Object.keys(result.invalidParameters)).toHaveLength(0)
      })

      // Validate data flow
      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(workflow)
      expect(dataFlowResult.isValid).toBe(true)
      expect(dataFlowResult.circularDependencies).toHaveLength(0)
      expect(dataFlowResult.unresolvedReferences).toHaveLength(0)
    })

    it('should detect and report complex validation errors', async () => {
      const workflow = createComplexWorkflow()
      const actionMetadata = createActionMetadata()
      
      const parameterValues = {
        'action-1': {
          fromToken: 'invalid-address',     // Invalid format
          toToken: '0x3c5959b568896393',
          amount: '-10.0',                  // Negative amount
          slippage: '0.6'                   // Exceeds maximum
        },
        'action-2': {
          token: 'action-1.outputToken',
          amount: 'action-1.outputAmount',
          duration: '3600',                 // Below minimum (1 day)
          autoRenew: 'maybe'                // Invalid boolean
        },
        'action-3': {
          paymentToken: 'action-1.outputToken',
          price: '0.05',                    // Below minimum
          metadata: 'short'                 // Too short
          // Missing recipient (optional, should be OK)
        },
        'action-4': {
          // Missing all required parameters
        }
      }

      const actionResults: Record<string, ActionValidationResult> = {}
      
      for (const action of workflow.actions) {
        const metadata = actionMetadata[action.actionType]
        const values = parameterValues[action.id] || {}
        
        const context: ValidationContext = {
          workflow,
          currentAction: action,
          availableOutputs: {
            'action-1.outputToken': { name: 'outputToken', type: 'Address', description: 'Output token' },
            'action-1.outputAmount': { name: 'outputAmount', type: 'UFix64', description: 'Output amount' }
          }
        }
        
        actionResults[action.id] = parameterValidator.validateAllParameters(
          metadata,
          values,
          context
        )
      }

      // Action 1 should have multiple validation errors
      expect(actionResults['action-1'].isValid).toBe(false)
      expect(Object.keys(actionResults['action-1'].invalidParameters)).toContain('fromToken')
      expect(Object.keys(actionResults['action-1'].invalidParameters)).toContain('amount')
      expect(Object.keys(actionResults['action-1'].invalidParameters)).toContain('slippage')

      // Action 2 should have validation errors
      expect(actionResults['action-2'].isValid).toBe(false)
      expect(Object.keys(actionResults['action-2'].invalidParameters)).toContain('duration')
      expect(Object.keys(actionResults['action-2'].invalidParameters)).toContain('autoRenew')

      // Action 3 should have validation errors
      expect(actionResults['action-3'].isValid).toBe(false)
      expect(Object.keys(actionResults['action-3'].invalidParameters)).toContain('price')
      expect(Object.keys(actionResults['action-3'].invalidParameters)).toContain('metadata')

      // Action 4 should have missing parameters
      expect(actionResults['action-4'].isValid).toBe(false)
      expect(actionResults['action-4'].missingParameters).toContain('token')
      expect(actionResults['action-4'].missingParameters).toContain('amount')
      expect(actionResults['action-4'].missingParameters).toContain('recipient')
    })

    it('should handle circular dependency detection', () => {
      const circularWorkflow: ParsedWorkflow = {
        actions: [
          {
            id: 'action-1',
            actionType: 'swap-tokens',
            name: 'Swap A',
            parameters: [
              { name: 'amount', type: 'UFix64', value: 'action-3.outputAmount', required: true }
            ],
            nextActions: ['action-2'],
            position: { x: 0, y: 0 }
          },
          {
            id: 'action-2',
            actionType: 'stake-tokens',
            name: 'Stake B',
            parameters: [
              { name: 'amount', type: 'UFix64', value: 'action-1.outputAmount', required: true }
            ],
            nextActions: ['action-3'],
            position: { x: 100, y: 0 }
          },
          {
            id: 'action-3',
            actionType: 'transfer-tokens',
            name: 'Transfer C',
            parameters: [
              { name: 'amount', type: 'UFix64', value: 'action-2.outputAmount', required: true }
            ],
            nextActions: ['action-1'], // Creates circular dependency
            position: { x: 200, y: 0 }
          }
        ],
        executionOrder: ['action-1', 'action-2', 'action-3'],
        rootActions: ['action-1'],
        metadata: {
          totalActions: 3,
          totalConnections: 3,
          createdAt: new Date().toISOString()
        }
      }

      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(circularWorkflow)
      
      expect(dataFlowResult.isValid).toBe(false)
      expect(dataFlowResult.circularDependencies.length).toBeGreaterThan(0)
      expect(dataFlowResult.circularDependencies[0]).toContain('action-1')
      expect(dataFlowResult.circularDependencies[0]).toContain('action-2')
      expect(dataFlowResult.circularDependencies[0]).toContain('action-3')
    })
  })

  describe('Performance Tests for Large Workflows', () => {
    it('should validate large workflow efficiently', async () => {
      // Create a large workflow with 100 actions
      const largeWorkflow = createLargeWorkflow(100)
      const actionMetadata = createActionMetadata()
      
      const startTime = performance.now()
      
      // Validate all actions
      const results = await Promise.all(
        largeWorkflow.actions.map(action => {
          const metadata = actionMetadata[action.actionType] || actionMetadata['transfer-tokens']
          const context: ValidationContext = {
            workflow: largeWorkflow,
            currentAction: action,
            availableOutputs: {}
          }
          
          return parameterValidator.validateAllParameters(
            metadata,
            { amount: '10.0', token: '0x1654653399040a61', recipient: '0x3c5959b568896393' },
            context
          )
        })
      )
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within 2 seconds
      expect(duration).toBeLessThan(2000)
      
      // All validations should succeed
      results.forEach(result => {
        expect(result.isValid).toBe(true)
      })
      
      console.log(`Large workflow validation (100 actions) completed in ${duration.toFixed(2)}ms`)
    })

    it('should handle concurrent validation requests efficiently', async () => {
      const workflow = createComplexWorkflow()
      const actionMetadata = createActionMetadata()
      
      const parameterValues = {
        'action-1': {
          fromToken: '0x1654653399040a61',
          toToken: '0x3c5959b568896393',
          amount: '100.0'
        }
      }
      
      const startTime = performance.now()
      
      // Run 1000 concurrent validations
      const promises = Array.from({ length: 1000 }, () => {
        const action = workflow.actions[0]
        const metadata = actionMetadata[action.actionType]
        const context: ValidationContext = {
          workflow,
          currentAction: action,
          availableOutputs: {}
        }
        
        return parameterValidator.validateAllParameters(
          metadata,
          parameterValues['action-1'],
          context
        )
      })
      
      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within 1 second
      expect(duration).toBeLessThan(1000)
      
      // All validations should succeed
      results.forEach(result => {
        expect(result.isValid).toBe(true)
      })
      
      console.log(`1000 concurrent validations completed in ${duration.toFixed(2)}ms`)
    })

    it('should maintain performance with complex data flow analysis', () => {
      const complexWorkflow = createComplexDataFlowWorkflow(50)
      
      const startTime = performance.now()
      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(complexWorkflow)
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete within 500ms
      expect(duration).toBeLessThan(500)
      expect(dataFlowResult.isValid).toBe(true)
      
      console.log(`Complex data flow analysis (50 actions) completed in ${duration.toFixed(2)}ms`)
    })
  })

  describe('All Parameter Types and Constraints', () => {
    const testAllParameterTypes = () => {
      const parameterTypes = [
        {
          type: 'Address' as const,
          validValues: ['0x1654653399040a61', '0x3c5959b568896393'],
          invalidValues: ['invalid', '0x123', 'not-an-address', 123]
        },
        {
          type: 'UFix64' as const,
          validValues: ['10.0', '0.000001', '999999.99999999'],
          invalidValues: ['-10.0', 'not-a-number', '10.123456789']
        },
        {
          type: 'String' as const,
          validValues: ['hello', 'test string', '{"json": "value"}'],
          invalidValues: [123, true, null]
        },
        {
          type: 'Bool' as const,
          validValues: [true, false, 'true', 'false'],
          invalidValues: ['maybe', 'yes', 'no', 123]
        },
        {
          type: 'Int' as const,
          validValues: [42, -42, '100', '-100'],
          invalidValues: ['not-a-number', 42.5, 'maybe']
        },
        {
          type: 'UInt64' as const,
          validValues: [42, '100', '0'],
          invalidValues: [-42, '-100', 42.5, 'not-a-number']
        }
      ]

      parameterTypes.forEach(({ type, validValues, invalidValues }) => {
        describe(`${type} parameter validation`, () => {
          const parameter: EnhancedActionParameter = {
            name: 'testParam',
            type,
            required: true,
            value: '',
            validation: {
              required: true,
              type: type as ParameterType
            }
          }

          const context: ValidationContext = {
            workflow: createComplexWorkflow(),
            currentAction: createComplexWorkflow().actions[0],
            availableOutputs: {}
          }

          validValues.forEach(value => {
            it(`should accept valid ${type} value: ${JSON.stringify(value)}`, () => {
              const result = parameterValidator.validateParameter(parameter, value, context)
              expect(result.isValid).toBe(true)
              expect(result.errors).toHaveLength(0)
            })
          })

          invalidValues.forEach(value => {
            it(`should reject invalid ${type} value: ${JSON.stringify(value)}`, () => {
              const result = parameterValidator.validateParameter(parameter, value, context)
              expect(result.isValid).toBe(false)
              expect(result.errors.length).toBeGreaterThan(0)
            })
          })
        })
      })
    }

    testAllParameterTypes()

    it('should validate constraint combinations', () => {
      const constrainedParameter: EnhancedActionParameter = {
        name: 'constrainedParam',
        type: 'String',
        required: true,
        value: '',
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            minLength: 5,
            maxLength: 20,
            pattern: /^[a-zA-Z0-9]+$/,
            enum: ['validOption1', 'validOption2', 'anotherValidOption']
          }
        }
      }

      const context: ValidationContext = {
        workflow: createComplexWorkflow(),
        currentAction: createComplexWorkflow().actions[0],
        availableOutputs: {}
      }

      // Valid value that meets all constraints
      const validResult = parameterValidator.validateParameter(
        constrainedParameter,
        'validOption1',
        context
      )
      expect(validResult.isValid).toBe(true)

      // Invalid: too short
      const tooShortResult = parameterValidator.validateParameter(
        constrainedParameter,
        'abc',
        context
      )
      expect(tooShortResult.isValid).toBe(false)

      // Invalid: not in enum
      const notInEnumResult = parameterValidator.validateParameter(
        constrainedParameter,
        'invalidOption',
        context
      )
      expect(notInEnumResult.isValid).toBe(false)

      // Invalid: doesn't match pattern
      const patternMismatchResult = parameterValidator.validateParameter(
        constrainedParameter,
        'valid-option!',
        context
      )
      expect(patternMismatchResult.isValid).toBe(false)
    })
  })

  describe('Error Recovery and User Guidance', () => {
    it('should provide helpful error messages and suggestions', () => {
      const parameter: EnhancedActionParameter = {
        name: 'amount',
        type: 'UFix64',
        required: true,
        value: '',
        validation: {
          required: true,
          type: ParameterType.UFIX64,
          constraints: {
            min: 0.000001,
            max: 1000000,
            decimals: 8
          }
        }
      }

      const context: ValidationContext = {
        workflow: createComplexWorkflow(),
        currentAction: createComplexWorkflow().actions[0],
        availableOutputs: {}
      }

      // Test various error scenarios
      const negativeResult = parameterValidator.validateParameter(parameter, '-10.0', context)
      expect(negativeResult.isValid).toBe(false)
      expect(negativeResult.suggestions).toContain('UFix64 values must be positive decimal numbers')

      const tooManyDecimalsResult = parameterValidator.validateParameter(parameter, '10.123456789', context)
      expect(tooManyDecimalsResult.isValid).toBe(true) // Should be valid but with warning
      expect(tooManyDecimalsResult.warnings).toContain('amount has more than 8 decimal places')

      const tooLargeResult = parameterValidator.validateParameter(parameter, '2000000.0', context)
      expect(tooLargeResult.isValid).toBe(false)
      expect(tooLargeResult.errors.some(e => e.message.includes('must be no more than 1000000'))).toBe(true)
    })

    it('should provide context-aware suggestions', async () => {
      const workflow = createComplexWorkflow()
      const availableOutputs = {
        'action-1.outputToken': { name: 'outputToken', type: 'Address', description: 'Output token' },
        'action-1.outputAmount': { name: 'outputAmount', type: 'UFix64', description: 'Output amount' }
      }

      // Test address parameter suggestions
      const addressSuggestions = await suggestionEngine.generateSuggestions(
        'Address',
        'token',
        { workflow, availableOutputs }
      )
      
      expect(addressSuggestions.length).toBeGreaterThan(0)
      expect(addressSuggestions.some(s => s.value === 'action-1.outputToken')).toBe(true)

      // Test amount parameter suggestions
      const amountSuggestions = await suggestionEngine.generateSuggestions(
        'UFix64',
        'amount',
        { workflow, availableOutputs }
      )
      
      expect(amountSuggestions.length).toBeGreaterThan(0)
      expect(amountSuggestions.some(s => s.value === 'action-1.outputAmount')).toBe(true)
    })

    it('should handle validation error recovery', () => {
      const workflow = createComplexWorkflow()
      const actionMetadata = createActionMetadata()
      
      // Start with invalid parameters
      let parameterValues = {
        'action-1': {
          fromToken: 'invalid',
          toToken: 'invalid',
          amount: '-10'
        }
      }

      const action = workflow.actions[0]
      const metadata = actionMetadata[action.actionType]
      const context: ValidationContext = {
        workflow,
        currentAction: action,
        availableOutputs: {}
      }

      // Initial validation should fail
      let result = parameterValidator.validateAllParameters(metadata, parameterValues['action-1'], context)
      expect(result.isValid).toBe(false)
      
      const initialErrorCount = Object.keys(result.invalidParameters).length

      // Fix parameters one by one
      parameterValues['action-1'].fromToken = '0x1654653399040a61'
      result = parameterValidator.validateAllParameters(metadata, parameterValues['action-1'], context)
      expect(Object.keys(result.invalidParameters).length).toBeLessThan(initialErrorCount)

      parameterValues['action-1'].toToken = '0x3c5959b568896393'
      result = parameterValidator.validateAllParameters(metadata, parameterValues['action-1'], context)
      expect(Object.keys(result.invalidParameters).length).toBeLessThan(2)

      parameterValues['action-1'].amount = '10.0'
      result = parameterValidator.validateAllParameters(metadata, parameterValues['action-1'], context)
      expect(result.isValid).toBe(true)
      expect(Object.keys(result.invalidParameters)).toHaveLength(0)
    })

    it('should provide progressive validation feedback', () => {
      const parameter: EnhancedActionParameter = {
        name: 'email',
        type: 'String',
        required: true,
        value: '',
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            minLength: 5,
            maxLength: 100
          }
        }
      }

      const context: ValidationContext = {
        workflow: createComplexWorkflow(),
        currentAction: createComplexWorkflow().actions[0],
        availableOutputs: {}
      }

      // Progressive validation as user types
      const stages = ['', 'a', 'a@', 'a@b', 'a@b.', 'a@b.c', 'valid@email.com']
      const results = stages.map(value => 
        parameterValidator.validateParameter(parameter, value, context)
      )

      // Should show different validation states
      expect(results[0].isValid).toBe(false) // Empty
      expect(results[1].isValid).toBe(false) // Too short, invalid format
      expect(results[2].isValid).toBe(false) // Invalid format
      expect(results[3].isValid).toBe(false) // Invalid format
      expect(results[4].isValid).toBe(false) // Invalid format
      expect(results[5].isValid).toBe(true)  // Valid format, meets length
      expect(results[6].isValid).toBe(true)  // Valid email
    })
  })

  // Helper functions
  function createLargeWorkflow(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: 'transfer-tokens',
      name: `Transfer ${i + 1}`,
      parameters: [
        { name: 'token', type: 'Address', value: '', required: true },
        { name: 'amount', type: 'UFix64', value: '', required: true },
        { name: 'recipient', type: 'Address', value: '', required: true }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : [],
      position: { x: i * 100, y: 0 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount - 1,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createComplexDataFlowWorkflow(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: 'swap-tokens',
      name: `Swap ${i + 1}`,
      parameters: [
        { 
          name: 'amount', 
          type: 'UFix64', 
          value: i > 0 ? `action-${i}.outputAmount` : '100.0', 
          required: true 
        }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : [],
      position: { x: i * 100, y: 0 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount - 1,
        createdAt: new Date().toISOString()
      }
    }
  }
})