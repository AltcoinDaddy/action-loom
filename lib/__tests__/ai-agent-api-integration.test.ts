import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the services with proper implementations
vi.mock('@/lib/nlp-service', () => ({
  NLPService: vi.fn().mockImplementation(() => ({
    parseWorkflow: vi.fn().mockResolvedValue({
      confidence: 0.8,
      steps: [],
      ambiguities: [],
      suggestions: [],
      processingTime: 100
    })
  }))
}))

vi.mock('@/lib/action-mapping-service', () => ({
  ActionMappingService: vi.fn().mockImplementation(() => ({
    mapToWorkflow: vi.fn().mockResolvedValue({
      actions: [],
      executionOrder: [],
      rootActions: [],
      metadata: {
        totalActions: 0,
        totalConnections: 0,
        createdAt: new Date().toISOString()
      }
    })
  }))
}))

vi.mock('@/lib/enhanced-workflow-validator', () => ({
  EnhancedWorkflowValidator: vi.fn().mockImplementation(() => ({
    validateWorkflow: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      compatibilityIssues: []
    }),
    simulateExecution: vi.fn().mockResolvedValue({
      success: true,
      gasUsed: 1000,
      balanceChanges: [],
      events: [],
      errors: [],
      warnings: [],
      executionTime: 500
    })
  }))
}))

vi.mock('@/lib/cadence-generator', () => ({
  CadenceGenerator: vi.fn().mockImplementation(() => ({
    generateTransaction: vi.fn().mockReturnValue('transaction { execute { log("test") } }')
  }))
}))

vi.mock('@/lib/action-discovery-service', () => ({
  ActionDiscoveryService: vi.fn().mockImplementation(() => ({
    discoverActions: vi.fn().mockResolvedValue({
      actions: [],
      registries: [],
      lastUpdated: new Date().toISOString(),
      totalFound: 0,
      executionTime: 100
    }),
    searchActions: vi.fn().mockResolvedValue([]),
    getAction: vi.fn().mockResolvedValue(null),
    findSimilarActions: vi.fn().mockResolvedValue([]),
    getActionsByCategory: vi.fn().mockResolvedValue([]),
    validateAction: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      compatibilityIssues: []
    }),
    checkActionCompatibility: vi.fn().mockReturnValue([]),
    validateWorkflowChain: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      compatibilityIssues: []
    })
  }))
}))

vi.mock('@/lib/agent-management-service', () => ({
  agentManagementService: {
    getAllAgents: vi.fn().mockReturnValue([]),
    getUserAgents: vi.fn().mockReturnValue([]),
    getAgentStatus: vi.fn().mockReturnValue(null),
    getAgentHealth: vi.fn().mockReturnValue({
      status: 'healthy',
      uptime: 100,
      lastExecution: new Date().toISOString()
    }),
    createAgent: vi.fn().mockResolvedValue('agent-123'),
    updateAgent: vi.fn().mockResolvedValue(undefined),
    deleteAgent: vi.fn().mockResolvedValue(undefined),
    pauseAgent: vi.fn().mockResolvedValue(undefined),
    resumeAgent: vi.fn().mockResolvedValue(undefined),
    stopAgent: vi.fn().mockResolvedValue(undefined)
  },
  agentFactory: {
    createFromWorkflow: vi.fn().mockResolvedValue('agent-123'),
    createFromParsedWorkflow: vi.fn().mockResolvedValue('agent-123')
  }
}))

// Import API handlers
import { POST as composeHandler } from '@/app/api/compose/route'
import { GET as actionsGetHandler, POST as actionsPostHandler } from '@/app/api/actions/route'
import { GET as agentsGetHandler, POST as agentsPostHandler, PUT as agentsPutHandler, DELETE as agentsDeleteHandler } from '@/app/api/agents/route'

