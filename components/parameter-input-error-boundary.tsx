"use client"

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ActionParameter } from '@/lib/types'

interface ParameterInputErrorBoundaryProps {
  children: ReactNode
  parameter: ActionParameter
  value: any
  onChange: (value: any) => void
  fallbackMode?: 'simple' | 'disabled' | 'custom'
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ParameterInputErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  retryCount: number
  fallbackValue: string
  useFallback: boolean
}

/**
 * Error boundary specifically designed for parameter input components
 * Provides graceful fallback mechanisms when input components fail
 */
export class ParameterInputErrorBoundary extends Component<
  ParameterInputErrorBoundaryProps,
  ParameterInputErrorBoundaryState
> {
  private retryTimeout: NodeJS.Timeout | null = null
  private maxRetries = 3

  constructor(props: ParameterInputErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      retryCount: 0,
      fallbackValue: String(props.value || ''),
      useFallback: false
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ParameterInputErrorBoundaryState> {
    return { 
      hasError: true, 
      error,
      useFallback: true
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo })
    
    // Log error with parameter context for debugging
    console.error('ParameterInputErrorBoundary caught an error:', {
      error,
      errorInfo,
      parameter: this.props.parameter,
      value: this.props.value,
      retryCount: this.state.retryCount
    })
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Auto-retry with exponential backoff for transient errors
    if (this.state.retryCount < this.maxRetries && this.isTransientError(error)) {
      const delay = Math.pow(2, this.state.retryCount) * 1000 // 1s, 2s, 4s
      this.retryTimeout = setTimeout(() => {
        this.handleRetry()
      }, delay)
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout)
    }
  }

  private isTransientError(error: Error): boolean {
    // Check if error might be transient (network, temporary state issues, etc.)
    const transientPatterns = [
      /network/i,
      /timeout/i,
      /temporary/i,
      /rate limit/i,
      /service unavailable/i
    ]
    
    return transientPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    )
  }

  private handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prevState.retryCount + 1,
      useFallback: false
    }))
  }

  private handleFallbackChange = (newValue: string) => {
    this.setState({ fallbackValue: newValue })
    
    // Attempt to call the parent onChange with error handling
    try {
      this.props.onChange(newValue)
    } catch (error) {
      console.error('Error in fallback onChange:', error)
      // Don't propagate the error to avoid infinite error loops
    }
  }

  private renderFallbackInput() {
    const { parameter, fallbackMode = 'simple' } = this.props
    const { fallbackValue } = this.state

    if (fallbackMode === 'disabled') {
      return (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-muted-foreground">
            {parameter.name} (Input Disabled)
          </Label>
          <div className="p-3 bg-muted rounded-md border border-dashed">
            <p className="text-sm text-muted-foreground">
              Parameter input is temporarily disabled due to an error.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Current value: {String(this.props.value || 'None')}
            </p>
          </div>
        </div>
      )
    }

    if (fallbackMode === 'custom' && this.props.children) {
      // Try to render a custom fallback if provided
      try {
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-yellow-600">
              {parameter.name} (Fallback Mode)
            </Label>
            {this.props.children}
          </div>
        )
      } catch (error) {
        console.error('Custom fallback also failed:', error)
        // Fall through to simple mode
      }
    }

    // Simple fallback mode - basic text input
    return (
      <div className="space-y-2">
        <Label htmlFor={`fallback-${parameter.name}`} className="text-sm font-medium text-yellow-600">
          {parameter.name} (Safe Mode)
        </Label>
        <Input
          id={`fallback-${parameter.name}`}
          type="text"
          value={fallbackValue}
          onChange={(e) => this.handleFallbackChange(e.target.value)}
          placeholder={`Enter ${parameter.name}`}
          className="border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500/20"
        />
        <p className="text-xs text-yellow-600">
          Using simplified input due to component error. Type: {parameter.type}
        </p>
      </div>
    )
  }

  private renderErrorUI() {
    const { parameter } = this.props
    const { error, retryCount } = this.state
    const canRetry = retryCount < this.maxRetries

    return (
      <div className="space-y-4">
        {/* Error Display */}
        <div className="flex flex-col items-center justify-center p-4 text-center bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="h-6 w-6 text-red-500 mb-2" />
          <h4 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
            Parameter Input Error
          </h4>
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">
            {error?.message || 'An unexpected error occurred with this parameter input.'}
          </p>
          
          {/* Action Buttons */}
          <div className="flex gap-2">
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                onClick={this.handleRetry}
                className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-100"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry ({this.maxRetries - retryCount} left)
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => this.setState({ useFallback: true })}
              className="h-7 text-xs border-yellow-300 text-yellow-700 hover:bg-yellow-100"
            >
              <Settings className="h-3 w-3 mr-1" />
              Use Safe Mode
            </Button>
          </div>
        </div>

        {/* Fallback Input */}
        {this.state.useFallback && this.renderFallbackInput()}

        {/* Debug Information (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Debug Information
            </summary>
            <div className="mt-2 p-2 bg-muted rounded text-muted-foreground">
              <p><strong>Parameter:</strong> {parameter.name} ({parameter.type})</p>
              <p><strong>Value:</strong> {JSON.stringify(this.props.value)}</p>
              <p><strong>Error:</strong> {error?.name}: {error?.message}</p>
              <p><strong>Retry Count:</strong> {retryCount}/{this.maxRetries}</p>
            </div>
          </details>
        )}
      </div>
    )
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI()
    }

    return this.props.children
  }
}

/**
 * Hook for handling parameter input errors in functional components
 */
export function useParameterInputErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)
  const [retryCount, setRetryCount] = React.useState(0)
  const maxRetries = 3

  const captureError = React.useCallback((error: Error) => {
    console.error('Parameter input error captured:', error)
    setError(error)
  }, [])

  const resetError = React.useCallback(() => {
    setError(null)
    setRetryCount(0)
  }, [])

  const retryOperation = React.useCallback(() => {
    if (retryCount < maxRetries) {
      setError(null)
      setRetryCount(prev => prev + 1)
    }
  }, [retryCount, maxRetries])

  const canRetry = retryCount < maxRetries

  return {
    error,
    hasError: error !== null,
    canRetry,
    retryCount,
    maxRetries,
    captureError,
    resetError,
    retryOperation
  }
}