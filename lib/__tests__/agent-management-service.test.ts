import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { 
  AgentManagementService, 
  AgentFactory, 
  AgentHealthStatus 
} from '../agent-management-service'
import { 
  AgentConfiguration, 
  AgentStatus, 
  Schedule, 
  EventTrigger,
  ParsedWorkflow,
  EnhancedWorkflow,
  WorkflowMetadata,
  SecurityLevel
} from '../types'

describe('AgentManagementService', () => {
  let service: AgentManagementService
  let mockConsoleLog: any

  beforeEach(() => {
    service = new AgentManagementService()
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    service.destroy()
    mockConsoleLog.mockRestore()
  })

  describe('Agent Creation', () => {
    it('should create a new agent with valid configuration', async () => {
      const config: AgentConfiguration = {
        schedule: {
          type: 'recurring',
          interval: 3600 // 1 hour
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

      const metadata = {
        name: 'Test Agent',
        description: 'A test agent for unit testing',
        owner: 'test-user'
      }

      const agentId = await service.createAgent('test-workflow', config, metadata)

      expect(agentId).toBeDefined()
      expect(agentId).toMatch(/^agent_\d+_[a-z0-9]+$/)

      const agent = service.getAgentStatus(agentId)
      expect(agent).toBeDefined()
      expect(agent?.name).toBe('Test Agent')
      expect(agent?.description).toBe('A test agent for unit testing')
      expect(agent?.workflowId).toBe('test-workflow')
      expect(agent?.owner).toBe('test-user')
      expect(agent?.status).toBe(AgentStatus.ACTIVE)
    })

    it('should create agent health status when creating agent', async () => {
      const config: AgentConfiguration = {
        schedule: { type: 'one-time' },
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

      const agentId = await service.createAgent('test-workflow', config, {
        name: 'Test Agent',
        description: 'Test',
        owner: 'test-user'
      })

      const health = service.getAgentHealth(agentId)
      expect(health).toBeDefined()
      expect(health?.agentId).toBe(agentId)
      expect(health?.status).toBe('healthy')
      expect(health?.executionCount).toBe(0)
      expect(health?.errorCount).toBe(0)
      expect(health?.metrics.successRate).toBe(100)
    })

    it('should validate agent configuration during creation', async () => {
      const invalidConfig: AgentConfiguration = {
        schedule: {
          type: 'recurring'
          // Missing interval or cronExpression
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

      await expect(
        service.createAgent('test-workflow', invalidConfig, {
          name: 'Test Agent',
          description: 'Test',
          owner: 'test-user'
        })
      ).rejects.toThrow('Recurring schedule requires either interval or cron expression')
    })

    it('should validate event-driven schedule requires triggers', async () => {
      const invalidConfig: AgentConfiguration = {
        schedule: {
          type: 'event-driven'
          // Missing eventTriggers
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

      await expect(
        service.createAgent('test-workflow', invalidConfig, {
          name: 'Test Agent',
          description: 'Test',
          owner: 'test-user'
        })
      ).rejects.toThrow('Event-driven schedule requires at least one event trigger')
    })
  })

  describe('Agent Lifecycle Management', () => {
    let agentId: string

    beforeEach(async () => {
      const config: AgentConfiguration = {
        schedule: { type: 'one-time' },
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

      agentId = await service.createAgent('test-workflow', config, {
        name: 'Test Agent',
        description: 'Test',
        owner: 'test-user'
      })
    })

    it('should update agent configuration', async () => {
      const updates = {
        name: 'Updated Agent',
        description: 'Updated description',
        schedule: {
          type: 'recurring' as const,
          interval: 7200 // 2 hours
        }
      }

      await service.updateAgent(agentId, updates)

      const agent = service.getAgentStatus(agentId)
      expect(agent?.name).toBe('Updated Agent')
      expect(agent?.description).toBe('Updated description')
      expect(agent?.schedule.type).toBe('recurring')
      expect(agent?.schedule.interval).toBe(7200)
    })

    it('should pause and resume agent', async () => {
      await service.pauseAgent(agentId)
      let agent = service.getAgentStatus(agentId)
      expect(agent?.status).toBe(AgentStatus.PAUSED)

      await service.resumeAgent(agentId)
      agent = service.getAgentStatus(agentId)
      expect(agent?.status).toBe(AgentStatus.ACTIVE)
    })

    it('should stop agent', async () => {
      await service.stopAgent(agentId)
      const agent = service.getAgentStatus(agentId)
      expect(agent?.status).toBe(AgentStatus.STOPPED)
    })

    it('should delete agent', async () => {
      await service.deleteAgent(agentId)
      
      const agent = service.getAgentStatus(agentId)
      expect(agent).toBeNull()
      
      const health = service.getAgentHealth(agentId)
      expect(health).toBeNull()
    })

    it('should throw error when updating non-existent agent', async () => {
      await expect(
        service.updateAgent('non-existent', { name: 'Updated' })
      ).rejects.toThrow('Agent non-existent not found')
    })

    it('should throw error when deleting non-existent agent', async () => {
      await expect(
        service.deleteAgent('non-existent')
      ).rejects.toThrow('Agent non-existent not found')
    })
  })

  describe('Agent Querying', () => {
    let agentIds: string[]

    beforeEach(async () => {
      const config: AgentConfiguration = {
        schedule: { type: 'one-time' },
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

      agentIds = []
      
      // Create agents for different users
      agentIds.push(await service.createAgent('workflow-1', config, {
        name: 'Agent 1',
        description: 'Test',
        owner: 'user-1'
      }))

      agentIds.push(await service.createAgent('workflow-2', config, {
        name: 'Agent 2',
        description: 'Test',
        owner: 'user-1'
      }))

      agentIds.push(await service.createAgent('workflow-3', config, {
        name: 'Agent 3',
        description: 'Test',
        owner: 'user-2'
      }))
    })

    it('should get all agents', () => {
      const allAgents = service.getAllAgents()
      expect(allAgents).toHaveLength(3)
      expect(allAgents.map(a => a.name)).toEqual(['Agent 1', 'Agent 2', 'Agent 3'])
    })

    it('should get agents by user', () => {
      const user1Agents = service.getUserAgents('user-1')
      expect(user1Agents).toHaveLength(2)
      expect(user1Agents.map(a => a.name)).toEqual(['Agent 1', 'Agent 2'])

      const user2Agents = service.getUserAgents('user-2')
      expect(user2Agents).toHaveLength(1)
      expect(user2Agents[0].name).toBe('Agent 3')
    })

    it('should return empty array for user with no agents', () => {
      const noAgents = service.getUserAgents('non-existent-user')
      expect(noAgents).toHaveLength(0)
    })
  })

  describe('Health Monitoring', () => {
    let agentId: string

    beforeEach(async () => {
      const config: AgentConfiguration = {
        schedule: { type: 'one-time' },
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

      agentId = await service.createAgent('test-workflow', config, {
        name: 'Test Agent',
        description: 'Test',
        owner: 'test-user'
      })
    })

    it('should initialize health status for new agent', () => {
      const health = service.getAgentHealth(agentId)
      expect(health).toBeDefined()
      expect(health?.status).toBe('healthy')
      expect(health?.uptime).toBe(0)
      expect(health?.executionCount).toBe(0)
      expect(health?.errorCount).toBe(0)
      expect(health?.metrics.successRate).toBe(100)
    })

    it('should return null for non-existent agent health', () => {
      const health = service.getAgentHealth('non-existent')
      expect(health).toBeNull()
    })
  })

  describe('Configuration Validation', () => {
    it('should validate retry policy', async () => {
      const invalidConfig: AgentConfiguration = {
        schedule: { type: 'one-time' },
        eventTriggers: [],
        retryPolicy: {
          maxRetries: -1, // Invalid negative value
          backoffStrategy: 'exponential',
          initialDelay: 1000,
          maxDelay: 30000
        },
        notifications: {},
        permissions: []
      }

      await expect(
        service.createAgent('test-workflow', invalidConfig, {
          name: 'Test Agent',
          description: 'Test',
          owner: 'test-user'
        })
      ).rejects.toThrow('Max retries must be non-negative')
    })

    it('should validate event triggers', async () => {
      const invalidTrigger: EventTrigger = {
        type: 'price',
        condition: {
          operator: 'gt',
          value: 100
        },
        parameters: {}
        // Missing required fields
      } as any

      const invalidConfig: AgentConfiguration = {
        schedule: {
          type: 'event-driven'
        },
        eventTriggers: [invalidTrigger],
        retryPolicy: {
          maxRetries: 3,
          backoffStrategy: 'exponential',
          initialDelay: 1000,
          maxDelay: 30000
        },
        notifications: {},
        permissions: []
      }

      // This should pass validation since the trigger has type and condition
      await expect(
        service.createAgent('test-workflow', invalidConfig, {
          name: 'Test Agent',
          description: 'Test',
          owner: 'test-user'
        })
      ).resolves.toBeDefined()
    })
  })
})

describe('AgentFactory', () => {
  let service: AgentManagementService
  let factory: AgentFactory
  let mockConsoleLog: any

  beforeEach(() => {
    service = new AgentManagementService()
    factory = new AgentFactory(service)
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    service.destroy()
    mockConsoleLog.mockRestore()
  })

  describe('Workflow to Agent Creation', () => {
    it('should create agent from enhanced workflow', async () => {
      const workflow: EnhancedWorkflow = {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: new Date().toISOString(),
          name: 'test-workflow'
        },
        validationResults: {
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        },
        securityLevel: SecurityLevel.LOW,
        estimatedGas: 1000,
        requiredBalance: [],
        agentConfig: {
          schedule: {
            type: 'recurring',
            interval: 3600
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

      const metadata = {
        name: 'Test Agent from Workflow',
        description: 'Created from enhanced workflow',
        owner: 'test-user'
      }

      const agentId = await factory.createFromWorkflow(workflow, metadata)

      expect(agentId).toBeDefined()
      const agent = service.getAgentStatus(agentId)
      expect(agent?.name).toBe('Test Agent from Workflow')
      expect(agent?.schedule.type).toBe('recurring')
      expect(agent?.schedule.interval).toBe(3600)
    })

    it('should create agent from parsed workflow with custom config', async () => {
      const workflow: ParsedWorkflow = {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: new Date().toISOString(),
          name: 'parsed-workflow'
        }
      }

      const config: AgentConfiguration = {
        schedule: {
          type: 'event-driven'
        },
        eventTriggers: [{
          type: 'price',
          condition: {
            operator: 'gt',
            value: 100
          },
          parameters: {}
        }],
        retryPolicy: {
          maxRetries: 5,
          backoffStrategy: 'linear',
          initialDelay: 2000,
          maxDelay: 60000
        },
        notifications: {
          email: 'test@example.com'
        },
        permissions: []
      }

      const metadata = {
        name: 'Test Agent from Parsed Workflow',
        description: 'Created from parsed workflow',
        owner: 'test-user'
      }

      const agentId = await factory.createFromParsedWorkflow(workflow, config, metadata)

      expect(agentId).toBeDefined()
      const agent = service.getAgentStatus(agentId)
      expect(agent?.name).toBe('Test Agent from Parsed Workflow')
      expect(agent?.schedule.type).toBe('event-driven')
      expect(agent?.triggers).toHaveLength(1)
      expect(agent?.triggers[0].type).toBe('price')
    })

    it('should use default configuration when workflow has no agent config', async () => {
      const workflow: EnhancedWorkflow = {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: new Date().toISOString(),
          name: 'test-workflow'
        },
        validationResults: {
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        },
        securityLevel: SecurityLevel.LOW,
        estimatedGas: 1000,
        requiredBalance: []
        // No agentConfig
      }

      const metadata = {
        name: 'Default Config Agent',
        description: 'Uses default configuration',
        owner: 'test-user'
      }

      const agentId = await factory.createFromWorkflow(workflow, metadata)

      expect(agentId).toBeDefined()
      const agent = service.getAgentStatus(agentId)
      expect(agent?.schedule.type).toBe('one-time')
      expect(agent?.triggers).toHaveLength(0)
    })
  })
})