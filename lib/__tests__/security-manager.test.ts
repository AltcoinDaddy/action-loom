import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  FlowSecurityManager, 
  FlowTransactionValidator,
  Transaction,
  SecurityConfig,
  RiskLevel,
  SecurityWarningType,
  RiskFactorType,
  ActivityPattern,
  DEFAULT_SECURITY_CONFIG
} from '../security-manager'
import { ParsedWorkflow, SecurityLevel } from '../types'

describe('FlowSecurityManager', () => {
  let securityManager: FlowSecurityManager
  let mockTransaction: Transaction
  let mockWorkflow: ParsedWorkflow

  beforeEach(() => {
    securityManager = new FlowSecurityManager()
    
    mockTransaction = {
      id: 'test-tx-123',
      cadenceCode: `
        transaction {
          prepare(signer: AuthAccount) {
            // Test transaction
          }
          execute {
            log("Hello, World!")
          }
        }
      `,
      arguments: [
        { type: 'UFix64', value: '10.0' },
        { type: 'Address', value: '0x1234567890123456' }
      ],
      gasLimit: 1000,
      proposer: '0x1234567890123456',
      authorizers: ['0x1234567890123456'],
      payer: '0x1234567890123456',
      value: '10.0',
      metadata: {
        actionTypes: ['transfer'],
        estimatedGas: 800,
        requiredBalance: [{ token: 'FLOW', amount: '10.0', decimals: 8 }],
        riskFactors: [],
        userInitiated: true,
        timestamp: new Date()
      }
    }

    mockWorkflow = {
      actions: [
        {
          id: 'action-1',
          actionType: 'transfer',
          name: 'Transfer FLOW',
          parameters: [
            { name: 'amount', type: 'UFix64', value: '10.0', required: true },
            { name: 'to', type: 'Address', value: '0x1234567890123456', required: true }
          ],
          nextActions: [],
          position: { x: 0, y: 0 }
        }
      ],
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

  describe('validateTransaction', () => {
    it('should validate a safe transaction successfully', async () => {
      const assessment = await securityManager.validateTransaction(mockTransaction)
      
      expect(assessment.riskLevel).toBe(RiskLevel.LOW)
      expect(assessment.blockExecution).toBe(false)
      expect(assessment.score).toBeGreaterThan(70)
    })

    it('should detect high-value transactions', async () => {
      const highValueTx = {
        ...mockTransaction,
        value: '1500.0' // Above critical threshold
      }
      
      const assessment = await securityManager.validateTransaction(highValueTx)
      
      expect(assessment.riskLevel).toBe(RiskLevel.CRITICAL)
      expect(assessment.requiresConfirmation).toBe(true)
      expect(assessment.warnings.some(w => w.type === SecurityWarningType.HIGH_VALUE_TRANSACTION)).toBe(true)
    })

    it('should detect invalid parameters', async () => {
      const invalidTx = {
        ...mockTransaction,
        arguments: [
          { type: 'Address', value: 'invalid-address' },
          { type: 'UFix64', value: 'not-a-number' }
        ]
      }
      
      const assessment = await securityManager.validateTransaction(invalidTx)
      
      expect(assessment.blockExecution).toBe(true)
      expect(assessment.warnings.some(w => w.type === SecurityWarningType.SUSPICIOUS_ACTIVITY)).toBe(true)
    })

    it('should detect unusual gas usage', async () => {
      const highGasTx = {
        ...mockTransaction,
        gasLimit: 5000, // Much higher than estimated 800
        metadata: {
          ...mockTransaction.metadata!,
          estimatedGas: 800
        }
      }
      
      const assessment = await securityManager.validateTransaction(highGasTx)
      
      expect(assessment.warnings.some(w => w.type === SecurityWarningType.UNUSUAL_GAS_USAGE)).toBe(true)
    })

    it('should handle validation errors gracefully', async () => {
      const invalidTx = {
        ...mockTransaction,
        cadenceCode: '' // Empty code should cause validation to fail
      }
      
      const assessment = await securityManager.validateTransaction(invalidTx)
      
      expect(assessment.riskLevel).toBe(RiskLevel.CRITICAL)
      expect(assessment.blockExecution).toBe(true)
      expect(assessment.score).toBe(0)
    })
  })

  describe('assessRisk', () => {
    it('should assess low risk for simple workflows', async () => {
      const riskAssessment = await securityManager.assessRisk(mockWorkflow)
      
      expect(riskAssessment.overallRisk).toBe(RiskLevel.LOW)
      expect(riskAssessment.riskFactors).toHaveLength(0)
    })

    it('should detect high-value workflow risk', async () => {
      const highValueWorkflow = {
        ...mockWorkflow,
        actions: [
          {
            ...mockWorkflow.actions[0],
            parameters: [
              { name: 'amount', type: 'UFix64', value: '500.0', required: true },
              { name: 'to', type: 'Address', value: '0x1234567890123456', required: true }
            ]
          }
        ]
      }
      
      const riskAssessment = await securityManager.assessRisk(highValueWorkflow)
      
      expect(riskAssessment.overallRisk).toBe(RiskLevel.HIGH)
      expect(riskAssessment.riskFactors.some(f => f.type === RiskFactorType.HIGH_VALUE)).toBe(true)
    })

    it('should detect complex workflow risk', async () => {
      const complexWorkflow = {
        ...mockWorkflow,
        actions: Array.from({ length: 15 }, (_, i) => ({
          id: `action-${i}`,
          actionType: 'transfer',
          name: `Transfer ${i}`,
          parameters: [
            { name: 'amount', type: 'UFix64', value: '1.0', required: true },
            { name: 'to', type: 'Address', value: '0x1234567890123456', required: true }
          ],
          nextActions: [],
          position: { x: i * 100, y: 0 }
        })),
        metadata: {
          ...mockWorkflow.metadata,
          totalActions: 15
        }
      }
      
      const riskAssessment = await securityManager.assessRisk(complexWorkflow)
      
      expect(riskAssessment.riskFactors.some(f => f.type === RiskFactorType.COMPLEX_TRANSACTION)).toBe(true)
    })
  })

  describe('requireConfirmation', () => {
    it('should require confirmation for high-value transactions', () => {
      const highValueTx = {
        ...mockTransaction,
        value: '100.0' // Above confirmation threshold
      }
      
      const requiresConfirmation = securityManager.requireConfirmation(highValueTx)
      
      expect(requiresConfirmation).toBe(true)
    })

    it('should require confirmation for multiple authorizers', () => {
      const multiAuthTx = {
        ...mockTransaction,
        authorizers: ['0x1234567890123456', '0x6543210987654321']
      }
      
      const requiresConfirmation = securityManager.requireConfirmation(multiAuthTx)
      
      expect(requiresConfirmation).toBe(true)
    })

    it('should not require confirmation for low-value simple transactions', () => {
      const simpleTx = {
        ...mockTransaction,
        value: '1.0' // Below confirmation threshold
      }
      
      const requiresConfirmation = securityManager.requireConfirmation(simpleTx)
      
      expect(requiresConfirmation).toBe(false)
    })
  })

  describe('detectSuspiciousActivity', () => {
    it('should detect rapid transaction patterns', () => {
      const pattern: ActivityPattern = {
        userId: 'user-123',
        transactionCount: 15, // Above limit
        timeWindow: 1, // 1 minute
        totalValue: '50.0',
        contractAddresses: ['0x1234567890123456'],
        actionTypes: ['transfer'],
        timestamp: new Date()
      }
      
      const isSuspicious = securityManager.detectSuspiciousActivity(pattern)
      
      expect(isSuspicious).toBe(true)
    })

    it('should detect high-volume patterns', () => {
      const pattern: ActivityPattern = {
        userId: 'user-123',
        transactionCount: 5,
        timeWindow: 60,
        totalValue: '10000.0', // Very high value
        contractAddresses: ['0x1234567890123456'],
        actionTypes: ['transfer'],
        timestamp: new Date()
      }
      
      const isSuspicious = securityManager.detectSuspiciousActivity(pattern)
      
      expect(isSuspicious).toBe(true)
    })

    it('should not flag normal activity patterns', () => {
      const pattern: ActivityPattern = {
        userId: 'user-123',
        transactionCount: 3,
        timeWindow: 60,
        totalValue: '10.0',
        contractAddresses: ['0x1234567890123456'],
        actionTypes: ['transfer'],
        timestamp: new Date()
      }
      
      const isSuspicious = securityManager.detectSuspiciousActivity(pattern)
      
      expect(isSuspicious).toBe(false)
    })
  })

  describe('auditContract', () => {
    it('should audit verified contracts successfully', async () => {
      const verifiedAddress = '0x1654653399040a61' // Flow Token (simulated as verified)
      
      const audit = await securityManager.auditContract(verifiedAddress)
      
      expect(audit.status).toBe('passed')
      expect(audit.score).toBeGreaterThan(80)
    })

    it('should flag unverified contracts', async () => {
      const unverifiedAddress = '0x9999999999999999'
      
      const audit = await securityManager.auditContract(unverifiedAddress)
      
      expect(audit.status).toBe('warning')
      expect(audit.findings.some(f => f.category === 'Verification')).toBe(true)
    })

    it('should handle audit failures gracefully', async () => {
      // Mock a failure by using an invalid address format
      const invalidAddress = 'invalid'
      
      const audit = await securityManager.auditContract(invalidAddress)
      
      expect(audit.status).toBe('failed')
      expect(audit.score).toBe(0)
    })
  })

  describe('checkContractVerification', () => {
    it('should verify known contracts', async () => {
      const knownContract = {
        name: 'FlowToken',
        address: '0x1654653399040a61'
      }
      
      const verification = await securityManager.checkContractVerification(knownContract)
      
      expect(verification.isVerified).toBe(true)
      expect(verification.verificationLevel).toBe('standard')
    })

    it('should mark unknown contracts as unverified', async () => {
      const unknownContract = {
        name: 'UnknownContract',
        address: '0x9999999999999999'
      }
      
      const verification = await securityManager.checkContractVerification(unknownContract)
      
      expect(verification.isVerified).toBe(false)
      expect(verification.verificationLevel).toBe('none')
    })
  })
})

describe('FlowTransactionValidator', () => {
  let validator: FlowTransactionValidator
  let mockTransaction: Transaction

  beforeEach(() => {
    validator = new FlowTransactionValidator()
    
    mockTransaction = {
      id: 'test-tx-123',
      cadenceCode: `
        transaction {
          prepare(signer: AuthAccount) {
            // Test transaction
          }
          execute {
            log("Hello, World!")
          }
        }
      `,
      arguments: [
        { type: 'UFix64', value: '10.0' },
        { type: 'Address', value: '0x1234567890123456' }
      ],
      gasLimit: 1000,
      proposer: '0x1234567890123456',
      authorizers: ['0x1234567890123456'],
      payer: '0x1234567890123456'
    }
  })

  describe('validateParameters', () => {
    it('should validate correct parameters', async () => {
      const result = await validator.validateParameters(mockTransaction)
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect invalid Flow addresses', async () => {
      const invalidTx = {
        ...mockTransaction,
        arguments: [
          { type: 'Address', value: 'invalid-address' }
        ]
      }
      
      const result = await validator.validateParameters(invalidTx)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Invalid Flow address'))).toBe(true)
    })

    it('should detect invalid UFix64 values', async () => {
      const invalidTx = {
        ...mockTransaction,
        arguments: [
          { type: 'UFix64', value: 'not-a-number' }
        ]
      }
      
      const result = await validator.validateParameters(invalidTx)
      
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Invalid UFix64 value'))).toBe(true)
    })

    it('should sanitize valid parameters', async () => {
      const txWithUnsanitized = {
        ...mockTransaction,
        arguments: [
          { type: 'UFix64', value: '10.123456789' }, // More precision than needed
          { type: 'Bool', value: 'true' } // String boolean
        ]
      }
      
      const result = await validator.validateParameters(txWithUnsanitized)
      
      expect(result.isValid).toBe(true)
      expect(result.sanitizedParameters).toBeDefined()
      expect(result.sanitizedParameters![0].value).toBe('10.12345679') // Proper precision
      expect(result.sanitizedParameters![1].value).toBe(true) // Converted to boolean
    })
  })

  describe('validateGasLimits', () => {
    it('should validate reasonable gas limits', async () => {
      const txWithMetadata = {
        ...mockTransaction,
        gasLimit: 1000,
        metadata: {
          actionTypes: ['transfer'],
          estimatedGas: 900,
          requiredBalance: [],
          riskFactors: [],
          userInitiated: true,
          timestamp: new Date()
        }
      }
      
      const result = await validator.validateGasLimits(txWithMetadata)
      
      expect(result.isValid).toBe(true)
      expect(result.isReasonable).toBe(true)
    })

    it('should detect unreasonable gas limits', async () => {
      const txWithHighGas = {
        ...mockTransaction,
        gasLimit: 5000,
        metadata: {
          actionTypes: ['transfer'],
          estimatedGas: 800,
          requiredBalance: [],
          riskFactors: [],
          userInitiated: true,
          timestamp: new Date()
        }
      }
      
      const result = await validator.validateGasLimits(txWithHighGas)
      
      expect(result.isValid).toBe(true) // Still valid, just unreasonable
      expect(result.isReasonable).toBe(false)
      expect(result.warnings.some(w => w.includes('significantly higher'))).toBe(true)
    })

    it('should detect gas limits that are too low', async () => {
      const txWithLowGas = {
        ...mockTransaction,
        gasLimit: 50, // Below minimum
        metadata: {
          actionTypes: ['transfer'],
          estimatedGas: 800,
          requiredBalance: [],
          riskFactors: [],
          userInitiated: true,
          timestamp: new Date()
        }
      }
      
      const result = await validator.validateGasLimits(txWithLowGas)
      
      expect(result.isReasonable).toBe(false)
      expect(result.warnings.some(w => w.includes('below recommended minimum'))).toBe(true)
    })
  })

  describe('validateCadenceCode', () => {
    it('should validate correct Cadence code', async () => {
      const result = await validator.validateCadenceCode(mockTransaction.cadenceCode)
      
      expect(result.isValid).toBe(true)
      expect(result.syntaxErrors).toHaveLength(0)
    })

    it('should detect empty Cadence code', async () => {
      const result = await validator.validateCadenceCode('')
      
      expect(result.isValid).toBe(false)
      expect(result.syntaxErrors.some(e => e.includes('cannot be empty'))).toBe(true)
    })

    it('should detect missing transaction block', async () => {
      const invalidCode = 'fun main() { log("Hello") }'
      
      const result = await validator.validateCadenceCode(invalidCode)
      
      expect(result.isValid).toBe(false)
      expect(result.syntaxErrors.some(e => e.includes('transaction block'))).toBe(true)
    })

    it('should detect unsafe resource access', async () => {
      const unsafeCode = `
        transaction {
          prepare(signer: AuthAccount) {
            let resource = signer.borrow<&SomeResource>(from: /storage/resource)
            // Missing nil check - unsafe!
          }
        }
      `
      
      const result = await validator.validateCadenceCode(unsafeCode)
      
      expect(result.securityIssues.some(i => i.type === 'UNSAFE_RESOURCE_ACCESS')).toBe(true)
    })

    it('should detect hardcoded addresses', async () => {
      const codeWithHardcodedAddress = `
        transaction {
          prepare(signer: AuthAccount) {
            let addr = 0x1234567890123456
          }
        }
      `
      
      const result = await validator.validateCadenceCode(codeWithHardcodedAddress)
      
      expect(result.securityIssues.some(i => i.type === 'HARDCODED_ADDRESS')).toBe(true)
    })

    it('should calculate resource usage correctly', async () => {
      const complexCode = `
        import FungibleToken from 0x1234567890123456
        
        transaction {
          prepare(signer: AuthAccount) {
            signer.save(<- create Resource(), to: /storage/resource)
            let resource = signer.borrow<&Resource>(from: /storage/resource)
            for i in [1, 2, 3] {
              log(i)
            }
          }
        }
      `
      
      const result = await validator.validateCadenceCode(complexCode)
      
      expect(result.resourceUsage.storageUnits).toBeGreaterThan(0)
      expect(result.resourceUsage.networkCalls).toBeGreaterThan(0)
      expect(result.resourceUsage.computationUnits).toBeGreaterThan(100)
    })
  })
})

describe('Security Configuration', () => {
  it('should use default security configuration', () => {
    const config = DEFAULT_SECURITY_CONFIG
    
    expect(config.highValueThreshold).toBe('100.0')
    expect(config.criticalValueThreshold).toBe('1000.0')
    expect(config.maxGasMultiplier).toBe(2.0)
    expect(config.maxTransactionsPerMinute).toBe(10)
    expect(config.requireConfirmationThreshold).toBe('50.0')
  })

  it('should allow custom security configuration', () => {
    const customConfig: SecurityConfig = {
      ...DEFAULT_SECURITY_CONFIG,
      highValueThreshold: '50.0',
      maxTransactionsPerMinute: 5
    }
    
    const securityManager = new FlowSecurityManager(customConfig)
    
    // Test that custom config is used
    const lowValueTx = {
      id: 'test',
      cadenceCode: 'transaction {}',
      arguments: [],
      gasLimit: 1000,
      proposer: '0x1234567890123456',
      authorizers: ['0x1234567890123456'],
      payer: '0x1234567890123456',
      value: '60.0' // Above custom threshold but below default
    }
    
    const requiresConfirmation = securityManager.requireConfirmation(lowValueTx)
    expect(requiresConfirmation).toBe(true) // Should require confirmation with custom config
  })
})