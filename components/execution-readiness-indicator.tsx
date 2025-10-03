"use client"

import { useState, useEffect, useRef } from "react"
import { CheckCircle, AlertTriangle, Clock, Zap, AlertCircle, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
// Tooltip temporarily disabled to prevent infinite loop
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { ParsedWorkflow, ActionMetadata, ValidationError } from "@/lib/types"

export interface ExecutionReadinessData {
  canExecute: boolean
  executionReadiness: {
    parametersConfigured: boolean
    dataFlowValid: boolean
    noCircularDependencies: boolean
    allActionsValid: boolean
    readinessScore: number
    readinessMessage: string
  }
  blockingErrors: ValidationError[]
  warnings: ValidationError[]
  estimatedGasCost?: number
  estimatedExecutionTime?: number
}

interface ExecutionReadinessIndicatorProps {
  workflow: ParsedWorkflow | null
  actionMetadata: Record<string, ActionMetadata>
  parameterValues: Record<string, Record<string, any>>
  onValidationUpdate?: (data: ExecutionReadinessData | null) => void
  className?: string
}

export function ExecutionReadinessIndicator({
  workflow,
  actionMetadata,
  parameterValues,
  onValidationUpdate,
  className = ""
}: ExecutionReadinessIndicatorProps) {
  const [validationData, setValidationData] = useState<ExecutionReadinessData | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [lastValidationTime, setLastValidationTime] = useState<number>(0)
  const onValidationUpdateRef = useRef(onValidationUpdate)

  // Keep the ref updated
  useEffect(() => {
    onValidationUpdateRef.current = onValidationUpdate
  }, [onValidationUpdate])

  // Debounced validation
  useEffect(() => {
    if (!workflow || workflow.actions.length === 0) {
      setValidationData(null)
      onValidationUpdateRef.current?.(null)
      return
    }

    const validateExecution = async () => {
      setIsValidating(true)
      try {
        const response = await fetch("/api/workflow/validate-execution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow,
            actionMetadata,
            parameterValues
          }),
        })

        if (response.ok) {
          const data = await response.json()
          const validationResult: ExecutionReadinessData = {
            canExecute: data.canExecute,
            executionReadiness: data.executionReadiness,
            blockingErrors: data.blockingErrors || [],
            warnings: data.warnings || [],
            estimatedGasCost: data.estimatedGasCost,
            estimatedExecutionTime: data.estimatedExecutionTime
          }

          setValidationData(validationResult)
          onValidationUpdateRef.current?.(validationResult)
          setLastValidationTime(Date.now())
        }
      } catch (error) {
        console.error("Execution validation failed:", error)
        setValidationData(null)
        onValidationUpdateRef.current?.(null)
      } finally {
        setIsValidating(false)
      }
    }

    // Debounce validation calls
    const timeoutId = setTimeout(validateExecution, 500)
    return () => clearTimeout(timeoutId)
  }, [workflow, actionMetadata, parameterValues])

  if (!workflow || workflow.actions.length === 0) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Info className="h-4 w-4" />
        <span className="text-sm">Add actions to validate workflow</span>
      </div>
    )
  }

  if (isValidating) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <Clock className="h-4 w-4 animate-spin" />
        <span className="text-sm">Validating...</span>
      </div>
    )
  }

  if (!validationData) {
    return (
      <div className={`flex items-center gap-2 text-muted-foreground ${className}`}>
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Validation unavailable</span>
      </div>
    )
  }

  const { executionReadiness, blockingErrors, warnings, canExecute } = validationData || {
    executionReadiness: {
      parametersConfigured: false,
      dataFlowValid: false,
      noCircularDependencies: false,
      allActionsValid: false,
      readinessScore: 0,
      readinessMessage: 'Validating...'
    },
    blockingErrors: [],
    warnings: [],
    canExecute: false
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Readiness Indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {canExecute ? (
            <CheckCircle className="h-5 w-5 text-green-600" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-600" />
          )}
          <div className="flex flex-col">
            <span className={`text-sm font-medium ${canExecute ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}>
              {canExecute ? 'Ready to Execute' : 'Not Ready'}
            </span>
            <span className="text-xs text-muted-foreground">
              {executionReadiness.readinessMessage}
            </span>
          </div>
        </div>

        {/* Readiness Score */}
        <div className="flex items-center gap-2 ml-auto">
          <Progress
            value={executionReadiness.readinessScore}
            className="w-20 h-2"
          />
          <span className="text-sm font-medium min-w-[3ch]">
            {executionReadiness.readinessScore}%
          </span>
        </div>
      </div>

      {/* Detailed Status Checks */}
      <div className="grid grid-cols-2 gap-2">
        <div
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
          title="All required parameters are configured"
        >
          {executionReadiness.parametersConfigured ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">Parameters</span>
        </div>

        <div
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
          title="Parameter dependencies are valid"
        >
          {executionReadiness.dataFlowValid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">Data Flow</span>
        </div>

        <div
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
          title="No circular dependencies detected"
        >
          {executionReadiness.noCircularDependencies ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">Dependencies</span>
        </div>

        <div
          className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
          title="All actions are properly configured"
        >
          {executionReadiness.allActionsValid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-600" />
          )}
          <span className="text-xs">Actions</span>
        </div>
      </div>

      {/* Execution Estimates */}
      {validationData.estimatedGasCost && validationData.estimatedExecutionTime && (
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Zap className="h-3 w-3" />
            <span>~{validationData.estimatedGasCost.toLocaleString()} gas</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>~{Math.round(validationData.estimatedExecutionTime / 1000)}s</span>
          </div>
        </div>
      )}

      {/* Error Messages */}
      {blockingErrors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Blocking Issues:</div>
              <ul className="list-disc list-inside space-y-1">
                {blockingErrors.slice(0, 3).map((error, index) => (
                  <li key={index} className="text-sm">{error.message}</li>
                ))}
                {blockingErrors.length > 3 && (
                  <li className="text-sm">...and {blockingErrors.length - 3} more</li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Warning Messages */}
      {warnings.length > 0 && blockingErrors.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-medium">Warnings:</div>
              <ul className="list-disc list-inside space-y-1">
                {warnings.slice(0, 2).map((warning, index) => (
                  <li key={index} className="text-sm">{warning.message}</li>
                ))}
                {warnings.length > 2 && (
                  <li className="text-sm">...and {warnings.length - 2} more</li>
                )}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Last Validation Time */}
      {lastValidationTime > 0 && (
        <div className="text-xs text-muted-foreground text-right">
          Last validated: {new Date(lastValidationTime).toLocaleTimeString()}
        </div>
      )}
    </div>
  )
}