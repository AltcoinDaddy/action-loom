/**
 * Comprehensive test suite for API error handling improvements
 * Tests structured error responses, HTTP status codes, and validation
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as actionsGET, POST as actionsPOST } from '@/app/api/actions/route'
import { GET as categoriesGET } from '@/app/api/actions/categories/route'
import { GET as suggestionsGET } from '@/app/api/actions/suggestions/route'
import { POST as workflowExecutePOST } from '@/app/api/workflow/execute/route'
import { POST as workflowSavePOST, GET as workflowSaveGET } from '@/app/api/workflow/save/route'

describe('Comprehensive API Error Handling', () => {
  beforeAll(() => {
    // Ensure we're in development mode for testing
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    // Reset environment
    delete process.env.NODE_ENV
  })

  describe('Structured Error Responses', () => {
    it('should return standardized error structure for 404 errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=non-existent-action')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'RESOURCE_NOT_FOUND')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('correlationId')
      expect(typeof data.error).toBe('string')
      expect(typeof data.timestamp).toBe('string')
      expect(typeof data.correlationId).toBe('string')
    })

    it('should return standardized error structure for validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action: { id: 'test' } }), // Missing required fields
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('code', 'MISSING_REQUIRED_FIELDS')
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('correlationId')
      expect(data.error).toContain('Missing required fields')
    })

    it('should return standardized success structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveProperty('success', true)
      expect(data).toHaveProperty('timestamp')
      expect(data).toHaveProperty('correlationId')
      expect(data).toHaveProperty('actions')
      expect(Array.isArray(data.actions)).toBe(true)
    })
  })

  describe('Parameter Validation', () => {
    it('should validate limit parameter format', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?limit=invalid')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid limit parameter')
    })

    it('should validate limit parameter range', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?limit=2000')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Limit too large')
    })

    it('should validate action ID format', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=invalid@action!')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid action ID format')
    })

    it('should validate query length', async () => {
      const longQuery = 'a'.repeat(201)
      const request = new NextRequest(`http://localhost:3000/api/actions?q=${longQuery}`)
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Query too long')
    })

    it('should validate category format', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?category=invalid@category!')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid category format')
    })
  })

  describe('JSON Validation', () => {
    it('should handle malformed JSON in POST requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: '{ invalid json',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid JSON')
    })

    it('should handle empty request body', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: '',
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
    })
  })

  describe('Action Validation Errors', () => {
    it('should validate action structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action: 'not an object' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid action format')
    })

    it('should validate action ID format in action object', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: {
            id: 'invalid@id!',
            name: 'Test Action',
            category: 'test',
            version: '1.0.0'
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('INVALID_PARAMETERS')
      expect(data.error).toContain('Parameter validation failed')
    })

    it('should validate version format', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({
          action: {
            id: 'test-action',
            name: 'Test Action',
            category: 'test',
            version: 'invalid-version'
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('INVALID_PARAMETERS')
      expect(data.error).toContain('Parameter validation failed')
    })
  })

  describe('Workflow Chain Validation', () => {
    it('should validate empty action chain', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ actionIds: [] }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Empty action chain')
    })

    it('should validate action chain length', async () => {
      const longChain = Array(51).fill('test-action')
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ actionIds: longChain }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Action chain too long')
    })

    it('should validate action IDs in chain', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ actionIds: ['valid-action', 'invalid@action!'] }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid action ID at position 1')
    })
  })

  describe('Suggestions API Validation', () => {
    it('should validate suggestions limit', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions/suggestions?q=test&limit=100')
      const response = await suggestionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Limit too large')
    })

    it('should validate suggestions query length', async () => {
      const longQuery = 'a'.repeat(101)
      const request = new NextRequest(`http://localhost:3000/api/actions/suggestions?q=${longQuery}`)
      const response = await suggestionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Query too long')
    })
  })

  describe('Workflow API Validation', () => {
    it('should validate workflow structure in save request', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflow/save', {
        method: 'POST',
        body: JSON.stringify({ workflow: 'not an object' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await workflowSavePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid workflow format')
    })

    it('should validate workflow has actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflow/save', {
        method: 'POST',
        body: JSON.stringify({
          workflow: {
            actions: [],
            connections: [],
            metadata: {}
          }
        }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await workflowSavePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Empty workflow')
    })

    it('should validate workflow size limit', async () => {
      const largeWorkflow = {
        actions: Array(101).fill({ id: 'test', name: 'Test' }),
        connections: [],
        metadata: {}
      }

      const request = new NextRequest('http://localhost:3000/api/workflow/save', {
        method: 'POST',
        body: JSON.stringify({ workflow: largeWorkflow }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await workflowSavePOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Workflow too large')
    })

    it('should validate workflow ID format in GET request', async () => {
      const request = new NextRequest('http://localhost:3000/api/workflow/save?id=invalid-format')
      const response = await workflowSaveGET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.code).toBe('VALIDATION_FAILED')
      expect(data.error).toContain('Invalid workflow ID format')
    })
  })

  describe('Correlation IDs and Timestamps', () => {
    it('should include correlation ID in all responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(data).toHaveProperty('correlationId')
      expect(typeof data.correlationId).toBe('string')
      expect(data.correlationId).toMatch(/^req_\d+_[a-z0-9]+$/)
    })

    it('should include timestamp in all responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(data).toHaveProperty('timestamp')
      expect(typeof data.timestamp).toBe('string')
      expect(new Date(data.timestamp).getTime()).toBeGreaterThan(0)
    })

    it('should include correlation ID in error responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=non-existent')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('correlationId')
      expect(typeof data.correlationId).toBe('string')
    })
  })

  describe('HTTP Status Codes', () => {
    it('should return 400 for validation errors', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?limit=invalid')
      const response = await actionsGET(request)

      expect(response.status).toBe(400)
    })

    it('should return 404 for not found resources', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=non-existent')
      const response = await actionsGET(request)

      expect(response.status).toBe(404)
    })

    it('should return 200 for successful requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      const response = await actionsGET(request)

      expect(response.status).toBe(200)
    })
  })
})