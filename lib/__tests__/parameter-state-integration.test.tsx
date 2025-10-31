/**
 * Parameter State Integration Tests
 * 
 * Integration tests for the complete parameter state synchronization flow
 * between ParameterInput, ParameterConfigPanel, and WorkflowBuilder
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ParameterInput } from '@/components/parameter-input'
import { ParameterConfigPanel } from '@/components/parameter-config-panel'
import { ActionParameter, ActionMetadata, ActionOutput } from '@/lib/types'
import { parameterStateDebugger } from '@/lib/parameter-state-debugger'

// Mock the parameter state debugger
vi.mock('@/lib/parameter-state-debugger', () => ({
  parameterStateDebugger: {
    logParameterChange: vi.fn(),
    logParameterCleanup: vi.fn(),
    takeSnapshot: vi.fn(),
    validateStateConsistency: vi.fn().mockReturnValue({ isConsistent: true, issues: [] }),
    setEnabled: vi.fn(),
    clearHistory: vi.fn()
  }
}))

// Mock the parameter value processor
vi.mock('@/lib/parameter-value-processor', () => ({
  ParameterValueProcessor: {
    sanitizeInput: vi.fn().mockReturnValue({
      value: 'processed_value',
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false
    }),
    convertType: vi.fn().mockReturnValue({
      value: true,
      isValid: true,
      errors: [],
      warnings: []
    }),
    processValue: vi.fn().mockReturnValue({
      value: 'processed_value',
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false
    })
  }
}))

describe('Parameter State Integration', () => {
  const mockParameter: ActionParameter = {
    name: 'amount',
    type: 'UFix64',
    required: true,
    description: 'Token amount to transfer'
  }

  const mockAction: ActionMetadata = {
    id: 'transfer-tokens',
    name: 'Transfer Tokens',
    description: 'Transfer tokens between accounts',
    category: 'Token Operations',
    parameters: [mockParameter],
    outputs: [],
    cadenceTemplate: 'transaction { execute { } }'
  }

  const mockAvailableOutputs: Record<string, ActionOutput> = {
    'previous-action.balance': {
      name: 'balance',
      type: 'UFix64',
      description: 'Account balance'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    parameterStateDebugger.setEnabled(true)
  })

  afterEach(() => {
    parameterStateDebugger.clearHistory()
  })

  describe('ParameterInput State Synchronization', () => {
    it('should synchronize input changes with parent state', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()
      const initialValue = '10.0'

      render(
        <ParameterInput
          parameter={mockParameter}
          value={initialValue}
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton') // UFix64 renders as number input
      expect(input).toHaveValue(10)

      // Type new value
      await user.clear(input)
      await user.type(input, '25.5')

      // Wait for the requestAnimationFrame callback
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      // Should be called with the processed value
      expect(mockOnChange).toHaveBeenCalledWith('processed_value')
    })

    it('should handle focus and blur events correctly', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(
        <ParameterInput
          parameter={mockParameter}
          value="10.0"
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')

      // Focus the input
      await user.click(input)
      expect(input).toHaveFocus()

      // Blur the input
      await user.tab()
      expect(input).not.toHaveFocus()

      // Should trigger value processing on blur
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })
    })

    it('should handle switch inputs for boolean parameters', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()
      const booleanParameter: ActionParameter = {
        name: 'enabled',
        type: 'Bool',
        required: false,
        description: 'Enable feature'
      }

      render(
        <ParameterInput
          parameter={booleanParameter}
          value={false}
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      const switchElement = screen.getByRole('switch')
      expect(switchElement).not.toBeChecked()

      // Click the switch
      await user.click(switchElement)

      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(true)
      })
    })
  })

  describe('ParameterConfigPanel State Management', () => {
    it('should manage local state and sync with parent', async () => {
      const user = userEvent.setup()
      const mockOnParameterChange = vi.fn()
      const mockOnValidationChange = vi.fn()
      const initialValues = { amount: '10.0' }

      render(
        <ParameterConfigPanel
          action={mockAction}
          currentValues={initialValues}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
        />
      )

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveValue(10)

      // Change the input value
      await user.clear(input)
      await user.type(input, '25.5')

      // Should update local state immediately and debounce parent update
      await waitFor(() => {
        expect(mockOnParameterChange).toHaveBeenCalled()
      }, { timeout: 200 })

      expect(mockOnParameterChange).toHaveBeenCalledWith('amount', 'processed_value')
    })

    it('should handle validation changes', async () => {
      const mockOnParameterChange = vi.fn()
      const mockOnValidationChange = vi.fn()
      const initialValues = { amount: '' } // Empty value should trigger validation error

      render(
        <ParameterConfigPanel
          action={mockAction}
          currentValues={initialValues}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
        />
      )

      // Should trigger validation on mount
      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalled()
      }, { timeout: 200 })

      // Should be called with validation results
      const [isValid, errors] = mockOnValidationChange.mock.calls[0]
      expect(typeof isValid).toBe('boolean')
      expect(Array.isArray(errors)).toBe(true)
    })

    it('should sync local values when props change', () => {
      const mockOnParameterChange = vi.fn()
      const mockOnValidationChange = vi.fn()
      const initialValues = { amount: '10.0' }

      const { rerender } = render(
        <ParameterConfigPanel
          action={mockAction}
          currentValues={initialValues}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
        />
      )

      const input = screen.getByRole('spinbutton')
      expect(input).toHaveValue(10)

      // Update props with new values
      const updatedValues = { amount: '20.0' }
      rerender(
        <ParameterConfigPanel
          action={mockAction}
          currentValues={updatedValues}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
        />
      )

      // Input should reflect the new value
      expect(input).toHaveValue(20)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should handle onChange callback errors gracefully', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn().mockImplementation(() => {
        throw new Error('Callback failed')
      })

      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ParameterInput
          parameter={mockParameter}
          value="10.0"
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')

      // Type new value - should not crash despite callback error
      await user.clear(input)
      await user.type(input, '25.5')

      // Should still attempt to call the callback
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalled()
      })

      // Should log the error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error in onChange callback:'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should handle parameter validation errors', async () => {
      const user = userEvent.setup()
      const mockOnParameterChange = vi.fn()
      const mockOnValidationChange = vi.fn()

      // Mock validation to return errors
      const mockValidation = {
        isValid: false,
        errors: [{ type: 'validation', message: 'Invalid value', severity: 'error' as const }],
        warnings: []
      }

      render(
        <ParameterConfigPanel
          action={mockAction}
          currentValues={{ amount: 'invalid_value' }}
          onParameterChange={mockOnParameterChange}
          onValidationChange={mockOnValidationChange}
          availableOutputs={mockAvailableOutputs}
        />
      )

      // Should handle validation errors gracefully
      await waitFor(() => {
        expect(mockOnValidationChange).toHaveBeenCalled()
      }, { timeout: 200 })

      const [isValid, errors] = mockOnValidationChange.mock.calls[0]
      expect(isValid).toBe(false)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('Reference Mode Handling', () => {
    it('should switch between direct input and reference mode', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(
        <ParameterInput
          parameter={mockParameter}
          value="10.0"
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      // Should show mode toggle when outputs are available
      const referenceButton = screen.getByText('Reference')
      expect(referenceButton).toBeInTheDocument()

      // Click to switch to reference mode
      await user.click(referenceButton)

      // Should show reference selector
      const referenceSelector = screen.getByText('Select output reference...')
      expect(referenceSelector).toBeInTheDocument()

      // Switch back to direct input
      const directInputButton = screen.getByText('Direct Input')
      await user.click(directInputButton)

      // Should show input field again
      const input = screen.getByRole('spinbutton')
      expect(input).toBeInTheDocument()
    })

    it('should handle reference selection', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(
        <ParameterInput
          parameter={mockParameter}
          value=""
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      // Switch to reference mode
      const referenceButton = screen.getByText('Reference')
      await user.click(referenceButton)

      // Open reference selector
      const referenceSelector = screen.getByText('Select output reference...')
      await user.click(referenceSelector)

      // Select a reference
      const referenceOption = screen.getByText('previous-action.balance')
      await user.click(referenceOption)

      // Should call onChange with the reference key
      expect(mockOnChange).toHaveBeenCalledWith('previous-action.balance')
    })
  })

  describe('Keyboard Navigation', () => {
    it('should handle escape key to reset value', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()
      const initialValue = '10.0'

      render(
        <ParameterInput
          parameter={mockParameter}
          value={initialValue}
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')
      
      // Change the value
      await user.clear(input)
      await user.type(input, '25.5')

      // Press escape to reset
      await user.keyboard('{Escape}')

      // Should reset to original value
      expect(input).toHaveValue(10)
    })

    it('should handle enter key to blur input', async () => {
      const user = userEvent.setup()
      const mockOnChange = vi.fn()

      render(
        <ParameterInput
          parameter={mockParameter}
          value="10.0"
          onChange={mockOnChange}
          availableOutputs={mockAvailableOutputs}
          suggestions={[]}
        />
      )

      const input = screen.getByRole('spinbutton')
      
      // Focus the input
      await user.click(input)
      expect(input).toHaveFocus()

      // Press enter
      await user.keyboard('{Enter}')

      // Should blur the input
      expect(input).not.toHaveFocus()
    })
  })
})