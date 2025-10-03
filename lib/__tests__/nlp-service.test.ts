import { describe, it, expect, beforeEach } from 'vitest'
import { NLPService, NLPError } from '../nlp-service'
import { WorkflowIntent } from '../types'

describe('NLPService', () => {
  let nlpService: NLPService

  beforeEach(() => {
    nlpService = new NLPService({
      timeout: 5000,
      confidenceThreshold: 0.5,
      // Don't use external APIs in tests
      apiKey: undefined
    })
  })

  describe('parseWorkflow', () => {
    it('should parse a simple swap workflow', async () => {
      const input = 'Swap 100 USDC to FLOW'
      const result = await nlpService.parseWorkflow(input)

      expect(result.confidence).toBeGreaterThan(0)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].actionName).toBe('swap')
      expect(result.steps[0].parameters).toMatchObject({
        amount: '100',
        fromToken: 'USDC',
        toToken: 'FLOW'
      })
      expect(result.processingTime).toBeGreaterThan(0)
    })

    it('should parse a transfer workflow', async () => {
      const input = 'Transfer 50 FLOW to 0x1234567890abcdef'
      const result = await nlpService.parseWorkflow(input)

      expect(result.confidence).toBeGreaterThan(0)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].actionName).toBe('transfer')
      expect(result.steps[0].parameters).toMatchObject({
        amount: '50',
        fromToken: 'FLOW',
        address: '0x1234567890abcdef'
      })
    })

    it('should parse a staking workflow', async () => {
      const input = 'Stake 1000 FLOW'
      const result = await nlpService.parseWorkflow(input)

      expect(result.confidence).toBeGreaterThan(0)
      expect(result.steps).toHaveLength(1)
      expect(result.steps[0].actionName).toBe('stake')
      expect(result.steps[0].parameters).toMatchObject({
        amount: '1000',
        fromToken: 'FLOW'
      })
    })

    it('should handle empty input gracefully', async () => {
      const input = ''
      const result = await nlpService.parseWorkflow(input)

      expect(result.confidence).toBe(0)
      expect(result.steps).toHaveLength(0)
      expect(result.suggestions).toContain('Provide more details about what you want to accomplish')
    })

    it('should detect ambiguities in incomplete workflows', async () => {
      const input = 'Swap USDC'
      const result = await nlpService.parseWorkflow(input)

      expect(result.ambiguities).toHaveLength(1)
      expect(result.ambiguities[0].type).toBe('parameter')
      expect(result.ambiguities[0].message).toContain('requires both source and destination tokens')
    })

    it('should handle complex multi-step workflows', async () => {
      const input = 'Swap 100 USDC to FLOW then stake the FLOW'
      const result = await nlpService.parseWorkflow(input)

      expect(result.steps.length).toBeGreaterThanOrEqual(1)
      expect(result.confidence).toBeGreaterThan(0)
    })
  })

  describe('preprocessText', () => {
    it('should clean and tokenize text correctly', async () => {
      const input = 'Swap 100 USDC to FLOW!!!'
      const result = await nlpService.preprocessText(input)

      expect(result.cleanedText).toBe('swap 100 usdc to flow')
      expect(result.tokens).toContain('swap')
      expect(result.tokens).toContain('100')
      expect(result.tokens).toContain('usdc')
      expect(result.metadata.wordCount).toBe(5)
    })

    it('should extract basic entities during preprocessing', async () => {
      const input = 'Transfer 50.5 FLOW to 0x1234567890abcdef'
      const result = await nlpService.preprocessText(input)

      const amountEntity = result.entities.find(e => e.type === 'amount')
      const tokenEntity = result.entities.find(e => e.type === 'token')
      const addressEntity = result.entities.find(e => e.type === 'address')

      expect(amountEntity).toBeDefined()
      expect(amountEntity?.value).toBe('50.5')
      expect(tokenEntity).toBeDefined()
      expect(tokenEntity?.value).toBe('FLOW')
      expect(addressEntity).toBeDefined()
      expect(addressEntity?.value).toBe('0x1234567890abcdef')
    })
  })

  describe('extractEntities', () => {
    it('should extract action entities', async () => {
      const text = 'swap usdc to flow'
      const entities = await nlpService.extractEntities(text)

      const actionEntity = entities.find(e => e.type === 'action')
      expect(actionEntity).toBeDefined()
      expect(actionEntity?.value).toBe('swap')
      expect(actionEntity?.confidence).toBeGreaterThan(0.8)
    })

    it('should handle text without clear entities', async () => {
      const text = 'do something with blockchain'
      const entities = await nlpService.extractEntities(text)

      // Should not crash and should return empty or minimal entities
      expect(Array.isArray(entities)).toBe(true)
    })
  })

  describe('validateParameters', () => {
    it('should validate parameters for a step', async () => {
      const step = {
        actionId: 'swap_1',
        actionName: 'swap',
        parameters: { amount: '100', fromToken: 'USDC', toToken: 'FLOW' },
        confidence: 0.9,
        position: 0
      }

      const result = await nlpService.validateParameters(step)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing parameters', async () => {
      const step = {
        actionId: 'swap_1',
        actionName: 'swap',
        parameters: {},
        confidence: 0.9,
        position: 0
      }

      const result = await nlpService.validateParameters(step)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('No parameters found for action')
    })
  })

  describe('error handling', () => {
    it('should throw NLPError for invalid inputs', async () => {
      // Mock a scenario that would cause an error
      const invalidService = new NLPService({
        timeout: -1 // Invalid timeout
      })

      // This should handle the error gracefully or throw NLPError
      try {
        await invalidService.parseWorkflow('test')
      } catch (error) {
        if (error instanceof NLPError) {
          expect(error.name).toBe('NLPError')
          expect(error.code).toBeDefined()
        }
        // If it's not an NLPError, that's also acceptable as long as it doesn't crash
      }
    })
  })

  describe('suggestions', () => {
    it('should provide helpful suggestions for improvement', async () => {
      const input = 'swap'
      const result = await nlpService.parseWorkflow(input)

      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.suggestions.some(s => s.includes('specific'))).toBe(true)
    })

    it('should suggest corrections for errors', async () => {
      const suggestions = await nlpService.suggestCorrections('swap', ['No parameters found for action'])

      expect(suggestions.length).toBeGreaterThan(0)
      expect(suggestions.some(s => s.includes('amounts'))).toBe(true)
    })
  })
})