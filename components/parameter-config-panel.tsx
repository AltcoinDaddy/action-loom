"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
// ScrollArea temporarily disabled to prevent infinite loop
import { AlertTriangle, CheckCircle, Info, Settings, X } from 'lucide-react'
import { ActionMetadata, ActionOutput, ParsedWorkflow, ParsedAction, ValidationError } from '@/lib/types'
import {
  ParameterValidator,
  ValidationContext,
  ActionValidationResult,
  ParameterValidationResult
} from '@/lib/parameter-validator'
import { ParameterInput } from './parameter-input'
import { ParameterDependencyVisualization } from './parameter-dependency-visualization'

export interface ParameterConfigPanelProps {
  action: ActionMetadata
  currentValues: Record<string, any>
  onParameterChange: (parameterName: string, value: any) => void
  onValidationChange: (isValid: boolean, errors: ValidationError[]) => void
  availableOutputs: Record<string, ActionOutput>
  workflow?: ParsedWorkflow
  currentAction?: ParsedAction
  actionMetadata?: Record<string, ActionMetadata>
  allParameterValues?: Record<string, Record<string, any>>
  onClose?: () => void
}



export function ParameterConfigPanel({
  action,
  currentValues,
  onParameterChange,
  onValidationChange,
  availableOutputs,
  workflow,
  currentAction,
  actionMetadata,
  allParameterValues,
  onClose
}: ParameterConfigPanelProps) {
  const [validationResults, setValidationResults] = useState<ActionValidationResult | null>(null)
  const [parameterValidations, setParameterValidations] = useState<Record<string, ParameterValidationResult>>({})
  const [showDependencies, setShowDependencies] = useState(false)

  const validator = new ParameterValidator()

  // Validate parameters whenever values change
  useEffect(() => {
    if (!workflow || !currentAction) return

    const context: ValidationContext = {
      workflow,
      currentAction,
      availableOutputs
    }

    const result = validator.validateAllParameters(action, currentValues, context)
    setValidationResults(result)

    // Update individual parameter validations
    const newParameterValidations: Record<string, ParameterValidationResult> = {}

    for (const parameter of action.parameters) {
      // Create an enhanced parameter with validation property
      const enhancedParameter = {
        ...parameter,
        validation: {
          rules: [],
          required: parameter.required || false,
          type: parameter.type as any // Cast to avoid type mismatch
        }
      }
      const paramResult = validator.validateParameter(enhancedParameter, currentValues[parameter.name], context)
      newParameterValidations[parameter.name] = paramResult
    }

    setParameterValidations(newParameterValidations)

    // Notify parent of validation changes
    const allErrors = Object.values(newParameterValidations)
      .flatMap(validation => validation.errors)
      .concat(result.warnings.map(warning => ({
        type: 'warning',
        message: warning,
        severity: 'warning' as const
      })))

    onValidationChange(result.isValid, allErrors)
  }, [action, currentValues, workflow, currentAction, availableOutputs, onValidationChange])



  const getValidationIcon = (parameterName: string) => {
    const validation = parameterValidations[parameterName]
    if (!validation) return null

    if (validation.errors.length > 0) {
      return <AlertTriangle className="h-4 w-4 text-destructive" />
    }
    if (validation.warnings.length > 0) {
      return <Info className="h-4 w-4 text-yellow-500" />
    }
    if (validation.isValid && currentValues[parameterName] !== undefined && currentValues[parameterName] !== '') {
      return <CheckCircle className="h-4 w-4 text-green-500" />
    }
    return null
  }

  const getValidationMessage = (parameterName: string) => {
    const validation = parameterValidations[parameterName]
    if (!validation) return null

    if (validation.errors.length > 0) {
      return validation.errors[0].message
    }
    if (validation.warnings.length > 0) {
      return validation.warnings[0]
    }
    return null
  }

  const hasParameterDependencies = action.parameters.some(param =>
    Object.keys(availableOutputs).length > 0
  )

  return (
    <Card className="w-96 max-h-[80vh] flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Configure Parameters</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {action.category}
            </Badge>
            <span className="text-sm font-medium">{action.name}</span>
          </div>

          {action.description && (
            <p className="text-sm text-muted-foreground">{action.description}</p>
          )}

          {/* Validation Summary */}
          {validationResults && (
            <div className="flex items-center gap-2 text-xs">
              {validationResults.isValid ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-3 w-3" />
                  <span>All parameters valid</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-destructive">
                  <AlertTriangle className="h-3 w-3" />
                  <span>
                    {validationResults.missingParameters.length} missing, {' '}
                    {Object.keys(validationResults.invalidParameters).length} invalid
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <Separator />

      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Parameter Dependencies Visualization */}
            {hasParameterDependencies && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Parameter Dependencies</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDependencies(!showDependencies)}
                  >
                    {showDependencies ? 'Hide' : 'Show'} Dependencies
                  </Button>
                </div>

                {showDependencies && (
                  <ParameterDependencyVisualization
                    action={action}
                    availableOutputs={availableOutputs}
                    currentValues={currentValues}
                    workflow={workflow}
                    actionMetadata={actionMetadata}
                    allParameterValues={allParameterValues}
                  />
                )}

                <Separator />
              </div>
            )}

            {/* Parameter Inputs */}
            <div className="space-y-4">
              {action.parameters.map((parameter) => {
                const validation = parameterValidations[parameter.name]
                const validationIcon = getValidationIcon(parameter.name)
                const validationMessage = getValidationMessage(parameter.name)

                return (
                  <div key={parameter.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">
                          {parameter.name}
                          {parameter.required && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </label>
                        {validationIcon}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {parameter.type}
                      </Badge>
                    </div>

                    {(parameter as any).description && (
                      <p className="text-xs text-muted-foreground">
                        {(parameter as any).description}
                      </p>
                    )}

                    <ParameterInput
                      parameter={parameter}
                      value={currentValues[parameter.name]}
                      onChange={(value) => onParameterChange(parameter.name, value)}
                      validation={validation}
                      availableOutputs={availableOutputs}
                      suggestions={validation?.suggestions || []}
                    />

                    {validationMessage && (
                      <div className={`text-xs flex items-center gap-1 ${validation?.errors.length > 0
                        ? 'text-destructive'
                        : 'text-yellow-600'
                        }`}>
                        {validation?.errors.length > 0 ? (
                          <AlertTriangle className="h-3 w-3" />
                        ) : (
                          <Info className="h-3 w-3" />
                        )}
                        <span>{validationMessage}</span>
                      </div>
                    )}

                    {validation?.suggestions && validation.suggestions.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Suggestions:</span>
                        <ul className="list-disc list-inside ml-2 mt-1">
                          {validation.suggestions.map((suggestion, index) => (
                            <li key={index}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Missing Parameters Warning */}
            {validationResults && validationResults.missingParameters.length > 0 && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium mb-2">
                  <AlertTriangle className="h-4 w-4" />
                  Missing Required Parameters
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {validationResults.missingParameters.map((param) => (
                    <li key={param} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-destructive" />
                      {param}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Validation Warnings */}
            {validationResults && validationResults.warnings.length > 0 && (
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20 p-3">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm font-medium mb-2">
                  <Info className="h-4 w-4" />
                  Warnings
                </div>
                <ul className="text-sm text-yellow-600 dark:text-yellow-300 space-y-1">
                  {validationResults.warnings.map((warning, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}