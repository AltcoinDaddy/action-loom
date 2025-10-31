/**
 * Tests for Transaction Manager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FlowTransactionManager, Transaction, TransactionStatus } from '../transaction-manager'
import { FlowNetworkConfig, ParsedWorkflow, ParsedAction } from '../types'

// Mock FCL
vi.mock('@onflow/fcl', () => ({
  config: vi.fn(),
  mutate: vi.fn(),
  tx: vi.fn(),
  currentUser: {
    snapshot: vi.fn().mockResolvedValue({ addr: '0x1234567890abcdef' })
  },
  authz: vi.fn()
}))

// Mock Enhanced Cadence Generator
vi.mock('../enhanced-cadence-generator', () => ({
  EnhancedCadenceGenerator: {
    generateProductionTransaction: vi.fn().mockResolvedValue({
      success: true,
      code: 'transaction() { prepare(signer: auth(Storage) &Account) {} execute {} }',
      errors: [],
      warnings: [],
      validationResult: {
        gasEstimate: 500,
        isValid: true,
        errors: [],
        warnings: []
      }
    })
  }
}))

describe('FlowTransactionManager', () => {
  let transactionManager: FlowTransactionManager
  let mockNetworkConfig: FlowNetworkConfig
  let mockWorkflow: ParsedWorkflow
  let mockAction: ParsedAction

  beforeEach(() => {
    mockNetworkConfig = {
      name: 'testnet',
      chainId: 'flow-testnet',
      accessNode: 'https://rest-testnet.onflow.org',
      walletDiscovery: 'https://fcl-discovery.onflow.org/testnet/authn',
      fclConfig: {
        'accessNode.api': 'https://rest-testnet.onflow.org',
        'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
        'discovery.authn': 'https://fcl-discovery.onflow.org/testnet/authn',
        'app.detail.title': 'ActionLoom',
        'app.detail.icon': '/logo.png'
      }
    }

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

    transactionManager = new FlowTransactionManager(mockNetworkConfig)
  })

  describe('buildTransaction', () => {
    it('should build a transaction from workflow', async () => {
      const transaction = await transactionManager.buildTransaction(mockWorkflow)

      expect(transaction).toBeDefined()
      expect(transaction.id).toBeDefined()
      expect(transaction.cadenceCode).toContain('transaction()')
      expect(transaction.gasLimit).toBeGreaterThan(0)
      expect(transaction.proposer).toBe('0x1234567890abcdef')
      expect(transaction.authorizers).toContain('0x1234567890abcdef')
      expect(transaction.payer).toBe('0x1234567890abcdef')
    })

    it('should build transaction arguments from workflow parameters', async () => {
      const transaction = await transactionManager.buildTransaction(mockWorkflow)

      expect(transaction.arguments).toBeDefined()
      expect(transaction.arguments.length).toBeGreaterThan(0)
      
      const amountArg = transaction.arguments.find(arg => arg.name === 'amount')
      expect(amountArg).toBeDefined()
      expect(amountArg?.value).toBe(10.0)
    })

    it('should set transaction metadata', async () => {
      const transaction = await transactionManager.buildTransaction(mockWorkflow)

      expect(transaction.metadata).toBeDefined()
      expect(transaction.metadata?.workflowId).toBe('Test Workflow')
      expect(transaction.metadata?.actionCount).toBe(1)
      expect(transaction.metadata?.network).toBe('testnet')
    })

    it('should handle custom build options', async () => {
      const options = {
        gasLimit: 2000,
        network: 'mainnet' as const,
        proposer: '0xabcdef1234567890'
      }

      const transaction = await transactionManager.buildTransaction(mockWorkflow, options)

      expect(transaction.gasLimit).toBe(2000)
      expect(transaction.proposer).toBe('0xabcdef1234567890')
      expect(transaction.metadata?.network).toBe('mainnet')
    })
  })

  describe('executeTransaction', () => {
    let mockTransaction: Transaction

    beforeEach(() => {
      mockTransaction = {
        id: 'tx-123',
        cadenceCode: 'transaction() { prepare(signer: auth(Storage) &Account) {} execute {} }',
        arguments: [],
        gasLimit: 1000,
        proposer: '0x1234567890abcdef',
        authorizers: ['0x1234567890abcdef'],
        payer: '0x1234567890abcdef'
      }
    })

    it('should execute transaction successfully', async () => {
      const mockTxId = 'flow-tx-123'
      
      // Mock FCL mutate to return transaction ID
      vi.mocked(require('@onflow/fcl').mutate).mockResolvedValue(mockTxId)
      
      // Mock FCL tx to return sealed transaction
      vi.mocked(require('@onflow/fcl').tx).mockReturnValue({
        snapshot: vi.fn().mockResolvedValue({
          status: 4, // SEALED
          gasUsed: 500,
          blockId: '0xabc123',
          events: []
        })
      })

      const result = await transactionManager.executeTransaction(mockTransaction)

      expect(result.transactionId).toBe('tx-123')
      expect(result.status).toBe(TransactionStatus.SEALED)
      expect(result.gasUsed).toBe(500)
      expect(result.executionTime).toBeGreaterThan(0)
    })

    it('should handle transaction failures', async () => {
      // Mock FCL mutate to throw error
      vi.mocked(require('@onflow/fcl').mutate).mockRejectedValue(new Error('Transaction failed'))

      const result = await transactionManager.executeTransaction(mockTransaction)

      expect(result.status).toBe(TransactionStatus.FAILED)
      expect(result.error).toContain('Transaction failed')
    })

    it('should retry failed transactions', async () => {
      let callCount = 0
      
      // Mock FCL mutate to fail twice then succeed
      vi.mocked(require('@onflow/fcl').mutate).mockImplementation(() => {
        callCount++
        if (callCount <= 2) {
          throw new Error('Network error')
        }
        return Promise.resolve('flow-tx-123')
      })

      // Mock successful transaction monitoring
      vi.mocked(require('@onflow/fcl').tx).mockReturnValue({
        snapshot: vi.fn().mockResolvedValue({
          status: 4, // SEALED
          gasUsed: 500,
          events: []
        })
      })

      const result = await transactionManager.executeTransaction(mockTransaction)

      expect(callCount).toBe(3) // Should have retried twice
      expect(result.status).toBe(TransactionStatus.SEALED)
    })
  })

  describe('simulateTransaction', () => {
    it('should simulate transaction execution', async () => {
      const mockTransaction: Transaction = {
        id: 'tx-sim-123',
        cadenceCode: 'transaction() { prepare(signer: auth(Storage) &Account) {} execute {} }',
        arguments: [],
        gasLimit: 1000,
        proposer: '0x1234567890abcdef',
        authorizers: ['0x1234567890abcdef'],
        payer: '0x1234567890abcdef'
      }

      // Mock FCL query for simulation
      vi.mocked(require('@onflow/fcl').query).mockResolvedValue({ success: true })

      const result = await transactionManager.simulateTransaction(mockTransaction)

      expect(result.transactionId).toBe('tx-sim-123')
      expect(result.status).toBe(TransactionStatus.EXECUTED)
      expect(result.gasUsed).toBeGreaterThan(0)
    })

    it('should handle simulation failures', async () => {
      const mockTransaction: Transaction = {
        id: 'tx-sim-fail',
        cadenceCode: 'invalid cadence code',
        arguments: [],
        gasLimit: 1000,
        proposer: '0x1234567890abcdef',
        authorizers: ['0x1234567890abcdef'],
        payer: '0x1234567890abcdef'
      }

      // Mock FCL query to throw error
      vi.mocked(require('@onflow/fcl').query).mockRejectedValue(new Error('Simulation failed'))

      const result = await transactionManager.simulateTransaction(mockTransaction)

      expect(result.status).toBe(TransactionStatus.FAILED)
      expect(result.error).toContain('Simulation failed')
    })
  })

  describe('getTransactionStatus', () => {
    it('should return cached transaction status', async () => {
      const mockResult = {
        transactionId: 'tx-cached',
        status: TransactionStatus.SEALED,
        events: [],
        gasUsed: 300,
        blockHeight: 12345,
        timestamp: new Date(),
        executionTime: 5000
      }

      // Add to history manually (simulating previous execution)
      transactionManager['transactionHistory'].set('tx-cached', mockResult)

      const result = await transactionManager.getTransactionStatus('tx-cached')

      expect(result).toEqual(mockResult)
    })

    it('should query Flow network for unknown transactions', async () => {
      // Mock FCL tx to return transaction data
      vi.mocked(require('@onflow/fcl').tx).mockReturnValue({
        snapshot: vi.fn().mockResolvedValue({
          status: 4, // SEALED
          gasUsed: 400,
          blockId: '0xdef456',
          events: []
        })
      })

      const result = await transactionManager.getTransactionStatus('tx-unknown')

      expect(result).toBeDefined()
      expect(result?.transactionId).toBe('tx-unknown')
      expect(result?.status).toBe(TransactionStatus.SEALED)
      expect(result?.gasUsed).toBe(400)
    })

    it('should return null for non-existent transactions', async () => {
      // Mock FCL tx to throw error
      vi.mocked(require('@onflow/fcl').tx).mockReturnValue({
        snapshot: vi.fn().mockRejectedValue(new Error('Transaction not found'))
      })

      const result = await transactionManager.getTransactionStatus('tx-nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('executeSequence', () => {
    it('should execute transactions in sequence', async () => {
      const transaction1: Transaction = {
        id: 'tx-1',
        cadenceCode: 'transaction() {}',
        arguments: [],
        gasLimit: 500,
        proposer: '0x1234567890abcdef',
        authorizers: ['0x1234567890abcdef'],
        payer: '0x1234567890abcdef'
      }

      const transaction2: Transaction = {
        id: 'tx-2',
        cadenceCode: 'transaction() {}',
        arguments: [],
        gasLimit: 600,
        proposer: '0x1234567890abcdef',
        authorizers: ['0x1234567890abcdef'],
        payer: '0x1234567890abcdef'
      }

      const sequence = {
        transactions: [transaction1, transaction2],
        dependencies: [],
        executionOrder: ['tx-1', 'tx-2']
      }

      // Mock successful executions
      vi.mocked(require('@onflow/fcl').mutate)
        .mockResolvedValueOnce('flow-tx-1')
        .mockResolvedValueOnce('flow-tx-2')

      vi.mocked(require('@onflow/fcl').tx).mockReturnValue({
        snapshot: vi.fn().mockResolvedValue({
          status: 4, // SEALED
          gasUsed: 300,
          events: []
        })
      })

      const result = await transactionManager.executeSequence(sequence)

      expect(result.transactions).toHaveLength(2)
      expect(result.successCount).toBe(2)
      expect(result.failureCount).toBe(0)
      expect(result.totalGasUsed).toBe(600) // 300 * 2
    })
  })
})