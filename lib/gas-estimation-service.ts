import { 
  ParsedWorkflow, 
  ActionMetadata, 
  SimulationResult,
  TokenBalance,
  BalanceChange,
  ValidationError
} from './types'
import { FlowEmulatorService } from './flow-emulator-service'

export interface GasEstimate {
  totalGas: number
  gasPerAction: Record<string, number>
  gasBreakdown: GasBreakdownItem[]
  confidence: number
  estimationMethod: 'historical' | 'simulation' | 'static'
  warnings: string[]
}

export interface GasBreakdownItem {
  actionId: string
  actionName: string
  estimatedGas: number
  confidence: number
  factors: GasFactor[]
}

export interface GasFactor {
  type: 'complexity' | 'storage' | 'computation' | 'network'
  impact: number
  description: string
}

export interface BalanceRequirement {
  token: string
  minimumRequired: string
  currentBalance: string
  deficit: string
  isInsufficient: boolean
  address: string
}

export interface CostOptimization {
  type: 'reorder' | 'batch' | 'parallel' | 'alternative'
  description: string
  estimatedSavings: number
  confidence: number
  actionIds: string[]
}

export interface GasEstimationOptions {
  useHistoricalData: boolean
  runSimulation: boolean
  includeOptimizations: boolean
  gasPrice?: number
  networkConditions?: 'low' | 'medium' | 'high'
}

export interface BalanceCheckOptions {
  includeGasCosts: boolean
  bufferPercentage: number
  checkAllTokens: boolean
  userAddress?: string
}

export interface ComprehensiveGasAnalysis {
  gasEstimate: GasEstimate
  balanceRequirements: BalanceRequirement[]
  optimizations: CostOptimization[]
  totalCostUSD?: number
  feasibilityScore: number
  recommendations: string[]
}

export class GasEstimationService {
  private emulatorService: FlowEmulatorService
  private historicalGasData: Map<string, number[]> = new Map()
  private gasMultipliers: Record<string, number> = {
    'low': 1.0,
    'medium': 1.2,
    'high': 1.5
  }

  constructor(emulatorService: FlowEmulatorService) {
    this.emulatorService = emulatorService
    this.initializeHistoricalData()
  }

  /**
   * Main method for comprehensive gas estimation and balance checking
   */
  async analyzeWorkflowCosts(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[],
    options: GasEstimationOptions & BalanceCheckOptions = {
      useHistoricalData: true,
      runSimulation: true,
      includeOptimizations: true,
      includeGasCosts: true,
      bufferPercentage: 10,
      checkAllTokens: true
    }
  ): Promise<ComprehensiveGasAnalysis> {
    // Step 1: Estimate gas costs
    const gasEstimate = await this.estimateWorkflowGas(workflow, actionMetadata, options)

    // Step 2: Calculate balance requirements
    const balanceRequirements = await this.calculateBalanceRequirements(
      workflow, 
      actionMetadata, 
      gasEstimate,
      options
    )

    // Step 3: Generate cost optimizations
    const optimizations = options.includeOptimizations 
      ? await this.generateCostOptimizations(workflow, actionMetadata, gasEstimate)
      : []

    // Step 4: Calculate feasibility score
    const feasibilityScore = this.calculateFeasibilityScore(gasEstimate, balanceRequirements)

    // Step 5: Generate recommendations
    const recommendations = this.generateRecommendations(
      gasEstimate, 
      balanceRequirements, 
      optimizations,
      feasibilityScore
    )

    // Step 6: Calculate total cost in USD (if gas price provided)
    const totalCostUSD = options.gasPrice 
      ? gasEstimate.totalGas * options.gasPrice 
      : undefined

    return {
      gasEstimate,
      balanceRequirements,
      optimizations,
      totalCostUSD,
      feasibilityScore,
      recommendations
    }
  }

