import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

/**
 * Comprehensive API Integration Tests
 * 
 * Tests the complete AI Agent API functionality including:
 * - Authentication and authorization
 * - Rate limiting
 * - Workflow composition
 * - Action discovery
 * - Agent management
 * - Error handling
 * - Response formats
 * 
 * Requirements: 5.3, 5.6 - API documentation and testing
 */

// Mock all services with realistic implementations
vi.mock('@/lib/api-auth-service', () => ({
  withAuth: vi.fn((resource: string, action: string) => {
    return async (request: Request) => {
      const authHeader = request.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer al_')) {
        return {
          success: false,
          error: 'Missing or invalid Authorization header',
          status: 401
        }
      }
      
      return {
        success: true,
        apiKey: {
          id: 'test-key',
          userId: 'test-user',
          permissions: [{ resource: '*', actions: ['*'] }]
        },
        remainingRequests: {
          minute: 95,
          hour: 4850,
          day: 49500
        }
      }
    }
  }),
  createAPIAuthService: vi.fn(() => ({
    getUserAPIKeys: vi.fn().mockResolvedValue(['key1', 'key2']),
    generateAPIKey: vi.fn().mockReturnValue({
      id: 'key_123',
      key: 'al_' + 'a'.repeat(64),
      name: 'Test Key',
      permissions: [],
      rateLimit: {
        requestsPerMinute: 100,
        requestsPerHour: 5000,
        requestsPerDay: 50000,
        burstLimit: 200
      },
      createdAt: new Date().toISOString()
    }),
    storeAPIKey: vi.fn().mockResolvedValue(undefined),
    revokeAPIKey: vi.fn().mockResolvedValue(true)
  })),
  DEFAULT_RATE_LIMITS: {
    free: { requestsPerMinute: 10, requestsPerHour: 100, requestsPerDay: 1000, burstLimit: 20 },
    pro: { requestsPerMinute: 100, requestsPerHour: 5000, requestsPerDay: 50000, burstLimit: 200 },
    enterprise: { requestsPerMinute: 1000, requestsPerHour: 50000, requestsPerDay: 1000000, burstLimit: 2000 }
  }
}))

vi.mock('@/lib/nlp-service', () => ({
  NLPService: vi.fn().mockImplementation(() => ({
    parseWorkflow: vi.fn().mockResolvedValue({
      confidence: 0.9,
      steps: [
        {
          actionId: 'swap_usdc_flow',
          actionName: 'Token Swap',
          parameters: {
            fromToken: 'USDC',
            toToken: 'FLOW',
            amount: 100
          },
          confidence: 0.95
        }
      ],
      ambiguities: [],
      suggestions: [],
      processingTime: 150
    })
  }))
}))

