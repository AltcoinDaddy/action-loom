import { NextResponse } from "next/server"
import type { ParsedWorkflow, ActionMetadata } from "@/lib/types"
import { ExecutionValidator } from "@/lib/execution-validator"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { workflow, actionMetadata, parameterValues } = body as { 
      workflow: ParsedWorkflow
      actionMetadata?: Record<string, ActionMetadata>
      parameterValues?: Record<string, Record<string, any>>
    }

    if (!workflow) {
      return NextResponse.json({ error: "No workflow provided" }, { status: 400 })
    }

    // Initialize execution validator
    const executionValidator = new ExecutionValidator()

    // Get action metadata (in production, this would come from action registry)
    const metadata = actionMetadata || getDefaultActionMetadata(workflow)
    const parameters = parameterValues || {}

    // Perform comprehensive validation
    const validationResult = await executionValidator.validateForExecution(
      workflow,
      metadata,
      parameters
    )

    return NextResponse.json({
      success: true,
      canExecute: validationResult.canExecute,
      executionReadiness: validationResult.executionReadiness,
      blockingErrors: validationResult.blockingErrors,
      warnings: validationResult.warnings,
      estimatedGasCost: validationResult.estimatedGasCost,
      estimatedExecutionTime: validationResult.estimatedExecutionTime,
      validationDetails: {
        parametersConfigured: validationResult.executionReadiness.parametersConfigured,
        dataFlowValid: validationResult.executionReadiness.dataFlowValid,
        noCircularDependencies: validationResult.executionReadiness.noCircularDependencies,
        allActionsValid: validationResult.executionReadiness.allActionsValid,
        readinessScore: validationResult.executionReadiness.readinessScore
      }
    })
  } catch (error) {
    console.error("[ExecutionValidator] Validation error:", error)
    return NextResponse.json(
      {
        error: "Validation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

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