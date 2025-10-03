/**
 * Build Verification Tests
 * 
 * Tests to verify that the build process completes successfully
 * and all required files and routes are accessible.
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawn, ChildProcess } from 'child_process'
import { readdir, access } from 'fs/promises'
import { join } from 'path'

describe('Build Verification', () => {
  let serverProcess: ChildProcess | null = null
  const PORT = 3002 // Use different port to avoid conflicts

  beforeAll(async () => {
    // Start the production server for testing
    serverProcess = spawn('pnpm', ['start'], {
      env: { ...process.env, PORT: PORT.toString() },
      stdio: 'pipe'
    })

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 5000))
  }, 30000)

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill()
    }
  })

  describe('Build Process Verification', () => {
    it('should have generated .next directory', async () => {
      await expect(access('.next')).resolves.not.toThrow()
    })

    it('should have generated static assets', async () => {
      const staticDir = '.next/static'
      await expect(access(staticDir)).resolves.not.toThrow()
      
      const staticFiles = await readdir(staticDir, { recursive: true })
      expect(staticFiles.length).toBeGreaterThan(0)
    })

    it('should have generated server chunks', async () => {
      const serverDir = '.next/server'
      await expect(access(serverDir)).resolves.not.toThrow()
      
      const serverFiles = await readdir(serverDir, { recursive: true })
      expect(serverFiles.length).toBeGreaterThan(0)
    })

    it('should have generated app routes', async () => {
      const appDir = '.next/server/app'
      await expect(access(appDir)).resolves.not.toThrow()
      
      // Check for API routes
      const apiDir = join(appDir, 'api')
      await expect(access(apiDir)).resolves.not.toThrow()
    })
  })

  describe('API Routes Accessibility', () => {
    const makeRequest = async (path: string): Promise<Response> => {
      const response = await fetch(`http://localhost:${PORT}${path}`)
      return response
    }

    it('should serve /api/health endpoint', async () => {
      const response = await makeRequest('/api/health')
      expect(response.status).toBe(200)
    })

    it('should serve /api/actions endpoint', async () => {
      const response = await makeRequest('/api/actions')
      // Should return 401 (unauthorized) or 200, not 404/500
      expect([200, 401]).toContain(response.status)
    })

    it('should serve /api/workflow/save endpoint', async () => {
      const response = await makeRequest('/api/workflow/save')
      // Should return valid response, not 404/500
      expect(response.status).not.toBe(404)
      expect(response.status).not.toBe(500)
    })

    it('should serve /api/actions/categories endpoint', async () => {
      const response = await makeRequest('/api/actions/categories')
      // Should return valid response, not 404/500
      expect(response.status).not.toBe(404)
      expect(response.status).not.toBe(500)
    })

    it('should serve /api/metrics endpoint', async () => {
      const response = await makeRequest('/api/metrics')
      expect(response.status).toBe(200)
    })
  })

  describe('Application Pages', () => {
    const makeRequest = async (path: string): Promise<Response> => {
      const response = await fetch(`http://localhost:${PORT}${path}`)
      return response
    }

    it('should serve home page', async () => {
      const response = await makeRequest('/')
      expect(response.status).toBe(200)
    })

    it('should serve builder page', async () => {
      const response = await makeRequest('/builder')
      expect(response.status).toBe(200)
    })

    it('should serve agents page', async () => {
      const response = await makeRequest('/agents')
      expect(response.status).toBe(200)
    })
  })

  describe('Static Assets', () => {
    const makeRequest = async (path: string): Promise<Response> => {
      const response = await fetch(`http://localhost:${PORT}${path}`)
      return response
    }

    it('should serve CSS files', async () => {
      // Get list of CSS files
      const cssDir = '.next/static/css'
      const cssFiles = await readdir(cssDir)
      
      if (cssFiles.length > 0) {
        const cssFile = cssFiles[0]
        const response = await makeRequest(`/_next/static/css/${cssFile}`)
        expect(response.status).toBe(200)
      }
    })

    it('should serve JavaScript chunks', async () => {
      // Get list of JS chunks
      const chunksDir = '.next/static/chunks'
      const chunkFiles = await readdir(chunksDir)
      
      if (chunkFiles.length > 0) {
        const jsFile = chunkFiles.find(f => f.endsWith('.js'))
        if (jsFile) {
          const response = await makeRequest(`/_next/static/chunks/${jsFile}`)
          expect(response.status).toBe(200)
        }
      }
    })
  })
})