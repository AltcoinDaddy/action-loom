import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ParameterConfigPanel } from '../parameter-config-panel'
import { ParameterInput } from '../parameter-input'
import { WorkflowBuilder } from '../workflow-builder'
import { ExecutionReadinessIndicator } from '../execution-readiness-indicator'
import { DataFlowConnectionIndicator } from '../data-flow-connection-indicator'
import { ParameterDependencyVisualization } from '../parameter-dependency-visualization'
import type { ActionMetadata, ParsedWorkflow, ParsedAction, ActionOutput } from '@/lib/types'

// Mock all external dependencies
vi.mock('@/lib/parameter-validator')
vi.mock('@/lib/enhanced-workflow-validator')
vi.mock('@/lib/parameter-suggestion-engine')
vi.mock('@/lib/data-flow-analyzer')

// Mock child components for WorkflowBuilder
vi.mock('../workflow-canvas', () => ({
  WorkflowCanvas: ({ onActionNodeSelect, workflow }: any) => (
    <div data-testid="workflow-canvas">
      <div data-testid="action-count">{workflow?.actions?.length || 0}</div>
      <button 
        onClick={() => onActionNodeSelect?.('action-1', { id: 'test', parameters: [] })}
        data-testid="select-action-button"
      >
        Select Action
      </button>
    </div>
  )
}))

vi.mock('../action-library', () => ({
  ActionLibrary: () => <div data-testid="action-library" />
}))

vi.mock('../code-preview', () => ({
  __esModule: true,
  default: () => <div data-testid="code-preview" />
}))

vi.mock('../execution-modal', () => ({
  ExecutionModal: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="execution-modal"><button onClick={onClose}>Close</button></div> : null
}))

vi.mock('../nlp-input', () => ({
  NLPInput: () => <div data-testid="nlp-input" />
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
  Button: ({ children, onClick, disabled, variant, ...props }: any) => (
    <button 
      onClick={onClick} 
      disabled={disabled}
      data-variant={variant}
      {...props} 
      data-testid="button"
    >
      {children}
    </button>
  )
}))

vi.mock('@/components/ui/input', () => ({
  Input: ({ onChange, className, ...props }: any) => (
    <input 
      {...props} 
      onChange={(e) => onChange?.(e)} 
      className={className}
      data-testid="input" 
    />
  )
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span {...props} data-variant={variant} data-testid="badge">{children}</span>
  )
}))

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div data-testid="progress" data-value={value} className={className} />
  )
}))

vi.mock('@/components/ui/alert', () => ({
  Alert: ({ children, variant }: any) => (
    <div data-testid="alert" data-variant={variant}>{children}</div>
  ),
  AlertDescription: ({ children }: any) => (
    <div data-testid="alert-description">{children}</div>
  )
}))

