import { describe, it, expect } from 'vitest'
import {
  DEFI_VALIDATION_TEMPLATES,
  NFT_VALIDATION_TEMPLATES,
  TOKEN_VALIDATION_TEMPLATES,
  GOVERNANCE_VALIDATION_TEMPLATES,
  PARAMETER_CONSTRAINT_TEMPLATES,
  PARAMETER_SUGGESTION_TEMPLATES,
  getValidationTemplate,
  getConstraintTemplate,
  getSuggestionTemplate,
  createEnhancedParameterWithTemplate
} from '../action-validation-templates'
import { ParameterType } from '../types'

describe('Action Validation Templates', () => {
  describe('DEFI_VALIDATION_TEMPLATES', () => {
    it('should provide token swap validation rules', () => {
      const template = DEFI_VALIDATION_TEMPLATES.TOKEN_SWAP

      expect(template.requiredParameterGroups).toEqual([['fromToken', 'toToken', 'amount']])
      expect(template.conditionalRequirements).toHaveLength(3)
      expect(template.mutuallyExclusive).toEqual([])

      // Test conditional requirements
      const sameTokenCondition = template.conditionalRequirements?.[0]
      expect(sameTokenCondition?.condition({ fromToken: 'FLOW', toToken: 'FLOW' })).toBe(true)
      expect(sameTokenCondition?.condition({ fromToken: 'FLOW', toToken: 'USDC' })).toBe(false)

      const zeroAmountCondition = template.conditionalRequirements?.[1]
      expect(zeroAmountCondition?.condition({ amount: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount: '10.0' })).toBe(false)

      const highSlippageCondition = template.conditionalRequirements?.[2]
      expect(highSlippageCondition?.condition({ slippage: '60' })).toBe(true)
      expect(highSlippageCondition?.condition({ slippage: '5' })).toBe(false)
    })

    it('should provide liquidity pool validation rules', () => {
      const template = DEFI_VALIDATION_TEMPLATES.LIQUIDITY_POOL

      expect(template.requiredParameterGroups).toEqual([['token1', 'token2', 'amount1', 'amount2']])
      expect(template.conditionalRequirements).toHaveLength(2)

      const sameTokenCondition = template.conditionalRequirements?.[0]
      expect(sameTokenCondition?.condition({ token1: 'FLOW', token2: 'FLOW' })).toBe(true)
      expect(sameTokenCondition?.condition({ token1: 'FLOW', token2: 'USDC' })).toBe(false)

      const zeroAmountCondition = template.conditionalRequirements?.[1]
      expect(zeroAmountCondition?.condition({ amount1: '0', amount2: '10' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount1: '10', amount2: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount1: '10', amount2: '20' })).toBe(false)
    })

    it('should provide staking validation rules', () => {
      const template = DEFI_VALIDATION_TEMPLATES.STAKING

      expect(template.requiredParameterGroups).toEqual([['amount', 'duration']])
      expect(template.conditionalRequirements).toHaveLength(3)

      const zeroAmountCondition = template.conditionalRequirements?.[0]
      expect(zeroAmountCondition?.condition({ amount: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount: '10.0' })).toBe(false)

      const shortDurationCondition = template.conditionalRequirements?.[1]
      expect(shortDurationCondition?.condition({ duration: '3600' })).toBe(true)
      expect(shortDurationCondition?.condition({ duration: '86400' })).toBe(false)

      const longDurationCondition = template.conditionalRequirements?.[2]
      expect(longDurationCondition?.condition({ duration: '40000000' })).toBe(true)
      expect(longDurationCondition?.condition({ duration: '86400' })).toBe(false)
    })

    it('should provide lending validation rules', () => {
      const template = DEFI_VALIDATION_TEMPLATES.LENDING

      expect(template.requiredParameterGroups).toEqual([['asset', 'amount']])
      expect(template.mutuallyExclusive).toEqual([['collateralAsset', 'borrowAsset']])
      expect(template.conditionalRequirements).toHaveLength(2)

      const zeroAmountCondition = template.conditionalRequirements?.[0]
      expect(zeroAmountCondition?.condition({ amount: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount: '10.0' })).toBe(false)

      const sameAssetCondition = template.conditionalRequirements?.[1]
      expect(sameAssetCondition?.condition({ collateralAsset: 'FLOW', borrowAsset: 'FLOW' })).toBe(true)
      expect(sameAssetCondition?.condition({ collateralAsset: 'FLOW', borrowAsset: 'USDC' })).toBe(false)
    })
  })

  describe('NFT_VALIDATION_TEMPLATES', () => {
    it('should provide minting validation rules', () => {
      const template = NFT_VALIDATION_TEMPLATES.MINTING

      expect(template.requiredParameterGroups).toEqual([['recipient', 'metadata']])
      expect(template.conditionalRequirements).toHaveLength(2)

      const emptyMetadataCondition = template.conditionalRequirements?.[0]
      expect(emptyMetadataCondition?.condition({ metadata: '' })).toBe(true)
      expect(emptyMetadataCondition?.condition({ metadata: 'https://example.com/metadata' })).toBe(false)

      const invalidURICondition = template.conditionalRequirements?.[1]
      expect(invalidURICondition?.condition({ metadata: 'invalid-uri' })).toBe(true)
      expect(invalidURICondition?.condition({ metadata: 'https://example.com/metadata' })).toBe(false)
    })

    it('should provide transfer validation rules', () => {
      const template = NFT_VALIDATION_TEMPLATES.TRANSFER

      expect(template.requiredParameterGroups).toEqual([['recipient', 'tokenId']])
      expect(template.conditionalRequirements).toHaveLength(1)

      const invalidTokenIdCondition = template.conditionalRequirements?.[0]
      expect(invalidTokenIdCondition?.condition({ tokenId: '0' })).toBe(true)
      expect(invalidTokenIdCondition?.condition({ tokenId: '-1' })).toBe(true)
      expect(invalidTokenIdCondition?.condition({ tokenId: '123' })).toBe(false)
    })

    it('should provide marketplace validation rules', () => {
      const template = NFT_VALIDATION_TEMPLATES.MARKETPLACE

      expect(template.requiredParameterGroups).toEqual([['tokenId', 'price']])
      expect(template.mutuallyExclusive).toEqual([['fixedPrice', 'auctionDuration']])
      expect(template.conditionalRequirements).toHaveLength(2)

      const zeroPriceCondition = template.conditionalRequirements?.[0]
      expect(zeroPriceCondition?.condition({ price: '0' })).toBe(true)
      expect(zeroPriceCondition?.condition({ price: '10.0' })).toBe(false)

      const shortAuctionCondition = template.conditionalRequirements?.[1]
      expect(shortAuctionCondition?.condition({ auctionDuration: '1800' })).toBe(true)
      expect(shortAuctionCondition?.condition({ auctionDuration: '7200' })).toBe(false)
    })
  })

  describe('TOKEN_VALIDATION_TEMPLATES', () => {
    it('should provide transfer validation rules', () => {
      const template = TOKEN_VALIDATION_TEMPLATES.TRANSFER

      expect(template.requiredParameterGroups).toEqual([['recipient', 'amount', 'token']])
      expect(template.conditionalRequirements).toHaveLength(1)

      const zeroAmountCondition = template.conditionalRequirements?.[0]
      expect(zeroAmountCondition?.condition({ amount: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount: '10.0' })).toBe(false)
    })

    it('should provide approval validation rules', () => {
      const template = TOKEN_VALIDATION_TEMPLATES.APPROVAL

      expect(template.requiredParameterGroups).toEqual([['spender', 'amount', 'token']])
      expect(template.conditionalRequirements).toHaveLength(1)

      const negativeAmountCondition = template.conditionalRequirements?.[0]
      expect(negativeAmountCondition?.condition({ amount: '-1' })).toBe(true)
      expect(negativeAmountCondition?.condition({ amount: '0' })).toBe(false)
      expect(negativeAmountCondition?.condition({ amount: '10.0' })).toBe(false)
    })

    it('should provide burn validation rules', () => {
      const template = TOKEN_VALIDATION_TEMPLATES.BURN

      expect(template.requiredParameterGroups).toEqual([['amount', 'token']])
      expect(template.conditionalRequirements).toHaveLength(1)

      const zeroAmountCondition = template.conditionalRequirements?.[0]
      expect(zeroAmountCondition?.condition({ amount: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount: '10.0' })).toBe(false)
    })
  })

  describe('GOVERNANCE_VALIDATION_TEMPLATES', () => {
    it('should provide proposal creation validation rules', () => {
      const template = GOVERNANCE_VALIDATION_TEMPLATES.PROPOSAL_CREATION

      expect(template.requiredParameterGroups).toEqual([['title', 'description', 'votingDuration']])
      expect(template.conditionalRequirements).toHaveLength(3)

      const shortTitleCondition = template.conditionalRequirements?.[0]
      expect(shortTitleCondition?.condition({ title: 'Short' })).toBe(true)
      expect(shortTitleCondition?.condition({ title: 'This is a long enough title' })).toBe(false)

      const shortDescriptionCondition = template.conditionalRequirements?.[1]
      expect(shortDescriptionCondition?.condition({ description: 'Short description' })).toBe(true)
      expect(shortDescriptionCondition?.condition({ 
        description: 'This is a very long description that meets the minimum requirement of fifty characters' 
      })).toBe(false)

      const shortDurationCondition = template.conditionalRequirements?.[2]
      expect(shortDurationCondition?.condition({ votingDuration: '3600' })).toBe(true)
      expect(shortDurationCondition?.condition({ votingDuration: '86400' })).toBe(false)
    })

    it('should provide voting validation rules', () => {
      const template = GOVERNANCE_VALIDATION_TEMPLATES.VOTING

      expect(template.requiredParameterGroups).toEqual([['proposalId', 'vote']])
      expect(template.conditionalRequirements).toHaveLength(2)

      const invalidProposalIdCondition = template.conditionalRequirements?.[0]
      expect(invalidProposalIdCondition?.condition({ proposalId: '0' })).toBe(true)
      expect(invalidProposalIdCondition?.condition({ proposalId: '123' })).toBe(false)

      const invalidVoteCondition = template.conditionalRequirements?.[1]
      expect(invalidVoteCondition?.condition({ vote: true })).toBe(false)
      expect(invalidVoteCondition?.condition({ vote: false })).toBe(false)
      expect(invalidVoteCondition?.condition({ vote: 'yes' })).toBe(false)
      expect(invalidVoteCondition?.condition({ vote: 'no' })).toBe(false)
      expect(invalidVoteCondition?.condition({ vote: 'maybe' })).toBe(true)
    })

    it('should provide delegation validation rules', () => {
      const template = GOVERNANCE_VALIDATION_TEMPLATES.DELEGATION

      expect(template.requiredParameterGroups).toEqual([['delegate', 'amount']])
      expect(template.conditionalRequirements).toHaveLength(1)

      const zeroAmountCondition = template.conditionalRequirements?.[0]
      expect(zeroAmountCondition?.condition({ amount: '0' })).toBe(true)
      expect(zeroAmountCondition?.condition({ amount: '10.0' })).toBe(false)
    })
  })

  describe('PARAMETER_CONSTRAINT_TEMPLATES', () => {
    it('should provide Flow address constraints', () => {
      const constraints = PARAMETER_CONSTRAINT_TEMPLATES.FLOW_ADDRESS

      expect(constraints.pattern).toBeDefined()
      expect(constraints.minLength).toBe(18)
      expect(constraints.maxLength).toBe(18)
      expect(constraints.pattern?.test('0x1234567890abcdef')).toBe(true)
      expect(constraints.pattern?.test('invalid-address')).toBe(false)
    })

    it('should provide token amount constraints', () => {
      const constraints = PARAMETER_CONSTRAINT_TEMPLATES.TOKEN_AMOUNT

      expect(constraints.min).toBe(0.000001)
      expect(constraints.max).toBe(1000000000)
      expect(constraints.decimals).toBe(8)
    })

    it('should provide duration constraints', () => {
      const constraints = PARAMETER_CONSTRAINT_TEMPLATES.DURATION

      expect(constraints.min).toBe(60)
      expect(constraints.max).toBe(31536000)
    })

    it('should provide percentage constraints', () => {
      const constraints = PARAMETER_CONSTRAINT_TEMPLATES.PERCENTAGE

      expect(constraints.min).toBe(0)
      expect(constraints.max).toBe(100)
      expect(constraints.decimals).toBe(2)
    })

    it('should provide token symbol constraints', () => {
      const constraints = PARAMETER_CONSTRAINT_TEMPLATES.TOKEN_SYMBOL

      expect(constraints.minLength).toBe(1)
      expect(constraints.maxLength).toBe(10)
      expect(constraints.pattern?.test('FLOW')).toBe(true)
      expect(constraints.pattern?.test('USDC')).toBe(true)
      expect(constraints.pattern?.test('flow')).toBe(false)
      expect(constraints.pattern?.test('123')).toBe(false)
    })

    it('should provide URI constraints', () => {
      const constraints = PARAMETER_CONSTRAINT_TEMPLATES.URI

      expect(constraints.minLength).toBe(1)
      expect(constraints.maxLength).toBe(2048)
      expect(constraints.pattern?.test('https://example.com')).toBe(true)
      expect(constraints.pattern?.test('http://example.com')).toBe(true)
      expect(constraints.pattern?.test('ftp://example.com')).toBe(false)
    })
  })

  describe('PARAMETER_SUGGESTION_TEMPLATES', () => {
    it('should provide Flow token suggestions', () => {
      const suggestions = PARAMETER_SUGGESTION_TEMPLATES.FLOW_TOKENS

      expect(suggestions).toHaveLength(5)
      expect(suggestions[0].value).toBe('FLOW')
      expect(suggestions[0].category).toBe('native')
      expect(suggestions[1].value).toBe('USDC')
      expect(suggestions[1].category).toBe('stablecoin')
    })

    it('should provide common amount suggestions', () => {
      const suggestions = PARAMETER_SUGGESTION_TEMPLATES.COMMON_AMOUNTS

      expect(suggestions).toHaveLength(4)
      expect(suggestions[0].value).toBe('1.0')
      expect(suggestions[3].value).toBe('1000.0')
      expect(suggestions[3].category).toBe('large')
    })

    it('should provide common duration suggestions', () => {
      const suggestions = PARAMETER_SUGGESTION_TEMPLATES.COMMON_DURATIONS

      expect(suggestions).toHaveLength(5)
      expect(suggestions[0].value).toBe('3600')
      expect(suggestions[0].label).toBe('1 Hour')
      expect(suggestions[4].value).toBe('7776000')
      expect(suggestions[4].label).toBe('90 Days')
    })

    it('should provide test address suggestions', () => {
      const suggestions = PARAMETER_SUGGESTION_TEMPLATES.TEST_ADDRESSES

      expect(suggestions).toHaveLength(3)
      expect(suggestions[0].value).toBe('0x1234567890abcdef')
      expect(suggestions[0].category).toBe('test')
    })
  })

  describe('utility functions', () => {
    it('should get validation template by category and type', () => {
      const swapTemplate = getValidationTemplate('defi', 'token_swap')
      expect(swapTemplate).toBeDefined()
      expect(swapTemplate?.requiredParameterGroups).toEqual([['fromToken', 'toToken', 'amount']])

      const mintTemplate = getValidationTemplate('nft', 'minting')
      expect(mintTemplate).toBeDefined()
      expect(mintTemplate?.requiredParameterGroups).toEqual([['recipient', 'metadata']])

      const unknownTemplate = getValidationTemplate('unknown', 'unknown')
      expect(unknownTemplate).toBeUndefined()
    })

    it('should get constraint template by type', () => {
      const addressConstraints = getConstraintTemplate('flow_address')
      expect(addressConstraints).toBeDefined()
      expect(addressConstraints?.minLength).toBe(18)

      const amountConstraints = getConstraintTemplate('token_amount')
      expect(amountConstraints).toBeDefined()
      expect(amountConstraints?.decimals).toBe(8)

      const unknownConstraints = getConstraintTemplate('unknown')
      expect(unknownConstraints).toBeUndefined()
    })

    it('should get suggestion template by type', () => {
      const tokenSuggestions = getSuggestionTemplate('flow_tokens')
      expect(tokenSuggestions).toBeDefined()
      expect(tokenSuggestions).toHaveLength(5)

      const amountSuggestions = getSuggestionTemplate('common_amounts')
      expect(amountSuggestions).toBeDefined()
      expect(amountSuggestions).toHaveLength(4)

      const unknownSuggestions = getSuggestionTemplate('unknown')
      expect(unknownSuggestions).toBeUndefined()
    })

    it('should create enhanced parameter with template', () => {
      const parameter = createEnhancedParameterWithTemplate(
        'recipient',
        ParameterType.ADDRESS,
        true,
        'flow_address',
        'test_addresses'
      )

      expect(parameter.name).toBe('recipient')
      expect(parameter.type).toBe(ParameterType.ADDRESS)
      expect(parameter.required).toBe(true)
      expect(parameter.validation.constraints?.minLength).toBe(18)
      expect(parameter.suggestions).toHaveLength(3)
      expect(parameter.defaultValue).toBe('')
    })

    it('should create enhanced parameter without templates', () => {
      const parameter = createEnhancedParameterWithTemplate(
        'amount',
        ParameterType.UFIX64,
        true
      )

      expect(parameter.name).toBe('amount')
      expect(parameter.type).toBe(ParameterType.UFIX64)
      expect(parameter.required).toBe(true)
      expect(parameter.validation.constraints).toBeUndefined()
      expect(parameter.suggestions).toEqual([])
      expect(parameter.defaultValue).toBe('0.0')
    })
  })
})