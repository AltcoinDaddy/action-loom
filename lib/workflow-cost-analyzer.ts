import { 
  ParsedWorkflow, 
  ActionMetadata, 
  ValidationResult,
  SimulationResult,
  EnhancedWorkflow
} from './types'
import { WorkflowCompatibilityService } from './workflow-compatibility-service'
import { FlowEmulatorService } from './flow-emulator-service'
import { GasEstimationService, ComprehensiveGasAnalysis } from './gas-estimation-service'

export interface WorkflowCostAnalysis {
  workflow: EnhancedWorkflow
  compatibilityResult: any // WorkflowCompatibilityResult
  simulationResult?: SimulationResult
  gasAnalysis: ComprehensiveGasAnalysis
  overallScore: number
  criticalIssues: string[]
  recommendations: string[]
  executionReadiness: 'ready' | 'needs_review' | 'not_ready'
}

export interface CostAnalysisOptions {
  runSimulation: boolean
  includeOptimizations: boolean
  gasPrice?: number
  networkConditions?: 'low' | 'medium' | 'high'
  userAddress?: string
  bufferPercentage: number
}

export class WorkflowCostAnalyzer {
  private compatibilityService: WorkflowCompatibilityService
  private emulatorService: FlowEmulatorService
  private gasEstimationService: GasEstimationService

  constructor() {
    this.compatibilityService = new WorkflowCompatibilityService()
    this.emulatorService = new FlowEmulatorService()
    this.gasEstimationService = new GasEstimationService(this.emulatorService)
  }

  /**
   * Perform comprehensive workflow cost analysis
   */
  async analyzeWorkflow(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[],
    options: CostAnalysisOptions = {
      runSimulation: true,
      includeOptimizations: true,
      bufferPercentage: 10
    }
  ): Promise<WorkflowCostAnalysis> {
    // Step 1: Check workflow compatibility
    const compatibilityResult = await this.compatibilityService.checkWorkflowCompatibility(
      workflow,
      actionMetadata
    )

    // Step 2: Run simulation if requested and workflow is compatible
    let simulationResult: SimulationResult | undefined
    if (options.runSimulation && compatibilityResult.isValid) {
      try {
        simulationResult = await this.emulatorService.simulateWorkflow(
          workflow,
          actionMetadata,
          { dryRun: true }
        )
      } catch (error) {
        console.warn('Simulation failed:', error)
      }
    }

    // Step 3: Perform gas analysis
    const gasAnalysis = await this.gasEstimationService.analyzeWorkflowCosts(
      workflow,
      actionMetadata,
      {
        useHistoricalData: true,
        runSimulation: options.runSimulation,
        includeOptimizations: options.includeOptimizations,
        gasPrice: options.gasPrice,
        networkConditions: options.networkConditions,
        includeGasCosts: true,
        bufferPercentage: options.bufferPercentage,
        checkAllTokens: true,
        userAddress: options.userAddress
      }
    )

    // Step 4: Create enhanced workflow
    const enhancedWorkflow: EnhancedWorkflow = {
      ...workflow,
      validationResults: {
        isValid: compatibilityResult.isValid,
        errors: compatibilityResult.errors,
        warnings: compatibilityResult.warnings,
        compatibilityIssues: compatibilityResult.typeCompatibility.issues
      },
      simulationResults: simulationResult,
      securityLevel: this.calculateWorkflowSecurityLevel(actionMetadata),
      estimatedGas: gasAnalysis.gasEstimate.totalGas,
      requiredBalance: gasAnalysis.balanceRequirements.map(req => ({
        token: req.token,
        amount: req.minimumRequired,
        decimals: this.getTokenDecimals(req.token)
      }))
    }

    // Step 5: Calculate overall score
    const overallScore = this.calculateOverallScore(
      compatibilityResult,
      simulationResult,
      gasAnalysis
    )

    // Step 6: Identify critical issues
    const criticalIssues = this.identifyCriticalIssues(
      compatibilityResult,
      simulationResult,
      gasAnalysis
    )

    // Step 7: Generate comprehensive recommendations
    const recommendations = this.generateComprehensiveRecommendations(
      compatibilityResult,
      simulationResult,
      gasAnalysis,
      overallScore
    )

    // Step 8: Determine execution readiness
    const executionReadiness = this.determineExecutionReadiness(
      overallScore,
      criticalIssues.length,
      gasAnalysis
    )

    return {
      workflow: enhancedWorkflow,
      compatibilityResult,
      simulationResult,
      gasAnalysis,
      overallScore,
      criticalIssues,
      recommendations,
      executionReadiness
    }
  }

