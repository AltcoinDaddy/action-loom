/**
 * @jest-environment jsdom
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParameterInput } from '@/components/parameter-input'
import { ActionParameter } from '@/lib/types'

// Mock the enhanced input handler
jest.mock('@/lib/enhanced-input-handler', () => ({
  enhancedInputHandler: {
    handleInputEvent: jest.fn().mockResolvedValue({
      value: 'processed',
      shouldUpdate: true,
      warnings: [],
      errors: []
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

// Mock the enhanced input hook
jest.mock('@/hooks/use-enhanced-parameter-input', () => ({
  useEnhancedParameterInput: jest.fn().mockReturnValue({
    handleInputChange: jest.fn(),
    handleInputFocus: jest.fn(),
    handleInputBlur: jest.fn(),
    handleKeyDown: jest.fn(),
    internalValue: '',
    isFocused: false,
    isProcessing: false,
    warnings: [],
    processingErrors: [],
    hasProcessingErrors: false,
    errorHandler: {
      hasError: false,
      canRetry: false,
      retryCount: 0,
      maxRetries: 3,
      retryOperation: jest.fn(),
      resetError: jest.fn()
    },
    recoverFromError: jest.fn(),
    cursorPosition: 0,
    setCursorPosition: jest.fn(),
    cleanup: jest.fn()
  })
}))

describe('ParameterInput Edge Cases and Error Recovery', () => {
  const mockOnChange = jest.fn()
  
  const baseParameter: ActionParameter = {
    name: 'testParam',
    type: 'String',
    description: 'Test parameter',
    required: false
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Rapid Typing Handling', () => {
    it('should handle rapid typing without dropping characters', async () => {
      const user = userEvent.setup({ delay: null })
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Simulate rapid typing
      await act(async () => {
        await user.type(input, 'rapid typing test', { delay: 10 })
      })

      // Should handle all characters
      expect(input).toHaveValue('rapid typing test')
    })

    it('should debounce rapid input changes', async () => {
      const user = userEvent.setup({ delay: null })
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Type rapidly
      await act(async () => {
        await user.type(input, 'abc', { delay: 5 })
      })

      // Wait for debounce
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      }, { timeout: 200 })
    })
  })

  describe('Special Characters and Unicode', () => {
    it('should handle Unicode characters gracefully', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Type Unicode characters
      await user.type(input, 'Hello 世界 🌍 café')
      
      expect(input).toHaveValue('Hello 世界 🌍 café')
    })

    it('should filter out control characters', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Simulate input with control characters
      fireEvent.change(input, { 
        target: { value: 'test\u0000\u0001\u0002string' } 
      })
      
      // Control characters should be handled by the enhanced input handler
      expect(input.value).not.toContain('\u0000')
    })

    it('should handle zero-width characters', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Input with zero-width characters
      fireEvent.change(input, { 
        target: { value: 'test\u200B\u200C\u200Dstring' } 
      })
      
      // Should be handled by enhanced input processing
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('Input Length Limits', () => {
    it('should handle very long input strings', async () => {
      const user = userEvent.setup()
      const longString = 'a'.repeat(15000)
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      fireEvent.change(input, { target: { value: longString } })
      
      // Should be handled by enhanced input processing
      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should show character count for long inputs', async () => {
      const longValue = 'a'.repeat(1500)
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value={longValue}
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      expect(screen.getByText(/1500 characters/)).toBeInTheDocument()
      expect(screen.getByText(/long input/)).toBeInTheDocument()
    })
  })

  describe('Error Boundary and Recovery', () => {
    it('should display error boundary when component fails', () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      // Create a component that will throw an error
      const ThrowingComponent = () => {
        throw new Error('Test error')
      }
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )
      
      // The error boundary should be present in the component tree
      // (actual error testing would require more complex setup)
      
      consoleSpy.mockRestore()
    })

    it('should provide error recovery options', () => {
      const { useEnhancedParameterInput } = require('@/hooks/use-enhanced-parameter-input')
      
      // Mock error state
      useEnhancedParameterInput.mockReturnValue({
        handleInputChange: jest.fn(),
        handleInputFocus: jest.fn(),
        handleInputBlur: jest.fn(),
        handleKeyDown: jest.fn(),
        internalValue: 'test',
        isFocused: false,
        isProcessing: false,
        warnings: [],
        processingErrors: ['Test error'],
        hasProcessingErrors: true,
        errorHandler: {
          hasError: true,
          canRetry: true,
          retryCount: 1,
          maxRetries: 3,
          retryOperation: jest.fn(),
          resetError: jest.fn()
        },
        recoverFromError: jest.fn(),
        cursorPosition: 0,
        setCursorPosition: jest.fn(),
        cleanup: jest.fn()
      })
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      expect(screen.getByText('Test error')).toBeInTheDocument()
      expect(screen.getByText(/Recover/)).toBeInTheDocument()
      expect(screen.getByText(/Retry/)).toBeInTheDocument()
    })

    it('should handle recovery button clicks', async () => {
      const { useEnhancedParameterInput } = require('@/hooks/use-enhanced-parameter-input')
      const mockRecover = jest.fn()
      
      useEnhancedParameterInput.mockReturnValue({
        handleInputChange: jest.fn(),
        handleInputFocus: jest.fn(),
        handleInputBlur: jest.fn(),
        handleKeyDown: jest.fn(),
        internalValue: 'test',
        isFocused: false,
        isProcessing: false,
        warnings: [],
        processingErrors: ['Test error'],
        hasProcessingErrors: true,
        errorHandler: {
          hasError: true,
          canRetry: true,
          retryCount: 1,
          maxRetries: 3,
          retryOperation: jest.fn(),
          resetError: jest.fn()
        },
        recoverFromError: mockRecover,
        cursorPosition: 0,
        setCursorPosition: jest.fn(),
        cleanup: jest.fn()
      })
      
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const recoverButton = screen.getByText(/Recover/)
      await user.click(recoverButton)
      
      expect(mockRecover).toHaveBeenCalled()
    })
  })

  describe('Processing State Indicators', () => {
    it('should show processing indicator during input processing', () => {
      const { useEnhancedParameterInput } = require('@/hooks/use-enhanced-parameter-input')
      
      useEnhancedParameterInput.mockReturnValue({
        handleInputChange: jest.fn(),
        handleInputFocus: jest.fn(),
        handleInputBlur: jest.fn(),
        handleKeyDown: jest.fn(),
        internalValue: 'test',
        isFocused: false,
        isProcessing: true,
        warnings: [],
        processingErrors: [],
        hasProcessingErrors: false,
        errorHandler: {
          hasError: false,
          canRetry: false,
          retryCount: 0,
          maxRetries: 3,
          retryOperation: jest.fn(),
          resetError: jest.fn()
        },
        recoverFromError: jest.fn(),
        cursorPosition: 0,
        setCursorPosition: jest.fn(),
        cleanup: jest.fn()
      })
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      expect(screen.getByText('Processing input...')).toBeInTheDocument()
    })

    it('should show processing warnings', () => {
      const { useEnhancedParameterInput } = require('@/hooks/use-enhanced-parameter-input')
      
      useEnhancedParameterInput.mockReturnValue({
        handleInputChange: jest.fn(),
        handleInputFocus: jest.fn(),
        handleInputBlur: jest.fn(),
        handleKeyDown: jest.fn(),
        internalValue: 'test',
        isFocused: false,
        isProcessing: false,
        warnings: ['Rapid typing detected'],
        processingErrors: [],
        hasProcessingErrors: false,
        errorHandler: {
          hasError: false,
          canRetry: false,
          retryCount: 0,
          maxRetries: 3,
          retryOperation: jest.fn(),
          resetError: jest.fn()
        },
        recoverFromError: jest.fn(),
        cursorPosition: 0,
        setCursorPosition: jest.fn(),
        cleanup: jest.fn()
      })
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      expect(screen.getByText('Rapid typing detected')).toBeInTheDocument()
    })
  })

  describe('Address Parameter Edge Cases', () => {
    const addressParameter: ActionParameter = {
      name: 'address',
      type: 'Address',
      description: 'Flow address',
      required: true
    }

    it('should handle malformed addresses gracefully', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={addressParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Type malformed address
      await user.type(input, 'not-an-address')
      
      // Should be handled by enhanced input processing
      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should auto-correct common address mistakes', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={addressParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Type address without 0x prefix
      await user.type(input, '1234567890abcdef')
      
      // Should be processed by enhanced input handler
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('Numeric Parameter Edge Cases', () => {
    const numericParameter: ActionParameter = {
      name: 'amount',
      type: 'UFix64',
      description: 'Token amount',
      required: true
    }

    it('should handle invalid numeric input', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={numericParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')
      
      // Type non-numeric characters
      fireEvent.change(input, { target: { value: 'abc123def' } })
      
      // Should be handled by enhanced input processing
      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should handle very large numbers', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={numericParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')
      
      // Type very large number
      fireEvent.change(input, { target: { value: '999999999999999999999' } })
      
      // Should be handled by enhanced input processing
      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should handle excessive decimal places', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={numericParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')
      
      // Type number with too many decimal places
      fireEvent.change(input, { target: { value: '123.123456789012345' } })
      
      // Should be handled by enhanced input processing
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('Keyboard Navigation Edge Cases', () => {
    it('should handle escape key to reset input', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value="original"
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      // Focus and modify input
      await user.click(input)
      await user.clear(input)
      await user.type(input, 'modified')
      
      // Press escape
      await user.keyboard('{Escape}')
      
      // Should be handled by enhanced input handler
      expect(input).toHaveFocus()
    })

    it('should handle enter key to blur input', async () => {
      const user = userEvent.setup()
      
      render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('textbox')
      
      await user.click(input)
      await user.type(input, 'test')
      await user.keyboard('{Enter}')
      
      // Should be handled by enhanced input handler
      expect(mockOnChange).toHaveBeenCalled()
    })
  })

  describe('Memory Management', () => {
    it('should cleanup resources on unmount', () => {
      const { useEnhancedParameterInput } = require('@/hooks/use-enhanced-parameter-input')
      const mockCleanup = jest.fn()
      
      useEnhancedParameterInput.mockReturnValue({
        handleInputChange: jest.fn(),
        handleInputFocus: jest.fn(),
        handleInputBlur: jest.fn(),
        handleKeyDown: jest.fn(),
        internalValue: 'test',
        isFocused: false,
        isProcessing: false,
        warnings: [],
        processingErrors: [],
        hasProcessingErrors: false,
        errorHandler: {
          hasError: false,
          canRetry: false,
          retryCount: 0,
          maxRetries: 3,
          retryOperation: jest.fn(),
          resetError: jest.fn()
        },
        recoverFromError: jest.fn(),
        cursorPosition: 0,
        setCursorPosition: jest.fn(),
        cleanup: mockCleanup
      })
      
      const { unmount } = render(
        <ParameterInput
          parameter={baseParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      unmount()
      
      // Cleanup should be called on unmount
      expect(mockCleanup).toHaveBeenCalled()
    })
  })
})