  /**
   * Estimate gas costs for the entire workflow
   */
  async estimateWorkflowGas(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[],
    options: GasEstimationOptions
  ): Promise<GasEstimate> {
    const gasBreakdown: GasBreakdownItem[] = []
    const gasPerAction: Record<string, number> = {}
    let totalGas = 0
    let totalConfidence = 0
    const warnings: string[] = []

    // Estimate gas for each action
    for (const action of workflow.actions) {
      const metadata = actionMetadata.find(m => m.id === action.actionType)
      if (!metadata) {
        warnings.push(`No metadata found for action ${action.id}`)
        continue
      }

      const actionGasEstimate = await this.estimateActionGas(
        action,
        metadata,
        options
      )

      gasBreakdown.push(actionGasEstimate)
      gasPerAction[action.id] = actionGasEstimate.estimatedGas
      totalGas += actionGasEstimate.estimatedGas
      totalConfidence += actionGasEstimate.confidence
    }

    // Apply network condition multiplier
    const networkMultiplier = this.gasMultipliers[options.networkConditions || 'medium']
    totalGas = Math.ceil(totalGas * networkMultiplier)

    // Calculate average confidence
    const averageConfidence = workflow.actions.length > 0 
      ? totalConfidence / workflow.actions.length 
      : 0

    // Determine estimation method
    let estimationMethod: 'historical' | 'simulation' | 'static' = 'static'
    if (options.runSimulation) {
      estimationMethod = 'simulation'
    } else if (options.useHistoricalData) {
      estimationMethod = 'historical'
    }

    // Add workflow-level warnings
    if (totalGas > 1000000) {
      warnings.push('High gas usage detected. Consider breaking workflow into smaller parts.')
    }

    if (averageConfidence < 0.7) {
      warnings.push('Low confidence in gas estimates. Consider running simulation for better accuracy.')
    }

    return {
      totalGas,
      gasPerAction,
      gasBreakdown,
      confidence: averageConfidence,
      estimationMethod,
      warnings
    }
  }

  /**
   * Estimate gas for a single action
   */
  private async estimateActionGas(
    action: any,
    metadata: ActionMetadata,
    options: GasEstimationOptions
  ): Promise<GasBreakdownItem> {
    let estimatedGas = metadata.gasEstimate || 1000
    let confidence = 0.5
    const factors: GasFactor[] = []

    // Use historical data if available and requested
    if (options.useHistoricalData && this.historicalGasData.has(metadata.id)) {
      const historicalData = this.historicalGasData.get(metadata.id)!
      const avgHistorical = historicalData.reduce((a, b) => a + b, 0) / historicalData.length
      estimatedGas = Math.ceil(avgHistorical)
      confidence = 0.8
      
      factors.push({
        type: 'historical',
        impact: avgHistorical - metadata.gasEstimate,
        description: `Based on ${historicalData.length} historical executions`
      } as any)
    }

    // Run simulation if requested
    if (options.runSimulation) {
      try {
        const simulationResult = await this.simulateActionGas(action, metadata)
        if (simulationResult.success) {
          estimatedGas = simulationResult.gasUsed
          confidence = 0.9
          
          factors.push({
            type: 'simulation',
            impact: simulationResult.gasUsed - metadata.gasEstimate,
            description: 'Based on emulator simulation'
          } as any)
        }
      } catch (error) {
        factors.push({
          type: 'simulation',
          impact: 0,
          description: `Simulation failed: ${error}`
        } as any)
      }
    }

    // Apply complexity factors
    const complexityFactor = this.calculateComplexityFactor(action, metadata)
    estimatedGas = Math.ceil(estimatedGas * complexityFactor.multiplier)
    factors.push(...complexityFactor.factors)

    // Apply storage factors
    const storageFactor = this.calculateStorageFactor(action, metadata)
    estimatedGas = Math.ceil(estimatedGas * storageFactor.multiplier)
    factors.push(...storageFactor.factors)

    return {
      actionId: action.id,
      actionName: metadata.name,
      estimatedGas,
      confidence,
      factors
    }
  }

