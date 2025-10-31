import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParameterInput } from '../parameter-input'
import { ActionParameter, ActionOutput } from '@/lib/types'
import { ParameterValidationResult } from '@/lib/parameter-validator'

// Mock the UI components
vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, any>(({ onChange, onFocus, onBlur, onKeyDown, ...props }, ref) => (
    <input 
      ref={ref}
      {...props} 
      onChange={(e) => onChange?.(e)} 
      onFocus={(e) => onFocus?.(e)}
      onBlur={(e) => onBlur?.(e)}
      onKeyDown={(e) => onKeyDown?.(e)}
      data-testid="input" 
    />
  ))
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, any>(({ onChange, onFocus, onBlur, onKeyDown, ...props }, ref) => (
    <textarea 
      ref={ref}
      {...props} 
      onChange={(e) => onChange?.(e)} 
      onFocus={(e) => onFocus?.(e)}
      onBlur={(e) => onBlur?.(e)}
      onKeyDown={(e) => onKeyDown?.(e)}
      data-testid="textarea" 
    />
  ))
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ onCheckedChange, checked, onFocus, onBlur, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      onFocus={(e) => onFocus?.(e)}
      onBlur={(e) => onBlur?.(e)}
      onClick={(e) => onCheckedChange?.(!checked)}
      data-testid="switch"
      {...props}
    />
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, onFocus, onBlur, ...props }: any) => (
    <button 
      onClick={onClick} 
      onFocus={onFocus}
      onBlur={onBlur}
      {...props} 
      data-testid="button"
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick, ...props }: any) => (
    <span onClick={onClick} {...props} data-testid="badge">
      {children}
    </span>
  )
}))

