import { NextResponse } from "next/server"
import { agentManagementService, agentFactory } from "@/lib/agent-management-service"
import { withAuth } from "@/lib/api-auth-service"
import { 
  Agent, 
  AgentConfiguration, 
  AgentStatus,
  ParsedWorkflow,
  EnhancedWorkflow
} from "@/lib/types"
import {
  withErrorHandling,
  createSuccessResponse,
  createErrorResponse,
  validateRequiredFields,
  validateParameters,
  throwNotFound,
  throwValidationError,
  ErrorCode
} from "@/lib/api-error-handler"

/**
 * AI Agent API - Agent Management Endpoint
 * 
 * GET /api/agents - List Agents
 * POST /api/agents - Create new Agent
 * PUT /api/agents - Update Agent
 * DELETE /api/agents - Delete Agent
 * 
 * Requirements: 5.1, 5.2 - AI Agent API integration
 */

interface CreateAgentRequest {
  // Workflow to deploy as Agent
  workflow?: ParsedWorkflow | EnhancedWorkflow
  workflowId?: string
  
  // Agent configuration
  config: AgentConfiguration
  
  // Agent metadata
  name: string
  description: string
  owner: string
}

interface UpdateAgentRequest {
  agentId: string
  updates: Partial<AgentConfiguration & { 
    name?: string
    description?: string 
  }>
}

interface DeleteAgentRequest {
  agentId: string
}

async function handleGET(request: Request): Promise<NextResponse> {
  // Authenticate request
  const authResult = await withAuth('agents', 'read')(request)
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error,
      authResult.status,
      authResult.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN
    )
  }

  const { searchParams } = new URL(request.url)
  
  const agentId = searchParams.get('id')
  const userId = searchParams.get('userId') || searchParams.get('owner')
  const status = searchParams.get('status') as AgentStatus
  const includeHealth = searchParams.get('health') === 'true'
  
  // Validate agentId format if provided
  if (agentId && !/^[a-zA-Z0-9\-_]+$/.test(agentId)) {
    throwValidationError('Invalid agent ID format', 'Agent ID must contain only alphanumeric characters, hyphens, and underscores')
  }

  // Validate userId format if provided
  if (userId && !/^[a-zA-Z0-9\-_@.]+$/.test(userId)) {
    throwValidationError('Invalid user ID format', 'User ID must contain only alphanumeric characters, hyphens, underscores, @ and dots')
  }

  // Validate status if provided
  if (status && !['active', 'inactive', 'paused', 'error'].includes(status)) {
    throwValidationError('Invalid status value', 'Status must be one of: active, inactive, paused, error')
  }
  
  // Get specific Agent by ID
  if (agentId) {
    console.log(`Fetching Agent: ${agentId}`)
    
    let agent: Agent | null
    try {
      agent = agentManagementService.getAgentStatus(agentId)
    } catch (error) {
      throwValidationError('Failed to fetch agent', error instanceof Error ? error.message : 'Unknown agent fetch error')
    }
    
    if (!agent) {
      throwNotFound('Agent', agentId)
    }

    let health = undefined
    if (includeHealth) {
      try {
        health = agentManagementService.getAgentHealth(agentId)
      } catch (error) {
        // Health fetch is optional, log but don't fail
        console.warn(`Failed to fetch health for agent ${agentId}:`, error)
      }
    }

    return createSuccessResponse(null, {
      agent,
      health
    })
  }

  // Get Agents for specific user or all agents
  let agents: Agent[]
  try {
    if (userId) {
      console.log(`Fetching Agents for user: ${userId}`)
      agents = agentManagementService.getUserAgents(userId)
    } else {
      console.log('Fetching all Agents...')
      agents = agentManagementService.getAllAgents()
    }
  } catch (error) {
    throwValidationError('Failed to fetch agents', error instanceof Error ? error.message : 'Unknown agents fetch error')
  }

  // Filter by status if specified
  if (status) {
    agents = agents.filter(agent => agent.status === status)
  }

  // Include health information if requested
  const agentsWithHealth = includeHealth ? agents.map(agent => {
    try {
      return {
        agent,
        health: agentManagementService.getAgentHealth(agent.id)
      }
    } catch (error) {
      // Health fetch is optional, return agent without health
      console.warn(`Failed to fetch health for agent ${agent.id}:`, error)
      return { agent }
    }
  }) : agents.map(agent => ({ agent }))

  return createSuccessResponse(null, {
    agents: agentsWithHealth,
    total: agents.length,
    filters: {
      userId,
      status,
      includeHealth
    }
  })
}