  /**
   * Calculate balance requirements for the workflow
   */
  async calculateBalanceRequirements(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[],
    gasEstimate: GasEstimate,
    options: BalanceCheckOptions
  ): Promise<BalanceRequirement[]> {
    const requirements: BalanceRequirement[] = []
    const tokenRequirements = new Map<string, number>()

    // Calculate token requirements from actions
    for (const action of workflow.actions) {
      const metadata = actionMetadata.find(m => m.id === action.actionType)
      if (!metadata) continue

      const actionRequirements = this.calculateActionTokenRequirements(action, metadata)
      
      for (const [token, amount] of actionRequirements) {
        const current = tokenRequirements.get(token) || 0
        tokenRequirements.set(token, current + amount)
      }
    }

    // Add gas costs if requested
    if (options.includeGasCosts) {
      const flowRequired = tokenRequirements.get('FLOW') || 0
      const gasInFlow = this.convertGasToFlow(gasEstimate.totalGas)
      tokenRequirements.set('FLOW', flowRequired + gasInFlow)
    }

    // Apply buffer percentage
    const bufferMultiplier = 1 + (options.bufferPercentage / 100)

    // Create balance requirements
    for (const [token, requiredAmount] of tokenRequirements) {
      const bufferedAmount = requiredAmount * bufferMultiplier
      const currentBalance = await this.getCurrentBalance(token, options.userAddress)
      const deficit = Math.max(0, bufferedAmount - currentBalance)

      requirements.push({
        token,
        minimumRequired: bufferedAmount.toString(),
        currentBalance: currentBalance.toString(),
        deficit: deficit.toString(),
        isInsufficient: deficit > 0,
        address: options.userAddress || 'unknown'
      })
    }

    return requirements
  }

  /**
   * Generate cost optimization suggestions
   */
  async generateCostOptimizations(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[],
    gasEstimate: GasEstimate
  ): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = []

    // Check for reordering opportunities
    const reorderOptimization = this.analyzeReorderingOpportunities(workflow, gasEstimate)
    if (reorderOptimization) {
      optimizations.push(reorderOptimization)
    }

    // Check for batching opportunities
    const batchOptimizations = this.analyzeBatchingOpportunities(workflow, actionMetadata)
    optimizations.push(...batchOptimizations)

    // Check for parallel execution opportunities
    const parallelOptimizations = this.analyzeParallelExecutionOpportunities(workflow, gasEstimate)
    optimizations.push(...parallelOptimizations)

    // Check for alternative action suggestions
    const alternativeOptimizations = await this.analyzeAlternativeActions(workflow, actionMetadata)
    optimizations.push(...alternativeOptimizations)

