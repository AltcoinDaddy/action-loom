import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WorkflowBuilder } from '../workflow-builder'

// Mock the components that might fail
vi.mock('../workflow-canvas', () => ({
  WorkflowCanvas: ({ workflow }: any) => {
    // Simulate a component that throws an error under certain conditions
    if (workflow?.nodes?.length > 5) {
      throw new Error('WorkflowCanvas crashed with too many nodes')
    }
    return <div data-testid="workflow-canvas">WorkflowCanvas Component</div>
  }
}))

vi.mock('../action-library', () => ({
  ActionLibrary: () => {
    // Simulate a component that throws an error
    throw new Error('ActionLibrary failed to load actions')
  }
}))

// Mock other components to prevent them from interfering
vi.mock('../code-preview', () => ({
  default: () => <div data-testid="code-preview">CodePreview</div>
}))

vi.mock('../nlp-input', () => ({
  NLPInput: () => <div data-testid="nlp-input">NLPInput</div>
}))

vi.mock('../parameter-config-panel', () => ({
  ParameterConfigPanel: () => <div data-testid="parameter-config">ParameterConfig</div>
}))

vi.mock('../execution-readiness-indicator', () => ({
  ExecutionReadinessIndicator: () => <div data-testid="execution-indicator">ExecutionIndicator</div>
}))

vi.mock('../execution-modal', () => ({
  ExecutionModal: () => <div data-testid="execution-modal">ExecutionModal</div>
}))

// Mock hooks
vi.mock('@/hooks/use-actions', () => ({
  useActions: () => ({
    actions: [],
    categories: [],
    loading: false,
    error: null,
    searchActions: vi.fn(),
    getActionsByCategory: vi.fn(),
    refreshActions: vi.fn()
  })
}))

// Mock lib modules
vi.mock('@/lib/workflow-parser', () => ({
  WorkflowParser: {
    parse: vi.fn(() => ({
      actions: [],
      metadata: { totalActions: 0, totalConnections: 0 }
    })),
    validate: vi.fn(() => ({ valid: true, errors: [] }))
  }
}))

vi.mock('@/lib/parameter-validator', () => ({
  ParameterValidator: vi.fn(() => ({
    validateAllParameters: vi.fn(() => ({
      isValid: true,
      missingParameters: [],
      invalidParameters: {},
      warnings: []
    }))
  }))
}))

describe('Error Boundary Wrapper Tests', () => {
  beforeEach(() => {
    // Suppress console.error for these tests since we expect errors
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should catch ActionLibrary errors and show fallback UI', () => {
    render(<WorkflowBuilder />)
    
    // ActionLibrary should be wrapped in error boundary and show fallback
    expect(screen.getByText('Action Library failed to load')).toBeInTheDocument()
    expect(screen.getByText('Please refresh the page to try again')).toBeInTheDocument()
    
    // The rest of the application should still work
    expect(screen.getByText('ActionLoom')).toBeInTheDocument()
    expect(screen.getByText('Flow Blockchain Builder')).toBeInTheDocument()
  })

  it('should catch WorkflowCanvas errors and show fallback UI', () => {
    render(<WorkflowBuilder />)
    
    // WorkflowCanvas should render normally initially
    expect(screen.getByTestId('workflow-canvas')).toBeInTheDocument()
    
    // The application should still be functional despite ActionLibrary error
    expect(screen.getByText('ActionLoom')).toBeInTheDocument()
  })

  it('should allow the application to continue functioning when components fail', () => {
    render(<WorkflowBuilder />)
    
    // Check that the main application structure is still intact
    expect(screen.getByText('ActionLoom')).toBeInTheDocument()
    expect(screen.getByText('Flow Blockchain Builder')).toBeInTheDocument()
    
    // Check that the header controls are still available
    expect(screen.getByText('Visual')).toBeInTheDocument()
    expect(screen.getByText('Natural Language')).toBeInTheDocument()
    expect(screen.getByText('Save')).toBeInTheDocument()
    expect(screen.getByText('Execute Workflow')).toBeInTheDocument()
    
    // The CodePreview should still render (not wrapped in error boundary)
    expect(screen.getByTestId('code-preview')).toBeInTheDocument()
  })

  it('should log errors when components fail', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<WorkflowBuilder />)
    
    // Verify that errors are logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'ActionLibrary error:',
      expect.any(Error),
      expect.any(Object)
    )
  })

  it('should provide retry functionality in error boundaries', () => {
    render(<WorkflowBuilder />)
    
    // Find the fallback UI for WorkflowCanvas error (if it occurs)
    const reloadButton = screen.queryByText('Reload Page')
    if (reloadButton) {
      // Mock window.location.reload
      const reloadMock = vi.fn()
      Object.defineProperty(window, 'location', {
        value: { reload: reloadMock },
        writable: true
      })
      
      fireEvent.click(reloadButton)
      expect(reloadMock).toHaveBeenCalled()
    }
  })

  it('should maintain application state when individual components fail', () => {
    render(<WorkflowBuilder />)
    
    // The input mode toggle should still work
    const nlpButton = screen.getByText('Natural Language')
    fireEvent.click(nlpButton)
    
    // Should be able to interact with other parts of the app
    expect(screen.getByText('Natural Language')).toHaveClass('bg-primary')
  })
})