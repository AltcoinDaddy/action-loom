import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ParameterInput } from '../parameter-input'
import { ActionParameter } from '@/lib/types'
import { ParameterValidationResult } from '@/lib/parameter-validator'

// Mock the parameter value processor
vi.mock('@/lib/parameter-value-processor', () => ({
  ParameterValueProcessor: {
    sanitizeInput: vi.fn((value, type) => ({
      value,
      isValid: true,
      errors: [],
      warnings: []
    })),
    processValue: vi.fn((value, type) => ({
      value,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false
    })),
    convertType: vi.fn((value, type) => ({
      value,
      isValid: true,
      errors: []
    }))
  }
}))

describe('ParameterInput Enhanced Visual Feedback', () => {
  const mockOnChange = vi.fn()
  
  const baseParameter: ActionParameter = {
    name: 'testParam',
    type: 'String',
    description: 'Test parameter'
  }

  const baseProps = {
    parameter: baseParameter,
    value: '',
    onChange: mockOnChange,
    availableOutputs: {},
    suggestions: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Focus State Styling', () => {
    it('should apply enhanced focus styling to text input', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...baseProps} />)
      
      const input = screen.getByRole('textbox')
      await user.click(input)
      
      expect(input).toHaveClass('input-focus-enhanced')
      expect(input).toHaveClass('input-state-transition')
    })

    it('should apply focus ring enhancement to switch input', async () => {
      const user = userEvent.setup()
      const booleanParam: ActionParameter = {
        ...baseParameter,
        type: 'Bool'
      }
      
      render(<ParameterInput {...baseProps} parameter={booleanParam} />)
      
      const switchElement = screen.getByRole('switch')
      await user.click(switchElement)
      
      expect(switchElement).toHaveClass('focus-ring-enhanced')
    })

    it('should apply interactive hover effects to buttons', () => {
      render(
        <ParameterInput 
          {...baseProps} 
          availableOutputs={{ 'test.output': { type: 'String', description: 'Test output' } }}
        />
      )
      
      const directInputButton = screen.getByText('Direct Input')
      const referenceButton = screen.getByText('Reference')
      
      expect(directInputButton).toHaveClass('interactive-hover')
      expect(referenceButton).toHaveClass('interactive-hover')
    })
  })

  describe('Error State Styling', () => {
    it('should apply error styling and animations for validation failures', () => {
      const errorValidation: ParameterValidationResult = {
        isValid: false,
        errors: [{ message: 'Invalid input', field: 'testParam' }],
        warnings: []
      }
      
      render(<ParameterInput {...baseProps} validation={errorValidation} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('input-error-glow')
      expect(input).toHaveClass('input-error-shake')
      
      // Check for error icon with animation
      const errorIcon = screen.getByRole('img', { hidden: true })
      expect(errorIcon).toHaveClass('animate-pulse')
    })

    it('should display error messages with proper styling', () => {
      const errorValidation: ParameterValidationResult = {
        isValid: false,
        errors: [{ message: 'This field is required', field: 'testParam' }],
        warnings: []
      }
      
      render(<ParameterInput {...baseProps} validation={errorValidation} />)
      
      const errorMessage = screen.getByText('This field is required')
      expect(errorMessage).toHaveClass('text-destructive')
      expect(errorMessage.closest('[role="alert"]')).toBeInTheDocument()
    })

    it('should apply error styling to switch components', () => {
      const booleanParam: ActionParameter = {
        ...baseParameter,
        type: 'Bool'
      }
      
      const errorValidation: ParameterValidationResult = {
        isValid: false,
        errors: [{ message: 'Invalid boolean value', field: 'testParam' }],
        warnings: []
      }
      
      render(
        <ParameterInput 
          {...baseProps} 
          parameter={booleanParam} 
          validation={errorValidation} 
        />
      )
      
      const switchElement = screen.getByRole('switch')
      expect(switchElement).toHaveClass('input-error-glow')
    })
  })

  describe('Warning State Styling', () => {
    it('should apply warning styling for validation warnings', () => {
      const warningValidation: ParameterValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['This value might be too large']
      }
      
      render(<ParameterInput {...baseProps} validation={warningValidation} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('input-warning-glow')
      
      // Check for warning icon with animation
      const warningIcon = screen.getByRole('img', { hidden: true })
      expect(warningIcon).toHaveClass('animate-bounce')
    })

    it('should display warning messages with proper styling', () => {
      const warningValidation: ParameterValidationResult = {
        isValid: true,
        errors: [],
        warnings: ['Consider using a smaller value']
      }
      
      render(<ParameterInput {...baseProps} validation={warningValidation} />)
      
      const warningMessage = screen.getByText('Consider using a smaller value')
      expect(warningMessage).toHaveClass('text-yellow-600')
      expect(warningMessage.closest('[role="alert"]')).toBeInTheDocument()
    })
  })

  describe('Success State Styling', () => {
    it('should apply success styling for valid inputs with values', () => {
      const successValidation: ParameterValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      }
      
      render(
        <ParameterInput 
          {...baseProps} 
          value="valid input" 
          validation={successValidation} 
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('input-success-glow')
      
      // Check for success icon
      const successIcon = screen.getByRole('img', { hidden: true })
      expect(successIcon).toHaveClass('text-green-500')
    })

    it('should show success badge for valid parameters', () => {
      const successValidation: ParameterValidationResult = {
        isValid: true,
        errors: [],
        warnings: []
      }
      
      render(
        <ParameterInput 
          {...baseProps} 
          value="valid input" 
          validation={successValidation} 
        />
      )
      
      const successBadge = screen.getByText('Valid')
      expect(successBadge).toHaveClass('border-green-500')
      expect(successBadge).toHaveClass('text-green-600')
    })
  })

  describe('Required Field Indicators', () => {
    it('should show required indicator with pulse animation for empty required fields', () => {
      render(<ParameterInput {...baseProps} required={true} />)
      
      const requiredIndicator = screen.getByLabelText('Required')
      expect(requiredIndicator).toHaveClass('required-indicator')
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('required-indicator')
    })

    it('should show required asterisk in label', () => {
      render(<ParameterInput {...baseProps} required={true} />)
      
      const requiredIndicator = screen.getByLabelText('Required')
      expect(requiredIndicator).toBeInTheDocument()
    })

    it('should apply orange styling for required empty fields', () => {
      render(<ParameterInput {...baseProps} required={true} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('border-orange-400')
      expect(input).toHaveClass('focus-visible:ring-orange-400/30')
    })
  })

  describe('Hover States and Accessibility', () => {
    it('should apply hover effects to interactive elements', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...baseProps} suggestions={['suggestion1', 'suggestion2']} />)
      
      // Show suggestions
      const suggestionsButton = screen.getByText('Suggestions')
      await user.click(suggestionsButton)
      
      const suggestionBadges = screen.getAllByText(/suggestion/)
      suggestionBadges.forEach(badge => {
        expect(badge).toHaveClass('interactive-hover')
        expect(badge).toHaveClass('focus-ring-enhanced')
      })
    })

    it('should provide proper ARIA labels and descriptions', () => {
      const errorValidation: ParameterValidationResult = {
        isValid: false,
        errors: [{ message: 'Invalid input', field: 'testParam' }],
        warnings: []
      }
      
      render(
        <ParameterInput 
          {...baseProps} 
          validation={errorValidation} 
          required={true}
        />
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-required', 'true')
      expect(input).toHaveAttribute('aria-describedby')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ParameterInput {...baseProps} suggestions={['test']} />)
      
      const input = screen.getByRole('textbox')
      
      // Test Tab navigation
      await user.tab()
      expect(input).toHaveFocus()
      
      // Test Escape key
      await user.type(input, 'test')
      await user.keyboard('{Escape}')
      
      expect(input).not.toHaveFocus()
    })
  })

  describe('Animation and Transition Effects', () => {
    it('should apply validation status animations', () => {
      const { rerender } = render(<ParameterInput {...baseProps} />)
      
      // Add error validation
      const errorValidation: ParameterValidationResult = {
        isValid: false,
        errors: [{ message: 'Error', field: 'testParam' }],
        warnings: []
      }
      
      rerender(<ParameterInput {...baseProps} validation={errorValidation} />)
      
      const errorContainer = screen.getByRole('img', { hidden: true }).parentElement
      expect(errorContainer).toHaveClass('validation-error-enter')
    })

    it('should apply state transition classes', () => {
      render(<ParameterInput {...baseProps} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveClass('input-state-transition')
    })
  })

  describe('Address Input Specific Styling', () => {
    it('should apply address-specific styling and validation', () => {
      const addressParam: ActionParameter = {
        ...baseParameter,
        type: 'Address'
      }
      
      render(<ParameterInput {...baseProps} parameter={addressParam} />)
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('placeholder', '0x1234567890abcdef')
      expect(input).toHaveAttribute('maxLength', '18')
    })
  })

  describe('Number Input Specific Styling', () => {
    it('should apply number-specific styling for UFix64', () => {
      const numberParam: ActionParameter = {
        ...baseParameter,
        type: 'UFix64'
      }
      
      render(<ParameterInput {...baseProps} parameter={numberParam} />)
      
      const input = screen.getByRole('spinbutton')
      expect(input).toHaveAttribute('min', '0')
      expect(input).toHaveAttribute('step', 'any')
      
      const helpText = screen.getByText(/UFix64: Positive decimal number/)
      expect(helpText).toBeInTheDocument()
    })
  })

  describe('Reference Mode Styling', () => {
    it('should apply enhanced styling to reference mode button', () => {
      render(
        <ParameterInput 
          {...baseProps} 
          availableOutputs={{ 'test.output': { type: 'String', description: 'Test' } }}
        />
      )
      
      const referenceButton = screen.getByText('Reference')
      fireEvent.click(referenceButton)
      
      const referenceSelect = screen.getByRole('button', { expanded: false })
      expect(referenceSelect).toHaveClass('interactive-hover')
      expect(referenceSelect).toHaveClass('focus-ring-enhanced')
      expect(referenceSelect).toHaveClass('input-state-transition')
    })
  })
})