import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WorkflowCanvas } from '@/components/workflow-canvas'
import type { Workflow, SimulationResult, ActionMetadata, ValidationError } from '@/lib/types'

// Mock ReactFlow components
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, onDrop, onDragOver, nodes, edges }: any) => (
    <div 
      data-testid="react-flow"
      onDrop={onDrop}
      onDragOver={onDragOver}
      data-nodes-count={nodes?.length || 0}
      data-edges-count={edges?.length || 0}
    >
      {children}
      <div data-testid="react-flow-nodes">
        {nodes?.map((node: any) => (
          <div key={node.id} data-testid={`node-${node.id}`} data-node-type={node.type}>
            {node.data?.label}
          </div>
        ))}
      </div>
    </div>
  ),
  Background: () => <div data-testid="background" />,
  Controls: () => <div data-testid="controls" />,
  MiniMap: () => <div data-testid="minimap" />,
  useNodesState: (initialNodes: any) => {
    const [nodes, setNodes] = React.useState(initialNodes)
    const onNodesChange = vi.fn()
    return [nodes, setNodes, onNodesChange]
  },
  useEdgesState: (initialEdges: any) => {
    const [edges, setEdges] = React.useState(initialEdges)
    const onEdgesChange = vi.fn()
    return [edges, setEdges, onEdgesChange]
  },
  addEdge: vi.fn(),
}))

// Mock ActionNode component
vi.mock('@/components/action-node', () => ({
  ActionNode: ({ data }: any) => (
    <div data-testid="action-node" data-action-id={data.actionId}>
      {data.label}
    </div>
  ),
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  MousePointerClick: () => <div data-testid="mouse-pointer-click-icon" />,
  WorkflowIcon: () => <div data-testid="workflow-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  Zap: () => <div data-testid="zap-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
}))