  /**
   * Quick cost estimate without full analysis
   */
  async quickCostEstimate(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[]
  ): Promise<{
    estimatedGas: number
    estimatedCostUSD?: number
    feasible: boolean
    warnings: string[]
  }> {
    const gasEstimate = await this.gasEstimationService.estimateWorkflowGas(
      workflow,
      actionMetadata,
      {
        useHistoricalData: true,
        runSimulation: false,
        includeOptimizations: false
      }
    )

    const balanceRequirements = await this.gasEstimationService.calculateBalanceRequirements(
      workflow,
      actionMetadata,
      gasEstimate,
      {
        includeGasCosts: true,
        bufferPercentage: 10,
        checkAllTokens: false
      }
    )

    const insufficientBalances = balanceRequirements.filter(req => req.isInsufficient)
    const feasible = insufficientBalances.length === 0 && gasEstimate.totalGas < 1000000

    return {
      estimatedGas: gasEstimate.totalGas,
      feasible,
      warnings: gasEstimate.warnings
    }
  }

  /**
   * Compare multiple workflow alternatives
   */
  async compareWorkflows(
    workflows: { name: string; workflow: ParsedWorkflow }[],
    actionMetadata: ActionMetadata[],
    options: CostAnalysisOptions
  ): Promise<{
    comparisons: Array<{
      name: string
      analysis: WorkflowCostAnalysis
      rank: number
    }>
    recommendation: string
  }> {
    const analyses = await Promise.all(
      workflows.map(async ({ name, workflow }) => ({
        name,
        analysis: await this.analyzeWorkflow(workflow, actionMetadata, options)
      }))
    )

    // Rank workflows by overall score
    const ranked = analyses
      .map((item, index) => ({ ...item, rank: 0 }))
      .sort((a, b) => b.analysis.overallScore - a.analysis.overallScore)
      .map((item, index) => ({ ...item, rank: index + 1 }))

    // Generate recommendation
    const best = ranked[0]
    const recommendation = `Recommended workflow: "${best.name}" with score ${best.analysis.overallScore}/100. ` +
      `Estimated gas: ${best.analysis.gasAnalysis.gasEstimate.totalGas}, ` +
      `Feasibility: ${best.analysis.gasAnalysis.feasibilityScore}/100`

    return {
      comparisons: ranked,
      recommendation
    }
  }

  /**
   * Calculate workflow security level based on actions
   */
  private calculateWorkflowSecurityLevel(actionMetadata: ActionMetadata[]): any {
    const securityLevels = actionMetadata.map(m => m.securityLevel)
    
    if (securityLevels.includes('critical' as any)) return 'critical'
    if (securityLevels.includes('high' as any)) return 'high'
    if (securityLevels.includes('medium' as any)) return 'medium'
    return 'low'
  }

  /**
   * Get token decimals (mock implementation)
   */
  private getTokenDecimals(token: string): number {
    const decimals: Record<string, number> = {
      'FLOW': 8,
      'USDC': 6,
      'FUSD': 8
    }
    return decimals[token] || 8
  }

  /**
   * Calculate overall workflow score
   */
  private calculateOverallScore(
    compatibilityResult: any,
    simulationResult?: SimulationResult,
    gasAnalysis?: ComprehensiveGasAnalysis
  ): number {
    let score = 100

    // Compatibility score (40% weight)
    if (!compatibilityResult.isValid) {
      score -= 40
    } else {
      score -= compatibilityResult.warnings.length * 2
    }

    // Simulation score (30% weight)
    if (simulationResult) {
      if (!simulationResult.success) {
        score -= 30
      } else {
        score -= simulationResult.errors.length * 5
        score -= simulationResult.warnings.length * 2
      }
    }

    // Gas analysis score (30% weight)
    if (gasAnalysis) {
      const feasibilityPenalty = (100 - gasAnalysis.feasibilityScore) * 0.3
      score -= feasibilityPenalty
    }

    return Math.max(0, Math.min(100, Math.round(score)))
  }

