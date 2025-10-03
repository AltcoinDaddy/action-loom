import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkflowBuilder } from '@/components/workflow-builder'

// Mock all child components
vi.mock('@/components/workflow-canvas', () => ({
  WorkflowCanvas: ({ workflow, setWorkflow, simulationResult, onConfigureAgent }: any) => (
    <div data-testid="workflow-canvas">
      <div data-testid="canvas-nodes">{workflow.nodes.length} nodes</div>
      <div data-testid="canvas-edges">{workflow.edges.length} edges</div>
      {simulationResult && (
        <div data-testid="simulation-result">
          Simulation: {simulationResult.success ? 'Success' : 'Failed'}
        </div>
      )}
      <button onClick={() => onConfigureAgent?.({ schedule: { type: 'recurring' } })}>
        Mock Configure Agent
      </button>
    </div>
  )
}))

vi.mock('@/components/action-library', () => ({
  ActionLibrary: () => (
    <div data-testid="action-library">
      <div>Action Library</div>
      <div>Mock actions available</div>
    </div>
  )
}))

vi.mock('@/components/code-preview', () => ({
  CodePreview: ({ workflow, parsedWorkflow }: any) => (
    <div data-testid="code-preview">
      <div>Code Preview</div>
      {parsedWorkflow && <div data-testid="generated-code">Generated Cadence Code</div>}
    </div>
  )
}))

vi.mock('@/components/execution-modal', () => ({
  ExecutionModal: ({ isExecuting, result, onClose }: any) => (
    <div data-testid="execution-modal">
      <div>Execution Modal</div>
      <div data-testid="execution-status">{isExecuting ? 'Executing...' : 'Ready'}</div>
      {result && <div data-testid="execution-result">{result.success ? 'Success' : 'Failed'}</div>}
      <button onClick={onClose}>Close Modal</button>
    </div>
  )
}))

vi.mock('@/components/nlp-input', () => ({
  NLPInput: ({ onWorkflowGenerated, onClose }: any) => (
    <div data-testid="nlp-input">
      <div>NLP Input Interface</div>
      <button 
        onClick={() => onWorkflowGenerated({
          nodes: [{ id: '1', type: 'action', position: { x: 0, y: 0 }, data: { label: 'Test Action' } }],
          edges: []
        })}
      >
        Generate Test Workflow
      </button>
      <button onClick={onClose}>Close NLP</button>
    </div>
  )
}))