describe('WorkflowCanvas', () => {
  const mockWorkflow: Workflow = {
    nodes: [],
    edges: []
  }

  const mockSetWorkflow = vi.fn()
  const mockOnConfigureAgent = vi.fn()
  const mockOnActionNodeSelect = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window.dispatchEvent
    Object.defineProperty(window, 'dispatchEvent', {
      value: vi.fn(),
      writable: true
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders without crashing', () => {
    render(
      <WorkflowCanvas
        workflow={mockWorkflow}
        setWorkflow={mockSetWorkflow}
      />
    )

    expect(screen.getByTestId('react-flow')).toBeInTheDocument()
    expect(screen.getByTestId('background')).toBeInTheDocument()
    expect(screen.getByTestId('controls')).toBeInTheDocument()
    expect(screen.getByTestId('minimap')).toBeInTheDocument()
  })

  it('displays empty state when no nodes are present', () => {
    render(
      <WorkflowCanvas
        workflow={mockWorkflow}
        setWorkflow={mockSetWorkflow}
      />
    )

    expect(screen.getByText('Build Your Workflow')).toBeInTheDocument()
    expect(screen.getByText(/Drag actions from the library/)).toBeInTheDocument()
    expect(screen.getByTestId('workflow-icon')).toBeInTheDocument()
  })

  it('renders workflow nodes correctly', () => {
    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
      />
    )

    expect(screen.getByTestId('node-node-1')).toBeInTheDocument()
    expect(screen.getByText('Test Action')).toBeInTheDocument()
  })

  it('handles drag and drop functionality', () => {
    render(
      <WorkflowCanvas
        workflow={mockWorkflow}
        setWorkflow={mockSetWorkflow}
        onActionNodeSelect={mockOnActionNodeSelect}
      />
    )

    const reactFlow = screen.getByTestId('react-flow')

    // Test dragOver handler
    fireEvent.dragOver(reactFlow)

    // Test drop functionality by creating a proper drop event
    const mockDataTransfer = {
      getData: vi.fn((type: string) => {
        switch (type) {
          case 'application/reactflow':
            return 'test-action-id'
          case 'actionName':
            return 'Test Action'
          case 'actionCategory':
            return 'defi'
          case 'actionType':
            return 'action'
          case 'actionMetadata':
            return JSON.stringify({
              id: 'test-action-id',
              parameters: []
            })
          default:
            return ''
        }
      })
    }

    // Mock getBoundingClientRect
    Object.defineProperty(reactFlow, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600
      })
    })

    fireEvent.drop(reactFlow, {
      dataTransfer: mockDataTransfer,
      clientX: 200,
      clientY: 150
    })

    expect(mockSetWorkflow).toHaveBeenCalled()
  })

  it('displays validation errors correctly', () => {
    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    const validationErrors: Record<string, ValidationError[]> = {
      'node-1': [
        {
          field: 'amount',
          message: 'Amount is required',
          type: 'required'
        }
      ]
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        validationErrors={validationErrors}
      />
    )

    // The node should be marked as having validation errors
    const reactFlow = screen.getByTestId('react-flow')
    expect(reactFlow).toHaveAttribute('data-nodes-count', '1')
  })

  it('displays simulation results when provided', () => {
    const simulationResult: SimulationResult = {
      success: true,
      gasUsed: 1000,
      balanceChanges: [
        {
          token: 'FLOW',
          amount: -10,
          address: '0x123'
        }
      ],
      events: [
        {
          type: 'TokenTransfer',
          data: 'Transfer completed'
        }
      ]
    }

    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        simulationResult={simulationResult}
      />
    )

    // Should show simulation button in controls (only when nodes exist)
    expect(screen.getByText('Simulation')).toBeInTheDocument()
    expect(screen.getByTestId('zap-icon')).toBeInTheDocument()
  })

  it('handles simulation panel toggle', () => {
    const simulationResult: SimulationResult = {
      success: true,
      gasUsed: 1000,
      balanceChanges: [],
      events: []
    }

    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        simulationResult={simulationResult}
      />
    )

    const simulationButton = screen.getByText('Simulation')
    fireEvent.click(simulationButton)

    expect(screen.getByText('Simulation Successful')).toBeInTheDocument()
    expect(screen.getByText('1,000')).toBeInTheDocument() // Gas used formatted
  })

  it('displays compatibility errors when nodes conflict', async () => {
    const workflowWithConflictingNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Action 1',
            actionId: 'action-1',
            category: 'defi',
            type: 'action',
            metadata: {
              id: 'action-1',
              compatibility: {
                conflictsWith: ['action-2']
              }
            } as ActionMetadata
          }
        },
        {
          id: 'node-2',
          type: 'action',
          position: { x: 200, y: 200 },
          data: {
            label: 'Action 2',
            actionId: 'action-2',
            category: 'defi',
            type: 'action',
            metadata: {
              id: 'action-2'
            } as ActionMetadata
          }
        }
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2'
        }
      ]
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithConflictingNodes}
        setWorkflow={mockSetWorkflow}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Compatibility Issues')).toBeInTheDocument()
      expect(screen.getByText(/Action 1 conflicts with Action 2/)).toBeInTheDocument()
    })
  })

  it('opens agent configuration panel', () => {
    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        onConfigureAgent={mockOnConfigureAgent}
      />
    )

    const configureButton = screen.getByRole('button', { name: /configure agent/i })
    fireEvent.click(configureButton)

    expect(screen.getByText('Schedule Type')).toBeInTheDocument()
    expect(screen.getByText('Event Triggers')).toBeInTheDocument()
  })

  it('handles agent configuration submission', () => {
    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        onConfigureAgent={mockOnConfigureAgent}
      />
    )

    // Open agent config panel
    const configureButton = screen.getByText('Configure Agent')
    fireEvent.click(configureButton)

    // Submit configuration
    const createButton = screen.getByText('Create Agent')
    fireEvent.click(createButton)

    expect(mockOnConfigureAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.objectContaining({
          type: 'recurring',
          interval: 3600
        }),
        eventTriggers: expect.any(Array),
        retryPolicy: expect.any(Object),
        notifications: expect.any(Object),
        permissions: expect.any(Array)
      })
    )
  })

  it('handles failed simulation results', () => {
    const failedSimulation: SimulationResult = {
      success: false,
      errors: [
        {
          message: 'Insufficient balance',
          code: 'INSUFFICIENT_BALANCE'
        }
      ]
    }

    const workflowWithNodes: Workflow = {
      nodes: [
        {
          id: 'node-1',
          type: 'action',
          position: { x: 100, y: 100 },
          data: {
            label: 'Test Action',
            actionId: 'test-action',
            category: 'defi',
            type: 'action'
          }
        }
      ],
      edges: []
    }

    render(
      <WorkflowCanvas
        workflow={workflowWithNodes}
        setWorkflow={mockSetWorkflow}
        simulationResult={failedSimulation}
      />
    )

    const simulationButton = screen.getByText('Simulation')
    fireEvent.click(simulationButton)

    expect(screen.getByText('Simulation Failed')).toBeInTheDocument()
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument()
  })

  it('auto-opens parameter configuration for actions with required parameters', async () => {
    render(
      <WorkflowCanvas
        workflow={mockWorkflow}
        setWorkflow={mockSetWorkflow}
        onActionNodeSelect={mockOnActionNodeSelect}
      />
    )

    const reactFlow = screen.getByTestId('react-flow')

    const mockDataTransfer = {
      getData: vi.fn((type: string) => {
        switch (type) {
          case 'application/reactflow':
            return 'test-action-id'
          case 'actionName':
            return 'Test Action'
          case 'actionCategory':
            return 'defi'
          case 'actionType':
            return 'action'
          case 'actionMetadata':
            return JSON.stringify({
              id: 'test-action-id',
              parameters: [
                {
                  name: 'amount',
                  type: 'UFix64',
                  required: true
                }
              ]
            })
          default:
            return ''
        }
      })
    }

    Object.defineProperty(reactFlow, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600
      })
    })

    fireEvent.drop(reactFlow, {
      dataTransfer: mockDataTransfer,
      clientX: 200,
      clientY: 150
    })

    // Should auto-open parameter configuration after a delay
    await waitFor(() => {
      expect(mockOnActionNodeSelect).toHaveBeenCalled()
    }, { timeout: 200 })
  })

  it('handles malformed action metadata gracefully', () => {
    render(
      <WorkflowCanvas
        workflow={mockWorkflow}
        setWorkflow={mockSetWorkflow}
      />
    )

    const reactFlow = screen.getByTestId('react-flow')
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const mockDataTransfer = {
      getData: vi.fn((type: string) => {
        switch (type) {
          case 'application/reactflow':
            return 'test-action-id'
          case 'actionName':
            return 'Test Action'
          case 'actionCategory':
            return 'defi'
          case 'actionType':
            return 'action'
          case 'actionMetadata':
            return 'invalid-json'
          default:
            return ''
        }
      })
    }

    Object.defineProperty(reactFlow, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600
      })
    })

    fireEvent.drop(reactFlow, {
      dataTransfer: mockDataTransfer,
      clientX: 200,
      clientY: 150
    })

    expect(consoleSpy).toHaveBeenCalledWith('Failed to parse action metadata:', expect.any(Error))
    expect(mockSetWorkflow).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })
})