import { 
  Agent, 
  AgentConfiguration, 
  AgentStatus, 
  Schedule, 
  EventTrigger, 
  ParsedWorkflow,
  EnhancedWorkflow,
  RetryPolicy,
  NotificationConfig,
  Permission
} from './types'

/**
 * Agent Management Service
 * 
 * Provides comprehensive Agent lifecycle management including:
 * - Agent resource factory for workflow deployment
 * - Agent lifecycle management (create, update, delete)
 * - Agent status monitoring and health checking
 * 
 * Requirements: 4.1, 4.4, 4.6
 */
export class AgentManagementService {
  private agents: Map<string, Agent> = new Map()
  private agentHealthStatus: Map<string, AgentHealthStatus> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  constructor() {
    this.startHealthMonitoring()
  }

  /**
   * Agent Resource Factory - Creates new Agent from workflow
   * Requirement 4.1: Agent deployment with scheduling logic
   */
  async createAgent(
    workflowId: string,
    config: AgentConfiguration,
    metadata: {
      name: string
      description: string
      owner: string
    }
  ): Promise<string> {
    const agentId = this.generateAgentId()
    
    // Validate configuration
    this.validateAgentConfiguration(config)
    
    // Create Agent resource
    const agent: Agent = {
      id: agentId,
      name: metadata.name,
      description: metadata.description,
      workflowId,
      schedule: config.schedule,
      triggers: config.eventTriggers,
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: metadata.owner
    }

    // Store Agent
    this.agents.set(agentId, agent)
    
    // Initialize health status
    this.agentHealthStatus.set(agentId, {
      agentId,
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      uptime: 0,
      executionCount: 0,
      errorCount: 0,
      lastExecution: null,
      lastError: null,
      metrics: {
        averageExecutionTime: 0,
        successRate: 100,
        resourceUsage: {
          memory: 0,
          cpu: 0
        }
      }
    })

    // Deploy Agent to blockchain (simulated for now)
    await this.deployAgentToBlockchain(agent)

    return agentId
  }

  /**
   * Agent Lifecycle Management - Update existing Agent
   * Requirement 4.1: Agent lifecycle management
   */
  async updateAgent(agentId: string, updates: Partial<AgentConfiguration & { name?: string; description?: string }>): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    // Update Agent properties
    if (updates.name) agent.name = updates.name
    if (updates.description) agent.description = updates.description
    if (updates.schedule) agent.schedule = updates.schedule
    if (updates.eventTriggers) agent.triggers = updates.eventTriggers

    agent.updatedAt = new Date().toISOString()

    // Validate updated configuration
    const config: AgentConfiguration = {
      schedule: agent.schedule,
      eventTriggers: agent.triggers,
      retryPolicy: updates.retryPolicy || this.getDefaultRetryPolicy(),
      notifications: updates.notifications || {},
      permissions: updates.permissions || []
    }
    this.validateAgentConfiguration(config)

