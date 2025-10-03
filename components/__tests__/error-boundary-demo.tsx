import React, { useState } from 'react'
import { ErrorBoundary } from '../ui/error-boundary'

// Component that can throw errors on demand for testing
const ErrorProneComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('This is a test error to verify error boundary functionality')
  }
  
  return (
    <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
      <h3 className="text-green-800 font-semibold">Component Working Normally</h3>
      <p className="text-green-600 text-sm">This component is functioning correctly.</p>
    </div>
  )
}

// Demo component to test error boundaries
export const ErrorBoundaryDemo = () => {
  const [shouldThrow, setShouldThrow] = useState(false)
  const [key, setKey] = useState(0)

  const triggerError = () => {
    setShouldThrow(true)
  }

  const resetComponent = () => {
    setShouldThrow(false)
    setKey(prev => prev + 1) // Force re-mount to reset error boundary
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl font-bold">Error Boundary Test</h2>
      
      <div className="space-x-2">
        <button
          onClick={triggerError}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Trigger Error
        </button>
        <button
          onClick={resetComponent}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Reset Component
        </button>
      </div>

      <ErrorBoundary
        key={key}
        onError={(error, errorInfo) => {
          console.log('Error caught by boundary:', error.message)
          console.log('Error info:', errorInfo)
        }}
      >
        <ErrorProneComponent shouldThrow={shouldThrow} />
      </ErrorBoundary>

      <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="text-blue-800 font-semibold">Instructions:</h4>
        <ol className="text-blue-600 text-sm mt-2 space-y-1">
          <li>1. Click "Trigger Error" to make the component throw an error</li>
          <li>2. Observe that the error boundary catches it and shows fallback UI</li>
          <li>3. Click "Reset Component" to restore normal functionality</li>
          <li>4. Check the browser console for error logging</li>
        </ol>
      </div>
    </div>
  )
}

export default ErrorBoundaryDemo