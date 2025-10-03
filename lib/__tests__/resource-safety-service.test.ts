import { describe, it, expect, beforeEach } from 'vitest'
import { ResourceSafetyService } from '../resource-safety-service'
import { ParsedWorkflow, ActionMetadata } from '../types'

describe('ResourceSafetyService', () => {
  let service: ResourceSafetyService
  let mockWorkflow: ParsedWorkflow
  let mockActions: ActionMetadata[]

  beforeEach(() => {
    service = new ResourceSafetyService()
    
    mockWorkflow = {
      actions: [],
      executionOrder: [],
      rootActions: [],
      metadata: {
        name: 'Test Workflow',
        description: 'Test workflow for resource safety',
        version: '1.0.0',
        author: 'Test Author',
        tags: ['test'],
        createdAt: new Date(),
        updatedAt: new Date()
      }
    }
    
    mockActions = []
  })

  describe('analyzeResourceSafety', () => {
    it('should detect resource leaks in Cadence code', async () => {
      const cadenceCode = `
        transaction {
          prepare(signer: AuthAccount) {
            let resource <- create TestResource()
            // Resource created but not destroyed or stored
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.resourceLeaks).toHaveLength(1)
      expect(result.resourceLeaks[0].type).toBe('resource')
      expect(result.resourceLeaks[0].severity).toBe('high')
      expect(result.overallSafety).toBe('unsafe')
    })

    it('should detect unsafe operations', async () => {
      const cadenceCode = `
        transaction {
          prepare(signer: AuthAccount) {
            let value = someOptional!
            panic("Something went wrong")
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.unsafeOperations.length).toBeGreaterThan(0)
      expect(result.unsafeOperations.some(op => op.operation.includes('!'))).toBe(true)
      expect(result.unsafeOperations.some(op => op.operation.includes('panic'))).toBe(true)
      expect(result.overallSafety).toBe('unsafe')
    })

    it('should detect security issues', async () => {
      const cadenceCode = `
        pub contract TestContract {
          access(all) fun unsafeFunction() {
            let authAccount = AuthAccount()
            let borrowed = someResource.borrow()
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.securityIssues.length).toBeGreaterThan(0)
      expect(result.securityIssues.some(issue => issue.type === 'access_control')).toBe(true)
      expect(result.securityIssues.some(issue => issue.cwe)).toBe(true)
    })

    it('should return safe rating for clean code', async () => {
      const cadenceCode = `
        transaction {
          prepare(signer: AuthAccount) {
            log("Transaction executed successfully")
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.overallSafety).toBe('safe')
      expect(result.recommendations.some(rec => rec.includes('Code appears to follow resource safety best practices'))).toBe(true)
    })

    it('should provide appropriate recommendations', async () => {
      const cadenceCode = `
        transaction {
          prepare(signer: AuthAccount) {
            let resource <- create TestResource()
            panic("Error occurred")
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.recommendations.length).toBeGreaterThan(0)
      expect(result.recommendations.some(rec => rec.includes('resource lifecycle'))).toBe(true)
      expect(result.recommendations.some(rec => rec.includes('graceful error handling'))).toBe(true)
    })
  })

  describe('resource leak detection', () => {
    it('should detect unmatched resource creation', async () => {
      const cadenceCode = `
        let resource1 <- create TestResource()
        let resource2 <- create AnotherResource()
        destroy resource1
        // resource2 is not destroyed
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.resourceLeaks.some(leak => 
        leak.description.includes('resource2') && leak.severity === 'high'
      )).toBe(true)
    })

    it('should detect resource moves without proper handling', async () => {
      const cadenceCode = `
        let resource1 <- someResource
        let resource2 <- resource1
        // Potential leak if not properly handled
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.resourceLeaks.some(leak => 
        leak.description.includes('Resource move detected')
      )).toBe(true)
    })

    it('should not flag properly managed resources', async () => {
      const cadenceCode = `
        let resource <- create TestResource()
        signer.save(<-resource, to: /storage/test)
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      // Should not have high severity leaks for properly stored resources
      expect(result.resourceLeaks.filter(leak => leak.severity === 'high')).toHaveLength(0)
    })
  })

  describe('unsafe operation detection', () => {
    it('should detect force unwrap operations', async () => {
      const cadenceCode = `
        let value = optionalValue!
        let another = someDict["key"]!
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      const forceUnwraps = result.unsafeOperations.filter(op => 
        op.operation.includes('!') && op.severity === 'high'
      )
      expect(forceUnwraps.length).toBeGreaterThan(0)
    })

    it('should detect panic operations', async () => {
      const cadenceCode = `
        if condition {
          panic("Critical error")
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      const panics = result.unsafeOperations.filter(op => 
        op.operation.includes('panic') && op.severity === 'high'
      )
      expect(panics).toHaveLength(1)
    })

    it('should provide appropriate mitigations', async () => {
      const cadenceCode = `
        let resource <- create TestResource()
        panic("Error")
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.unsafeOperations.some(op => 
        op.mitigation.includes('safe alternatives')
      )).toBe(true)
    })
  })

  describe('security issue detection', () => {
    it('should detect public access modifiers', async () => {
      const cadenceCode = `
        access(all) fun publicFunction() {
          // Potentially unsafe public access
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.securityIssues.some(issue => 
        issue.type === 'access_control' && issue.cwe === 'CWE-732'
      )).toBe(true)
    })

    it('should detect AuthAccount usage', async () => {
      const cadenceCode = `
        let account = AuthAccount()
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.securityIssues.some(issue => 
        issue.type === 'access_control' && issue.severity === 'high'
      )).toBe(true)
    })

    it('should detect resource borrowing', async () => {
      const cadenceCode = `
        let borrowed = resource.borrow()
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.securityIssues.some(issue => 
        issue.type === 'resource_management'
      )).toBe(true)
    })
  })

  describe('overall safety calculation', () => {
    it('should return unsafe for high severity issues', async () => {
      const cadenceCode = `
        let resource <- create TestResource()
        let value = optional!
        panic("Error")
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.overallSafety).toBe('unsafe')
    })

    it('should return warning for multiple medium severity issues', async () => {
      const cadenceCode = `
        access(all) fun func1() {}
        access(all) fun func2() {}
        access(all) fun func3() {}
        let borrowed1 = resource1.borrow()
        let borrowed2 = resource2.borrow()
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.overallSafety).toBe('warning')
    })

    it('should return safe for clean code', async () => {
      const cadenceCode = `
        transaction {
          prepare(signer: AuthAccount) {
            // Clean, safe code
            log("Transaction executed successfully")
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      expect(result.overallSafety).toBe('safe')
    })
  })

  describe('Flow security tools integration', () => {
    it('should integrate with Flow lint simulation', async () => {
      const cadenceCode = `
        access(all) fun test() {
          panic("Error")
        }
      `
      
      const result = await service.integrateFlowSecurityTools(cadenceCode)
      
      expect(result.flowLintResults.length).toBeGreaterThan(0)
      expect(result.recommendations.some(rec => rec.includes('Flow Lint'))).toBe(true)
    })

    it('should integrate with Cadence analyzer simulation', async () => {
      const cadenceCode = `
        let resource1 <- create TestResource()
        let resource2 <- create AnotherResource()
        destroy resource1
        let value = optional!
      `
      
      const result = await service.integrateFlowSecurityTools(cadenceCode)
      
      expect(result.cadenceAnalyzerResults.length).toBeGreaterThan(0)
      expect(result.recommendations.some(rec => rec.includes('Cadence Analyzer'))).toBe(true)
    })

    it('should detect resource imbalance', async () => {
      const cadenceCode = `
        let resource1 <- create TestResource()
        let resource2 <- create AnotherResource()
        // Only one destroy statement
        destroy resource1
      `
      
      const result = await service.integrateFlowSecurityTools(cadenceCode)
      
      expect(result.cadenceAnalyzerResults.some(result => 
        result.message.includes('resource leak') || result.message.includes('Potential resource leak')
      )).toBe(true)
    })

    it('should detect force unwrap in analyzer', async () => {
      const cadenceCode = `
        let value = someOptional!
      `
      
      const result = await service.integrateFlowSecurityTools(cadenceCode)
      
      expect(result.cadenceAnalyzerResults.some(result => 
        result.message.includes('Force unwrap') && result.severity === 'high'
      )).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle empty code', async () => {
      const result = await service.analyzeResourceSafety('', mockWorkflow, mockActions)
      
      expect(result.resourceLeaks).toHaveLength(0)
      expect(result.unsafeOperations).toHaveLength(0)
      expect(result.securityIssues).toHaveLength(0)
      expect(result.overallSafety).toBe('safe')
    })

    it('should handle complex nested code', async () => {
      const cadenceCode = `
        transaction {
          prepare(signer: AuthAccount) {
            if let existing <- signer.load<@TestResource>(from: /storage/test) {
              if existing.isValid() {
                let new <- create TestResource()
                destroy existing
                signer.save(<-new, to: /storage/test)
              } else {
                destroy existing
              }
            }
          }
        }
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      // Should handle complex logic without false positives
      expect(result.overallSafety).not.toBe('unsafe')
    })

    it('should handle multiple resource types', async () => {
      const cadenceCode = `
        let nft <- create NFT()
        let token <- create Token()
        let vault <- create Vault()
        
        destroy nft
        destroy token
        destroy vault
      `
      
      const result = await service.analyzeResourceSafety(cadenceCode, mockWorkflow, mockActions)
      
      // All resources properly destroyed
      expect(result.resourceLeaks.filter(leak => leak.severity === 'high')).toHaveLength(0)
    })
  })
})