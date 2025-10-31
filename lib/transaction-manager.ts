/**
 * Transaction Manager for Real Flow Blockchain Execution
 * 
 * This module provides production-ready transaction management including:
 * - Transaction building and validation
 * - Real transaction submission using FCL
 * - Transaction status tracking and monitoring
 * - Transaction sequencing and dependency management
 * - Comprehensive error handling and retry logic
 */

import * as fcl from "@onflow/fcl"
import * as t from "@onflow/types"
import type { 
  ParsedWorkflow, 
  ParsedAction, 
  EnhancedWorkflow,
  FlowAccount,
  FlowNetworkConfig,
  ExecutionResult,
  ValidationError
} from "./types"
import { EnhancedCadenceGenerator, ProductionCadenceGenerationOptions } from "./enhanced-cadence-generator"
import { logger } from "./logging-service"

export interface Transaction {
  id: string
  cadenceCode: string
  arguments: TransactionArgument[]
  gasLimit: number
  proposer: string
  authorizers: string[]
  payer: string
  referenceBlockId?: string
  computeLimit?: number
  metadata?: TransactionMetadata
}

export interface TransactionArgument {
  value: any
  type: any // FCL type
  name?: string
}

export interface TransactionMetadata {
  workflowId?: string
  actionCount: number
  estimatedGas: number
  securityLevel: string
  createdAt: string
  network: string
}

export interface TransactionResult {
  transactionId: string
  status: TransactionStatus
  events: FlowEvent[]
  gasUsed: number
  error?: string
  blockHeight: number
  timestamp: Date
  executionTime: number
  metadata?: TransactionMetadata
}

export interface FlowEvent {
  type: string
  transactionId: string
  transactionIndex: number
  eventIndex: number
  data: any
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  FINALIZED = 'FINALIZED',
  EXECUTED = 'EXECUTED',
  SEALED = 'SEALED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED'
}

export interface TransactionBuilder {
  buildTransaction(workflow: ParsedWorkflow | EnhancedWorkflow, options?: TransactionBuildOptions): Promise<Transaction>
  validateTransaction(transaction: Transaction): Promise<ValidationResult>
  estimateGas(transaction: Transaction): Promise<GasEstimate>
}

export interface TransactionBuildOptions {
  gasLimit?: number
  proposer?: string
  authorizers?: string[]
  payer?: string
  network?: 'testnet' | 'mainnet'
  enableOptimizations?: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
}

export interface GasEstimate {
  computationLimit: number
  storageLimit: number
  estimatedCost: string
  confidence: number
}

export interface BatchTransactionResult {
  transactions: TransactionResult[]
  totalGasUsed: number
  totalExecutionTime: number
  successCount: number
  failureCount: number
  errors: string[]
}

export interface TransactionSequence {
  transactions: Transaction[]
  dependencies: TransactionDependency[]
  executionOrder: string[]
}

export interface TransactionDependency {
  transactionId: string
  dependsOn: string[]
  condition?: (result: TransactionResult) => boolean
}

/**
 * Production-ready Transaction Manager for Flow blockchain execution
 */
export class FlowTransactionManager {
  private networkConfig: FlowNetworkConfig
  private transactionHistory: Map<string, TransactionResult> = new Map()
  private pendingTransactions: Map<string, Promise<TransactionResult>> = new Map()
  private retryAttempts: Map<string, number> = new Map()
  private maxRetries: number = 3
  private retryDelay: number = 2000

  constructor(networkConfig: FlowNetworkConfig) {
    this.networkConfig = networkConfig
    this.initializeFCL()
  }

  /**
   * Initialize FCL with network configuration
   */
  private initializeFCL(): void {
    fcl.config({
      'accessNode.api': this.networkConfig.accessNode,
      'discovery.wallet': this.networkConfig.walletDiscovery,
      'app.detail.title': 'ActionLoom',
      'app.detail.icon': '/logo.png',
      'flow.network': this.networkConfig.name
    })
  }

  /**
   * Build a transaction from a workflow
   */
  async buildTransaction(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    options: TransactionBuildOptions = {}
  ): Promise<Transaction> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()

