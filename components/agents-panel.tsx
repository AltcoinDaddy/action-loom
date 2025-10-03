"use client"

import { useState, useEffect } from "react"
import {
  Bot,
  Play,
  Pause,
  Square,
  Settings,
  Plus,
  Clock,
  Zap,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Calendar,
  Activity
} from "lucide-react"
import type { Agent, AgentConfiguration, Schedule } from "@/lib/types"
import { AgentStatus } from "@/lib/types"

interface AgentInfo extends Agent {
  executionCount: number
  successRate: number
  lastExecution?: Date
  nextExecution?: Date
  gasUsed: number
  errors: number
}

interface AgentsPanel {
  onCreateAgent?: (config: AgentConfiguration) => void
}

export function AgentsPanel({ onCreateAgent }: AgentsPanel) {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null)
  const [showCreateWizard, setShowCreateWizard] = useState(false)
  const [loading, setLoading] = useState(true)

  // Mock data - in real implementation, this would fetch from API
  useEffect(() => {
    const mockAgents: AgentInfo[] = [
      {
        id: "agent-1",
        name: "DeFi Yield Optimizer",
        description: "Automatically rebalances portfolio for optimal yield",
        workflowId: "workflow-1",
        schedule: {
          type: 'recurring',
          interval: 3600, // 1 hour
        },
        triggers: [],
        status: AgentStatus.ACTIVE,
        createdAt: "2024-01-15T10:00:00Z",
        updatedAt: "2024-01-15T10:00:00Z",
        owner: "user-1",
        executionCount: 24,
        successRate: 95.8,
        lastExecution: new Date(Date.now() - 3600000), // 1 hour ago
        nextExecution: new Date(Date.now() + 1800000), // 30 minutes from now
        gasUsed: 125000,
        errors: 1
      },
      {
        id: "agent-2",
        name: "NFT Floor Price Monitor",
        description: "Monitors NFT floor prices and executes buy orders",
        workflowId: "workflow-2",
        schedule: {
          type: 'event-driven',
          eventTriggers: [
            {
              type: 'price',
              condition: { operator: 'lt', value: 10 },
              parameters: { collection: 'TopShot' }
            }
          ]
        },
        triggers: [],
        status: AgentStatus.PAUSED,
        createdAt: "2024-01-10T14:30:00Z",
        updatedAt: "2024-01-14T09:15:00Z",
        owner: "user-1",
        executionCount: 8,
        successRate: 100,
        lastExecution: new Date(Date.now() - 86400000), // 1 day ago
        gasUsed: 45000,
        errors: 0
      },
      {
        id: "agent-3",
        name: "Governance Voter",
        description: "Automatically votes on governance proposals based on criteria",
        workflowId: "workflow-3",
        schedule: {
          type: 'event-driven',
          eventTriggers: [
            {
              type: 'custom',
              condition: { operator: 'eq', value: 'new_proposal' },
              parameters: { dao: 'FlowDAO' }
            }
          ]
        },
        triggers: [],
        status: AgentStatus.ERROR,
        createdAt: "2024-01-05T16:45:00Z",
        updatedAt: "2024-01-15T11:30:00Z",
        owner: "user-1",
        executionCount: 3,
        successRate: 66.7,
        lastExecution: new Date(Date.now() - 172800000), // 2 days ago
        gasUsed: 15000,
        errors: 1
      }
    ]

    setTimeout(() => {
      setAgents(mockAgents)
      setLoading(false)
    }, 1000)
  }, [])

  const getStatusIcon = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.ACTIVE:
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case AgentStatus.PAUSED:
        return <Pause className="h-4 w-4 text-yellow-500" />
      case AgentStatus.STOPPED:
        return <Square className="h-4 w-4 text-gray-500" />
      case AgentStatus.ERROR:
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return <Bot className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: AgentStatus) => {
    switch (status) {
      case AgentStatus.ACTIVE:
        return "text-green-600 bg-green-50 border-green-200"
      case AgentStatus.PAUSED:
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case AgentStatus.STOPPED:
        return "text-gray-600 bg-gray-50 border-gray-200"
      case AgentStatus.ERROR:
        return "text-red-600 bg-red-50 border-red-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const handleStatusChange = (agentId: string, newStatus: AgentStatus) => {
    setAgents(prev => prev.map(agent =>
      agent.id === agentId
        ? { ...agent, status: newStatus, updatedAt: new Date().toISOString() }
        : agent
    ))
  }

  const formatSchedule = (schedule: Schedule) => {
    if (schedule.type === 'recurring') {
      const hours = Math.floor((schedule.interval || 0) / 3600)
      const minutes = Math.floor(((schedule.interval || 0) % 3600) / 60)
      if (hours > 0) {
        return `Every ${hours}h${minutes > 0 ? ` ${minutes}m` : ''}`
      }
      return `Every ${minutes}m`
    }
    if (schedule.type === 'event-driven') {
      return 'Event-driven'
    }
    return 'One-time'
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const formatTimeUntil = (date: Date) => {
    const now = new Date()
    const diff = date.getTime() - now.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `in ${days}d`
    if (hours > 0) return `in ${hours}h`
    if (minutes > 0) return `in ${minutes}m`
    return 'soon'
  }

  if (loading) {
    return (
      <div className="flex h-full w-80 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-12 w-12 rounded-xl bg-muted animate-pulse" />
            <div>
              <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
              <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-80 flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="border-b border-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl gradient-secondary glow-secondary">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agents</h1>
            <p className="text-sm text-muted-foreground">Automation Dashboard</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateWizard(true)}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`rounded-lg border p-4 transition-all cursor-pointer hover:shadow-md ${selectedAgent?.id === agent.id
                ? 'border-primary bg-primary/5'
                : 'border-border bg-background hover:border-primary/50'
              }`}
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {getStatusIcon(agent.status)}
                  <h3 className="font-medium text-sm truncate">{agent.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {agent.description}
                </p>
              </div>
              <div className="flex gap-1 ml-2">
                {agent.status === AgentStatus.ACTIVE && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStatusChange(agent.id, AgentStatus.PAUSED)
                    }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Pause className="h-3 w-3" />
                  </button>
                )}
                {agent.status === AgentStatus.PAUSED && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStatusChange(agent.id, AgentStatus.ACTIVE)
                    }}
                    className="p-1 rounded hover:bg-muted"
                  >
                    <Play className="h-3 w-3" />
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    // Handle settings
                  }}
                  className="p-1 rounded hover:bg-muted"
                >
                  <Settings className="h-3 w-3" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(agent.status)}`}>
                {agent.status.toUpperCase()}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatSchedule(agent.schedule)}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Activity className="h-3 w-3" />
                  <span>{agent.executionCount} runs</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  <span>{agent.successRate}% success</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Zap className="h-3 w-3" />
                  <span>{(agent.gasUsed / 1000).toFixed(1)}K gas</span>
                </div>
              </div>

              {agent.lastExecution && (
                <div className="text-xs text-muted-foreground">
                  Last: {formatTimeAgo(agent.lastExecution)}
                  {agent.nextExecution && agent.status === AgentStatus.ACTIVE && (
                    <span> • Next: {formatTimeUntil(agent.nextExecution)}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Agent Details Panel */}
      {selectedAgent && (
        <div className="border-t border-border p-4 bg-muted/30">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-sm">Agent Details</h4>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-muted-foreground">Created:</span>
              <span className="ml-2">{new Date(selectedAgent.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Workflow ID:</span>
              <span className="ml-2 font-mono">{selectedAgent.workflowId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Executions:</span>
              <span className="ml-2">{selectedAgent.executionCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Success Rate:</span>
              <span className="ml-2">{selectedAgent.successRate}%</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Gas Used:</span>
              <span className="ml-2">{selectedAgent.gasUsed.toLocaleString()}</span>
            </div>
            {selectedAgent.errors > 0 && (
              <div>
                <span className="text-muted-foreground">Errors:</span>
                <span className="ml-2 text-red-600">{selectedAgent.errors}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <button className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              View History
            </button>
            <button className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted">
              Edit Config
            </button>
          </div>
        </div>
      )}

      {/* Create Agent Wizard Modal */}
      {showCreateWizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Create New Agent</h3>
              <button
                onClick={() => setShowCreateWizard(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Agent Name</label>
                <input
                  type="text"
                  placeholder="My DeFi Agent"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <textarea
                  placeholder="Describe what this agent does..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-none"
                  rows={3}
                />
              </div>

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

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateWizard(false)}
                  className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Handle agent creation
                    if (onCreateAgent) {
                      const mockConfig: AgentConfiguration = {
                        schedule: {
                          type: 'recurring',
                          interval: 3600,
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
                      onCreateAgent(mockConfig)
                    }
                    setShowCreateWizard(false)
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
    </div>
  )
}