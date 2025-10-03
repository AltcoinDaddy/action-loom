import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import CodePreview from '@/components/code-preview'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import { CadenceGenerator } from '@/lib/cadence-generator'
import { gracefulErrorHandler, ActionDiscoveryError } from '@/lib/graceful-error-handler'
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

// Mock console methods
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

describe('CodePreview Error Handling', () => {
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
    console.warn = vi.fn()
    
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
      const actionError = new Error(error.message) as ActionDiscoveryError
      actionError.name = 'ActionDiscoveryError'
      actionError.code = code
      actionError.retryable = ['API_ERROR', 'NETWORK_ERROR', 'TIMEOUT'].includes(code)
      actionError.context = context
      actionError.timestamp = Date.now()
      return actionError
    })
  })

  afterEach(() => {
    console.error = originalConsoleError
    console.warn = originalConsoleWarn
  })

  describe('Loading States', () => {
    it('should show loading state during code generation', async () => {
      // Mock a delayed response
      mockCadenceGenerator.generateTransactionWithDetails.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          code: 'transaction { execute { log("Hello") } }',
          errors: [],
          warnings: [],
          fallbackUsed: false,
          executionTime: 100,
          actionsUsed: ['transfer-flow']
        }), 100))
      )

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Should show loading state
      expect(screen.getByText('Generating...')).toBeInTheDocument()
      expect(screen.getAllByText(/Generating Cadence code/).length).toBeGreaterThan(0)

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
      })
    })

    it('should show retry loading state', async () => {
      // First call fails, second succeeds
      mockCadenceGenerator.generateTransactionWithDetails
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          code: 'transaction { execute { log("Hello") } }',
          errors: [],
          warnings: [],
          fallbackUsed: false,
          executionTime: 100,
          actionsUsed: ['transfer-flow']
        })

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByText('User friendly error message')).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Should show retry loading state
      expect(screen.getByText('Retrying...')).toBeInTheDocument()

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network connection failed')
      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(networkError)

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('User friendly error message')).toBeInTheDocument()
        expect(screen.getByText('Network Error')).toBeInTheDocument()
      })

      // Should show retry button for retryable errors
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })

    it('should handle API errors with proper error codes', async () => {
      const apiError = new Error('API Error') as ActionDiscoveryError
      apiError.name = 'ActionDiscoveryError'
      apiError.code = 'API_ERROR'
      apiError.retryable = true

      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(apiError)

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('API Error')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout') as ActionDiscoveryError
      timeoutError.name = 'ActionDiscoveryError'
      timeoutError.code = 'TIMEOUT'
      timeoutError.retryable = true

      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(timeoutError)

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('Request Timeout')).toBeInTheDocument()
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })
    })

    it('should handle discovery in progress errors', async () => {
      const discoveryError = new Error('Discovery in progress') as ActionDiscoveryError
      discoveryError.name = 'ActionDiscoveryError'
      discoveryError.code = 'DISCOVERY_IN_PROGRESS'
      discoveryError.retryable = false

      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(discoveryError)

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('Discovery in Progress')).toBeInTheDocument()
        // Should not show retry button for non-retryable errors
        expect(screen.queryByText('Retry')).not.toBeInTheDocument()
      })
    })

    it('should show error in code preview area', async () => {
      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(new Error('Test error'))

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText(/Code generation failed/)).toBeInTheDocument()
        expect(screen.getByText(/User friendly error message/)).toBeInTheDocument()
      })
    })
  })

  describe('Retry Functionality', () => {
    it('should retry failed operations', async () => {
      // First call fails, second succeeds
      mockCadenceGenerator.generateTransactionWithDetails
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          code: 'transaction { execute { log("Retry success") } }',
          errors: [],
          warnings: [],
          fallbackUsed: false,
          executionTime: 100,
          actionsUsed: ['transfer-flow']
        })

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('User friendly error message')).toBeInTheDocument()
      })

      // Click retry
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Wait for success
      await waitFor(() => {
        expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
        expect(screen.getByText(/Retry success/)).toBeInTheDocument()
      })

      // Should have called generateTransactionWithDetails twice
      expect(mockCadenceGenerator.generateTransactionWithDetails).toHaveBeenCalledTimes(2)
    })

    it('should prevent rapid retries', async () => {
      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(new Error('Network error'))

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      
      // Click retry multiple times rapidly
      fireEvent.click(retryButton)
      fireEvent.click(retryButton)
      fireEvent.click(retryButton)

      // Wait a bit for any async operations
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
      })

      // Should only call twice due to rate limiting (initial + 1 retry)
      expect(mockCadenceGenerator.generateTransactionWithDetails).toHaveBeenCalledTimes(2)
    })

    it('should show retry count for multiple failures', async () => {
      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(new Error('Persistent error'))

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Wait for initial error
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      // Retry multiple times
      for (let i = 0; i < 3; i++) {
        const retryButton = screen.getByText('Retry')
        fireEvent.click(retryButton)
        
        await waitFor(() => {
          expect(screen.getByText('User friendly error message')).toBeInTheDocument()
        })
        
        // Wait a bit to avoid rate limiting
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 100))
        })
      }

      // Should show warning about multiple retries
      await waitFor(() => {
        expect(screen.getByText(/Multiple retries failed/)).toBeInTheDocument()
      })
    })

    it('should disable retry button during retry', async () => {
      mockCadenceGenerator.generateTransactionWithDetails
        .mockRejectedValueOnce(new Error('Network error'))
        .mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          code: 'transaction { execute { log("Success") } }',
          errors: [],
          warnings: [],
          fallbackUsed: false,
          executionTime: 100,
          actionsUsed: ['transfer-flow']
        }), 100)))

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Button should be disabled during retry
      expect(retryButton).toBeDisabled()
      expect(screen.getByText('Retrying...')).toBeInTheDocument()

      // Wait for completion
      await waitFor(() => {
        expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
      })
    })
  })

  describe('Error Boundary', () => {
    it('should catch and display component errors', () => {
      // Create a component that throws an error
      const ThrowingComponent = () => {
        throw new Error('Component error')
      }

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Render the error boundary directly with a throwing component
      render(
        <ErrorBoundary
          fallback={
            <div>
              <h2>Code Preview Error</h2>
              <p>Component failed to render</p>
              <h3>Code Preview Unavailable</h3>
              <button>Refresh Page</button>
            </div>
          }
        >
          <ThrowingComponent />
        </ErrorBoundary>
      )

      expect(screen.getByText('Code Preview Error')).toBeInTheDocument()
      expect(screen.getByText('Component failed to render')).toBeInTheDocument()
      expect(screen.getByText('Code Preview Unavailable')).toBeInTheDocument()
      expect(screen.getByText('Refresh Page')).toBeInTheDocument()

      consoleSpy.mockRestore()
    })
  })

  describe('User Experience', () => {
    it('should show appropriate icons for different error types', async () => {
      const networkError = new Error('Network error') as ActionDiscoveryError
      networkError.name = 'ActionDiscoveryError'
      networkError.code = 'NETWORK_ERROR'
      networkError.retryable = true

      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(networkError)

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        // Should show network error icon (WifiOff) - check by class name
        const networkIcon = document.querySelector('.lucide-wifi-off')
        expect(networkIcon).toBeInTheDocument()
      })
    })

    it('should show elapsed time during long operations', async () => {
      vi.useFakeTimers()

      mockCadenceGenerator.generateTransactionWithDetails.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          success: true,
          code: 'transaction { execute { log("Hello") } }',
          errors: [],
          warnings: [],
          fallbackUsed: false,
          executionTime: 100,
          actionsUsed: ['transfer-flow']
        }), 5000))
      )

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText(/Elapsed time: 0s/)).toBeInTheDocument()
      })

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      // Check for updated elapsed time
      await waitFor(() => {
        expect(screen.getByText(/Elapsed time: 3s/)).toBeInTheDocument()
      })

      vi.useRealTimers()
    })

    it('should clear errors on successful retry', async () => {
      mockCadenceGenerator.generateTransactionWithDetails
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          code: 'transaction { execute { log("Success") } }',
          errors: [],
          warnings: [],
          fallbackUsed: false,
          executionTime: 100,
          actionsUsed: ['transfer-flow']
        })

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText('User friendly error message')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Retry
      const retryButton = screen.getByText('Retry')
      fireEvent.click(retryButton)

      // Wait for success - error should be cleared
      await waitFor(() => {
        expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Error message should be gone
      expect(screen.queryByText('User friendly error message')).not.toBeInTheDocument()
    })
  })

  describe('Summary Tab Error Handling', () => {
    it('should handle summary generation errors', async () => {
      mockCadenceGenerator.generateSummary.mockRejectedValue(new Error('Summary error'))

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      // Wait for initial generation to complete
      await waitFor(() => {
        expect(screen.getByText('Generated Successfully')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Switch to summary tab
      fireEvent.click(screen.getByText('Summary'))

      await waitFor(() => {
        expect(screen.getByText(/Summary generation failed/)).toBeInTheDocument()
        expect(screen.getByText(/Summary error/)).toBeInTheDocument()
      }, { timeout: 10000 })
    })

    it('should show error state in summary when main generation fails', async () => {
      mockCadenceGenerator.generateTransactionWithDetails.mockRejectedValue(new Error('Generation error'))

      render(<CodePreview workflow={mockWorkflow} parsedWorkflow={mockParsedWorkflow} />)

      await waitFor(() => {
        expect(screen.getByText('User friendly error message')).toBeInTheDocument()
      }, { timeout: 10000 })

      // Switch to summary tab
      fireEvent.click(screen.getByText('Summary'))

      await waitFor(() => {
        expect(screen.getByText(/Summary generation failed/)).toBeInTheDocument()
        expect(screen.getByText(/User friendly error message/)).toBeInTheDocument()
      }, { timeout: 10000 })
    })
  })
})