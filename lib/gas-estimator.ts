/**
 * Gas Estimator for Flow Transaction Cost Prediction
 * 
 * This module provides accurate gas estimation and fee management for Flow transactions:
 * - Real-time gas price fetching
 * - Transaction cost prediction
 * - Insufficient balance detection
 * - Gas limit optimization
 */

import * as fcl from "@onflow/fcl"
import type { 
  ParsedWorkflow, 
  ParsedAction, 
  EnhancedWorkflow,
  FlowAccount,
  FlowNetworkConfig
} from "./types"
import { Transaction } from "./transaction-manager"
import { logger } from "./logging-service"

export interface GasEstimate {
  computationLimit: number
  storageLimit: number
  estimatedCost: string
  confidence: number
  breakdown: GasBreakdown
  warnings: string[]
}

export interface GasBreakdown {
  baseTransactionCost: number
  actionCosts: ActionGasCost[]
  storageCost: number
  networkFee: number
  totalCost: number
}

export interface ActionGasCost {
  actionId: string
  actionName: string
  actionType: string
  estimatedGas: number
  confidence: number
  factors: string[]
}

export interface GasPriceInfo {
  currentPrice: string
  averagePrice: string
  fastPrice: string
  timestamp: Date
  network: string
}

export interface BalanceCheck {
  hasInsufficientBalance: boolean
  requiredAmount: string
  currentBalance: string
  shortfall: string
  token: string
}

/**
 * Gas Estimator for accurate Flow transaction cost prediction
 */
export class FlowGasEstimator {
  private networkConfig: FlowNetworkConfig
  private gasPriceCache: Map<string, { price: GasPriceInfo, timestamp: number }> = new Map()
  private estimateCache: Map<string, { estimate: GasEstimate, timestamp: number }> = new Map()
  private readonly CACHE_TTL = 30000 // 30 seconds
  private readonly BASE_TRANSACTION_COST = 100 // Base cost for any transaction

  constructor(networkConfig: FlowNetworkConfig) {
    this.networkConfig = networkConfig
  }

  /**
   * Estimate gas for a complete workflow
   */
  async estimateWorkflowGas(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    account?: FlowAccount
  ): Promise<GasEstimate> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()

    logger.info('Estimating workflow gas', {
      correlationId,
      component: 'gas-estimator',
      operation: 'estimate-workflow-gas',
      metadata: {
        workflowId: workflow.metadata?.name || 'unknown',
        actionCount: workflow.actions.length,
        network: this.networkConfig.name
      }
    })

    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(workflow)
      const cached = this.estimateCache.get(cacheKey)
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        logger.debug('Returning cached gas estimate', {
          correlationId,
          cacheKey,
          estimatedCost: cached.estimate.estimatedCost
        })
        return cached.estimate
      }

      // Get current gas prices
      const gasPrices = await this.getCurrentGasPrices()
      
      // Estimate gas for each action
      const actionCosts: ActionGasCost[] = []
      let totalComputationLimit = this.BASE_TRANSACTION_COST
      let totalStorageLimit = 0

      for (const action of workflow.actions) {
        const actionCost = await this.estimateActionGas(action)
        actionCosts.push(actionCost)
        totalComputationLimit += actionCost.estimatedGas
        
        // Estimate storage impact
        const storageImpact = this.estimateStorageImpact(action)
        totalStorageLimit += storageImpact
      }

      // Calculate network fees
      const networkFee = this.calculateNetworkFee(totalComputationLimit, gasPrices)
      
      // Build breakdown
      const breakdown: GasBreakdown = {
        baseTransactionCost: this.BASE_TRANSACTION_COST,
        actionCosts,
        storageCost: totalStorageLimit,
        networkFee,
        totalCost: totalComputationLimit + networkFee
      }

      // Calculate total cost in FLOW
      const totalCostInFlow = this.convertGasToFlow(breakdown.totalCost, gasPrices)
      
      // Determine confidence level
      const confidence = this.calculateConfidence(actionCosts)
      
      // Generate warnings
      const warnings = this.generateWarnings(breakdown, workflow, account)

      const estimate: GasEstimate = {
        computationLimit: totalComputationLimit,
        storageLimit: totalStorageLimit,
        estimatedCost: totalCostInFlow,
        confidence,
        breakdown,
        warnings
      }

      // Cache the estimate
      this.estimateCache.set(cacheKey, { estimate, timestamp: Date.now() })

      logger.info('Gas estimation completed', {
        correlationId,
        component: 'gas-estimator',
        operation: 'estimate-workflow-gas',
        metadata: {
          computationLimit: estimate.computationLimit,
          estimatedCost: estimate.estimatedCost,
          confidence: estimate.confidence,
          warningCount: estimate.warnings.length,
          estimationTime: Date.now() - startTime
        }
      })

      return estimate

    } catch (error) {
      logger.error('Gas estimation failed', error as Error, {
        correlationId,
        component: 'gas-estimator',
        operation: 'estimate-workflow-gas'
      })

      // Return fallback estimate
      return this.getFallbackEstimate(workflow)
    }
  }  
