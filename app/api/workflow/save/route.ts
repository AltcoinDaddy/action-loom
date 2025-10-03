import { NextResponse } from "next/server"
import type { ParsedWorkflow } from "@/lib/types"
import {
  withErrorHandling,
  createSuccessResponse,
  validateRequiredFields,
  validateParameters,
  throwNotFound,
  throwValidationError
} from "@/lib/api-error-handler"

// In-memory storage (in production, use a database)
const workflowStore = new Map<string, ParsedWorkflow>()

async function handlePOST(request: Request): Promise<NextResponse> {
  let body: any
  try {
    body = await request.json()
  } catch (error) {
    throwValidationError('Invalid JSON in request body', 'Request body must be valid JSON')
  }

  if (!body || typeof body !== 'object') {
    throwValidationError('Invalid request body', 'Request body must be a JSON object')
  }

  const { workflow, name } = body as { workflow: ParsedWorkflow; name?: string }

  // Validate required fields
  validateRequiredFields(body, ['workflow'])

  // Validate workflow structure
  if (typeof workflow !== 'object') {
    throwValidationError('Invalid workflow format', 'Workflow must be an object')
  }

  validateRequiredFields(workflow, ['actions', 'connections', 'metadata'])

  // Validate workflow arrays
  if (!Array.isArray(workflow.actions)) {
    throwValidationError('Invalid workflow actions', 'Workflow actions must be an array')
  }

  if (!Array.isArray(workflow.connections)) {
    throwValidationError('Invalid workflow connections', 'Workflow connections must be an array')
  }

  if (workflow.actions.length === 0) {
    throwValidationError('Empty workflow', 'Workflow must contain at least one action')
  }

  if (workflow.actions.length > 100) {
    throwValidationError('Workflow too large', 'Maximum 100 actions allowed per workflow')
  }

  // Validate name if provided
  if (name !== undefined) {
    validateParameters({ name }, {
      name: (value) => typeof value === 'string' && value.length > 0 && value.length <= 100 || 'Workflow name must be 1-100 characters'
    })
  }

  // Generate workflow ID
  const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // Store workflow
  try {
    workflowStore.set(workflowId, {
      ...workflow,
      metadata: {
        ...workflow.metadata,
        name: name || `Workflow ${workflowId}`,
        savedAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    throwValidationError('Failed to save workflow', error instanceof Error ? error.message : 'Unknown storage error')
  }

  return createSuccessResponse(null, {
    workflowId,
    message: "Workflow saved successfully"
  })
}

async function handleGET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const workflowId = searchParams.get("id")

  if (workflowId) {
    // Validate workflow ID format
    if (!/^wf_\d+_[a-zA-Z0-9]+$/.test(workflowId)) {
      throwValidationError('Invalid workflow ID format', 'Workflow ID must be in format: wf_timestamp_randomstring')
    }

    const workflow = workflowStore.get(workflowId)
    if (!workflow) {
      throwNotFound('Workflow', workflowId)
    }

    return createSuccessResponse(null, { workflow })
  }

  // Return all workflows
  try {
    const workflows = Array.from(workflowStore.entries()).map(([id, workflow]) => ({
      id,
      name: workflow.metadata.name || id,
      totalActions: workflow.metadata.totalActions,
      createdAt: workflow.metadata.createdAt,
      savedAt: workflow.metadata.savedAt
    }))

    return createSuccessResponse(null, {
      workflows,
      total: workflows.length
    })
  } catch (error) {
    throwValidationError('Failed to fetch workflows', error instanceof Error ? error.message : 'Unknown fetch error')
  }
}

export const POST = withErrorHandling(handlePOST, 'Workflow Save')
export const GET = withErrorHandling(handleGET, 'Workflow Fetch')
