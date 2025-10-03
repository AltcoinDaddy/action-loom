import { 
  Agent, 
  RetryPolicy, 
  NotificationConfig,
  ExecutionResult
} from './types'

/**
 * Agent Execution Monitoring and Error Handling Service
 * 
 * Provides comprehensive execution tracking and error handling:
 * - Execution tracking with success/failure metrics
 * - Retry mechanisms with exponential backoff
 * - Notification system for Agent failures and successes
 * 
 * Requirements: 4.5, 4.6
 */
export class AgentExecutionService {
  private executionHistory: Map<string, ExecutionRecord[]> = new Map()
  private activeExecutions: Map<string, ActiveExecution> = new Map()
  private retryQueues: Map<string, RetryQueue> = new Map()
  private notificationService: NotificationService
  private metricsCollector: ExecutionMetricsCollector

  constructor() {
    this.notificationService = new NotificationService()
    this.metricsCollector = new ExecutionMetricsCollector()
    this.startRetryProcessor()
  }

  /**
   * Execute Agent Workflow
   * Requirement 4.5: Execution tracking with success/failure metrics
   */
  async executeAgent(
    agent: Agent, 
    trigger?: { type: string; data?: any }
  ): Promise<ExecutionResult> {
    const executionId = this.generateExecutionId()
    const startTime = Date.now()

    // Create execution record
    const execution: ActiveExecution = {
      id: executionId,
      agentId: agent.id,
      startTime: new Date().toISOString(),
      status: 'running',
      trigger,
      retryCount: 0,
      maxRetries: this.getRetryPolicy(agent).maxRetries
    }

    this.activeExecutions.set(executionId, execution)

    try {
      console.log(`Starting execution ${executionId} for agent ${agent.id}`)
      
      // Execute the workflow
      const result = await this.executeWorkflow(agent, execution)
      
      // Record successful execution
      await this.recordExecution(agent.id, {
        id: executionId,
        agentId: agent.id,
        startTime: execution.startTime,
        endTime: new Date().toISOString(),
        duration: Date.now() - startTime,
        status: 'success',
        result,
        trigger,
        retryCount: execution.retryCount,
        error: null
      })

      // Send success notification if configured
      await this.sendNotification(agent, 'success', { executionId, result })

      // Update metrics
      this.metricsCollector.recordSuccess(agent.id, Date.now() - startTime)

      return result

    } catch (error) {
      console.error(`Execution ${executionId} failed for agent ${agent.id}:`, error)
      
      // Handle execution failure
      return await this.handleExecutionFailure(agent, execution, error as Error)
      
    } finally {
      this.activeExecutions.delete(executionId)
    }
  }

  /**
   * Retry Mechanism with Exponential Backoff
   * Requirement 4.5: Retry mechanisms with exponential backoff
   */
  private async handleExecutionFailure(
    agent: Agent, 
    execution: ActiveExecution, 
    error: Error
  ): Promise<ExecutionResult> {
    const retryPolicy = this.getRetryPolicy(agent)
    
    // Record failed execution
    const executionRecord: ExecutionRecord = {
      id: execution.id,
      agentId: agent.id,
      startTime: execution.startTime,
      endTime: new Date().toISOString(),
      duration: Date.now() - new Date(execution.startTime).getTime(),
      status: 'failed',
      result: null,
      trigger: execution.trigger,
      retryCount: execution.retryCount,
      error: {
        message: error.message,
        stack: error.stack,
        type: error.constructor.name
      }
    }

    await this.recordExecution(agent.id, executionRecord)
    this.metricsCollector.recordFailure(agent.id, executionRecord.duration)

    // Check if we should retry
    if (execution.retryCount < retryPolicy.maxRetries) {
      await this.scheduleRetry(agent, execution, error)
      
      return {
        success: false,
        error: `Execution failed, scheduled for retry (attempt ${execution.retryCount + 1}/${retryPolicy.maxRetries + 1})`,
        executionTime: executionRecord.duration
      }
    } else {
      // Max retries exceeded, send failure notification
      await this.sendNotification(agent, 'failure', { 
        executionId: execution.id, 
        error: error.message,
        retryCount: execution.retryCount
      })

      return {
        success: false,
        error: `Execution failed after ${execution.retryCount} retries: ${error.message}`,
        executionTime: executionRecord.duration
      }
    }
  }

  private async scheduleRetry(
    agent: Agent, 
    execution: ActiveExecution, 
    error: Error
  ): Promise<void> {
    const retryPolicy = this.getRetryPolicy(agent)
    const delay = this.calculateRetryDelay(retryPolicy, execution.retryCount)
    
    const retryItem: RetryItem = {
      id: this.generateRetryId(),
      agentId: agent.id,
      originalExecutionId: execution.id,
      scheduledTime: new Date(Date.now() + delay),
      retryCount: execution.retryCount + 1,
      lastError: error.message,
      agent
    }

    // Add to retry queue
    if (!this.retryQueues.has(agent.id)) {
      this.retryQueues.set(agent.id, { items: [], isProcessing: false })
    }

    this.retryQueues.get(agent.id)!.items.push(retryItem)
    
    console.log(`Scheduled retry for agent ${agent.id} in ${delay}ms (attempt ${retryItem.retryCount})`)
  }

