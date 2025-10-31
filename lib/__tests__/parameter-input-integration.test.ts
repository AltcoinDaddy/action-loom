/**
 * Integration tests for Parameter Input with Value Processor
 */

import { describe, it, expect } from 'vitest'
import { ParameterValueProcessor } from '@/lib/parameter-value-processor'
import { ValidationErrorType } from '@/lib/types'

describe('Parameter Input Integration with Value Processor', () => {
  describe('Real-world parameter processing scenarios', () => {
    it('should handle Flow address input with auto-correction', () => {
      // Simulate user typing an address without 0x prefix
      const userInput = '1234567890abcdef'
      const result = ParameterValueProcessor.processValue(userInput, 'Address', { autoCorrect: true })
      
      expect(result.value).toBe('0x1234567890abcdef')
      expect(result.isValid).toBe(true)
      expect(result.wasTransformed).toBe(true)
    })

    it('should handle UFix64 input with decimal precision correction', () => {
      // Simulate user entering too many decimal places
      const userInput = '123.123456789012'
      const result = ParameterValueProcessor.processValue(userInput, 'UFix64')
      
      expect(result.value).toBe(123.12345678)
      expect(result.isValid).toBe(true)
      expect(result.wasTransformed).toBe(true)
    })

    it('should handle boolean input variations', () => {
      const testCases = [
        { input: 'true', expected: true },
        { input: 'True', expected: true },
        { input: '1', expected: true },
        { input: 'yes', expected: true },
        { input: 'false', expected: false },
        { input: 'False', expected: false },
        { input: '0', expected: false },
        { input: 'no', expected: false }
      ]

      testCases.forEach(({ input, expected }) => {
        const result = ParameterValueProcessor.processValue(input, 'Bool')
        expect(result.value).toBe(expected)
        expect(result.isValid).toBe(true)
      })
    })

    it('should provide helpful suggestions for common mistakes', () => {
      // Address without 0x prefix
      const addressSuggestions = ParameterValueProcessor.getSuggestions('1234567890abcdef', 'Address')
      expect(addressSuggestions).toContain('0x1234567890abcdef')

      // UFix64 with invalid characters
      const numberSuggestions = ParameterValueProcessor.getSuggestions('12a3.45b', 'UFix64')
      expect(numberSuggestions).toContain('123.45')

      // Partial boolean input
      const boolSuggestions = ParameterValueProcessor.getSuggestions('t', 'Bool')
      expect(boolSuggestions).toContain('true')
    })

    it('should handle batch validation for workflow parameters', () => {
      const workflowParameters = [
        { value: '0x1234567890abcdef', type: 'Address', name: 'recipient' },
        { value: '100.50', type: 'UFix64', name: 'amount' },
        { value: 'true', type: 'Bool', name: 'includeMetadata' },
        { value: 'Test NFT', type: 'String', name: 'name' }
      ]

      const results = ParameterValueProcessor.validateParameterBatch(workflowParameters)

      expect(results.recipient.isValid).toBe(true)
      expect(results.amount.isValid).toBe(true)
      expect(results.includeMetadata.isValid).toBe(true)
      expect(results.name.isValid).toBe(true)

      // Check converted values
      expect(results.recipient.value).toBe('0x1234567890abcdef')
      expect(results.amount.value).toBe(100.50)
      expect(results.includeMetadata.value).toBe(true)
      expect(results.name.value).toBe('Test NFT')
    })

    it('should handle edge cases gracefully', () => {
      // Empty values
      expect(ParameterValueProcessor.processValue('', 'String').isValid).toBe(true)
      expect(ParameterValueProcessor.processValue(null, 'String').value).toBe('')
      expect(ParameterValueProcessor.processValue(undefined, 'String').value).toBe('')

      // Very large numbers
      const largeNumber = '999999999999999999999'
      const result = ParameterValueProcessor.processValue(largeNumber, 'UFix64')
      expect(result.isValid).toBe(false)
      expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)

      // Invalid address formats
      const invalidAddress = 'not-an-address'
      const addressResult = ParameterValueProcessor.processValue(invalidAddress, 'Address')
      expect(addressResult.isValid).toBe(false)
    })

    it('should preserve user input during typing (partial validation)', () => {
      // Partial address input
      const partialAddress = '0x123456'
      const result = ParameterValueProcessor.validateFlowAddress(partialAddress, { allowPartialInput: true })
      
      expect(result.isValid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('incomplete')
    })

    it('should handle special characters and Unicode in strings', () => {
      const unicodeString = 'Hello 🌍 World! Special chars: @#$%^&*()'
      const result = ParameterValueProcessor.processValue(unicodeString, 'String')
      
      expect(result.isValid).toBe(true)
      expect(result.value).toBe(unicodeString)
    })

    it('should handle array and dictionary parsing', () => {
      // JSON array string
      const arrayString = '["item1", "item2", "item3"]'
      const arrayResult = ParameterValueProcessor.processValue(arrayString, 'Array')
      
      expect(arrayResult.isValid).toBe(true)
      expect(arrayResult.value).toEqual(['item1', 'item2', 'item3'])

      // JSON object string
      const objectString = '{"key1": "value1", "key2": "value2"}'
      const objectResult = ParameterValueProcessor.processValue(objectString, 'Dictionary')
      
      expect(objectResult.isValid).toBe(true)
      expect(objectResult.value).toEqual({ key1: 'value1', key2: 'value2' })
    })

    it('should handle rapid typing scenarios', () => {
      // Simulate rapid typing of an address
      const typingSequence = ['0', '0x', '0x1', '0x12', '0x123', '0x1234567890abcdef']
      
      typingSequence.forEach((input, index) => {
        const result = ParameterValueProcessor.sanitizeInput(input, 'Address', { preserveUserInput: true })
        
        // Should preserve input during typing
        expect(result.value).toBe(input)
        expect(result.isValid).toBe(true)
        
        // Only the complete address should pass full validation
        const fullValidation = ParameterValueProcessor.validateFormat(input, 'Address')
        if (index === typingSequence.length - 1) {
          expect(fullValidation.isValid).toBe(true)
        }
      })
    })
  })

  describe('Error recovery and user experience', () => {
    it('should provide clear error messages for common mistakes', () => {
      // Address too short
      const shortAddress = '0x123'
      const result = ParameterValueProcessor.validateFormat(shortAddress, 'Address')
      
      expect(result.isValid).toBe(false)
      expect(result.errors[0].message).toContain('16 hexadecimal characters')
    })

    it('should handle network connectivity issues gracefully', () => {
      // This would be relevant for future network-dependent validations
      // For now, all validations are local
      const result = ParameterValueProcessor.processValue('0x1234567890abcdef', 'Address')
      expect(result.isValid).toBe(true)
    })

    it('should maintain performance with large datasets', () => {
      // Test batch processing performance
      const largeParameterSet = Array.from({ length: 100 }, (_, i) => ({
        value: `0x${i.toString(16).padStart(16, '0')}`,
        type: 'Address',
        name: `address_${i}`
      }))

      const startTime = Date.now()
      const results = ParameterValueProcessor.validateParameterBatch(largeParameterSet)
      const endTime = Date.now()

      // Should complete within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000)
      
      // All results should be valid
      Object.values(results).forEach(result => {
        expect(result.isValid).toBe(true)
      })
    })
  })
})