import { 
  Schedule, 
  EventTrigger, 
  TriggerCondition, 
  Agent 
} from './types'

/**
 * Agent Scheduling and Event Trigger System
 * 
 * Provides comprehensive scheduling and event monitoring capabilities:
 * - Schedule parser for cron expressions and intervals
 * - Event monitoring system for oracle-based triggers
 * - Trigger condition evaluation and execution logic
 * 
 * Requirements: 4.2, 4.3
 */
export class AgentSchedulingService {
  private scheduledJobs: Map<string, ScheduledJob> = new Map()
  private eventMonitors: Map<string, EventMonitor> = new Map()
  private oracleConnections: Map<string, OracleConnection> = new Map()
  private isRunning = false

  constructor() {
    this.startSchedulingEngine()
  }

  /**
   * Schedule Management
   * Requirement 4.2: Create schedule parser for cron expressions and intervals
   */
  scheduleAgent(agent: Agent): void {
    const jobId = `agent_${agent.id}`
    
    // Remove existing schedule if any
    this.unscheduleAgent(agent.id)

    const job: ScheduledJob = {
      id: jobId,
      agentId: agent.id,
      schedule: agent.schedule,
      lastExecution: null,
      nextExecution: this.calculateNextExecution(agent.schedule),
      executionCount: 0,
      isActive: true
    }

    this.scheduledJobs.set(jobId, job)

    // Set up event triggers if any
    if (agent.triggers && agent.triggers.length > 0) {
      this.setupEventTriggers(agent)
    }
  }

  unscheduleAgent(agentId: string): void {
    const jobId = `agent_${agentId}`
    this.scheduledJobs.delete(jobId)
    
    // Clean up event monitors
    const monitorId = `monitor_${agentId}`
    const monitor = this.eventMonitors.get(monitorId)
    if (monitor) {
      this.stopEventMonitor(monitorId)
    }
  }

  /**
   * Cron Expression Parser
   * Requirement 4.2: Schedule parser for cron expressions and intervals
   */
  private calculateNextExecution(schedule: Schedule): Date {
    const now = new Date()

    switch (schedule.type) {
      case 'one-time':
        return schedule.startTime ? new Date(schedule.startTime) : now

      case 'recurring':
        if (schedule.interval) {
          // Interval-based scheduling (seconds)
          return new Date(now.getTime() + schedule.interval * 1000)
        } else if (schedule.cronExpression) {
          // Cron expression parsing
          return this.parseCronExpression(schedule.cronExpression, now)
        }
        throw new Error('Recurring schedule requires interval or cron expression')

      case 'event-driven':
        // Event-driven schedules don't have fixed next execution times
        return new Date(now.getTime() + 24 * 60 * 60 * 1000) // Check daily

      default:
        throw new Error(`Unsupported schedule type: ${schedule.type}`)
    }
  }

  /**
   * Cron Expression Parser
   * Supports basic cron format: minute hour day month dayOfWeek
   */
  private parseCronExpression(cronExpression: string, fromDate: Date): Date {
    const parts = cronExpression.trim().split(/\s+/)
    if (parts.length !== 5) {
      throw new Error('Cron expression must have 5 parts: minute hour day month dayOfWeek')
    }

    const [minute, hour, day, month, dayOfWeek] = parts
    const next = new Date(fromDate)

    // Simple cron parsing - supports basic patterns
    if (minute !== '*') {
      const minuteValue = parseInt(minute)
      if (isNaN(minuteValue) || minuteValue < 0 || minuteValue > 59) {
        throw new Error('Invalid minute in cron expression')
      }
      next.setMinutes(minuteValue)
    }

    if (hour !== '*') {
      const hourValue = parseInt(hour)
      if (isNaN(hourValue) || hourValue < 0 || hourValue > 23) {
        throw new Error('Invalid hour in cron expression')
      }
      next.setHours(hourValue)
    }

    if (day !== '*') {
      const dayValue = parseInt(day)
      if (isNaN(dayValue) || dayValue < 1 || dayValue > 31) {
        throw new Error('Invalid day in cron expression')
      }
      next.setDate(dayValue)
    }

    if (month !== '*') {
      const monthValue = parseInt(month)
      if (isNaN(monthValue) || monthValue < 1 || monthValue > 12) {
        throw new Error('Invalid month in cron expression')
      }
      next.setMonth(monthValue - 1) // JavaScript months are 0-indexed
    }

    // Ensure next execution is in the future
    if (next <= fromDate) {
      // Add appropriate time unit to move to next occurrence
      if (minute !== '*' && hour === '*') {
        next.setHours(next.getHours() + 1)
      } else if (hour !== '*' && day === '*') {
        next.setDate(next.getDate() + 1)
      } else if (day !== '*' && month === '*') {
        next.setMonth(next.getMonth() + 1)
      } else {
        next.setFullYear(next.getFullYear() + 1)
      }
    }

    return next
  }