  private calculateRetryDelay(retryPolicy: RetryPolicy, retryCount: number): number {
    const { backoffStrategy, initialDelay, maxDelay } = retryPolicy
    
    let delay: number
    
    switch (backoffStrategy) {
      case 'linear':
        delay = initialDelay * (retryCount + 1)
        break
      case 'exponential':
        delay = initialDelay * Math.pow(2, retryCount)
        break
      default:
        delay = initialDelay
    }

    // Apply jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay
    delay += jitter

    return Math.min(delay, maxDelay)
  }

  /**
   * Retry Processing
   */
  private startRetryProcessor(): void {
    // Process retry queues every 5 seconds
    setInterval(() => {
      this.processRetryQueues()
    }, 5000)
  }

  private async processRetryQueues(): Promise<void> {
    const now = new Date()

    for (const [agentId, queue] of this.retryQueues) {
      if (queue.isProcessing) continue

      const readyItems = queue.items.filter(item => item.scheduledTime <= now)
      
      if (readyItems.length > 0) {
        queue.isProcessing = true
        
        try {
          for (const item of readyItems) {
            await this.processRetryItem(item)
            // Remove processed item from queue
            queue.items = queue.items.filter(i => i.id !== item.id)
          }
        } finally {
          queue.isProcessing = false
        }
      }
    }
  }

  private async processRetryItem(item: RetryItem): Promise<void> {
    console.log(`Processing retry for agent ${item.agentId} (attempt ${item.retryCount})`)
    
    try {
      // Execute the agent with retry context
      await this.executeAgent(item.agent, { 
        type: 'retry', 
        data: { 
          originalExecutionId: item.originalExecutionId,
          retryCount: item.retryCount 
        }
      })
    } catch (error) {
      console.error(`Retry execution failed for agent ${item.agentId}:`, error)
    }
  }

  /**
   * Workflow Execution (Simulated)
   */
  private async executeWorkflow(agent: Agent, execution: ActiveExecution): Promise<ExecutionResult> {
    // Simulate workflow execution
    console.log(`Executing workflow ${agent.workflowId} for agent ${agent.id}`)
    
    // Simulate execution time
    const executionTime = Math.random() * 2000 + 500 // 500-2500ms
    await new Promise(resolve => setTimeout(resolve, executionTime))
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error('Simulated workflow execution failure')
    }

    return {
      success: true,
      transactionId: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'completed',
      executionTime: Math.round(executionTime),
      gasUsed: Math.floor(Math.random() * 1000) + 100
    }
  }

  /**
   * Execution History and Metrics
   * Requirement 4.6: Execution tracking with success/failure metrics
   */
  private async recordExecution(agentId: string, record: ExecutionRecord): Promise<void> {
    if (!this.executionHistory.has(agentId)) {
      this.executionHistory.set(agentId, [])
    }

    const history = this.executionHistory.get(agentId)!
    history.push(record)

    // Keep only last 100 executions per agent
    if (history.length > 100) {
      history.splice(0, history.length - 100)
    }
  }

  getExecutionHistory(agentId: string, limit = 50): ExecutionRecord[] {
    const history = this.executionHistory.get(agentId) || []
    return history.slice(-limit).reverse() // Most recent first
  }

  getExecutionMetrics(agentId: string): ExecutionMetrics {
    return this.metricsCollector.getMetrics(agentId)
  }

  getActiveExecutions(): ActiveExecution[] {
    return Array.from(this.activeExecutions.values())
  }

  getAgentActiveExecution(agentId: string): ActiveExecution | null {
    return Array.from(this.activeExecutions.values())
      .find(exec => exec.agentId === agentId) || null
  }

  /**
   * Notification System
   * Requirement 4.6: Notification system for Agent failures and successes
   */
  private async sendNotification(
    agent: Agent, 
    type: 'success' | 'failure', 
    data: any
  ): Promise<void> {
    // In a real implementation, this would get notification config from agent or user settings
    const notificationConfig: NotificationConfig = {
      email: 'user@example.com', // Would be retrieved from user settings
      webhook: undefined,
      discord: undefined,
      slack: undefined
    }

    await this.notificationService.send(agent, type, data, notificationConfig)
  }

  /**
   * Utility Methods
   */
  private getRetryPolicy(agent: Agent): RetryPolicy {
    // In real implementation, this would come from agent configuration
    return {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 30000
    }
  }

  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateRetryId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.executionHistory.clear()
    this.activeExecutions.clear()
    this.retryQueues.clear()
  }
}

