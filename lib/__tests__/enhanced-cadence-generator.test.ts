/**
 * Tests for Enhanced Cadence Generator
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EnhancedCadenceGenerator, ProductionCadenceGenerationOptions } from '../enhanced-cadence-generator'
import { ParsedWorkflow, ParsedAction, SecurityLevel } from '../types'

// Mock the action discovery service
vi.mock('../action-discovery-service', () => ({
  getDefaultActionDiscoveryService: () => ({
    getAction: vi.fn().mockResolvedValue({
      id: 'test-action',
      name: 'Test Action',
      contractAddress: '0x1234567890abcdef',
      gasEstimate: 200,
      securityLevel: SecurityLevel.MEDIUM,
      inputs: [
        { name: 'amount', type: 'UFix64', required: true },
        { name: 'recipient', type: 'Address', required: true }
      ],
      dependencies: []
    })
  })
}))

describe('EnhancedCadenceGenerator', () => {
  let mockWorkflow: ParsedWorkflow
  let mockAction: ParsedAction

  beforeEach(() => {
    mockAction = {
      id: 'action-1',
      actionType: 'transfer-flow',
      name: 'Transfer FLOW',
      parameters: [
        { name: 'amount', type: 'UFix64', value: '10.0', required: true },
        { name: 'recipient', type: 'Address', value: '0x1234567890abcdef', required: true }
      ],
      nextActions: [],
      position: { x: 0, y: 0 }
    }

    mockWorkflow = {
      actions: [mockAction],
      executionOrder: ['action-1'],
      rootActions: ['action-1'],
      metadata: {
        totalActions: 1,
        totalConnections: 0,
        createdAt: new Date().toISOString(),
        name: 'Test Workflow'
      }
    }
  })

  describe('generateProductionTransaction', () => {
    it('should generate production-ready Cadence code', async () => {
      const options: Partial<ProductionCadenceGenerationOptions> = {
        targetNetwork: 'testnet',
        enableResourceSafety: true,
        enableSecurityChecks: true
      }

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(mockWorkflow, options)

      expect(result.success).toBe(true)
      expect(result.code).toContain('transaction()')
      expect(result.code).toContain('prepare(')
      expect(result.code).toContain('execute')
      expect(result.code).toContain('Production-Ready Flow Transaction')
      expect(result.validationResult.isValid).toBe(true)
    })

    it('should include security checks when enabled', async () => {
      const options: Partial<ProductionCadenceGenerationOptions> = {
        enableSecurityChecks: true,
        targetNetwork: 'mainnet'
      }

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(mockWorkflow, options)

      expect(result.code).toContain('assert(')
      expect(result.code).toContain('Pre-execution safety checks')
    })

    it('should validate required parameters', async () => {
      // Create workflow with missing required parameter
      const invalidAction = {
        ...mockAction,
        parameters: [
          { name: 'amount', type: 'UFix64', value: '', required: true }, // Missing value
          { name: 'recipient', type: 'Address', value: '0x1234567890abcdef', required: true }
        ]
      }

      const invalidWorkflow = {
        ...mockWorkflow,
        actions: [invalidAction]
      }

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(invalidWorkflow)

      expect(result.validationResult.errors.some(e => e.type === 'MISSING_REQUIRED_PARAMETER')).toBe(true)
    })

    it('should validate Flow address format', async () => {
      const invalidAction = {
        ...mockAction,
        parameters: [
          { name: 'amount', type: 'UFix64', value: '10.0', required: true },
          { name: 'recipient', type: 'Address', value: 'invalid-address', required: true }
        ]
      }

      const invalidWorkflow = {
        ...mockWorkflow,
        actions: [invalidAction]
      }

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(invalidWorkflow)

      expect(result.validationResult.errors.some(e => e.type === 'INVALID_PARAMETER_TYPE')).toBe(true)
    })

    it('should estimate gas usage', async () => {
      const result = await EnhancedCadenceGenerator.generateProductionTransaction(mockWorkflow)

      expect(result.validationResult.gasEstimate).toBeGreaterThan(0)
      expect(result.validationResult.resourceUsage.computationUsed).toBeGreaterThan(0)
    })

    it('should detect circular dependencies', async () => {
      // Create workflow with circular dependency
      const action1 = { ...mockAction, id: 'action-1', nextActions: ['action-2'] }
      const action2 = { ...mockAction, id: 'action-2', nextActions: ['action-1'] }

      const circularWorkflow = {
        ...mockWorkflow,
        actions: [action1, action2],
        executionOrder: ['action-1', 'action-2']
      }

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(circularWorkflow)

      expect(result.validationResult.errors.some(e => e.type === 'CIRCULAR_DEPENDENCY')).toBe(true)
    })
  })

  describe('Flow type conversion', () => {
    it('should convert JavaScript values to Flow types', () => {
      expect(EnhancedCadenceGenerator.convertToFlowType('10.5', 'UFix64')).toBe('10.50000000')
      expect(EnhancedCadenceGenerator.convertToFlowType('0x1234567890abcdef', 'Address')).toBe('0x1234567890abcdef')
      expect(EnhancedCadenceGenerator.convertToFlowType('true', 'Bool')).toBe(true)
      expect(EnhancedCadenceGenerator.convertToFlowType('42', 'UInt64')).toBe('42')
    })

    it('should validate Flow type values', () => {
      expect(EnhancedCadenceGenerator.validateFlowType('0x1234567890abcdef', 'Address')).toBe(true)
      expect(EnhancedCadenceGenerator.validateFlowType('invalid-address', 'Address')).toBe(false)
      expect(EnhancedCadenceGenerator.validateFlowType('10.5', 'UFix64')).toBe(true)
      expect(EnhancedCadenceGenerator.validateFlowType('-5.0', 'UFix64')).toBe(false)
      expect(EnhancedCadenceGenerator.validateFlowType(true, 'Bool')).toBe(true)
      expect(EnhancedCadenceGenerator.validateFlowType('not-boolean', 'Bool')).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle action discovery failures gracefully', async () => {
      // Mock action discovery to fail
      vi.mocked(require('../action-discovery-service').getDefaultActionDiscoveryService).mockReturnValue({
        getAction: vi.fn().mockRejectedValue(new Error('Discovery failed'))
      })

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(mockWorkflow)

      // Should still generate code using fallback methods
      expect(result.success).toBe(true)
      expect(result.code).toContain('transaction()')
    })

    it('should return error transaction for critical failures', async () => {
      // Create workflow that will cause validation failure
      const invalidWorkflow = {
        ...mockWorkflow,
        actions: [] // Empty actions array
      }

      const result = await EnhancedCadenceGenerator.generateProductionTransaction(invalidWorkflow)

      expect(result.success).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})