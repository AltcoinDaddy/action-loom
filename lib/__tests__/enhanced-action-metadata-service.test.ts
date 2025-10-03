import { describe, it, expect, beforeEach } from 'vitest'
import { EnhancedActionMetadataService } from '../enhanced-action-metadata-service'
import {
  ActionMetadata,
  EnhancedActionMetadata,
  ParameterType,
  SecurityLevel,
  ValidationContext,
  ParsedWorkflow,
  ParsedAction
} from '../types'

describe('EnhancedActionMetadataService', () => {
  let service: EnhancedActionMetadataService
  let mockActionMetadata: ActionMetadata
  let mockValidationContext: ValidationContext

  beforeEach(() => {
    service = new EnhancedActionMetadataService()
    
    mockActionMetadata = {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Exchange one token for another',
      category: 'defi',
      version: '1.0.0',
      inputs: [],
      outputs: [],
      parameters: [
        { name: 'fromToken', type: 'String', value: '', required: true },
        { name: 'toToken', type: 'String', value: '', required: true },
        { name: 'amount', type: 'UFix64', value: '', required: true }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 50000,
      securityLevel: SecurityLevel.MEDIUM,
      author: 'Test',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }

    mockValidationContext = {
      workflow: {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 1,
          totalConnections: 0,
          createdAt: '2024-01-01'
        }
      },
      currentAction: {
        id: 'action-1',
        actionType: 'swap-tokens',
        name: 'Swap Tokens',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      },
      availableOutputs: {}
    }
  })

  describe('enhanceActionMetadata', () => {
    it('should enhance swap tokens action with validation rules', () => {
      const enhanced = service.enhanceActionMetadata(mockActionMetadata)

      expect(enhanced).toBeDefined()
      expect(enhanced.validationRules).toBeDefined()
      expect(enhanced.parameters).toHaveLength(3)
      expect(enhanced.validationRules?.requiredParameterGroups).toEqual([['fromToken', 'toToken', 'amount']])
      expect(enhanced.validationRules?.conditionalRequirements).toHaveLength(2)
    })

    it('should enhance stake tokens action with validation rules', () => {
      const stakeAction = {
        ...mockActionMetadata,
        id: 'stake-tokens',
        name: 'Stake Tokens',
        parameters: [
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'duration', type: 'UInt64', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(stakeAction)

      expect(enhanced.validationRules).toBeDefined()
      expect(enhanced.parameters).toHaveLength(2)
      expect(enhanced.validationRules?.requiredParameterGroups).toEqual([['amount', 'duration']])
    })

    it('should enhance transfer tokens action with validation rules', () => {
      const transferAction = {
        ...mockActionMetadata,
        id: 'transfer-tokens',
        name: 'Transfer Tokens',
        parameters: [
          { name: 'recipient', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'token', type: 'String', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(transferAction)

      expect(enhanced.validationRules).toBeDefined()
      expect(enhanced.parameters).toHaveLength(3)
      expect(enhanced.parameters[0].validation.type).toBe(ParameterType.ADDRESS)
      expect(enhanced.parameters[0].validation.constraints?.pattern).toBeDefined()
    })

    it('should create enhanced parameters with proper validation rules', () => {
      const enhanced = service.enhanceActionMetadata(mockActionMetadata)

      const fromTokenParam = enhanced.parameters.find(p => p.name === 'fromToken')
      expect(fromTokenParam).toBeDefined()
      expect(fromTokenParam?.validation.required).toBe(true)
      expect(fromTokenParam?.validation.type).toBe(ParameterType.STRING)
      expect(fromTokenParam?.suggestions).toBeDefined()
      expect(fromTokenParam?.defaultValue).toBe('FLOW')

      const amountParam = enhanced.parameters.find(p => p.name === 'amount')
      expect(amountParam).toBeDefined()
      expect(amountParam?.validation.type).toBe(ParameterType.UFIX64)
      expect(amountParam?.validation.constraints?.min).toBe(0.000001)
      expect(amountParam?.validation.constraints?.decimals).toBe(8)
    })

    it('should handle unknown actions gracefully', () => {
      const unknownAction = {
        ...mockActionMetadata,
        id: 'unknown-action',
        parameters: [
          { name: 'param1', type: 'String', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(unknownAction)

      expect(enhanced.validationRules).toBeUndefined()
      expect(enhanced.parameters).toHaveLength(1)
      expect(enhanced.parameters[0].validation.type).toBe(ParameterType.STRING)
    })
  })

  describe('parameter type mapping', () => {
    it('should map parameter types correctly', () => {
      const testAction = {
        ...mockActionMetadata,
        id: 'test-action',
        parameters: [
          { name: 'address', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true },
          { name: 'text', type: 'String', value: '', required: true },
          { name: 'flag', type: 'Bool', value: '', required: true },
          { name: 'count', type: 'UInt64', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(testAction)

      expect(enhanced.parameters[0].validation.type).toBe(ParameterType.ADDRESS)
      expect(enhanced.parameters[1].validation.type).toBe(ParameterType.UFIX64)
      expect(enhanced.parameters[2].validation.type).toBe(ParameterType.STRING)
      expect(enhanced.parameters[3].validation.type).toBe(ParameterType.BOOL)
      expect(enhanced.parameters[4].validation.type).toBe(ParameterType.UINT64)
    })
  })

  describe('validation rule templates', () => {
    it('should provide swap tokens validation template', () => {
      const template = service.getValidationRuleTemplate('swap-tokens')

      expect(template).toBeDefined()
      expect(template?.requiredParameterGroups).toEqual([['fromToken', 'toToken', 'amount']])
      expect(template?.conditionalRequirements).toHaveLength(2)
      expect(template?.customValidation).toBeDefined()
    })

    it('should provide stake tokens validation template', () => {
      const template = service.getValidationRuleTemplate('stake-tokens')

      expect(template).toBeDefined()
      expect(template?.requiredParameterGroups).toEqual([['amount', 'duration']])
      expect(template?.conditionalRequirements).toHaveLength(2)
    })

    it('should provide transfer tokens validation template', () => {
      const template = service.getValidationRuleTemplate('transfer-tokens')

      expect(template).toBeDefined()
      expect(template?.requiredParameterGroups).toEqual([['recipient', 'amount', 'token']])
      expect(template?.conditionalRequirements).toHaveLength(1)
    })

    it('should return undefined for unknown templates', () => {
      const template = service.getValidationRuleTemplate('unknown-action')
      expect(template).toBeUndefined()
    })
  })

  describe('parameter templates', () => {
    it('should provide swap tokens parameter template', () => {
      const template = service.getParameterTemplate('swap-tokens')

      expect(template).toBeDefined()
      expect(template).toHaveLength(3)
      
      const fromToken = template?.find(p => p.name === 'fromToken')
      expect(fromToken?.suggestions).toHaveLength(3)
      expect(fromToken?.defaultValue).toBe('FLOW')
      expect(fromToken?.validation.constraints?.enum).toContain('FLOW')
    })

    it('should provide stake tokens parameter template', () => {
      const template = service.getParameterTemplate('stake-tokens')

      expect(template).toBeDefined()
      expect(template).toHaveLength(2)
      
      const amount = template?.find(p => p.name === 'amount')
      expect(amount?.validation.constraints?.min).toBe(1.0)
      expect(amount?.defaultValue).toBe('10.0')
      
      const duration = template?.find(p => p.name === 'duration')
      expect(duration?.validation.constraints?.min).toBe(86400)
      expect(duration?.defaultValue).toBe('604800')
    })

    it('should provide transfer tokens parameter template', () => {
      const template = service.getParameterTemplate('transfer-tokens')

      expect(template).toBeDefined()
      expect(template).toHaveLength(3)
      
      const recipient = template?.find(p => p.name === 'recipient')
      expect(recipient?.validation.type).toBe(ParameterType.ADDRESS)
      expect(recipient?.validation.constraints?.pattern).toBeDefined()
    })
  })

  describe('custom validation functions', () => {
    it('should validate swap tokens correctly', () => {
      const enhanced = service.enhanceActionMetadata(mockActionMetadata)
      const customValidation = enhanced.validationRules?.customValidation

      expect(customValidation).toBeDefined()

      // Valid swap
      const validResult = customValidation!({
        fromToken: 'FLOW',
        toToken: 'USDC',
        amount: '10.0'
      }, mockValidationContext)

      expect(validResult.isValid).toBe(true)
      expect(validResult.errors).toHaveLength(0)

      // Invalid swap - same token
      const invalidResult = customValidation!({
        fromToken: 'FLOW',
        toToken: 'FLOW',
        amount: '10.0'
      }, mockValidationContext)

      expect(invalidResult.isValid).toBe(false)
      expect(invalidResult.errors).toHaveLength(1)
      expect(invalidResult.errors[0].type).toBe('INVALID_SWAP_PAIR')

      // Invalid amount
      const invalidAmountResult = customValidation!({
        fromToken: 'FLOW',
        toToken: 'USDC',
        amount: '0'
      }, mockValidationContext)

      expect(invalidAmountResult.isValid).toBe(false)
      expect(invalidAmountResult.errors).toHaveLength(1)
      expect(invalidAmountResult.errors[0].type).toBe('INVALID_AMOUNT')

      // Large amount warning
      const largeAmountResult = customValidation!({
        fromToken: 'FLOW',
        toToken: 'USDC',
        amount: '15000'
      }, mockValidationContext)

      expect(largeAmountResult.isValid).toBe(true)
      expect(largeAmountResult.warnings).toHaveLength(1)
    })

    it('should validate stake tokens correctly', () => {
      const stakeAction = {
        ...mockActionMetadata,
        id: 'stake-tokens'
      }
      const enhanced = service.enhanceActionMetadata(stakeAction)
      const customValidation = enhanced.validationRules?.customValidation

      expect(customValidation).toBeDefined()

      // Valid stake
      const validResult = customValidation!({
        amount: '10.0',
        duration: '604800'
      }, mockValidationContext)

      expect(validResult.isValid).toBe(true)

      // Invalid amount
      const invalidAmountResult = customValidation!({
        amount: '0.5',
        duration: '604800'
      }, mockValidationContext)

      expect(invalidAmountResult.isValid).toBe(false)
      expect(invalidAmountResult.errors[0].type).toBe('INSUFFICIENT_STAKE_AMOUNT')

      // Invalid duration
      const invalidDurationResult = customValidation!({
        amount: '10.0',
        duration: '3600'
      }, mockValidationContext)

      expect(invalidDurationResult.isValid).toBe(false)
      expect(invalidDurationResult.errors[0].type).toBe('INSUFFICIENT_DURATION')

      // Long duration warning
      const longDurationResult = customValidation!({
        amount: '10.0',
        duration: '20000000'
      }, mockValidationContext)

      expect(longDurationResult.isValid).toBe(true)
      expect(longDurationResult.warnings).toHaveLength(1)
    })

    it('should validate transfer tokens correctly', () => {
      const transferAction = {
        ...mockActionMetadata,
        id: 'transfer-tokens'
      }
      const enhanced = service.enhanceActionMetadata(transferAction)
      const customValidation = enhanced.validationRules?.customValidation

      expect(customValidation).toBeDefined()

      // Valid transfer
      const validResult = customValidation!({
        recipient: '0x1234567890abcdef',
        amount: '10.0',
        token: 'FLOW'
      }, mockValidationContext)

      expect(validResult.isValid).toBe(true)

      // Invalid address
      const invalidAddressResult = customValidation!({
        recipient: 'invalid-address',
        amount: '10.0',
        token: 'FLOW'
      }, mockValidationContext)

      expect(invalidAddressResult.isValid).toBe(false)
      expect(invalidAddressResult.errors[0].type).toBe('INVALID_ADDRESS_FORMAT')

      // Invalid amount
      const invalidAmountResult = customValidation!({
        recipient: '0x1234567890abcdef',
        amount: '0',
        token: 'FLOW'
      }, mockValidationContext)

      expect(invalidAmountResult.isValid).toBe(false)
      expect(invalidAmountResult.errors[0].type).toBe('INVALID_AMOUNT')

      // Large transfer warning
      const largeTransferResult = customValidation!({
        recipient: '0x1234567890abcdef',
        amount: '5000',
        token: 'FLOW'
      }, mockValidationContext)

      expect(largeTransferResult.isValid).toBe(true)
      expect(largeTransferResult.warnings).toHaveLength(1)
    })
  })

  describe('custom templates', () => {
    it('should allow adding custom validation rule templates', () => {
      const customRules = {
        requiredParameterGroups: [['param1', 'param2']],
        mutuallyExclusive: [],
        conditionalRequirements: []
      }

      service.addValidationRuleTemplate('custom-action', customRules)
      const retrieved = service.getValidationRuleTemplate('custom-action')

      expect(retrieved).toEqual(customRules)
    })

    it('should allow adding custom parameter templates', () => {
      const customParams = [
        {
          name: 'customParam',
          type: ParameterType.STRING,
          value: '',
          required: true,
          validation: {
            required: true,
            type: ParameterType.STRING
          }
        }
      ]

      service.addParameterTemplate('custom-action', customParams)
      const retrieved = service.getParameterTemplate('custom-action')

      expect(retrieved).toEqual(customParams)
    })
  })

  describe('parameter dependencies', () => {
    it('should provide parameter dependencies for swap tokens', () => {
      const enhanced = service.enhanceActionMetadata(mockActionMetadata)

      expect(enhanced.parameterDependencies).toBeDefined()
      expect(enhanced.parameterDependencies).toHaveLength(1)
      expect(enhanced.parameterDependencies?.[0].sourceActionId).toBe('get-balance')
      expect(enhanced.parameterDependencies?.[0].sourceOutputName).toBe('balance')
    })

    it('should provide parameter dependencies for stake tokens', () => {
      const stakeAction = {
        ...mockActionMetadata,
        id: 'stake-tokens'
      }
      const enhanced = service.enhanceActionMetadata(stakeAction)

      expect(enhanced.parameterDependencies).toBeDefined()
      expect(enhanced.parameterDependencies).toHaveLength(1)
      expect(enhanced.parameterDependencies?.[0].sourceActionId).toBe('get-balance')
    })

    it('should return empty dependencies for unknown actions', () => {
      const unknownAction = {
        ...mockActionMetadata,
        id: 'unknown-action'
      }
      const enhanced = service.enhanceActionMetadata(unknownAction)

      expect(enhanced.parameterDependencies).toEqual([])
    })
  })

  describe('constraint generation', () => {
    it('should generate appropriate constraints for Address type', () => {
      const testAction = {
        ...mockActionMetadata,
        id: 'test-action',
        parameters: [
          { name: 'address', type: 'Address', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(testAction)
      const addressParam = enhanced.parameters[0]

      expect(addressParam.validation.constraints?.pattern).toBeDefined()
      expect(addressParam.validation.constraints?.minLength).toBe(18)
      expect(addressParam.validation.constraints?.maxLength).toBe(18)
    })

    it('should generate appropriate constraints for UFix64 type', () => {
      const testAction = {
        ...mockActionMetadata,
        id: 'test-action',
        parameters: [
          { name: 'amount', type: 'UFix64', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(testAction)
      const amountParam = enhanced.parameters[0]

      expect(amountParam.validation.constraints?.min).toBe(0)
      expect(amountParam.validation.constraints?.decimals).toBe(8)
      expect(amountParam.validation.constraints?.max).toBe(Number.MAX_SAFE_INTEGER)
    })

    it('should generate appropriate constraints for String type', () => {
      const testAction = {
        ...mockActionMetadata,
        id: 'test-action',
        parameters: [
          { name: 'text', type: 'String', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(testAction)
      const textParam = enhanced.parameters[0]

      expect(textParam.validation.constraints?.minLength).toBe(1)
      expect(textParam.validation.constraints?.maxLength).toBe(1000)
    })
  })
})