import { describe, it, expect, beforeEach } from 'vitest'
import {
  EnhancedActionMetadataService,
  enhancedActionMetadataService
} from '../enhanced-action-metadata-service'
import { ActionValidationTemplates, ENHANCED_ACTION_DEFINITIONS } from '../action-validation-templates'
import {
  ActionMetadata,
  EnhancedActionMetadata,
  ParameterType,
  SecurityLevel,
  ValidationContext,
  ParsedWorkflow,
  ParsedAction
} from '../types'

describe('ActionValidationTemplates', () => {
  describe('createSwapTokenValidation', () => {
    it('should create proper validation rules for token addresses', () => {
      const rules = ActionValidationTemplates.createSwapTokenValidation()
      
      expect(rules.required).toBe(true)
      expect(rules.type).toBe(ParameterType.ADDRESS)
      expect(rules.constraints?.pattern).toBeDefined()
      expect(rules.constraints?.minLength).toBe(18)
      expect(rules.constraints?.maxLength).toBe(18)
    })
  })

  describe('createAmountValidation', () => {
    it('should create validation rules with default constraints', () => {
      const rules = ActionValidationTemplates.createAmountValidation()
      
      expect(rules.required).toBe(true)
      expect(rules.type).toBe(ParameterType.UFIX64)
      expect(rules.constraints?.min).toBe(0)
      expect(rules.constraints?.decimals).toBe(8)
      expect(rules.customValidator).toBeDefined()
    })

    it('should validate positive amounts', () => {
      const rules = ActionValidationTemplates.createAmountValidation()
      const validator = rules.customValidator!
      
      const validResult = validator('10.5', {} as ValidationContext)
      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)
    })

    it('should reject negative amounts', () => {
      const rules = ActionValidationTemplates.createAmountValidation()
      const validator = rules.customValidator!
      
      const invalidResult = validator('-5.0', {} as ValidationContext)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toHaveLength(1)
      expect(invalidResult.errors[0].message).toContain('greater than 0')
    })

    it('should reject invalid number formats', () => {
      const rules = ActionValidationTemplates.createAmountValidation()
      const validator = rules.customValidator!
      
      const invalidResult = validator('not-a-number', {} as ValidationContext)
      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toHaveLength(1)
      expect(invalidResult.errors[0].message).toContain('valid number')
    })
  })

  describe('createSlippageValidation', () => {
    it('should create optional validation rules for slippage', () => {
      const rules = ActionValidationTemplates.createSlippageValidation()
      
      expect(rules.required).toBe(false)
      expect(rules.type).toBe(ParameterType.UFIX64)
      expect(rules.constraints?.min).toBe(0.01)
      expect(rules.constraints?.max).toBe(50.0)
      expect(rules.constraints?.decimals).toBe(2)
    })

    it('should warn about high slippage values', () => {
      const rules = ActionValidationTemplates.createSlippageValidation()
      const validator = rules.customValidator!
      
      const result = validator('10.0', {} as ValidationContext)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('High slippage')
    })

    it('should accept empty values for optional parameter', () => {
      const rules = ActionValidationTemplates.createSlippageValidation()
      const validator = rules.customValidator!
      
      const result = validator('', {} as ValidationContext)
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('createAddressValidation', () => {
    it('should validate correct Flow addresses', () => {
      const rules = ActionValidationTemplates.createAddressValidation()
      const validator = rules.customValidator!
      
      const result = validator('0x1654653399040a61', {} as ValidationContext)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject addresses without 0x prefix', () => {
      const rules = ActionValidationTemplates.createAddressValidation()
      const validator = rules.customValidator!
      
      const result = validator('1654653399040a61', {} as ValidationContext)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('start with 0x')
    })

    it('should reject addresses with wrong length', () => {
      const rules = ActionValidationTemplates.createAddressValidation()
      const validator = rules.customValidator!
      
      const result = validator('0x1654653399040a6', {} as ValidationContext)
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('18 characters')
    })

    it('should handle optional addresses', () => {
      const rules = ActionValidationTemplates.createAddressValidation(false)
      const validator = rules.customValidator!
      
      const result = validator('', {} as ValidationContext)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('createDurationValidation', () => {
    it('should create validation rules for duration parameters', () => {
      const rules = ActionValidationTemplates.createDurationValidation()
      
      expect(rules.required).toBe(true)
      expect(rules.type).toBe(ParameterType.UINT64)
      expect(rules.constraints?.min).toBe(1)
      expect(rules.constraints?.max).toBe(365 * 24 * 60 * 60)
    })

    it('should warn about short durations', () => {
      const rules = ActionValidationTemplates.createDurationValidation()
      const validator = rules.customValidator!
      
      const result = validator('3600', {} as ValidationContext) // 1 hour
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0]).toContain('Short staking duration')
    })

    it('should accept valid durations without warnings', () => {
      const rules = ActionValidationTemplates.createDurationValidation()
      const validator = rules.customValidator!
      
      const result = validator('604800', {} as ValidationContext) // 1 week
      expect(result.isValid).toBe(true)
      expect(result.warnings).toHaveLength(0)
    })
  })

  describe('suggestion creation', () => {
    it('should create token suggestions', () => {
      const suggestions = ActionValidationTemplates.createTokenSuggestions()
      
      expect(suggestions).toHaveLength(3)
      expect(suggestions[0].label).toBe('FLOW')
      expect(suggestions[0].value).toBe('0x1654653399040a61')
      expect(suggestions[0].category).toBe('native')
    })

    it('should create slippage suggestions', () => {
      const suggestions = ActionValidationTemplates.createSlippageSuggestions()
      
      expect(suggestions).toHaveLength(3)
      expect(suggestions[0].value).toBe('0.5')
      expect(suggestions[1].value).toBe('1.0')
      expect(suggestions[2].value).toBe('3.0')
    })
  })
})

describe('ENHANCED_ACTION_DEFINITIONS', () => {
  describe('swap-tokens action', () => {
    const swapAction = ENHANCED_ACTION_DEFINITIONS['swap-tokens']

    it('should have complete metadata structure', () => {
      expect(swapAction.id).toBe('swap-tokens')
      expect(swapAction.name).toBe('Swap Tokens')
      expect(swapAction.category).toBe('DeFi')
      expect(swapAction.parameters).toHaveLength(4)
      expect(swapAction.outputs).toHaveLength(2)
    })

    it('should have enhanced parameters with validation rules', () => {
      const tokenInParam = swapAction.parameters.find(p => p.name === 'tokenIn')
      expect(tokenInParam).toBeDefined()
      expect(tokenInParam!.validation).toBeDefined()
      expect(tokenInParam!.suggestions).toBeDefined()
      expect(tokenInParam!.defaultValue).toBe('0x1654653399040a61')
    })

    it('should have custom validation for token conflicts', () => {
      expect(swapAction.validationRules?.customValidation).toBeDefined()
      
      const validator = swapAction.validationRules!.customValidation!
      const result = validator(
        { tokenIn: '0x1234', tokenOut: '0x1234' },
        {} as ValidationContext
      )
      
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('Cannot swap a token for itself')
    })

    it('should have mutually exclusive token parameters', () => {
      expect(swapAction.validationRules?.mutuallyExclusive).toBeDefined()
      expect(swapAction.validationRules!.mutuallyExclusive![0]).toEqual(['tokenIn', 'tokenOut'])
    })
  })

  describe('stake-tokens action', () => {
    const stakeAction = ENHANCED_ACTION_DEFINITIONS['stake-tokens']

    it('should have complete metadata structure', () => {
      expect(stakeAction.id).toBe('stake-tokens')
      expect(stakeAction.name).toBe('Stake Tokens')
      expect(stakeAction.category).toBe('DeFi')
      expect(stakeAction.parameters).toHaveLength(4)
      expect(stakeAction.securityLevel).toBe(SecurityLevel.HIGH)
    })

    it('should have duration parameter with suggestions', () => {
      const durationParam = stakeAction.parameters.find(p => p.name === 'duration')
      expect(durationParam).toBeDefined()
      expect(durationParam!.suggestions).toHaveLength(3)
      expect(durationParam!.defaultValue).toBe('2592000') // 30 days
    })

    it('should have conditional requirements for large stakes', () => {
      expect(stakeAction.validationRules?.conditionalRequirements).toBeDefined()
      
      const condition = stakeAction.validationRules!.conditionalRequirements![0]
      expect(condition.condition({ amount: '1500' })).toBe(true)
      expect(condition.condition({ amount: '500' })).toBe(false)
      expect(condition.requiredParameters).toContain('validator')
    })
  })
})

describe('EnhancedActionMetadataService', () => {
  let service: EnhancedActionMetadataService

  beforeEach(() => {
    service = new EnhancedActionMetadataService()
  })

  describe('initialization', () => {
    it('should load default enhanced actions', () => {
      const actions = service.getAllEnhancedActions()
      expect(actions.length).toBeGreaterThan(0)
      
      const swapAction = service.getEnhancedAction('swap-tokens')
      expect(swapAction).toBeDefined()
      expect(swapAction!.parameters[0].validation).toBeDefined()
    })
  })

  describe('enhanceActionMetadata', () => {
    it('should enhance basic action metadata', () => {
      const basicAction: ActionMetadata = {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test description',
        category: 'Test',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        parameters: [
          {
            name: 'amount',
            type: 'UFix64',
            value: '',
            required: true
          },
          {
            name: 'tokenAddress',
            type: 'Address',
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
        securityLevel: SecurityLevel.MEDIUM,
        author: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const enhanced = service.enhanceActionMetadata(basicAction)
      
      expect(enhanced.parameters).toHaveLength(2)
      expect(enhanced.parameters[0].validation).toBeDefined()
      expect(enhanced.parameters[1].validation).toBeDefined()
      expect(enhanced.parameters[1].suggestions).toBeDefined() // Token suggestions
    })

    it('should return cached enhanced action if already exists', () => {
      const existingAction = service.getEnhancedAction('swap-tokens')
      expect(existingAction).toBeDefined()
      
      const basicAction: ActionMetadata = {
        ...existingAction!,
        parameters: existingAction!.parameters.map(p => ({
          name: p.name,
          type: p.type,
          value: p.value,
          required: p.required
        }))
      }
      
      const enhanced = service.enhanceActionMetadata(basicAction)
      expect(enhanced).toBe(existingAction) // Should return same instance
    })
  })

  describe('registerEnhancedAction', () => {
    it('should register new enhanced action', () => {
      const newAction: EnhancedActionMetadata = {
        id: 'new-action',
        name: 'New Action',
        description: 'New test action',
        category: 'Test',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        parameters: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 500,
        securityLevel: SecurityLevel.LOW,
        author: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      service.registerEnhancedAction(newAction)
      
      const retrieved = service.getEnhancedAction('new-action')
      expect(retrieved).toBe(newAction)
    })
  })

  describe('updateValidationRules', () => {
    it('should update existing action validation rules', () => {
      const actionId = 'swap-tokens'
      const newRules = {
        validationRules: {
          requiredParameterGroups: [['tokenIn', 'tokenOut']]
        }
      }

      const success = service.updateValidationRules(actionId, newRules)
      expect(success).toBe(true)
      
      const updated = service.getEnhancedAction(actionId)
      expect(updated!.validationRules!.requiredParameterGroups).toEqual([['tokenIn', 'tokenOut']])
    })

    it('should return false for non-existent action', () => {
      const success = service.updateValidationRules('non-existent', {})
      expect(success).toBe(false)
    })
  })

  describe('validateEnhancedAction', () => {
    it('should validate complete enhanced action', () => {
      const action = service.getEnhancedAction('swap-tokens')!
      const result = service.validateEnhancedAction(action)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalidAction = {
        ...service.getEnhancedAction('swap-tokens')!,
        id: '',
        name: ''
      }
      
      const result = service.validateEnhancedAction(invalidAction)
      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toContain('must have id and name')
    })

    it('should warn about missing validation rules', () => {
      const actionWithoutValidation: EnhancedActionMetadata = {
        id: 'test-action',
        name: 'Test Action',
        description: 'Test',
        category: 'Test',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        parameters: [
          {
            name: 'param1',
            type: 'String',
            value: '',
            required: true,
            validation: undefined as any
          }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: SecurityLevel.MEDIUM,
        author: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      const result = service.validateEnhancedAction(actionWithoutValidation)
      expect(result.warnings).toContain('Parameter param1 missing validation rules')
    })
  })

  describe('default validation rule creation', () => {
    it('should create appropriate rules for different parameter types', () => {
      const basicAction: ActionMetadata = {
        id: 'test-types',
        name: 'Test Types',
        description: 'Test different parameter types',
        category: 'Test',
        version: '1.0.0',
        inputs: [],
        outputs: [],
        parameters: [
          { name: 'address', type: 'Address', value: '', required: true },
          { name: 'tokenAddress', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'slippage', type: 'UFix64', value: '', required: false },
          { name: 'duration', type: 'UInt64', value: '', required: true },
          { name: 'enabled', type: 'Bool', value: '', required: true },
          { name: 'description', type: 'String', value: '', required: false }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: SecurityLevel.MEDIUM,
        author: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      const enhanced = service.enhanceActionMetadata(basicAction)
      
      // Check address validation
      const addressParam = enhanced.parameters.find(p => p.name === 'address')!
      expect(addressParam.validation.type).toBe(ParameterType.ADDRESS)
      expect(addressParam.suggestions).toBeUndefined() // Generic address param doesn't get suggestions
      
      // Check token address validation (should have suggestions)
      const tokenAddressParam = enhanced.parameters.find(p => p.name === 'tokenAddress')!
      expect(tokenAddressParam.validation.type).toBe(ParameterType.ADDRESS)
      expect(tokenAddressParam.suggestions).toBeDefined()
      
      // Check amount validation
      const amountParam = enhanced.parameters.find(p => p.name === 'amount')!
      expect(amountParam.validation.type).toBe(ParameterType.UFIX64)
      expect(amountParam.validation.constraints?.min).toBe(0)
      
      // Check slippage validation
      const slippageParam = enhanced.parameters.find(p => p.name === 'slippage')!
      expect(slippageParam.validation.type).toBe(ParameterType.UFIX64)
      expect(slippageParam.suggestions).toBeDefined()
      
      // Check duration validation
      const durationParam = enhanced.parameters.find(p => p.name === 'duration')!
      expect(durationParam.validation.type).toBe(ParameterType.UINT64)
      
      // Check boolean validation
      const boolParam = enhanced.parameters.find(p => p.name === 'enabled')!
      expect(boolParam.validation.type).toBe(ParameterType.BOOL)
      expect(boolParam.defaultValue).toBe(false)
    })
  })
})

describe('singleton service', () => {
  it('should provide singleton instance', () => {
    expect(enhancedActionMetadataService).toBeInstanceOf(EnhancedActionMetadataService)
    
    const swapAction = enhancedActionMetadataService.getEnhancedAction('swap-tokens')
    expect(swapAction).toBeDefined()
  })
})