/**
   * Estimate gas for a single transaction
   */
  async estimateTransactionGas(transaction: Transaction): Promise<GasEstimate> {
    const correlationId = logger.generateCorrelationId()

    logger.info('Estimating transaction gas', {
      correlationId,
      component: 'gas-estimator',
      operation: 'estimate-transaction-gas',
      metadata: {
        transactionId: transaction.id,
        gasLimit: transaction.gasLimit,
        argumentCount: transaction.arguments.length
      }
    })

    try {
      // Analyze Cadence code complexity
      const codeComplexity = this.analyzeCadenceComplexity(transaction.cadenceCode)
      
      // Base estimate from code analysis
      let computationLimit = this.BASE_TRANSACTION_COST + codeComplexity.computationCost
      let storageLimit = codeComplexity.storageCost

      // Add argument processing cost
      computationLimit += transaction.arguments.length * 10

      // Get current gas prices
      const gasPrices = await this.getCurrentGasPrices()
      const networkFee = this.calculateNetworkFee(computationLimit, gasPrices)
      
      const breakdown: GasBreakdown = {
        baseTransactionCost: this.BASE_TRANSACTION_COST,
        actionCosts: [{
          actionId: transaction.id,
          actionName: 'Transaction',
          actionType: 'custom',
          estimatedGas: codeComplexity.computationCost,
          confidence: 0.7,
          factors: codeComplexity.factors
        }],
        storageCost: storageLimit,
        networkFee,
        totalCost: computationLimit + networkFee
      }

      const totalCostInFlow = this.convertGasToFlow(breakdown.totalCost, gasPrices)

      return {
        computationLimit,
        storageLimit,
        estimatedCost: totalCostInFlow,
        confidence: 0.7,
        breakdown,
        warnings: []
      }

    } catch (error) {
      logger.error('Transaction gas estimation failed', error as Error, {
        correlationId,
        component: 'gas-estimator',
        operation: 'estimate-transaction-gas',
        metadata: { transactionId: transaction.id }
      })

      // Return conservative estimate
      return {
        computationLimit: 1000,
        storageLimit: 100,
        estimatedCost: '0.001',
        confidence: 0.3,
        breakdown: {
          baseTransactionCost: this.BASE_TRANSACTION_COST,
          actionCosts: [],
          storageCost: 100,
          networkFee: 50,
          totalCost: 1000
        },
        warnings: ['Gas estimation failed, using conservative estimate']
      }
    }
  }

  /**
   * Check if account has sufficient balance for transaction
   */
  async checkBalance(
    account: FlowAccount,
    gasEstimate: GasEstimate,
    token: string = 'FLOW'
  ): Promise<BalanceCheck> {
    const correlationId = logger.generateCorrelationId()

    logger.info('Checking account balance', {
      correlationId,
      component: 'gas-estimator',
      operation: 'check-balance',
      metadata: {
        accountAddress: account.address,
        requiredAmount: gasEstimate.estimatedCost,
        token
      }
    })

    try {
      // Get current account balance
      const currentBalance = await this.getAccountBalance(account.address, token)
      const requiredAmount = parseFloat(gasEstimate.estimatedCost)
      const currentBalanceFloat = parseFloat(currentBalance)

      const hasInsufficientBalance = currentBalanceFloat < requiredAmount
      const shortfall = hasInsufficientBalance 
        ? (requiredAmount - currentBalanceFloat).toFixed(8)
        : '0.00000000'

      return {
        hasInsufficientBalance,
        requiredAmount: gasEstimate.estimatedCost,
        currentBalance,
        shortfall,
        token
      }

    } catch (error) {
      logger.error('Balance check failed', error as Error, {
        correlationId,
        component: 'gas-estimator',
        operation: 'check-balance',
        metadata: { accountAddress: account.address, token }
      })

      // Return conservative result
      return {
        hasInsufficientBalance: true,
        requiredAmount: gasEstimate.estimatedCost,
        currentBalance: '0.00000000',
        shortfall: gasEstimate.estimatedCost,
        token
      }
    }
  }

  /**
   * Get current gas prices from Flow network
   */
  async getCurrentGasPrices(): Promise<GasPriceInfo> {
    const cacheKey = `gas_prices_${this.networkConfig.name}`
    const cached = this.gasPriceCache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price
    }

    try {
      // Query Flow network for current gas prices
      // This is a simplified implementation - in production, you'd query actual network data
      const basePrice = this.networkConfig.name === 'mainnet' ? '0.00000100' : '0.00000010'
      
      const gasPriceInfo: GasPriceInfo = {
        currentPrice: basePrice,
        averagePrice: basePrice,
        fastPrice: (parseFloat(basePrice) * 1.5).toFixed(8),
        timestamp: new Date(),
        network: this.networkConfig.name
      }

      this.gasPriceCache.set(cacheKey, { price: gasPriceInfo, timestamp: Date.now() })
      return gasPriceInfo

    } catch (error) {
      logger.warn('Failed to get current gas prices, using defaults', {
        component: 'gas-estimator',
        operation: 'get-current-gas-prices',
        metadata: { 
          network: this.networkConfig.name,
          error: (error as Error).message 
        }
      })

      // Return default prices
      return {
        currentPrice: '0.00000100',
        averagePrice: '0.00000100',
        fastPrice: '0.00000150',
        timestamp: new Date(),
        network: this.networkConfig.name
      }
    }
  }

  /**
   * Optimize gas limit for transaction
   */
  optimizeGasLimit(estimate: GasEstimate, safetyMargin: number = 0.2): number {
    const baseLimit = estimate.computationLimit
    const optimizedLimit = Math.ceil(baseLimit * (1 + safetyMargin))
    
    // Ensure minimum gas limit
    const minGasLimit = 100
    return Math.max(optimizedLimit, minGasLimit)
  }

  // Private helper methods
  private async estimateActionGas(action: ParsedAction): Promise<ActionGasCost> {
    // Static gas estimates for different action types
    const gasEstimates: Record<string, { gas: number, confidence: number, factors: string[] }> = {
      'transfer-flow': { 
        gas: 100, 
        confidence: 0.9, 
        factors: ['Simple token transfer', 'Well-tested pattern'] 
      },
      'transfer-tokens': { 
        gas: 150, 
        confidence: 0.8, 
        factors: ['Token contract interaction', 'Vault operations'] 
      },
      'swap-tokens': { 
        gas: 300, 
        confidence: 0.7, 
        factors: ['DEX interaction', 'Price calculations', 'Slippage handling'] 
      },
      'add-liquidity': { 
        gas: 400, 
        confidence: 0.7, 
        factors: ['Liquidity pool operations', 'Token pair handling'] 
      },
      'stake-tokens': { 
        gas: 200, 
        confidence: 0.8, 
        factors: ['Staking contract interaction', 'Reward calculations'] 
      },
      'mint-nft': { 
        gas: 250, 
        confidence: 0.8, 
        factors: ['NFT minting', 'Metadata storage'] 
      },
      'transfer-nft': { 
        gas: 150, 
        confidence: 0.9, 
        factors: ['NFT transfer', 'Collection operations'] 
      },
      'list-nft': { 
        gas: 200, 
        confidence: 0.7, 
        factors: ['Marketplace interaction', 'Listing creation'] 
      },
      'create-proposal': { 
        gas: 300, 
        confidence: 0.6, 
        factors: ['Governance operations', 'Proposal storage'] 
      },
      'vote': { 
        gas: 100, 
        confidence: 0.8, 
        factors: ['Simple voting operation'] 
      }
    }

    const estimate = gasEstimates[action.actionType] || { 
      gas: 200, 
      confidence: 0.5, 
      factors: ['Unknown action type', 'Conservative estimate'] 
    }

    // Adjust estimate based on parameter complexity
    let adjustedGas = estimate.gas
    const complexParameters = action.parameters.filter(p => 
      p.type === 'Array' || p.type === 'Dictionary' || p.value?.length > 100
    )
    adjustedGas += complexParameters.length * 50

    return {
      actionId: action.id,
      actionName: action.name,
      actionType: action.actionType,
      estimatedGas: adjustedGas,
      confidence: estimate.confidence,
      factors: estimate.factors
    }
  }

  private estimateStorageImpact(action: ParsedAction): number {
    // Estimate storage impact based on action type
    const storageImpacts: Record<string, number> = {
      'mint-nft': 100,
      'create-proposal': 200,
      'add-liquidity': 50,
      'stake-tokens': 30
    }

    return storageImpacts[action.actionType] || 0
  }

  private calculateNetworkFee(computationLimit: number, gasPrices: GasPriceInfo): number {
    const gasPrice = parseFloat(gasPrices.currentPrice)
    return Math.ceil(computationLimit * gasPrice * 1000000) // Convert to micro-units
  }

  private convertGasToFlow(gasAmount: number, gasPrices: GasPriceInfo): string {
    const gasPrice = parseFloat(gasPrices.currentPrice)
    const flowAmount = gasAmount * gasPrice
    return flowAmount.toFixed(8)
  }

  private calculateConfidence(actionCosts: ActionGasCost[]): number {
    if (actionCosts.length === 0) return 0.5
    
    const totalConfidence = actionCosts.reduce((sum, cost) => sum + cost.confidence, 0)
    return totalConfidence / actionCosts.length
  }

  private generateWarnings(
    breakdown: GasBreakdown, 
    workflow: ParsedWorkflow | EnhancedWorkflow,
    account?: FlowAccount
  ): string[] {
    const warnings: string[] = []

    // High gas usage warning
    if (breakdown.totalCost > 1000) {
      warnings.push('High gas usage detected. Consider optimizing workflow.')
    }

    // Complex workflow warning
    if (workflow.actions.length > 10) {
      warnings.push('Complex workflow with many actions may have higher gas variance.')
    }

    // Low confidence warning
    const avgConfidence = breakdown.actionCosts.reduce((sum, cost) => sum + cost.confidence, 0) / breakdown.actionCosts.length
    if (avgConfidence < 0.7) {
      warnings.push('Gas estimate has low confidence. Actual costs may vary significantly.')
    }

    return warnings
  }

  private analyzeCadenceComplexity(cadenceCode: string): { computationCost: number, storageCost: number, factors: string[] } {
    const factors: string[] = []
    let computationCost = 0
    let storageCost = 0

    // Analyze code patterns
    const lines = cadenceCode.split('\n')
    
    // Count loops and complex operations
    const loopCount = (cadenceCode.match(/for\s+|while\s+/g) || []).length
    computationCost += loopCount * 100
    if (loopCount > 0) factors.push(`${loopCount} loop(s) detected`)

    // Count function calls
    const functionCalls = (cadenceCode.match(/\w+\(/g) || []).length
    computationCost += functionCalls * 10
    if (functionCalls > 5) factors.push(`${functionCalls} function calls`)

    // Count storage operations
    const storageOps = (cadenceCode.match(/\.save\(|\.load\(|\.borrow\(/g) || []).length
    storageCost += storageOps * 20
    computationCost += storageOps * 50
    if (storageOps > 0) factors.push(`${storageOps} storage operations`)

    // Count contract interactions
    const contractCalls = (cadenceCode.match(/import\s+\w+/g) || []).length
    computationCost += contractCalls * 30
    if (contractCalls > 3) factors.push(`${contractCalls} contract imports`)

    // Base complexity from code length
    const baseComplexity = Math.min(lines.length * 2, 200)
    computationCost += baseComplexity

    return { computationCost, storageCost, factors }
  }

  private async getAccountBalance(address: string, token: string): Promise<string> {
    try {
      if (token === 'FLOW') {
        const account = await fcl.account(address)
        return (parseFloat(account.balance) / 100000000).toFixed(8) // Convert from micro-FLOW
      } else {
        // For other tokens, would need to query specific token contracts
        // This is a simplified implementation
        return '0.00000000'
      }
    } catch (error) {
      logger.warn('Failed to get account balance', {
        component: 'gas-estimator',
        operation: 'get-account-balance',
        metadata: { address, token, error: (error as Error).message }
      })
      return '0.00000000'
    }
  }

  private generateCacheKey(workflow: ParsedWorkflow | EnhancedWorkflow): string {
    const actionTypes = workflow.actions.map(a => a.actionType).sort().join(',')
    const paramCount = workflow.actions.reduce((sum, a) => sum + a.parameters.length, 0)
    return `workflow_${actionTypes}_${paramCount}_${this.networkConfig.name}`
  }

  private getFallbackEstimate(workflow: ParsedWorkflow | EnhancedWorkflow): GasEstimate {
    const actionCount = workflow.actions.length
    const computationLimit = this.BASE_TRANSACTION_COST + (actionCount * 200)
    
    return {
      computationLimit,
      storageLimit: actionCount * 50,
      estimatedCost: (computationLimit * 0.000001).toFixed(8),
      confidence: 0.3,
      breakdown: {
        baseTransactionCost: this.BASE_TRANSACTION_COST,
        actionCosts: workflow.actions.map(action => ({
          actionId: action.id,
          actionName: action.name,
          actionType: action.actionType,
          estimatedGas: 200,
          confidence: 0.3,
          factors: ['Fallback estimate']
        })),
        storageCost: actionCount * 50,
        networkFee: 50,
        totalCost: computationLimit
      },
      warnings: ['Using fallback gas estimation due to estimation failure']
    }
  }

  /**
   * Clear estimation caches
   */
  clearCache(): void {
    this.gasPriceCache.clear()
    this.estimateCache.clear()
  }

  /**
   * Update network configuration
   */
  updateNetworkConfig(config: FlowNetworkConfig): void {
    this.networkConfig = config
    this.clearCache() // Clear cache when network changes
  }
}