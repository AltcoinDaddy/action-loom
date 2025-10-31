import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ParameterInput } from '../parameter-input'
import { ActionParameter, ActionOutput } from '@/lib/types'
import { ParameterValidationResult } from '@/lib/parameter-validator'

// Mock the UI components with enhanced event handling
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

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} {...props} data-testid="label">
      {children}
    </label>
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => (
    <span {...props} data-testid="badge">
      {children}
    </span>
  )
}))

// Mock parameter value processor
vi.mock('@/lib/parameter-value-processor', () => ({
  ParameterValueProcessor: {
    sanitizeInput: vi.fn((value, type) => ({
      value: type === 'Address' && !value.startsWith('0x') ? `0x${value}` : value,
      isValid: true,
      errors: [],
      warnings: []
    })),
    processValue: vi.fn((value, type) => ({
      value: type === 'UFix64' ? parseFloat(value) || value : value,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: type === 'UFix64' && !isNaN(parseFloat(value))
    })),
    convertType: vi.fn((value, type) => ({
      value: type === 'Bool' ? Boolean(value) : value,
      isValid: true,
      errors: []
    }))
  }
}))

describe('ParameterInput Comprehensive Testing', () => {
  const mockOnChange = vi.fn()

  const createParameter = (overrides: Partial<ActionParameter> = {}): ActionParameter => ({
    name: 'testParam',
    type: 'String',
    description: 'Test parameter',
    ...overrides
  })

  const baseProps = {
    parameter: createParameter(),
    value: '',
    onChange: mockOnChange,
    availableOutputs: {},
    suggestions: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Unit Tests - Different Input Types', () => {
    describe('String Input Type', () => {
      it('should render text input for string parameters', () => {
        render(<ParameterInput {...baseProps} />)
        
        const input = screen.getByTestId('input')
        expect(input).toBeInTheDocument()
        expect(input).toHaveAttribute('type', 'text')
      })

      it('should handle text input changes correctly', async () => {
        const user = userEvent.setup()
        render(<ParameterInput {...baseProps} />)
        
        const input = screen.getByTestId('input')
        await user.type(input, 'test string')
        
        expect(mockOnChange).toHaveBeenLastCalledWith('test string')
      })

      it('should render textarea for description fields', () => {
        const descriptionParam = createParameter({ name: 'description' })
        render(<ParameterInput {...baseProps} parameter={descriptionParam} />)
        
        expect(screen.getByTestId('textarea')).toBeInTheDocument()
      })

      it('should handle multiline text in textarea', async () => {
        const user = userEvent.setup()
        const descriptionParam = createParameter({ name: 'description' })
        render(<ParameterInput {...baseProps} parameter={descriptionParam} />)
        
        const textarea = screen.getByTestId('textarea')
        await user.type(textarea, 'Line 1{enter}Line 2')
        
        expect(mockOnChange).toHaveBeenLastCalledWith('Line 1\nLine 2')
      })
    })

    describe('Boolean Input Type', () => {
      const booleanParam = createParameter({ type: 'Bool' })

      it('should render switch for boolean parameters', () => {
        render(<ParameterInput {...baseProps} parameter={booleanParam} />)
        
        expect(screen.getByTestId('switch')).toBeInTheDocument()
      })

      it('should handle boolean toggle correctly', async () => {
        const user = userEvent.setup()
        render(<ParameterInput {...baseProps} parameter={booleanParam} />)
        
        const switchElement = screen.getByTestId('switch')
        await user.click(switchElement)
        
        expect(mockOnChange).toHaveBeenCalledWith(true)
      })

      it('should display correct boolean state', () => {
        render(<ParameterInput {...baseProps} parameter={booleanParam} value={true} />)
        
        const switchElement = screen.getByTestId('switch') as HTMLInputElement
        expect(switchElement.checked).toBe(true)
      })

      it('should handle string boolean values', () => {
        render(<ParameterInput {...baseProps} parameter={booleanParam} value="true" />)
        
        const switchElement = screen.getByTestId('switch') as HTMLInputElement
        expect(switchElement.checked).toBe(true)
      })
    })

    describe('Number Input Type', () => {
      const numberParam = createParameter({ type: 'UFix64' })

      it('should render number input for UFix64 parameters', () => {
        render(<ParameterInput {...baseProps} parameter={numberParam} />)
        
        const input = screen.getByTestId('input') as HTMLInputElement
        expect(input.type).toBe('number')
        expect(input.min).toBe('0')
        expect(input.step).toBe('any')
      })

      it('should handle numeric input correctly', async () => {
        const user = userEvent.setup()
        render(<ParameterInput {...baseProps} parameter={numberParam} />)
        
        const input = screen.getByTestId('input')
        await user.type(input, '123.45')
        
        expect(mockOnChange).toHaveBeenLastCalledWith('123.45')
      })

      it('should show UFix64 help text', () => {
        render(<ParameterInput {...baseProps} parameter={numberParam} />)
        
        expect(screen.getByText(/UFix64: Positive decimal number/)).toBeInTheDocument()
      })

      it('should handle Int type without minimum constraint', () => {
        const intParam = createParameter({ type: 'Int' })
        render(<ParameterInput {...baseProps} parameter={intParam} />)
        
        const input = screen.getByTestId('input') as HTMLInputElement
        expect(input.type).toBe('number')
        expect(input.min).toBe('')
      })
    })

    describe('Address Input Type', () => {
      const addressParam = createParameter({ type: 'Address' })

      it('should render text input with address placeholder', () => {
        render(<ParameterInput {...baseProps} parameter={addressParam} />)
        
        const input = scree