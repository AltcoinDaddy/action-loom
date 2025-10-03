import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ParameterInput } from '../parameter-input'
import { ActionParameter, ActionOutput } from '@/lib/types'
import { ParameterValidationResult } from '@/lib/parameter-validator'

// Mock the UI components
vi.mock('@/components/ui/input', () => ({
  Input: ({ onChange, ...props }: any) => (
    <input {...props} onChange={(e) => onChange?.(e)} data-testid="input" />
  )
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: ({ onChange, ...props }: any) => (
    <textarea {...props} onChange={(e) => onChange?.(e)} data-testid="textarea" />
  )
}))

vi.mock('@/components/ui/switch', () => ({
  Switch: ({ onCheckedChange, checked, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      onClick={(e) => onCheckedChange?.(!checked)}
      data-testid="switch"
      {...props}
    />
  )
}))

vi.mock('@/components/ui/select', () => ({
  Select: ({ children, onValueChange, value }: any) => (
    <div data-testid="select" data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value}>{children}</div>
  )
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props} data-testid="button">
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

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children }: any) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: any) => <div data-testid="popover-content">{children}</div>
}))

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: any) => <div data-testid="command">{children}</div>,
  CommandInput: ({ placeholder }: any) => <input placeholder={placeholder} data-testid="command-input" />,
  CommandEmpty: ({ children }: any) => <div data-testid="command-empty">{children}</div>,
  CommandGroup: ({ children }: any) => <div data-testid="command-group">{children}</div>,
  CommandItem: ({ children, onSelect, value }: any) => (
    <div data-testid="command-item" data-value={value} onClick={() => onSelect?.(value)}>
      {children}
    </div>
  ),
  CommandList: ({ children }: any) => <div data-testid="command-list">{children}</div>
}))

