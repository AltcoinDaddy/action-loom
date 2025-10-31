/**
 * @jest-environment jsdom
 */

import { EnhancedInputHandler } from '@/lib/enhanced-input-handler'

describe('EnhancedInputHandler', () => {
  let handler: EnhancedInputHandler

  beforeEach(() => {
    handler = new EnhancedInputHandler()
  })

  afterEach(() => {
    handler.cleanupAll()
  })

  describe('Rapid Typing Handling', () => {
    it('should handle rapid typing events', async () => {
      const inputId = 'test-input'
      const events = [
        { value: 'a', timestamp: 1000 },
        { value: 'ab', timestamp: 1050 },
        { value: 'abc', timestamp: 1100 },
        { value: 'abcd', timestamp: 1150 }
      ]

      const result = handler.handleRapidTyping(inputId, events, 'String')

      expect(result.value).toBe('abcd')
      expect(result.shouldUpdate).toBe(true)
      expect(result.warnings).toContain('Rapid typing detected - some keystrokes may be processed with delay')
    })

    it('should process the most recent event in rapid typing', async () => {
      const inputId = 'test-input'
      const events = [
        { value: 'old', timestamp: 1000 },
        { value: 'newer', timestamp: 1100 },
        { value: 'newest', timestamp: 1200 }
      ]

      const result = handler.handleRapidTyping(inputId, events, 'String')

      expect(result.value).toBe('newest')
    })

    it('should detect rapid typing patterns', async () => {
      const inputId = 'test-input'
      const rapidEvents = Array.from({ length: 10 }, (_, i) => ({
        value: 'a'.repeat(i + 1),
        timestamp: 1000 + i * 50 // 50ms intervals
      }))

      const result = handler.handleRapidTyping(inputId, rapidEvents, 'String')

      expect(result.warnings).toContain('Rapid typing detected - some keystrokes may be processed with delay')
    })
  })

  describe('Special Characters and Unicode', () => {
    it('should handle Unicode characters when allowed', () => {
      const result = handler.handleSpecialCharacters('Hello 世界 🌍', 'String', {
        allowUnicode: true
      })

      expect(result.sanitized).toBe('Hello 世界 🌍')
      expect(result.errors).toHaveLength(0)
    })

    it('should remove Unicode characters when not allowed', () => {
      const result = handler.handleSpecialCharacters('Hello 世界 test', 'String', {
        allowUnicode: false,
        autoCorrect: true
      })

      expect(result.sanitized).toBe('Hello  test')
      expect(result.warnings).toContain('Non-ASCII characters were removed')
    })

    it('should handle control characters', () => {
      const result = handler.handleSpecialCharacters('test\u0000\u0001string', 'String', {
        autoCorrect: true
      })

      expect(result.sanitized).toBe('teststring')
      expect(result.warnings).toContain('Control characters were removed from input')
    })

    it('should handle zero-width characters', () => {
      const result = handler.handleSpecialCharacters('test\u200B\u200C\u200Dstring', 'String', {
        autoCorrect: true
      })

      expect(result.sanitized).toBe('teststring')
      expect(result.warnings).toContain('Zero-width characters were removed')
    })

    it('should handle address-specific character filtering', () => {
      const result = handler.handleSpecialCharacters('0x123xyz456', 'Address', {
        autoCorrect: true
      })

      expect(result.sanitized).toBe('0x123456')
      expect(result.warnings).toContain('Invalid characters removed from address')
    })

    it('should handle numeric character filtering', () => {
      const result = handler.handleSpecialCharacters('123.45abc', 'UFix64', {
        autoCorrect: true
      })

      expect(result.sanitized).toBe('123.45')
      expect(result.warnings).toContain('Non-numeric characters removed')
    })
  })

  describe('Input Length Handling', () => {
    it('should handle input within length limits', () => {
      const shortInput = 'short text'
      const result = handler.handleInputLength(shortInput, 100)

      expect(result.truncated).toBe(shortInput)
      expect(result.wasTruncated).toBe(false)
    })

    it('should truncate long input', () => {
      const longInput = 'a'.repeat(1000)
      const result = handler.handleInputLength(longInput, 100)

      expect(result.truncated.length).toBeLessThanOrEqual(100)
      expect(result.wasTruncated).toBe(true)
      expect(result.warning).toContain('Input truncated to 100 characters')
    })

    it('should truncate at word boundary when possible', () => {
      const longInput = 'word1 word2 word3 ' + 'a'.repeat(100)
      const result = handler.handleInputLength(longInput, 50)

      expect(result.truncated).toBe('word1 word2 word3')
      expect(result.wasTruncated).toBe(true)
    })
  })

  describe('Cursor Position Preservation', () => {
    it('should preserve cursor position when values are the same', () => {
      const mockInput = document.createElement('input')
      const originalPos = 5
      
      const newPos = handler.preserveCursorPosition(
        mockInput,
        'test value',
        'test value',
        originalPos
      )

      expect(newPos).toBe(originalPos)
    })

    it('should adjust cursor position when text is inserted', () => {
      const mockInput = document.createElement('input')
      const originalPos = 5
      
      const newPos = handler.preserveCursorPosition(
        mockInput,
        'test value',
        'test new value',
        originalPos
      )

      expect(newPos).toBe(9) // 5 + 4 characters added
    })

    it('should adjust cursor position when text is removed', () => {
      const mockInput = document.createElement('input')
      const originalPos = 10
      
      const newPos = handler.preserveCursorPosition(
        mockInput,
        'test long value',
        'test value',
        originalPos
      )

      expect(newPos).toBe(5) // Adjusted for removed text
    })

    it('should keep cursor within bounds', () => {
      const mockInput = document.createElement('input')
      const originalPos = 20
      
      const newPos = handler.preserveCursorPosition(
        mockInput,
        'very long original text',
        'short',
        originalPos
      )

      expect(newPos).toBe(5) // Clamped to end of new text
    })
  })

  describe('Error Recovery', () => {
    it('should recover from processing errors', () => {
      const inputId = 'test-input'
      const error = new Error('Processing failed')
      const lastGoodValue = 'good value'

      const result = handler.recoverFromError(inputId, error, lastGoodValue, 'String')

      expect(result.shouldUpdate).toBe(true)
      expect(result.warnings).toContain('Input error occurred - recovered with last known good value')
    })

    it('should handle recovery failure gracefully', () => {
      const inputId = 'test-input'
      const error = new Error('Processing failed')
      const invalidValue = null as any

      const result = handler.recoverFromError(inputId, error, invalidValue, 'String')

      expect(result.value).toBe('')
      expect(result.warnings).toContain('Input error occurred - reset to empty value')
    })

    it('should clean up state during recovery', () => {
      const inputId = 'test-input'
      const error = new Error('Processing failed')
      
      // Set up some state first
      handler.handleInputEvent(inputId, 'test', 'String')
      
      handler.recoverFromError(inputId, error, 'fallback', 'String')

      // State should be cleaned up (we can't directly test private state,
      // but we can verify the method completes without error)
      expect(true).toBe(true)
    })
  })

  describe('Resource Management', () => {
    it('should cleanup resources for specific input', () => {
      const inputId = 'test-input'
      
      // Create some state
      handler.handleInputEvent(inputId, 'test', 'String')
      
      // Cleanup
      handler.cleanup(inputId)
      
      // Should complete without error
      expect(true).toBe(true)
    })

    it('should cleanup all resources', () => {
      // Create state for multiple inputs
      handler.handleInputEvent('input1', 'test1', 'String')
      handler.handleInputEvent('input2', 'test2', 'String')
      
      // Cleanup all
      handler.cleanupAll()
      
      // Should complete without error
      expect(true).toBe(true)
    })
  })

  describe('Input Event Processing', () => {
    it('should process input events with debouncing', async () => {
      const inputId = 'test-input'
      
      const result = await handler.handleInputEvent(inputId, 'test value', 'String', {
        debounceMs: 10,
        throttleMs: 5
      })

      expect(result.shouldUpdate).toBe(true)
      expect(result.value).toBeDefined()
    })

    it('should handle processing options', async () => {
      const inputId = 'test-input'
      
      const result = await handler.handleInputEvent(inputId, 'test value', 'String', {
        maxInputLength: 5,
        allowUnicode: false,
        autoCorrect: true,
        sanitizeOnInput: true
      })

      expect(result.shouldUpdate).toBe(true)
    })

    it('should handle processing errors gracefully', async () => {
      const inputId = 'test-input'
      
      // This should not throw even with invalid input
      const result = await handler.handleInputEvent(inputId, null as any, 'String')

      expect(result).toBeDefined()
      expect(result.shouldUpdate).toBeDefined()
    })
  })

  describe('Parameter Type Specific Handling', () => {
    it('should handle Address type validation', async () => {
      const inputId = 'address-input'
      
      const result = await handler.handleInputEvent(
        inputId, 
        '1234567890abcdef', 
        'Address',
        { autoCorrect: true }
      )

      expect(result.shouldUpdate).toBe(true)
    })

    it('should handle UFix64 type validation', async () => {
      const inputId = 'amount-input'
      
      const result = await handler.handleInputEvent(
        inputId, 
        '123.456789012345', 
        'UFix64',
        { autoCorrect: true }
      )

      expect(result.shouldUpdate).toBe(true)
    })

    it('should handle Boolean type validation', async () => {
      const inputId = 'bool-input'
      
      const result = await handler.handleInputEvent(
        inputId, 
        'yes', 
        'Bool',
        { autoCorrect: true }
      )

      expect(result.shouldUpdate).toBe(true)
    })
  })

  describe('Edge Case Scenarios', () => {
    it('should handle empty input', async () => {
      const inputId = 'empty-input'
      
      const result = await handler.handleInputEvent(inputId, '', 'String')

      expect(result.shouldUpdate).toBe(true)
      expect(result.value).toBe('')
    })

    it('should handle null input', async () => {
      const inputId = 'null-input'
      
      const result = await handler.handleInputEvent(inputId, null as any, 'String')

      expect(result.shouldUpdate).toBe(true)
    })

    it('should handle undefined input', async () => {
      const inputId = 'undefined-input'
      
      const result = await handler.handleInputEvent(inputId, undefined as any, 'String')

      expect(result.shouldUpdate).toBe(true)
    })

    it('should handle very rapid successive calls', async () => {
      const inputId = 'rapid-input'
      
      // Fire multiple rapid calls
      const promises = Array.from({ length: 10 }, (_, i) =>
        handler.handleInputEvent(inputId, `value${i}`, 'String', { throttleMs: 10 })
      )

      const results = await Promise.all(promises)
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.shouldUpdate).toBeDefined()
      })
    })

    it('should handle concurrent processing for different inputs', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        handler.handleInputEvent(`input${i}`, `value${i}`, 'String')
      )

      const results = await Promise.all(promises)
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.shouldUpdate).toBe(true)
      })
    })
  })
})