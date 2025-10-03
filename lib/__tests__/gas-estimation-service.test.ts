import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { GasEstimationService } from '../gas-estimation-service'
import { FlowEmulatorService } from '../flow-emulator-service'
import { 
  ParsedWorkflow, 
  ActionMetadata, 
  SecurityLevel,
  SimulationResult 
} from '../types'

// Mock the FlowEmulatorService
vi.mock('../flow-emulator-service')

describe('GasEstimationService', () => {
  let gasEstimationService: GasEstimationService
  let mockEmulatorService: FlowEmulatorService
  let mockWorkflow: ParsedWorkflow
  let mockActionMetadata: ActionMetadata[]

  beforeEach(() => {
    mockEmulatorService = new FlowEmulatorService() as any
    gasEstimationService = new GasEstimationService(mockEmulatorService)

    // Mock workflow
    mockWorkflow = {
      actions: [
        {
          id: 'action1',
          actionType: 'swap-action',
          name: 'Token Swap',
          parameters: [
            { name: 'tokenIn', type: 'string', value: 'FLOW', required: true },
            { name: 'tokenOut', type: 'string', value: 'USDC', required: true },
            { name: 'amountIn', type: 'number', value: '100', required: true }
          ],
          nextActions: ['action2'],
          position: { x: 0, y: 0 }
        },
        {
          id: 'action2',
          actionType: 'stake-action',
          name: 'Stake Tokens',
          parameters: [
            { name: 'amount', type: 'number', value: '50', required: true },
            { name: 'validator', type: 'string', value: 'validator1', required: true }
          ],
          nextActions: [],
          position: { x: 100, y: 0 }
        }
      ],
      executionOrder: ['action1', 'action2'],
      rootActions: ['action1'],
      metadata: {
        totalActions: 2,
        totalConnections: 1,
        createdAt: '2024-01-01T00:00:00Z',
        name: 'Test Workflow'
      }
    }

    // Mock action metadata
    mockActionMetadata = [
      {
        id: 'swap-action',
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
          supportedNetworks: ['mainnet', 'testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1200,
        securityLevel: SecurityLevel.MEDIUM,
        author: 'test',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'stake-action',
        name: 'Stake Tokens',
        description: 'Stake tokens with validator',
        category: 'Staking',
        version: '1.0.0',
        inputs: [
          { name: 'amount', type: 'number', required: true },
          { name: 'validator', type: 'string', required: true }
        ],
        outputs: [
          { name: 'stakingReceipt', type: 'string' }
        ],
        parameters: [],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['mainnet', 'testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 2000,
        securityLevel: SecurityLevel.HIGH,
        author: 'test',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ]
  })

  describe('analyzeWorkflowCosts', () => {
    it('should provide comprehensive cost analysis', async () => {
      const mockSimulationResult: SimulationResult = {
        success: true,
        gasUsed: 1300,
        balanceChanges: [],
        events: [],
        errors: [],
        warnings: [],
        executionTime: 1000
      }

      ;(mockEmulatorService.simulateWorkflow as Mock).mockResolvedValue(mockSimulationResult)

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        mockActionMetadata,
        {
          useHistoricalData: true,
          runSimulation: true,
          includeOptimizations: true,
          includeGasCosts: true,
          bufferPercentage: 10,
          checkAllTokens: true
        }
      )

      expect(result).toHaveProperty('gasEstimate')
      expect(result).toHaveProperty('balanceRequirements')
      expect(result).toHaveProperty('optimizations')
      expect(result).toHaveProperty('feasibilityScore')
      expect(result).toHaveProperty('recommendations')

      expect(result.gasEstimate.totalGas).toBeGreaterThan(0)
      expect(result.feasibilityScore).toBeGreaterThanOrEqual(0)
      expect(result.feasibilityScore).toBeLessThanOrEqual(100)
      expect(Array.isArray(result.balanceRequirements)).toBe(true)
      expect(Array.isArray(result.optimizations)).toBe(true)
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should handle missing action metadata gracefully', async () => {
      const incompleteMetadata = [mockActionMetadata[0]] // Missing second action metadata

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        incompleteMetadata
      )

      expect(result.gasEstimate.warnings).toContain('No metadata found for action action2')
      expect(result.feasibilityScore).toBeLessThan(100)
    })

    it('should calculate total cost in USD when gas price provided', async () => {
      const gasPrice = 0.001 // $0.001 per gas unit

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        mockActionMetadata,
        { gasPrice }
      )

      expect(result.totalCostUSD).toBeDefined()
      expect(result.totalCostUSD).toBeGreaterThan(0)
      expect(result.totalCostUSD).toBe(result.gasEstimate.totalGas * gasPrice)
    })
  })

  describe('estimateWorkflowGas', () => {
    it('should estimate gas for all actions in workflow', async () => {
      const result = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        mockActionMetadata,
        { useHistoricalData: false, runSimulation: false, includeOptimizations: false }
      )

      expect(result.totalGas).toBeGreaterThan(0)
      expect(result.gasPerAction).toHaveProperty('action1')
      expect(result.gasPerAction).toHaveProperty('action2')
      expect(result.gasBreakdown).toHaveLength(2)
      expect(result.estimationMethod).toBe('static')
    })

    it('should use historical data when available', async () => {
      const result = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        mockActionMetadata,
        { useHistoricalData: true, runSimulation: false, includeOptimizations: false }
      )

      expect(result.estimationMethod).toBe('historical')
      expect(result.confidence).toBeGreaterThan(0.5)
      
      // Check that historical data influenced the estimate
      const swapActionBreakdown = result.gasBreakdown.find(b => b.actionId === 'action1')
      expect(swapActionBreakdown?.factors.some(f => f.description.includes('historical'))).toBe(true)
    })

    it('should use simulation when requested', async () => {
      const mockSimulationResult: SimulationResult = {
        success: true,
        gasUsed: 1300,
        balanceChanges: [],
        events: [],
        errors: [],
        warnings: [],
        executionTime: 1000
      }

      ;(mockEmulatorService.simulateWorkflow as Mock).mockResolvedValue(mockSimulationResult)

      const result = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        mockActionMetadata,
        { useHistoricalData: false, runSimulation: true, includeOptimizations: false }
      )

      expect(result.estimationMethod).toBe('simulation')
      expect(result.confidence).toBeGreaterThan(0.8)
    })

    it('should apply network condition multipliers', async () => {
      const lowConditionResult = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        mockActionMetadata,
        { 
          useHistoricalData: false, 
          runSimulation: false, 
          includeOptimizations: false,
          networkConditions: 'low'
        }
      )

      const highConditionResult = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        mockActionMetadata,
        { 
          useHistoricalData: false, 
          runSimulation: false, 
          includeOptimizations: false,
          networkConditions: 'high'
        }
      )

      expect(highConditionResult.totalGas).toBeGreaterThan(lowConditionResult.totalGas)
    })

    it('should generate warnings for high gas usage', async () => {
      // Create a workflow with high gas usage
      const highGasMetadata = mockActionMetadata.map(m => ({
        ...m,
        gasEstimate: 600000 // High gas estimate
      }))

      const result = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        highGasMetadata,
        { useHistoricalData: false, runSimulation: false, includeOptimizations: false }
      )

      expect(result.warnings).toContain('High gas usage detected. Consider breaking workflow into smaller parts.')
    })
  })

  describe('calculateBalanceRequirements', () => {
    it('should calculate token requirements from workflow actions', async () => {
      const mockGasEstimate = {
        totalGas: 3200,
        gasPerAction: { action1: 1200, action2: 2000 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.calculateBalanceRequirements(
        mockWorkflow,
        mockActionMetadata,
        mockGasEstimate,
        { includeGasCosts: true, bufferPercentage: 10, checkAllTokens: true }
      )

      expect(result).toHaveLength(1) // Should have FLOW requirement
      expect(result[0].token).toBe('FLOW')
      expect(parseFloat(result[0].minimumRequired)).toBeGreaterThan(0)
    })

    it('should apply buffer percentage correctly', async () => {
      const mockGasEstimate = {
        totalGas: 1000,
        gasPerAction: {},
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result10Percent = await gasEstimationService.calculateBalanceRequirements(
        mockWorkflow,
        mockActionMetadata,
        mockGasEstimate,
        { includeGasCosts: true, bufferPercentage: 10, checkAllTokens: true }
      )

      const result20Percent = await gasEstimationService.calculateBalanceRequirements(
        mockWorkflow,
        mockActionMetadata,
        mockGasEstimate,
        { includeGasCosts: true, bufferPercentage: 20, checkAllTokens: true }
      )

      const required10 = parseFloat(result10Percent[0].minimumRequired)
      const required20 = parseFloat(result20Percent[0].minimumRequired)

      expect(required20).toBeGreaterThan(required10)
    })

    it('should identify insufficient balances', async () => {
      const mockGasEstimate = {
        totalGas: 10000000, // Very high gas requirement
        gasPerAction: {},
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.calculateBalanceRequirements(
        mockWorkflow,
        mockActionMetadata,
        mockGasEstimate,
        { includeGasCosts: true, bufferPercentage: 10, checkAllTokens: true }
      )

      const flowRequirement = result.find(r => r.token === 'FLOW')
      expect(flowRequirement?.isInsufficient).toBe(true)
      expect(parseFloat(flowRequirement?.deficit || '0')).toBeGreaterThan(0)
    })
  })

  describe('generateCostOptimizations', () => {
    it('should suggest reordering optimizations', async () => {
      const mockGasEstimate = {
        totalGas: 3200,
        gasPerAction: { action1: 2000, action2: 1200 }, // action2 is cheaper
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.generateCostOptimizations(
        mockWorkflow,
        mockActionMetadata,
        mockGasEstimate
      )

      const reorderOptimization = result.find(opt => opt.type === 'reorder')
      expect(reorderOptimization).toBeDefined()
      expect(reorderOptimization?.estimatedSavings).toBeGreaterThan(0)
    })

    it('should suggest batching optimizations for same category actions', async () => {
      // Create workflow with multiple DeFi actions
      const defiWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          { ...mockWorkflow.actions[0], id: 'defi1', actionType: 'swap-action' },
          { ...mockWorkflow.actions[0], id: 'defi2', actionType: 'swap-action' },
          { ...mockWorkflow.actions[0], id: 'defi3', actionType: 'swap-action' }
        ],
        executionOrder: ['defi1', 'defi2', 'defi3']
      }

      const mockGasEstimate = {
        totalGas: 3600,
        gasPerAction: { defi1: 1200, defi2: 1200, defi3: 1200 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.generateCostOptimizations(
        defiWorkflow,
        mockActionMetadata,
        mockGasEstimate
      )

      const batchOptimization = result.find(opt => opt.type === 'batch')
      expect(batchOptimization).toBeDefined()
      expect(batchOptimization?.actionIds).toHaveLength(3)
    })

    it('should suggest parallel execution optimizations', async () => {
      // Create workflow with independent actions
      const parallelWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          { ...mockWorkflow.actions[0], id: 'parallel1', nextActions: [] },
          { ...mockWorkflow.actions[1], id: 'parallel2', nextActions: [] }
        ],
        executionOrder: ['parallel1', 'parallel2']
      }

      const mockGasEstimate = {
        totalGas: 3200,
        gasPerAction: { parallel1: 1200, parallel2: 2000 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.generateCostOptimizations(
        parallelWorkflow,
        mockActionMetadata,
        mockGasEstimate
      )

      const parallelOptimization = result.find(opt => opt.type === 'parallel')
      expect(parallelOptimization).toBeDefined()
      expect(parallelOptimization?.actionIds).toHaveLength(2)
    })

    it('should sort optimizations by estimated savings', async () => {
      const mockGasEstimate = {
        totalGas: 3200,
        gasPerAction: { action1: 2000, action2: 1200 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.generateCostOptimizations(
        mockWorkflow,
        mockActionMetadata,
        mockGasEstimate
      )

      // Check that optimizations are sorted by savings (descending)
      for (let i = 0; i < result.length - 1; i++) {
        expect(result[i].estimatedSavings).toBeGreaterThanOrEqual(result[i + 1].estimatedSavings)
      }
    })
  })

  describe('feasibility scoring', () => {
    it('should give high scores to efficient workflows', async () => {
      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        mockActionMetadata,
        { useHistoricalData: true, runSimulation: false, includeOptimizations: false }
      )

      expect(result.feasibilityScore).toBeGreaterThan(70)
    })

    it('should penalize high gas usage', async () => {
      const highGasMetadata = mockActionMetadata.map(m => ({
        ...m,
        gasEstimate: 600000 // Very high gas
      }))

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        highGasMetadata
      )

      expect(result.feasibilityScore).toBeLessThan(70)
    })

    it('should penalize insufficient balances', async () => {
      const highGasMetadata = mockActionMetadata.map(m => ({
        ...m,
        gasEstimate: 1000000 // High enough to cause insufficient balance
      }))

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        highGasMetadata,
        { includeGasCosts: true, bufferPercentage: 10, checkAllTokens: true }
      )

      expect(result.feasibilityScore).toBeLessThan(50)
    })
  })

  describe('recommendations', () => {
    it('should recommend breaking up large workflows', async () => {
      const highGasMetadata = mockActionMetadata.map(m => ({
        ...m,
        gasEstimate: 600000
      }))

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        highGasMetadata
      )

      expect(result.recommendations).toContain(
        'Consider breaking this workflow into smaller parts to reduce gas costs'
      )
    })

    it('should recommend simulation for low confidence estimates', async () => {
      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        mockActionMetadata,
        { useHistoricalData: false, runSimulation: false, includeOptimizations: false }
      )

      expect(result.recommendations).toContain(
        'Run a simulation to get more accurate gas estimates'
      )
    })

    it('should recommend acquiring tokens for insufficient balances', async () => {
      const highGasMetadata = mockActionMetadata.map(m => ({
        ...m,
        gasEstimate: 1000000
      }))

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        highGasMetadata,
        { includeGasCosts: true, bufferPercentage: 10, checkAllTokens: true }
      )

      const tokenRecommendation = result.recommendations.find(r => 
        r.includes('Acquire') && r.includes('FLOW')
      )
      expect(tokenRecommendation).toBeDefined()
    })

    it('should recommend applying optimizations', async () => {
      const mockGasEstimate = {
        totalGas: 3200,
        gasPerAction: { action1: 2000, action2: 1200 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'static' as const,
        warnings: []
      }

      const result = await gasEstimationService.analyzeWorkflowCosts(
        mockWorkflow,
        mockActionMetadata,
        { includeOptimizations: true }
      )

      const optimizationRecommendation = result.recommendations.find(r => 
        r.includes('optimization') && r.includes('save')
      )
      expect(optimizationRecommendation).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('should handle simulation failures gracefully', async () => {
      ;(mockEmulatorService.simulateWorkflow as Mock).mockRejectedValue(
        new Error('Simulation failed')
      )

      const result = await gasEstimationService.estimateWorkflowGas(
        mockWorkflow,
        mockActionMetadata,
        { useHistoricalData: false, runSimulation: true, includeOptimizations: false }
      )

      // Should fall back to static estimation
      expect(result.totalGas).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThan(0.9) // Lower confidence due to simulation failure
    })

    it('should handle missing action metadata', async () => {
      const incompleteWorkflow: ParsedWorkflow = {
        ...mockWorkflow,
        actions: [
          ...mockWorkflow.actions,
          {
            id: 'unknown-action',
            actionType: 'unknown-type',
            name: 'Unknown Action',
            parameters: [],
            nextActions: [],
            position: { x: 200, y: 0 }
          }
        ],
        executionOrder: ['action1', 'action2', 'unknown-action']
      }

      const result = await gasEstimationService.estimateWorkflowGas(
        incompleteWorkflow,
        mockActionMetadata,
        { useHistoricalData: false, runSimulation: false, includeOptimizations: false }
      )

      expect(result.warnings).toContain('No metadata found for action unknown-action')
      expect(result.gasBreakdown).toHaveLength(2) // Only known actions
    })
  })
})