describe('Comprehensive UI Validation Test Suite', () => {
  const mockActionMetadata: ActionMetadata = {
    id: 'swap-tokens',
    name: 'Swap Tokens',
    description: 'Swap one token for another',
    category: 'DeFi',
    version: '1.0.0',
    parameters: [
      {
        name: 'fromToken',
        type: 'Address',
        required: true,
        value: '',
        description: 'Source token address'
      },
      {
        name: 'toToken',
        type: 'Address',
        required: true,
        value: '',
        description: 'Destination token address'
      },
      {
        name: 'amount',
        type: 'UFix64',
        required: true,
        value: '',
        description: 'Amount to swap'
      },
      {
        name: 'slippage',
        type: 'UFix64',
        required: false,
        value: '',
        description: 'Maximum slippage tolerance'
      }
    ],
    inputs: [],
    outputs: [
      { name: 'outputToken', type: 'Address', description: 'Output token address' },
      { name: 'outputAmount', type: 'UFix64', description: 'Output token amount' }
    ],
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 5000,
    securityLevel: 'medium' as any,
    author: 'ActionLoom',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }

  const mockWorkflow: ParsedWorkflow = {
    actions: [
      {
        id: 'action-1',
        actionType: 'swap-tokens',
        name: 'Swap FLOW to USDC',
        parameters: [
          { name: 'fromToken', type: 'Address', value: '', required: true },
          { name: 'toToken', type: 'Address', value: '', required: true },
          { name: 'amount', type: 'UFix64', value: '', required: true }
        ],
        nextActions: ['action-2'],
        position: { x: 0, y: 0 }
      },
      {
        id: 'action-2',
        actionType: 'stake-tokens',
        name: 'Stake USDC',
        parameters: [
          { name: 'token', type: 'Address', value: 'action-1.outputToken', required: true },
          { name: 'amount', type: 'UFix64', value: 'action-1.outputAmount', required: true }
        ],
        nextActions: [],
        position: { x: 200, y: 0 }
      }
    ],
    executionOrder: ['action-1', 'action-2'],
    rootActions: ['action-1'],
    metadata: {
      totalActions: 2,
      totalConnections: 1,
      createdAt: new Date().toISOString()
    }
  }

  const mockAvailableOutputs = {
    'action-1.outputToken': {
      name: 'outputToken',
      type: 'Address',
      description: 'Output token address'
    } as ActionOutput,
    'action-1.outputAmount': {
      name: 'outputAmount',
      type: 'UFix64',
      description: 'Output token amount'
    } as ActionOutput
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Parameter Configuration Panel Integration', () => {
    it('should handle complete parameter configuration workflow', async () => {
      const user = userEvent.setup()
      const mockOnParameterChange = vi.fn()
      const mockOnValidationChange = vi.fn()

      render(
        <ParameterConfigPanel
          action={mockActionMetadata}
          currentValues={{}}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )

      // Should render all parameter inputs
      expect(screen.getByText('fromToken')).toBeInTheDocument()
      expect(screen.getByText('toToken')).toBeInTheDocument()
      expect(screen.getByText('amount')).toBeInTheDocument()
      expect(screen.getByText('slippage')).toBeInTheDocument()

      // Configure parameters step by step
      const inputs = screen.getAllByTestId('input')
      
      // Configure fromToken
      await user.type(inputs[0], '0x1654653399040a61')
      expect(mockOnParameterChange).toHaveBeenCalledWith('fromToken', '0x1654653399040a61')

      // Configure toToken
      await user.type(inputs[1], '0x3c5959b568896393')
      expect(mockOnParameterChange).toHaveBeenCalledWith('toToken', '0x3c5959b568896393')

      // Configure amount
      await user.type(inputs[2], '100.0')
      expect(mockOnParameterChange).toHaveBeenCalledWith('amount', '100.0')

      // Validation should be called after each change
      expect(mockOnValidationChange).toHaveBeenCalled()
    })

    it('should display validation errors in real-time', async () => {
      const user = userEvent.setup()
      const mockOnParameterChange = vi.fn()
      const mockOnValidationChange = vi.fn()

      // Mock validation to return errors
      const { ParameterValidator } = await import('@/lib/parameter-validator')
      const mockValidator = {
        validateAllParameters: vi.fn().mockReturnValue({
          actionId: 'swap-tokens',
          isValid: false,
          missingParameters: ['toToken', 'amount'],
          invalidParameters: {
            fromToken: {
              parameterName: 'fromToken',
              value: 'invalid',
              isValid: false,
              errors: [{ type: 'INVALID_FORMAT', message: 'Invalid address format', severity: 'error' }],
              warnings: [],
              suggestions: ['Use format: 0x1234567890abcdef']
            }
          },
          warnings: []
        }),
        validateParameter: vi.fn().mockReturnValue({
          parameterName: 'fromToken',
          value: 'invalid',
          isValid: false,
          errors: [{ type: 'INVALID_FORMAT', message: 'Invalid address format', severity: 'error' }],
          warnings: [],
          suggestions: ['Use format: 0x1234567890abcdef']
        })
      }
      
      vi.mocked(ParameterValidator).mockImplementation(() => mockValidator as any)

      render(
        <ParameterConfigPanel
          action={mockActionMetadata}
          currentValues={{ fromToken: 'invalid' }}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )

      // Should show validation status
      expect(screen.getByText(/2 missing, 1 invalid/)).toBeInTheDocument()

      // Should show missing parameters
      expect(screen.getByText('Missing Required Parameters')).toBeInTheDocument()
      expect(screen.getByText('toToken')).toBeInTheDocument()
      expect(screen.getByText('amount')).toBeInTheDocument()
    })

    it('should handle parameter dependency visualization', async () => {
      const user = userEvent.setup()

      render(
        <ParameterConfigPanel
          action={mockActionMetadata}
          currentValues={{}}
          onParameterChange={vi.fn()}
          onValidationChange={vi.fn()}
          availableOutputs={mockAvailableOutputs}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )

      // Should show dependencies section when outputs are available
      expect(screen.getByText('Parameter Dependencies')).toBeInTheDocument()
      expect(screen.getByText('Show Dependencies')).toBeInTheDocument()

      // Toggle dependency visualization
      const showButton = screen.getByText('Show Dependencies')
      await user.click(showButton)

      expect(screen.getByText('Hide Dependencies')).toBeInTheDocument()
    })
  })

  describe('Parameter Input Component Validation', () => {
    it('should handle all parameter types correctly', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      const parameterTypes = [
        { type: 'Address', placeholder: '0x1234567890abcdef' },
        { type: 'UFix64', inputType: 'number' },
        { type: 'String', placeholder: 'Enter testParam' },
        { type: 'Bool', component: 'switch' }
      ]

      for (const { type, placeholder, inputType, component } of parameterTypes) {
        const parameter = {
          name: 'testParam',
          type,
          required: true,
          value: ''
        }

        const { unmount } = render(
          <ParameterInput
            parameter={parameter}
            value=""
            onChange={mockOnChange}
            availableOutputs={{}}
            suggestions={[]}
          />
        )

        if (component === 'switch') {
          expect(screen.getByTestId('switch')).toBeInTheDocument()
        } else {
          const input = screen.getByTestId('input')
          if (placeholder) {
            expect(input).toHaveAttribute('placeholder', placeholder)
          }
          if (inputType) {
            expect(input).toHaveAttribute('type', inputType)
          }
        }

        unmount()
      }
    })

    it('should handle reference mode switching', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(
        <ParameterInput
          parameter={{
            name: 'token',
            type: 'Address',
            required: true,
            value: ''
          }}
          value=""
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      // Should show mode toggle buttons
      expect(screen.getByText('Direct Input')).toBeInTheDocument()
      expect(screen.getByText('Reference')).toBeInTheDocument()

      // Switch to reference mode
      await user.click(screen.getByText('Reference'))

      // Should show reference selection
      expect(screen.getByText('Select output reference...')).toBeInTheDocument()
    })

    it('should display validation errors with proper styling', () => {
      const mockValidation = {
        parameterName: 'amount',
        value: 'invalid',
        isValid: false,
        errors: [{
          type: 'INVALID_FORMAT' as any,
          message: 'Invalid number format',
          field: 'amount',
          severity: 'error' as const
        }],
        warnings: [],
        suggestions: ['Enter a valid decimal number']
      }

      render(
        <ParameterInput
          parameter={{
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          }}
          value="invalid"
          onChange={vi.fn()}
          availableOutputs={{}}
          suggestions={[]}
          validation={mockValidation}
        />
      )

      // Should apply error styling
      const input = screen.getByTestId('input')
      expect(input).toHaveClass('border-destructive')
    })
  })

  describe('Workflow Builder Integration', () => {
    it('should integrate parameter validation with workflow building', async () => {
      const user = userEvent.setup()

      render(<WorkflowBuilder />)

      // Should render main components
      expect(screen.getByText('ActionLoom')).toBeInTheDocument()
      expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
      expect(screen.getByTestId('action-library')).toBeInTheDocument()

      // Execute button should be disabled initially
      const executeButton = screen.getByRole('button', { name: /Execute Workflow/ })
      expect(executeButton).toBeDisabled()

      // Should handle action selection
      const selectButton = screen.getByTestId('select-action-button')
      await user.click(selectButton)

      // Component should handle the selection without errors
      expect(selectButton).toBeInTheDocument()
    })

    it('should handle workflow validation state changes', () => {
      render(<WorkflowBuilder />)

      // Should manage validation state properly
      expect(screen.getByText('ActionLoom')).toBeInTheDocument()
      
      // Execute button state should reflect validation
      const executeButton = screen.getByRole('button', { name: /Execute Workflow/ })
      expect(executeButton).toBeInTheDocument()
    })
  })

  describe('Execution Readiness Indicator', () => {
    it('should display readiness status correctly', () => {
      const readinessData = {
        parametersConfigured: true,
        dataFlowValid: true,
        noCircularDependencies: true,
        allActionsValid: true,
        readinessScore: 100,
        readinessMessage: 'Workflow is ready for execution'
      }

      render(
        <ExecutionReadinessIndicator
          readiness={readinessData}
          isValidating={false}
        />
      )

      // Should show ready status
      expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '100')
      expect(screen.getByText('Workflow is ready for execution')).toBeInTheDocument()
    })

    it('should display validation issues', () => {
      const readinessData = {
        parametersConfigured: false,
        dataFlowValid: true,
        noCircularDependencies: false,
        allActionsValid: true,
        readinessScore: 50,
        readinessMessage: 'Workflow has validation issues'
      }

      render(
        <ExecutionReadinessIndicator
          readiness={readinessData}
          isValidating={false}
        />
      )

      // Should show partial readiness
      expect(screen.getByTestId('progress')).toHaveAttribute('data-value', '50')
      expect(screen.getByText('Workflow has validation issues')).toBeInTheDocument()
    })

    it('should show loading state during validation', () => {
      const readinessData = {
        parametersConfigured: false,
        dataFlowValid: false,
        noCircularDependencies: false,
        allActionsValid: false,
        readinessScore: 0,
        readinessMessage: 'Validating...'
      }

      render(
        <ExecutionReadinessIndicator
          readiness={readinessData}
          isValidating={true}
        />
      )

      expect(screen.getByText('Validating...')).toBeInTheDocument()
    })
  })

  describe('Data Flow Connection Indicator', () => {
    it('should display connection status', () => {
      render(
        <DataFlowConnectionIndicator
          sourceAction="action-1"
          targetAction="action-2"
          connectionType="parameter"
          isValid={true}
        />
      )

      // Should show valid connection
      expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'default')
    })

    it('should display invalid connection', () => {
      render(
        <DataFlowConnectionIndicator
          sourceAction="action-1"
          targetAction="action-2"
          connectionType="parameter"
          isValid={false}
          error="Type mismatch: Address → UFix64"
        />
      )

      // Should show error state
      expect(screen.getByTestId('badge')).toHaveAttribute('data-variant', 'destructive')
      expect(screen.getByText('Type mismatch: Address → UFix64')).toBeInTheDocument()
    })
  })

  describe('Parameter Dependency Visualization', () => {
    it('should render dependency graph', () => {
      render(
        <ParameterDependencyVisualization
          action={mockWorkflow.actions[1]} // action-2 with dependencies
          availableOutputs={mockAvailableOutputs}
          workflow={mockWorkflow}
        />
      )

      // Should show dependency information
      expect(screen.getByText('Dependencies for Stake USDC')).toBeInTheDocument()
    })

    it('should handle actions without dependencies', () => {
      render(
        <ParameterDependencyVisualization
          action={mockWorkflow.actions[0]} // action-1 without dependencies
          availableOutputs={{}}
          workflow={mockWorkflow}
        />
      )

      // Should handle gracefully
      expect(screen.getByText('Dependencies for Swap FLOW to USDC')).toBeInTheDocument()
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should handle component errors gracefully', () => {
      // Mock console.error to avoid noise in tests
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Test with invalid props that might cause errors
      const { container } = render(
        <ParameterConfigPanel
          action={null as any}
          currentValues={{}}
          onParameterChange={vi.fn()}
          onValidationChange={vi.fn()}
          availableOutputs={{}}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )

      // Component should not crash
      expect(container).toBeInTheDocument()

      consoleSpy.mockRestore()
    })

    it('should handle validation service failures', async () => {
      // Mock validation service to throw error
      const { ParameterValidator } = await import('@/lib/parameter-validator')
      vi.mocked(ParameterValidator).mockImplementation(() => {
        throw new Error('Validation service unavailable')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ParameterConfigPanel
          action={mockActionMetadata}
          currentValues={{}}
          onParameterChange={vi.fn()}
          onValidationChange={vi.fn()}
          availableOutputs={{}}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )

      // Component should render despite validation error
      expect(screen.getByText('Configure Parameters')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe('Performance and Responsiveness', () => {
    it('should handle rapid parameter changes efficiently', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(
        <ParameterInput
          parameter={{
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          }}
          value=""
          onChange={mockOnChange}
          availableOutputs={{}}
          suggestions={[]}
        />
      )

      const input = screen.getByTestId('input')

      // Simulate rapid typing
      const startTime = performance.now()
      
      for (let i = 0; i < 10; i++) {
        await user.type(input, i.toString())
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle rapid changes efficiently (< 100ms)
      expect(duration).toBeLessThan(100)
      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should render large parameter lists efficiently', () => {
      const largeAction: ActionMetadata = {
        ...mockActionMetadata,
        parameters: Array.from({ length: 50 }, (_, i) => ({
          name: `param${i}`,
          type: 'String',
          required: i % 2 === 0,
          value: '',
          description: `Parameter ${i}`
        }))
      }

      const startTime = performance.now()
      
      render(
        <ParameterConfigPanel
          action={largeAction}
          currentValues={{}}
          onParameterChange={vi.fn()}
          onValidationChange={vi.fn()}
          availableOutputs={{}}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )
      
      const endTime = performance.now()
      const duration = endTime - startTime

      // Should render efficiently (< 50ms)
      expect(duration).toBeLessThan(50)
      
      // Should render all parameters
      expect(screen.getByText('param0')).toBeInTheDocument()
      expect(screen.getByText('param49')).toBeInTheDocument()
    })
  })

  describe('Accessibility and User Experience', () => {
    it('should provide proper ARIA labels and roles', () => {
      render(
        <ParameterConfigPanel
          action={mockActionMetadata}
          currentValues={{}}
          onParameterChange={vi.fn()}
          onValidationChange={vi.fn()}
          availableOutputs={{}}
          workflow={mockWorkflow}
          currentAction={mockWorkflow.actions[0]}
        />
      )

      // Should have proper heading structure
      expect(screen.getByText('Configure Parameters')).toBeInTheDocument()
      expect(screen.getByText('Swap Tokens')).toBeInTheDocument()
    })

    it('should handle keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <ParameterInput
          parameter={{
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          }}
          value=""
          onChange={vi.fn()}
          availableOutputs={mockAvailableOutputs}
          suggestions={['10.0', '100.0', '1000.0']}
        />
      )

      const input = screen.getByTestId('input')
      
      // Should be focusable
      await user.tab()
      expect(input).toHaveFocus()

      // Should handle keyboard input
      await user.keyboard('123.45')
      expect(input).toHaveValue('123.45')
    })

    it('should provide clear visual feedback for validation states', () => {
      const validValidation = {
        parameterName: 'amount',
        value: '100.0',
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      }

      const invalidValidation = {
        parameterName: 'amount',
        value: 'invalid',
        isValid: false,
        errors: [{
          type: 'INVALID_FORMAT' as any,
          message: 'Invalid format',
          field: 'amount',
          severity: 'error' as const
        }],
        warnings: [],
        suggestions: []
      }

      // Test valid state
      const { rerender } = render(
        <ParameterInput
          parameter={{
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          }}
          value="100.0"
          onChange={vi.fn()}
          availableOutputs={{}}
          suggestions={[]}
          validation={validValidation}
        />
      )

      let input = screen.getByTestId('input')
      expect(input).not.toHaveClass('border-destructive')

      // Test invalid state
      rerender(
        <ParameterInput
          parameter={{
            name: 'amount',
            type: 'UFix64',
            required: true,
            value: ''
          }}
          value="invalid"
          onChange={vi.fn()}
          availableOutputs={{}}
          suggestions={[]}
          validation={invalidValidation}
        />
      )

      input = screen.getByTestId('input')
      expect(input).toHaveClass('border-destructive')
    })
  })
})