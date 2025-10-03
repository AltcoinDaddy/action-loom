import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import CodePreview from '@/components/code-preview'
import { CadenceGenerator } from '@/lib/cadence-generator'
import { gracefulErrorHandler } from '@/lib/graceful-error-handler'
import type { Workflow, ParsedWorkflow } from '@/lib/types'

// Mock dependencies
vi.mock('@/lib/cadence-generator')
vi.mock('@/lib/graceful-error-handler')

const mockCadenceGenerator = vi.mocked(CadenceGenerator)
const mockGracefulErrorHandler = vi.mocked(gracefulErrorHandler)

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined)
  }
})

describe('CodePreview Basic Functionality', () => {
  const mockWorkflow: Workflow = {
    id: 'test-workflow',
    name: 'Test Workflow',
    nodes: [
      {
        id: 'node-1',
        type: 'action',
        position: { x: 0, y: 0 },
        data: {
          actionId: 'transfer-flow',
          label: 'Transfer FLOW',
          inputs: { to: '0x123', amount: '10.0' }
        }
      }
    ],
    edges: []
  }

  const mockParsedWorkflow: ParsedWorkflow = {
    actions: [
      {
        id: 'transfer-flow',
        name: 'Transfer FLOW',
        inputs: { to: '0x123', amount: '10.0' },
        outputs: {}
      }
    ],
    dependencies: [],
    executionOrder: ['transfer-flow']
  }

  beforeEach(() => {
    vi.clearAllMocks()
    console.error = vi.fn()
    
    // Default successful mock
    mockCadenceGenerator.generateTransactionWithDetails.mockResolvedValue({
      success: true,
      code: 'transaction { execute { log("Hello") } }',
      errors: [],
      warnings: [],
      fallbackUsed: false,
      executionTime: 100,
      actionsUsed: ['transfer-flow']
    })

    mockCadenceGenerator.generateSummary.mockResolvedValue('Test workflow summary')
    
    mockGracefulErrorHandler.getUserFriendlyMessage.mockReturnValue('User friendly error message')
    mockGracefulErrorHandler.createActionDiscoveryError.mockImplementation((error, code, context) => {
      const actionError = new Error(error.message) as any
      actionError.name = 'ActionDiscoveryError'
      actionError.code = code
      actionError.retryable = ['API_ERROR', 'NETWORK_ERROR', 'TIMEOUT'].includes(code)
      actionError.context = context
      actionError.timestamp = Date.now()
      return actionError
    })
  })

  it('should render successfully with valid workflow', async () => {
    render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

    // Should show the component
    expect(screen.getByText('Generated Code')).toBeInTheDocument()
    expect(screen.getByText('Cadence')).toBeInTheDocument()
    expect(screen.getByText('Summary')).toBeInTheDocument()
    expect(screen.getByText('JSON')).toBeInTheDocument()

    // Wait for generation to complete
    await waitFor(() => {
      expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
    })
  })

  it('should show error state when generation fails', async () => {
    mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(new Error('Test error'))

    render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

    await waitFor(() => {
      expect(screen.getByText('User friendly error message')).toBeInTheDocument()
    })
  })

  it('should show retry button for retryable errors', async () => {
    const error = new Error('Network error')
    error.name = 'ActionDiscoveryError'
    ;(error as any).retryable = true
    
    mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(error)

    render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  it('should handle copy to clipboard', async () => {
    render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

    await waitFor(() => {
      expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
    })

    const copyButton = screen.getByText('Copy to Clipboard')
    fireEvent.click(copyButton)

    expect(navigator.clipboard.writeText).toHaveBeenCalled()
  })

  it('should switch between tabs', async () => {
    render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

    await waitFor(() => {
      expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
    })

    // Switch to JSON tab
    fireEvent.click(screen.getByText('JSON'))
    
    // Should show JSON content
    await waitFor(() => {
      expect(screen.getByText(/"actions":/)).toBeInTheDocument()
    })

    // Switch to Summary tab
    fireEvent.click(screen.getByText('Summary'))
    
    // Should show summary content
    await waitFor(() => {
      expect(screen.getByText('Test workflow summary')).toBeInTheDocument()
    })
  })
})