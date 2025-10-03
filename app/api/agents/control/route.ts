import { NextResponse } from "next/server"
import { agentManagementService } from "@/lib/agent-management-service"

/**
 * AI Agent API - Agent Control Endpoint
 * 
 * POST /api/agents/control - Control Agent execution (pause, resume, stop)
 */

interface AgentControlRequest {
  agentId: string
  action: 'pause' | 'resume' | 'stop'
}

export async function POST(request: Request) {
  try {
    const body: AgentControlRequest = await request.json()
    
    if (!body.agentId || !body.action) {
      return NextResponse.json({
        success: false,
        error: "Missing required fields: agentId, action"
      }, { status: 400 })
    }

    const { agentId, action } = body

    console.log(`Agent control: ${action} for Agent ${agentId}`)

    switch (action) {
      case 'pause':
        await agentManagementService.pauseAgent(agentId)
        break
      case 'resume':
        await agentManagementService.resumeAgent(agentId)
        break
      case 'stop':
        await agentManagementService.stopAgent(agentId)
        break
      default:
        return NextResponse.json({
          success: false,
          error: `Invalid action: ${action}. Must be 'pause', 'resume', or 'stop'`
        }, { status: 400 })
    }

    const updatedAgent = agentManagementService.getAgentStatus(agentId)
    
    return NextResponse.json({
      success: true,
      agent: updatedAgent,
      message: `Agent ${action} successful`
    })

  } catch (error) {
    console.error('[API] Agent control error:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 404 })
    }

    return NextResponse.json({
      success: false,
      error: "Agent control failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}