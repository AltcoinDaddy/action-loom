import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WorkflowCanvas } from '@/components/workflow-canvas'
import type { Workflow, SimulationResult, AgentConfiguration } from '@/lib/types'

// Mock ReactFlow
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, onDrop, onDragOver, onConnect, nodes, edges }: any) => (
    <div 
      data-testid="react-flow"
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{ width: '100%', height: '400px', border: '1px solid #ccc' }}
    >
      <div data-testid="nodes-count">{nodes?.length || 0} nodes</div>
      <div data-testid="edges-count">{edges?.length || 0} edges</div>
      {children}
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  addEdge: vi.fn((edges, connection) => [...edges, { ...connection, id: `${connection.source}-${connection.target}` }]),
  useNodesState: (initialNodes: any) => [initialNodes, vi.fn(), vi.fn()],
  useEdgesState: (initialEdges: any) => [initialEdges, vi.fn(), vi.fn()],
}))

// Mock ActionNode component
vi.mock('@/components/action-node', () => ({
  ActionNode: () => <div data-testid="action-node" />
}))

describe('Workflow Canvas Integration Tests', () => {
  const mockSetWorkflow = vi.fn()
  const mockOnConfigureAgent = vi.fn()

  const emptyWorkflow: Workflow = {
    nodes: [],
    edges: []
  }

  const workflowWithNodes: Workflow = {
    nodes: [
      {
        id: '1',
        type: 'action',
        position: { x: 100, y: 100 },
        data: {
          label: 'Swap Tokens',
          actionId: 'swap-tokens',
          category: 'defi',
          type: 'swap-tokens',
          metadata: {
            id: 'swap-tokens',
            name: 'Swap Tokens',
            compatibility: {
              conflictsWith: [],
              requiredCapabilities: [],
              supportedNetworks: ['testnet'],
              minimumFlowVersion: '1.0.0'
            }
          }
        }
      },
      {
        id: '2',
        type: 'action',
        position: { x: 300, y: 200 },
        data: {
          label: 'Stake Tokens',
          actionId: 'stake-tokens',
          category: 'defi',
          type: 'stake-tokens',
          metadata: {
            id: 'stake-tokens',
            name: 'Stake Tokens',
            compatibility: {
              conflictsWith: ['swap-tokens'],
              requiredCapabilities: ['staking'],
              supportedNetworks: ['mainnet'],
              minimumFlowVersion: '1.0.0'
            }
          }
        }
      }
    ],
    edges: [
      {
        id: 'e1-2',
        source: '1',
        target: '2',
        animated: true
      }
    ]
  }

  const mockSimulationResult: SimulationResult = {
    success: true,
    gasUsed: 75000,
    balanceChanges: [
      {
        address: '0x123',
        token: 'FLOW',
        before: '100.0',
        after: '95.0',
        amount: -5.0
      }
    ],
    events: [
      { type: 'TokenSwap', data: 'FLOW -> USDC' }
    ],
    errors: [],
    warnings: [],
    executionTime: 1500
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty canvas with welcome message', () => {
    render(
      <WorkflowCanvas
        workflow={emptyWorkflow}
        setWorkflow={mockSetWorkflow}
      />
    )

    expect(screen.getByText('Build Your Workflow')).toBeInTheDocument()
    expect(screen.getByText(/drag actions from the library/i)).toBeInTheDocument()
    expect(screen.getByText('Drag & Drop')).toBeInTheDocument()
    expect(screen.getByText('Connect Nodes')).toBeInTheDocument()
  })

  it('renders workflow with nodes and edges', () => {
    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
      />
    )

    expect(screen.getByTestId('nodes-count')).toHaveTextContent('2 nodes')
    expect(screen.getByTestId('edges-count')).toHaveTextContent('1 edges')
  })

  it('shows compatibility errors for conflicting actions', () => {
    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
      />
    )

    // Should show compatibility warning since stake-tokens conflicts with swap-tokens
    expect(screen.getByText('Compatibility Issues')).toBeInTheDocument()
    expect(screen.getByText(/Stake Tokens conflicts with Swap Tokens/i)).toBeInTheDocument()
  })

  it('handles drag and drop of new actions', () => {
    render(
      <WorkflowCanvas
        workflow={emptyWorkflow}
        setWorkflow={mockSetWorkflow}
      />
    )

    const canvas = screen.getByTestId('react-flow')

    // Mock drag over event
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer()
    })

    fireEvent(canvas, dragOverEvent)
    expect(dragOverEvent.defaultPrevented).toBe(true)

    // Mock drop event with action data
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer(),
      clientX: 200,
      clientY: 150
    })

    // Set up data transfer
    dropEvent.dataTransfer?.setData('application/reactflow', 'new-action')
    dropEvent.dataTransfer?.setData('actionName', 'New Action')
    dropEvent.dataTransfer?.setData('actionCategory', 'defi')
    dropEvent.dataTransfer?.setData('actionType', 'new-action')
    dropEvent.dataTransfer?.setData('actionMetadata', JSON.stringify({
      id: 'new-action',
      name: 'New Action'
    }))

    // Mock getBoundingClientRect for position calculation
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })

    fireEvent(canvas, dropEvent)

    // Should call setWorkflow with new node
    expect(mockSetWorkflow).toHaveBeenCalled()
  })

  it('shows simulation results panel when provided', async () => {
    const user = userEvent.setup()

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        simulationResult={mockSimulationResult}
      />
    )

    // Should show simulation button in controls
    const simulationButton = screen.getByText('Simulation')
    expect(simulationButton).toBeInTheDocument()

    await user.click(simulationButton)

    // Should show simulation panel
    expect(screen.getByText('Simulation Successful')).toBeInTheDocument()
    expect(screen.getByText('75,000')).toBeInTheDocument() // Gas used
    expect(screen.getByText('Balance Changes:')).toBeInTheDocument()
    expect(screen.getByText('FLOW:')).toBeInTheDocument()
    expect(screen.getByText('-5')).toBeInTheDocument()
  })

  it('shows failed simulation results', async () => {
    const user = userEvent.setup()
    
    const failedSimulation: SimulationResult = {
      success: false,
      gasUsed: 0,
      balanceChanges: [],
      events: [],
      errors: [
        { type: 'ValidationError', message: 'Insufficient balance' }
      ],
      warnings: [],
      executionTime: 0
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        simulationResult={failedSimulation}
      />
    )

    const simulationButton = screen.getByText('Simulation')
    await user.click(simulationButton)

    expect(screen.getByText('Simulation Failed')).toBeInTheDocument()
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument()
  })

  it('shows agent configuration modal', async () => {
    const user = userEvent.setup()

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        onConfigureAgent={mockOnConfigureAgent}
      />
    )

    const configureButton = screen.getByText('Configure Agent')
    await user.click(configureButton)

    // Should show agent configuration modal
    expect(screen.getByText('Configure Agent')).toBeInTheDocument()
    expect(screen.getByText('Schedule Type')).toBeInTheDocument()
    expect(screen.getByText('Interval')).toBeInTheDocument()
    expect(screen.getByText('Event Triggers')).toBeInTheDocument()
  })

  it('handles agent configuration submission', async () => {
    const user = userEvent.setup()

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        onConfigureAgent={mockOnConfigureAgent}
      />
    )

    // Open agent config modal
    const configureButton = screen.getByText('Configure Agent')
    await user.click(configureButton)

    // Submit configuration
    const createButton = screen.getByText('Create Agent')
    await user.click(createButton)

    expect(mockOnConfigureAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.objectContaining({
          type: 'recurring',
          interval: 3600
        }),
        eventTriggers: [],
        retryPolicy: expect.any(Object),
        notifications: expect.any(Object),
        permissions: []
      })
    )
  })

  it('closes agent configuration modal on cancel', async () => {
    const user = userEvent.setup()

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        onConfigureAgent={mockOnConfigureAgent}
      />
    )

    // Open modal
    const configureButton = screen.getByText('Configure Agent')
    await user.click(configureButton)

    expect(screen.getByText('Configure Agent')).toBeInTheDocument()

    // Cancel
    const cancelButton = screen.getByText('Cancel')
    await user.click(cancelButton)

    // Modal should be closed
    expect(screen.queryByText('Configure Agent')).not.toBeInTheDocument()
  })

  it('closes simulation panel', async () => {
    const user = userEvent.setup()

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        simulationResult={mockSimulationResult}
      />
    )

    // Open simulation panel
    const simulationButton = screen.getByText('Simulation')
    await user.click(simulationButton)

    expect(screen.getByText('Simulation Successful')).toBeInTheDocument()

    // Close panel
    const closeButton = screen.getByText('×')
    await user.click(closeButton)

    // Panel should be closed
    expect(screen.queryByText('Simulation Successful')).not.toBeInTheDocument()
  })

  it('renders ReactFlow components', () => {
    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
      />
    )

    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('background')).toBeInTheDocument()
    expect(screen.getByTestId('controls')).toBeInTheDocument()
    expect(screen.getByTestId('minimap')).toBeInTheDocument()
  })

  it('shows canvas controls only when nodes exist', () => {
    const { rerender } = render(
      <WorkflowCanvas
        workflow={emptyWorkflow}
        setWorkflow={mockSetWorkflow}
      />
    )

    // No controls for empty workflow
    expect(screen.queryByText('Configure Agent')).not.toBeInTheDocument()

    rerender(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
      />
    )

    // Controls should appear with nodes
    expect(screen.getByText('Configure Agent')).toBeInTheDocument()
  })
})