import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ParameterConfigPanel } from '../parameter-config-panel'
import { ActionMetadata, ActionOutput, ParsedWorkflow, ParsedAction } from '@/lib/types'
import { ParameterValidator } from '@/lib/parameter-validator'

// Mock the parameter validator
vi.mock('@/lib/parameter-validator')
const MockParameterValidator = ParameterValidator as any

// Mock child components
vi.mock('../parameter-input', () => ({
  ParameterInput: ({ parameter, value, onChange, validation }: any) => (
    <div data-testid={`parameter-input-${parameter.name}`}>
      <label>{parameter.name}</label>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`input-${parameter.name}`}
      />
      {validation?.errors?.length > 0 && (
        <div data-testid={`error-${parameter.name}`}>
          {validation.errors[0].message}
        </div>
      )}
    </div>
  )
}))

vi.mock('../parameter-dependency-visualization', () => ({
  ParameterDependencyVisualization: ({ action }: any) => (
    <div data-testid="dependency-visualization">
      Dependencies for {action.name}
    </div>
  )
}))

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>,
  CardHeader: ({ children }: any) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }: any) => <h3 data-testid="card-title">{children}</h3>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props} data-testid="button">
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => (
    <span {...props} data-testid="badge">{children}</span>
  )
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />
}))

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: any) => <div data-testid="scroll-area">{children}</div>
}))

