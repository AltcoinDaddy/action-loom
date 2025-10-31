/**
 * Transaction Monitor for Real-time Status Tracking and Error Handling
 * 
 * This module provides comprehensive transaction monitoring including:
 * - Real-time transaction status tracking
 * - Event parsing and analysis
 * - Detailed error reporting with actionable feedback
 * - Transaction retry mechanisms
 * - Transaction history and audit logging
 */

import * as fcl from "@onflow/fcl"
import type { 
  FlowNetworkConfig,
  ValidationError
} from "./types"
import { 
  Transaction, 
  TransactionResult, 
  TransactionStatus, 
  FlowEvent 
} from "./transaction-manager"
import { logger } from "./logging-service"

export interface TransactionMonitorConfig {
  maxWaitTime: number
  pollInterval: number
  retryAttempts: number
  retryDelay: number
  enableEventParsing: boolean
  enableAuditLogging: boolean
}

export interface TransactionError {
  code: TransactionErrorCode
  message: string
  details: string
  actionableSteps: string[]
  retryable: boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export enum TransactionErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RESOURCE_ERROR = 'RESOURCE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ParsedEvent {
  type: string
  data: any
  interpretation: string
  impact: EventImpact
  relatedActions: string[]
}

export enum EventImpact {
  SUCCESS = 'SUCCESS',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  INFO = 'INFO'
}

export interface TransactionAuditLog {
  transactionId: string
  timestamp: Date
  status: TransactionStatus
  gasUsed: number
  events: ParsedEvent[]
  errors: TransactionError[]
  retryCount: number
  totalTime: number
  network: string
}

export interface RetryStrategy {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: TransactionErrorCode[]
}

/**
 * Transaction Monitor for comprehensive status tracking and error handling
 */
export class TransactionMonitor {
  private config: TransactionMonitorConfig
  private networkConfig: FlowNetworkConfig
  private auditLogs: Map<string, TransactionAuditLog> = new Map()
  private activeMonitors: Map<string, Promise<TransactionResult>> = new Map()
  private retryStrategy: RetryStrategy

  constructor(
    networkConfig: FlowNetworkConfig,
    config: Partial<TransactionMonitorConfig> = {}
  ) {
    this.networkConfig = networkConfig
    this.config = {
      maxWaitTime: 120000, // 2 minutes
      pollInterval: 2000,  // 2 seconds
      retryAttempts: 3,
      retryDelay: 5000,    // 5 seconds
      enableEventParsing: true,
      enableAuditLogging: true,
      ...config
    }

    this.retryStrategy = {
      maxAttempts: this.config.retryAttempts,
      baseDelay: this.config.retryDelay,
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      retryableErrors: [
        TransactionErrorCode.NETWORK_ERROR,
        TransactionErrorCode.TIMEOUT,
        TransactionErrorCode.INSUFFICIENT_GAS
      ]
    }
  }

  /**
   * Monitor a transaction with comprehensive error handling and retry logic
   */
  async monitorTransaction(
    transactionId: string,
    originalTransaction?: Transaction
  ): Promise<TransactionResult> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()

    logger.info('Starting transaction monitoring', {
      correlationId,
      component: 'transaction-monitor',
      operation: 'monitor-transaction',
      metadata: {
        transactionId,
        maxWaitTime: this.config.maxWaitTime,
        pollInterval: this.config.pollInterval,
        network: this.networkConfig.name
      }
    })

    // Check if already monitoring this transaction
    if (this.activeMonitors.has(transactionId)) {
      logger.info('Transaction already being monitored, returning existing promise', {
        correlationId,
        transactionId
      })
      return this.activeMonitors.get(transactionId)!
    }

    const monitorPromise = this.monitorTransactionInternal(
      transactionId,
      originalTransaction,
      correlationId,
      startTime
    )

    this.activeMonitors.set(transactionId, monitorPromise)