export const GET = withErrorHandling(handleGET, 'Agents Fetch')

async function handlePOST(request: Request): Promise<NextResponse> {
  // Authenticate request
  const authResult = await withAuth('agents', 'write')(request)
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error,
      authResult.status,
      authResult.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN
    )
  }

  let body: CreateAgentRequest
  try {
    body = await request.json()
  } catch (error) {
    throwValidationError('Invalid JSON in request body', 'Request body must be valid JSON')
  }

  if (!body || typeof body !== 'object') {
    throwValidationError('Invalid request body', 'Request body must be a JSON object')
  }
  
  // Validate required fields
  validateRequiredFields(body, ['config', 'name', 'owner'])

  // Validate field formats
  validateParameters(body, {
    name: (value) => typeof value === 'string' && value.length > 0 && value.length <= 100 || 'Agent name must be 1-100 characters',
    owner: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_@.]+$/.test(value) || 'Owner must contain only alphanumeric characters, hyphens, underscores, @ and dots',
    config: (value) => typeof value === 'object' && value !== null || 'Config must be an object'
  })

  // Validate description if provided
  if (body.description !== undefined) {
    validateParameters({ description: body.description }, {
      description: (value) => typeof value === 'string' && value.length <= 500 || 'Description must be at most 500 characters'
    })
  }

  let agentId: string

  // Create Agent from workflow
  if (body.workflow) {
    console.log('Creating Agent from workflow...')
    
    // Validate workflow structure
    if (typeof body.workflow !== 'object') {
      throwValidationError('Invalid workflow format', 'Workflow must be an object')
    }

    try {
      // Check if it's an EnhancedWorkflow
      if ('validationResults' in body.workflow) {
        agentId = await agentFactory.createFromWorkflow(
          body.workflow as EnhancedWorkflow,
          {
            name: body.name,
            description: body.description,
            owner: body.owner
          }
        )
      } else {
        agentId = await agentFactory.createFromParsedWorkflow(
          body.workflow as ParsedWorkflow,
          body.config,
          {
            name: body.name,
            description: body.description,
            owner: body.owner
          }
        )
      }
    } catch (error) {
      throwValidationError('Agent creation from workflow failed', error instanceof Error ? error.message : 'Unknown workflow creation error')
    }
  } else if (body.workflowId) {
    // Validate workflow ID format
    if (!/^wf_\d+_[a-zA-Z0-9]+$/.test(body.workflowId)) {
      throwValidationError('Invalid workflow ID format', 'Workflow ID must be in format: wf_timestamp_randomstring')
    }

    console.log(`Creating Agent from workflow ID: ${body.workflowId}`)
    
    try {
      agentId = await agentManagementService.createAgent(
        body.workflowId,
        body.config,
        {
          name: body.name,
          description: body.description,
          owner: body.owner
        }
      )
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throwNotFound('Workflow', body.workflowId)
      }
      throwValidationError('Agent creation from workflow ID failed', error instanceof Error ? error.message : 'Unknown workflow ID creation error')
    }
  } else {
    throwValidationError('Missing workflow source', 'Either workflow or workflowId must be provided')
  }

  let agent: Agent | null
  try {
    agent = agentManagementService.getAgentStatus(agentId)
  } catch (error) {
    throwValidationError('Failed to fetch created agent', error instanceof Error ? error.message : 'Unknown agent fetch error')
  }
  
  return createSuccessResponse(null, {
    agentId,
    agent,
    message: "Agent created successfully"
  })
}