// Mock WorkflowParser
vi.mock('@/lib/workflow-parser', () => ({
  WorkflowParser: {
    parse: vi.fn().mockReturnValue({
      actions: [],
      executionOrder: [],
      rootActions: [],
      metadata: {
        totalActions: 1,
        totalConnections: 0,
        estimatedGas: 50000,
        complexity: 0.5
      }
    }),
    validate: vi.fn().mockReturnValue({
      valid: true,
      errors: []
    })
  }
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Workflow Builder Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockClear()
  })

  it('renders all main components', () => {
    render(<WorkflowBuilder />)

    expect(screen.getByText('ActionLoom')).toBeInTheDocument()
    expect(screen.getByText('Flow Blockchain Builder')).toBeInTheDocument()
    expect(screen.getByTestId('action-library')).toBeInTheDocument()
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
    expect(screen.getByTestId('code-preview')).toBeInTheDocument()
  })

  it('shows input mode toggle buttons', () => {
    render(<WorkflowBuilder />)

    expect(screen.getByText('Visual')).toBeInTheDocument()
    expect(screen.getByText('Natural Language')).toBeInTheDocument()
  })

  it('starts in visual mode', () => {
    render(<WorkflowBuilder />)

    const visualButton = screen.getByText('Visual')
    const nlpButton = screen.getByText('Natural Language')

    // Visual should be active (has primary styling)
    expect(visualButton.closest('button')).toHaveClass('bg-primary')
    expect(nlpButton.closest('button')).not.toHaveClass('bg-primary')

    // NLP input should not be visible
    expect(screen.queryByTestId('nlp-input')).not.toBeInTheDocument()
  })

  it('switches to NLP mode when clicked', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    // Should show NLP input interface
    expect(screen.getByTestId('nlp-input')).toBeInTheDocument()
    expect(screen.getByText('NLP Input Interface')).toBeInTheDocument()

    // Button should be active
    expect(nlpButton.closest('button')).toHaveClass('bg-primary')
  })

  it('generates workflow from NLP input', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Switch to NLP mode
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    // Generate workflow from NLP
    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Should switch back to visual mode and show the workflow
    await waitFor(() => {
      expect(screen.getByTestId('canvas-nodes')).toHaveTextContent('1 nodes')
      expect(screen.queryByTestId('nlp-input')).not.toBeInTheDocument()
    })
  })

  it('closes NLP input when cancel is clicked', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Switch to NLP mode
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    expect(screen.getByTestId('nlp-input')).toBeInTheDocument()

    // Close NLP input
    const closeButton = screen.getByText('Close NLP')
    await user.click(closeButton)

    expect(screen.queryByTestId('nlp-input')).not.toBeInTheDocument()
  })

  it('shows workflow statistics when workflow exists', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Switch to NLP and generate workflow
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Should show workflow stats
    await waitFor(() => {
      expect(screen.getByText('1 Actions')).toBeInTheDocument()
      expect(screen.getByText('0 Connections')).toBeInTheDocument()
    })
  })

  it('enables save and execute buttons when workflow exists', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Initially buttons should be disabled
    const saveButton = screen.getByText('Save')
    const executeButton = screen.getByText('Execute Workflow')
    
    expect(saveButton).toBeDisabled()
    expect(executeButton).toBeDisabled()

    // Generate workflow
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Buttons should be enabled
    await waitFor(() => {
      expect(saveButton).not.toBeDisabled()
      expect(executeButton).not.toBeDisabled()
    })
  })

  it('handles workflow save', async () => {
    const user = userEvent.setup()
    
    // Mock successful save response
    ;(global.fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, workflowId: 'test-123' })
    })

    // Mock alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<WorkflowBuilder />)

    // Generate workflow first
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Save workflow
    await waitFor(() => {
      const saveButton = screen.getByText('Save')
      expect(saveButton).not.toBeDisabled()
    })

    const saveButton = screen.getByText('Save')
    await user.click(saveButton)

    // Should call API and show success
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/workflow/save', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }))
      expect(alertSpy).toHaveBeenCalledWith('Workflow saved! ID: test-123')
    })

    alertSpy.mockRestore()
  })

  it('handles workflow execution', async () => {
    const user = userEvent.setup()
    
    // Mock successful execution response
    ;(global.fetch as any).mockResolvedValueOnce({
      json: () => Promise.resolve({ success: true, transactionId: 'tx-456' })
    })

    render(<WorkflowBuilder />)

    // Generate workflow first
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Execute workflow
    await waitFor(() => {
      const executeButton = screen.getByText('Execute Workflow')
      expect(executeButton).not.toBeDisabled()
    })

    const executeButton = screen.getByText('Execute Workflow')
    await user.click(executeButton)

    // Should show execution modal
    expect(screen.getByTestId('execution-modal')).toBeInTheDocument()
    
    // Wait for the execution to start
    await waitFor(() => {
      expect(screen.getByTestId('execution-status')).toHaveTextContent('Executing...')
    })

    // Should call API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/workflow/execute', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }))
    })
  })

  it('handles agent configuration', async () => {
    const user = userEvent.setup()
    
    // Mock alert for agent config
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<WorkflowBuilder />)

    // Generate workflow first
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Configure agent
    await waitFor(() => {
      const configButton = screen.getByText('Mock Configure Agent')
      expect(configButton).toBeInTheDocument()
    })

    const configButton = screen.getByText('Mock Configure Agent')
    await user.click(configButton)

    expect(alertSpy).toHaveBeenCalledWith('Agent configuration saved! (Mock implementation)')

    alertSpy.mockRestore()
  })

  it('shows simulation results when available', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Generate workflow to trigger simulation
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    // Should show simulation result
    await waitFor(() => {
      expect(screen.getByTestId('simulation-result')).toBeInTheDocument()
    })
  })

  it('closes execution modal', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Generate workflow and execute
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    const generateButton = screen.getByText('Generate Test Workflow')
    await user.click(generateButton)

    await waitFor(() => {
      const executeButton = screen.getByText('Execute Workflow')
      expect(executeButton).not.toBeDisabled()
    })

    const executeButton = screen.getByText('Execute Workflow')
    await user.click(executeButton)

    expect(screen.getByTestId('execution-modal')).toBeInTheDocument()

    // Close modal
    const closeButton = screen.getByText('Close Modal')
    await user.click(closeButton)

    expect(screen.queryByTestId('execution-modal')).not.toBeInTheDocument()
  })

  it('shows getting started message initially', () => {
    render(<WorkflowBuilder />)

    expect(screen.getByText('Getting Started:')).toBeInTheDocument()
    expect(screen.getByText(/drag actions from the library/i)).toBeInTheDocument()
  })

  it('shows appropriate message for current input mode', () => {
    render(<WorkflowBuilder />)

    // Visual mode message
    expect(screen.getByText('Start building your workflow')).toBeInTheDocument()
  })

  it('switches input mode message when changing modes', async () => {
    const user = userEvent.setup()
    
    render(<WorkflowBuilder />)

    // Switch to NLP mode
    const nlpButton = screen.getByText('Natural Language')
    await user.click(nlpButton)

    expect(screen.getByText('Describe your workflow in natural language')).toBeInTheDocument()
  })
})