  /**
   * Identify critical issues that prevent execution
   */
  private identifyCriticalIssues(
    compatibilityResult: any,
    simulationResult?: SimulationResult,
    gasAnalysis?: ComprehensiveGasAnalysis
  ): string[] {
    const issues: string[] = []

    // Compatibility issues
    if (!compatibilityResult.isValid) {
      issues.push('Workflow has compatibility issues that prevent execution')
    }

    if (compatibilityResult.circularDependencies.length > 0) {
      issues.push('Circular dependencies detected in workflow')
    }

    // Simulation issues
    if (simulationResult && !simulationResult.success) {
      issues.push('Workflow simulation failed')
    }

    // Gas and balance issues
    if (gasAnalysis) {
      const insufficientBalances = gasAnalysis.balanceRequirements.filter(req => req.isInsufficient)
      if (insufficientBalances.length > 0) {
        issues.push(`Insufficient balance for ${insufficientBalances.length} token(s)`)
      }

      if (gasAnalysis.gasEstimate.totalGas > 1000000) {
        issues.push('Gas usage exceeds recommended limits')
      }

      if (gasAnalysis.feasibilityScore < 30) {
        issues.push('Workflow feasibility is critically low')
      }
    }

    return issues
  }

  /**
   * Generate comprehensive recommendations
   */
  private generateComprehensiveRecommendations(
    compatibilityResult: any,
    simulationResult?: SimulationResult,
    gasAnalysis?: ComprehensiveGasAnalysis,
    overallScore?: number
  ): string[] {
    const recommendations: string[] = []

    // Compatibility recommendations
    if (!compatibilityResult.isValid) {
      recommendations.push('Fix compatibility issues before proceeding with execution')
      
      for (const issue of compatibilityResult.typeCompatibility.issues) {
        recommendations.push(`Address compatibility issue: ${issue.suggestion}`)
      }
    }

    // Add compatibility suggestions
    recommendations.push(...compatibilityResult.typeCompatibility.suggestions)

    // Simulation recommendations
    if (simulationResult && !simulationResult.success) {
      recommendations.push('Review and fix simulation errors before execution')
    }

    // Gas analysis recommendations
    if (gasAnalysis) {
      recommendations.push(...gasAnalysis.recommendations)
    }

    // Overall score recommendations
    if (overallScore !== undefined) {
      if (overallScore < 50) {
        recommendations.push('Workflow requires significant improvements before execution')
      } else if (overallScore < 75) {
        recommendations.push('Consider addressing identified issues to improve workflow reliability')
      }
    }

    // Remove duplicates and return
    return [...new Set(recommendations)]
  }

  /**
   * Determine execution readiness
   */
  private determineExecutionReadiness(
    overallScore: number,
    criticalIssuesCount: number,
    gasAnalysis: ComprehensiveGasAnalysis
  ): 'ready' | 'needs_review' | 'not_ready' {
    if (criticalIssuesCount > 0) {
      return 'not_ready'
    }

    if (overallScore < 50 || gasAnalysis.feasibilityScore < 50) {
      return 'not_ready'
    }

    if (overallScore < 75 || gasAnalysis.feasibilityScore < 75) {
      return 'needs_review'
    }

    return 'ready'
  }

  /**
   * Generate cost optimization report
   */
  async generateOptimizationReport(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[]
  ): Promise<{
    currentCost: number
    optimizedCost: number
    savings: number
    optimizations: Array<{
      type: string
      description: string
      savings: number
      impact: 'low' | 'medium' | 'high'
    }>
  }> {
    const gasAnalysis = await this.gasEstimationService.analyzeWorkflowCosts(
      workflow,
      actionMetadata,
      { includeOptimizations: true }
    )

    const currentCost = gasAnalysis.gasEstimate.totalGas
    const totalSavings = gasAnalysis.optimizations.reduce((sum, opt) => sum + opt.estimatedSavings, 0)
    const optimizedCost = Math.max(0, currentCost - totalSavings)

    const optimizations = gasAnalysis.optimizations.map(opt => ({
      type: opt.type,
      description: opt.description,
      savings: opt.estimatedSavings,
      impact: this.categorizeOptimizationImpact(opt.estimatedSavings, currentCost)
    }))

    return {
      currentCost,
      optimizedCost,
      savings: totalSavings,
      optimizations
    }
  }

  /**
   * Categorize optimization impact
   */
  private categorizeOptimizationImpact(savings: number, totalCost: number): 'low' | 'medium' | 'high' {
    const percentage = (savings / totalCost) * 100
    
    if (percentage > 20) return 'high'
    if (percentage > 10) return 'medium'
    return 'low'
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.emulatorService.cleanup()
  }
}

export const workflowCostAnalyzer = new WorkflowCostAnalyzer()