  /**
   * Event Trigger System
   * Requirement 4.3: Event monitoring system for oracle-based triggers
   */
  private setupEventTriggers(agent: Agent): void {
    const monitorId = `monitor_${agent.id}`
    
    const monitor: EventMonitor = {
      id: monitorId,
      agentId: agent.id,
      triggers: agent.triggers,
      isActive: true,
      lastCheck: new Date().toISOString(),
      triggerStates: new Map()
    }

    // Initialize trigger states
    for (const trigger of agent.triggers) {
      monitor.triggerStates.set(trigger.type, {
        lastValue: null,
        lastCheck: new Date().toISOString(),
        conditionMet: false
      })
    }

    this.eventMonitors.set(monitorId, monitor)

    // Set up oracle connections for triggers that need them
    this.setupOracleConnections(agent.triggers)
  }

  private setupOracleConnections(triggers: EventTrigger[]): void {
    for (const trigger of triggers) {
      if (trigger.oracleAction) {
        const connectionId = `oracle_${trigger.oracleAction}`
        
        if (!this.oracleConnections.has(connectionId)) {
          const connection: OracleConnection = {
            id: connectionId,
            oracleActionId: trigger.oracleAction,
            isConnected: false,
            lastUpdate: null,
            data: null,
            subscribers: new Set()
          }

          this.oracleConnections.set(connectionId, connection)
          this.connectToOracle(connection)
        }

        // Subscribe trigger to oracle updates
        const connection = this.oracleConnections.get(connectionId)!
        connection.subscribers.add(trigger.type)
      }
    }
  }

  private async connectToOracle(connection: OracleConnection): Promise<void> {
    try {
      // Simulate oracle connection
      console.log(`Connecting to oracle for action: ${connection.oracleActionId}`)
      
      // In real implementation, this would:
      // 1. Connect to the oracle Action on Flow blockchain
      // 2. Set up event listeners for data updates
      // 3. Handle connection failures and reconnection
      
      connection.isConnected = true
      connection.lastUpdate = new Date().toISOString()
      
      // Simulate periodic data updates
      this.startOracleDataSimulation(connection)
      
    } catch (error) {
      console.error(`Failed to connect to oracle ${connection.id}:`, error)
      connection.isConnected = false
    }
  }

  private startOracleDataSimulation(connection: OracleConnection): void {
    // Simulate oracle data updates every 30 seconds
    setInterval(() => {
      if (connection.isConnected) {
        // Simulate price data for price triggers
        connection.data = {
          price: Math.random() * 1000 + 100, // Random price between 100-1100
          timestamp: new Date().toISOString(),
          source: 'simulated_oracle'
        }
        connection.lastUpdate = new Date().toISOString()
        
        // Notify subscribers
        this.notifyOracleSubscribers(connection)
      }
    }, 30000)
  }

  private notifyOracleSubscribers(connection: OracleConnection): void {
    for (const subscriberType of connection.subscribers) {
      // Find monitors that have triggers of this type
      for (const [monitorId, monitor] of this.eventMonitors) {
        const trigger = monitor.triggers.find(t => t.type === subscriberType)
        if (trigger && trigger.oracleAction === connection.oracleActionId) {
          this.evaluateTriggerCondition(monitor, trigger, connection.data)
        }
      }
    }
  }

