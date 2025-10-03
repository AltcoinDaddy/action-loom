import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { 
  ParameterSuggestionEngine, 
  AddressValidator,
  createParameterSuggestionEngine,
  defaultSuggestionEngine
} from '../parameter-suggestion-engine'
import { FlowAPIClient } from '../flow-api-client'
import { 
  ActionParameter, 
  ParsedWorkflow, 
  ParsedAction, 
  ActionOutput,
  ActionMetadata 
} from '../types'
import { ParameterType, ValidationContext } from '../parameter-validator'

// Mock FlowAPIClient
vi.mock('../flow-api-client', () => ({
  FlowAPIClient: vi.fn(),
  createFlowAPIClient: vi.fn(() => ({
    getCurrentNetwork: vi.fn(() => ({ name: 'testnet' }))
  }))
}))

describe('ParameterSuggestionEngine', () => {
  let suggestionEngine: ParameterSuggestionEngine
  let mockFlowClient: FlowAPIClient
  let mockContext: ValidationContext

  beforeEach(() => {
    mockFlowClient = {
      getCurrentNetwork: vi.fn(() => ({ name: 'testnet' }))
    } as any

    suggestionEngine = new ParameterSuggestionEngine(mockFlowClient)

    // Create mock validation context
    const mockWorkflow: ParsedWorkflow = {
      actions: [],
      executionOrder: [],
      rootActions: [],
      metadata: {
        totalActions: 0,
        totalConnections: 0,
        createdAt: new Date().toISOString()
      }
    }

    const mockAction: ParsedAction = {
      id: 'test-action',
      actionType: 'swap',
      name: 'Test Action',
      parameters: [],
      nextActions: [],
      position: { x: 0, y: 0 }
    }

    const mockAvailableOutputs: Record<string, ActionOutput> = {
      'action1': {
        name: 'amount',
        type: 'UFix64',
        description: 'Output amount'
      },
      'action2': {
        name: 'tokenAddress',
        type: 'Address',
        description: 'Token contract address'
      }
    }

    mockContext = {
      workflow: mockWorkflow,
      currentAction: mockAction,
      availableOutputs: mockAvailableOutputs
    }
  })

  describe('getParameterSuggestions', () => {
    it('should return token suggestions for string token parameters', async () => {
      const parameter: ActionParameter = {
        name: 'fromToken',
        type: 'String',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      expect(suggestions.length).toBeGreaterThan(4) // 4 common tokens + parameter references
      expect(suggestions[0].value).toBe('FLOW')
      expect(suggestions[0].category).toBe('common')
      expect(suggestions[1].value).toBe('USDC')
      expect(suggestions.some(s => s.category === 'reference')).toBe(true) // Should have address reference compatible with string
    })

    it('should return address suggestions for address parameters', async () => {
      const parameter: ActionParameter = {
        name: 'tokenContract',
        type: 'Address',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions[0].value).toMatch(/^0x[a-fA-F0-9]{16}$/)
      expect(suggestions.some(s => s.category === 'contract')).toBe(true)
      expect(suggestions.some(s => s.category === 'reference')).toBe(true) // Should include action2.tokenAddress
    })

    it('should return amount suggestions for UFix64 parameters', async () => {
      const parameter: ActionParameter = {
        name: 'amount',
        type: 'UFix64',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.value === '1.0')).toBe(true)
      expect(suggestions.some(s => s.value === '10.0')).toBe(true)
      expect(suggestions.some(s => s.category === 'common')).toBe(true)
      expect(suggestions.some(s => s.category === 'reference')).toBe(true) // Should include action1.amount
    })

    it('should return boolean suggestions for Bool parameters', async () => {
      const parameter: ActionParameter = {
        name: 'enabled',
        type: 'Bool',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      expect(suggestions).toHaveLength(2)
      expect(suggestions[0].value).toBe(true)
      expect(suggestions[1].value).toBe(false)
      expect(suggestions[0].category).toBe('boolean')
    })

    it('should return fee-specific suggestions for fee parameters', async () => {
      const parameter: ActionParameter = {
        name: 'transactionFee',
        type: 'UFix64',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      expect(suggestions.some(s => s.value === '0.001')).toBe(true)
      expect(suggestions.some(s => s.category === 'fee')).toBe(true)
    })

    it('should return percentage suggestions for percentage parameters', async () => {
      const parameter: ActionParameter = {
        name: 'slippagePercentage',
        type: 'UInt64',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      expect(suggestions.some(s => s.value === '25')).toBe(true)
      expect(suggestions.some(s => s.value === '50')).toBe(true)
      expect(suggestions.some(s => s.category === 'percentage')).toBe(true)
    })

    it('should return parameter reference suggestions', async () => {
      const parameter: ActionParameter = {
        name: 'inputAmount',
        type: 'UFix64',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      const referenceSuggestions = suggestions.filter(s => s.category === 'reference')
      expect(referenceSuggestions.length).toBeGreaterThan(0)
      expect(referenceSuggestions[0].value).toBe('action1.amount')
      expect(referenceSuggestions[0].description).toContain('Use output from action1')
    })
  })

  describe('getDefaultValue', () => {
    it('should return default token for token parameters', () => {
      const parameter: ActionParameter = {
        name: 'fromToken',
        type: 'String',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe('FLOW')
    })

    it('should return default address for token contract parameters', () => {
      const parameter: ActionParameter = {
        name: 'tokenContract',
        type: 'Address',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe('0x1654653399040a61') // Flow token address
    })

    it('should return default amount for amount parameters', () => {
      const parameter: ActionParameter = {
        name: 'amount',
        type: 'UFix64',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe('1.0')
    })

    it('should return fee default for fee parameters', () => {
      const parameter: ActionParameter = {
        name: 'transactionFee',
        type: 'UFix64',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe('0.001')
    })

    it('should return false for boolean parameters', () => {
      const parameter: ActionParameter = {
        name: 'isActive',
        type: 'Bool',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe(false)
    })

    it('should return true for enable-type boolean parameters', () => {
      const parameter: ActionParameter = {
        name: 'enableFeature',
        type: 'Bool',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe(true)
    })

    it('should return empty string for generic string parameters', () => {
      const parameter: ActionParameter = {
        name: 'description',
        type: 'String',
        value: '',
        required: true
      }

      const defaultValue = suggestionEngine.getDefaultValue(parameter, mockContext)
      expect(defaultValue).toBe('')
    })
  })

  describe('populateDefaultValues', () => {
    it('should populate default values for all required parameters', () => {
      const action: ActionMetadata = {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test action',
        category: 'defi',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        parameters: [
          {
            name: 'fromToken',
            type: 'String',
            value: '',
            required: true
          },
          {
            name: 'amount',
            type: 'UFix64',
            value: '',
            required: true
          },
          {
            name: 'optionalParam',
            type: 'String',
            value: '',
            required: false
          }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: 'medium' as any,
        author: 'test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const defaultValues = suggestionEngine.populateDefaultValues(action, mockContext)

      expect(defaultValues).toHaveProperty('fromToken', 'FLOW')
      expect(defaultValues).toHaveProperty('amount', '1.0')
      expect(defaultValues).not.toHaveProperty('optionalParam') // Should skip optional parameters
    })

    it('should not populate defaults for empty values', () => {
      const action: ActionMetadata = {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test action',
        category: 'defi',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        parameters: [
          {
            name: 'description',
            type: 'String',
            value: '',
            required: true
          }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: 'medium' as any,
        author: 'test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const defaultValues = suggestionEngine.populateDefaultValues(action, mockContext)

      expect(Object.keys(defaultValues)).toHaveLength(0) // No defaults for empty string values
    })
  })

  describe('error handling', () => {
    it('should handle network errors gracefully for token suggestions', async () => {
      // Mock network error
      const errorEngine = new ParameterSuggestionEngine(mockFlowClient)
      
      const parameter: ActionParameter = {
        name: 'fromToken',
        type: 'String',
        value: '',
        required: true
      }

      const suggestions = await errorEngine.getParameterSuggestions(parameter, mockContext)

      // Should return fallback suggestions
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.value === 'FLOW')).toBe(true)
    })

    it('should handle network errors gracefully for address suggestions', async () => {
      const parameter: ActionParameter = {
        name: 'tokenContract',
        type: 'Address',
        value: '',
        required: true
      }

      const suggestions = await suggestionEngine.getParameterSuggestions(parameter, mockContext)

      // Should return fallback suggestions
      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.value.startsWith('0x'))).toBe(true)
    })
  })
})

describe('AddressValidator', () => {
  describe('isValidFlowAddress', () => {
    it('should validate correct Flow addresses', () => {
      expect(AddressValidator.isValidFlowAddress('0x1654653399040a61')).toBe(true)
      expect(AddressValidator.isValidFlowAddress('0xb19436aae4d94622')).toBe(true)
      expect(AddressValidator.isValidFlowAddress('0x0000000000000000')).toBe(true)
    })

    it('should reject invalid Flow addresses', () => {
      expect(AddressValidator.isValidFlowAddress('0x123')).toBe(false) // Too short
      expect(AddressValidator.isValidFlowAddress('1654653399040a61')).toBe(false) // Missing 0x
      expect(AddressValidator.isValidFlowAddress('0x1654653399040a61x')).toBe(false) // Too long
      expect(AddressValidator.isValidFlowAddress('0xGGGG653399040a61')).toBe(false) // Invalid hex
      expect(AddressValidator.isValidFlowAddress('')).toBe(false) // Empty
      expect(AddressValidator.isValidFlowAddress(null as any)).toBe(false) // Null
    })
  })

  describe('formatAddress', () => {
    it('should format valid addresses with truncation', () => {
      const address = '0x1654653399040a61'
      const formatted = AddressValidator.formatAddress(address, true)
      expect(formatted).toBe('0x1654...0a61')
    })

    it('should format valid addresses without truncation', () => {
      const address = '0x1654653399040a61'
      const formatted = AddressValidator.formatAddress(address, false)
      expect(formatted).toBe('0x1654653399040a61')
    })

    it('should return invalid addresses unchanged', () => {
      const invalidAddress = '0x123'
      const formatted = AddressValidator.formatAddress(invalidAddress, true)
      expect(formatted).toBe('0x123')
    })
  })

  describe('normalizeAddress', () => {
    it('should normalize addresses to lowercase with 0x prefix', () => {
      expect(AddressValidator.normalizeAddress('1654653399040A61')).toBe('0x1654653399040a61')
      expect(AddressValidator.normalizeAddress('0X1654653399040A61')).toBe('0x1654653399040a61')
    })

    it('should pad short addresses with zeros', () => {
      expect(AddressValidator.normalizeAddress('0x123')).toBe('0x0000000000000123')
      expect(AddressValidator.normalizeAddress('123')).toBe('0x0000000000000123')
    })

    it('should handle already normalized addresses', () => {
      const address = '0x1654653399040a61'
      expect(AddressValidator.normalizeAddress(address)).toBe(address)
    })

    it('should handle non-string inputs', () => {
      expect(AddressValidator.normalizeAddress(null as any)).toBe(null)
      expect(AddressValidator.normalizeAddress(undefined as any)).toBe(undefined)
    })
  })

  describe('getAddressSuggestions', () => {
    it('should suggest completion for partial addresses', () => {
      const suggestions = AddressValidator.getAddressSuggestions('0x1654')
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]).toBe('0x1654000000000000')
    })

    it('should suggest adding 0x prefix for hex strings', () => {
      const suggestions = AddressValidator.getAddressSuggestions('1654653399040a61')
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]).toBe('0x1654653399040a61')
    })

    it('should return empty array for invalid inputs', () => {
      expect(AddressValidator.getAddressSuggestions('invalid')).toHaveLength(0)
      expect(AddressValidator.getAddressSuggestions('0x1654653399040a61')).toHaveLength(0) // Already complete
    })
  })
})

describe('Factory functions', () => {
  it('should create parameter suggestion engine with custom client', () => {
    const customClient = {} as FlowAPIClient
    const engine = createParameterSuggestionEngine(customClient)
    expect(engine).toBeInstanceOf(ParameterSuggestionEngine)
  })

  it('should create parameter suggestion engine with default client', () => {
    const engine = createParameterSuggestionEngine()
    expect(engine).toBeInstanceOf(ParameterSuggestionEngine)
  })

  it('should provide default suggestion engine instance', () => {
    expect(defaultSuggestionEngine).toBeInstanceOf(ParameterSuggestionEngine)
  })
})

describe('Integration scenarios', () => {
  let engine: ParameterSuggestionEngine

  beforeEach(() => {
    engine = new ParameterSuggestionEngine()
  })

  it('should handle swap action parameter suggestions', async () => {
    const swapContext: ValidationContext = {
      workflow: {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 1,
          totalConnections: 0,
          createdAt: new Date().toISOString()
        }
      },
      currentAction: {
        id: 'swap-1',
        actionType: 'swap',
        name: 'Swap Tokens',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      },
      availableOutputs: {}
    }

    const fromTokenParam: ActionParameter = {
      name: 'fromToken',
      type: 'String',
      value: '',
      required: true
    }

    const toTokenParam: ActionParameter = {
      name: 'toToken',
      type: 'String',
      value: '',
      required: true
    }

    const amountParam: ActionParameter = {
      name: 'amount',
      type: 'UFix64',
      value: '',
      required: true
    }

    const fromTokenSuggestions = await engine.getParameterSuggestions(fromTokenParam, swapContext)
    const toTokenSuggestions = await engine.getParameterSuggestions(toTokenParam, swapContext)
    const amountSuggestions = await engine.getParameterSuggestions(amountParam, swapContext)

    // Should get token suggestions for both token parameters
    expect(fromTokenSuggestions.some(s => s.value === 'FLOW')).toBe(true)
    expect(toTokenSuggestions.some(s => s.value === 'USDC')).toBe(true)
    
    // Should get amount suggestions
    expect(amountSuggestions.some(s => s.value === '1.0')).toBe(true)
    expect(amountSuggestions.some(s => s.value === '10.0')).toBe(true)

    // Check default values
    expect(engine.getDefaultValue(fromTokenParam, swapContext)).toBe('FLOW')
    expect(engine.getDefaultValue(toTokenParam, swapContext)).toBe('USDC')
    expect(engine.getDefaultValue(amountParam, swapContext)).toBe('1.0')
  })

  it('should handle stake action parameter suggestions', async () => {
    const stakeContext: ValidationContext = {
      workflow: {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 1,
          totalConnections: 0,
          createdAt: new Date().toISOString()
        }
      },
      currentAction: {
        id: 'stake-1',
        actionType: 'stake',
        name: 'Stake Tokens',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      },
      availableOutputs: {}
    }

    const tokenParam: ActionParameter = {
      name: 'token',
      type: 'String',
      value: '',
      required: true
    }

    const validatorParam: ActionParameter = {
      name: 'validatorAddress',
      type: 'Address',
      value: '',
      required: true
    }

    const tokenSuggestions = await engine.getParameterSuggestions(tokenParam, stakeContext)
    const validatorSuggestions = await engine.getParameterSuggestions(validatorParam, stakeContext)

    // Should get token suggestions (likely FLOW for staking)
    expect(tokenSuggestions.some(s => s.value === 'FLOW')).toBe(true)
    
    // Should get address suggestions
    expect(validatorSuggestions.some(s => s.value.startsWith('0x'))).toBe(true)

    // Check default values
    expect(engine.getDefaultValue(tokenParam, stakeContext)).toBe('FLOW')
  })
})