    // Update Agent on blockchain
    await this.updateAgentOnBlockchain(agent)
  }

  /**
   * Agent Lifecycle Management - Delete Agent
   * Requirement 4.1: Agent lifecycle management
   */
  async deleteAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    // Stop Agent execution
    await this.stopAgent(agentId)

    // Remove from blockchain
    await this.removeAgentFromBlockchain(agentId)

    // Clean up local storage
    this.agents.delete(agentId)
    this.agentHealthStatus.delete(agentId)
  }

  /**
   * Agent Status Management
   * Requirement 4.4: Agent status monitoring
   */
  async pauseAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    agent.status = AgentStatus.PAUSED
    agent.updatedAt = new Date().toISOString()

    await this.updateAgentOnBlockchain(agent)
  }

  async resumeAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    agent.status = AgentStatus.ACTIVE
    agent.updatedAt = new Date().toISOString()

    await this.updateAgentOnBlockchain(agent)
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    agent.status = AgentStatus.STOPPED
    agent.updatedAt = new Date().toISOString()

    await this.updateAgentOnBlockchain(agent)
  }

  /**
   * Agent Health Monitoring
   * Requirement 4.6: Agent status monitoring and health checking
   */
  getAgentStatus(agentId: string): Agent | null {
    return this.agents.get(agentId) || null
  }

  getAgentHealth(agentId: string): AgentHealthStatus | null {
    return this.agentHealthStatus.get(agentId) || null
  }

  getAllAgents(): Agent[] {
    return Array.from(this.agents.values())
  }

  getUserAgents(userId: string): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.owner === userId)
  }

  /**
   * Health Monitoring System
   * Requirement 4.6: Agent status monitoring and health checking
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks()
    }, this.HEALTH_CHECK_INTERVAL)
  }

  private async performHealthChecks(): Promise<void> {
    for (const [agentId, agent] of this.agents) {
      try {
        const healthStatus = await this.checkAgentHealth(agentId)
        this.agentHealthStatus.set(agentId, healthStatus)

        // Update Agent status if health check indicates issues
        if (healthStatus.status === 'unhealthy' && agent.status === AgentStatus.ACTIVE) {
          agent.status = AgentStatus.ERROR
          agent.updatedAt = new Date().toISOString()
        }
      } catch (error) {
        console.error(`Health check failed for Agent ${agentId}:`, error)
      }
    }
  }

  private async checkAgentHealth(agentId: string): Promise<AgentHealthStatus> {
    const currentHealth = this.agentHealthStatus.get(agentId)
    const agent = this.agents.get(agentId)
    
    if (!agent || !currentHealth) {
      throw new Error(`Agent ${agentId} not found`)
    }

    // Simulate health check (in real implementation, this would check blockchain state)
    const now = new Date().toISOString()
    const uptime = currentHealth.uptime + this.HEALTH_CHECK_INTERVAL / 1000

    // Determine health status based on various factors
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    
    if (currentHealth.errorCount > 5) {
      status = 'unhealthy'
    } else if (currentHealth.metrics.successRate < 80) {
      status = 'degraded'
    }

    return {
      ...currentHealth,
      status,
      lastCheck: now,
      uptime,
      metrics: {
        ...currentHealth.metrics,
        successRate: this.calculateSuccessRate(currentHealth)
      }
    }
  }

  private calculateSuccessRate(health: AgentHealthStatus): number {
    const total = health.executionCount
    const errors = health.errorCount
    
    if (total === 0) return 100
    return Math.round(((total - errors) / total) * 100)
  }

  /**
   * Agent Configuration Validation
   */
  private validateAgentConfiguration(config: AgentConfiguration): void {
    // Validate schedule
    if (!config.schedule) {
      throw new Error('Agent schedule is required')
    }

    if (config.schedule.type === 'recurring' && !config.schedule.interval && !config.schedule.cronExpression) {
      throw new Error('Recurring schedule requires either interval or cron expression')
    }

    if (config.schedule.type === 'event-driven' && (!config.eventTriggers || config.eventTriggers.length === 0)) {
      throw new Error('Event-driven schedule requires at least one event trigger')
    }

    // Validate event triggers
    for (const trigger of config.eventTriggers) {
      if (!trigger.type || !trigger.condition) {
        throw new Error('Event trigger must have type and condition')
      }
    }

    // Validate retry policy
    if (config.retryPolicy) {
      if (config.retryPolicy.maxRetries < 0) {
        throw new Error('Max retries must be non-negative')
      }
      if (config.retryPolicy.initialDelay < 0) {
        throw new Error('Initial delay must be non-negative')
      }
    }
  }

  /**
   * Blockchain Integration (Simulated)
   */
  private async deployAgentToBlockchain(agent: Agent): Promise<void> {
    // Simulate blockchain deployment
    console.log(`Deploying Agent ${agent.id} to blockchain...`)
    
    // In real implementation, this would:
    // 1. Generate Cadence code for Agent resource
    // 2. Deploy Agent contract to Flow blockchain
    // 3. Set up scheduling and trigger mechanisms
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.log(`Agent ${agent.id} deployed successfully`)
  }

  private async updateAgentOnBlockchain(agent: Agent): Promise<void> {
    // Simulate blockchain update
    console.log(`Updating Agent ${agent.id} on blockchain...`)
    await new Promise(resolve => setTimeout(resolve, 500))
    console.log(`Agent ${agent.id} updated successfully`)
  }

  private async removeAgentFromBlockchain(agentId: string): Promise<void> {
    // Simulate blockchain removal
    console.log(`Removing Agent ${agentId} from blockchain...`)
    await new Promise(resolve => setTimeout(resolve, 500))
    console.log(`Agent ${agentId} removed successfully`)
  }

  /**
   * Utility Methods
   */
  private generateAgentId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getDefaultRetryPolicy(): RetryPolicy {
    return {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 30000
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }
}

/**
 * Agent Health Status Interface
 */
export interface AgentHealthStatus {
  agentId: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: string
  uptime: number // seconds
  executionCount: number
  errorCount: number
  lastExecution: string | null
  lastError: string | null
  metrics: {
    averageExecutionTime: number // milliseconds
    successRate: number // percentage
    resourceUsage: {
      memory: number // MB
      cpu: number // percentage
    }
  }
}

/**
 * Agent Factory - Convenience class for creating Agents from workflows
 */
export class AgentFactory {
  constructor(private agentService: AgentManagementService) {}

  /**
   * Create Agent from Enhanced Workflow
   * Requirement 4.1: Agent resource factory for workflow deployment
   */
  async createFromWorkflow(
    workflow: EnhancedWorkflow,
    metadata: {
      name: string
      description: string
      owner: string
    }
  ): Promise<string> {
    // Use existing agent configuration from workflow or create default
    const config = workflow.agentConfig || this.createDefaultConfiguration()
    
    return await this.agentService.createAgent(
      workflow.metadata.name || 'unnamed_workflow',
      config,
      metadata
    )
  }

  /**
   * Create Agent from Parsed Workflow with custom configuration
   */
  async createFromParsedWorkflow(
    workflow: ParsedWorkflow,
    config: AgentConfiguration,
    metadata: {
      name: string
      description: string
      owner: string
    }
  ): Promise<string> {
    return await this.agentService.createAgent(
      workflow.metadata.name || 'unnamed_workflow',
      config,
      metadata
    )
  }

  private createDefaultConfiguration(): AgentConfiguration {
    return {
      schedule: {
        type: 'one-time'
      },
      eventTriggers: [],
      retryPolicy: {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000
      },
      notifications: {},
      permissions: []
    }
  }
}

// Export singleton instance
export const agentManagementService = new AgentManagementService()
export const agentFactory = new AgentFactory(agentManagementService)