/**
 * Tests for Parameter Value Processor Utility
 */

import { describe, it, expect } from 'vitest'
import { 
  ParameterValueProcessor, 
  sanitizeParameterInput,
  convertParameterType,
  validateParameterFormat,
  processParameterValue
} from '@/lib/parameter-value-processor'
import { ParameterType, ValidationErrorType } from '@/lib/types'

describe('ParameterValueProcessor', () => {
  describe('sanitizeInput', () => {
    describe('Address sanitization', () => {
      it('should preserve valid addresses', () => {
        const result = ParameterValueProcessor.sanitizeInput('0x1234567890abcdef', 'Address')
        expect(result.value).toBe('0x1234567890abcdef')
        expect(result.isValid).toBe(true)
        expect(result.wasTransformed).toBe(false)
      })

      it('should add 0x prefix to complete hex addresses when auto-correct is enabled', () => {
        const result = ParameterValueProcessor.sanitizeInput('1234567890abcdef', 'Address', { autoCorrect: true })
        expect(result.value).toBe('0x1234567890abcdef')
        expect(result.wasTransformed).toBe(true)
      })

      it('should not add 0x prefix during typing (incomplete addresses)', () => {
        const result = ParameterValueProcessor.sanitizeInput('123456', 'Address')
        expect(result.value).toBe('123456')
        expect(result.wasTransformed).toBe(false)
      })

      it('should handle case correction', () => {
        const result = ParameterValueProcessor.sanitizeInput('0X1234567890ABCDEF', 'Address', { autoCorrect: true })
        expect(result.value).toBe('0x1234567890abcdef')
        expect(result.wasTransformed).toBe(true)
      })

      it('should trim whitespace', () => {
        const result = ParameterValueProcessor.sanitizeInput('  0x1234567890abcdef  ', 'Address')
        expect(result.value).toBe('0x1234567890abcdef')
        expect(result.wasTransformed).toBe(true)
      })
    })

    describe('UFix64 sanitization', () => {
      it('should preserve valid UFix64 numbers', () => {
        const result = ParameterValueProcessor.sanitizeInput('123.45678901', 'UFix64')
        expect(result.value).toBe('123.45678901')
        expect(result.isValid).toBe(true)
      })

      it('should remove invalid characters', () => {
        const result = ParameterValueProcessor.sanitizeInput('12a3.45b', 'UFix64')
        expect(result.value).toBe('123.45')
        expect(result.wasTransformed).toBe(true)
      })

      it('should limit decimal places to 8', () => {
        const result = ParameterValueProcessor.sanitizeInput('123.123456789012', 'UFix64')
        expect(result.value).toBe('123.12345678')
        expect(result.wasTransformed).toBe(true)
      })

      it('should handle multiple decimal points', () => {
        const result = ParameterValueProcessor.sanitizeInput('123.45.67', 'UFix64')
        expect(result.value).toBe('123.4567')
        expect(result.wasTransformed).toBe(true)
      })
    })

    describe('Integer sanitization', () => {
      it('should preserve valid integers', () => {
        const result = ParameterValueProcessor.sanitizeInput('12345', 'Int')
        expect(result.value).toBe('12345')
        expect(result.isValid).toBe(true)
      })

      it('should preserve negative integers for Int type', () => {
        const result = ParameterValueProcessor.sanitizeInput('-12345', 'Int')
        expect(result.value).toBe('-12345')
        expect(result.isValid).toBe(true)
      })

      it('should remove non-digit characters', () => {
        const result = ParameterValueProcessor.sanitizeInput('12a3b4c5', 'Int')
        expect(result.value).toBe('12345')
        expect(result.wasTransformed).toBe(true)
      })

      it('should remove leading zeros', () => {
        const result = ParameterValueProcessor.sanitizeInput('00123', 'Int')
        expect(result.value).toBe('123')
        expect(result.wasTransformed).toBe(true)
      })

      it('should handle UInt64 (no negative)', () => {
        const result = ParameterValueProcessor.sanitizeInput('-123', 'UInt64')
        expect(result.value).toBe('123')
        expect(result.wasTransformed).toBe(true)
      })
    })

    describe('Boolean sanitization', () => {
      it('should convert true values', () => {
        const testValues = ['true', 'True', 'TRUE', '1', 'yes', 'on', 'enabled']
        testValues.forEach(value => {
          const result = ParameterValueProcessor.sanitizeInput(value, 'Bool')
          expect(result.value).toBe('true')
        })
      })

      it('should convert false values', () => {
        const testValues = ['false', 'False', 'FALSE', '0', 'no', 'off', 'disabled']
        testValues.forEach(value => {
          const result = ParameterValueProcessor.sanitizeInput(value, 'Bool')
          expect(result.value).toBe('false')
        })
      })

      it('should preserve unrecognized boolean values', () => {
        const result = ParameterValueProcessor.sanitizeInput('maybe', 'Bool')
        expect(result.value).toBe('maybe')
      })
    })

    describe('String sanitization', () => {
      it('should preserve normal strings', () => {
        const result = ParameterValueProcessor.sanitizeInput('Hello World', 'String')
        expect(result.value).toBe('Hello World')
        expect(result.isValid).toBe(true)
      })

      it('should remove control characters', () => {
        const result = ParameterValueProcessor.sanitizeInput('Hello\x00World\x01', 'String')
        expect(result.value).toBe('HelloWorld')
        expect(result.wasTransformed).toBe(true)
      })

      it('should normalize line endings', () => {
        const result = ParameterValueProcessor.sanitizeInput('Line1\r\nLine2\rLine3', 'String')
        expect(result.value).toBe('Line1\nLine2\nLine3')
        expect(result.wasTransformed).toBe(true)
      })
    })

    describe('Array sanitization', () => {
      it('should preserve valid arrays', () => {
        const input = ['item1', 'item2']
        const result = ParameterValueProcessor.sanitizeInput(input, 'Array')
        expect(result.value).toEqual(['item1', 'item2'])
        expect(result.isValid).toBe(true)
      })

      it('should parse JSON arrays from strings', () => {
        const result = ParameterValueProcessor.sanitizeInput('["item1", "item2"]', 'Array')
        expect(result.value).toEqual(['item1', 'item2'])
        expect(result.wasTransformed).toBe(true)
      })

      it('should split strings by delimiters', () => {
        const result = ParameterValueProcessor.sanitizeInput('item1,item2;item3', 'Array')
        expect(result.value).toEqual(['item1', 'item2', 'item3'])
        expect(result.wasTransformed).toBe(true)
      })

      it('should wrap single values in array', () => {
        const result = ParameterValueProcessor.sanitizeInput('single item', 'Array')
        expect(result.value).toEqual(['single item'])
        expect(result.wasTransformed).toBe(true)
      })
    })

    describe('Dictionary sanitization', () => {
      it('should preserve valid objects', () => {
        const input = { key: 'value' }
        const result = ParameterValueProcessor.sanitizeInput(input, 'Dictionary')
        expect(result.value).toEqual({ key: 'value' })
        expect(result.isValid).toBe(true)
      })

      it('should parse JSON objects from strings', () => {
        const result = ParameterValueProcessor.sanitizeInput('{"key": "value"}', 'Dictionary')
        expect(result.value).toEqual({ key: 'value' })
        expect(result.wasTransformed).toBe(true)
      })

      it('should return empty object for invalid JSON', () => {
        const result = ParameterValueProcessor.sanitizeInput('invalid json', 'Dictionary')
        expect(result.value).toEqual({})
        expect(result.wasTransformed).toBe(true)
      })
    })
  })

  describe('convertType', () => {
    describe('UFix64 conversion', () => {
      it('should convert valid number strings', () => {
        const result = ParameterValueProcessor.convertType('123.456', 'UFix64')
        expect(result.value).toBe(123.456)
        expect(result.isValid).toBe(true)
      })

      it('should reject negative numbers', () => {
        const result = ParameterValueProcessor.convertType('-123.456', 'UFix64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })

      it('should reject values too large', () => {
        const result = ParameterValueProcessor.convertType('999999999999999999999', 'UFix64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })

      it('should handle invalid number strings', () => {
        const result = ParameterValueProcessor.convertType('not a number', 'UFix64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Integer conversion', () => {
      it('should convert valid integer strings', () => {
        const result = ParameterValueProcessor.convertType('12345', 'Int')
        expect(result.value).toBe(12345)
        expect(result.isValid).toBe(true)
      })

      it('should handle negative integers', () => {
        const result = ParameterValueProcessor.convertType('-12345', 'Int')
        expect(result.value).toBe(-12345)
        expect(result.isValid).toBe(true)
      })

      it('should reject negative UInt64', () => {
        const result = ParameterValueProcessor.convertType('-123', 'UInt64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Boolean conversion', () => {
      it('should convert true values', () => {
        const testValues = ['true', '1', 'yes', 'on', 'enabled']
        testValues.forEach(value => {
          const result = ParameterValueProcessor.convertType(value, 'Bool')
          expect(result.value).toBe(true)
          expect(result.isValid).toBe(true)
        })
      })

      it('should convert false values', () => {
        const testValues = ['false', '0', 'no', 'off', 'disabled']
        testValues.forEach(value => {
          const result = ParameterValueProcessor.convertType(value, 'Bool')
          expect(result.value).toBe(false)
          expect(result.isValid).toBe(true)
        })
      })

      it('should reject invalid boolean strings', () => {
        const result = ParameterValueProcessor.convertType('maybe', 'Bool')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Address conversion', () => {
      it('should convert valid addresses', () => {
        const result = ParameterValueProcessor.convertType('0x1234567890abcdef', 'Address', { autoCorrect: true })
        expect(result.value).toBe('0x1234567890abcdef')
        expect(result.isValid).toBe(true)
      })

      it('should reject invalid address format', () => {
        const result = ParameterValueProcessor.convertType('invalid', 'Address')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })
  })

  describe('validateFormat', () => {
    describe('Address validation', () => {
      it('should validate correct Flow addresses', () => {
        const result = ParameterValueProcessor.validateFormat('0x1234567890abcdef', 'Address')
        expect(result.isValid).toBe(true)
      })

      it('should reject addresses without 0x prefix', () => {
        const result = ParameterValueProcessor.validateFormat('1234567890abcdef', 'Address')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.PATTERN_MISMATCH)
      })

      it('should reject addresses with wrong length', () => {
        const result = ParameterValueProcessor.validateFormat('0x123456', 'Address')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.PATTERN_MISMATCH)
      })

      it('should reject non-hex characters', () => {
        const result = ParameterValueProcessor.validateFormat('0x123456789gabcdef', 'Address')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.PATTERN_MISMATCH)
      })

      it('should reject non-string addresses', () => {
        const result = ParameterValueProcessor.validateFormat(123456, 'Address')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('UFix64 validation', () => {
      it('should validate positive numbers', () => {
        const result = ParameterValueProcessor.validateFormat(123.456, 'UFix64')
        expect(result.isValid).toBe(true)
      })

      it('should validate zero', () => {
        const result = ParameterValueProcessor.validateFormat(0, 'UFix64')
        expect(result.isValid).toBe(true)
      })

      it('should reject negative numbers', () => {
        const result = ParameterValueProcessor.validateFormat(-123.456, 'UFix64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.OUT_OF_RANGE)
      })

      it('should reject values too large', () => {
        const result = ParameterValueProcessor.validateFormat(999999999999999999999, 'UFix64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.OUT_OF_RANGE)
      })

      it('should warn about too many decimal places', () => {
        const result = ParameterValueProcessor.validateFormat('123.123456789', 'UFix64')
        expect(result.isValid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
      })

      it('should reject non-numeric values', () => {
        const result = ParameterValueProcessor.validateFormat('not a number', 'UFix64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Integer validation', () => {
      it('should validate integers', () => {
        const result = ParameterValueProcessor.validateFormat(12345, 'Int')
        expect(result.isValid).toBe(true)
      })

      it('should validate negative integers for Int type', () => {
        const result = ParameterValueProcessor.validateFormat(-12345, 'Int')
        expect(result.isValid).toBe(true)
      })

      it('should reject negative integers for UInt64 type', () => {
        const result = ParameterValueProcessor.validateFormat(-12345, 'UInt64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.OUT_OF_RANGE)
      })

      it('should reject decimal numbers', () => {
        const result = ParameterValueProcessor.validateFormat(123.45, 'Int')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })

      it('should reject very large UInt64 values', () => {
        const result = ParameterValueProcessor.validateFormat(Number.MAX_SAFE_INTEGER + 1, 'UInt64')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.OUT_OF_RANGE)
      })
    })

    describe('Boolean validation', () => {
      it('should validate boolean values', () => {
        expect(ParameterValueProcessor.validateFormat(true, 'Bool').isValid).toBe(true)
        expect(ParameterValueProcessor.validateFormat(false, 'Bool').isValid).toBe(true)
      })

      it('should validate boolean strings', () => {
        const validStrings = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off', 'enabled', 'disabled']
        validStrings.forEach(str => {
          const result = ParameterValueProcessor.validateFormat(str, 'Bool')
          expect(result.isValid).toBe(true)
        })
      })

      it('should reject invalid boolean strings', () => {
        const result = ParameterValueProcessor.validateFormat('maybe', 'Bool')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_FORMAT)
      })

      it('should reject non-boolean, non-string values', () => {
        const result = ParameterValueProcessor.validateFormat(123, 'Bool')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('String validation', () => {
      it('should validate normal strings', () => {
        const result = ParameterValueProcessor.validateFormat('Hello World', 'String')
        expect(result.isValid).toBe(true)
      })

      it('should warn about non-string values', () => {
        const result = ParameterValueProcessor.validateFormat(123, 'String')
        expect(result.isValid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
      })

      it('should reject strings with null bytes', () => {
        const result = ParameterValueProcessor.validateFormat('Hello\x00World', 'String')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_FORMAT)
      })
    })

    describe('Array validation', () => {
      it('should validate arrays', () => {
        const result = ParameterValueProcessor.validateFormat(['item1', 'item2'], 'Array')
        expect(result.isValid).toBe(true)
      })

      it('should warn about non-array values', () => {
        const result = ParameterValueProcessor.validateFormat('not an array', 'Array')
        expect(result.isValid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
      })
    })

    describe('Dictionary validation', () => {
      it('should validate objects', () => {
        const result = ParameterValueProcessor.validateFormat({ key: 'value' }, 'Dictionary')
        expect(result.isValid).toBe(true)
      })

      it('should reject arrays', () => {
        const result = ParameterValueProcessor.validateFormat(['not', 'an', 'object'], 'Dictionary')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })

      it('should reject invalid JSON strings', () => {
        const result = ParameterValueProcessor.validateFormat('invalid json', 'Dictionary')
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_FORMAT)
      })
    })
  })

  describe('processValue (comprehensive processing)', () => {
    it('should handle complete processing pipeline for addresses', () => {
      const result = ParameterValueProcessor.processValue('  1234567890abcdef  ', 'Address', { autoCorrect: true })
      expect(result.value).toBe('0x1234567890abcdef')
      expect(result.isValid).toBe(true)
      expect(result.wasTransformed).toBe(true)
    })

    it('should handle complete processing pipeline for UFix64', () => {
      const result = ParameterValueProcessor.processValue('123.456789012', 'UFix64')
      expect(result.value).toBe(123.45678901)
      expect(result.isValid).toBe(true)
      expect(result.wasTransformed).toBe(true)
    })

    it('should accumulate errors from all processing steps', () => {
      const result = ParameterValueProcessor.processValue('invalid', 'Address')
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should preserve original value on processing failure', () => {
      const result = ParameterValueProcessor.processValue('invalid', 'UFix64')
      expect(result.originalValue).toBe('invalid')
      expect(result.isValid).toBe(false)
    })
  })

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined values', () => {
      expect(ParameterValueProcessor.sanitizeInput(null, 'String').value).toBe('')
      expect(ParameterValueProcessor.sanitizeInput(undefined, 'String').value).toBe('')
    })

    it('should handle empty strings', () => {
      const result = ParameterValueProcessor.validateFormat('', 'Address')
      expect(result.isValid).toBe(true) // Empty values are valid (handled by required validation)
    })

    it('should handle unknown parameter types', () => {
      const result = ParameterValueProcessor.sanitizeInput('test', 'UnknownType')
      expect(result.value).toBe('test')
      expect(result.isValid).toBe(true)
    })

    it('should handle processing errors gracefully', () => {
      // Test with a value that might cause processing errors
      const result = ParameterValueProcessor.processValue(Symbol('test'), 'String')
      expect(result.isValid).toBe(true) // Should handle gracefully
    })
  })

  describe('Enhanced validation methods', () => {
    describe('validateFlowAddress', () => {
      it('should validate complete Flow addresses', () => {
        const result = ParameterValueProcessor.validateFlowAddress('0x1234567890abcdef')
        expect(result.isValid).toBe(true)
        expect(result.errors.length).toBe(0)
      })

      it('should allow partial input when enabled', () => {
        const result = ParameterValueProcessor.validateFlowAddress('0x123456', { allowPartialInput: true })
        expect(result.isValid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
      })

      it('should reject partial input when not enabled', () => {
        const result = ParameterValueProcessor.validateFlowAddress('0x123456')
        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
      })

      it('should provide helpful error messages', () => {
        const result = ParameterValueProcessor.validateFlowAddress('1234567890abcdef')
        expect(result.isValid).toBe(false)
        expect(result.warnings.some(w => w.includes('0x'))).toBe(true)
      })
    })

    describe('validateUFix64Precision', () => {
      it('should validate numbers with correct precision', () => {
        const result = ParameterValueProcessor.validateUFix64Precision('123.12345678')
        expect(result.isValid).toBe(true)
        expect(result.warnings.length).toBe(0)
      })

      it('should warn about excessive precision', () => {
        const result = ParameterValueProcessor.validateUFix64Precision('123.123456789')
        expect(result.isValid).toBe(true)
        expect(result.warnings.length).toBeGreaterThan(0)
        expect(result.wasTransformed).toBe(true)
      })

      it('should reject negative numbers', () => {
        const result = ParameterValueProcessor.validateUFix64Precision(-123.456)
        expect(result.isValid).toBe(false)
        expect(result.errors[0].type).toBe(ValidationErrorType.OUT_OF_RANGE)
      })
    })

    describe('validateParameterBatch', () => {
      it('should validate multiple parameters', () => {
        const parameters = [
          { value: '0x1234567890abcdef', type: 'Address', name: 'recipient' },
          { value: '123.456', type: 'UFix64', name: 'amount' },
          { value: 'true', type: 'Bool', name: 'enabled' }
        ]

        const results = ParameterValueProcessor.validateParameterBatch(parameters)
        
        expect(results.recipient.isValid).toBe(true)
        expect(results.amount.isValid).toBe(true)
        expect(results.enabled.isValid).toBe(true)
      })

      it('should handle validation errors in batch', () => {
        const parameters = [
          { value: 'invalid-address', type: 'Address', name: 'recipient' },
          { value: 'not-a-number', type: 'UFix64', name: 'amount' }
        ]

        const results = ParameterValueProcessor.validateParameterBatch(parameters)
        
        expect(results.recipient.isValid).toBe(false)
        expect(results.amount.isValid).toBe(false)
      })
    })

    describe('getSuggestions', () => {
      it('should suggest 0x prefix for addresses', () => {
        const suggestions = ParameterValueProcessor.getSuggestions('1234567890abcdef', 'Address')
        expect(suggestions).toContain('0x1234567890abcdef')
      })

      it('should suggest lowercase for addresses', () => {
        const suggestions = ParameterValueProcessor.getSuggestions('0X1234567890ABCDEF', 'Address')
        expect(suggestions).toContain('0x1234567890abcdef')
      })

      it('should suggest cleaned numbers for UFix64', () => {
        const suggestions = ParameterValueProcessor.getSuggestions('12a3.45b', 'UFix64')
        expect(suggestions).toContain('123.45')
      })

      it('should suggest boolean completions', () => {
        expect(ParameterValueProcessor.getSuggestions('t', 'Bool')).toContain('true')
        expect(ParameterValueProcessor.getSuggestions('f', 'Bool')).toContain('false')
        expect(ParameterValueProcessor.getSuggestions('y', 'Bool')).toContain('yes')
        expect(ParameterValueProcessor.getSuggestions('n', 'Bool')).toContain('no')
      })
    })
  })

  describe('Convenience functions', () => {
    it('should export convenience functions', () => {
      expect(typeof sanitizeParameterInput).toBe('function')
      expect(typeof convertParameterType).toBe('function')
      expect(typeof validateParameterFormat).toBe('function')
      expect(typeof processParameterValue).toBe('function')
    })

    it('should work as convenience functions', () => {
      const result = processParameterValue('123.456', 'UFix64')
      expect(result.value).toBe(123.456)
      expect(result.isValid).toBe(true)
    })
  })
})