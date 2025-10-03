import { describe, it, expect, beforeEach } from 'vitest'
import { EnhancedActionMetadataService } from '../enhanced-action-metadata-service'
import {
  ActionMetadata,
  EnhancedActionMetadata,
  ParameterType,
  SecurityLevel
} from '../types'

describe('Enhanced Action Metadata Integration', () => {
  let service: EnhancedActionMetadataService
  let swapTokensAction: ActionMetadata
  let stakeTokensAction: ActionMetadata
  let transferTokensAction: ActionMetadata

  beforeEach(() => {
    service = new EnhancedActionMetadataService()
    
    // Mock actions similar to those in the API
    swapTokensAction = {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Exchange one token for another using DEX protocols',
      category: 'defi',
      version: '1.0.0',
      inputs: [
        { name: 'fromToken', type: 'String', description: 'Token to swap from' },
        { name: 'toToken', type: 'String', description: 'Token to swap to' },
        { name: 'amount', type: 'UFix64', description: 'Amount to swap' }
      ],
      outputs: [
        { name: 'swappedAmount', type: 'UFix64', description: 'Amount received' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 50000,
      securityLevel: SecurityLevel.MEDIUM,
      author: 'ActionLoom Team',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }

    stakeTokensAction = {
      id: 'stake-tokens',
      name: 'Stake Tokens',
      description: 'Lock tokens to earn rewards',
      category: 'defi',
      version: '1.5.0',
      inputs: [
        { name: 'amount', type: 'UFix64', description: 'Amount to stake' },
        { name: 'duration', type: 'UInt64', description: 'Staking duration in seconds' }
      ],
      outputs: [
        { name: 'stakingId', type: 'UInt64', description: 'Staking position ID' },
        { name: 'expectedReward', type: 'UFix64', description: 'Expected reward amount' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: ['staking'],
        supportedNetworks: ['mainnet'],
        minimumFlowVersion: '1.2.0',
        conflictsWith: []
      },
      gasEstimate: 120000,
      securityLevel: SecurityLevel.HIGH,
      author: 'Flow Staking',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }

    transferTokensAction = {
      id: 'transfer-tokens',
      name: 'Transfer Tokens',
      description: 'Send tokens to another address',
      category: 'token',
      version: '1.0.0',
      inputs: [
        { name: 'recipient', type: 'Address', description: 'Recipient address' },
        { name: 'amount', type: 'UFix64', description: 'Amount to transfer' },
        { name: 'token', type: 'String', description: 'Token type' }
      ],
      outputs: [
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 25000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Core',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  })

  describe('Swap Tokens Integration', () => {
    it('should enhance swap tokens action with complete validation rules', () => {
      const enhanced = service.enhanceActionMetadata(swapTokensAction)

      // Verify basic enhancement
      expect(enhanced.id).toBe('swap-tokens')
      expect(enhanced.name).toBe('Swap Tokens')
      expect(enhanced.validationRules).toBeDefined()
      expect(enhanced.parameterDependencies).toBeDefined()

      // Verify parameters are enhanced
      expect(enhanced.parameters).toHaveLength(3)
      
      const fromTokenParam = enhanced.parameters.find(p => p.name === 'fromToken')
      expect(fromTokenParam).toBeDefined()
      expect(fromTokenParam?.validation.type).toBe(ParameterType.STRING)
      expect(fromTokenParam?.validation.constraints?.enum).toContain('FLOW')
      expect(fromTokenParam?.suggestions).toHaveLength(3)
      expect(fromTokenParam?.defaultValue).toBe('FLOW')

      const toTokenParam = enhanced.parameters.find(p => p.name === 'toToken')
      expect(toTokenParam).toBeDefined()
      expect(toTokenParam?.validation.type).toBe(ParameterType.STRING)
      expect(toTokenParam?.defaultValue).toBe('USDC')

      const amountParam = enhanced.parameters.find(p => p.name === 'amount')
      expect(amountParam).toBeDefined()
      expect(amountParam?.validation.type).toBe(ParameterType.UFIX64)
      expect(amountParam?.validation.constraints?.min).toBe(0.000001)
      expect(amountParam?.validation.constraints?.decimals).toBe(8)

      // Verify validation rules
      expect(enhanced.validationRules?.requiredParameterGroups).toEqual([['fromToken', 'toToken', 'amount']])
      expect(enhanced.validationRules?.conditionalRequirements).toHaveLength(2)
      expect(enhanced.validationRules?.customValidation).toBeDefined()

      // Test custom validation
      const validationResult = enhanced.validationRules?.customValidation?.({
        fromToken: 'FLOW',
        toToken: 'FLOW',
        amount: '10.0'
      }, {} as any)

      expect(validationResult?.isValid).toBe(false)
      expect(validationResult?.errors).toHaveLength(1)
      expect(validationResult?.errors[0].type).toBe('INVALID_SWAP_PAIR')
    })

    it('should provide parameter dependencies for swap tokens', () => {
      const enhanced = service.enhanceActionMetadata(swapTokensAction)

      expect(enhanced.parameterDependencies).toHaveLength(1)
      expect(enhanced.parameterDependencies?.[0].sourceActionId).toBe('get-balance')
      expect(enhanced.parameterDependencies?.[0].sourceOutputName).toBe('balance')
      expect(enhanced.parameterDependencies?.[0].transformFunction).toBeDefined()
    })
  })

  describe('Stake Tokens Integration', () => {
    it('should enhance stake tokens action with complete validation rules', () => {
      const enhanced = service.enhanceActionMetadata(stakeTokensAction)

      // Verify basic enhancement
      expect(enhanced.id).toBe('stake-tokens')
      expect(enhanced.validationRules).toBeDefined()

      // Verify parameters are enhanced
      expect(enhanced.parameters).toHaveLength(2)
      
      const amountParam = enhanced.parameters.find(p => p.name === 'amount')
      expect(amountParam).toBeDefined()
      expect(amountParam?.validation.type).toBe(ParameterType.UFIX64)
      expect(amountParam?.validation.constraints?.min).toBe(1.0)
      expect(amountParam?.defaultValue).toBe('10.0')
      expect(amountParam?.suggestions).toHaveLength(3)

      const durationParam = enhanced.parameters.find(p => p.name === 'duration')
      expect(durationParam).toBeDefined()
      expect(durationParam?.validation.type).toBe(ParameterType.UINT64)
      expect(durationParam?.validation.constraints?.min).toBe(86400)
      expect(durationParam?.defaultValue).toBe('604800')

      // Verify validation rules
      expect(enhanced.validationRules?.requiredParameterGroups).toEqual([['amount', 'duration']])
      expect(enhanced.validationRules?.conditionalRequirements).toHaveLength(2)

      // Test custom validation
      const validationResult = enhanced.validationRules?.customValidation?.({
        amount: '0.5',
        duration: '604800'
      }, {} as any)

      expect(validationResult?.isValid).toBe(false)
      expect(validationResult?.errors).toHaveLength(1)
      expect(validationResult?.errors[0].type).toBe('INSUFFICIENT_STAKE_AMOUNT')
    })
  })

  describe('Transfer Tokens Integration', () => {
    it('should enhance transfer tokens action with complete validation rules', () => {
      const enhanced = service.enhanceActionMetadata(transferTokensAction)

      // Verify basic enhancement
      expect(enhanced.id).toBe('transfer-tokens')
      expect(enhanced.validationRules).toBeDefined()

      // Verify parameters are enhanced
      expect(enhanced.parameters).toHaveLength(3)
      
      const recipientParam = enhanced.parameters.find(p => p.name === 'recipient')
      expect(recipientParam).toBeDefined()
      expect(recipientParam?.validation.type).toBe(ParameterType.ADDRESS)
      expect(recipientParam?.validation.constraints?.pattern).toBeDefined()
      expect(recipientParam?.validation.constraints?.minLength).toBe(18)
      expect(recipientParam?.validation.constraints?.maxLength).toBe(18)

      const amountParam = enhanced.parameters.find(p => p.name === 'amount')
      expect(amountParam).toBeDefined()
      expect(amountParam?.validation.type).toBe(ParameterType.UFIX64)
      expect(amountParam?.defaultValue).toBe('1.0')

      const tokenParam = enhanced.parameters.find(p => p.name === 'token')
      expect(tokenParam).toBeDefined()
      expect(tokenParam?.validation.type).toBe(ParameterType.STRING)
      expect(tokenParam?.defaultValue).toBe('FLOW')

      // Test custom validation
      const validationResult = enhanced.validationRules?.customValidation?.({
        recipient: 'invalid-address',
        amount: '10.0',
        token: 'FLOW'
      }, {} as any)

      expect(validationResult?.isValid).toBe(false)
      expect(validationResult?.errors).toHaveLength(1)
      expect(validationResult?.errors[0].type).toBe('INVALID_ADDRESS_FORMAT')
    })
  })

  describe('Batch Enhancement', () => {
    it('should enhance multiple actions correctly', () => {
      const actions = [swapTokensAction, stakeTokensAction, transferTokensAction]
      const enhanced = actions.map(action => service.enhanceActionMetadata(action))

      expect(enhanced).toHaveLength(3)
      
      // Verify each action is enhanced
      enhanced.forEach(action => {
        expect(action.validationRules).toBeDefined()
        expect(action.parameters.length).toBeGreaterThan(0)
        expect(action.parameters[0].validation).toBeDefined()
      })

      // Verify unique validation rules for each action
      const swapEnhanced = enhanced.find(a => a.id === 'swap-tokens')
      const stakeEnhanced = enhanced.find(a => a.id === 'stake-tokens')
      const transferEnhanced = enhanced.find(a => a.id === 'transfer-tokens')

      expect(swapEnhanced?.validationRules?.requiredParameterGroups).toEqual([['fromToken', 'toToken', 'amount']])
      expect(stakeEnhanced?.validationRules?.requiredParameterGroups).toEqual([['amount', 'duration']])
      expect(transferEnhanced?.validationRules?.requiredParameterGroups).toEqual([['recipient', 'amount', 'token']])
    })
  })

  describe('Custom Templates', () => {
    it('should allow adding custom validation templates', () => {
      const customRules = {
        requiredParameterGroups: [['customParam1', 'customParam2']],
        mutuallyExclusive: [],
        conditionalRequirements: []
      }

      service.addValidationRuleTemplate('custom-action', customRules)

      const customAction = {
        ...swapTokensAction,
        id: 'custom-action',
        name: 'Custom Action'
      }

      const enhanced = service.enhanceActionMetadata(customAction)
      expect(enhanced.validationRules).toEqual(customRules)
    })

    it('should allow adding custom parameter templates', () => {
      const customParams = [
        {
          name: 'customParam',
          type: ParameterType.STRING,
          value: 'default',
          required: true,
          validation: {
            required: true,
            type: ParameterType.STRING
          }
        }
      ]

      service.addParameterTemplate('custom-action', customParams)

      const customAction = {
        ...swapTokensAction,
        id: 'custom-action',
        name: 'Custom Action'
      }

      const enhanced = service.enhanceActionMetadata(customAction)
      expect(enhanced.parameters).toEqual(customParams)
    })
  })

  describe('Error Handling', () => {
    it('should handle actions without existing templates gracefully', () => {
      const unknownAction = {
        ...swapTokensAction,
        id: 'unknown-action',
        name: 'Unknown Action',
        parameters: [
          { name: 'param1', type: 'String', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(unknownAction)

      expect(enhanced.id).toBe('unknown-action')
      expect(enhanced.validationRules).toBeUndefined()
      expect(enhanced.parameters).toHaveLength(1)
      expect(enhanced.parameters[0].validation.type).toBe(ParameterType.STRING)
      expect(enhanced.parameterDependencies).toEqual([])
    })

    it('should handle empty parameters array', () => {
      const emptyAction = {
        ...swapTokensAction,
        id: 'empty-action',
        parameters: []
      }

      const enhanced = service.enhanceActionMetadata(emptyAction)

      expect(enhanced.parameters).toEqual([])
      expect(enhanced.validationRules).toBeUndefined() // No validation rules for unknown action
    })

    it('should handle invalid parameter types', () => {
      const invalidAction = {
        ...swapTokensAction,
        id: 'invalid-action',
        parameters: [
          { name: 'param1', type: 'InvalidType', value: '', required: true }
        ]
      }

      const enhanced = service.enhanceActionMetadata(invalidAction)

      expect(enhanced.parameters).toHaveLength(1)
      expect(enhanced.parameters[0].validation.type).toBe(ParameterType.STRING) // Falls back to STRING
    })
  })
})