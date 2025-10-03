'use client'

import { useEffect, useState } from 'react'

interface HydrationBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * HydrationBoundary component prevents hydration mismatches by ensuring
 * consistent rendering between server and client.
 * 
 * This component:
 * - Renders children only after client-side hydration is complete
 * - Prevents layout shifts during font loading
 * - Handles dynamic content that differs between server and client
 */
export function HydrationBoundary({ children, fallback }: HydrationBoundaryProps) {
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    // Mark as hydrated after the component mounts on the client
    setIsHydrated(true)
  }, [])

  // During SSR and before hydration, render with suppressed hydration warnings
  if (!isHydrated) {
    return (
      <div suppressHydrationWarning>
        {fallback || children}
      </div>
    )
  }

  // After hydration, render normally
  return <>{children}</>
}