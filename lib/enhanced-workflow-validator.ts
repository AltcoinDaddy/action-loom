import { ParsedWorkflow, ActionMetadata, ValidationResult } from './types'
import { WorkflowCompatibilityService } from './workflow-compatibility-service'
import { FlowEmulatorService } from './flow-emulator-service'
import { GasEstimationService } from './gas-estimation-service'
import { ResourceSafetyService, ResourceAnalysis } from './resource-safety-service'
import { CadenceGenerator } from './cadence-generator'

export interface EnhancedValidationResult extends ValidationResult {
  resourceSafety: ResourceAnalysis
  flowSecurityTools?: {
    flowLintResults: any[]
    cadenceAnalyzerResults: any[]
    recommendations: string[]
  }
  overallRisk: 'low' | 'medium' | 'high'
  deploymentReady: boolean
}

export class EnhancedWorkflowValidator {
  private compatibilityService: WorkflowCompatibilityService
  private emulatorService: FlowEmulatorService
  private gasEstimationService: GasEstimationService
  private resourceSafetyService: ResourceSafetyService
  private cadenceGenerator: CadenceGenerator

  constructor() {
    this.compatibilityService = new WorkflowCompatibilityService()
    this.emulatorService = new FlowEmulatorService()
    this.gasEstimationService = new GasEstimationService()
    this.resourceSafetyService = new ResourceSafetyService()
    this.cadenceGenerator = new CadenceGenerator()
  }

  /**
   * Performs comprehensive validation including resource safety analysis
   */
  async validateWorkflowWithSafety(
    workflow: ParsedWorkflow,
    actions: ActionMetadata[]
  ): Promise<EnhancedValidationResult> {
    // Perform basic compatibility validation
    const basicValidation = await this.compatibilityService.validateWorkflow(workflow, actions)
    
    // Generate Cadence code for safety analysis
    const cadenceCode = await this.cadenceGenerator.generateWorkflowCode(workflow)
    
    // Perform resource safety analysis
    const resourceSafety = await this.resourceSafetyService.analyzeResourceSafety(
      cadenceCode,
      workflow,
      actions
    )
    
    // Integrate with Flow security tools
    const flowSecurityTools = await this.resourceSafetyService.integrateFlowSecurityTools(cadenceCode)
    
    // Calculate overall risk assessment
    const overallRisk = this.calculateOverallRisk(basicValidation, resourceSafety)
    
    // Determine if workflow is ready for deployment
    const deploymentReady = this.isDeploymentReady(basicValidation, resourceSafety, overallRisk)
    
    return {
      ...basicValidation,
      resourceSafety,
      flowSecurityTools,
      overallRisk,
      deploymentReady
    }
  }

  /**
   * Validates workflow with simulation and safety checks
   */
  async validateWithSimulation(
    workflow: ParsedWorkflow,
    actions: ActionMetadata[]
  ): Promise<EnhancedValidationResult> {
    // Get enhanced validation results
    const validationResult = await this.validateWorkflowWithSafety(workflow, actions)
    
    // If basic validation passes, run simulation
    if (validationResult.isValid && validationResult.resourceSafety.overallSafety !== 'unsafe') {
      try {
        const simulationResult = await this.emulatorService.simulateWorkflow(workflow, actions)
        const gasEstimate = await this.gasEstimationService.estimateWorkflowGas(workflow, actions)
        
        // Update validation result with simulation data
        validationResult.simulationResult = simulationResult
        validationResult.gasEstimate = gasEstimate
        
        // Re-evaluate deployment readiness with simulation results
        validationResult.deploymentReady = this.isDeploymentReady(
          validationResult,
          validationResult.resourceSafety,
          validationResult.overallRisk,
          simulationResult
        )
      } catch (error) {
        validationResult.errors.push(`Simulation failed: ${error.message}`)
        validationResult.isValid = false
        validationResult.deploymentReady = false
      }
    }
    
    return validationResult
  }

  /**
   * Calculates overall risk level based on all validation results
   */
  private calculateOverallRisk(
    basicValidation: ValidationResult,
    resourceSafety: ResourceAnalysis
  ): 'low' | 'medium' | 'high' {
    // High risk conditions
    if (!basicValidation.isValid || resourceSafety.overallSafety === 'unsafe') {
      return 'high'
    }
    
    // Check for high severity security issues
    const highSeverityIssues = [
      ...resourceSafety.resourceLeaks.filter(leak => leak.severity === 'high'),
      ...resourceSafety.unsafeOperations.filter(op => op.severity === 'high'),
      ...resourceSafety.securityIssues.filter(issue => issue.severity === 'high')
    ]
    
    if (highSeverityIssues.length > 0) {
      return 'high'
    }
    
    // Medium risk conditions
    if (resourceSafety.overallSafety === 'warning' || basicValidation.warnings.length > 3) {
      return 'medium'
    }
    
    // Check for multiple medium severity issues
    const mediumSeverityIssues = [
      ...resourceSafety.resourceLeaks.filter(leak => leak.severity === 'medium'),
      ...resourceSafety.unsafeOperations.filter(op => op.severity === 'medium'),
      ...resourceSafety.securityIssues.filter(issue => issue.severity === 'medium')
    ]
    
    if (mediumSeverityIssues.length > 2) {
      return 'medium'
    }
    
    return 'low'
  }