  /**
   * Trigger Condition Evaluation
   * Requirement 4.3: Trigger condition evaluation and execution logic
   */
  private evaluateTriggerCondition(
    monitor: EventMonitor, 
    trigger: EventTrigger, 
    data: any
  ): void {
    const triggerState = monitor.triggerStates.get(trigger.type)
    if (!triggerState) return

    let currentValue: any
    let conditionMet = false

    // Extract relevant value based on trigger type
    switch (trigger.type) {
      case 'price':
        currentValue = data?.price
        break
      case 'balance':
        currentValue = data?.balance
        break
      case 'time':
        currentValue = new Date().getTime()
        break
      case 'custom':
        currentValue = data?.value
        break
      default:
        console.warn(`Unknown trigger type: ${trigger.type}`)
        return
    }

    if (currentValue !== null && currentValue !== undefined) {
      conditionMet = this.evaluateCondition(trigger.condition, currentValue)
    }

    // Update trigger state
    triggerState.lastValue = currentValue
    triggerState.lastCheck = new Date().toISOString()
    triggerState.conditionMet = conditionMet

    // If condition is met, trigger agent execution
    if (conditionMet) {
      this.triggerAgentExecution(monitor.agentId, trigger)
    }
  }

  private evaluateCondition(condition: TriggerCondition, value: any): boolean {
    const { operator, value: targetValue, tolerance = 0 } = condition

    switch (operator) {
      case 'gt':
        return value > targetValue
      case 'gte':
        return value >= targetValue
      case 'lt':
        return value < targetValue
      case 'lte':
        return value <= targetValue
      case 'eq':
        // Use tolerance for floating point comparisons
        return Math.abs(value - targetValue) <= tolerance
      default:
        console.warn(`Unknown condition operator: ${operator}`)
        return false
    }
  }

  private async triggerAgentExecution(agentId: string, trigger: EventTrigger): Promise<void> {
    console.log(`Triggering execution for agent ${agentId} due to ${trigger.type} trigger`)
    
    // In real implementation, this would:
    // 1. Load the agent's workflow
    // 2. Execute the workflow on the blockchain
    // 3. Handle execution results and errors
    // 4. Update execution metrics
    
    // For now, just log the trigger
    const monitor = Array.from(this.eventMonitors.values())
      .find(m => m.agentId === agentId)
    
    if (monitor) {
      console.log(`Agent ${agentId} triggered by ${trigger.type} condition:`, trigger.condition)
    }
  }

  /**
   * Scheduling Engine
   * Main loop that checks for scheduled executions
   */
  private startSchedulingEngine(): void {
    if (this.isRunning) return

    this.isRunning = true
    
    // Check for scheduled executions every 10 seconds
    setInterval(() => {
      this.processScheduledJobs()
    }, 10000)

    // Check event triggers every 5 seconds
    setInterval(() => {
      this.processEventTriggers()
    }, 5000)
  }

  private processScheduledJobs(): void {
    const now = new Date()

    for (const [jobId, job] of this.scheduledJobs) {
      if (!job.isActive) continue

      if (job.nextExecution && now >= job.nextExecution) {
        this.executeScheduledJob(job)
      }
    }
  }

  private async executeScheduledJob(job: ScheduledJob): Promise<void> {
    console.log(`Executing scheduled job for agent ${job.agentId}`)
    
    try {
      // Update execution tracking
      job.lastExecution = new Date().toISOString()
      job.executionCount++

      // Calculate next execution for recurring jobs
      if (job.schedule.type === 'recurring') {
        job.nextExecution = this.calculateNextExecution(job.schedule)
      } else if (job.schedule.type === 'one-time') {
        // One-time jobs are deactivated after execution
        job.isActive = false
      }

      // In real implementation, execute the agent's workflow here
      
    } catch (error) {
      console.error(`Failed to execute scheduled job ${job.id}:`, error)
    }
  }

  private processEventTriggers(): void {
    // Process time-based triggers that don't need oracle data
    for (const [monitorId, monitor] of this.eventMonitors) {
      if (!monitor.isActive) continue

      for (const trigger of monitor.triggers) {
        if (trigger.type === 'time') {
          this.evaluateTriggerCondition(monitor, trigger, {
            timestamp: new Date().toISOString()
          })
        }
      }
    }
  }