    try {
      const result = await monitorPromise
      
      // Create audit log
      if (this.config.enableAuditLogging) {
        await this.createAuditLog(transactionId, result, startTime, originalTransaction)
      }

      return result

    } finally {
      this.activeMonitors.delete(transactionId)
    }
  }

  /**
   * Internal monitoring implementation with retry logic
   */
  private async monitorTransactionInternal(
    transactionId: string,
    originalTransaction: Transaction | undefined,
    correlationId: string,
    startTime: number
  ): Promise<TransactionResult> {
    let retryCount = 0
    let lastError: TransactionError | null = null

    while (retryCount <= this.retryStrategy.maxAttempts) {
      try {
        logger.debug(`Transaction monitoring attempt ${retryCount + 1}/${this.retryStrategy.maxAttempts + 1}`, {
          correlationId,
          component: 'transaction-monitor',
          operation: 'monitor-transaction-internal',
          metadata: { transactionId, retryCount }
        })

        const result = await this.pollTransactionStatus(transactionId, correlationId)
        
        // Parse events if enabled
        if (this.config.enableEventParsing && result.events.length > 0) {
          const parsedEvents = await this.parseTransactionEvents(result.events)
          result.events = result.events.map((event, index) => ({
            ...event,
            parsed: parsedEvents[index]
          }))
        }

        logger.info('Transaction monitoring completed successfully', {
          correlationId,
          component: 'transaction-monitor',
          operation: 'monitor-transaction-internal',
          metadata: {
            transactionId,
            status: result.status,
            gasUsed: result.gasUsed,
            eventCount: result.events.length,
            totalTime: Date.now() - startTime,
            retryCount
          }
        })

        return result

      } catch (error) {
        const transactionError = this.categorizeError(error as Error, transactionId)
        lastError = transactionError

        logger.warn(`Transaction monitoring attempt ${retryCount + 1} failed`, {
          correlationId,
          component: 'transaction-monitor',
          operation: 'monitor-transaction-internal',
          metadata: {
            transactionId,
            retryCount,
            errorCode: transactionError.code,
            errorMessage: transactionError.message,
            retryable: transactionError.retryable
          }
        })

        // Check if error is retryable
        if (!transactionError.retryable || retryCount >= this.retryStrategy.maxAttempts) {
          break
        }

        // Calculate retry delay with exponential backoff
        const delay = Math.min(
          this.retryStrategy.baseDelay * Math.pow(this.retryStrategy.backoffMultiplier, retryCount),
          this.retryStrategy.maxDelay
        )

        logger.info(`Retrying transaction monitoring in ${delay}ms`, {
          correlationId,
          transactionId,
          retryCount: retryCount + 1,
          delay
        })

        await new Promise(resolve => setTimeout(resolve, delay))
        retryCount++
      }
    }

    // All retries failed
    logger.error('Transaction monitoring failed after all retries', lastError as any, {
      correlationId,
      component: 'transaction-monitor',
      operation: 'monitor-transaction-internal',
      metadata: {
        transactionId,
        totalRetries: retryCount,
        totalTime: Date.now() - startTime
      }
    })

    return {
      transactionId,
      status: TransactionStatus.FAILED,
      events: [],
      gasUsed: 0,
      error: lastError?.message || 'Unknown error',
      blockHeight: 0,
      timestamp: new Date(),
      executionTime: Date.now() - startTime,
      metadata: originalTransaction?.metadata
    }
  }

  /**
   * Poll transaction status until completion or timeout
   */
  private async pollTransactionStatus(
    transactionId: string,
    correlationId: string
  ): Promise<TransactionResult> {
    const startTime = Date.now()
    let pollCount = 0

    while (Date.now() - startTime < this.config.maxWaitTime) {
      pollCount++

      try {
        logger.debug(`Polling transaction status (attempt ${pollCount})`, {
          correlationId,
          component: 'transaction-monitor',
          operation: 'poll-transaction-status',
          metadata: {
            transactionId,
            pollCount,
            elapsedTime: Date.now() - startTime
          }
        })

        const tx = await fcl.tx(transactionId).snapshot()
        
        // Check transaction status
        if (tx.status >= 4) { // SEALED or higher
          const events = await this.getTransactionEvents(transactionId)
          
          const result: TransactionResult = {
            transactionId,
            status: this.mapFlowStatus(tx.status),
            events,
            gasUsed: tx.gasUsed || 0,
            blockHeight: tx.blockId ? parseInt(tx.blockId, 16) : 0,
            timestamp: new Date(),
            executionTime: Date.now() - startTime
          }

          // Check for transaction errors in events
          const errorEvents = events.filter(e => e.type.includes('Error') || e.type.includes('Failed'))
          if (errorEvents.length > 0) {
            result.error = this.extractErrorFromEvents(errorEvents)
            result.status = TransactionStatus.FAILED
          }

          return result
        }

        // Check for expired status
        if (tx.status === 5) { // EXPIRED
          throw new Error('Transaction expired')
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, this.config.pollInterval))

      } catch (error) {
        // If this is a network error, we might want to retry
        if (this.isNetworkError(error as Error)) {
          logger.warn('Network error during polling, will retry', {
            correlationId,
            transactionId,
            pollCount,
            error: (error as Error).message
          })
          
          await new Promise(resolve => setTimeout(resolve, this.config.pollInterval))
          continue
        }

        // For other errors, rethrow
        throw error
      }
    }

    // Timeout reached
    throw new Error(`Transaction monitoring timeout after ${this.config.maxWaitTime}ms`)
  }

  /**
   * Get and parse transaction events
   */
  private async getTransactionEvents(transactionId: string): Promise<FlowEvent[]> {
    try {
      const tx = await fcl.tx(transactionId).snapshot()
      return tx.events?.map((event: any, index: number) => ({
        type: event.type,
        transactionId,
        transactionIndex: event.transactionIndex || 0,
        eventIndex: index,
        data: event.data
      })) || []
    } catch (error) {
      logger.warn('Failed to get transaction events', {
        component: 'transaction-monitor',
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
   * Parse transaction events for better understanding
   */
  private async parseTransactionEvents(events: FlowEvent[]): Promise<ParsedEvent[]> {
    return events.map(event => this.parseEvent(event))
  }

  /**
   * Parse individual event
   */
  private parseEvent(event: FlowEvent): ParsedEvent {
    const eventType = event.type.split('.').pop() || event.type
    
    // Common event patterns
    const eventPatterns: Record<string, { interpretation: string, impact: EventImpact }> = {
      'TokensWithdrawn': {
        interpretation: 'Tokens were withdrawn from an account',
        impact: EventImpact.SUCCESS
      },
      'TokensDeposited': {
        interpretation: 'Tokens were deposited to an account',
        impact: EventImpact.SUCCESS
      },
      'TokensMinted': {
        interpretation: 'New tokens were minted',
        impact: EventImpact.SUCCESS
      },
      'NFTMinted': {
        interpretation: 'NFT was successfully minted',
        impact: EventImpact.SUCCESS
      },
      'NFTTransferred': {
        interpretation: 'NFT ownership was transferred',
        impact: EventImpact.SUCCESS
      },
      'ContractError': {
        interpretation: 'Smart contract execution error occurred',
        impact: EventImpact.ERROR
      },
      'InsufficientBalance': {
        interpretation: 'Account has insufficient balance for operation',
        impact: EventImpact.ERROR
      }
    }

    const pattern = eventPatterns[eventType] || {
      interpretation: `Event of type ${eventType} occurred`,
      impact: EventImpact.INFO
    }

    return {
      type: event.type,
      data: event.data,
      interpretation: pattern.interpretation,
      impact: pattern.impact,
      relatedActions: [] // Would be populated based on transaction context
    }
  }

  /**
   * Categorize error for better handling
   */
  private categorizeError(error: Error, transactionId: string): TransactionError {
    const message = error.message.toLowerCase()

    // Network-related errors
    if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
      return {
        code: TransactionErrorCode.NETWORK_ERROR,
        message: 'Network connection error',
        details: error.message,
        actionableSteps: [
          'Check your internet connection',
          'Verify Flow network status',
          'Try again in a few moments'
        ],
        retryable: true,
        severity: 'medium'
      }
    }

    // Gas-related errors
    if (message.includes('gas') || message.includes('computation limit')) {
      return {
        code: TransactionErrorCode.INSUFFICIENT_GAS,
        message: 'Insufficient gas for transaction execution',
        details: error.message,
        actionableSteps: [
          'Increase gas limit for the transaction',
          'Simplify the workflow to reduce gas usage',
          'Check current network gas prices'
        ],
        retryable: true,
        severity: 'medium'
      }
    }

    // Balance-related errors
    if (message.includes('insufficient') && message.includes('balance')) {
      return {
        code: TransactionErrorCode.INSUFFICIENT_BALANCE,
        message: 'Insufficient account balance',
        details: error.message,
        actionableSteps: [
          'Add more FLOW tokens to your account',
          'Reduce transaction amount',
          'Check required token balances'
        ],
        retryable: false,
        severity: 'high'
      }
    }

    // Authorization errors
    if (message.includes('authorization') || message.includes('signature')) {
      return {
        code: TransactionErrorCode.AUTHORIZATION_ERROR,
        message: 'Transaction authorization failed',
        details: error.message,
        actionableSteps: [
          'Reconnect your wallet',
          'Verify wallet permissions',
          'Check account authorization settings'
        ],
        retryable: false,
        severity: 'high'
      }
    }

    // Contract errors
    if (message.includes('contract') || message.includes('cadence')) {
      return {
        code: TransactionErrorCode.CONTRACT_ERROR,
        message: 'Smart contract execution error',
        details: error.message,
        actionableSteps: [
          'Review transaction parameters',
          'Check contract requirements',
          'Verify input data format'
        ],
        retryable: false,
        severity: 'high'
      }
    }

    // Default unknown error
    return {
      code: TransactionErrorCode.UNKNOWN_ERROR,
      message: 'Unknown transaction error',
      details: error.message,
      actionableSteps: [
        'Review transaction details',
        'Check Flow network status',
        'Contact support if issue persists'
      ],
      retryable: false,
      severity: 'medium'
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    transactionId: string,
    result: TransactionResult,
    startTime: number,
    originalTransaction?: Transaction
  ): Promise<void> {
    const auditLog: TransactionAuditLog = {
      transactionId,
      timestamp: new Date(),
      status: result.status,
      gasUsed: result.gasUsed,
      events: this.config.enableEventParsing 
        ? await this.parseTransactionEvents(result.events)
        : [],
      errors: result.error ? [this.categorizeError(new Error(result.error), transactionId)] : [],
      retryCount: 0, // Would be tracked during monitoring
      totalTime: Date.now() - startTime,
      network: this.networkConfig.name
    }

    this.auditLogs.set(transactionId, auditLog)

    logger.info('Transaction audit log created', {
      component: 'transaction-monitor',
      operation: 'create-audit-log',
      metadata: {
        transactionId,
        status: auditLog.status,
        gasUsed: auditLog.gasUsed,
        eventCount: auditLog.events.length,
        errorCount: auditLog.errors.length,
        totalTime: auditLog.totalTime
      }
    })
  }

  // Helper methods
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

  private isNetworkError(error: Error): boolean {
    const message = error.message.toLowerCase()
    return message.includes('network') || 
           message.includes('connection') || 
           message.includes('timeout') ||
           message.includes('fetch')
  }

  private extractErrorFromEvents(errorEvents: FlowEvent[]): string {
    if (errorEvents.length === 0) return 'Unknown error'
    
    const firstError = errorEvents[0]
    return firstError.data?.message || firstError.type || 'Contract execution error'
  }

  /**
   * Get audit log for transaction
   */
  getAuditLog(transactionId: string): TransactionAuditLog | null {
    return this.auditLogs.get(transactionId) || null
  }

  /**
   * Get all audit logs
   */
  getAllAuditLogs(): TransactionAuditLog[] {
    return Array.from(this.auditLogs.values())
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs.clear()
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TransactionMonitorConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Update network configuration
   */
  updateNetworkConfig(config: FlowNetworkConfig): void {
    this.networkConfig = config
  }
}