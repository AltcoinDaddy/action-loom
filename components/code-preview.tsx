"use client"

import { useState, useEffect, useCallback } from "react"
import { CadenceGenerator, CadenceGenerationResult } from "@/lib/cadence-generator"
import type { Workflow, ParsedWorkflow } from "@/lib/types"
import { gracefulErrorHandler, ActionDiscoveryError } from "@/lib/graceful-error-handler"
import { ErrorBoundary } from "@/components/ui/error-boundary"
import { Code2, Copy, ChevronRight, FileJson, FileCode, ListTree, AlertTriangle, Loader2, CheckCircle, RefreshCw, WifiOff, Clock } from "lucide-react"

interface CodePreviewProps {
  workflow: Workflow
  parsedWorkflow: ParsedWorkflow | null
}

interface ErrorState {
  hasError: boolean
  error: ActionDiscoveryError | null
  userMessage: string
  canRetry: boolean
  retryCount: number
  lastRetryTime?: number
}

interface LoadingState {
  isGenerating: boolean
  isRetrying: boolean
  operation: string
  startTime?: number
}

function CodePreviewContent({ workflow, parsedWorkflow }: CodePreviewProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<"cadence" | "json" | "summary">("cadence")
  const [copied, setCopied] = useState(false)
  const [generationResult, setGenerationResult] = useState<CadenceGenerationResult | null>(null)
  const [summaryContent, setSummaryContent] = useState<string>("// Loading summary...")
  const [loadingState, setLoadingState] = useState<LoadingState>({
    isGenerating: false,
    isRetrying: false,
    operation: ''
  })
  const [errorState, setErrorState] = useState<ErrorState>({
    hasError: false,
    error: null,
    userMessage: '',
    canRetry: false,
    retryCount: 0
  })

  // Generate code when workflow changes
  useEffect(() => {
    if (parsedWorkflow && workflow.nodes.length > 0) {
      generateCadenceCode()
    } else {
      setGenerationResult(null)
      clearError()
    }
  }, [parsedWorkflow, workflow.nodes])

  const clearError = useCallback(() => {
    setErrorState({
      hasError: false,
      error: null,
      userMessage: '',
      canRetry: false,
      retryCount: 0
    })
  }, [])

  const handleError = useCallback((error: Error, operation: string) => {
    let actionError: ActionDiscoveryError

    if (error.name === 'ActionDiscoveryError') {
      actionError = error as ActionDiscoveryError
    } else {
      // Convert regular errors to ActionDiscoveryError
      actionError = gracefulErrorHandler.createActionDiscoveryError(
        error,
        'UNKNOWN_ERROR',
        { operation, timestamp: Date.now() }
      )
    }

    const userMessage = gracefulErrorHandler.getUserFriendlyMessage(actionError)

    setErrorState(prev => ({
      hasError: true,
      error: actionError,
      userMessage,
      canRetry: actionError.retryable || false,
      retryCount: prev.retryCount + 1,
      lastRetryTime: Date.now()
    }))

    // Log error for debugging
    console.error(`CodePreview ${operation} error:`, {
      error: actionError,
      userMessage,
      retryable: actionError.retryable || false,
      retryCount: errorState.retryCount + 1
    })
  }, [errorState.retryCount])

  const generateCadenceCode = useCallback(async (isRetry = false) => {
    if (!parsedWorkflow || workflow.nodes.length === 0) {
      return
    }

    // Prevent too frequent retries
    if (isRetry && errorState.lastRetryTime && Date.now() - errorState.lastRetryTime < 2000) {
      return
    }

    setLoadingState({
      isGenerating: true,
      isRetrying: isRetry,
      operation: isRetry ? 'Retrying code generation...' : 'Generating Cadence code...',
      startTime: Date.now()
    })

    if (!isRetry) {
      clearError()
    }

    try {
      const result = await CadenceGenerator.generateTransactionWithDetails(parsedWorkflow, {
        enableFallbacks: true,
        includeComments: true
      })

      setGenerationResult(result)
      clearError() // Clear any previous errors on success

      // Cache successful result for fallback use
      if (result.success) {
        gracefulErrorHandler.cacheDiscoveryResult({
          actions: [],
          registries: [],
          lastUpdated: new Date().toISOString(),
          totalFound: 0,
          executionTime: 0,
          errors: []
        })
      }
    } catch (error) {
      handleError(error as Error, 'code generation')
      setGenerationResult(null)
    } finally {
      setLoadingState({
        isGenerating: false,
        isRetrying: false,
        operation: ''
      })
    }
  }, [parsedWorkflow, workflow.nodes, clearError, handleError, errorState.lastRetryTime])

  const handleRetry = useCallback(() => {
    generateCadenceCode(true)
  }, [generateCadenceCode])

  const getCadenceCode = (): string => {
    if (!parsedWorkflow || workflow.nodes.length === 0) {
      return "// Add actions to the canvas to generate Cadence code\n// Your blockchain workflow will appear here"
    }

    if (loadingState.isGenerating) {
      const elapsed = loadingState.startTime ? Math.floor((Date.now() - loadingState.startTime) / 1000) : 0
      return `// ${loadingState.operation}\n// Please wait while we discover actions and generate your transaction\n// Elapsed time: ${elapsed}s`
    }

    if (errorState.hasError) {
      return `// Code generation failed\n// Error: ${errorState.userMessage}\n// ${errorState.canRetry ? 'Click "Retry" below to try again' : 'Please check your workflow configuration'}`
    }

    if (generationResult) {
      return generationResult.code
    }

    return "// Preparing to generate code..."
  }

  const generateJsonView = () => {
    if (!parsedWorkflow) {
      return "// No workflow data"
    }
    return JSON.stringify(parsedWorkflow, null, 2)
  }

  const generateSummary = useCallback(async (): Promise<string> => {
    if (!parsedWorkflow) {
      return "// No workflow data"
    }

    if (loadingState.isGenerating) {
      return "// Generating workflow summary...\n// Checking action discovery status..."
    }

    if (errorState.hasError) {
      return `// Summary generation failed\n// Error: ${errorState.userMessage}\n// Please resolve the error and try again`
    }

    try {
      return await CadenceGenerator.generateSummary(parsedWorkflow)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      return `// Summary generation failed\n// Error: ${errorMessage}\n// Please check your workflow configuration`
    }
  }, [parsedWorkflow, loadingState.isGenerating, errorState])

  // Update summary when needed
  useEffect(() => {
    if (activeTab === "summary") {
      generateSummary().then(setSummaryContent)
    }
  }, [activeTab, generateSummary])

  const handleCopy = async () => {
    let content = ""
    if (activeTab === "cadence") {
      content = getCadenceCode()
    } else if (activeTab === "json") {
      content = generateJsonView()
    } else {
      content = summaryContent
    }

    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("[v0] Failed to copy:", err)
    }
  }

  const getStatusIcon = () => {
    if (loadingState.isGenerating) {
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }

    if (errorState.hasError) {
      if (errorState.error?.code === 'NETWORK_ERROR') {
        return <WifiOff className="h-4 w-4 text-red-500" />
      }
      if (errorState.error?.code === 'TIMEOUT') {
        return <Clock className="h-4 w-4 text-orange-500" />
      }
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    }

    if (generationResult) {
      if (generationResult.success && !generationResult.fallbackUsed) {
        return <CheckCircle className="h-4 w-4 text-green-500" />
      } else if (generationResult.success && generationResult.fallbackUsed) {
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      } else {
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      }
    }

    return <Code2 className="h-4 w-4 text-primary" />
  }

  const getStatusText = () => {
    if (loadingState.isGenerating) {
      return loadingState.isRetrying ? "Retrying..." : "Generating..."
    }

    if (errorState.hasError) {
      switch (errorState.error?.code) {
        case 'NETWORK_ERROR':
          return "Network Error"
        case 'TIMEOUT':
          return "Request Timeout"
        case 'API_ERROR':
          return "API Error"
        case 'DISCOVERY_IN_PROGRESS':
          return "Discovery in Progress"
        default:
          return "Generation Failed"
      }
    }

    if (generationResult) {
      if (generationResult.success && !generationResult.fallbackUsed) {
        return "Generated Successfully"
      } else if (generationResult.success && generationResult.fallbackUsed) {
        return "Generated (Fallback Mode)"
      } else {
        return "Generation Failed"
      }
    }

    return "Generated Code"
  }

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="group flex w-12 flex-col items-center justify-center gap-2 border-l border-border bg-card p-3 transition-colors hover:bg-primary/5 hover:border-primary"
      >
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="rotate-180 text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors [writing-mode:vertical-lr]">
          Generated Code
        </div>
      </button>
    )
  }

  return (
    <aside className="flex w-96 flex-col border-l border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <div>
              <h2 className="text-sm font-bold text-foreground">Generated Code</h2>
              <p className="text-xs text-muted-foreground">{getStatusText()}</p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(false)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Error/Warning Messages */}
        {generationResult && (generationResult.errors.length > 0 || generationResult.warnings.length > 0) && (
          <div className="mb-3 space-y-1">
            {generationResult.errors.map((error, index) => (
              <div key={`error-${index}`} className="flex items-center gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 px-2 py-1 rounded">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                <span>{error}</span>
              </div>
            ))}
            {generationResult.warnings.map((warning, index) => (
              <div key={`warning-${index}`} className="flex items-center gap-2 text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950 px-2 py-1 rounded">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Error State Display */}
        {errorState.hasError && (
          <div className="mb-3 space-y-2">
            <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-950 px-3 py-2 rounded-md">
              {errorState.error?.code === 'NETWORK_ERROR' ? (
                <WifiOff className="h-3 w-3 flex-shrink-0 mt-0.5" />
              ) : errorState.error?.code === 'TIMEOUT' ? (
                <Clock className="h-3 w-3 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-medium">{errorState.userMessage}</div>
                {errorState.retryCount > 1 && (
                  <div className="text-red-500 mt-1">
                    Retry attempt {errorState.retryCount - 1} failed
                  </div>
                )}
              </div>
            </div>

            {errorState.canRetry && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetry}
                  disabled={loadingState.isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950 dark:hover:bg-blue-900 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingState.isRetrying ? 'animate-spin' : ''}`} />
                  {loadingState.isRetrying ? 'Retrying...' : 'Retry'}
                </button>

                {errorState.retryCount > 3 && (
                  <span className="text-xs text-muted-foreground">
                    Multiple retries failed. Check your network connection.
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Loading State Display */}
        {loadingState.isGenerating && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 dark:bg-blue-950 px-3 py-2 rounded-md">
              <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
              <span>{loadingState.operation}</span>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("cadence")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${activeTab === "cadence"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
          >
            <FileCode className="h-3 w-3" />
            Cadence
          </button>
          <button
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${activeTab === "summary"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
          >
            <ListTree className="h-3 w-3" />
            Summary
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${activeTab === "json"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
          >
            <FileJson className="h-3 w-3" />
            JSON
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <pre className="text-xs font-mono leading-relaxed">
            <code className="text-foreground">
              {activeTab === "cadence" && getCadenceCode()}
              {activeTab === "json" && generateJsonView()}
              {activeTab === "summary" && summaryContent}
            </code>
          </pre>
        </div>
      </div>

      <div className="border-t border-border p-4">
        <button
          onClick={handleCopy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background py-2.5 text-sm font-medium transition-all hover:bg-primary hover:text-primary-foreground hover:border-primary hover:glow-secondary"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied!" : "Copy to Clipboard"}
        </button>
      </div>
    </aside>
  )
}

// Main component wrapped with error boundary
export default function CodePreview({ workflow, parsedWorkflow }: CodePreviewProps) {
  return (
    <ErrorBoundary
      fallback={
        <aside className="flex w-96 flex-col border-l border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <div>
                <h2 className="text-sm font-bold text-foreground">Code Preview Error</h2>
                <p className="text-xs text-muted-foreground">Component failed to render</p>
              </div>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
              <div>
                <h3 className="text-sm font-medium text-red-700 dark:text-red-300">
                  Code Preview Unavailable
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  The code preview component encountered an error. Please refresh the page to try again.
                </p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900 rounded-md transition-colors mx-auto"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh Page
              </button>
            </div>
          </div>
        </aside>
      }
      onError={(error, errorInfo) => {
        console.error('CodePreview component error:', error, errorInfo)

        // Log to error tracking service if available
        if (typeof window !== 'undefined' && (window as any).errorTracker) {
          (window as any).errorTracker.captureException(error, {
            component: 'CodePreview',
            errorInfo,
            nodeCount: workflow?.nodes?.length || 0
          })
        }
      }}
    >
      <CodePreviewContent workflow={workflow} parsedWorkflow={parsedWorkflow} />
    </ErrorBoundary>
  )
}