export const POST = withErrorHandling(handlePOST, 'Agent Creation')

async function handlePUT(request: Request): Promise<NextResponse> {
  // Authenticate request
  const authResult = await withAuth('agents', 'write')(request)
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error,
      authResult.status,
      authResult.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN
    )
  }

  let body: UpdateAgentRequest
  try {
    body = await request.json()
  } catch (error) {
    throwValidationError('Invalid JSON in request body', 'Request body must be valid JSON')
  }

  if (!body || typeof body !== 'object') {
    throwValidationError('Invalid request body', 'Request body must be a JSON object')
  }
  
  // Validate required fields
  validateRequiredFields(body, ['agentId', 'updates'])

  // Validate agentId format
  validateParameters(body, {
    agentId: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_]+$/.test(value) || 'Agent ID must contain only alphanumeric characters, hyphens, and underscores',
    updates: (value) => typeof value === 'object' && value !== null || 'Updates must be an object'
  })

  // Validate update fields if provided
  if (body.updates.name !== undefined) {
    validateParameters({ name: body.updates.name }, {
      name: (value) => typeof value === 'string' && value.length > 0 && value.length <= 100 || 'Agent name must be 1-100 characters'
    })
  }

  if (body.updates.description !== undefined) {
    validateParameters({ description: body.updates.description }, {
      description: (value) => typeof value === 'string' && value.length <= 500 || 'Description must be at most 500 characters'
    })
  }

  console.log(`Updating Agent: ${body.agentId}`)
  
  try {
    await agentManagementService.updateAgent(body.agentId, body.updates)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throwNotFound('Agent', body.agentId)
    }
    throwValidationError('Agent update failed', error instanceof Error ? error.message : 'Unknown update error')
  }
  
  let updatedAgent: Agent | null
  try {
    updatedAgent = agentManagementService.getAgentStatus(body.agentId)
  } catch (error) {
    throwValidationError('Failed to fetch updated agent', error instanceof Error ? error.message : 'Unknown agent fetch error')
  }
  
  return createSuccessResponse(null, {
    agent: updatedAgent,
    message: "Agent updated successfully"
  })
}

export const PUT = withErrorHandling(handlePUT, 'Agent Update')

async function handleDELETE(request: Request): Promise<NextResponse> {
  // Authenticate request
  const authResult = await withAuth('agents', 'delete')(request)
  if (!authResult.success) {
    return createErrorResponse(
      authResult.error,
      authResult.status,
      authResult.status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN
    )
  }

  let body: DeleteAgentRequest
  try {
    body = await request.json()
  } catch (error) {
    throwValidationError('Invalid JSON in request body', 'Request body must be valid JSON')
  }

  if (!body || typeof body !== 'object') {
    throwValidationError('Invalid request body', 'Request body must be a JSON object')
  }
  
  // Validate required fields
  validateRequiredFields(body, ['agentId'])

  // Validate agentId format
  validateParameters(body, {
    agentId: (value) => typeof value === 'string' && /^[a-zA-Z0-9\-_]+$/.test(value) || 'Agent ID must contain only alphanumeric characters, hyphens, and underscores'
  })

  console.log(`Deleting Agent: ${body.agentId}`)
  
  try {
    await agentManagementService.deleteAgent(body.agentId)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      throwNotFound('Agent', body.agentId)
    }
    throwValidationError('Agent deletion failed', error instanceof Error ? error.message : 'Unknown deletion error')
  }
  
  return createSuccessResponse(null, {
    message: "Agent deleted successfully",
    deletedAgentId: body.agentId
  })
}

export const DELETE = withErrorHandling(handleDELETE, 'Agent Deletion')