  /**
   * Determines if workflow is ready for deployment
   */
  private isDeploymentReady(
    basicValidation: ValidationResult,
    resourceSafety: ResourceAnalysis,
    overallRisk: 'low' | 'medium' | 'high',
    simulationResult?: any
  ): boolean {
    // Must pass basic validation
    if (!basicValidation.isValid) {
      return false
    }
    
    // Must not have unsafe resource safety rating
    if (resourceSafety.overallSafety === 'unsafe') {
      return false
    }
    
    // Must not have high overall risk
    if (overallRisk === 'high') {
      return false
    }
    
    // If simulation was run, it must have succeeded
    if (simulationResult && !simulationResult.success) {
      return false
    }
    
    // Check for critical security issues
    const criticalIssues = resourceSafety.securityIssues.filter(issue => 
      issue.severity === 'high' && 
      (issue.type === 'access_control' || issue.type === 'resource_management')
    )
    
    if (criticalIssues.length > 0) {
      return false
    }
    
    return true
  }

  /**
   * Gets deployment recommendations based on validation results
   */
  getDeploymentRecommendations(validationResult: EnhancedValidationResult): string[] {
    const recommendations: string[] = []
    
    if (!validationResult.deploymentReady) {
      recommendations.push('⚠️ Workflow is not ready for deployment')
      
      if (!validationResult.isValid) {
        recommendations.push('• Fix validation errors before deployment')
      }
      
      if (validationResult.resourceSafety.overallSafety === 'unsafe') {
        recommendations.push('• Address resource safety issues')
      }
      
      if (validationResult.overallRisk === 'high') {
        recommendations.push('• Reduce overall risk level')
      }
    } else {
      recommendations.push('✅ Workflow is ready for deployment')
      
      if (validationResult.overallRisk === 'medium') {
        recommendations.push('• Consider addressing medium-risk issues for better security')
      }
      
      if (validationResult.resourceSafety.overallSafety === 'warning') {
        recommendations.push('• Review resource safety warnings')
      }
    }
    
    // Add specific resource safety recommendations
    recommendations.push(...validationResult.resourceSafety.recommendations.map(rec => `• ${rec}`))
    
    // Add Flow security tool recommendations
    if (validationResult.flowSecurityTools) {
      recommendations.push(...validationResult.flowSecurityTools.recommendations.map(rec => `• ${rec}`))
    }
    
    return recommendations
  }

  /**
   * Gets security audit summary
   */
  getSecurityAuditSummary(validationResult: EnhancedValidationResult): {
    score: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
    issues: {
      critical: number
      high: number
      medium: number
      low: number
    }
    recommendations: string[]
  } {
    const { resourceSafety } = validationResult
    
    // Count issues by severity
    const issues = {
      critical: 0,
      high: [
        ...resourceSafety.resourceLeaks.filter(leak => leak.severity === 'high'),
        ...resourceSafety.unsafeOperations.filter(op => op.severity === 'high'),
        ...resourceSafety.securityIssues.filter(issue => issue.severity === 'high')
      ].length,
      medium: [
        ...resourceSafety.resourceLeaks.filter(leak => leak.severity === 'medium'),
        ...resourceSafety.unsafeOperations.filter(op => op.severity === 'medium'),
        ...resourceSafety.securityIssues.filter(issue => issue.severity === 'medium')
      ].length,
      low: [
        ...resourceSafety.resourceLeaks.filter(leak => leak.severity === 'low'),
        ...resourceSafety.unsafeOperations.filter(op => op.severity === 'low'),
        ...resourceSafety.securityIssues.filter(issue => issue.severity === 'low')
      ].length
    }
    
    // Calculate security score (0-100)
    let score = 100
    score -= issues.high * 20
    score -= issues.medium * 10
    score -= issues.low * 5
    score = Math.max(0, score)
    
    // Determine grade
    let grade: 'A' | 'B' | 'C' | 'D' | 'F'
    if (score >= 90) grade = 'A'
    else if (score >= 80) grade = 'B'
    else if (score >= 70) grade = 'C'
    else if (score >= 60) grade = 'D'
    else grade = 'F'
    
    return {
      score,
      grade,
      issues,
      recommendations: this.getDeploymentRecommendations(validationResult)
    }
  }
}