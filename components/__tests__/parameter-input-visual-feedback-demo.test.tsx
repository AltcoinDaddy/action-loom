import React from 'react'
import { render, screen } from '@testing-library/react'
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

describe('ParameterInput Visual Feedback Demo', () => {
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

  it('should render with enhanced visual feedback classes', () => {
    render(<ParameterInput {...baseProps} />)
    
    const input = screen.getByRole('textbox')
    
    // Check that enhanced styling classes are applied
    expect(input).toHaveClass('input-state-transition')
    expect(input).toHaveClass('input-focus-enhanced')
    expect(input).toHaveClass('interactive-hover')
  })

  it('should apply error styling with enhanced feedback', () => {
    const errorValidation: ParameterValidationResult = {
      isValid: false,
      errors: [{ message: 'Invalid input', field: 'testParam' }],
      warnings: []
    }
    
    render(<ParameterInput {...baseProps} validation={errorValidation} />)
    
    const input = screen.getByRole('textbox')
    
    // Check enhanced error styling
    expect(input).toHaveClass('input-error-glow')
    expect(input).toHaveClass('input-error-shake')
    expect(input).toHaveClass('border-destructive')
    
    // Check error badge
    const errorBadge = screen.getByText('Error')
    expect(errorBadge).toBeInTheDocument()
  })

  it('should apply warning styling with enhanced feedback', () => {
    const warningValidation: ParameterValidationResult = {
      isValid: true,
      errors: [],
      warnings: ['This value might be too large']
    }
    
    render(<ParameterInput {...baseProps} validation={warningValidation} />)
    
    const input = screen.getByRole('textbox')
    
    // Check enhanced warning styling
    expect(input).toHaveClass('input-warning-glow')
    expect(input).toHaveClass('border-yellow-500')
    
    // Check warning badge
    const warningBadge = screen.getByText('Warning')
    expect(warningBadge).toBeInTheDocument()
  })

  it('should apply success styling with enhanced feedback', () => {
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
    
    // Check enhanced success styling
    expect(input).toHaveClass('input-success-glow')
    expect(input).toHaveClass('border-green-500')
    
    // Check success badge
    const successBadge = screen.getByText('Valid')
    expect(successBadge).toBeInTheDocument()
  })

  it('should apply required field styling with pulse animation', () => {
    render(<ParameterInput {...baseProps} required={true} />)
    
    const input = screen.getByRole('textbox')
    
    // Check required field styling
    expect(input).toHaveClass('required-indicator')
    expect(input).toHaveClass('border-orange-400')
    
    // Check required asterisk
    const requiredIndicator = screen.getByLabelText('Required')
    expect(requiredIndicator).toBeInTheDocument()
  })

  it('should apply enhanced styling to boolean switch', () => {
    const booleanParam: ActionParameter = {
      ...baseParameter,
      type: 'Bool'
    }
    
    render(<ParameterInput {...baseProps} parameter={booleanParam} />)
    
    const switchElement = screen.getByRole('switch')
    
    // Check enhanced switch styling
    expect(switchElement).toHaveClass('interactive-hover')
    expect(switchElement).toHaveClass('focus-ring-enhanced')
  })

  it('should show validation status indicators with animations', () => {
    const errorValidation: ParameterValidationResult = {
      isValid: false,
      errors: [{ message: 'Invalid input', field: 'testParam' }],
      warnings: []
    }
    
    render(<ParameterInput {...baseProps} validation={errorValidation} />)
    
    // Check for validation status indicator container
    const validationContainer = screen.getByRole('textbox').parentElement?.querySelector('.validation-error-enter')
    expect(validationContainer).toBeInTheDocument()
  })

  it('should apply enhanced styling to address input', () => {
    const addressParam: ActionParameter = {
      ...baseParameter,
      type: 'Address'
    }
    
    render(<ParameterInput {...baseProps} parameter={addressParam} />)
    
    const input = screen.getByRole('textbox')
    
    // Check address-specific attributes
    expect(input).toHaveAttribute('placeholder', '0x1234567890abcdef')
    expect(input).toHaveAttribute('maxLength', '18')
    
    // Check enhanced styling is still applied
    expect(input).toHaveClass('input-state-transition')
    expect(input).toHaveClass('interactive-hover')
  })

  it('should apply enhanced styling to number input', () => {
    const numberParam: ActionParameter = {
      ...baseParameter,
      type: 'UFix64'
    }
    
    render(<ParameterInput {...baseProps} parameter={numberParam} />)
    
    const input = screen.getByRole('spinbutton')
    
    // Check number-specific attributes
    expect(input).toHaveAttribute('min', '0')
    expect(input).toHaveAttribute('step', 'any')
    
    // Check enhanced styling is still applied
    expect(input).toHaveClass('input-state-transition')
    expect(input).toHaveClass('interactive-hover')
  })
})