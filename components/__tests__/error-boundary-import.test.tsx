import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

// Test that ErrorBoundary can be imported correctly
import { ErrorBoundary, useErrorBoundary } from '@/components/ui/error-boundary'

describe('ErrorBoundary Import and Export', () => {
  it('can be imported as a class component', () => {
    expect(ErrorBoundary).toBeDefined()
    expect(typeof ErrorBoundary).toBe('function')
  })

  it('can be imported as a hook', () => {
    expect(useErrorBoundary).toBeDefined()
    expect(typeof useErrorBoundary).toBe('function')
  })

  it('can be instantiated and used', () => {
    const TestChild = () => <div>Test child component</div>

    render(
      <ErrorBoundary>
        <TestChild />
      </ErrorBoundary>
    )

    expect(screen.getByText('Test child component')).toBeInTheDocument()
  })

  it('hook can be used in functional components', () => {
    const TestComponent = () => {
      const { captureError, resetError } = useErrorBoundary()
      
      return (
        <div>
          <span>Hook test component</span>
          <button onClick={() => captureError(new Error('Test error'))}>
            Trigger Error
          </button>
          <button onClick={resetError}>
            Reset Error
          </button>
        </div>
      )
    }

    render(
      <ErrorBoundary>
        <TestComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Hook test component')).toBeInTheDocument()
    expect(screen.getByText('Trigger Error')).toBeInTheDocument()
    expect(screen.getByText('Reset Error')).toBeInTheDocument()
  })
})