    return optimizations.sort((a, b) => b.estimatedSavings - a.estimatedSavings)
  }

  /**
   * Calculate complexity factor for gas estimation
   */
  private calculateComplexityFactor(action: any, metadata: ActionMetadata): {
    multiplier: number
    factors: GasFactor[]
  } {
    let multiplier = 1.0
    const factors: GasFactor[] = []

    // Parameter complexity
    const paramCount = action.parameters.length
    if (paramCount > 5) {
      const paramMultiplier = 1 + (paramCount - 5) * 0.1
      multiplier *= paramMultiplier
      factors.push({
        type: 'complexity',
        impact: (paramMultiplier - 1) * metadata.gasEstimate,
        description: `High parameter count (${paramCount})`
      })
    }

    // Security level impact
    switch (metadata.securityLevel) {
      case 'critical':
        multiplier *= 1.3
        factors.push({
          type: 'complexity',
          impact: 0.3 * metadata.gasEstimate,
          description: 'Critical security level requires additional checks'
        })
        break
      case 'high':
        multiplier *= 1.2
        factors.push({
          type: 'complexity',
          impact: 0.2 * metadata.gasEstimate,
          description: 'High security level requires additional validation'
        })
        break
    }

    // Dependency complexity
    if (metadata.dependencies && metadata.dependencies.length > 3) {
      multiplier *= 1.15
      factors.push({
        type: 'complexity',
        impact: 0.15 * metadata.gasEstimate,
        description: `Multiple dependencies (${metadata.dependencies.length})`
      })
    }

    return { multiplier, factors }
  }

  /**
   * Calculate storage factor for gas estimation
   */
  private calculateStorageFactor(action: any, metadata: ActionMetadata): {
    multiplier: number
    factors: GasFactor[]
  } {
    let multiplier = 1.0
    const factors: GasFactor[] = []

    // Check for storage-heavy operations
    if (metadata.category === 'NFT' || metadata.name.includes('Store') || metadata.name.includes('Save')) {
      multiplier *= 1.25
      factors.push({
        type: 'storage',
        impact: 0.25 * metadata.gasEstimate,
        description: 'Storage-intensive operation'
      })
    }

    // Check for large data parameters
    for (const param of action.parameters) {
      if (param.type === 'string' && param.value && param.value.length > 1000) {
        multiplier *= 1.1
        factors.push({
          type: 'storage',
          impact: 0.1 * metadata.gasEstimate,
          description: `Large string parameter (${param.value.length} chars)`
        })
      }
    }

    return { multiplier, factors }
  }

  /**
   * Simulate action gas usage
   */
  private async simulateActionGas(action: any, metadata: ActionMetadata): Promise<SimulationResult> {
    // Create a minimal workflow for single action simulation
    const singleActionWorkflow: ParsedWorkflow = {
      actions: [action],
      executionOrder: [action.id],
      rootActions: [action.id],
      metadata: {
        totalActions: 1,
        totalConnections: 0,
        createdAt: new Date().toISOString()
      }
    }

    return await this.emulatorService.simulateWorkflow(
      singleActionWorkflow,
      [metadata],
      { dryRun: true, gasLimit: metadata.gasEstimate * 3 }
    )
  }

  /**
   * Calculate token requirements for a single action
   */
  private calculateActionTokenRequirements(action: any, metadata: ActionMetadata): Map<string, number> {
    const requirements = new Map<string, number>()

    // Analyze parameters for token amounts
    for (const param of action.parameters) {
      if (param.name.includes('amount') || param.name.includes('value')) {
        const tokenParam = action.parameters.find((p: any) => 
          p.name.includes('token') || p.name.includes('asset')
        )
        const token = tokenParam?.value || 'FLOW'
        const amount = parseFloat(param.value) || 0
        
        if (amount > 0) {
          const current = requirements.get(token) || 0
          requirements.set(token, current + amount)
        }
      }
    }

    // Add default FLOW requirement for gas if no specific tokens found
    if (requirements.size === 0) {
      requirements.set('FLOW', 0)
    }

    return requirements
  }

  /**
   * Convert gas units to FLOW tokens
   */
  private convertGasToFlow(gasUnits: number): number {
    // Approximate conversion: 1 FLOW = 100,000,000 gas units
    return gasUnits / 100000000
  }

  /**
   * Get current balance for a token (mock implementation)
   */
  private async getCurrentBalance(token: string, address?: string): Promise<number> {
    // In a real implementation, this would query the blockchain
    // For now, return mock balances
    const mockBalances: Record<string, number> = {
      'FLOW': 1000,
      'USDC': 500,
      'FUSD': 200
    }

    return mockBalances[token] || 0
  }

  /**
   * Analyze reordering opportunities
   */
  private analyzeReorderingOpportunities(
    workflow: ParsedWorkflow,
    gasEstimate: GasEstimate
  ): CostOptimization | null {
    // Simple heuristic: move cheaper actions first
    const actionCosts = workflow.actions.map(action => ({
      id: action.id,
      cost: gasEstimate.gasPerAction[action.id] || 0
    })).sort((a, b) => a.cost - b.cost)

    const currentOrder = workflow.executionOrder
    const optimizedOrder = actionCosts.map(a => a.id)

    // Check if reordering would save gas (simplified calculation)
    if (JSON.stringify(currentOrder) !== JSON.stringify(optimizedOrder)) {
      const estimatedSavings = gasEstimate.totalGas * 0.05 // 5% savings estimate
      
      return {
        type: 'reorder',
        description: 'Reorder actions to execute cheaper operations first',
        estimatedSavings,
        confidence: 0.6,
        actionIds: optimizedOrder
      }
    }

    return null
  }

  /**
   * Analyze batching opportunities
   */
  private analyzeBatchingOpportunities(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[]
  ): CostOptimization[] {
    const optimizations: CostOptimization[] = []
    const actionsByType = new Map<string, any[]>()

    // Group actions by type
    for (const action of workflow.actions) {
      const metadata = actionMetadata.find(m => m.id === action.actionType)
      if (metadata) {
        const category = metadata.category
        if (!actionsByType.has(category)) {
          actionsByType.set(category, [])
        }
        actionsByType.get(category)!.push(action)
      }
    }

    // Look for batchable action groups
    for (const [category, actions] of actionsByType) {
      if (actions.length > 1 && this.isBatchable(category)) {
        const totalGas = actions.reduce((sum, action) => {
          const metadata = actionMetadata.find(m => m.id === action.actionType)
          return sum + (metadata?.gasEstimate || 1000)
        }, 0)

        const estimatedSavings = totalGas * 0.3 // 30% savings from batching

        optimizations.push({
          type: 'batch',
          description: `Batch ${actions.length} ${category} actions together`,
          estimatedSavings,
          confidence: 0.8,
          actionIds: actions.map(a => a.id)
        })
      }
    }

    return optimizations
  }

  /**
   * Analyze parallel execution opportunities
   */
  private analyzeParallelExecutionOpportunities(
    workflow: ParsedWorkflow,
    gasEstimate: GasEstimate
  ): CostOptimization[] {
    const optimizations: CostOptimization[] = []
    
    // Find independent actions that can run in parallel
    const independentGroups = this.findIndependentActionGroups(workflow)
    
    for (const group of independentGroups) {
      if (group.length > 1) {
        const groupGas = group.reduce((sum, actionId) => 
          sum + (gasEstimate.gasPerAction[actionId] || 0), 0
        )
        
        // Parallel execution can save time but not necessarily gas
        // However, it can reduce overall transaction costs
        const estimatedSavings = groupGas * 0.1 // 10% savings from parallel execution
        
        optimizations.push({
          type: 'parallel',
          description: `Execute ${group.length} independent actions in parallel`,
          estimatedSavings,
          confidence: 0.7,
          actionIds: group
        })
      }
    }

    return optimizations
  }

  /**
   * Analyze alternative action suggestions
   */
  private async analyzeAlternativeActions(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[]
  ): Promise<CostOptimization[]> {
    const optimizations: CostOptimization[] = []

    for (const action of workflow.actions) {
      const metadata = actionMetadata.find(m => m.id === action.actionType)
      if (!metadata) continue

      // Find cheaper alternatives in the same category
      const alternatives = actionMetadata.filter(m => 
        m.category === metadata.category && 
        m.id !== metadata.id &&
        m.gasEstimate < metadata.gasEstimate
      )

      if (alternatives.length > 0) {
        const bestAlternative = alternatives.reduce((best, current) => 
          current.gasEstimate < best.gasEstimate ? current : best
        )

        const savings = metadata.gasEstimate - bestAlternative.gasEstimate

        if (savings > 0) {
          optimizations.push({
            type: 'alternative',
            description: `Replace ${metadata.name} with ${bestAlternative.name}`,
            estimatedSavings: savings,
            confidence: 0.5,
            actionIds: [action.id]
          })
        }
      }
    }

    return optimizations
  }

  /**
   * Calculate feasibility score based on gas and balance analysis
   */
  private calculateFeasibilityScore(
    gasEstimate: GasEstimate,
    balanceRequirements: BalanceRequirement[]
  ): number {
    let score = 100

    // Deduct points for high gas usage
    if (gasEstimate.totalGas > 1000000) {
      score -= 30
    } else if (gasEstimate.totalGas > 500000) {
      score -= 15
    }

    // Deduct points for low confidence
    if (gasEstimate.confidence < 0.5) {
      score -= 20
    } else if (gasEstimate.confidence < 0.7) {
      score -= 10
    }

    // Deduct points for insufficient balances
    const insufficientBalances = balanceRequirements.filter(req => req.isInsufficient)
    score -= insufficientBalances.length * 25

    // Deduct points for warnings
    score -= gasEstimate.warnings.length * 5

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    gasEstimate: GasEstimate,
    balanceRequirements: BalanceRequirement[],
    optimizations: CostOptimization[],
    feasibilityScore: number
  ): string[] {
    const recommendations: string[] = []

    // Gas-related recommendations
    if (gasEstimate.totalGas > 1000000) {
      recommendations.push('Consider breaking this workflow into smaller parts to reduce gas costs')
    }

    if (gasEstimate.confidence < 0.7) {
      recommendations.push('Run a simulation to get more accurate gas estimates')
    }

    // Balance-related recommendations
    const insufficientBalances = balanceRequirements.filter(req => req.isInsufficient)
    if (insufficientBalances.length > 0) {
      for (const balance of insufficientBalances) {
        recommendations.push(`Acquire ${balance.deficit} ${balance.token} before executing workflow`)
      }
    }

    // Optimization recommendations
    if (optimizations.length > 0) {
      const topOptimization = optimizations[0]
      recommendations.push(`Apply ${topOptimization.type} optimization to save ~${topOptimization.estimatedSavings} gas`)
    }

    // Feasibility recommendations
    if (feasibilityScore < 50) {
      recommendations.push('This workflow has low feasibility. Consider significant modifications before execution')
    } else if (feasibilityScore < 75) {
      recommendations.push('This workflow has moderate feasibility. Review recommendations before execution')
    }

    return recommendations
  }

  /**
   * Check if actions of a category can be batched
   */
  private isBatchable(category: string): boolean {
    const batchableCategories = ['DeFi', 'Token', 'Transfer']
    return batchableCategories.includes(category)
  }

  /**
   * Find groups of independent actions that can run in parallel
   */
  private findIndependentActionGroups(workflow: ParsedWorkflow): string[][] {
    const groups: string[][] = []
    const processed = new Set<string>()

    for (const action of workflow.actions) {
      if (processed.has(action.id)) continue

      const independentActions = [action.id]
      processed.add(action.id)

      // Find other actions that don't depend on this one and vice versa
      for (const otherAction of workflow.actions) {
        if (processed.has(otherAction.id)) continue

        const hasDirectDependency = action.nextActions.includes(otherAction.id) ||
                                   otherAction.nextActions.includes(action.id)

        if (!hasDirectDependency) {
          independentActions.push(otherAction.id)
          processed.add(otherAction.id)
        }
      }

      if (independentActions.length > 1) {
        groups.push(independentActions)
      }
    }

    return groups
  }

  /**
   * Initialize historical gas data (mock data for demonstration)
   */
  private initializeHistoricalData(): void {
    // Mock historical data - in production, this would come from a database
    this.historicalGasData.set('swap-action', [1200, 1150, 1300, 1250, 1180])
    this.historicalGasData.set('stake-action', [2000, 1950, 2100, 2050, 1980])
    this.historicalGasData.set('mint-nft', [3000, 2900, 3200, 3100, 2950])
    this.historicalGasData.set('transfer-token', [800, 750, 850, 820, 780])
  }
}

export const gasEstimationService = new GasEstimationService(new FlowEmulatorService())