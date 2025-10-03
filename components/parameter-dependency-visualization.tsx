"use client"

import React, { useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowRight, Link, AlertTriangle, CheckCircle, Info, Network, Zap, GitBranch } from 'lucide-react'
import { ActionMetadata, ActionOutput, ParsedWorkflow } from '@/lib/types'
import { DataFlowAnalyzer } from '@/lib/data-flow-analyzer'
import { cn } from '@/lib/utils'

export interface ParameterDependencyVisualizationProps {
  action: ActionMetadata
  availableOutputs: Record<string, ActionOutput>
  currentValues: Record<string, any>
  workflow?: ParsedWorkflow
  actionMetadata?: Record<string, ActionMetadata>
  allParameterValues?: Record<string, Record<string, any>>
}

interface DependencyConnection {
  parameterName: string
  parameterType: string
  sourceOutput?: {
    key: string
    output: ActionOutput
    actionId: string
    outputName: string
  }
  isConnected: boolean
  isTypeCompatible: boolean
  currentValue: any
}

export function ParameterDependencyVisualization({
  action,
  availableOutputs,
  currentValues,
  workflow,
  actionMetadata,
  allParameterValues
}: ParameterDependencyVisualizationProps) {
  
  // Enhanced data flow analysis using DataFlowAnalyzer
  const dataFlowAnalysis = useMemo(() => {
    if (!workflow || !actionMetadata || !allParameterValues) {
      return null
    }
    
    const analyzer = new DataFlowAnalyzer()
    return analyzer.analyzeDataFlow(workflow, actionMetadata, allParameterValues)
  }, [workflow, actionMetadata, allParameterValues])

  // Get current action's dependency information from analysis
  const currentActionDependency = dataFlowAnalysis?.dependencies[action.id]
  const currentActionConnections = dataFlowAnalysis?.connections.filter(
    conn => conn.targetActionId === action.id
  ) || []
  
  // Analyze parameter dependencies
  const analyzeDependencies = (): DependencyConnection[] => {
    return action.parameters.map(parameter => {
      const currentValue = currentValues[parameter.name]
      let sourceOutput: DependencyConnection['sourceOutput'] = undefined
      let isConnected = false
      let isTypeCompatible = true

      // Check if current value is a reference to an output
      if (typeof currentValue === 'string' && currentValue.includes('.')) {
        const outputKey = currentValue
        const output = availableOutputs[outputKey]
        
        if (output) {
          const [actionId, outputName] = outputKey.split('.')
          sourceOutput = {
            key: outputKey,
            output,
            actionId,
            outputName
          }
          isConnected = true
          
          // Check type compatibility
          isTypeCompatible = checkTypeCompatibility(parameter.type, output.type)
        }
      }

      return {
        parameterName: parameter.name,
        parameterType: parameter.type,
        sourceOutput,
        isConnected,
        isTypeCompatible,
        currentValue
      }
    })
  }

  const checkTypeCompatibility = (parameterType: string, outputType: string): boolean => {
    // Normalize types for comparison
    const normalizeType = (type: string) => type.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    const normalizedParamType = normalizeType(parameterType)
    const normalizedOutputType = normalizeType(outputType)
    
    // Exact match
    if (normalizedParamType === normalizedOutputType) return true
    
    // Compatible numeric types
    const numericTypes = ['ufix64', 'int', 'uint64', 'number']
    if (numericTypes.includes(normalizedParamType) && numericTypes.includes(normalizedOutputType)) {
      return true
    }
    
    // String compatibility (most types can be converted to string)
    if (normalizedParamType === 'string') return true
    
    return false
  }

  const dependencies = analyzeDependencies()
  const connectedDependencies = dependencies.filter(dep => dep.isConnected)
  const availableDependencies = dependencies.filter(dep => !dep.isConnected)

  if (Object.keys(availableOutputs).length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center">
          <Info className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No previous actions available for parameter dependencies
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connected Dependencies */}
      {connectedDependencies.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Link className="h-4 w-4" />
            Connected Parameters ({connectedDependencies.length})
          </h4>
          
          <div className="space-y-2">
            {connectedDependencies.map((dependency) => (
              <Card key={dependency.parameterName} className="border-primary/20 bg-primary/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {dependency.parameterName}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="text-xs">
                        {dependency.sourceOutput?.actionId}.{dependency.sourceOutput?.outputName}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {dependency.isTypeCompatible ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      Parameter: <code className="bg-muted px-1 rounded">{dependency.parameterType}</code>
                    </span>
                    <span>
                      Output: <code className="bg-muted px-1 rounded">{dependency.sourceOutput?.output.type}</code>
                    </span>
                  </div>
                  
                  {!dependency.isTypeCompatible && (
                    <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-700 dark:text-yellow-400">
                        ⚠️ Type mismatch: {dependency.parameterType} ← {dependency.sourceOutput?.output.type}
                      </p>
                    </div>
                  )}
                  
                  {dependency.sourceOutput?.output.description && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dependency.sourceOutput.output.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {connectedDependencies.length > 0 && availableDependencies.length > 0 && (
        <Separator />
      )}

      {/* Available Dependencies */}
      {availableDependencies.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">
            Available for Connection ({availableDependencies.length})
          </h4>
          
          <div className="grid gap-2">
            {availableDependencies.map((dependency) => {
              // Find compatible outputs for this parameter
              const compatibleOutputs = Object.entries(availableOutputs).filter(([_, output]) =>
                checkTypeCompatibility(dependency.parameterType, output.type)
              )
              
              return (
                <Card key={dependency.parameterName} className="border-dashed">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {dependency.parameterName}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {dependency.parameterType}
                      </Badge>
                    </div>
                    
                    {compatibleOutputs.length > 0 ? (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">
                          Compatible outputs ({compatibleOutputs.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {compatibleOutputs.slice(0, 3).map(([key, output]) => {
                            const [actionId, outputName] = key.split('.')
                            return (
                              <Badge
                                key={key}
                                variant="outline"
                                className="text-xs cursor-pointer hover:bg-primary hover:text-primary-foreground"
                                title={output.description}
                              >
                                {actionId}.{outputName}
                              </Badge>
                            )
                          })}
                          {compatibleOutputs.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{compatibleOutputs.length - 3} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No compatible outputs available
                      </p>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Data Flow Summary */}
      {connectedDependencies.length > 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Info className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Data Flow Summary</span>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">
                  {connectedDependencies.filter(d => d.isTypeCompatible).length}
                </div>
                <div className="text-muted-foreground">Compatible</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-yellow-600">
                  {connectedDependencies.filter(d => !d.isTypeCompatible).length}
                </div>
                <div className="text-muted-foreground">Type Issues</div>
              </div>
              
              <div className="text-center">
                <div className="text-lg font-semibold text-muted-foreground">
                  {availableDependencies.length}
                </div>
                <div className="text-muted-foreground">Unconnected</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Data Flow Analysis */}
      {dataFlowAnalysis && currentActionDependency && (
        <>
          <Separator />
          
          {/* Connection Strength Visualization */}
          {currentActionConnections.length > 0 && (
            <Card className="border-primary/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <Network className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Connection Analysis</span>
                </div>
                
                <div className="space-y-2">
                  {currentActionConnections.map((connection) => (
                    <div key={connection.id} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {connection.sourceActionId}.{connection.sourceOutputName}
                        </Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="secondary" className="text-xs">
                          {connection.targetParameterName}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {/* Connection strength indicator */}
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          <span className="text-xs text-muted-foreground">
                            {Math.round(connection.connectionStrength * 100)}%
                          </span>
                        </div>
                        
                        {connection.isTypeCompatible ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Type Compatibility Issues */}
          {dataFlowAnalysis.typeCompatibilityIssues.some(issue => issue.targetAction === action.id) && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-400">
                    Type Compatibility Issues
                  </span>
                </div>
                
                <div className="space-y-2">
                  {dataFlowAnalysis.typeCompatibilityIssues
                    .filter(issue => issue.targetAction === action.id)
                    .map((issue, index) => (
                      <div key={index} className="p-2 bg-white dark:bg-yellow-900/30 rounded border border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">
                            {issue.sourceAction}.{issue.sourceOutput} → {issue.targetParameter}
                          </span>
                          <Badge variant={issue.canConvert ? "secondary" : "destructive"} className="text-xs">
                            {issue.canConvert ? "Convertible" : "Incompatible"}
                          </Badge>
                        </div>
                        
                        <div className="text-xs text-muted-foreground mb-1">
                          <code className="bg-muted px-1 rounded">{issue.sourceType}</code>
                          {" → "}
                          <code className="bg-muted px-1 rounded">{issue.targetType}</code>
                        </div>
                        
                        {issue.suggestion && (
                          <div className="text-xs text-yellow-700 dark:text-yellow-400">
                            💡 {issue.suggestion}
                          </div>
                        )}
                        
                        {issue.autoFixAvailable && (
                          <div className="text-xs text-green-700 dark:text-green-400 mt-1">
                            ✨ Auto-fix available
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unresolved References */}
          {dataFlowAnalysis.unresolvedReferences.some(ref => ref.actionId === action.id) && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">
                    Unresolved References
                  </span>
                </div>
                
                <div className="space-y-2">
                  {dataFlowAnalysis.unresolvedReferences
                    .filter(ref => ref.actionId === action.id)
                    .map((ref, index) => (
                      <div key={index} className="p-2 bg-white dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium">
                            {ref.parameterName} → {ref.referencedAction}.{ref.referencedOutput}
                          </span>
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        </div>
                        
                        <div className="text-xs text-red-700 dark:text-red-400 mb-2">
                          {ref.reason}
                        </div>
                        
                        {ref.suggestions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-red-700 dark:text-red-400">
                              Suggestions:
                            </div>
                            {ref.suggestions.map((suggestion, suggestionIndex) => (
                              <div key={suggestionIndex} className="text-xs text-red-600 dark:text-red-300">
                                • {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Circular Dependencies Warning */}
          {dataFlowAnalysis.circularDependencies.some(cycle => 
            cycle.cycle.includes(action.id)
          ) && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="h-4 w-4 text-orange-600" />
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                    Circular Dependency Detected
                  </span>
                </div>
                
                <div className="space-y-2">
                  {dataFlowAnalysis.circularDependencies
                    .filter(cycle => cycle.cycle.includes(action.id))
                    .map((cycle, index) => (
                      <div key={index} className="p-2 bg-white dark:bg-orange-900/30 rounded border border-orange-200 dark:border-orange-800">
                        <div className="text-xs font-medium mb-1">
                          Cycle: {cycle.cycle.join(' → ')}
                        </div>
                        
                        <div className="text-xs text-orange-700 dark:text-orange-400 mb-2">
                          {cycle.description}
                        </div>
                        
                        {cycle.breakingSuggestions.length > 0 && (
                          <div className="space-y-1">
                            <div className="text-xs font-medium text-orange-700 dark:text-orange-400">
                              Breaking suggestions:
                            </div>
                            {cycle.breakingSuggestions.map((suggestion, suggestionIndex) => (
                              <div key={suggestionIndex} className="text-xs text-orange-600 dark:text-orange-300">
                                • {suggestion}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}