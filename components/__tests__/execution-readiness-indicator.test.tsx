import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ExecutionReadinessIndicator } from '../execution-readiness-indicator'
import type { ParsedWorkflow, ActionMetadata } from '@/lib/types'

// Mock fetch
global.fetch = vi.fn()

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
      nextActions: [],
      position: { x: 0, y: 0 }
    }
  ],
  executionOrder: ['action-1'],
  rootActions: ['action-1'],
  metadata: {
    totalActions: 1,
    totalConnections: 0,
    createdAt: new Date().toISOString()
  }
}

const mockActionMetadata: Record<string, ActionMetadata> = {
  'swap-tokens': {
    id: 'swap-tokens',
    name: 'Swap Tokens',
    description: 'Swap one token for another',
    category: 'defi',
    version: '1.0.0',
    inputs: [],
    outputs: [
      { name: 'outputToken', type: 'Address', description: 'Output token address' },
      { name: 'outputAmount', type: 'UFix64', description: 'Output token amount' }
    ],
    parameters: [
      { name: 'fromToken', type: 'Address', value: '', required: true },
      { name: 'toToken', type: 'Address', value: '', required: true },
      { name: 'amount', type: 'UFix64', value: '', required: true }
    ] as any,
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 5000,
    securityLevel: 'medium' as any,
    author: 'ActionLoom',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

describe('ExecutionReadinessIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should show "Add actions to validate workflow" when no workflow is provided', () => {
    render(
      <ExecutionReadinessIndicator
        workflow={null}
        actionMetadata={{}}
        parameterValues={{}}
      />
    )

    expect(screen.getByText('Add actions to validate workflow')).toBeInTheDocument()
  })

  it('should show "Add actions to validate workflow" when workflow has no actions', () => {
    const emptyWorkflow: ParsedWorkflow = {
      actions: [],
      executionOrder: [],
      rootActions: [],
      metadata: {
        totalActions: 0,
        totalConnections: 0,
        createdAt: new Date().toISOString()
      }
    }

    render(
      <ExecutionReadinessIndicator
        workflow={emptyWorkflow}
        actionMetadata={{}}
        parameterValues={{}}
      />
    )

    expect(screen.getByText('Add actions to validate workflow')).toBeInTheDocument()
  })

  it('should show validating state initially', async () => {
    // Mock fetch to delay response
    vi.mocked(fetch).mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve({
          canExecute: true,
          executionReadiness: {
            parametersConfigured: true,
            dataFlowValid: true,
            noCircularDependencies: true,
            allActionsValid: true,
            readinessScore: 100,
            readinessMessage: 'Workflow is ready for execution'
          },
          blockingErrors: [],
          warnings: [],
          estimatedGasCost: 5000,
          estimatedExecutionTime: 2000
        })
      } as Response), 1000))
    )

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={{}}
      />
    )

    // Wait for the debounced validation to start
    await waitFor(() => {
      expect(screen.getByText('Validating...')).toBeInTheDocument()
    }, { timeout: 1000 })
  })

  it('should display ready to execute status for valid workflow', async () => {
    // Mock successful validation response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        canExecute: true,
        executionReadiness: {
          parametersConfigured: true,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: true,
          readinessScore: 100,
          readinessMessage: 'Workflow is ready for execution'
        },
        blockingErrors: [],
        warnings: [],
        estimatedGasCost: 5000,
        estimatedExecutionTime: 2000
      })
    } as Response)

    const parameterValues = {
      'action-1': {
        fromToken: '0x1654653399040a61',
        toToken: '0x3c5959b568896393',
        amount: '10.0'
      }
    }

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={parameterValues}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Ready to Execute')).toBeInTheDocument()
    })

    expect(screen.getByText('Workflow is ready for execution')).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.getByText('~5,000 gas')).toBeInTheDocument()
    expect(screen.getByText('~2s')).toBeInTheDocument()
  })

  it('should display not ready status for invalid workflow', async () => {
    // Mock validation response with errors
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        canExecute: false,
        executionReadiness: {
          parametersConfigured: false,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: false,
          readinessScore: 50,
          readinessMessage: 'Workflow needs configuration before execution'
        },
        blockingErrors: [
          {
            type: 'MISSING_REQUIRED',
            message: 'fromToken is required for execution',
            field: 'fromToken',
            severity: 'error'
          }
        ],
        warnings: [],
        estimatedGasCost: 5000,
        estimatedExecutionTime: 2000
      })
    } as Response)

    const parameterValues = {
      'action-1': {
        toToken: '0x3c5959b568896393',
        amount: '10.0'
        // Missing fromToken
      }
    }

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={parameterValues}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Not Ready')).toBeInTheDocument()
    })

    expect(screen.getByText('Workflow needs configuration before execution')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    expect(screen.getByText('Blocking Issues:')).toBeInTheDocument()
    expect(screen.getByText('fromToken is required for execution')).toBeInTheDocument()
  })

  it('should display warnings for workflow with warnings but no blocking errors', async () => {
    // Mock validation response with warnings
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        canExecute: true,
        executionReadiness: {
          parametersConfigured: true,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: true,
          readinessScore: 100,
          readinessMessage: 'Workflow is ready for execution'
        },
        blockingErrors: [],
        warnings: [
          {
            type: 'TYPE_MISMATCH',
            message: 'Type conversion: String will be converted to UFix64',
            severity: 'warning'
          }
        ],
        estimatedGasCost: 5000,
        estimatedExecutionTime: 2000
      })
    } as Response)

    const parameterValues = {
      'action-1': {
        fromToken: '0x1654653399040a61',
        toToken: '0x3c5959b568896393',
        amount: '10.0'
      }
    }

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={parameterValues}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Ready to Execute')).toBeInTheDocument()
    })

    expect(screen.getByText('Warnings:')).toBeInTheDocument()
    expect(screen.getByText('Type conversion: String will be converted to UFix64')).toBeInTheDocument()
  })

  it('should show detailed status checks', async () => {
    // Mock validation response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        canExecute: false,
        executionReadiness: {
          parametersConfigured: false,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: false,
          readinessScore: 75,
          readinessMessage: 'Workflow is mostly ready, minor issues remain'
        },
        blockingErrors: [],
        warnings: [],
        estimatedGasCost: 5000,
        estimatedExecutionTime: 2000
      })
    } as Response)

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={{}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Parameters')).toBeInTheDocument()
    })

    expect(screen.getByText('Data Flow')).toBeInTheDocument()
    expect(screen.getByText('Dependencies')).toBeInTheDocument()
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })

  it('should call onValidationUpdate callback when validation completes', async () => {
    const mockOnValidationUpdate = vi.fn()

    // Mock validation response
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        canExecute: true,
        executionReadiness: {
          parametersConfigured: true,
          dataFlowValid: true,
          noCircularDependencies: true,
          allActionsValid: true,
          readinessScore: 100,
          readinessMessage: 'Workflow is ready for execution'
        },
        blockingErrors: [],
        warnings: [],
        estimatedGasCost: 5000,
        estimatedExecutionTime: 2000
      })
    } as Response)

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={{}}
        onValidationUpdate={mockOnValidationUpdate}
      />
    )

    await waitFor(() => {
      expect(mockOnValidationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          canExecute: true,
          executionReadiness: expect.objectContaining({
            readinessScore: 100
          })
        })
      )
    })
  })

  it('should handle validation API errors gracefully', async () => {
    // Mock fetch to reject
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    render(
      <ExecutionReadinessIndicator
        workflow={mockWorkflow}
        actionMetadata={mockActionMetadata}
        parameterValues={{}}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Validation unavailable')).toBeInTheDocument()
    })
  })
})