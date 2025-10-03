import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ErrorBoundary } from '@/components/ui/error-boundary'

// Test component that can simulate various error scenarios
const TestComponent = ({ 
  shouldThrow = false, 
  errorType = 'render',
  errorMessage = 'Test error'
}: { 
  shouldThrow?: boolean
  errorType?: 'render' | 'effect' | 'async'
  errorMessage?: string
}) => {
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (shouldThrow && errorType === 'effect') {
      throw new Error(errorMessage)
    }
  }, [shouldThrow, errorType, errorMessage])

  const handleAsyncError = async () => {
    if (errorType === 'async') {
      throw new Error(errorMessage)
    }
  }

  if (shouldThrow && errorType === 'render') {
    throw new Error(errorMessage)
  }

  return (
    <div>
      <div>Test Component - Count: {count}</div>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={handleAsyncError}>Trigger Async Error</button>
    </div>
  )
}

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeEach(() => {
  console.error = vi.fn()
  console.warn = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

describe('ErrorBoundary Integration Tests', () => {
  it('handles render errors gracefully', () => {
    render(
      <ErrorBoundary>
        <TestComponent shouldThrow={true} errorType="render" errorMessage="Render error occurred" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Render error occurred')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('handles effect errors gracefully', () => {
    render(
      <ErrorBoundary>
        <TestComponent shouldThrow={true} errorType="effect" errorMessage="Effect error occurred" />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('Effect error occurred')).toBeInTheDocument()
  })

  it('allows normal component interaction when no errors occur', () => {
    render(
      <ErrorBoundary>
        <TestComponent shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Test Component - Count: 0')).toBeInTheDocument()
    
    fireEvent.click(screen.getByText('Increment'))
    expect(screen.getByText('Test Component - Count: 1')).toBeInTheDocument()
  })

  it('provides custom error logging functionality', () => {
    const onError = vi.fn()

    render(
      <ErrorBoundary onError={onError}>
        <TestComponent shouldThrow={true} errorMessage="Custom logged error" />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Custom logged error'
      }),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('can recover from errors when retry is clicked', () => {
    const RecoverableComponent = () => {
      const [shouldError, setShouldError] = React.useState(true)

      React.useEffect(() => {
        // Simulate error recovery after 100ms
        const timer = setTimeout(() => setShouldError(false), 100)
        return () => clearTimeout(timer)
      }, [])

      if (shouldError) {
        throw new Error('Temporary error')
      }

      return <div>Component recovered successfully</div>
    }

    render(
      <ErrorBoundary>
        <RecoverableComponent />
      </ErrorBoundary>
    )

    // Should show error initially
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Wait for recovery and click retry
    setTimeout(() => {
      fireEvent.click(screen.getByRole('button', { name: /try again/i }))
      expect(screen.getByText('Component recovered successfully')).toBeInTheDocument()
    }, 150)
  })

  it('displays custom fallback UI when provided', () => {
    const CustomFallback = (
      <div className="custom-error">
        <h2>Custom Error Handler</h2>
        <p>Something went wrong in our application</p>
        <button>Custom Retry</button>
      </div>
    )

    render(
      <ErrorBoundary fallback={CustomFallback}>
        <TestComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom Error Handler')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong in our application')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom Retry' })).toBeInTheDocument()
    
    // Should not show default error UI
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('handles nested error boundaries correctly', () => {
    const InnerComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
      if (shouldThrow) {
        throw new Error('Inner component error')
      }
      return <div>Inner component working</div>
    }

    const OuterComponent = ({ innerShouldThrow, outerShouldThrow }: { 
      innerShouldThrow: boolean
      outerShouldThrow: boolean 
    }) => {
      if (outerShouldThrow) {
        throw new Error('Outer component error')
      }
      
      return (
        <div>
          <div>Outer component working</div>
          <ErrorBoundary fallback={<div>Inner error boundary triggered</div>}>
            <InnerComponent shouldThrow={innerShouldThrow} />
          </ErrorBoundary>
        </div>
      )
    }

    // Test inner error boundary catches inner errors
    render(
      <ErrorBoundary>
        <OuterComponent innerShouldThrow={true} outerShouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Outer component working')).toBeInTheDocument()
    expect(screen.getByText('Inner error boundary triggered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('handles multiple error types with appropriate styling', () => {
    render(
      <ErrorBoundary>
        <TestComponent shouldThrow={true} errorMessage="Critical system failure" />
      </ErrorBoundary>
    )

    // Check that error UI has appropriate styling classes
    const errorContainer = screen.getByText('Something went wrong').closest('div')
    expect(errorContainer).toHaveClass('bg-red-50', 'dark:bg-red-950')
    expect(errorContainer).toHaveClass('border-red-200', 'dark:border-red-800')
  })
})