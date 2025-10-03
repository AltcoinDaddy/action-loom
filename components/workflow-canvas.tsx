"use client"

import type React from "react"

import { useCallback, useState, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { Workflow, SimulationResult, AgentConfiguration, ActionMetadata, ValidationError } from "@/lib/types"
import { ActionNode } from "./action-node"
import { MousePointerClick, WorkflowIcon, AlertTriangle, CheckCircle, Zap, Settings, Clock } from "lucide-react"

const nodeTypes = {
  action: ActionNode,
}

interface ActionNodeData extends Record<string, unknown> {
  label: string
  actionId: string
  category: string
  type: string
  metadata?: ActionMetadata
  hasValidationErrors?: boolean
  onConfigureParameters?: (nodeId: string, actionMetadata: ActionMetadata) => void
}

interface WorkflowCanvasProps {
  workflow: Workflow
  setWorkflow: (workflow: Workflow) => void
  simulationResult?: SimulationResult | null
  onConfigureAgent?: (agentConfig: AgentConfiguration) => void
  onActionNodeSelect?: (nodeId: string, actionMetadata: ActionMetadata) => void
  validationErrors?: Record<string, ValidationError[]>
  parameterValues?: Record<string, Record<string, any>>
}

export function WorkflowCanvas({
  workflow,
  setWorkflow,
  simulationResult,
  onConfigureAgent,
  onActionNodeSelect,
  validationErrors,
  parameterValues
}: WorkflowCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<ActionNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  const [showSimulationPanel, setShowSimulationPanel] = useState(false)
  const [showAgentConfig, setShowAgentConfig] = useState(false)
  const [compatibilityErrors, setCompatibilityErrors] = useState<string[]>([])

  // Update nodes only when workflow nodes or validation errors change
  useEffect(() => {
    const updatedNodes: Node<ActionNodeData>[] = workflow.nodes.map(node => ({
      ...node,
      data: {
        ...(node.data || {}), // Safely handle undefined node.data
        hasValidationErrors: (validationErrors?.[node.id]?.length ?? 0) > 0,
        onConfigureParameters: onActionNodeSelect
      } as ActionNodeData
    }))
    setNodes(updatedNodes)
  }, [workflow.nodes, validationErrors])

  // Check compatibility when nodes or edges change
  useEffect(() => {
    const errors: string[] = []

    // Check for compatibility issues between connected nodes
    edges.forEach(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source)
      const targetNode = nodes.find(n => n.id === edge.target)

      if (sourceNode?.data?.metadata && targetNode?.data?.metadata) {
        const sourceMetadata = sourceNode.data.metadata
        const targetMetadata = targetNode.data.metadata

        // Check for conflicts
        if (sourceMetadata.compatibility?.conflictsWith?.includes(targetMetadata.id)) {
          errors.push(`${sourceNode.data.label} conflicts with ${targetNode.data.label}`)
        }

        // Check required capabilities - for now, we'll skip this check since the type doesn't have supportedCapabilities
        // This would need to be implemented when the CompatibilityInfo type is extended with capability matching
        // if (targetMetadata.compatibility?.requiredCapabilities) {
        //   const missingCapabilities = targetMetadata.compatibility.requiredCapabilities.filter(
        //     (cap: string) => !sourceMetadata.compatibility?.supportedCapabilities?.includes(cap)
        //   )
        //   if (missingCapabilities.length > 0) {
        //     errors.push(`${targetNode.data.label} requires capabilities: ${missingCapabilities.join(', ')}`)
        //   }
        // }
      }
    })

    setCompatibilityErrors(errors)
  }, [nodes, edges])

  const onConnect = useCallback(
    (params: Connection) => {
      // Enhanced edge with compatibility checking
      const newEdge: Edge = {
        ...params,
        id: `${params.source}-${params.target}`,
        animated: true,
        style: {
          stroke: "oklch(0.65 0.25 290)",
          strokeWidth: 2,
        },
      }

      // Check compatibility and add warning style if needed
      const sourceNode = nodes.find(n => n.id === params.source)
      const targetNode = nodes.find(n => n.id === params.target)

      if (sourceNode?.data?.metadata && targetNode?.data?.metadata) {
        const sourceMetadata = sourceNode.data.metadata
        const targetMetadata = targetNode.data.metadata

        if (sourceMetadata.compatibility?.conflictsWith?.includes(targetMetadata.id)) {
          newEdge.style = {
            ...newEdge.style,
            stroke: "#ef4444",
            strokeDasharray: "5,5",
          }
          newEdge.label = "⚠️ Conflict"
          newEdge.labelStyle = { fill: "#ef4444", fontWeight: 600 }
        }
      }

      const newEdges = [...edges, newEdge]
      setEdges(newEdges)
      setWorkflow({ nodes, edges: newEdges })
    },
    [edges, nodes, setEdges, setWorkflow],
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const actionId = event.dataTransfer.getData("application/reactflow")
      const actionName = event.dataTransfer.getData("actionName")
      const actionCategory = event.dataTransfer.getData("actionCategory")
      const actionType = event.dataTransfer.getData("actionType")
      const actionMetadataStr = event.dataTransfer.getData("actionMetadata")

      if (!actionId) return

      // Parse action metadata if available
      let actionMetadata = null
      try {
        if (actionMetadataStr) {
          actionMetadata = JSON.parse(actionMetadataStr)
        }
      } catch (error) {
        console.warn('Failed to parse action metadata:', error)
      }

      const reactFlowBounds = event.currentTarget.getBoundingClientRect()
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 40,
      }

      const nodeId = `${actionId}-${Date.now()}`
      const newNode: Node<ActionNodeData> = {
        id: nodeId,
        type: "action",
        position,
        data: {
          label: actionName,
          actionId,
          category: actionCategory,
          type: actionType,
          metadata: actionMetadata, // Include full action metadata
        },
      }

      const newNodes = [...nodes, newNode]
      setNodes(newNodes)
      setWorkflow({ nodes: newNodes, edges })

      // Initialize parameter values with defaults to prevent "missing required parameter" errors
      if (actionMetadata?.parameters) {
        const initialParameterValues: Record<string, any> = {}
        let hasRequiredParameters = false

        actionMetadata.parameters.forEach((param: any) => {
          // Check if this action has required parameters
          if (param.required) {
            hasRequiredParameters = true
          }

          // Initialize with default values based on parameter type
          if (param.defaultValue !== undefined) {
            initialParameterValues[param.name] = param.defaultValue
          } else if (!param.required) {
            // Optional parameters can be empty
            initialParameterValues[param.name] = ''
          } else {
            // Required parameters get type-appropriate default values
            switch (param.type) {
              case 'Address':
                initialParameterValues[param.name] = ''
                break
              case 'UFix64':
                initialParameterValues[param.name] = ''
                break
              case 'String':
                initialParameterValues[param.name] = ''
                break
              case 'Bool':
                initialParameterValues[param.name] = false
                break
              case 'Int':
                initialParameterValues[param.name] = ''
                break
              case 'UInt64':
                initialParameterValues[param.name] = ''
                break
              default:
                initialParameterValues[param.name] = ''
            }
          }
        })

        // Notify parent component about the new parameter values
        // We need to pass this up to the WorkflowBuilder
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('actionAdded', {
            detail: { nodeId, parameterValues: initialParameterValues }
          }))
        }

        // Auto-open configuration panel if action has required parameters
        if (hasRequiredParameters && onActionNodeSelect && actionMetadata) {
          // Add small delay for smooth UX transition from drop to configuration panel opening
          setTimeout(() => {
            onActionNodeSelect(nodeId, actionMetadata)
          }, 150) // 150ms delay for smooth transition
        }
      }
    },
    [nodes, edges, setNodes, setWorkflow, onActionNodeSelect],
  )

  return (
    <div className="relative flex-1 bg-background">
      <div className="pointer-events-none absolute inset-0 gradient-mesh" />

      {/* Compatibility Errors Panel */}
      {compatibilityErrors.length > 0 && (
        <div className="absolute top-4 left-4 z-20 max-w-sm">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 shadow-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">Compatibility Issues</span>
            </div>
            <ul className="space-y-1">
              {compatibilityErrors.map((error, index) => (
                <li key={index} className="text-xs text-red-700">
                  • {error}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Simulation Results Panel */}
      {simulationResult && showSimulationPanel && (
        <div className="absolute top-4 right-4 z-20 w-80">
          <div className="rounded-lg border border-border bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {simulationResult.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm font-medium">
                  Simulation {simulationResult.success ? 'Successful' : 'Failed'}
                </span>
              </div>
              <button
                onClick={() => setShowSimulationPanel(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            {simulationResult.success ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Gas Used:</span>
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    <span className="font-medium">{simulationResult.gasUsed?.toLocaleString()}</span>
                  </div>
                </div>

                {simulationResult.balanceChanges && simulationResult.balanceChanges.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Balance Changes:</div>
                    <div className="space-y-1">
                      {simulationResult.balanceChanges.map((change, index) => (
                        <div key={index} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{change.token}:</span>
                          <span className={change.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                            {change.amount > 0 ? '+' : ''}{change.amount}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {simulationResult.events && simulationResult.events.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-2">Events:</div>
                    <div className="space-y-1 max-h-20 overflow-y-auto">
                      {simulationResult.events.map((event, index) => (
                        <div key={index} className="text-xs text-muted-foreground">
                          {event.type}: {event.data}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {simulationResult.errors?.map((error, index) => (
                  <div key={index} className="text-sm text-red-600">
                    {error.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent Configuration Panel */}
      {showAgentConfig && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Configure Agent</h3>
              <button
                onClick={() => setShowAgentConfig(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Schedule Type</label>
                <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="recurring">Recurring</option>
                  <option value="event-driven">Event Driven</option>
                  <option value="one-time">One Time</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Interval</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="1"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <select className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                    <option value="weeks">Weeks</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Event Triggers</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Price threshold</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Balance change</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm">Time-based</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAgentConfig(false)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Handle agent configuration
                    if (onConfigureAgent) {
                      const mockConfig: AgentConfiguration = {
                        schedule: {
                          type: 'recurring',
                          interval: 3600, // 1 hour
                        },
                        eventTriggers: [],
                        retryPolicy: {
                          maxRetries: 3,
                          backoffMultiplier: 2,
                          initialDelay: 1000,
                        },
                        notifications: {
                          onSuccess: true,
                          onFailure: true,
                          channels: ['email'],
                        },
                        permissions: [],
                      }
                      onConfigureAgent(mockConfig)
                    }
                    setShowAgentConfig(false)
                  }}
                  className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Create Agent
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Controls */}
      {nodes.length > 0 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg">
            {simulationResult && (
              <button
                onClick={() => setShowSimulationPanel(!showSimulationPanel)}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
              >
                <Zap className="h-4 w-4" />
                Simulation
              </button>
            )}
            <button
              onClick={() => setShowAgentConfig(true)}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            >
              <Settings className="h-4 w-4" />
              Configure Agent
            </button>
          </div>
        </div>
      )}

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="mb-6 flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <div className="relative flex h-20 w-20 items-center justify-center rounded-full gradient-purple glow-primary">
                  <WorkflowIcon className="h-10 w-10 text-white animate-float" />
                </div>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-balance">Build Your Workflow</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed text-pretty">
              Drag actions from the library on the left onto this canvas. Connect them together to create your
              blockchain automation workflow.
            </p>
            <div className="flex items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <MousePointerClick className="h-4 w-4 text-primary" />
                </div>
                <span className="text-muted-foreground">Drag & Drop</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-2/10">
                  <svg className="h-4 w-4 text-chart-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>
                <span className="text-muted-foreground">Connect Nodes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
        defaultEdgeOptions={{
          animated: true,
          style: {
            stroke: "oklch(0.65 0.25 290)",
            strokeWidth: 2,
          },
        }}
      >
        <Background className="opacity-30" color="oklch(0.2 0 0)" gap={40} size={1} />
        <Controls className="rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl [&>button]:border-border [&>button]:bg-background [&>button]:text-foreground [&>button]:transition-all [&>button:hover]:bg-primary/10 [&>button:hover]:border-primary [&>button:hover]:text-primary" />
        <MiniMap
          className="rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl"
          nodeColor={(node) => {
            if (node.data?.category === "defi") return "oklch(0.65 0.25 290)"
            if (node.data?.category === "nft") return "oklch(0.7 0.2 200)"
            if (node.data?.category === "governance") return "oklch(0.75 0.2 150)"
            return "oklch(0.65 0.25 290)"
          }}
          maskColor="rgba(0, 0, 0, 0.85)"
        />
      </ReactFlow>
    </div>
  )
}