describe('ParameterInput', () => {
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

  describe('String Parameter Input', () => {
    it('renders text input for string parameters', () => {
      render(<ParameterInput {...defaultProps} />)
      
      expect(screen.getByTestId('input')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Enter testParam')).toBeInTheDocument()
    })

    it('calls onChange when text input value changes', () => {
      render(<ParameterInput {...defaultProps} />)
      
      const input = screen.getByTestId('input')
      fireEvent.change(input, { target: { value: 'test value' } })
      
      expect(mockOnChange).toHaveBeenCalledWith('test value')
    })

    it('displays current value in text input', () => {
      render(<ParameterInput {...defaultProps} value="existing value" />)
      
      const input = screen.getByTestId('input') as HTMLInputElement
      expect(input.value).toBe('existing value')
    })
  })

  describe('Boolean Parameter Input', () => {
    const booleanProps = {
      ...defaultProps,
      parameter: {
        ...defaultProps.parameter,
        type: 'Bool'
      }
    }

    it('renders switch for boolean parameters', () => {
      render(<ParameterInput {...booleanProps} />)
      
      expect(screen.getByTestId('switch')).toBeInTheDocument()
    })

    it('calls onChange when switch is toggled', () => {
      render(<ParameterInput {...booleanProps} />)
      
      const switchElement = screen.getByTestId('switch')
      fireEvent.click(switchElement)
      
      expect(mockOnChange).toHaveBeenCalledWith(true)
    })

    it('displays correct switch state', () => {
      render(<ParameterInput {...booleanProps} value={true} />)
      
      const switchElement = screen.getByTestId('switch') as HTMLInputElement
      expect(switchElement.checked).toBe(true)
    })
  })

  describe('Number Parameter Input', () => {
    const numberProps = {
      ...defaultProps,
      parameter: {
        ...defaultProps.parameter,
        type: 'UFix64'
      }
    }

    it('renders number input for UFix64 parameters', () => {
      render(<ParameterInput {...numberProps} />)
      
      const input = screen.getByTestId('input') as HTMLInputElement
      expect(input.type).toBe('number')
    })

    it('shows UFix64 help text', () => {
      render(<ParameterInput {...numberProps} />)
      
      expect(screen.getByText(/UFix64: Positive decimal number/)).toBeInTheDocument()
    })
  })

  describe('Address Parameter Input', () => {
    const addressProps = {
      ...defaultProps,
      parameter: {
        ...defaultProps.parameter,
        type: 'Address'
      }
    }

    it('renders text input with address placeholder', () => {
      render(<ParameterInput {...addressProps} />)
      
      expect(screen.getByPlaceholderText('0x1234567890abcdef')).toBeInTheDocument()
    })

    it('displays suggestions for address parameters', () => {
      const suggestions = ['0x1234567890abcdef', '0xabcdef1234567890']
      render(<ParameterInput {...addressProps} suggestions={suggestions} />)
      
      // Suggestions should be displayed as buttons
      expect(screen.getByText('0x1234567890abcdef')).toBeInTheDocument()
    })
  })

  describe('Textarea for Long Text', () => {
    const descriptionProps = {
      ...defaultProps,
      parameter: {
        ...defaultProps.parameter,
        name: 'description',
        type: 'String'
      }
    }

    it('renders textarea for description parameters', () => {
      render(<ParameterInput {...descriptionProps} />)
      
      expect(screen.getByTestId('textarea')).toBeInTheDocument()
    })
  })

  describe('Reference Mode', () => {
    const availableOutputs = {
      'action1.output1': {
        name: 'output1',
        type: 'String',
        description: 'Test output'
      } as ActionOutput,
      'action2.result': {
        name: 'result',
        type: 'UFix64',
        description: 'Numeric result'
      } as ActionOutput
    }

    it('shows reference mode toggle when outputs are available', () => {
      render(<ParameterInput {...defaultProps} availableOutputs={availableOutputs} />)
      
      expect(screen.getByText('Direct Input')).toBeInTheDocument()
      expect(screen.getByText('Reference')).toBeInTheDocument()
    })

    it('switches to reference mode when reference button is clicked', () => {
      render(<ParameterInput {...defaultProps} availableOutputs={availableOutputs} />)
      
      const referenceButton = screen.getByText('Reference')
      fireEvent.click(referenceButton)
      
      expect(screen.getByText('Select output reference...')).toBeInTheDocument()
    })

    it('automatically detects reference mode for reference values', () => {
      render(
        <ParameterInput 
          {...defaultProps} 
          value="action1.output1" 
          availableOutputs={availableOutputs} 
        />
      )
      
      // Should show the reference value (there might be multiple instances)
      expect(screen.getAllByText('action1.output1')[0]).toBeInTheDocument()
    })
  })

  describe('Validation Display', () => {
    const validationWithErrors: ParameterValidationResult = {
      parameterName: 'testParam',
      value: 'invalid',
      isValid: false,
      errors: [{
        type: 'INVALID_FORMAT' as any,
        message: 'Invalid format',
        field: 'testParam',
        severity: 'error'
      }],
      warnings: [],
      suggestions: []
    }

    it('applies error styling when validation has errors', () => {
      render(<ParameterInput {...defaultProps} validation={validationWithErrors} />)
      
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('border-destructive')
    })
  })

  describe('Suggestions', () => {
    const suggestions = ['suggestion1', 'suggestion2', 'suggestion3']
    const availableOutputs = {
      'action1.output1': {
        name: 'output1',
        type: 'String',
        description: 'Test output'
      } as ActionOutput
    }

    it('shows suggestions button when suggestions are available and outputs exist', () => {
      render(<ParameterInput {...defaultProps} suggestions={suggestions} availableOutputs={availableOutputs} />)
      
      expect(screen.getByText('Suggestions')).toBeInTheDocument()
    })

    it('displays suggestions when suggestions button is clicked', () => {
      render(<ParameterInput {...defaultProps} suggestions={suggestions} availableOutputs={availableOutputs} />)
      
      const suggestionsButton = screen.getByText('Suggestions')
      fireEvent.click(suggestionsButton)
      
      expect(screen.getByText('suggestion1')).toBeInTheDocument()
      expect(screen.getByText('suggestion2')).toBeInTheDocument()
    })

    it('applies suggestion when clicked', () => {
      render(<ParameterInput {...defaultProps} suggestions={suggestions} availableOutputs={availableOutputs} />)
      
      const suggestionsButton = screen.getByText('Suggestions')
      fireEvent.click(suggestionsButton)
      
      const suggestion = screen.getByText('suggestion1')
      fireEvent.click(suggestion)
      
      expect(mockOnChange).toHaveBeenCalledWith('suggestion1')
    })
  })

  describe('Type Information', () => {
    it('displays parameter type badge', () => {
      render(<ParameterInput {...defaultProps} />)
      
      expect(screen.getByText('String')).toBeInTheDocument()
    })

    it('shows reference indicator in reference mode', () => {
      const availableOutputs = {
        'action1.output1': {
          name: 'output1',
          type: 'String',
          description: 'Test output'
        } as ActionOutput
      }

      render(
        <ParameterInput 
          {...defaultProps} 
          value="action1.output1" 
          availableOutputs={availableOutputs} 
        />
      )
      
      expect(screen.getByText('Using output reference')).toBeInTheDocument()
    })
  })
})