/**
 * Notification Service
 * Requirement 4.6: Notification system for Agent failures and successes
 */
class NotificationService {
  async send(
    agent: Agent, 
    type: 'success' | 'failure', 
    data: any, 
    config: NotificationConfig
  ): Promise<void> {
    const message = this.formatMessage(agent, type, data)

    // Send email notification
    if (config.email) {
      await this.sendEmail(config.email, message, type)
    }

    // Send webhook notification
    if (config.webhook) {
      await this.sendWebhook(config.webhook, { agent, type, data, message })
    }

    // Send Discord notification
    if (config.discord) {
      await this.sendDiscord(config.discord, message)
    }

    // Send Slack notification
    if (config.slack) {
      await this.sendSlack(config.slack, message)
    }
  }

  private formatMessage(agent: Agent, type: 'success' | 'failure', data: any): string {
    const timestamp = new Date().toISOString()
    
    if (type === 'success') {
      return `✅ Agent "${agent.name}" executed successfully at ${timestamp}\n` +
             `Execution ID: ${data.executionId}\n` +
             `Transaction ID: ${data.result?.transactionId || 'N/A'}\n` +
             `Gas Used: ${data.result?.gasUsed || 'N/A'}`
    } else {
      return `❌ Agent "${agent.name}" execution failed at ${timestamp}\n` +
             `Execution ID: ${data.executionId}\n` +
             `Error: ${data.error}\n` +
             `Retry Count: ${data.retryCount || 0}`
    }
  }

  private async sendEmail(email: string, message: string, type: string): Promise<void> {
    // Simulate email sending
    console.log(`📧 Email notification sent to ${email}:`, message)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async sendWebhook(url: string, payload: any): Promise<void> {
    // Simulate webhook sending
    console.log(`🔗 Webhook notification sent to ${url}:`, payload)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async sendDiscord(webhookUrl: string, message: string): Promise<void> {
    // Simulate Discord notification
    console.log(`💬 Discord notification sent:`, message)
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async sendSlack(webhookUrl: string, message: string): Promise<void> {
    // Simulate Slack notification
    console.log(`📱 Slack notification sent:`, message)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
}

/**
 * Execution Metrics Collector
 * Requirement 4.6: Execution tracking with success/failure metrics
 */
class ExecutionMetricsCollector {
  private metrics: Map<string, ExecutionMetrics> = new Map()

  recordSuccess(agentId: string, duration: number): void {
    const metrics = this.getOrCreateMetrics(agentId)
    metrics.totalExecutions++
    metrics.successfulExecutions++
    metrics.totalExecutionTime += duration
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalExecutions
    metrics.successRate = (metrics.successfulExecutions / metrics.totalExecutions) * 100
    metrics.lastExecution = new Date().toISOString()
  }

  recordFailure(agentId: string, duration: number): void {
    const metrics = this.getOrCreateMetrics(agentId)
    metrics.totalExecutions++
    metrics.failedExecutions++
    metrics.totalExecutionTime += duration
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalExecutions
    metrics.successRate = (metrics.successfulExecutions / metrics.totalExecutions) * 100
    metrics.lastExecution = new Date().toISOString()
    metrics.lastFailure = new Date().toISOString()
  }

  getMetrics(agentId: string): ExecutionMetrics {
    return this.getOrCreateMetrics(agentId)
  }

  private getOrCreateMetrics(agentId: string): ExecutionMetrics {
    if (!this.metrics.has(agentId)) {
      this.metrics.set(agentId, {
        agentId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        totalExecutionTime: 0,
        successRate: 100,
        lastExecution: null,
        lastFailure: null,
        uptime: 0
      })
    }
    return this.metrics.get(agentId)!
  }
}

/**
 * Supporting Interfaces
 */
export interface ExecutionRecord {
  id: string
  agentId: string
  startTime: string
  endTime: string
  duration: number // milliseconds
  status: 'success' | 'failed'
  result: ExecutionResult | null
  trigger?: { type: string; data?: any }
  retryCount: number
  error: {
    message: string
    stack?: string
    type: string
  } | null
}

export interface ActiveExecution {
  id: string
  agentId: string
  startTime: string
  status: 'running' | 'completed' | 'failed'
  trigger?: { type: string; data?: any }
  retryCount: number
  maxRetries: number
}

export interface ExecutionMetrics {
  agentId: string
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  averageExecutionTime: number // milliseconds
  totalExecutionTime: number
  successRate: number // percentage
  lastExecution: string | null
  lastFailure: string | null
  uptime: number // seconds
}

export interface RetryQueue {
  items: RetryItem[]
  isProcessing: boolean
}

export interface RetryItem {
  id: string
  agentId: string
  originalExecutionId: string
  scheduledTime: Date
  retryCount: number
  lastError: string
  agent: Agent
}

// Export singleton instance
export const agentExecutionService = new AgentExecutionService()