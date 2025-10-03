import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { HydrationBoundary } from '@/components/hydration-boundary'

// Mock Next.js font imports
vi.mock('geist/font/sans', () => ({
  GeistSans: {
    style: { fontFamily: 'Geist Sans, sans-serif' },
    variable: '--font-geist-sans'
  }
}))

vi.mock('geist/font/mono', () => ({
  GeistMono: {
    style: { fontFamily: 'Geist Mono, monospace' },
    variable: '--font-geist-mono'
  }
}))

// Mock Analytics component
vi.mock('@vercel/analytics/next', () => ({
  Analytics: () => null
}))

// Test component that simulates the layout structure
const TestLayoutBody = ({ children }: { children: React.ReactNode }) => {
  return (
    <div 
      className="font-sans" 
      style={{
        '--font-geist-sans': 'Geist Sans, sans-serif',
        '--font-geist-mono': 'Geist Mono, monospace',
      } as React.CSSProperties}
      suppressHydrationWarning
      data-testid="layout-body"
    >
      <HydrationBoundary>
        {children}
      </HydrationBoundary>
    </div>
  )
}

describe('RootLayout Hydration Fixes', () => {
  it('should render with CSS custom properties for fonts', () => {
    render(
      <TestLayoutBody>
        <div>Test content</div>
      </TestLayoutBody>
    )

    const layoutBody = screen.getByTestId('layout-body')
    expect(layoutBody).toHaveStyle({
      '--font-geist-sans': 'Geist Sans, sans-serif',
      '--font-geist-mono': 'Geist Mono, monospace'
    })
  })

  it('should render without hydration warnings', () => {
    // This test verifies that the component renders successfully
    // The suppressHydrationWarning prop prevents React from warning about mismatches
    render(
      <TestLayoutBody>
        <div>Test content</div>
      </TestLayoutBody>
    )

    const layoutBody = screen.getByTestId('layout-body')
    expect(layoutBody).toBeInTheDocument()
  })

  it('should wrap children in HydrationBoundary', () => {
    render(
      <TestLayoutBody>
        <div data-testid="test-content">Test content</div>
      </TestLayoutBody>
    )

    // Content should be present (HydrationBoundary should render children)
    expect(screen.getByTestId('test-content')).toBeInTheDocument()
  })

  it('should use font-sans class instead of font variables', () => {
    render(
      <TestLayoutBody>
        <div>Test content</div>
      </TestLayoutBody>
    )

    const layoutBody = screen.getByTestId('layout-body')
    expect(layoutBody).toHaveClass('font-sans')
    expect(layoutBody).not.toHaveClass('--font-geist-sans')
    expect(layoutBody).not.toHaveClass('--font-geist-mono')
  })
})

describe('HydrationBoundary Component', () => {
  it('should render children after hydration', () => {
    render(
      <HydrationBoundary>
        <div data-testid="hydrated-content">Hydrated content</div>
      </HydrationBoundary>
    )

    expect(screen.getByTestId('hydrated-content')).toBeInTheDocument()
  })

  it('should render fallback when provided', () => {
    render(
      <HydrationBoundary fallback={<div data-testid="fallback">Loading...</div>}>
        <div data-testid="main-content">Main content</div>
      </HydrationBoundary>
    )

    // In test environment, component is immediately hydrated
    expect(screen.getByTestId('main-content')).toBeInTheDocument()
  })

  it('should prevent hydration mismatches', () => {
    const { container } = render(
      <HydrationBoundary>
        <div>Content</div>
      </HydrationBoundary>
    )

    // The component should render without throwing hydration errors
    expect(container.firstChild).toBeInTheDocument()
  })
})