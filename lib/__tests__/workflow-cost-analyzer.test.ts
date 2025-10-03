import { describe, it, expect, beforeEach, vi, Mock } from 'vitest'
import { WorkflowCostAnalyzer } from '../workflow-cost-analyzer'
import { WorkflowCompatibilityService } from '../workflow-compatibility-service'
import { FlowEmulatorService } from '../flow-emulator-service'
import { GasEstimationService } from '../gas-estimation-service'
import { 
  ParsedWorkflow, 
  ActionMetadata, 
  SecurityLevel,
  SimulationResult 
} from '../types'

// Mock the services
vi.mock('../workflow-compatibility-service')
vi.mock('../flow-emulator-service')
vi.mock('../gas-estimation-service')

describe('WorkflowCostAnalyzer', () => {
  let analyzer: WorkflowCostAnalyzer
  let mockCompatibilityService: WorkflowCompatibilityService
  let mockEmulatorService: FlowEmulatorService
  let mockGasEstimationService: GasEstimationService
  let mockWorkflow: ParsedWorkflow
  let mockActionMetadata: ActionMetadata[]

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    analyzer = new WorkflowCostAnalyzer()
    
    // Get mock instances
    mockCompatibilityService = (analyzer as any).compatibilityService
    mockEmulatorService = (analyzer as any).emulatorService
    mockGasEstimationService = (analyzer as any).gasEstimationService

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
            { name: 'amount', type: 'number', value: '50', required: true }
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
          { name: 'amount', type: 'number', required: true }
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

    // Setup default mock responses
    ;(mockCompatibilityService.checkWorkflowCompatibility as Mock).mockResolvedValue({
      isValid: true,
      typeCompatibility: {
        compatible: true,
        issues: [],
        suggestions: []
      },
      dependencyGraph: {
        nodes: new Map(),
        edges: [],
        cycles: [],
        maxDepth: 2
      },
      circularDependencies: [],
      errors: [],
      warnings: []
    })

    ;(mockEmulatorService.simulateWorkflow as Mock).mockResolvedValue({
      success: true,
      gasUsed: 3200,
      balanceChanges: [],
      events: [],
      errors: [],
      warnings: [],
      executionTime: 1000
    })

    ;(mockGasEstimationService.analyzeWorkflowCosts as Mock).mockResolvedValue({
      gasEstimate: {
        totalGas: 3200,
        gasPerAction: { action1: 1200, action2: 2000 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'simulation',
        warnings: []
      },
      balanceRequirements: [
        {
          token: 'FLOW',
          minimumRequired: '110.0',
          currentBalance: '1000.0',
          deficit: '0.0',
          isInsufficient: false,
          address: '0x01cf0e2f2f715450'
        }
      ],
      optimizations: [],
      feasibilityScore: 85,
      recommendations: ['Workflow looks good for execution']
    })
  })

  describe('analyzeWorkflow', () => {
    it('should perform comprehensive workflow analysis', async () => {
      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result).toHaveProperty('workflow')
      expect(result).toHaveProperty('compatibilityResult')
      expect(result).toHaveProperty('simulationResult')
      expect(result).toHaveProperty('gasAnalysis')
      expect(result).toHaveProperty('overallScore')
      expect(result).toHaveProperty('criticalIssues')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('executionReadiness')

      expect(result.overallScore).toBeGreaterThanOrEqual(0)
      expect(result.overallScore).toBeLessThanOrEqual(100)
      expect(Array.isArray(result.criticalIssues)).toBe(true)
      expect(Array.isArray(result.recommendations)).toBe(true)
      expect(['ready', 'needs_review', 'not_ready']).toContain(result.executionReadiness)
    })

    it('should create enhanced workflow with validation results', async () => {
      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result.workflow).toHaveProperty('validationResults')
      expect(result.workflow).toHaveProperty('simulationResults')
      expect(result.workflow).toHaveProperty('securityLevel')
      expect(result.workflow).toHaveProperty('estimatedGas')
      expect(result.workflow).toHaveProperty('requiredBalance')

      expect(result.workflow.estimatedGas).toBeGreaterThan(0)
      expect(Array.isArray(result.workflow.requiredBalance)).toBe(true)
    })

    it('should handle compatibility issues', async () => {
      ;(mockCompatibilityService.checkWorkflowCompatibility as Mock).mockResolvedValue({
        isValid: false,
        typeCompatibility: {
          compatible: false,
          issues: [
            {
              sourceActionId: 'action1',
              targetActionId: 'action2',
              issue: 'Type mismatch',
              suggestion: 'Add converter action'
            }
          ],
          suggestions: ['Add converter action']
        },
        dependencyGraph: { nodes: new Map(), edges: [], cycles: [], maxDepth: 2 },
        circularDependencies: [],
        errors: [
          {
            type: 'TYPE_COMPATIBILITY',
            message: 'Type mismatch between actions',
            severity: 'error'
          }
        ],
        warnings: []
      })

      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result.overallScore).toBeLessThan(80)
      expect(result.criticalIssues.length).toBeGreaterThan(0)
      expect(result.executionReadiness).toBe('not_ready')
    })

    it('should handle simulation failures gracefully', async () => {
      ;(mockEmulatorService.simulateWorkflow as Mock).mockRejectedValue(
        new Error('Simulation failed')
      )

      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata, {
        runSimulation: true,
        includeOptimizations: true,
        bufferPercentage: 10
      })

      expect(result.simulationResult).toBeUndefined()
      expect(result.overallScore).toBeGreaterThan(0) // Should still provide analysis
    })

    it('should skip simulation when not requested', async () => {
      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata, {
        runSimulation: false,
        includeOptimizations: true,
        bufferPercentage: 10
      })

      expect(result.simulationResult).toBeUndefined()
      expect(mockEmulatorService.simulateWorkflow).not.toHaveBeenCalled()
    })

    it('should identify critical issues correctly', async () => {
      // Mock insufficient balance
      ;(mockGasEstimationService.analyzeWorkflowCosts as Mock).mockResolvedValue({
        gasEstimate: {
          totalGas: 1200000, // High gas usage
          gasPerAction: {},
          gasBreakdown: [],
          confidence: 0.8,
          estimationMethod: 'simulation',
          warnings: []
        },
        balanceRequirements: [
          {
            token: 'FLOW',
            minimumRequired: '2000.0',
            currentBalance: '100.0',
            deficit: '1900.0',
            isInsufficient: true,
            address: '0x01cf0e2f2f715450'
          }
        ],
        optimizations: [],
        feasibilityScore: 25,
        recommendations: []
      })

      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result.criticalIssues).toContain('Insufficient balance for 1 token(s)')
      expect(result.criticalIssues).toContain('Gas usage exceeds recommended limits')
      expect(result.criticalIssues).toContain('Workflow feasibility is critically low')
      expect(result.executionReadiness).toBe('not_ready')
    })

    it('should calculate security level from actions', async () => {
      const criticalActionMetadata = [
        {
          ...mockActionMetadata[0],
          securityLevel: 'critical' as any
        },
        mockActionMetadata[1]
      ]

      const result = await analyzer.analyzeWorkflow(mockWorkflow, criticalActionMetadata)

      expect(result.workflow.securityLevel).toBe('critical')
    })
  })

  describe('quickCostEstimate', () => {
    it('should provide quick cost estimate', async () => {
      ;(mockGasEstimationService.estimateWorkflowGas as Mock).mockResolvedValue({
        totalGas: 3200,
        gasPerAction: { action1: 1200, action2: 2000 },
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'historical',
        warnings: []
      })

      ;(mockGasEstimationService.calculateBalanceRequirements as Mock).mockResolvedValue([
        {
          token: 'FLOW',
          minimumRequired: '110.0',
          currentBalance: '1000.0',
          deficit: '0.0',
          isInsufficient: false,
          address: '0x01cf0e2f2f715450'
        }
      ])

      const result = await analyzer.quickCostEstimate(mockWorkflow, mockActionMetadata)

      expect(result).toHaveProperty('estimatedGas')
      expect(result).toHaveProperty('feasible')
      expect(result).toHaveProperty('warnings')

      expect(result.estimatedGas).toBe(3200)
      expect(result.feasible).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('should identify infeasible workflows', async () => {
      ;(mockGasEstimationService.estimateWorkflowGas as Mock).mockResolvedValue({
        totalGas: 1200000, // High gas
        gasPerAction: {},
        gasBreakdown: [],
        confidence: 0.8,
        estimationMethod: 'historical',
        warnings: ['High gas usage']
      })

      ;(mockGasEstimationService.calculateBalanceRequirements as Mock).mockResolvedValue([
        {
          token: 'FLOW',
          minimumRequired: '2000.0',
          currentBalance: '100.0',
          deficit: '1900.0',
          isInsufficient: true,
          address: '0x01cf0e2f2f715450'
        }
      ])

      const result = await analyzer.quickCostEstimate(mockWorkflow, mockActionMetadata)

      expect(result.feasible).toBe(false)
      expect(result.warnings).toContain('High gas usage')
    })
  })

  describe('compareWorkflows', () => {
    it('should compare multiple workflows and rank them', async () => {
      const workflows = [
        { name: 'Workflow A', workflow: mockWorkflow },
        { name: 'Workflow B', workflow: { ...mockWorkflow, actions: [mockWorkflow.actions[0]] } }
      ]

      // Mock different scores for comparison
      ;(mockGasEstimationService.analyzeWorkflowCosts as Mock)
        .mockResolvedValueOnce({
          gasEstimate: { totalGas: 3200, gasPerAction: {}, gasBreakdown: [], confidence: 0.8, estimationMethod: 'simulation', warnings: [] },
          balanceRequirements: [],
          optimizations: [],
          feasibilityScore: 85,
          recommendations: []
        })
        .mockResolvedValueOnce({
          gasEstimate: { totalGas: 1200, gasPerAction: {}, gasBreakdown: [], confidence: 0.9, estimationMethod: 'simulation', warnings: [] },
          balanceRequirements: [],
          optimizations: [],
          feasibilityScore: 95,
          recommendations: []
        })

      const result = await analyzer.compareWorkflows(workflows, mockActionMetadata, {
        runSimulation: true,
        includeOptimizations: true,
        bufferPercentage: 10
      })

      expect(result).toHaveProperty('comparisons')
      expect(result).toHaveProperty('recommendation')

      expect(result.comparisons).toHaveLength(2)
      expect(result.comparisons[0].rank).toBe(1)
      expect(result.comparisons[1].rank).toBe(2)

      // Better workflow should be ranked first
      expect(result.comparisons[0].analysis.overallScore).toBeGreaterThanOrEqual(
        result.comparisons[1].analysis.overallScore
      )

      expect(result.recommendation).toContain('Recommended workflow:')
    })
  })

  describe('generateOptimizationReport', () => {
    it('should generate optimization report with savings', async () => {
      ;(mockGasEstimationService.analyzeWorkflowCosts as Mock).mockResolvedValue({
        gasEstimate: {
          totalGas: 5000,
          gasPerAction: {},
          gasBreakdown: [],
          confidence: 0.8,
          estimationMethod: 'simulation',
          warnings: []
        },
        balanceRequirements: [],
        optimizations: [
          {
            type: 'reorder',
            description: 'Reorder actions for efficiency',
            estimatedSavings: 500,
            confidence: 0.8,
            actionIds: ['action1', 'action2']
          },
          {
            type: 'batch',
            description: 'Batch similar actions',
            estimatedSavings: 300,
            confidence: 0.7,
            actionIds: ['action1']
          }
        ],
        feasibilityScore: 85,
        recommendations: []
      })

      const result = await analyzer.generateOptimizationReport(mockWorkflow, mockActionMetadata)

      expect(result).toHaveProperty('currentCost')
      expect(result).toHaveProperty('optimizedCost')
      expect(result).toHaveProperty('savings')
      expect(result).toHaveProperty('optimizations')

      expect(result.currentCost).toBe(5000)
      expect(result.savings).toBe(800) // 500 + 300
      expect(result.optimizedCost).toBe(4200) // 5000 - 800
      expect(result.optimizations).toHaveLength(2)

      // Check optimization impact categorization
      const highImpactOpt = result.optimizations.find(opt => opt.impact === 'medium')
      expect(highImpactOpt).toBeDefined()
    })

    it('should categorize optimization impact correctly', async () => {
      ;(mockGasEstimationService.analyzeWorkflowCosts as Mock).mockResolvedValue({
        gasEstimate: {
          totalGas: 1000,
          gasPerAction: {},
          gasBreakdown: [],
          confidence: 0.8,
          estimationMethod: 'simulation',
          warnings: []
        },
        balanceRequirements: [],
        optimizations: [
          {
            type: 'reorder',
            description: 'Small optimization',
            estimatedSavings: 50, // 5% - low impact
            confidence: 0.8,
            actionIds: ['action1']
          },
          {
            type: 'batch',
            description: 'Medium optimization',
            estimatedSavings: 150, // 15% - medium impact
            confidence: 0.7,
            actionIds: ['action2']
          },
          {
            type: 'parallel',
            description: 'Large optimization',
            estimatedSavings: 250, // 25% - high impact
            confidence: 0.9,
            actionIds: ['action1', 'action2']
          }
        ],
        feasibilityScore: 85,
        recommendations: []
      })

      const result = await analyzer.generateOptimizationReport(mockWorkflow, mockActionMetadata)

      const lowImpact = result.optimizations.find(opt => opt.impact === 'low')
      const mediumImpact = result.optimizations.find(opt => opt.impact === 'medium')
      const highImpact = result.optimizations.find(opt => opt.impact === 'high')

      expect(lowImpact).toBeDefined()
      expect(mediumImpact).toBeDefined()
      expect(highImpact).toBeDefined()
    })
  })

  describe('execution readiness determination', () => {
    it('should mark workflow as ready when all conditions are met', async () => {
      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result.executionReadiness).toBe('ready')
      expect(result.criticalIssues).toHaveLength(0)
      expect(result.overallScore).toBeGreaterThanOrEqual(75)
    })

    it('should mark workflow as needs_review for moderate issues', async () => {
      ;(mockGasEstimationService.analyzeWorkflowCosts as Mock).mockResolvedValue({
        gasEstimate: {
          totalGas: 3200,
          gasPerAction: {},
          gasBreakdown: [],
          confidence: 0.6, // Lower confidence
          estimationMethod: 'simulation',
          warnings: ['Some warnings']
        },
        balanceRequirements: [],
        optimizations: [],
        feasibilityScore: 65, // Moderate feasibility
        recommendations: []
      })

      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result.executionReadiness).toBe('needs_review')
    })

    it('should mark workflow as not_ready for critical issues', async () => {
      ;(mockCompatibilityService.checkWorkflowCompatibility as Mock).mockResolvedValue({
        isValid: false,
        typeCompatibility: { compatible: false, issues: [], suggestions: [] },
        dependencyGraph: { nodes: new Map(), edges: [], cycles: [], maxDepth: 2 },
        circularDependencies: [['action1', 'action2', 'action1']],
        errors: [{ type: 'CIRCULAR_DEPENDENCY', message: 'Circular dependency detected', severity: 'error' }],
        warnings: []
      })

      const result = await analyzer.analyzeWorkflow(mockWorkflow, mockActionMetadata)

      expect(result.executionReadiness).toBe('not_ready')
      expect(result.criticalIssues.length).toBeGreaterThan(0)
    })
  })

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await analyzer.cleanup()

      expect(mockEmulatorService.cleanup).toHaveBeenCalled()
    })
  })
})