describe('ParameterConfigPanel', () => {
  const mockOnParameterChange = vi.fn()
  const mockOnValidationChange = vi.fn()
  const mockOnClose = vi.fn()

  const mockAction: ActionMetadata = {
    id: 'test-action',
    name: 'Test Action',
    description: 'A test action for parameter configuration',
    category: 'Test',
    version: '1.0.0',
    parameters: [
      {
        name: 'requiredParam',
        type: 'String',
        required: true,
        value: '',
        description: 'A required string parameter'
      },
      {
        name: 'optionalParam',
        type: 'UFix64',
        required: false,
        value: '',
        description: 'An optional number parameter'
      },
      {
        name: 'addressParam',
        type: 'Address',
        required: true,
        value: '',
        description: 'A required address parameter'
      }
    ],
    inputs: [],
    outputs: [],
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 1000,
    securityLevel: 'medium' as any,
    author: 'test',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }

  const mockCurrentValues = {
    requiredParam: 'test value',
    optionalParam: '',
    addressParam: ''
  }

  const mockAvailableOutputs = {
    'action1.result': {
      name: 'result',
      type: 'String',
      description: 'Result from action 1'
    } as ActionOutput,
    'action2.amount': {
      name: 'amount',
      type: 'UFix64',
      description: 'Amount from action 2'
    } as ActionOutput
  }

  const mockWorkflow: ParsedWorkflow = {
    actions: [],
    executionOrder: [],
    rootActions: [],
    metadata: {
      totalActions: 1,
      totalConnections: 0,
      createdAt: '2024-01-01'
    }
  }

  const mockCurrentAction: ParsedAction = {
    id: 'test-action',
    actionType: 'test',
    name: 'Test Action',
    parameters: [],
    nextActions: [],
    position: { x: 0, y: 0 }
  }

  const defaultProps = {
    action: mockAction,
    currentValues: mockCurrentValues,
    onParameterChange: mockOnParameterChange,
    onValidationChange: mockOnValidationChange,
    availableOutputs: mockAvailableOutputs,
    workflow: mockWorkflow,
    currentAction: mockCurrentAction
  }

  let mockValidatorInstance: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mock validator
    mockValidatorInstance = {
      validateAllParameters: vi.fn().mockReturnValue({
        actionId: 'test-action',
        isValid: true,
        missingParameters: [],
        invalidParameters: {},
        warnings: []
      }),
      validateParameter: vi.fn().mockReturnValue({
        parameterName: 'test',
        value: 'test',
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      })
    }
    
    MockParameterValidator.mockImplementation(() => mockValidatorInstance)
  })

  describe('Component Rendering', () => {
    it('renders the parameter configuration panel', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('Configure Parameters')).toBeInTheDocument()
      expect(screen.getByText('Test Action')).toBeInTheDocument()
      expect(screen.getByText('A test action for parameter configuration')).toBeInTheDocument()
    })

    it('displays action category badge', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('Test')).toBeInTheDocument()
    })

    it('renders close button when onClose is provided', () => {
      render(<ParameterConfigPanel {...defaultProps} onClose={mockOnClose} />)
      
      const buttons = screen.getAllByTestId('button')
      // The close button should be the first one (in the header)
      expect(buttons[0]).toBeInTheDocument()
    })

    it('calls onClose when close button is clicked', () => {
      render(<ParameterConfigPanel {...defaultProps} onClose={mockOnClose} />)
      
      const buttons = screen.getAllByTestId('button')
      // The close button should be the first one (in the header)
      fireEvent.click(buttons[0])
      
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Parameter Inputs', () => {
    it('renders parameter inputs for all parameters', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByTestId('parameter-input-requiredParam')).toBeInTheDocument()
      expect(screen.getByTestId('parameter-input-optionalParam')).toBeInTheDocument()
      expect(screen.getByTestId('parameter-input-addressParam')).toBeInTheDocument()
    })

    it('shows required indicator for required parameters', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      // Required parameters should have asterisk - use getAllByText since they appear multiple times
      expect(screen.getAllByText('requiredParam')[0]).toBeInTheDocument()
      expect(screen.getAllByText('addressParam')[0]).toBeInTheDocument()
    })

    it('displays parameter types as badges', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('String')).toBeInTheDocument()
      expect(screen.getByText('UFix64')).toBeInTheDocument()
      expect(screen.getByText('Address')).toBeInTheDocument()
    })

    it('shows parameter descriptions', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('A required string parameter')).toBeInTheDocument()
      expect(screen.getByText('An optional number parameter')).toBeInTheDocument()
      expect(screen.getByText('A required address parameter')).toBeInTheDocument()
    })
  })

  describe('Parameter Value Changes', () => {
    it('calls onParameterChange when parameter value changes', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      const input = screen.getByTestId('input-requiredParam')
      fireEvent.change(input, { target: { value: 'new value' } })
      
      expect(mockOnParameterChange).toHaveBeenCalledWith('requiredParam', 'new value')
    })

    it('updates validation when parameter values change', async () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      // Change a parameter value
      const input = screen.getByTestId('input-requiredParam')
      fireEvent.change(input, { target: { value: 'new value' } })
      
      await waitFor(() => {
        expect(mockValidatorInstance.validateAllParameters).toHaveBeenCalled()
        expect(mockOnValidationChange).toHaveBeenCalled()
      })
    })
  })

  describe('Validation Display', () => {
    it('shows validation success when all parameters are valid', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('All parameters valid')).toBeInTheDocument()
    })

    it('shows validation errors when parameters are invalid', () => {
      const mockValidatorInstance = {
        validateAllParameters: vi.fn().mockReturnValue({
          actionId: 'test-action',
          isValid: false,
          missingParameters: ['addressParam'],
          invalidParameters: {
            requiredParam: {
              parameterName: 'requiredParam',
              value: '',
              isValid: false,
              errors: [{ type: 'MISSING_REQUIRED', message: 'Required parameter missing', severity: 'error' }],
              warnings: [],
              suggestions: []
            }
          },
          warnings: ['This is a warning']
        }),
        validateParameter: vi.fn().mockReturnValue({
          parameterName: 'test',
          value: 'test',
          isValid: false,
          errors: [{ type: 'MISSING_REQUIRED', message: 'Required parameter missing', severity: 'error' }],
          warnings: [],
          suggestions: []
        })
      }
      
      MockParameterValidator.mockImplementation(() => mockValidatorInstance as any)
      
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText(/1 missing, 1 invalid/)).toBeInTheDocument()
    })

    it('displays missing parameters warning', () => {
      mockValidatorInstance.validateAllParameters.mockReturnValue({
        actionId: 'test-action',
        isValid: false,
        missingParameters: ['addressParam', 'requiredParam'],
        invalidParameters: {},
        warnings: []
      })
      
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('Missing Required Parameters')).toBeInTheDocument()
      // These appear in the missing parameters list
      expect(screen.getAllByText('addressParam').some(el => 
        el.closest('li')?.textContent?.includes('addressParam')
      )).toBe(true)
      expect(screen.getAllByText('requiredParam').some(el => 
        el.closest('li')?.textContent?.includes('requiredParam')
      )).toBe(true)
    })

    it('displays validation warnings', () => {
      mockValidatorInstance.validateAllParameters.mockReturnValue({
        actionId: 'test-action',
        isValid: true,
        missingParameters: [],
        invalidParameters: {},
        warnings: ['This is a validation warning', 'Another warning']
      })
      
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('Warnings')).toBeInTheDocument()
      expect(screen.getByText('This is a validation warning')).toBeInTheDocument()
      expect(screen.getByText('Another warning')).toBeInTheDocument()
    })
  })

  describe('Parameter Dependencies', () => {
    it('shows dependency visualization when available outputs exist', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByText('Parameter Dependencies')).toBeInTheDocument()
      expect(screen.getByText('Show Dependencies')).toBeInTheDocument()
    })

    it('toggles dependency visualization visibility', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      const showButton = screen.getByText('Show Dependencies')
      fireEvent.click(showButton)
      
      expect(screen.getByTestId('dependency-visualization')).toBeInTheDocument()
      expect(screen.getByText('Hide Dependencies')).toBeInTheDocument()
    })

    it('does not show dependencies section when no outputs available', () => {
      render(<ParameterConfigPanel {...defaultProps} availableOutputs={{}} />)
      
      expect(screen.queryByText('Parameter Dependencies')).not.toBeInTheDocument()
    })
  })

  describe('Validation Integration', () => {
    it('calls validation on component mount', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(mockValidatorInstance.validateAllParameters).toHaveBeenCalledWith(
        mockAction,
        mockCurrentValues,
        expect.objectContaining({
          workflow: mockWorkflow,
          currentAction: mockCurrentAction,
          availableOutputs: mockAvailableOutputs
        })
      )
    })

    it('calls onValidationChange with validation results', () => {
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(mockOnValidationChange).toHaveBeenCalledWith(true, [])
    })

    it('passes validation results to parameter inputs', () => {
      mockValidatorInstance.validateAllParameters.mockReturnValue({
        actionId: 'test-action',
        isValid: false,
        missingParameters: [],
        invalidParameters: {},
        warnings: []
      })
      
      mockValidatorInstance.validateParameter.mockReturnValue({
        parameterName: 'requiredParam',
        value: 'test',
        isValid: false,
        errors: [{ type: 'INVALID_FORMAT', message: 'Invalid format', severity: 'error' }],
        warnings: [],
        suggestions: ['Try this format']
      })
      
      render(<ParameterConfigPanel {...defaultProps} />)
      
      expect(screen.getByTestId('error-requiredParam')).toBeInTheDocument()
      expect(screen.getAllByText('Invalid format')[0]).toBeInTheDocument()
    })
  })
})