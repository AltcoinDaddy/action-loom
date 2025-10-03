/**
 * Test suite for API routes fixes
 * Verifies that API routes return valid responses instead of 404/500 errors
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as actionsGET, POST as actionsPOST } from '@/app/api/actions/route'
import { GET as categoriesGET } from '@/app/api/actions/categories/route'
import { GET as suggestionsGET } from '@/app/api/actions/suggestions/route'

describe('API Routes Fixes', () => {
  beforeAll(() => {
    // Ensure we're in development mode for testing
    process.env.NODE_ENV = 'development'
  })

  afterAll(() => {
    // Reset environment
    delete process.env.NODE_ENV
  })

  describe('Actions API Route', () => {
    it('should return valid response for GET /api/actions', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.actions)).toBe(true)
      expect(data.actions.length).toBeGreaterThan(0)
    })

    it('should return valid response for GET /api/actions with query', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?q=swap')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.actions)).toBe(true)
      expect(data.query).toBe('swap')
    })

    it('should return 404 for non-existent action ID', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=non-existent')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.success).toBe(false)
      expect(data.error).toContain('not found')
    })

    it('should validate action metadata in POST request', async () => {
      const testAction = {
        id: 'test-action',
        name: 'Test Action',
        category: 'test',
        version: '1.0.0',
        inputs: [],
        outputs: []
      }

      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action: testAction }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.validationResult).toBeDefined()
      expect(data.validationResult.isValid).toBe(true)
    })

    it('should return 400 for invalid POST request', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ invalid: 'data' }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Invalid request')
    })
  })

  describe('Categories API Route', () => {
    it('should return valid response for GET /api/actions/categories', async () => {
      const response = await categoriesGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.categories)).toBe(true)
      expect(data.categories.length).toBeGreaterThan(0)
      expect(data.total).toBe(data.categories.length)
    })

    it('should return mock categories in development mode', async () => {
      const response = await categoriesGET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      
      // Check for expected mock categories
      const categoryIds = data.categories.map((cat: any) => cat.id)
      expect(categoryIds).toContain('defi')
      expect(categoryIds).toContain('nft')
      expect(categoryIds).toContain('token')
      expect(categoryIds).toContain('governance')
    })
  })

  describe('Suggestions API Route', () => {
    it('should return valid response for GET /api/actions/suggestions', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions/suggestions?q=swap')
      const response = await suggestionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(Array.isArray(data.suggestions)).toBe(true)
      expect(data.query).toBe('swap')
    })

    it('should return empty suggestions for empty query', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions/suggestions?q=')
      const response = await suggestionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.suggestions).toEqual([])
      expect(data.query).toBe('')
    })

    it('should return mock suggestions in development mode', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions/suggestions?q=token')
      const response = await suggestionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.suggestions.length).toBeGreaterThan(0)
      expect(data.suggestions.some((s: string) => s.includes('token'))).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed action validation gracefully', async () => {
      const malformedAction = {
        id: 'test',
        // Missing required fields
      }

      const request = new NextRequest('http://localhost:3000/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action: malformedAction }),
        headers: { 'Content-Type': 'application/json' }
      })

      const response = await actionsPOST(request)
      
      // Should not return 500 error, should handle gracefully
      expect(response.status).not.toBe(500)
      
      if (response.status === 200) {
        const data = await response.json()
        expect(data.success).toBe(true)
        expect(data.validationResult).toBeDefined()
      }
    })

    it('should return proper error structure', async () => {
      const request = new NextRequest('http://localhost:3000/api/actions?id=non-existent')
      const response = await actionsGET(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data).toHaveProperty('success', false)
      expect(data).toHaveProperty('error')
      expect(typeof data.error).toBe('string')
    })
  })
})