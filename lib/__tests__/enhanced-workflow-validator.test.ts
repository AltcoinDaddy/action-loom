import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EnhancedWorkflowValidator } from '../enhanced-workflow-validator'
import { ParsedWorkflow, ActionMetadata } from '../types'

// Mock the dependencies
vi.mock('../workflow-compatibility-service')
vi.mock('../flow-emulator-service')
vi.mock('../gas-estimation-service')
vi.mock('../resource-safety-service')
vi.mock('../cadence-generator')

describe('EnhancedWorkflowValidator', () => {
  let validator: EnhancedWorkflowValidator
  let mockWorkflow: ParsedWorkflow
  let mockActions: ActionMetadata[]

  beforeEach(() => {
    validator = new EnhancedWorkflowValidator()
    
    mockWorkflow = {
      actions: [],
      executionOrder: [],
      rootActions: [],
      metadata: {
        name: 'Test Workflow',
        description: 'Test workflow',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
    
    mockActions = []
  })

  describe('validateWorkflowWithSafety', () => {
    it('should perform comprehensive validation including resource safety', async () => {
      // Mock the services to return expected results
      const mockCompatibilityService = {
        validateWorkflow: vi.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        })
      }
      
      const mockResourceSafetyService = {
        analyzeResourceSafety: vi.fn().mockResolvedValue({
          resourceLeaks: [],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Code appears to follow resource safety best practices'],
          overallSafety: 'safe'
        }),
        integrateFlowSecurityTools: vi.fn().mockResolvedValue({
          flowLintResults: [],
          cadenceAnalyzerResults: [],
          recommendations: []
        })
      }
      
      const mockCadenceGenerator = {
        generateWorkflowCode: vi.fn().mockResolvedValue('transaction { prepare(signer: AuthAccount) {} }')
      }
      
      // Replace the services with mocks
      ;(validator as any).compatibilityService = mockCompatibilityService
      ;(validator as any).resourceSafetyService = mockResourceSafetyService
      ;(validator as any).cadenceGenerator = mockCadenceGenerator
      
      const result = await validator.validateWorkflowWithSafety(mockWorkflow, mockActions)
      
      expect(result.isValid).toBe(true)
      expect(result.resourceSafety).toBeDefined()
      expect(result.flowSecurityTools).toBeDefined()
      expect(result.overallRisk).toBe('low')
      expect(result.deploymentReady).toBe(true)
    })

    it('should calculate high risk for unsafe resource safety', async () => {
      const mockCompatibilityService = {
        validateWorkflow: vi.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        })
      }
      
      const mockResourceSafetyService = {
        analyzeResourceSafety: vi.fn().mockResolvedValue({
          resourceLeaks: [{
            type: 'resource',
            location: 'Line 1',
            description: 'Resource leak detected',
            severity: 'high',
            suggestion: 'Fix the leak'
          }],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Fix resource leaks'],
          overallSafety: 'unsafe'
        }),
        integrateFlowSecurityTools: vi.fn().mockResolvedValue({
          flowLintResults: [],
          cadenceAnalyzerResults: [],
          recommendations: []
        })
      }
      
      const mockCadenceGenerator = {
        generateWorkflowCode: vi.fn().mockResolvedValue('let resource <- create Test()')
      }
      
      ;(validator as any).compatibilityService = mockCompatibilityService
      ;(validator as any).resourceSafetyService = mockResourceSafetyService
      ;(validator as any).cadenceGenerator = mockCadenceGenerator
      
      const result = await validator.validateWorkflowWithSafety(mockWorkflow, mockActions)
      
      expect(result.overallRisk).toBe('high')
      expect(result.deploymentReady).toBe(false)
    })

    it('should calculate medium risk for warning safety level', async () => {
      const mockCompatibilityService = {
        validateWorkflow: vi.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        })
      }
      
      const mockResourceSafetyService = {
        analyzeResourceSafety: vi.fn().mockResolvedValue({
          resourceLeaks: [],
          unsafeOperations: [{
            operation: 'someOperation',
            location: 'Line 1',
            risk: 'Medium risk operation',
            mitigation: 'Use safer alternative',
            severity: 'medium'
          }],
          securityIssues: [{
            type: 'access_control',
            description: 'Public access detected',
            location: 'Line 2',
            severity: 'medium',
            recommendation: 'Use more restrictive access'
          }],
          recommendations: ['Review medium severity issues'],
          overallSafety: 'warning'
        }),
        integrateFlowSecurityTools: vi.fn().mockResolvedValue({
          flowLintResults: [],
          cadenceAnalyzerResults: [],
          recommendations: []
        })
      }
      
      const mockCadenceGenerator = {
        generateWorkflowCode: vi.fn().mockResolvedValue('access(all) fun test() {}')
      }
      
      ;(validator as any).compatibilityService = mockCompatibilityService
      ;(validator as any).resourceSafetyService = mockResourceSafetyService
      ;(validator as any).cadenceGenerator = mockCadenceGenerator
      
      const result = await validator.validateWorkflowWithSafety(mockWorkflow, mockActions)
      
      expect(result.overallRisk).toBe('medium')
      expect(result.deploymentReady).toBe(true) // Medium risk can still be deployment ready
    })
  })

  describe('validateWithSimulation', () => {
    it('should run simulation for valid workflows', async () => {
      const mockCompatibilityService = {
        validateWorkflow: vi.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        })
      }
      
      const mockResourceSafetyService = {
        analyzeResourceSafety: vi.fn().mockResolvedValue({
          resourceLeaks: [],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Code appears to follow resource safety best practices'],
          overallSafety: 'safe'
        }),
        integrateFlowSecurityTools: vi.fn().mockResolvedValue({
          flowLintResults: [],
          cadenceAnalyzerResults: [],
          recommendations: []
        })
      }
      
      const mockEmulatorService = {
        simulateWorkflow: vi.fn().mockResolvedValue({
          success: true,
          gasUsed: 1000,
          events: [],
          errors: []
        })
      }
      
      const mockGasEstimationService = {
        estimateWorkflowGas: vi.fn().mockResolvedValue({
          totalGas: 1000,
          gasPerAction: [{ actionId: 'test', gas: 1000 }],
          estimatedCost: 0.001
        })
      }
      
      const mockCadenceGenerator = {
        generateWorkflowCode: vi.fn().mockResolvedValue('transaction { prepare(signer: AuthAccount) {} }')
      }
      
      ;(validator as any).compatibilityService = mockCompatibilityService
      ;(validator as any).resourceSafetyService = mockResourceSafetyService
      ;(validator as any).emulatorService = mockEmulatorService
      ;(validator as any).gasEstimationService = mockGasEstimationService
      ;(validator as any).cadenceGenerator = mockCadenceGenerator
      
      const result = await validator.validateWithSimulation(mockWorkflow, mockActions)
      
      expect(result.simulationResult).toBeDefined()
      expect(result.gasEstimate).toBeDefined()
      expect(result.deploymentReady).toBe(true)
      expect(mockEmulatorService.simulateWorkflow).toHaveBeenCalled()
      expect(mockGasEstimationService.estimateWorkflowGas).toHaveBeenCalled()
    })

    it('should handle simulation failures gracefully', async () => {
      const mockCompatibilityService = {
        validateWorkflow: vi.fn().mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
          compatibilityIssues: []
        })
      }
      
      const mockResourceSafetyService = {
        analyzeResourceSafety: vi.fn().mockResolvedValue({
          resourceLeaks: [],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Code appears to follow resource safety best practices'],
          overallSafety: 'safe'
        }),
        integrateFlowSecurityTools: vi.fn().mockResolvedValue({
          flowLintResults: [],
          cadenceAnalyzerResults: [],
          recommendations: []
        })
      }
      
      const mockEmulatorService = {
        simulateWorkflow: vi.fn().mockRejectedValue(new Error('Simulation failed'))
      }
      
      const mockCadenceGenerator = {
        generateWorkflowCode: vi.fn().mockResolvedValue('transaction { prepare(signer: AuthAccount) {} }')
      }
      
      ;(validator as any).compatibilityService = mockCompatibilityService
      ;(validator as any).resourceSafetyService = mockResourceSafetyService
      ;(validator as any).emulatorService = mockEmulatorService
      ;(validator as any).cadenceGenerator = mockCadenceGenerator
      
      const result = await validator.validateWithSimulation(mockWorkflow, mockActions)
      
      expect(result.isValid).toBe(false)
      expect(result.deploymentReady).toBe(false)
      expect(result.errors).toContain('Simulation failed: Simulation failed')
    })
  })

  describe('getDeploymentRecommendations', () => {
    it('should provide recommendations for deployment-ready workflows', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        compatibilityIssues: [],
        resourceSafety: {
          resourceLeaks: [],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Code appears to follow resource safety best practices'],
          overallSafety: 'safe' as const
        },
        overallRisk: 'low' as const,
        deploymentReady: true
      }
      
      const recommendations = validator.getDeploymentRecommendations(validationResult)
      
      expect(recommendations).toContain('✅ Workflow is ready for deployment')
      expect(recommendations).toContain('• Code appears to follow resource safety best practices')
    })

    it('should provide warnings for not deployment-ready workflows', () => {
      const validationResult = {
        isValid: false,
        errors: ['Validation error'],
        warnings: [],
        compatibilityIssues: [],
        resourceSafety: {
          resourceLeaks: [{
            type: 'resource' as const,
            location: 'Line 1',
            description: 'Resource leak',
            severity: 'high' as const,
            suggestion: 'Fix leak'
          }],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Fix resource leaks'],
          overallSafety: 'unsafe' as const
        },
        overallRisk: 'high' as const,
        deploymentReady: false
      }
      
      const recommendations = validator.getDeploymentRecommendations(validationResult)
      
      expect(recommendations).toContain('⚠️ Workflow is not ready for deployment')
      expect(recommendations).toContain('• Fix validation errors before deployment')
      expect(recommendations).toContain('• Address resource safety issues')
    })
  })

  describe('getSecurityAuditSummary', () => {
    it('should calculate security score and grade correctly', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        compatibilityIssues: [],
        resourceSafety: {
          resourceLeaks: [{
            type: 'resource' as const,
            location: 'Line 1',
            description: 'Minor leak',
            severity: 'low' as const,
            suggestion: 'Fix leak'
          }],
          unsafeOperations: [{
            operation: 'test',
            location: 'Line 2',
            risk: 'Medium risk',
            mitigation: 'Use alternative',
            severity: 'medium' as const
          }],
          securityIssues: [{
            type: 'access_control' as const,
            description: 'High severity issue',
            location: 'Line 3',
            severity: 'high' as const,
            recommendation: 'Fix immediately'
          }],
          recommendations: ['Various recommendations'],
          overallSafety: 'warning' as const
        },
        overallRisk: 'medium' as const,
        deploymentReady: false
      }
      
      const summary = validator.getSecurityAuditSummary(validationResult)
      
      expect(summary.issues.high).toBe(1)
      expect(summary.issues.medium).toBe(1)
      expect(summary.issues.low).toBe(1)
      expect(summary.score).toBe(65) // 100 - 20 - 10 - 5 = 65
      expect(summary.grade).toBe('D')
      expect(summary.recommendations.length).toBeGreaterThan(0)
    })

    it('should give perfect score for clean code', () => {
      const validationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        compatibilityIssues: [],
        resourceSafety: {
          resourceLeaks: [],
          unsafeOperations: [],
          securityIssues: [],
          recommendations: ['Code appears to follow resource safety best practices'],
          overallSafety: 'safe' as const
        },
        overallRisk: 'low' as const,
        deploymentReady: true
      }
      
      const summary = validator.getSecurityAuditSummary(validationResult)
      
      expect(summary.score).toBe(100)
      expect(summary.grade).toBe('A')
      expect(summary.issues.high).toBe(0)
      expect(summary.issues.medium).toBe(0)
      expect(summary.issues.low).toBe(0)
    })
  })
})