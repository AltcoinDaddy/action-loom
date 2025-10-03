"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { WorkflowCanvas } from "./workflow-canvas"
import { ActionLibrary } from "./action-library"
import CodePreview from "./code-preview"
import { ExecutionModal } from "./execution-modal"
import { NLPInput } from "./nlp-input"
import { ParameterConfigPanel } from "./parameter-config-panel"
import { ExecutionReadinessIndicator, ExecutionReadinessData } from "./execution-readiness-indicator"
import { ErrorBoundary } from "./ui/error-boundary"
import { WorkflowParser } from "@/lib/workflow-parser"
import { ParameterValidator } from "@/lib/parameter-validator"

import type {
  Workflow,
  ParsedWorkflow,
  ExecutionResult,
  SimulationResult,
  AgentConfiguration,
  ActionMetadata,
  ActionOutput,
  ValidationError
} from "@/lib/types"
import { ValidationErrorType } from "@/lib/types"
import { Sparkles, Play, Save, Zap, MessageSquare, Grid3X3 } from "lucide-react"

export function WorkflowBuilder() {
  const [workflow, setWorkflow] = useState<Workflow>({
    nodes: [],
    edges: [],
  })
  const [parsedWorkflow, setParsedWorkflow] = useState<ParsedWorkflow | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null)
  const [showExecutionModal, setShowExecutionModal] = useState(false)
  const [showNLPInput, setShowNLPInput] = useState(false)
  const [inputMode, setInputMode] = useState<'visual' | 'nlp'>('visual')
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null)

  // Validation state
  const [selectedActionForConfig, setSelectedActionForConfig] = useState<{
    nodeId: string
    action: ActionMetadata
    currentValues: Record<string, any>
  } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, ValidationError[]>>({})
  const [workflowValidationState, setWorkflowValidationState] = useState<{
    isValid: boolean
    errors: ValidationError[]
    warnings: string[]
  }>({ isValid: true, errors: [], warnings: [] })
  const [parameterValues, setParameterValues] = useState<Record<string, Record<string, any>>>({})
  const [executionReadinessData, setExecutionReadinessData] = useState<ExecutionReadinessData | null>(null)

  // Use ref to access current parameterValues without causing callback recreation
  const parameterValuesRef = useRef(parameterValues)
  parameterValuesRef.current = parameterValues

  // Validators - use useMemo to prevent recreation on every render
  const parameterValidator = useMemo(() => new ParameterValidator(), [])

  const handleWorkflowChange = useCallback((newWorkflow: Workflow) => {
    setWorkflow(newWorkflow)
    if (newWorkflow.nodes.length > 0) {
      const parsed = WorkflowParser.parse(newWorkflow.nodes, newWorkflow.edges)
      setParsedWorkflow(parsed)

      // Validate workflow parameters
      validateWorkflowParameters(parsed, newWorkflow)

      // Trigger simulation for workflow validation
      simulateWorkflow(parsed)
    } else {
      setParsedWorkflow(null)
      setSimulationResult(null)
      setValidationErrors({})
      setWorkflowValidationState({ isValid: true, errors: [], warnings: [] })
    }
  }, [])

  // Listen for actionAdded events to initialize parameter values
  useEffect(() => {
    const handleActionAdded = (event: CustomEvent) => {
      const { nodeId, parameterValues: initialValues } = event.detail

      setParameterValues(prev => ({
        ...prev,
        [nodeId]: initialValues
      }))
    }

    window.addEventListener('actionAdded', handleActionAdded as EventListener)

    return () => {
      window.removeEventListener('actionAdded', handleActionAdded as EventListener)
    }
  }, [])

  const validateWorkflowParameters = useCallback(async (parsed: ParsedWorkflow, workflow: Workflow) => {
    const errors: Record<string, ValidationError[]> = {}
    const allErrors: ValidationError[] = []
    const warnings: string[] = []

    // Get available outputs for parameter dependency validation
    const availableOutputs: Record<string, ActionOutput> = {}
    parsed.actions.forEach(action => {
      const nodeData = workflow.nodes.find(n => n.id.includes(action.actionType))?.data as { metadata?: ActionMetadata } | undefined
      if (nodeData?.metadata?.outputs) {
        nodeData.metadata.outputs.forEach((output: ActionOutput) => {
          availableOutputs[`${action.id}.${output.name}`] = output
        })
      }
    })

    // Validate each action's parameters
    for (const action of parsed.actions) {
      const nodeData = workflow.nodes.find(n => n.id === action.id)?.data
      if (nodeData?.metadata) {
        const actionMetadata = nodeData.metadata as ActionMetadata
        const currentValues = parameterValues[action.id] || {}

        const validationContext = {
          workflow: parsed,
          currentAction: action,
          availableOutputs
        }

        const actionValidation = parameterValidator.validateAllParameters(
          actionMetadata,
          currentValues,
          validationContext
        )

        if (!actionValidation.isValid) {
          const actionErrors: ValidationError[] = []

          // Add missing parameter errors
          actionValidation.missingParameters.forEach(param => {
            actionErrors.push({
              type: ValidationErrorType.MISSING_REQUIRED,
              message: `${param} is required`,
              field: param,
              severity: 'error'
            })
          })

          // Add invalid parameter errors
          Object.values(actionValidation.invalidParameters).forEach(paramValidation => {
            actionErrors.push(...paramValidation.errors)
          })

          errors[action.id] = actionErrors
          allErrors.push(...actionErrors)
        }

        warnings.push(...actionValidation.warnings)
      }
    }

    setValidationErrors(errors)
    setWorkflowValidationState({
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings
    })
  }, [parameterValues, parameterValidator])

  const simulateWorkflow = async (workflow: ParsedWorkflow) => {
    try {
      // Mock simulation - in real implementation, this would call the simulation service
      const mockSimulation: SimulationResult = {
        success: true,
        gasUsed: Math.floor(Math.random() * 100000) + 50000,
        balanceChanges: [
          {
            address: "0x1234...5678",
            token: "FLOW",
            before: "100.0",
            after: "95.5",
            amount: -4.5
          },
          {
            address: "0x1234...5678",
            token: "USDC",
            before: "1000.0",
            after: "1100.0",
            amount: 100.0
          }
        ],
        events: [
          { type: "TokenSwap", data: "FLOW -> USDC" },
          { type: "BalanceUpdate", data: "Account balance updated" }
        ],
        errors: [],
        warnings: [],
        executionTime: Math.floor(Math.random() * 1000) + 500
      }

      setSimulationResult(mockSimulation)
    } catch (error) {
      console.error('Simulation failed:', error)
      setSimulationResult({
        success: false,
        gasUsed: 0,
        balanceChanges: [],
        events: [],
        errors: [{ type: 'SimulationError', message: 'Failed to simulate workflow' }],
        warnings: [],
        executionTime: 0
      })
    }
  }

  const handleAgentConfiguration = (agentConfig: AgentConfiguration) => {
    console.log('Agent configuration:', agentConfig)
    // In real implementation, this would create the agent
    alert('Agent configuration saved! (Mock implementation)')
  }

  const handleActionNodeSelect = useCallback((nodeId: string, actionMetadata: ActionMetadata) => {
    setSelectedActionForConfig({
      nodeId,
      action: actionMetadata,
      currentValues: parameterValuesRef.current[nodeId] || {}
    })
  }, [])

  const handleParameterChange = useCallback((nodeId: string, parameterName: string, value: any) => {
    setParameterValues(prev => ({
      ...prev,
      [nodeId]: {
        ...prev[nodeId],
        [parameterName]: value
      }
    }))
  }, [])

  const handleParameterValidationChange = useCallback((nodeId: string, isValid: boolean, errors: ValidationError[]) => {
    setValidationErrors(prev => ({
      ...prev,
      [nodeId]: errors
    }))

    // Re-validate workflow when individual parameter validation changes
    if (parsedWorkflow) {
      validateWorkflowParameters(parsedWorkflow, workflow)
    }
  }, [parsedWorkflow, workflow, validateWorkflowParameters])

  const closeParameterConfig = useCallback(() => {
    setSelectedActionForConfig(null)
  }, [])

  const handleNLPWorkflowGenerated = (nlpWorkflow: Workflow) => {
    // Smooth transition from NLP to visual mode
    setInputMode('visual')
    setShowNLPInput(false)

    // Apply the generated workflow with a slight delay for smooth transition
    setTimeout(() => {
      handleWorkflowChange(nlpWorkflow)
    }, 100)
  }

  const toggleInputMode = () => {
    if (inputMode === 'visual') {
      setInputMode('nlp')
      setShowNLPInput(true)
    } else {
      setInputMode('visual')
      setShowNLPInput(false)
    }
  }

  const handleSave = async () => {
    if (!parsedWorkflow) {
      alert("No workflow to save")
      return
    }

    try {
      const response = await fetch("/api/workflow/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: parsedWorkflow }),
      })

      const data = await response.json()

      if (data.success) {
        alert(`Workflow saved! ID: ${data.workflowId}`)
      } else {
        alert(`Save failed: ${data.error}`)
      }
    } catch (error) {
      console.error("[v0] Save error:", error)
      alert("Failed to save workflow")
    }
  }

  const handleExecutionReadinessUpdate = useCallback((data: ExecutionReadinessData | null) => {
    setExecutionReadinessData(data)

    // Update legacy validation state for backward compatibility
    if (data) {
      setWorkflowValidationState({
        isValid: data.canExecute,
        errors: data.blockingErrors,
        warnings: data.warnings.map(w => w.message)
      })
    }
  }, [])

  const handleExecute = async () => {
    if (!parsedWorkflow) {
      alert("No workflow to execute")
      return
    }

    // Check execution readiness first
    if (executionReadinessData && !executionReadinessData.canExecute) {
      const errorMessages = executionReadinessData.blockingErrors.map(error => error.message)
      alert(`Workflow is not ready for execution:\n${errorMessages.join("\n")}\n\nPlease fix the issues before execution.`)
      return
    }

    // Fallback to legacy validation if execution readiness data is not available
    if (!executionReadinessData && !workflowValidationState.isValid) {
      const errorMessages = workflowValidationState.errors.map(error => error.message)
      alert(`Workflow validation failed:\n${errorMessages.join("\n")}\n\nPlease configure all required parameters before execution.`)
      return
    }

    // Check basic workflow structure validation
    const validation = WorkflowParser.validate(parsedWorkflow)
    if (!validation.valid) {
      alert(`Workflow validation failed:\n${validation.errors.join("\n")}`)
      return
    }

    setIsExecuting(true)
    setShowExecutionModal(true)

    try {
      // Get action metadata for execution
      const actionMetadata: Record<string, ActionMetadata> = {}
      parsedWorkflow.actions.forEach(action => {
        const nodeData = workflow.nodes.find(n => n.id === action.id)?.data
        if (nodeData?.metadata) {
          actionMetadata[action.actionType] = nodeData.metadata as ActionMetadata
        }
      })

      // Include parameter values and metadata in the execution request
      const workflowWithParameters = {
        ...parsedWorkflow,
        actions: parsedWorkflow.actions.map(action => ({
          ...action,
          parameters: action.parameters.map(param => ({
            ...param,
            value: parameterValues[action.id]?.[param.name] || param.value
          }))
        }))
      }

      const response = await fetch("/api/workflow/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: workflowWithParameters,
          actionMetadata,
          parameterValues
        }),
      })

      const data = await response.json()
      setExecutionResult(data)
    } catch (error) {
      console.error("[v0] Execution error:", error)
      setExecutionResult({
        success: false,
        error: "Execution failed",
        details: [error instanceof Error ? error.message : "Unknown error"],
      })
    } finally {
      setIsExecuting(false)
    }
  }

  return (
    <div className="flex h-full w-full bg-background">
      <div className="flex w-80 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl gradient-purple glow-primary">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">ActionLoom</h1>
              <p className="text-sm text-muted-foreground">Flow Blockchain Builder</p>
            </div>
          </div>
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">Getting Started:</span> Drag actions from the library
              below onto the canvas to build your blockchain workflow.
            </p>
          </div>
        </div>

        <ErrorBoundary
          fallback={
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Action Library failed to load</p>
                <p className="text-xs text-muted-foreground">Please refresh the page to try again</p>
              </div>
            </div>
          }
          onError={(error, errorInfo) => {
            console.error('ActionLibrary error:', error, errorInfo)
          }}
        >
          <ActionLibrary />
        </ErrorBoundary>
      </div>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            {/* Input Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <button
                onClick={() => inputMode === 'nlp' && toggleInputMode()}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${inputMode === 'visual'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <Grid3X3 className="h-4 w-4" />
                Visual
              </button>
              <button
                onClick={() => inputMode === 'visual' && toggleInputMode()}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all ${inputMode === 'nlp'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
                  }`}
              >
                <MessageSquare className="h-4 w-4" />
                Natural Language
              </button>
            </div>

            {parsedWorkflow ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="text-sm font-medium">{parsedWorkflow.metadata.totalActions} Actions</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-chart-2/10 px-3 py-1.5">
                  <div className="h-2 w-2 rounded-full bg-chart-2" />
                  <span className="text-sm font-medium">{parsedWorkflow.metadata.totalConnections} Connections</span>
                </div>
                {/* Execution Readiness Status */}
                <ExecutionReadinessIndicator
                  workflow={parsedWorkflow}
                  actionMetadata={(() => {
                    const metadata: Record<string, ActionMetadata> = {}
                    if (parsedWorkflow) {
                      parsedWorkflow.actions.forEach(action => {
                        const nodeData = workflow.nodes.find(n => n.id === action.id)?.data
                        if (nodeData?.metadata) {
                          metadata[action.actionType] = nodeData.metadata as ActionMetadata
                        }
                      })
                    }
                    return metadata
                  })()}
                  parameterValues={parameterValues}
                  onValidationUpdate={handleExecutionReadinessUpdate}
                  className="max-w-xs"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm">
                  {inputMode === 'visual'
                    ? 'Start building your workflow'
                    : 'Describe your workflow in natural language'
                  }
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!parsedWorkflow}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-all hover:border-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={handleExecute}
              disabled={!parsedWorkflow || isExecuting || (executionReadinessData ? !executionReadinessData.canExecute : !workflowValidationState.isValid)}
              className="flex items-center gap-2 rounded-lg gradient-purple px-6 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:glow-primary disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                executionReadinessData && !executionReadinessData.canExecute
                  ? `Cannot execute: ${executionReadinessData.blockingErrors.map(e => e.message).join(', ')}`
                  : !workflowValidationState.isValid
                    ? 'Fix validation errors before execution'
                    : ''
              }
            >
              <Play className="h-4 w-4" />
              {isExecuting ? "Executing..." : "Execute Workflow"}
            </button>
          </div>
        </header>

        <div className="flex flex-1 flex-col overflow-hidden">
          {/* NLP Input Interface */}
          {showNLPInput && (
            <div className="transition-all duration-300 ease-in-out">
              <NLPInput
                onWorkflowGenerated={handleNLPWorkflowGenerated}
                onClose={() => {
                  setShowNLPInput(false)
                  setInputMode('visual')
                }}
              />
            </div>
          )}

          {/* Main Content Area */}
          <div className="flex flex-1 overflow-hidden">
            <ErrorBoundary
              fallback={
                <div className="flex-1 flex items-center justify-center bg-background">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-foreground mb-2">Workflow Canvas Error</p>
                    <p className="text-sm text-muted-foreground mb-4">The workflow canvas failed to load properly</p>
                    <button
                      onClick={() => window.location.reload()}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              }
              onError={(error, errorInfo) => {
                console.error('WorkflowCanvas error:', error, errorInfo)
              }}
            >
              <WorkflowCanvas
                workflow={workflow}
                setWorkflow={handleWorkflowChange}
                simulationResult={simulationResult}
                onConfigureAgent={handleAgentConfiguration}
                onActionNodeSelect={handleActionNodeSelect}
                validationErrors={validationErrors}
                parameterValues={parameterValues}
              />
            </ErrorBoundary>
            <CodePreview workflow={workflow} parsedWorkflow={parsedWorkflow} />
          </div>
        </div>
      </div>

      {showExecutionModal && (
        <ExecutionModal
          isExecuting={isExecuting}
          result={executionResult}
          onClose={() => {
            setShowExecutionModal(false)
            setExecutionResult(null)
          }}
        />
      )}

      {/* Parameter Configuration Panel */}
      {selectedActionForConfig && parsedWorkflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <ParameterConfigPanel
            action={selectedActionForConfig.action}
            currentValues={selectedActionForConfig.currentValues}
            onParameterChange={(parameterName, value) =>
              handleParameterChange(selectedActionForConfig.nodeId, parameterName, value)
            }
            onValidationChange={(isValid, errors) =>
              handleParameterValidationChange(selectedActionForConfig.nodeId, isValid, errors)
            }
            availableOutputs={(() => {
              const outputs: Record<string, ActionOutput> = {}
              parsedWorkflow.actions.forEach(action => {
                const nodeData = workflow.nodes.find(n => n.id === action.id)?.data as { metadata?: ActionMetadata } | undefined
                if (nodeData?.metadata?.outputs) {
                  nodeData.metadata.outputs.forEach((output: ActionOutput) => {
                    outputs[`${action.id}.${output.name}`] = output
                  })
                }
              })
              return outputs
            })()}
            workflow={parsedWorkflow}
            currentAction={parsedWorkflow.actions.find(a => a.id === selectedActionForConfig.nodeId)}
            actionMetadata={(() => {
              const metadata: Record<string, ActionMetadata> = {}
              parsedWorkflow.actions.forEach(action => {
                const nodeData = workflow.nodes.find(n => n.id === action.id)?.data
                if (nodeData?.metadata) {
                  metadata[action.actionType] = nodeData.metadata as ActionMetadata
                }
              })
              return metadata
            })()}
            allParameterValues={parameterValues}
            onClose={closeParameterConfig}
          />
        </div>
      )}
    </div>
  )
}
