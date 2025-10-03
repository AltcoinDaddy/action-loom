import { NextRequest, NextResponse } from 'next/server'
import { EnhancedWorkflowValidator } from '@/lib/enhanced-workflow-validator'
import { ActionDiscoveryService } from '@/lib/action-discovery-service'
import { ParsedWorkflow } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const { workflow, includeSimulation = false } = await request.json()
    
    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow is required' },
        { status: 400 }
      )
    }

    // Initialize services
    const validator = new EnhancedWorkflowValidator()
    const actionDiscovery = new ActionDiscoveryService()
    
    // Get action metadata for the workflow
    const actionIds = workflow.actions?.map((action: any) => action.id) || []
    const actions = await Promise.all(
      actionIds.map(async (id: string) => {
        try {
          return await actionDiscovery.getActionById(id)
        } catch (error) {
          console.warn(`Failed to get action metadata for ${id}:`, error)
          return null
        }
      })
    )
    
    const validActions = actions.filter(action => action !== null)
    
    // Perform validation with or without simulation
    let validationResult
    if (includeSimulation) {
      validationResult = await validator.validateWithSimulation(workflow as ParsedWorkflow, validActions)
    } else {
      validationResult = await validator.validateWorkflowWithSafety(workflow as ParsedWorkflow, validActions)
    }
    
    // Get deployment recommendations and security audit
    const recommendations = validator.getDeploymentRecommendations(validationResult)
    const securityAudit = validator.getSecurityAuditSummary(validationResult)
    
    return NextResponse.json({
      validation: validationResult,
      recommendations,
      securityAudit,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Workflow safety validation error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to validate workflow safety',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Workflow Safety Validation API',
    endpoints: {
      'POST /api/workflow/validate-safety': {
        description: 'Validate workflow with comprehensive safety analysis',
        parameters: {
          workflow: 'ParsedWorkflow object (required)',
          includeSimulation: 'boolean (optional, default: false)'
        },
        response: {
          validation: 'EnhancedValidationResult',
          recommendations: 'string[]',
          securityAudit: 'SecurityAuditSummary',
          timestamp: 'ISO string'
        }
      }
    },
    features: [
      'Resource lifecycle analysis',
      'Memory leak detection',
      'Security vulnerability scanning',
      'Flow security tools integration',
      'Deployment readiness assessment',
      'Risk level calculation',
      'Security audit scoring'
    ]
  })
}