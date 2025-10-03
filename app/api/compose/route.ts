import { NextResponse } from "next/server"
import { NLPService } from "@/lib/nlp-service"
import { ActionMappingService } from "@/lib/action-mapping-service"
import { EnhancedWorkflowValidator } from "@/lib/enhanced-workflow-validator"
import { CadenceGenerator } from "@/lib/cadence-generator"
import { withAuth } from "@/lib/api-auth-service"
import { 
  NLPResult, 
  ParsedWorkflow, 
  EnhancedWorkflow, 
  ValidationResult,
  SimulationResult,
  ExecutionResult
} from "@/lib/types"

/**
 * AI Agent API - Workflow Composition Endpoint
 * 
 * POST /api/compose
 * Accepts natural language or structured workflow definitions and returns
 * validated workflows with generated Cadence code
 * 
 * Requirements: 5.1, 5.2 - AI Agent API integration
 */

interface ComposeRequest {
  // Natural language input
  naturalLanguage?: string
  
  // Structured workflow input
  workflow?: ParsedWorkflow
  
  // Options
  options?: {
    validate?: boolean
    simulate?: boolean
    generateCadence?: boolean
    executeImmediately?: boolean
  }
  
  // Metadata
  metadata?: {
    name?: string
    description?: string
    tags?: string[]
    userId?: string
  }
}

interface ComposeResponse {
  success: boolean
  workflowId?: string
  workflow?: EnhancedWorkflow
  cadenceCode?: string
  validationResult?: ValidationResult
  simulationResult?: SimulationResult
  executionResult?: ExecutionResult
  nlpResult?: NLPResult
  error?: string
  warnings?: string[]
}

export async function POST(request: Request) {
  try {
    // Authenticate request
    const authResult = await withAuth('compose', 'write')(request)
    if (!authResult.success) {
      return NextResponse.json({
        success: false,
        error: authResult.error
      }, { status: authResult.status })
    }

    const body: ComposeRequest = await request.json()
    
    // Validate request
    if (!body.naturalLanguage && !body.workflow) {
      return NextResponse.json({
        success: false,
        error: "Either naturalLanguage or workflow must be provided"
      }, { status: 400 })
    }

    const options = {
      validate: true,
      simulate: false,
      generateCadence: true,
      executeImmediately: false,
      ...body.options
    }

    let workflow: ParsedWorkflow
    let nlpResult: NLPResult | undefined

    // Process natural language input
    if (body.naturalLanguage) {
      console.log('Processing natural language input:', body.naturalLanguage)
      
      const nlpService = new NLPService()
      const actionMappingService = new ActionMappingService()
      
      // Parse natural language
      nlpResult = await nlpService.parseWorkflow(body.naturalLanguage)
      
      if (nlpResult.confidence < 0.7) {
        return NextResponse.json({
          success: false,
          error: "Low confidence in natural language parsing",
          nlpResult,
          warnings: ["Consider providing more specific instructions or using structured workflow format"]
        }, { status: 400 })
      }

      // Map to workflow
      workflow = await actionMappingService.mapToWorkflow(nlpResult)
    } else {
      workflow = body.workflow!
    }

    // Create enhanced workflow
    const enhancedWorkflow: EnhancedWorkflow = {
      ...workflow,
      nlpSource: body.naturalLanguage,
      validationResults: { isValid: true, errors: [], warnings: [], compatibilityIssues: [] },
      securityLevel: 'medium' as any,
      estimatedGas: 0,
      requiredBalance: []
    }

    // Generate workflow ID
    const workflowId = `wf_${Date.now()}_${Math.random().toString(36).substring(7)}`

    let validationResult: ValidationResult | undefined
    let simulationResult: SimulationResult | undefined
    let cadenceCode: string | undefined
    let executionResult: ExecutionResult | undefined

    // Validate workflow if requested
    if (options.validate) {
      console.log('Validating workflow...')
      const validator = new EnhancedWorkflowValidator()
      validationResult = await validator.validateWorkflow(enhancedWorkflow)
      
      if (!validationResult.isValid) {
        return NextResponse.json({
          success: false,
          error: "Workflow validation failed",
          validationResult,
          workflow: enhancedWorkflow,
          nlpResult
        }, { status: 400 })
      }
    }

    // Simulate workflow if requested
    if (options.simulate && validationResult?.isValid) {
      console.log('Simulating workflow execution...')
      const validator = new EnhancedWorkflowValidator()
      simulationResult = await validator.simulateExecution(enhancedWorkflow)
      
      if (!simulationResult.success) {
        return NextResponse.json({
          success: false,
          error: "Workflow simulation failed",
          simulationResult,
          validationResult,
          workflow: enhancedWorkflow,
          nlpResult
        }, { status: 400 })
      }
    }

    // Generate Cadence code if requested
    if (options.generateCadence) {
      console.log('Generating Cadence code...')
      const generator = new CadenceGenerator()
      cadenceCode = generator.generateTransaction(workflow)
    }

    // Execute immediately if requested
    if (options.executeImmediately && cadenceCode) {
      console.log('Executing workflow immediately...')
      // This would integrate with Flow blockchain execution
      executionResult = await simulateExecution(enhancedWorkflow, cadenceCode)
    }

    // Update enhanced workflow with results
    if (validationResult) {
      enhancedWorkflow.validationResults = validationResult
    }
    if (simulationResult) {
      enhancedWorkflow.simulationResults = simulationResult
      enhancedWorkflow.estimatedGas = simulationResult.gasUsed
    }

    // Add metadata
    if (body.metadata) {
      enhancedWorkflow.metadata = {
        ...enhancedWorkflow.metadata,
        name: body.metadata.name,
        ...body.metadata
      }
    }

    const response: ComposeResponse = {
      success: true,
      workflowId,
      workflow: enhancedWorkflow,
      cadenceCode,
      validationResult,
      simulationResult,
      executionResult,
      nlpResult
    }

    // Add rate limit headers
    const headers: Record<string, string> = {}
    if (authResult.remainingRequests) {
      headers['X-RateLimit-Remaining-Minute'] = authResult.remainingRequests.minute.toString()
      headers['X-RateLimit-Remaining-Hour'] = authResult.remainingRequests.hour.toString()
      headers['X-RateLimit-Remaining-Day'] = authResult.remainingRequests.day.toString()
    }

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('[API] Compose error:', error)
    return NextResponse.json({
      success: false,
      error: "Workflow composition failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}

/**
 * Simulate workflow execution
 * In production, this would use Flow blockchain integration
 */
async function simulateExecution(workflow: EnhancedWorkflow, cadenceCode: string): Promise<ExecutionResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Generate mock transaction ID
  const transactionId = `0x${Math.random().toString(16).substring(2, 18)}`

  // Calculate mock gas usage
  const gasUsed = workflow.metadata.totalActions * 100 + workflow.metadata.totalConnections * 50

  return {
    success: true,
    transactionId,
    status: "sealed",
    cadenceCode,
    executionTime: 1000,
    gasUsed
  }
}