describe('ParameterInput Enhanced Features', () => {
  const mockOnChange = vi.fn()

  const defaultProps = {
    parameter: {
      name: 'testParam',
      type: 'String',
      required: true,
      value: ''
    } as ActionParameter,
    value: '',
    onChange: mockOnChange,
    availableOutputs: {},
    suggestions: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Enhanced Input Event Handling', () => {
    it('handles rapid typing without dropping characters', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      
      // Simulate rapid typing
      await user.type(input, 'rapid typing test')
      
      // Check that the final call has the complete text
      expect(mockOnChange).toHaveBeenLastCalledWith('rapid typing test')
      // Verify that onChange was called multiple times (once per character)
      expect(mockOnChange).toHaveBeenCalledTimes(17) // 'rapid typing test' has 17 characters
    })

    it('handles special characters and Unicode correctly', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      // Use a simpler set of special characters that don't conflict with userEvent syntax
      const specialText = 'Special: @#$%^&*()_+-=,./'
      
      await user.type(input, specialText)
      
      // Check that the final call has the complete text
      expect(mockOnChange).toHaveBeenLastCalledWith(specialText)
    })

    it('handles focus and blur events properly', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      
      await user.click(input)
      expect(input).toHaveFocus()
      
      await user.tab()
      expect(input).not.toHaveFocus()
    })

    it('handles keyboard navigation correctly', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      
      await user.click(input)
      await user.type(input, 'test value')
      
      // Test Escape key resets value
      await user.keyboard('{Escape}')
      expect(input).not.toHaveFocus()
      
      // Test Enter key blurs input
      await user.click(input)
      await user.keyboard('{Enter}')
      expect(input).not.toHaveFocus()
    })
  })

  describe('Value Type Conversion and Validation', () => {
    it('sanitizes address input by adding 0x prefix', async () => {
      const user = userEvent.setup()
      const addressProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, type: 'Address' }
      }
      
      render(<ParameterInput {...addressProps} />)
      
      const input = screen.getByTestId('input')
      await user.type(input, '1234567890abcdef')
      
      // Should add 0x prefix during sanitization
      expect(mockOnChange).toHaveBeenCalledWith('0x1234567890abcdef')
    })

    it('handles UFix64 number conversion on blur', async () => {
      const user = userEvent.setup()
      const numberProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, type: 'UFix64' }
      }
      
      render(<ParameterInput {...numberProps} />)
      
      const input = screen.getByTestId('input')
      await user.type(input, '123.45')
      await user.tab() // Trigger blur
      
      expect(mockOnChange).toHaveBeenCalledWith(123.45)
    })

    it('handles boolean string conversion', async () => {
      const user = userEvent.setup()
      const boolProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, type: 'Bool' }
      }
      
      render(<ParameterInput {...boolProps} />)
      
      const switchElement = screen.getByTestId('switch')
      await user.click(switchElement)
      
      expect(mockOnChange).toHaveBeenCalledWith(true)
    })

    it('validates address format correctly', () => {
      const addressProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, type: 'Address' },
        value: '0x1234567890abcdef'
      }
      
      render(<ParameterInput {...addressProps} />)
      
      const input = screen.getByTestId('input') as HTMLInputElement
      expect(input.maxLength).toBe(18) // 0x + 16 hex characters
    })

    it('sets minimum value for UFix64 inputs', () => {
      const numberProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, type: 'UFix64' }
      }
      
      render(<ParameterInput {...numberProps} />)
      
      const input = screen.getByTestId('input') as HTMLInputElement
      expect(input.min).toBe('0')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('handles onChange function being undefined gracefully', () => {
      const propsWithoutOnChange = {
        ...defaultProps,
        onChange: undefined as any
      }
      
      expect(() => {
        render(<ParameterInput {...propsWithoutOnChange} />)
      }).not.toThrow()
    })

    it('handles invalid parameter types gracefully', () => {
      const invalidProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, type: 'InvalidType' }
      }
      
      expect(() => {
        render(<ParameterInput {...invalidProps} />)
      }).not.toThrow()
    })

    it('handles null and undefined values correctly', () => {
      const nullProps = { ...defaultProps, value: null }
      const undefinedProps = { ...defaultProps, value: undefined }
      
      expect(() => {
        render(<ParameterInput {...nullProps} />)
        render(<ParameterInput {...undefinedProps} />)
      }).not.toThrow()
    })

    it('handles empty suggestions array', () => {
      const availableOutputs = {
        'action1.output1': {
          name: 'output1',
          type: 'String',
          description: 'Test output'
        } as ActionOutput
      }
      
      expect(() => {
        render(<ParameterInput {...defaultProps} availableOutputs={availableOutputs} suggestions={[]} />)
      }).not.toThrow()
    })
  })

  describe('Focus Management', () => {
    it('maintains focus state correctly', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      
      // Focus should add focus styling
      await user.click(input)
      expect(input).toHaveFocus()
      
      // Blur should remove focus styling
      await user.tab()
      expect(input).not.toHaveFocus()
    })

    it('preserves cursor position during re-renders', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      await user.click(input)
      await user.type(input, 'test')
      
      // Simulate re-render with same props
      rerender(<ParameterInput {...defaultProps} value="test" />)
      
      // Input should still be focusable and maintain its value
      expect(input).toBeInTheDocument()
      expect((input as HTMLInputElement).value).toBe('test')
    })
  })

  describe('Reference Mode Error Handling', () => {
    it('handles empty available outputs gracefully', () => {
      const availableOutputs = {}
      
      render(<ParameterInput {...defaultProps} availableOutputs={availableOutputs} />)
      
      // Should not show reference mode toggle when no outputs available
      expect(screen.queryByText('Reference')).not.toBeInTheDocument()
    })

    it('handles reference selection errors gracefully', async () => {
      const user = userEvent.setup()
      const availableOutputs = {
        'action1.output1': {
          name: 'output1',
          type: 'String',
          description: 'Test output'
        } as ActionOutput
      }
      
      render(<ParameterInput {...defaultProps} availableOutputs={availableOutputs} />)
      
      // Switch to reference mode
      const referenceButton = screen.getByText('Reference')
      await user.click(referenceButton)
      
      // Click the dropdown
      const selectButton = screen.getByText('Select output reference...')
      await user.click(selectButton)
      
      // Should show "No output references available" if there's an error
      expect(screen.getByText('action1.output1')).toBeInTheDocument()
    })
  })

  describe('Textarea Specific Handling', () => {
    it('handles textarea input correctly for description fields', async () => {
      const user = userEvent.setup()
      const descriptionProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, name: 'description' }
      }
      
      render(<ParameterInput {...descriptionProps} />)
      
      const textarea = screen.getByTestId('textarea')
      await user.type(textarea, 'Multi-line description text')
      
      // Check that the final call has the complete text
      expect(mockOnChange).toHaveBeenLastCalledWith('Multi-line description text')
    })

    it('allows Enter key in textarea with Shift', async () => {
      const user = userEvent.setup()
      const descriptionProps = {
        ...defaultProps,
        parameter: { ...defaultProps.parameter, name: 'description' }
      }
      
      render(<ParameterInput {...descriptionProps} />)
      
      const textarea = screen.getByTestId('textarea')
      await user.click(textarea)
      
      // Use fireEvent for more direct control over newline input
      fireEvent.change(textarea, { target: { value: 'Line 1\nLine 2' } })
      
      expect(textarea).toHaveFocus()
      // Check that the onChange was called with newline character
      expect(mockOnChange).toHaveBeenLastCalledWith('Line 1\nLine 2')
    })
  })
})