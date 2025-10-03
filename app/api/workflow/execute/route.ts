import { NextResponse } from "next/server"
import type { ParsedWorkflow, ActionMetadata } from "@/lib/types"
import { CadenceGenerator } from "@/lib/cadence-generator"
import { WorkflowParser } from "@/lib/workflow-parser"
import { ExecutionValidator } from "@/lib/execution-validator"
import {
  withErrorHandling,
  createSuccessResponse,
  createErrorResponse,
  validateRequiredFields,
  validateParameters,
  throwValidationError,
  ErrorCode
} from "@/lib/api-error-handler"

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

  const { workflow, actionMetadata, parameterValues } = body as { 
    workflow: ParsedWorkflow
    actionMetadata?: Record<string, ActionMetadata>
    parameterValues?: Record<string, Record<string, any>>
  }

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

  // Validate action metadata if provided
  if (actionMetadata && typeof actionMetadata !== 'object') {
    throwValidationError('Invalid action metadata format', 'Action metadata must be an object')
  }

  // Validate parameter values if provided
  if (parameterValues && typeof parameterValues !== 'object') {
    throwValidationError('Invalid parameter values format', 'Parameter values must be an object')
  }

  // Initialize execution validator
  const executionValidator = new ExecutionValidator()

  // Get action metadata (in production, this would come from action registry)
  const metadata = actionMetadata || getDefaultActionMetadata(workflow)
  const parameters = parameterValues || {}

  let validationResult: any
  try {
    // Comprehensive pre-execution validation
    validationResult = await executionValidator.validateForExecution(
      workflow,
      metadata,
      parameters
    )
  } catch (error) {
    throwValidationError('Execution validation failed', error instanceof Error ? error.message : 'Unknown validation error')
  }

  if (!validationResult.canExecute) {
    return createErrorResponse(
      'Workflow validation failed',
      400,
      ErrorCode.VALIDATION_FAILED,
      JSON.stringify({
        blockingErrors: validationResult.blockingErrors,
        warnings: validationResult.warnings,
        executionReadiness: validationResult.executionReadiness
      })
    )
  }

  // Legacy validation for backward compatibility
  let legacyValidation: any
  try {
    legacyValidation = WorkflowParser.validate(workflow)
  } catch (error) {
    throwValidationError('Workflow structure validation failed', error instanceof Error ? error.message : 'Unknown structure validation error')
  }

  if (!legacyValidation.valid) {
    return createErrorResponse(
      'Workflow structure validation failed',
      400,
      ErrorCode.VALIDATION_FAILED,
      JSON.stringify(legacyValidation.errors)
    )
  }

  // Generate Cadence code
  let cadenceCode: string
  try {
    cadenceCode = CadenceGenerator.generateTransaction(workflow)
  } catch (error) {
    throwValidationError('Cadence code generation failed', error instanceof Error ? error.message : 'Unknown code generation error')
  }

  // Simulate execution (in production, this would interact with Flow blockchain)
  let executionResult: any
  try {
    executionResult = await simulateExecution(workflow, cadenceCode)
  } catch (error) {
    throwValidationError('Workflow execution simulation failed', error instanceof Error ? error.message : 'Unknown execution error')
  }

  return createSuccessResponse(null, {
    transactionId: executionResult.transactionId,
    status: executionResult.status,
    cadenceCode,
    executionTime: executionResult.executionTime,
    gasUsed: executionResult.gasUsed,
    validationResult: {
      executionReadiness: validationResult.executionReadiness,
      estimatedGasCost: validationResult.estimatedGasCost,
      estimatedExecutionTime: validationResult.estimatedExecutionTime,
      warnings: validationResult.warnings
    }
  })
}

export const POST = withErrorHandling(handlePOST, 'Workflow Execution')

/**
 * Get default action metadata for validation
 * In production, this would come from the action registry
 */
function getDefaultActionMetadata(workflow: ParsedWorkflow): Record<string, ActionMetadata> {
  const metadata: Record<string, ActionMetadata> = {}

  workflow.actions.forEach(action => {
    // Create basic metadata for each action type
    metadata[action.actionType] = {
      id: action.actionType,
      name: action.name,
      description: `${action.name} action`,
      category: 'defi',
      version: '1.0.0',
      inputs: [],
      outputs: [
        { name: 'result', type: 'String', description: 'Action result' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: action.parameters.map(param => ({
        ...param,
        validation: {
          required: param.required,
          type: param.type as any,
          constraints: {}
        }
      })) as any,
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 5000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  })

  return metadata
}

/**
 * Simulate workflow execution on Flow blockchain
 * In production, this would use @onflow/fcl to interact with Flow
 */
async function simulateExecution(workflow: ParsedWorkflow, cadenceCode: string) {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 1500))

  // Generate mock transaction ID
  const transactionId = `0x${Math.random().toString(16).substring(2, 18)}`

  // Calculate mock gas usage based on workflow complexity
  const gasUsed = workflow.metadata.totalActions * 100 + workflow.metadata.totalConnections * 50

  return {
    transactionId,
    status: "sealed" as const,
    executionTime: 1500,
    gasUsed,
    blockHeight: Math.floor(Math.random() * 1000000) + 50000000,
  }
}
