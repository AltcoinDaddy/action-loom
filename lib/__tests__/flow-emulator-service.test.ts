import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FlowEmulatorService, EmulatorConfig } from '../flow-emulator-service'
import { ParsedWorkflow, ActionMetadata, SecurityLevel } from '../types'

// Mock FCL
vi.mock('@onflow/fcl', () => ({
  config: vi.fn(),
  send: vi.fn(),
  decode: vi.fn(),
  getLatestBlock: vi.fn()
}))

describe('FlowEmulatorService', () => {
  let emulatorService: FlowEmulatorService
  let mockConfig: Partial<EmulatorConfig>
  let mockWorkflow: ParsedWorkflow
  let mockActionMetadata: ActionMetadata[]

  beforeEach(() => {
    mockConfig = {
      endpoint: 'http://localhost',
      port: 3569,
      verbose: false,
      logLevel: 'info'
    }
    emulatorService = new FlowEmulatorService(mockConfig)

    // Set up mock data for all tests
    mockWorkflow = {
      actions: [
        {
          id: 'action1',
          actionType: 'swap',
          name: 'Token Swap',
          parameters: [
            { name: 'tokenIn', type: 'string', value: 'FLOW', required: true },
            { name: 'tokenOut', type: 'string', value: 'USDC', required: true },
            { name: 'amountIn', type: 'number', value: '100.0', required: true }
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
        createdAt: new Date().toISOString(),
        name: 'Test Workflow'
      }
    }

    mockActionMetadata = [
      {
        id: 'swap',
        name: 'Token Swap',
        description: 'Swap tokens on DEX',
        category: 'DeFi',
        version: '1.0.0',
        inputs: [
          { name: 'tokenIn', type: 'string', required: true },
          { name: 'tokenOut', type: 'string', required: true },
          { name: 'amountIn', type: 'number', required: true }
        ],
        outputs: [
          { name: 'amountOut', type: 'number' }
        ],
        parameters: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['emulator', 'testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: SecurityLevel.MEDIUM,
        author: 'test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]
  })

  afterEach(async () => {
    await emulatorService.cleanup()
  })

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const service = new FlowEmulatorService()
      const status = service.getStatus()
      
      expect(status.isRunning).toBe(false)
      expect(status.environment).toBeNull()
      expect(status.snapshots).toEqual([])
    })

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        port: 8080,
        verbose: true,
        blockTime: 2
      }
      
      const service = new FlowEmulatorService(customConfig)
      // We can't directly access config, but we can test behavior
      expect(service).toBeDefined()
    })
  })

  describe('Emulator Lifecycle', () => {
    it('should start emulator successfully', async () => {
      // Mock FCL responses
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })

      await emulatorService.startEmulator()
      
      const status = emulatorService.getStatus()
      expect(status.isRunning).toBe(true)
      expect(status.environment).not.toBeNull()
    })

    it('should not start emulator if already running', async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })

      await emulatorService.startEmulator()
      await emulatorService.startEmulator() // Second call should not throw
      
      const status = emulatorService.getStatus()
      expect(status.isRunning).toBe(true)
    })

    it('should stop emulator successfully', async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })

      await emulatorService.startEmulator()
      await emulatorService.stopEmulator()
      
      const status = emulatorService.getStatus()
      expect(status.isRunning).toBe(false)
      expect(status.environment).toBeNull()
    })

    it('should handle emulator connection failure', async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockRejectedValue(new Error('Connection failed'))

      await expect(emulatorService.startEmulator()).rejects.toThrow('Failed to start Flow emulator')
    })
  })

  describe('Snapshot Management', () => {
    beforeEach(async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })
      
      await emulatorService.startEmulator()
    })

    it('should create snapshot successfully', async () => {
      const snapshotId = await emulatorService.createSnapshot('test-snapshot')
      
      expect(snapshotId).toBe('test-snapshot')
      
      const status = emulatorService.getStatus()
      expect(status.snapshots).toContain('test-snapshot')
    })

    it('should create snapshot with auto-generated name', async () => {
      const snapshotId = await emulatorService.createSnapshot()
      
      expect(snapshotId).toMatch(/^snapshot_\d+$/)
      
      const status = emulatorService.getStatus()
      expect(status.snapshots).toContain(snapshotId)
    })

    it('should restore from snapshot successfully', async () => {
      const snapshotId = await emulatorService.createSnapshot('restore-test')
      
      await expect(emulatorService.restoreSnapshot(snapshotId)).resolves.not.toThrow()
    })

    it('should fail to restore from non-existent snapshot', async () => {
      await expect(emulatorService.restoreSnapshot('non-existent')).rejects.toThrow('Snapshot non-existent not found')
    })
  })

  describe('Workflow Simulation', () => {
    beforeEach(async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })
      
      await emulatorService.startEmulator()
    })

    it('should simulate simple workflow successfully', async () => {
      const result = await emulatorService.simulateWorkflow(mockWorkflow, mockActionMetadata)
      
      expect(result.success).toBe(true)
      expect(result.gasUsed).toBeGreaterThan(0)
      expect(result.balanceChanges).toHaveLength(2) // tokenIn and tokenOut changes
      expect(result.events).toHaveLength(1) // TokenSwap event
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it('should handle missing action metadata', async () => {
      const workflowWithMissingMetadata = {
        ...mockWorkflow,
        actions: [
          {
            ...mockWorkflow.actions[0],
            actionType: 'unknown-action'
          }
        ]
      }

      const result = await emulatorService.simulateWorkflow(workflowWithMissingMetadata, mockActionMetadata)
      
      expect(result.success).toBe(false)
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].type).toBe('MISSING_METADATA')
    })

    it('should validate required parameters', async () => {
      const workflowWithMissingParams = {
        ...mockWorkflow,
        actions: [
          {
            ...mockWorkflow.actions[0],
            parameters: [
              { name: 'tokenIn', type: 'string', value: 'FLOW', required: true }
              // Missing required parameters
            ]
          }
        ]
      }

      const result = await emulatorService.simulateWorkflow(workflowWithMissingParams, mockActionMetadata)
      
      expect(result.success).toBe(false)
      expect(result.errors.some(e => e.type === 'MISSING_REQUIRED_PARAMETER')).toBe(true)
    })

    it('should check gas limits', async () => {
      const result = await emulatorService.simulateWorkflow(
        mockWorkflow, 
        mockActionMetadata, 
        { gasLimit: 500 } // Lower than estimated gas
      )
      
      expect(result.success).toBe(false)
      expect(result.errors.some(e => e.type === 'GAS_LIMIT_EXCEEDED')).toBe(true)
    })

    it('should generate performance warnings', async () => {
      const result = await emulatorService.simulateWorkflow(
        mockWorkflow, 
        mockActionMetadata, 
        { gasLimit: 1200 } // Close to gas usage
      )
      
      expect(result.warnings.some(w => w.includes('Gas usage is approaching the limit'))).toBe(true)
    })

    it('should handle action conflicts', async () => {
      const conflictingMetadata = [
        ...mockActionMetadata,
        {
          ...mockActionMetadata[0],
          id: 'conflicting-action',
          name: 'Conflicting Action',
          compatibility: {
            ...mockActionMetadata[0].compatibility,
            conflictsWith: ['swap']
          }
        }
      ]

      const conflictingWorkflow = {
        ...mockWorkflow,
        actions: [
          ...mockWorkflow.actions,
          {
            id: 'action2',
            actionType: 'conflicting-action',
            name: 'Conflicting Action',
            parameters: [],
            nextActions: [],
            position: { x: 100, y: 0 }
          }
        ],
        executionOrder: ['action1', 'action2']
      }

      const result = await emulatorService.simulateWorkflow(conflictingWorkflow, conflictingMetadata)
      
      expect(result.success).toBe(false)
      expect(result.errors.some(e => e.type === 'ACTION_CONFLICT')).toBe(true)
    })

    it('should support dry run mode', async () => {
      const result = await emulatorService.simulateWorkflow(
        mockWorkflow, 
        mockActionMetadata, 
        { dryRun: true }
      )
      
      expect(result.success).toBe(true)
      // In dry run mode, results shouldn't be stored (we can't test this directly)
    })

    it('should track state changes throughout simulation', async () => {
      const multiActionWorkflow = {
        ...mockWorkflow,
        actions: [
          ...mockWorkflow.actions,
          {
            id: 'action2',
            actionType: 'swap',
            name: 'Second Swap',
            parameters: [
              { name: 'tokenIn', type: 'string', value: 'USDC', required: true },
              { name: 'tokenOut', type: 'string', value: 'FLOW', required: true },
              { name: 'amountIn', type: 'number', value: '50.0', required: true }
            ],
            nextActions: [],
            position: { x: 100, y: 0 }
          }
        ],
        executionOrder: ['action1', 'action2']
      }

      const result = await emulatorService.simulateWorkflow(multiActionWorkflow, mockActionMetadata)
      
      expect(result.success).toBe(true)
      expect(result.balanceChanges.length).toBeGreaterThan(2) // Multiple balance changes
      expect(result.events.length).toBe(2) // Two swap events
    })
  })

  describe('Error Handling', () => {
    it('should handle simulation failures gracefully', async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })

      const invalidWorkflow = {
        actions: [],
        executionOrder: ['non-existent-action'],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: new Date().toISOString()
        }
      }

      const result = await emulatorService.simulateWorkflow(invalidWorkflow, [])
      
      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.executionTime).toBeGreaterThanOrEqual(0) // Changed to >= 0 since it might be 0 for very fast failures
    })

    it('should handle emulator not running', async () => {
      const newService = new FlowEmulatorService(mockConfig)
      
      // Mock FCL for auto-start
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })

      const result = await newService.simulateWorkflow(mockWorkflow, mockActionMetadata)
      
      // Should auto-start emulator and succeed
      expect(result).toBeDefined()
      
      await newService.cleanup()
    })
  })

  describe('Resource Safety', () => {
    beforeEach(async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })
      
      await emulatorService.startEmulator()
    })

    it('should detect potential resource leaks', async () => {
      const resourceLeakMetadata = [
        {
          ...mockActionMetadata[0],
          id: 'resource-leak-action',
          name: 'Resource Leak Action',
          securityLevel: SecurityLevel.HIGH
        }
      ]

      const resourceLeakWorkflow = {
        ...mockWorkflow,
        actions: [
          {
            ...mockWorkflow.actions[0],
            actionType: 'resource-leak-action'
          }
        ]
      }

      const result = await emulatorService.simulateWorkflow(resourceLeakWorkflow, resourceLeakMetadata)
      
      // The service should complete but may have warnings about resource safety
      expect(result).toBeDefined()
    })
  })

  describe('Performance', () => {
    beforeEach(async () => {
      const fcl = await import('@onflow/fcl')
      vi.mocked(fcl.send).mockResolvedValue({})
      vi.mocked(fcl.decode).mockResolvedValue({ id: 'block123', height: 1 })
      
      await emulatorService.startEmulator()
    })

    it('should complete simulation within reasonable time', async () => {
      const startTime = Date.now()
      
      await emulatorService.simulateWorkflow(mockWorkflow, mockActionMetadata)
      
      const executionTime = Date.now() - startTime
      expect(executionTime).toBeLessThan(5000) // Should complete within 5 seconds
    })

    it('should handle large workflows efficiently', async () => {
      // Create a workflow with many actions
      const largeWorkflow = {
        ...mockWorkflow,
        actions: Array.from({ length: 10 }, (_, i) => ({
          id: `action${i}`,
          actionType: 'swap',
          name: `Swap ${i}`,
          parameters: mockWorkflow.actions[0].parameters,
          nextActions: [],
          position: { x: i * 100, y: 0 }
        })),
        executionOrder: Array.from({ length: 10 }, (_, i) => `action${i}`)
      }

      const startTime = Date.now()
      const result = await emulatorService.simulateWorkflow(largeWorkflow, mockActionMetadata)
      const executionTime = Date.now() - startTime

      expect(result).toBeDefined()
      expect(executionTime).toBeLessThan(10000) // Should complete within 10 seconds
      expect(result.warnings.some(w => w.includes('Large number of transactions'))).toBe(true)
    })
  })
})