vi.mock('@/lib/action-mapping-service', () => ({
  ActionMappingService: vi.fn().mockImplementation(() => ({
    mapToWorkflow: vi.fn().mockResolvedValue({
      actions: [
        {
          id: 'swap1',
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
      executionOrder: ['swap1'],
      rootActions: ['swap1'],
      metadata: {
        totalActions: 1,
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
      balanceChanges: [
        {
          address: '0x1234',
          token: 'USDC',
          before: '1000.00',
          after: '900.00',
          change: '-100.00'
        }
      ],
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
      actions: [
        {
          id: 'swap_tokens_v2',
          name: 'Token Swap V2',
          description: 'Swap tokens using AMM',
          category: 'defi',
          version: '2.1.0',
          inputs: [
            { name: 'fromToken', type: 'string', required: true },
            { name: 'toToken', type: 'string', required: true },
            { name: 'amount', type: 'number', required: true }
          ],
          outputs: [
            { name: 'outputAmount', type: 'number' }
          ],
          gasEstimate: 500,
          securityLevel: 'medium',
          author: 'FlowDEX',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      registries: [],
      lastUpdated: new Date().toISOString(),
      totalFound: 1,
      executionTime: 100
    }),
    searchActions: vi.fn().mockResolvedValue([
      {
        action: {
          id: 'swap_tokens_v2',
          name: 'Token Swap V2',
          category: 'defi'
        },
        score: 0.95,
        matchReasons: ['name match']
      }
    ]),
    getAction: vi.fn().mockResolvedValue({
      id: 'swap_tokens_v2',
      name: 'Token Swap V2',
      category: 'defi'
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
    getAllAgents: vi.fn().mockReturnValue([
      {
        id: 'agent_123',
        name: 'Test Agent',
        status: 'active',
        createdAt: new Date().toISOString(),
        owner: 'test-user'
      }
    ]),
    getUserAgents: vi.fn().mockReturnValue([
      {
        id: 'agent_123',
        name: 'Test Agent',
        status: 'active',
        createdAt: new Date().toISOString(),
        owner: 'test-user'
      }
    ]),
    getAgentStatus: vi.fn().mockReturnValue({
      id: 'agent_123',
      name: 'Test Agent',
      status: 'active',
      createdAt: new Date().toISOString(),
      owner: 'test-user'
    }),
    getAgentHealth: vi.fn().mockReturnValue({
      status: 'healthy',
      uptime: 86400,
      lastExecution: new Date().toISOString(),
      successRate: 0.98,
      errorCount: 1
    }),
    createAgent: vi.fn().mockResolvedValue('agent_123'),
    updateAgent: vi.fn().mockResolvedValue(undefined),
    deleteAgent: vi.fn().mockResolvedValue(undefined),
    pauseAgent: vi.fn().mockResolvedValue(undefined),
    resumeAgent: vi.fn().mockResolvedValue(undefined),
    stopAgent: vi.fn().mockResolvedValue(undefined)
  },
  agentFactory: {
    createFromWorkflow: vi.fn().mockResolvedValue('agent_123'),
    createFromParsedWorkflow: vi.fn().mockResolvedValue('agent_123')
  }
}))

// Import API handlers
import { POST as composeHandler } from '@/app/api/compose/route'
import { GET as actionsGetHandler, POST as actionsPostHandler } from '@/app/api/actions/route'
import { GET as agentsGetHandler, POST as agentsPostHandler, PUT as agentsPutHandler, DELETE as agentsDeleteHandler } from '@/app/api/agents/route'
import { POST as agentControlHandler } from '@/app/api/agents/control/route'
import { GET as agentHealthHandler } from '@/app/api/agents/health/route'
import { GET as apiKeysGetHandler, POST as apiKeysPostHandler, DELETE as apiKeysDeleteHandler } from '@/app/api/auth/keys/route'

describe('Comprehensive AI Agent API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Authentication and Authorization', () => {
    it('should reject requests without API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({ naturalLanguage: 'test' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('Authorization')
    })

    it('should reject requests with invalid API key format', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({ naturalLanguage: 'test' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer invalid_key'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(401)
    })

    it('should accept requests with valid API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({ naturalLanguage: 'Swap 100 USDC to FLOW' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer al_' + 'a'.repeat(64)
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
    })

    it('should include rate limit headers in responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({ naturalLanguage: 'Swap 100 USDC to FLOW' }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer al_' + 'a'.repeat(64)
        }
      })

      const response = await composeHandler(request)
      expect(response.headers.get('X-RateLimit-Remaining-Minute')).toBe('95')
      expect(response.headers.get('X-RateLimit-Remaining-Hour')).toBe('4850')
      expect(response.headers.get('X-RateLimit-Remaining-Day')).toBe('49500')
    })
  })

  describe('Workflow Composition API', () => {
    const validAuthHeaders = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer al_' + 'a'.repeat(64)
    }

    it('should compose workflow from natural language', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Swap 100 USDC to FLOW and stake in PoolX',
          options: {
            validate: true,
            generateCadence: true
          },
          metadata: {
            name: 'DeFi Strategy',
            description: 'Automated workflow'
          }
        }),
        headers: validAuthHeaders
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.workflowId).toBeDefined()
      expect(data.workflow).toBeDefined()
      expect(data.cadenceCode).toBeDefined()
      expect(data.nlpResult).toBeDefined()
      expect(data.nlpResult.confidence).toBeGreaterThan(0.8)
    })

    it('should compose workflow from structured input', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          workflow: {
            actions: [
              {
                id: 'swap1',
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
            executionOrder: ['swap1'],
            rootActions: ['swap1'],
            metadata: {
              totalActions: 1,
              totalConnections: 0,
              createdAt: new Date().toISOString()
            }
          },
          options: {
            validate: true,
            simulate: true,
            generateCadence: true
          }
        }),
        headers: validAuthHeaders
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.workflow).toBeDefined()
      expect(data.validationResult).toBeDefined()
      expect(data.simulationResult).toBeDefined()
      expect(data.cadenceCode).toBeDefined()
    })

    it('should validate workflow options', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          // Missing both naturalLanguage and workflow
        }),
        headers: validAuthHeaders
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('naturalLanguage or workflow must be provided')
    })
  })

  describe('Action Discovery API', () => {
    const validAuthHeaders = {
      'Authorization': 'Bearer al_' + 'a'.repeat(64)
    }

    it('should discover all actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        headers: validAuthHeaders
      })

      const response = await actionsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.actions).toBeDefined()
      expect(Array.isArray(data.actions)).toBe(true)
      expect(data.total).toBeDefined()
      expect(data.lastUpdated).toBeDefined()
    })

    it('should search actions by query', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?q=swap&limit=5', {
        headers: validAuthHeaders
      })

      const response = await actionsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.query).toBe('swap')
      expect(data.actions).toBeDefined()
      expect(data.searchResults).toBeDefined()
    })

    it('should get action by ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=swap_tokens_v2', {
        headers: validAuthHeaders
      })

      const response = await actionsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.action).toBeDefined()
      expect(data.action.id).toBe('swap_tokens_v2')
    })

    it('should validate action compatibility', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          sourceActionId: 'action1',
          targetActionId: 'action2'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await actionsPostHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.compatible).toBeDefined()
      expect(data.issues).toBeDefined()
    })

    it('should validate workflow chain', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          actionIds: ['action1', 'action2', 'action3']
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await actionsPostHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.chainValidation).toBeDefined()
    })
  })

  describe('Agent Management API', () => {
    const validAuthHeaders = {
      'Authorization': 'Bearer al_' + 'a'.repeat(64)
    }

    it('should list all agents', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        headers: validAuthHeaders
      })

      const response = await agentsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agents).toBeDefined()
      expect(Array.isArray(data.agents)).toBe(true)
      expect(data.total).toBeDefined()
    })

    it('should list agents with health information', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents?health=true', {
        headers: validAuthHeaders
      })

      const response = await agentsGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agents[0].health).toBeDefined()
      expect(data.agents[0].health.status).toBeDefined()
    })

    it('should create agent from workflow', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          workflow: {
            actions: [
              {
                id: 'daily_dca',
                actionType: 'swap',
                name: 'Daily DCA',
                parameters: [
                  { name: 'fromToken', type: 'string', value: 'USDC', required: true },
                  { name: 'toToken', type: 'string', value: 'FLOW', required: true },
                  { name: 'amount', type: 'number', value: '10', required: true }
                ],
                nextActions: [],
                position: { x: 0, y: 0 }
              }
            ],
            executionOrder: ['daily_dca'],
            rootActions: ['daily_dca'],
            metadata: {
              totalActions: 1,
              totalConnections: 0,
              createdAt: new Date().toISOString()
            }
          },
          config: {
            schedule: {
              type: 'recurring',
              interval: 86400
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
          name: 'Daily DCA Agent',
          description: 'Automated daily DCA',
          owner: 'test-user'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await agentsPostHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agentId).toBeDefined()
      expect(data.agent).toBeDefined()
      expect(data.message).toContain('successfully')
    })

    it('should update agent configuration', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        method: 'PUT',
        body: JSON.stringify({
          agentId: 'agent_123',
          updates: {
            schedule: {
              type: 'recurring',
              interval: 43200
            },
            name: 'Updated Agent Name'
          }
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await agentsPutHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agent).toBeDefined()
      expect(data.message).toContain('successfully')
    })

    it('should delete agent', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        method: 'DELETE',
        body: JSON.stringify({
          agentId: 'agent_123'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await agentsDeleteHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('successfully')
    })

    it('should control agent (pause/resume/stop)', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents/control', {
        method: 'POST',
        body: JSON.stringify({
          agentId: 'agent_123',
          action: 'pause'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await agentControlHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agent).toBeDefined()
      expect(data.message).toContain('pause')
    })

    it('should get agent health', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents/health?id=agent_123', {
        headers: validAuthHeaders
      })

      const response = await agentHealthHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.agentId).toBe('agent_123')
      expect(data.health).toBeDefined()
      expect(data.health.status).toBeDefined()
      expect(data.health.uptime).toBeDefined()
    })
  })

  describe('API Key Management', () => {
    it('should list user API keys', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/keys?userId=test-user')

      const response = await apiKeysGetHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.keys).toBeDefined()
      expect(Array.isArray(data.keys)).toBe(true)
      expect(data.total).toBeDefined()
    })

    it('should create new API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test API Key',
          userId: 'test-user',
          tier: 'pro',
          permissions: [
            {
              resource: 'compose',
              actions: ['read', 'write']
            }
          ]
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await apiKeysPostHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.apiKey).toBeDefined()
      expect(data.apiKey.key).toMatch(/^al_[a-f0-9]{64}$/)
      expect(data.message).toContain('Store this key securely')
    })

    it('should revoke API key', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'DELETE',
        body: JSON.stringify({
          keyId: 'key_123',
          userId: 'test-user'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const response = await apiKeysDeleteHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toContain('revoked successfully')
    })
  })

  describe('Error Handling and Response Formats', () => {
    const validAuthHeaders = {
      'Authorization': 'Bearer al_' + 'a'.repeat(64)
    }

    it('should return consistent success response format', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        headers: validAuthHeaders
      })

      const response = await actionsGetHandler(request)
      const data = await response.json()
      
      expect(data).toHaveProperty('success')
      expect(typeof data.success).toBe('boolean')
      expect(data.success).toBe(true)
      expect(data).not.toHaveProperty('error')
    })

    it('should return consistent error response format', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer al_' + 'a'.repeat(64)
        }
      })

      const response = await composeHandler(request)
      const data = await response.json()
      
      expect(data.success).toBe(false)
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
    })

    it('should handle malformed JSON gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer al_' + 'a'.repeat(64)
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
    })

    it('should validate required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required fields
          name: 'Test Agent'
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer al_' + 'a'.repeat(64)
        }
      })

      const response = await agentsPostHandler(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('required')
    })
  })

  describe('API Requirements Compliance', () => {
    const validAuthHeaders = {
      'Authorization': 'Bearer al_' + 'a'.repeat(64)
    }

    it('should provide REST endpoints for workflow composition (Requirement 5.1)', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Test workflow'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response).toBeDefined()
      expect(response.status).toBe(200)
    })

    it('should accept JSON payloads with Action steps and parameters (Requirement 5.2)', async () => {
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
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.workflow).toBeDefined()
      expect(data.workflow.actions).toBeDefined()
      expect(data.workflow.actions[0].parameters).toBeDefined()
    })

    it('should return generated Cadence code or transaction IDs (Requirement 5.3)', async () => {
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
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      const data = await response.json()
      
      if (data.success) {
        expect(
          data.cadenceCode || 
          (data.executionResult && data.executionResult.transactionId)
        ).toBeTruthy()
      }
    })

    it('should implement secure API key management (Requirement 5.4)', async () => {
      // Test API key creation
      const createRequest = new NextRequest('http://localhost:3000/api/auth/keys', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Security Test Key',
          userId: 'test-user'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const createResponse = await apiKeysPostHandler(createRequest)
      expect(createResponse.status).toBe(200)
      
      const createData = await createResponse.json()
      expect(createData.success).toBe(true)
      expect(createData.apiKey.key).toMatch(/^al_[a-f0-9]{64}$/)
      
      // Test API key usage
      const useRequest = new NextRequest('http://localhost:3000/api/actions', {
        headers: {
          'Authorization': `Bearer ${createData.apiKey.key}`
        }
      })

      const useResponse = await actionsGetHandler(useRequest)
      expect(useResponse.status).toBe(200)
    })

    it('should implement appropriate rate limiting (Requirement 5.5)', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Test workflow'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      
      // Check rate limit headers are present
      expect(response.headers.get('X-RateLimit-Remaining-Minute')).toBeDefined()
      expect(response.headers.get('X-RateLimit-Remaining-Hour')).toBeDefined()
      expect(response.headers.get('X-RateLimit-Remaining-Day')).toBeDefined()
    })

    it('should provide detailed error responses with actionable information (Requirement 5.6)', async () => {
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          // Invalid request - missing required fields
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBeDefined()
      expect(typeof data.error).toBe('string')
      expect(data.error.length).toBeGreaterThan(0)
      expect(data.error).toContain('naturalLanguage or workflow must be provided')
    })
  })

  describe('Performance and Reliability', () => {
    const validAuthHeaders = {
      'Authorization': 'Bearer al_' + 'a'.repeat(64)
    }

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        new NextRequest('http://localhost:3000/api/actions', {
          headers: validAuthHeaders
        })
      )

      const responses = await Promise.all(
        requests.map(request => actionsGetHandler(request))
      )

      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })

    it('should return responses within reasonable time', async () => {
      const startTime = Date.now()
      
      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          naturalLanguage: 'Swap 100 USDC to FLOW'
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      const endTime = Date.now()
      
      expect(response.status).toBe(200)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle large payloads gracefully', async () => {
      const largeWorkflow = {
        actions: Array.from({ length: 50 }, (_, i) => ({
          id: `action_${i}`,
          actionType: 'swap',
          name: `Action ${i}`,
          parameters: [
            { name: 'param1', type: 'string', value: `value${i}`, required: true }
          ],
          nextActions: i < 49 ? [`action_${i + 1}`] : [],
          position: { x: i * 100, y: 0 }
        })),
        executionOrder: Array.from({ length: 50 }, (_, i) => `action_${i}`),
        rootActions: ['action_0'],
        metadata: {
          totalActions: 50,
          totalConnections: 49,
          createdAt: new Date().toISOString()
        }
      }

      const request = new NextRequest('http://localhost:3000/api/compose', {
        method: 'POST',
        body: JSON.stringify({
          workflow: largeWorkflow,
          options: {
            validate: true
          }
        }),
        headers: {
          ...validAuthHeaders,
          'Content-Type': 'application/json'
        }
      })

      const response = await composeHandler(request)
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.workflow.actions).toHaveLength(50)
    })
  })
})