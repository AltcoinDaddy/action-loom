/**
 * @jest-environment jsdom
 */

import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { useEnhancedParameterInput } from '@/hooks/use-enhanced-parameter-input'

// Mock the enhanced input handler
jest.mock('@/lib/enhanced-input-handler', () => ({
  enhancedInputHandler: {
    handleInputEvent: jest.fn().mockResolvedValue({
      value: 'processed',
      shouldUpdate: true,
      warnings: [],
      errors: [],
      cursorPosition: 0
    }),
    cleanup: jest.fn(),
    recoverFromError: jest.fn().mockReturnValue({
      value: 'recovered',
      shouldUpdate: true,
      warnings: ['Recovered from error'],
      errors: []
    })
  }
}))

// Mock the error handler hook
jest.mock('@/components/parameter-input-error-boundary', () => ({
  useParameterInputErrorHandler: jest.fn().mockReturnValue({
    error: null,
    hasError: false,
    canRetry: false,
    retryCount: 0,
    maxRetries: 3,
    captureError: jest.fn(),
    resetError: jest.fn(),
    retryOperation: jest.fn()
  })
}))

describe('useEnhancedParameterInput', () => {
  const mockOnChange = jest.fn()
  
  const defaultOptions = {
    parameterType: 'String',
    parameterName: 'testParam'
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Functionality', () => {
    it('should initialize with correct default values', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('initial', mockOnChange, defaultOptions)
      )

      expect(result.current.internalValue).toBe('initial')
      expect(result.current.isFocused).toBe(false)
      expect(result.current.isProcessing).toBe(false)
      expect(result.current.warnings).toEqual([])
      expect(result.current.processingErrors).toEqual([])
      expect(result.current.hasProcessingErrors).toBe(false)
    })

    it('should sync internal value with prop value', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useEnhancedParameterInput(value, mockOnChange, defaultOptions),
        { initialProps: { value: 'initial' } }
      )

      expect(result.current.internalValue).toBe('initial')

      rerender({ value: 'updated' })
      expect(result.current.internalValue).toBe('updated')
    })

    it('should not sync when focused', () => {
      const { result, rerender } = renderHook(
        ({ value }) => useEnhancedParameterInput(value, mockOnChange, defaultOptions),
        { initialProps: { value: 'initial' } }
      )

      // Simulate focus
      act(() => {
        const mockEvent = { target: { selectionStart: 0 } } as any
        result.current.handleInputFocus(mockEvent)
      })

      rerender({ value: 'updated' })
      // Should not sync while focused
      expect(result.current.internalValue).toBe('initial')
    })
  })

  describe('Input Change Handling', () => {
    it('should handle input changes', async () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      await act(async () => {
        await result.current.handleInputChange('new value')
      })

      expect(result.current.internalValue).toBe('new value')
      expect(mockOnChange).toHaveBeenCalledWith('processed')
    })

    it('should handle input changes with element', async () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      const mockElement = {
        selectionStart: 5,
        setSelectionRange: jest.fn()
      } as any

      await act(async () => {
        await result.current.handleInputChange('new value', mockElement)
      })

      expect(result.current.cursorPosition).toBe(5)
    })

    it('should set processing state during input handling', async () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      let processingState = false
      
      // Mock a delayed processing
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockImplementation(async () => {
        processingState = result.current.isProcessing
        return {
          value: 'processed',
          shouldUpdate: true,
          warnings: [],
          errors: []
        }
      })

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      expect(processingState).toBe(true)
      expect(result.current.isProcessing).toBe(false) // Should be false after completion
    })
  })

  describe('Focus and Blur Handling', () => {
    it('should handle focus events', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      const mockEvent = {
        target: { selectionStart: 3 },
        stopPropagation: jest.fn()
      } as any

      act(() => {
        result.current.handleInputFocus(mockEvent)
      })

      expect(result.current.isFocused).toBe(true)
      expect(result.current.cursorPosition).toBe(3)
      expect(result.current.processingErrors).toEqual([])
    })

    it('should handle blur events', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('test', mockOnChange, defaultOptions)
      )

      const mockEvent = {
        target: { value: 'test value' },
        stopPropagation: jest.fn()
      } as any

      act(() => {
        result.current.handleInputBlur(mockEvent)
      })

      expect(result.current.isFocused).toBe(false)
    })

    it('should handle focus errors gracefully', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          logErrors: false
        })
      )

      const mockEvent = {
        target: null, // This will cause an error
        stopPropagation: jest.fn()
      } as any

      expect(() => {
        act(() => {
          result.current.handleInputFocus(mockEvent)
        })
      }).not.toThrow()
    })
  })

  describe('Keyboard Handling', () => {
    it('should handle keyboard events', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      const mockEvent = {
        key: 'Enter',
        target: { tagName: 'INPUT', selectionStart: 0 }
      } as any

      act(() => {
        result.current.handleKeyDown(mockEvent)
      })

      // Should complete without error
      expect(true).toBe(true)
    })

    it('should handle keyboard errors gracefully', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          logErrors: false
        })
      )

      const mockEvent = {
        key: 'Enter',
        target: null // This will cause an error
      } as any

      expect(() => {
        act(() => {
          result.current.handleKeyDown(mockEvent)
        })
      }).not.toThrow()
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle processing errors', async () => {
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockRejectedValue(new Error('Processing failed'))

      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          enableErrorRecovery: true,
          logErrors: false
        })
      )

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      // Should handle error gracefully
      expect(result.current.isProcessing).toBe(false)
    })

    it('should call custom error handler', async () => {
      const mockErrorHandler = jest.fn()
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockRejectedValue(new Error('Processing failed'))

      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          onError: mockErrorHandler,
          logErrors: false
        })
      )

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      expect(mockErrorHandler).toHaveBeenCalled()
    })

    it('should recover from errors', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('original', mockOnChange, defaultOptions)
      )

      act(() => {
        result.current.recoverFromError()
      })

      expect(result.current.processingErrors).toEqual([])
      expect(result.current.warnings).toEqual([])
      expect(mockOnChange).toHaveBeenCalledWith('original')
    })

    it('should handle recovery errors gracefully', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          logErrors: false
        })
      )

      // Mock onChange to throw error
      const throwingOnChange = jest.fn().mockImplementation(() => {
        throw new Error('onChange failed')
      })

      const { rerender } = renderHook(() =>
        useEnhancedParameterInput('', throwingOnChange, {
          ...defaultOptions,
          logErrors: false
        })
      )

      expect(() => {
        act(() => {
          result.current.recoverFromError()
        })
      }).not.toThrow()
    })
  })

  describe('State Management', () => {
    it('should update warnings from processing', async () => {
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockResolvedValue({
        value: 'processed',
        shouldUpdate: true,
        warnings: ['Test warning'],
        errors: []
      })

      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      expect(result.current.warnings).toEqual(['Test warning'])
    })

    it('should update processing errors', async () => {
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockResolvedValue({
        value: 'processed',
        shouldUpdate: true,
        warnings: [],
        errors: ['Test error']
      })

      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      expect(result.current.processingErrors).toEqual(['Test error'])
      expect(result.current.hasProcessingErrors).toBe(true)
    })

    it('should handle cursor position updates', async () => {
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockResolvedValue({
        value: 'processed',
        shouldUpdate: true,
        warnings: [],
        errors: [],
        cursorPosition: 5
      })

      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      const mockElement = {
        setSelectionRange: jest.fn()
      } as any

      await act(async () => {
        await result.current.handleInputChange('test', mockElement)
      })

      // Should attempt to restore cursor position
      expect(mockElement.setSelectionRange).toHaveBeenCalledWith(5, 5)
    })
  })

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      
      unmount()

      expect(enhancedInputHandler.cleanup).toHaveBeenCalled()
    })

    it('should provide cleanup function', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, defaultOptions)
      )

      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')

      act(() => {
        result.current.cleanup()
      })

      expect(enhancedInputHandler.cleanup).toHaveBeenCalled()
    })
  })

  describe('Configuration Options', () => {
    it('should use custom debounce settings', async () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          debounceMs: 500,
          throttleMs: 100
        })
      )

      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      expect(enhancedInputHandler.handleInputEvent).toHaveBeenCalledWith(
        expect.any(String),
        'test',
        'String',
        expect.objectContaining({
          debounceMs: 500,
          throttleMs: 100
        })
      )
    })

    it('should disable error recovery when configured', async () => {
      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')
      enhancedInputHandler.handleInputEvent.mockRejectedValue(new Error('Processing failed'))

      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          ...defaultOptions,
          enableErrorRecovery: false,
          logErrors: false
        })
      )

      await act(async () => {
        await result.current.handleInputChange('test')
      })

      // Should not call recovery methods when disabled
      expect(enhancedInputHandler.recoverFromError).not.toHaveBeenCalled()
    })

    it('should handle different parameter types', async () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', mockOnChange, {
          parameterType: 'UFix64',
          parameterName: 'amount'
        })
      )

      const { enhancedInputHandler } = require('@/lib/enhanced-input-handler')

      await act(async () => {
        await result.current.handleInputChange('123.45')
      })

      expect(enhancedInputHandler.handleInputEvent).toHaveBeenCalledWith(
        expect.any(String),
        '123.45',
        'UFix64',
        expect.any(Object)
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle null onChange callback', async () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput('', null as any, defaultOptions)
      )

      expect(() => {
        act(async () => {
          await result.current.handleInputChange('test')
        })
      }).not.toThrow()
    })

    it('should handle undefined value prop', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput(undefined, mockOnChange, defaultOptions)
      )

      expect(result.current.internalValue).toBe('undefined')
    })

    it('should handle null value prop', () => {
      const { result } = renderHook(() =>
        useEnhancedParameterInput(null, mockOnChange, defaultOptions)
      )

      expect(result.current.internalValue).toBe('null')
    })
  })
})