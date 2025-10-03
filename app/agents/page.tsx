"use client"

import { AgentsPanel } from "@/components/agents-panel"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import CodePreview from "@/components/code-preview"
import { useState } from "react"
import type { Workflow, ParsedWorkflow, AgentConfiguration } from "@/lib/types"
import { Zap } from "lucide-react"

export default function AgentsPage() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>({
    nodes: [],
    edges: [],
  })
  const [parsedWorkflow, setParsedWorkflow] = useState<ParsedWorkflow | null>(null)

  const handleCreateAgent = (config: AgentConfiguration) => {
    console.log('Creating agent with config:', config)
    // In real implementation, this would create the agent via API
    alert('Agent created successfully! (Mock implementation)')
  }

  const handleWorkflowChange = (workflow: Workflow) => {
    setSelectedWorkflow(workflow)
    // Parse workflow if needed
  }

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Agents Panel */}
      <AgentsPanel onCreateAgent={handleCreateAgent} />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-lg gradient-purple glow-primary">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Agent Management</h1>
                <p className="text-sm text-muted-foreground">Monitor and manage your automation agents</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium">3 Active Agents</span>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Workflow Preview */}
          <div className="flex-1 relative">
            <WorkflowCanvas 
              workflow={selectedWorkflow} 
              setWorkflow={handleWorkflowChange}
            />
            
            {/* Empty State */}
            {selectedWorkflow.nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="mb-6 flex justify-center">
                    <div className="relative">
                      <div className="absolute inset-0 animate-ping rounded-full bg-secondary/20" />
                      <div className="relative flex h-20 w-20 items-center justify-center rounded-full gradient-secondary glow-secondary">
                        <Zap className="h-10 w-10 text-white animate-float" />
                      </div>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold mb-3 text-balance">Agent Workflow Preview</h2>
                  <p className="text-muted-foreground mb-6 leading-relaxed text-pretty">
                    Select an agent from the panel to view its workflow configuration and execution history.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Code Preview */}
          <CodePreview workflow={selectedWorkflow} parsedWorkflow={parsedWorkflow} />
        </div>
      </div>
    </div>
  )
}