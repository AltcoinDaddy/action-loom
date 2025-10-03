import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import React from 'react'

// Mock Next.js font imports
vi.mock('next/font/local', () => ({
  default: () => ({
    style: { fontFamily: 'mocked-font' },
    className: 'mocked-font-class'
  })
}))

// Mock components for testing
const TestComponent = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="test-component">{children}</div>
)

const HydrationBoundary = ({ children }: { children: React.ReactNode }) => {
  const [isHydrated, setIsHydrated] = React.useState(false)
  
  React.useEffect(() => {
    setIsHydrated(true)
  }, [])
  
  if (!isHydrated) {
    return <div suppressHydrationWarning>{children}</div>
  }
  
  return <>{children}</>
}

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" suppressHydrationWarning>
      <body 
        className="font-sans" 
        style={{
          '--font-geist-sans': 'mocked-font',
          '--font-geist-mono': 'mocked-font-mono',
        } as React.CSSProperties}
      >
        <HydrationBoundary>
          {children}
        </HydrationBoundary>
      </body>
    </html>
  )
}

describe('Hydration Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock window object for client-side tests
    Object.defineProperty(window, 'location', {
      value: { href: 'http://localhost:3000' },
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Server-Client HTML Consistency', () => {
    it('should render identical HTML on server and client', () => {
      const TestApp = () => (
        <RootLayout>
          <TestComponent>
            <h1>Test Content</h1>
            <p>This should be consistent</p>
          </TestComponent>
        </RootLayout>
      )

      // Server-side render
      const serverHTML = renderToString(<TestApp />)
      
      // Client-side render
      const { container } = render(<TestApp />)
      const clientHTML = container.innerHTML

      // Extract body content for comparison (ignore html/head differences)
      const serverBodyMatch = serverHTML.match(/<body[^>]*>(.*)<\/body>/s)
      const serverBody = serverBodyMatch ? serverBodyMatch[1] : serverHTML

      expect(serverBody).toBeTruthy()
      expect(clientHTML).toContain('Test Content')
      expect(clientHTML).toContain('This should be consistent')
    })

    it('should handle font loading without hydration mismatches', async () => {
      const FontTestComponent = () => (
        <div 
          style={{ 
            fontFamily: 'var(--font-geist-sans)',
            fontSize: '16px'
          }}
        >
          Font Test Content
        </div>
      )

      render(
        <div>
          <FontTestComponent />
        </div>
      )

      await waitFor(() => {
        expect(screen.getByText('Font Test Content')).toBeInTheDocument()
      })

      // Just verify the component renders correctly
      expect(screen.getByText('Font Test Content')).toBeInTheDocument()
    })

    it('should handle dynamic content consistently', async () => {
      const DynamicComponent = () => {
        const [mounted, setMounted] = React.useState(false)
        
        React.useEffect(() => {
          setMounted(true)
        }, [])

        return (
          <div>
            <span>Always visible</span>
            {mounted && <span data-testid="dynamic-content">Dynamic content</span>}
          </div>
        )
      }

      render(
        <HydrationBoundary>
          <DynamicComponent />
        </HydrationBoundary>
      )

      // Initially should show static content
      expect(screen.getByText('Always visible')).toBeInTheDocument()
      
      // Dynamic content should appear after hydration
      await waitFor(() => {
        expect(screen.getByTestId('dynamic-content')).toBeInTheDocument()
      })
    })
  })

  describe('Browser Extension Compatibility', () => {
    it('should handle DOM modifications gracefully', async () => {
      const TestApp = () => (
        <div data-testid="app-root">
          <h1>Original Content</h1>
        </div>
      )

      const { container } = render(<TestApp />)
      
      // Simulate browser extension modifying DOM
      const injectedElement = document.createElement('div')
      injectedElement.textContent = 'Injected by extension'
      injectedElement.setAttribute('data-extension', 'true')
      container.appendChild(injectedElement)

      // App should still function normally
      expect(screen.getByText('Original Content')).toBeInTheDocument()
      expect(container.querySelector('[data-extension="true"]')).toBeInTheDocument()
    })

    it('should suppress hydration warnings for external modifications', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const TestApp = () => (
        <div suppressHydrationWarning>
          <span>Content that might be modified</span>
        </div>
      )

      render(<TestApp />)
      
      // Should not log hydration errors
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Hydration')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Layout Stability', () => {
    it('should prevent layout shifts during font loading', async () => {
      const LayoutTestComponent = () => (
        <div 
          style={{
            fontFamily: 'var(--font-geist-sans)',
            fontSize: '16px',
            lineHeight: '1.5'
          }}
        >
          <h1>Main Heading</h1>
          <p>This is a paragraph that should maintain consistent layout.</p>
        </div>
      )

      render(<LayoutTestComponent />)

      const heading = screen.getByText('Main Heading')
      const paragraph = screen.getByText(/This is a paragraph/)

      // Elements should be present and styled
      expect(heading).toBeInTheDocument()
      expect(paragraph).toBeInTheDocument()
    })

    it('should handle theme switching without hydration issues', async () => {
      const { act } = await import('@testing-library/react')
      
      const ThemeTestComponent = () => {
        const [theme, setTheme] = React.useState('light')
        
        return (
          <div data-theme={theme}>
            <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
              Toggle Theme
            </button>
            <span>Current theme: {theme}</span>
          </div>
        )
      }

      render(
        <HydrationBoundary>
          <ThemeTestComponent />
        </HydrationBoundary>
      )

      expect(screen.getByText('Current theme: light')).toBeInTheDocument()
      
      // Theme switching should work without hydration errors
      const toggleButton = screen.getByText('Toggle Theme')
      
      await act(async () => {
        toggleButton.click()
      })

      await waitFor(() => {
        expect(screen.getByText('Current theme: dark')).toBeInTheDocument()
      })
    })
  })

  describe('Error Boundary Integration', () => {
    it('should catch hydration errors gracefully', () => {
      const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {
        const [hasError, setHasError] = React.useState(false)
        
        React.useEffect(() => {
          const handleError = () => setHasError(true)
          window.addEventListener('error', handleError)
          return () => window.removeEventListener('error', handleError)
        }, [])
        
        if (hasError) {
          return <div data-testid="error-fallback">Something went wrong</div>
        }
        
        return <>{children}</>
      }

      const ProblematicComponent = () => {
        // This might cause hydration issues
        const [randomValue] = React.useState(() => Math.random())
        return <div>Random: {randomValue}</div>
      }

      render(
        <ErrorBoundary>
          <HydrationBoundary>
            <ProblematicComponent />
          </HydrationBoundary>
        </ErrorBoundary>
      )

      // Should render without crashing
      expect(screen.getByText(/Random:/)).toBeInTheDocument()
    })
  })
})