    logger.info('Building transaction from workflow', {
      correlationId,
      component: 'transaction-manager',
      operation: 'build-transaction',
      metadata: {
        workflowId: workflow.metadata?.name || 'unknown',
        actionCount: workflow.actions.length,
        network: options.network || 'testnet'
      }
    })

    try {
      // Generate Cadence code
      const cadenceOptions: Partial<ProductionCadenceGenerationOptions> = {
        targetNetwork: options.network || 'testnet',
        enableResourceSafety: true,
        enableSecurityChecks: true,
        enableGasOptimization: options.enableOptimizations !== false,
        maxGasLimit: options.gasLimit
      }

      const generationResult = await EnhancedCadenceGenerator.generateProductionTransaction(
        workflow,
        cadenceOptions
      )

      if (!generationResult.success) {
        throw new Error(`Cadence generation failed: ${generationResult.errors.join(', ')}`)
      }

      // Build transaction arguments
      const args = await this.buildTransactionArguments(workflow)

      // Get current user for transaction roles
      const currentUser = await fcl.currentUser.snapshot()
      if (!currentUser.addr) {
        throw new Error('No authenticated user found')
      }

      const transaction: Transaction = {
        id: this.generateTransactionId(),
        cadenceCode: generationResult.code,
        arguments: args,
        gasLimit: options.gasLimit || generationResult.validationResult.gasEstimate || 1000,
        proposer: options.proposer || currentUser.addr,
        authorizers: options.authorizers || [currentUser.addr],
        payer: options.payer || currentUser.addr,
        metadata: {
          workflowId: workflow.metadata?.name,
          actionCount: workflow.actions.length,
          estimatedGas: generationResult.validationResult.gasEstimate,
          securityLevel: (workflow as EnhancedWorkflow).securityLevel || 'medium',
          createdAt: new Date().toISOString(),
          network: options.network || 'testnet'
        }
      }

      logger.info('Transaction built successfully', {
        correlationId,
        component: 'transaction-manager',
        operation: 'build-transaction',
        metadata: {
          transactionId: transaction.id,
          gasLimit: transaction.gasLimit,
          argumentCount: transaction.arguments.length,
          buildTime: Date.now() - startTime
        }
      })

      return transaction

    } catch (error) {
      logger.error('Transaction building failed', error as Error, {
        correlationId,
        component: 'transaction-manager',
        operation: 'build-transaction'
      })
      throw error
    }
  }

  /**
   * Execute a single transaction
   */
  async executeTransaction(transaction: Transaction): Promise<TransactionResult> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()

    logger.info('Executing transaction', {
      correlationId,
      component: 'transaction-manager',
      operation: 'execute-transaction',
      metadata: {
        transactionId: transaction.id,
        gasLimit: transaction.gasLimit,
        network: transaction.metadata?.network
      }
    })

    // Check if transaction is already being executed
    if (this.pendingTransactions.has(transaction.id)) {
      logger.info('Transaction already pending, returning existing promise', {
        correlationId,
        transactionId: transaction.id
      })
      return this.pendingTransactions.get(transaction.id)!
    }

    const executionPromise = this.executeTransactionInternal(transaction, correlationId, startTime)
    this.pendingTransactions.set(transaction.id, executionPromise)

    try {
      const result = await executionPromise
      this.transactionHistory.set(transaction.id, result)
      return result
    } finally {
      this.pendingTransactions.delete(transaction.id)
    }
  }

  /**
   * Internal transaction execution with retry logic
   */
  private async executeTransactionInternal(
    transaction: Transaction,
    correlationId: string,
    startTime: number
  ): Promise<TransactionResult> {
    const maxRetries = this.maxRetries
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Transaction execution attempt ${attempt}/${maxRetries}`, {
          correlationId,
          component: 'transaction-manager',
          operation: 'execute-transaction-internal',
          metadata: { transactionId: transaction.id, attempt }
        })

        // Submit transaction to Flow
        const transactionId = await fcl.mutate({
          cadence: transaction.cadenceCode,
          args: (arg: any, t: any) => transaction.arguments.map(a => arg(a.value, a.type)),
          proposer: fcl.authz,
          authorizations: [fcl.authz],
          payer: fcl.authz,
          limit: transaction.gasLimit
        })

        logger.info('Transaction submitted to Flow', {
          correlationId,
          component: 'transaction-manager',
          operation: 'execute-transaction-internal',
          metadata: { 
            transactionId: transaction.id,
            flowTransactionId: transactionId,
            attempt
          }
        })

        // Monitor transaction status
        const result = await this.monitorTransaction(transactionId, correlationId)
        
        const finalResult: TransactionResult = {
          ...result,
          executionTime: Date.now() - startTime,
          metadata: transaction.metadata
        }

        logger.info('Transaction execution completed', {
          correlationId,
          component: 'transaction-manager',
          operation: 'execute-transaction-internal',
          metadata: {
            transactionId: transaction.id,
            flowTransactionId: transactionId,
            status: finalResult.status,
            gasUsed: finalResult.gasUsed,
            executionTime: finalResult.executionTime
          }
        })

        return finalResult

      } catch (error) {
        lastError = error as Error
        
        logger.warn(`Transaction execution attempt ${attempt} failed`, {
          correlationId,
          component: 'transaction-manager',
          operation: 'execute-transaction-internal',
          metadata: {
            transactionId: transaction.id,
            attempt,
            error: lastError.message
          }
        })

        if (attempt < maxRetries) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt))
        }
      }
    }

    // All retries failed
    logger.error('Transaction execution failed after all retries', lastError!, {
      correlationId,
      component: 'transaction-manager',
      operation: 'execute-transaction-internal',
      metadata: {
        transactionId: transaction.id,
        maxRetries,
        totalTime: Date.now() - startTime
      }
    })

    return {
      transactionId: transaction.id,
      status: TransactionStatus.FAILED,
      events: [],
      gasUsed: 0,
      error: lastError?.message || 'Unknown error',
      blockHeight: 0,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      metadata: transaction.metadata
    }
  }

  /**
   * Monitor transaction status until completion
   */
  private async monitorTransaction(
    transactionId: string,
    correlationId: string
  ): Promise<TransactionResult> {
    const maxWaitTime = 60000 // 60 seconds
    const pollInterval = 2000 // 2 seconds
    const startTime = Date.now()

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const tx = await fcl.tx(transactionId).snapshot()
        
        logger.debug('Transaction status check', {
          correlationId,
          component: 'transaction-manager',
          operation: 'monitor-transaction',
          metadata: {
            transactionId,
            status: tx.status,
            statusCode: tx.statusCode
          }
        })

        // Check if transaction is sealed (final state)
        if (tx.status >= 4) { // SEALED
          const events = await this.getTransactionEvents(transactionId)
          
          return {
            transactionId,
            status: this.mapFlowStatus(tx.status),
            events,
            gasUsed: tx.gasUsed || 0,
            blockHeight: tx.blockId ? parseInt(tx.blockId, 16) : 0,
            timestamp: new Date(),
            executionTime: 0 // Will be set by caller
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval))

      } catch (error) {
        logger.warn('Error monitoring transaction', {
          correlationId,
          component: 'transaction-manager',
          operation: 'monitor-transaction',
          metadata: {
            transactionId,
            error: (error as Error).message
          }
        })
        
        // Continue monitoring despite errors
        await new Promise(resolve => setTimeout(resolve, pollInterval))
      }
    }

    // Timeout reached
    throw new Error(`Transaction monitoring timeout after ${maxWaitTime}ms`)
  }

  /**
   * Get transaction events
   */
  private async getTransactionEvents(transactionId: string): Promise<FlowEvent[]> {
    try {
      const tx = await fcl.tx(transactionId).snapshot()
      return tx.events?.map((event: any) => ({
        type: event.type,
        transactionId,
        transactionIndex: event.transactionIndex,
        eventIndex: event.eventIndex,
        data: event.data
      })) || []
    } catch (error) {
      logger.warn('Failed to get transaction events', {
        component: 'transaction-manager',
        operation: 'get-transaction-events',
        metadata: {
          transactionId,
          error: (error as Error).message
        }
      })
      return []
    }
  }

  /**
   * Execute multiple transactions in sequence
   */
  async executeSequence(sequence: TransactionSequence): Promise<BatchTransactionResult> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()
    const results: TransactionResult[] = []
    const errors: string[] = []
    let totalGasUsed = 0

    logger.info('Executing transaction sequence', {
      correlationId,
      component: 'transaction-manager',
      operation: 'execute-sequence',
      metadata: {
        transactionCount: sequence.transactions.length,
        hasDependendencies: sequence.dependencies.length > 0
      }
    })

    try {
      // Execute transactions in order
      for (const transactionId of sequence.executionOrder) {
        const transaction = sequence.transactions.find(t => t.id === transactionId)
        if (!transaction) {
          const error = `Transaction ${transactionId} not found in sequence`
          errors.push(error)
          continue
        }

        // Check dependencies
        const dependency = sequence.dependencies.find(d => d.transactionId === transactionId)
        if (dependency) {
          const dependencyMet = await this.checkDependencies(dependency, results)
          if (!dependencyMet) {
            const error = `Dependencies not met for transaction ${transactionId}`
            errors.push(error)
            continue
          }
        }

        // Execute transaction
        try {
          const result = await this.executeTransaction(transaction)
          results.push(result)
          totalGasUsed += result.gasUsed

          // Check if transaction failed and should stop sequence
          if (result.status === TransactionStatus.FAILED) {
            errors.push(`Transaction ${transactionId} failed: ${result.error}`)
            break // Stop sequence on failure
          }

        } catch (error) {
          const errorMessage = `Transaction ${transactionId} execution failed: ${(error as Error).message}`
          errors.push(errorMessage)
          break // Stop sequence on error
        }
      }

      const batchResult: BatchTransactionResult = {
        transactions: results,
        totalGasUsed,
        totalExecutionTime: Date.now() - startTime,
        successCount: results.filter(r => r.status === TransactionStatus.SEALED).length,
        failureCount: results.filter(r => r.status === TransactionStatus.FAILED).length,
        errors
      }

      logger.info('Transaction sequence completed', {
        correlationId,
        component: 'transaction-manager',
        operation: 'execute-sequence',
        metadata: {
          totalTransactions: sequence.transactions.length,
          successCount: batchResult.successCount,
          failureCount: batchResult.failureCount,
          totalGasUsed: batchResult.totalGasUsed,
          totalTime: batchResult.totalExecutionTime
        }
      })

      return batchResult

    } catch (error) {
      logger.error('Transaction sequence execution failed', error as Error, {
        correlationId,
        component: 'transaction-manager',
        operation: 'execute-sequence'
      })

      return {
        transactions: results,
        totalGasUsed,
        totalExecutionTime: Date.now() - startTime,
        successCount: results.filter(r => r.status === TransactionStatus.SEALED).length,
        failureCount: results.filter(r => r.status === TransactionStatus.FAILED).length,
        errors: [...errors, (error as Error).message]
      }
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<TransactionResult | null> {
    // Check local history first
    if (this.transactionHistory.has(transactionId)) {
      return this.transactionHistory.get(transactionId)!
    }

    // Check if transaction is pending
    if (this.pendingTransactions.has(transactionId)) {
      try {
        return await this.pendingTransactions.get(transactionId)!
      } catch (error) {
        return null
      }
    }

    // Query Flow network
    try {
      const tx = await fcl.tx(transactionId).snapshot()
      const events = await this.getTransactionEvents(transactionId)
      
      const result: TransactionResult = {
        transactionId,
        status: this.mapFlowStatus(tx.status),
        events,
        gasUsed: tx.gasUsed || 0,
        blockHeight: tx.blockId ? parseInt(tx.blockId, 16) : 0,
        timestamp: new Date(),
        executionTime: 0
      }

      // Cache result if transaction is final
      if (result.status === TransactionStatus.SEALED || result.status === TransactionStatus.FAILED) {
        this.transactionHistory.set(transactionId, result)
      }

      return result

    } catch (error) {
      logger.warn('Failed to get transaction status', {
        component: 'transaction-manager',
        operation: 'get-transaction-status',
        metadata: {
          transactionId,
          error: (error as Error).message
        }
      })
      return null
    }
  }

  /**
   * Simulate transaction execution
   */
  async simulateTransaction(transaction: Transaction): Promise<TransactionResult> {
    const correlationId = logger.generateCorrelationId()
    
    logger.info('Simulating transaction execution', {
      correlationId,
      component: 'transaction-manager',
      operation: 'simulate-transaction',
      metadata: {
        transactionId: transaction.id,
        gasLimit: transaction.gasLimit
      }
    })

    try {
      // Use FCL's script execution for simulation
      const result = await fcl.query({
        cadence: transaction.cadenceCode,
        args: (arg: any, t: any) => transaction.arguments.map(a => arg(a.value, a.type))
      })

      return {
        transactionId: transaction.id,
        status: TransactionStatus.EXECUTED,
        events: [],
        gasUsed: Math.floor(transaction.gasLimit * 0.8), // Estimate
        blockHeight: 0,
        timestamp: new Date(),
        executionTime: 0,
        metadata: transaction.metadata
      }

    } catch (error) {
      logger.error('Transaction simulation failed', error as Error, {
        correlationId,
        component: 'transaction-manager',
        operation: 'simulate-transaction',
        metadata: { transactionId: transaction.id }
      })

      return {
        transactionId: transaction.id,
        status: TransactionStatus.FAILED,
        events: [],
        gasUsed: 0,
        error: (error as Error).message,
        blockHeight: 0,
        timestamp: new Date(),
        executionTime: 0,
        metadata: transaction.metadata
      }
    }
  }

  // Helper methods
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async buildTransactionArguments(workflow: ParsedWorkflow | EnhancedWorkflow): Promise<TransactionArgument[]> {
    const args: TransactionArgument[] = []
    
    // Extract arguments from workflow parameters
    for (const action of workflow.actions) {
      for (const param of action.parameters) {
        if (param.value && param.type) {
          const flowType = this.mapToFlowType(param.type)
          const convertedValue = EnhancedCadenceGenerator.convertToFlowType(param.value, param.type)
          
          args.push({
            value: convertedValue,
            type: flowType,
            name: param.name
          })
        }
      }
    }

    return args
  }

  private mapToFlowType(paramType: string): any {
    const typeMap: Record<string, any> = {
      'Address': t.Address,
      'UFix64': t.UFix64,
      'Fix64': t.Fix64,
      'UInt64': t.UInt64,
      'Int': t.Int,
      'String': t.String,
      'Bool': t.Bool
    }
    
    return typeMap[paramType] || t.String
  }

  private mapFlowStatus(statusCode: number): TransactionStatus {
    switch (statusCode) {
      case 0: return TransactionStatus.PENDING
      case 1: return TransactionStatus.FINALIZED
      case 2: return TransactionStatus.EXECUTED
      case 3: return TransactionStatus.SEALED
      case 4: return TransactionStatus.SEALED
      case 5: return TransactionStatus.EXPIRED
      default: return TransactionStatus.FAILED
    }
  }

  private async checkDependencies(
    dependency: TransactionDependency,
    completedResults: TransactionResult[]
  ): Promise<boolean> {
    for (const depId of dependency.dependsOn) {
      const result = completedResults.find(r => r.transactionId === depId)
      if (!result || result.status !== TransactionStatus.SEALED) {
        return false
      }
      
      // Check custom condition if provided
      if (dependency.condition && !dependency.condition(result)) {
        return false
      }
    }
    
    return true
  }

  /**
   * Get transaction history
   */
  getTransactionHistory(): TransactionResult[] {
    return Array.from(this.transactionHistory.values())
  }

  /**
   * Clear transaction history
   */
  clearHistory(): void {
    this.transactionHistory.clear()
  }

  /**
   * Update network configuration
   */
  updateNetworkConfig(config: FlowNetworkConfig): void {
    this.networkConfig = config
    this.initializeFCL()
  }
}