  private stopEventMonitor(monitorId: string): void {
    const monitor = this.eventMonitors.get(monitorId)
    if (monitor) {
      monitor.isActive = false
      this.eventMonitors.delete(monitorId)
    }
  }

  /**
   * Query Methods
   */
  getScheduledJob(agentId: string): ScheduledJob | null {
    const jobId = `agent_${agentId}`
    return this.scheduledJobs.get(jobId) || null
  }

  getEventMonitor(agentId: string): EventMonitor | null {
    const monitorId = `monitor_${agentId}`
    return this.eventMonitors.get(monitorId) || null
  }

  getAllScheduledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values())
  }

  getActiveEventMonitors(): EventMonitor[] {
    return Array.from(this.eventMonitors.values()).filter(m => m.isActive)
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.isRunning = false
    this.scheduledJobs.clear()
    this.eventMonitors.clear()
    this.oracleConnections.clear()
  }
}

/**
 * Supporting Interfaces
 */
export interface ScheduledJob {
  id: string
  agentId: string
  schedule: Schedule
  lastExecution: string | null
  nextExecution: Date | null
  executionCount: number
  isActive: boolean
}

export interface EventMonitor {
  id: string
  agentId: string
  triggers: EventTrigger[]
  isActive: boolean
  lastCheck: string
  triggerStates: Map<string, TriggerState>
}

export interface TriggerState {
  lastValue: any
  lastCheck: string
  conditionMet: boolean
}

export interface OracleConnection {
  id: string
  oracleActionId: string
  isConnected: boolean
  lastUpdate: string | null
  data: any
  subscribers: Set<string>
}

/**
 * Cron Expression Utilities
 */
export class CronExpressionValidator {
  static validate(cronExpression: string): { isValid: boolean; error?: string } {
    try {
      const parts = cronExpression.trim().split(/\s+/)
      
      if (parts.length !== 5) {
        return { isValid: false, error: 'Cron expression must have 5 parts' }
      }

      const [minute, hour, day, month, dayOfWeek] = parts

      // Validate minute (0-59)
      if (!this.validateCronField(minute, 0, 59)) {
        return { isValid: false, error: 'Invalid minute field' }
      }

      // Validate hour (0-23)
      if (!this.validateCronField(hour, 0, 23)) {
        return { isValid: false, error: 'Invalid hour field' }
      }

      // Validate day (1-31)
      if (!this.validateCronField(day, 1, 31)) {
        return { isValid: false, error: 'Invalid day field' }
      }

      // Validate month (1-12)
      if (!this.validateCronField(month, 1, 12)) {
        return { isValid: false, error: 'Invalid month field' }
      }

      // Validate day of week (0-7, where 0 and 7 are Sunday)
      if (!this.validateCronField(dayOfWeek, 0, 7)) {
        return { isValid: false, error: 'Invalid day of week field' }
      }

      return { isValid: true }
    } catch (error) {
      return { isValid: false, error: 'Invalid cron expression format' }
    }
  }

  private static validateCronField(field: string, min: number, max: number): boolean {
    if (field === '*') return true
    
    // Handle ranges (e.g., "1-5")
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number)
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end
    }

    // Handle lists (e.g., "1,3,5")
    if (field.includes(',')) {
      const values = field.split(',').map(Number)
      return values.every(val => !isNaN(val) && val >= min && val <= max)
    }

    // Handle step values (e.g., "*/5")
    if (field.includes('/')) {
      const [range, step] = field.split('/')
      const stepNum = Number(step)
      if (isNaN(stepNum) || stepNum <= 0) return false
      
      if (range === '*') return true
      return this.validateCronField(range, min, max)
    }

    // Handle single number
    const num = Number(field)
    return !isNaN(num) && num >= min && num <= max
  }

  static getNextExecution(cronExpression: string, fromDate?: Date): Date {
    const service = new AgentSchedulingService()
    const schedule: Schedule = {
      type: 'recurring',
      cronExpression
    }
    
    try {
      return (service as any).calculateNextExecution(schedule)
    } finally {
      service.destroy()
    }
  }
}

// Export singleton instance
export const agentSchedulingService = new AgentSchedulingService()