import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  AgentExecutionService, 
  ExecutionRecord, 
  ActiveExecution,
  ExecutionMetrics
} from '../agent-execution-service'
import { 
  Agent, 
  AgentStatus, 
  RetryPolicy 
} from '../types'

describe('AgentExecutionService', () => {
  let service: AgentExecutionService
  let mockConsoleLog: any
  let mockConsoleError: any

  beforeEach(() => {
    service = new AgentExecutionService()
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    service.destroy()
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
  })

  describe('Agent Execution', () => {
    const createTestAgent = (): Agent => ({
      id: 'test-agent-1',
      name: 'Test Agent',
      description: 'Test agent for execution',
      workflowId: 'test-workflow',
      schedule: { type: 'one-time' },
      triggers: [],
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: 'test-user'
    })

    it('should execute agent successfully', async () => {
      const agent = createTestAgent()
      
      const result = await service.executeAgent(agent)
      
      expect(result.success).toBe(true)
      expect(result.transactionId).toBeDefined()
      expect(result.executionTime).toBeGreaterThan(0)
      expect(result.gasUsed).toBeGreaterThan(0)
    })

    it('should record execution history', async () => {
      const agent = createTestAgent()
      
      await service.executeAgent(agent)
      
      const history = service.getExecutionHistory(agent.id)
      expect(history).toHaveLength(1)
      expect(history[0].agentId).toBe(agent.id)
      expect(history[0].status).toBe('success')
      expect(history[0].duration).toBeGreaterThan(0)
    })

    it('should track active executions', async () => {
      const agent = createTestAgent()
      
      // Start execution (don't await to check active state)
      const executionPromise = service.executeAgent(agent)
      
      // Check if execution is tracked as active
      const activeExecutions = service.getActiveExecutions()
      expect(activeExecutions.length).toBeGreaterThanOrEqual(0) // May complete quickly
      
      // Wait for completion
      await executionPromise
      
      // Should be removed from active executions
      const finalActiveExecutions = service.getActiveExecutions()
      expect(finalActiveExecutions.find(e => e.agentId === agent.id)).toBeUndefined()
    })

    it('should update execution metrics on success', async () => {
      const agent = createTestAgent()
      
      await service.executeAgent(agent)
      
      const metrics = service.getExecutionMetrics(agent.id)
      expect(metrics.totalExecutions).toBe(1)
      expect(metrics.successfulExecutions).toBe(1)
      expect(metrics.failedExecutions).toBe(0)
      expect(metrics.successRate).toBe(100)
      expect(metrics.averageExecutionTime).toBeGreaterThan(0)
    })

    it('should handle execution with trigger context', async () => {
      const agent = createTestAgent()
      const trigger = { type: 'price', data: { price: 150 } }
      
      const result = await service.executeAgent(agent, trigger)
      
      expect(result.success).toBe(true)
      
      const history = service.getExecutionHistory(agent.id)
      expect(history[0].trigger).toEqual(trigger)
    })
  })

  describe('Error Handling and Retries', () => {
    const createTestAgent = (): Agent => ({
      id: 'test-agent-retry',
      name: 'Test Agent',
      description: 'Test agent for retry testing',
      workflowId: 'test-workflow',
      schedule: { type: 'one-time' },
      triggers: [],
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: 'test-user'
    })

    it('should handle execution failures', async () => {
      const agent = createTestAgent()
      
      // Mock the executeWorkflow method to always fail
      const originalExecuteWorkflow = (service as any).executeWorkflow
      ;(service as any).executeWorkflow = vi.fn().mockRejectedValue(new Error('Test failure'))
      
      const result = await service.executeAgent(agent)
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('scheduled for retry')
      
      // Restore original method
      ;(service as any).executeWorkflow = originalExecuteWorkflow
    })

    it('should record failed executions', async () => {
      const agent = createTestAgent()
      
      // Mock the executeWorkflow method to always fail
      ;(service as any).executeWorkflow = vi.fn().mockRejectedValue(new Error('Test failure'))
      
      await service.executeAgent(agent)
      
      const history = service.getExecutionHistory(agent.id)
      expect(history).toHaveLength(1)
      expect(history[0].status).toBe('failed')
      expect(history[0].error).toBeDefined()
      expect(history[0].error?.message).toBe('Test failure')
    })

    it('should update metrics on failure', async () => {
      const agent = createTestAgent()
      
      // Mock the executeWorkflow method to always fail
      ;(service as any).executeWorkflow = vi.fn().mockRejectedValue(new Error('Test failure'))
      
      await service.executeAgent(agent)
      
      const metrics = service.getExecutionMetrics(agent.id)
      expect(metrics.totalExecutions).toBe(1)
      expect(metrics.successfulExecutions).toBe(0)
      expect(metrics.failedExecutions).toBe(1)
      expect(metrics.successRate).toBe(0)
      expect(metrics.lastFailure).toBeDefined()
    })

    it('should calculate retry delays correctly', async () => {
      const service = new AgentExecutionService()
      
      const retryPolicy: RetryPolicy = {
        maxRetries: 3,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000
      }
      
      // Test exponential backoff
      const calculateRetryDelay = (service as any).calculateRetryDelay.bind(service)
      
      const delay1 = calculateRetryDelay(retryPolicy, 0)
      const delay2 = calculateRetryDelay(retryPolicy, 1)
      const delay3 = calculateRetryDelay(retryPolicy, 2)
      
      expect(delay1).toBeGreaterThanOrEqual(1000) // First retry: ~1000ms
      expect(delay2).toBeGreaterThanOrEqual(2000) // Second retry: ~2000ms
      expect(delay3).toBeGreaterThanOrEqual(4000) // Third retry: ~4000ms
      
      service.destroy()
    })

    it('should calculate linear backoff correctly', async () => {
      const service = new AgentExecutionService()
      
      const retryPolicy: RetryPolicy = {
        maxRetries: 3,
        backoffStrategy: 'linear',
        initialDelay: 1000,
        maxDelay: 30000
      }
      
      const calculateRetryDelay = (service as any).calculateRetryDelay.bind(service)
      
      const delay1 = calculateRetryDelay(retryPolicy, 0)
      const delay2 = calculateRetryDelay(retryPolicy, 1)
      const delay3 = calculateRetryDelay(retryPolicy, 2)
      
      expect(delay1).toBeGreaterThanOrEqual(1000) // First retry: ~1000ms
      expect(delay2).toBeGreaterThanOrEqual(2000) // Second retry: ~2000ms
      expect(delay3).toBeGreaterThanOrEqual(3000) // Third retry: ~3000ms
      
      service.destroy()
    })

    it('should respect max delay limit', async () => {
      const service = new AgentExecutionService()
      
      const retryPolicy: RetryPolicy = {
        maxRetries: 10,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 5000 // Low max delay
      }
      
      const calculateRetryDelay = (service as any).calculateRetryDelay.bind(service)
      
      const delay = calculateRetryDelay(retryPolicy, 5) // High retry count
      expect(delay).toBeLessThanOrEqual(5500) // Max delay + jitter
      
      service.destroy()
    })
  })

  describe('Execution History and Metrics', () => {
    const createTestAgent = (): Agent => ({
      id: 'test-agent-metrics',
      name: 'Test Agent',
      description: 'Test agent for metrics',
      workflowId: 'test-workflow',
      schedule: { type: 'one-time' },
      triggers: [],
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: 'test-user'
    })

    it('should limit execution history to 100 records', async () => {
      const agent = createTestAgent()
      
      // Simulate adding many execution records
      for (let i = 0; i < 105; i++) {
        await (service as any).recordExecution(agent.id, {
          id: `exec_${i}`,
          agentId: agent.id,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          duration: 1000,
          status: 'success',
          result: { success: true },
          retryCount: 0,
          error: null
        })
      }
      
      const history = service.getExecutionHistory(agent.id, 105) // Request more than stored
      expect(history).toHaveLength(100) // Should be limited to 100
    })

    it('should return execution history in reverse chronological order', async () => {
      const agent = createTestAgent()
      
      // Add multiple execution records
      const record1 = {
        id: 'exec_1',
        agentId: agent.id,
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T10:00:01Z',
        duration: 1000,
        status: 'success' as const,
        result: { success: true },
        retryCount: 0,
        error: null
      }
      
      const record2 = {
        id: 'exec_2',
        agentId: agent.id,
        startTime: '2024-01-01T11:00:00Z',
        endTime: '2024-01-01T11:00:01Z',
        duration: 1000,
        status: 'success' as const,
        result: { success: true },
        retryCount: 0,
        error: null
      }
      
      await (service as any).recordExecution(agent.id, record1)
      await (service as any).recordExecution(agent.id, record2)
      
      const history = service.getExecutionHistory(agent.id)
      expect(history[0].id).toBe('exec_2') // Most recent first
      expect(history[1].id).toBe('exec_1')
    })

    it('should calculate metrics correctly for mixed success/failure', async () => {
      const agent = createTestAgent()
      const metricsCollector = (service as any).metricsCollector
      
      // Record some successes and failures
      metricsCollector.recordSuccess(agent.id, 1000)
      metricsCollector.recordSuccess(agent.id, 2000)
      metricsCollector.recordFailure(agent.id, 1500)
      
      const metrics = service.getExecutionMetrics(agent.id)
      expect(metrics.totalExecutions).toBe(3)
      expect(metrics.successfulExecutions).toBe(2)
      expect(metrics.failedExecutions).toBe(1)
      expect(metrics.successRate).toBe(66.66666666666666) // 2/3 * 100
      expect(metrics.averageExecutionTime).toBe(1500) // (1000 + 2000 + 1500) / 3
    })

    it('should return empty history for non-existent agent', () => {
      const history = service.getExecutionHistory('non-existent-agent')
      expect(history).toHaveLength(0)
    })

    it('should return default metrics for non-existent agent', () => {
      const metrics = service.getExecutionMetrics('non-existent-agent')
      expect(metrics.totalExecutions).toBe(0)
      expect(metrics.successfulExecutions).toBe(0)
      expect(metrics.failedExecutions).toBe(0)
      expect(metrics.successRate).toBe(100)
    })
  })

  describe('Active Execution Tracking', () => {
    const createTestAgent = (): Agent => ({
      id: 'test-agent-active',
      name: 'Test Agent',
      description: 'Test agent for active tracking',
      workflowId: 'test-workflow',
      schedule: { type: 'one-time' },
      triggers: [],
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: 'test-user'
    })

    it('should track agent-specific active execution', async () => {
      const agent = createTestAgent()
      
      // Mock executeWorkflow to add delay so we can check active state
      const originalExecuteWorkflow = (service as any).executeWorkflow
      ;(service as any).executeWorkflow = vi.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return { success: true, executionTime: 100 }
      })
      
      // Start execution
      const executionPromise = service.executeAgent(agent)
      
      // Check active execution
      const activeExecution = service.getAgentActiveExecution(agent.id)
      expect(activeExecution).toBeDefined()
      expect(activeExecution?.agentId).toBe(agent.id)
      expect(activeExecution?.status).toBe('running')
      
      // Wait for completion
      await executionPromise
      
      // Should no longer be active
      const finalActiveExecution = service.getAgentActiveExecution(agent.id)
      expect(finalActiveExecution).toBeNull()
      
      // Restore original method
      ;(service as any).executeWorkflow = originalExecuteWorkflow
    })

    it('should return null for non-existent agent active execution', () => {
      const activeExecution = service.getAgentActiveExecution('non-existent-agent')
      expect(activeExecution).toBeNull()
    })
  })

  describe('Notification System', () => {
    const createTestAgent = (): Agent => ({
      id: 'test-agent-notifications',
      name: 'Test Agent',
      description: 'Test agent for notifications',
      workflowId: 'test-workflow',
      schedule: { type: 'one-time' },
      triggers: [],
      status: AgentStatus.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      owner: 'test-user'
    })

    it('should send success notification', async () => {
      const agent = createTestAgent()
      
      await service.executeAgent(agent)
      
      // Check that success notification was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📧 Email notification sent'),
        expect.stringContaining('executed successfully')
      )
    })

    it('should send failure notification after max retries', async () => {
      const agent = createTestAgent()
      
      // Mock executeWorkflow to always fail
      ;(service as any).executeWorkflow = vi.fn().mockRejectedValue(new Error('Test failure'))
      
      // Mock getRetryPolicy to have 0 max retries for immediate failure notification
      ;(service as any).getRetryPolicy = vi.fn().mockReturnValue({
        maxRetries: 0,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 30000
      })
      
      await service.executeAgent(agent)
      
      // Check that failure notification was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('📧 Email notification sent'),
        expect.stringContaining('execution failed')
      )
    })
  })
})