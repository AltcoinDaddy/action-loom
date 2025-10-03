import { NextResponse } from "next/server"
import { agentManagementService } from "@/lib/agent-management-service"

/**
 * AI Agent API - Agent Health Monitoring Endpoint
 * 
 * GET /api/agents/health - Get Agent health status and metrics
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('id')
    const userId = searchParams.get('userId') || searchParams.get('owner')
    
    // Get health for specific Agent
    if (agentId) {
      console.log(`Fetching health for Agent: ${agentId}`)
      
      const agent = agentManagementService.getAgentStatus(agentId)
      if (!agent) {
        return NextResponse.json({
          success: false,
          error: `Agent ${agentId} not found`
        }, { status: 404 })
      }

      const health = agentManagementService.getAgentHealth(agentId)
      
      return NextResponse.json({
        success: true,
        agentId,
        agent,
        health
      })
    }

    // Get health for all Agents (or user's Agents)
    let agents = userId 
      ? agentManagementService.getUserAgents(userId)
      : agentManagementService.getAllAgents()

    const healthData = agents.map(agent => ({
      agentId: agent.id,
      agent,
      health: agentManagementService.getAgentHealth(agent.id)
    }))

    // Calculate summary statistics
    const totalAgents = healthData.length
    const healthyAgents = healthData.filter(data => data.health?.status === 'healthy').length
    const degradedAgents = healthData.filter(data => data.health?.status === 'degraded').length
    const unhealthyAgents = healthData.filter(data => data.health?.status === 'unhealthy').length

    const summary = {
      total: totalAgents,
      healthy: healthyAgents,
      degraded: degradedAgents,
      unhealthy: unhealthyAgents,
      healthyPercentage: totalAgents > 0 ? Math.round((healthyAgents / totalAgents) * 100) : 0
    }

    return NextResponse.json({
      success: true,
      summary,
      agents: healthData,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('[API] Agent health error:', error)
    return NextResponse.json({
      success: false,
      error: "Failed to fetch Agent health",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}