describe('AI Agent API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('/api/compose endpoint', () => {
    it('should accept natural language workflow composition', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Swap 100 USDC to FLOW and stake in PoolX',
          options: {
            validate: true,
            generateCadence: true
          },
          metadata: {
            name: 'Test Workflow',
            description: 'Test workflow for AI agent'
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('workflowId')
    })

    it('should accept structured workflow composition', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          workflow: {
            actions: [
              {
                id: 'action1',
                actionType: 'swap',
                name: 'Swap USDC to FLOW',
                parameters: [
                  { name: 'fromToken', type: 'string', value: 'USDC', required: true },
                  { name: 'toToken', type: 'string', value: 'FLOW', required: true },
                  { name: 'amount', type: 'number', value: '100', required: true }
                ],
                nextActions: [],
                position: { x: 0, y: 0 }
              }
            ],
            executionOrder: ['action1'],
            rootActions: ['action1'],
            metadata: {
              totalActions: 1,
              totalConnections: 0,
              createdAt: new Date().toISOString()
            }
          },
          options: {
            validate: true,
            generateCadence: true
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('workflow')
    })

    it('should return error for invalid requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('error')
    })
  })

  describe('/api/actions endpoint', () => {
    it('should discover all actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      
      const response = await actionsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('actions')
    })

    it('should search actions by query', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?q=swap')
      
      const response = await actionsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('query', 'swap')
      expect(data).toHaveProperty('actions')
    })

    it('should get action by ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=test-action-id')
      
      const response = await actionsGetHandler(request)
      // This might return 404 if action doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should validate action compatibility', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          sourceActionId: 'action1',
          targetActionId: 'action2'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await actionsPostHandler(request)
      // This might return 404 if actions don't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })
  })

  describe('/api/agents endpoint', () => {
    it('should list all agents', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents')
      
      const response = await agentsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('agents')
    })

    it('should create new agent', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          workflow: {
            actions: [
              {
                id: 'action1',
                actionType: 'swap',
                name: 'Swap USDC to FLOW',
                parameters: [
                  { name: 'fromToken', type: 'string', value: 'USDC', required: true },
                  { name: 'toToken', type: 'string', value: 'FLOW', required: true },
                  { name: 'amount', type: 'number', value: '100', required: true }
                ],
                nextActions: [],
                position: { x: 0, y: 0 }
              }
            ],
            executionOrder: ['action1'],
            rootActions: ['action1'],
            metadata: {
              totalActions: 1,
              totalConnections: 0,
              createdAt: new Date().toISOString()
            }
          },
          config: {
            schedule: {
              type: 'recurring',
              interval: 3600
            },
            eventTriggers: [],
            retryPolicy: {
              maxRetries: 3,
              backoffStrategy: 'exponential',
              initialDelay: 1000,
              maxDelay: 10000
            },
            notifications: {},
            permissions: []
          },
          name: 'Test Agent',
          description: 'Test agent for AI integration',
          owner: 'test-user'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await agentsPostHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
      expect(data).toHaveProperty('agentId')
    })

    it('should return error for invalid agent creation', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await agentsPostHandler(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('error')
    })
  })

  describe('API Response Format', () => {
    it('should return consistent response format for success', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      
      const response = await actionsGetHandler(request)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(typeof data.success).toBe('boolean')
      
      if (data.success) {
        expect(data).not.toHaveProperty('error')
      }
    })

    it('should return consistent error format', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      const data = await response.json()
      
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
    })
  })

  describe('API Requirements Compliance', () => {
    it('should provide REST endpoints for workflow composition', async () => {
      // Requirement 5.1: REST endpoints for workflow composition
      const composeRequest = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Test workflow'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(composeRequest)
      expect(response).toBeDefined()
      expect(response.status).toBeDefined()
    })

    it('should accept JSON payloads with Action steps and parameters', async () => {
      // Requirement 5.2: Accept JSON payloads with Action steps and parameters
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          workflow: {
            actions: [
              {
                id: 'test-action',
                actionType: 'swap',
                name: 'Test Action',
                parameters: [
                  { name: 'param1', type: 'string', value: 'value1', required: true }
                ],
                nextActions: [],
                position: { x: 0, y: 0 }
              }
            ],
            executionOrder: ['test-action'],
            rootActions: ['test-action'],
            metadata: {
              totalActions: 1,
              totalConnections: 0,
              createdAt: new Date().toISOString()
            }
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('success')
    })

    it('should return generated Cadence code or transaction IDs', async () => {
      // Requirement 5.3: Return generated Cadence code or transaction IDs
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Test workflow',
          options: {
            generateCadence: true,
            executeImmediately: true
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      const data = await response.json()
      
      if (data.success) {
        // Should have either cadenceCode or executionResult with transactionId
        expect(
          data.cadenceCode || 
          (data.executionResult && data.executionResult.transactionId)
        ).toBeTruthy()
      }
    })
  })
})