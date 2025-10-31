import { 
  SecurityLevel, 
  SecurityAudit, 
  SecurityFinding, 
  ParsedWorkflow, 
  ValidationError,
  ValidationErrorType,
  FlowAccount,
  TokenBalance
} from './types'

// Security Manager interfaces based on design document
export interface SecurityManager {
  // Transaction validation
  validateTransaction: (transaction: Transaction) => Promise<SecurityAssessment>
  assessRisk: (workflow: ParsedWorkflow) => Promise<RiskAssessment>
  
  // Contract security
  auditContract: (contractAddress: string) => Promise<SecurityAudit>
  checkContractVerification: (contract: Contract) => Promise<VerificationStatus>
  
  // User protection
  requireConfirmation: (transaction: Transaction) => boolean
  detectSuspiciousActivity: (pattern: ActivityPattern) => boolean
}

export interface Transaction {
  id: string
  cadenceCode: string
  arguments: Argument[]
  gasLimit: number
  proposer: string
  authorizers: string[]
  payer: string
  value?: string // Transaction value in FLOW
  contractAddresses?: string[] // Contracts being interacted with
  metadata?: TransactionMetadata
}

export interface TransactionMetadata {
  actionTypes: string[]
  estimatedGas: number
  requiredBalance: TokenBalance[]
  riskFactors: string[]
  userInitiated: boolean
  timestamp: Date
}

export interface Argument {
  type: string
  value: any
}

export interface Contract {
  name: string
  address: string
  code?: string
  verified?: boolean
  auditStatus?: SecurityAudit
}

export interface SecurityAssessment {
  riskLevel: RiskLevel
  warnings: SecurityWarning[]
  recommendations: string[]
  requiresConfirmation: boolean
  blockExecution: boolean
  score: number // 0-100, higher is safer
}

export interface RiskAssessment {
  overallRisk: RiskLevel
  riskFactors: RiskFactor[]
  mitigationSuggestions: string[]
  confidenceScore: number
  assessmentTime: Date
}

export interface RiskFactor {
  type: RiskFactorType
  severity: RiskLevel
  description: string
  impact: string
  likelihood: number // 0-1
}

export enum RiskFactorType {
  HIGH_VALUE = 'HIGH_VALUE',
  UNVERIFIED_CONTRACT = 'UNVERIFIED_CONTRACT',
  SUSPICIOUS_PATTERN = 'SUSPICIOUS_PATTERN',
  UNUSUAL_GAS = 'UNUSUAL_GAS',
  MULTIPLE_AUTHORIZERS = 'MULTIPLE_AUTHORIZERS',
  COMPLEX_TRANSACTION = 'COMPLEX_TRANSACTION',
  NEW_CONTRACT = 'NEW_CONTRACT',
  FREQUENT_TRANSACTIONS = 'FREQUENT_TRANSACTIONS'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityWarning {
  type: SecurityWarningType
  severity: RiskLevel
  message: string
  details: string
  actionRequired: boolean
  suggestedAction?: string
}

export enum SecurityWarningType {
  HIGH_VALUE_TRANSACTION = 'HIGH_VALUE_TRANSACTION',
  UNVERIFIED_CONTRACT = 'UNVERIFIED_CONTRACT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  UNUSUAL_GAS_USAGE = 'UNUSUAL_GAS_USAGE',
  MULTIPLE_AUTHORIZATIONS = 'MULTIPLE_AUTHORIZATIONS',
  POTENTIAL_SCAM = 'POTENTIAL_SCAM',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

export interface VerificationStatus {
  isVerified: boolean
  verificationSource: string
  verifiedAt?: Date
  verificationLevel: VerificationLevel
  certifications: string[]
}

export enum VerificationLevel {
  NONE = 'none',
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

export interface ActivityPattern {
  userId: string
  transactionCount: number
  timeWindow: number // minutes
  totalValue: string
  contractAddresses: string[]
  actionTypes: string[]
  timestamp: Date
}

// Transaction Validator interface
export interface TransactionValidator {
  validateParameters: (transaction: Transaction) => Promise<ParameterValidationResult>
  validateGasLimits: (transaction: Transaction) => Promise<GasValidationResult>
  validateAuthorizations: (transaction: Transaction) => Promise<AuthorizationValidationResult>
  validateCadenceCode: (cadenceCode: string) => Promise<CadenceValidationResult>
}

export interface ParameterValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  sanitizedParameters?: Argument[]
}

export interface GasValidationResult {
  isValid: boolean
  estimatedGas: number
  gasLimit: number
  isReasonable: boolean
  warnings: string[]
}

export interface AuthorizationValidationResult {
  isValid: boolean
  requiredAuthorizers: string[]
  providedAuthorizers: string[]
  missingAuthorizers: string[]
  unnecessaryAuthorizers: string[]
}

export interface CadenceValidationResult {
  isValid: boolean
  syntaxErrors: string[]
  securityIssues: SecurityIssue[]
  resourceUsage: ResourceUsage
  complexity: CodeComplexity
}

export interface SecurityIssue {
  type: SecurityIssueType
  severity: RiskLevel
  line?: number
  description: string
  recommendation: string
}

export enum SecurityIssueType {
  UNSAFE_RESOURCE_ACCESS = 'UNSAFE_RESOURCE_ACCESS',
  POTENTIAL_REENTRANCY = 'POTENTIAL_REENTRANCY',
  UNCHECKED_ARITHMETIC = 'UNCHECKED_ARITHMETIC',
  DANGEROUS_CAPABILITY = 'DANGEROUS_CAPABILITY',
  HARDCODED_ADDRESS = 'HARDCODED_ADDRESS',
  MISSING_ACCESS_CONTROL = 'MISSING_ACCESS_CONTROL'
}

export interface ResourceUsage {
  computationUnits: number
  storageUnits: number
  networkCalls: number
  contractInteractions: number
}

export interface CodeComplexity {
  cyclomaticComplexity: number
  linesOfCode: number
  functionCount: number
  branchCount: number
}

// Configuration for security thresholds
export interface SecurityConfig {
  highValueThreshold: string // FLOW amount
  criticalValueThreshold: string // FLOW amount
  maxGasMultiplier: number // Max gas vs estimated
  maxTransactionsPerMinute: number
  maxTransactionsPerHour: number
  suspiciousPatternThreshold: number
  requireConfirmationThreshold: string // FLOW amount
  blockExecutionThreshold: RiskLevel
}

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  highValueThreshold: '100.0', // 100 FLOW
  criticalValueThreshold: '1000.0', // 1000 FLOW
  maxGasMultiplier: 2.0,
  maxTransactionsPerMinute: 10,
  maxTransactionsPerHour: 100,
  suspiciousPatternThreshold: 0.7,
  requireConfirmationThreshold: '50.0', // 50 FLOW
  blockExecutionThreshold: RiskLevel.CRITICAL
}

/**
 * FlowSecurityManager - Comprehensive security and risk management for Flow blockchain transactions
 * 
 * Implements transaction validation, risk assessment, and user protection measures
 * as specified in requirements 8.1, 8.2, 8.3, and 8.6
 */
export class FlowSecurityManager implements SecurityManager {
  private config: SecurityConfig
  private transactionValidator: TransactionValidator
  private activityTracker: Map<string, ActivityPattern[]> = new Map()
  private contractVerificationCache: Map<string, VerificationStatus> = new Map()
  private securityAuditCache: Map<string, SecurityAudit> = new Map()

  constructor(config: SecurityConfig = DEFAULT_SECURITY_CONFIG) {
    this.config = config
    this.transactionValidator = new FlowTransactionValidator()
  }

  /**
   * Validates a transaction for security issues and compliance
   * Requirement 8.1: Validate all transaction parameters against expected formats
   */
  async validateTransaction(transaction: Transaction): Promise<SecurityAssessment> {
    const startTime = Date.now()
    
    try {
      // Validate transaction parameters
      const parameterValidation = await this.transactionValidator.validateParameters(transaction)
      
      // Validate gas limits
      const gasValidation = await this.transactionValidator.validateGasLimits(transaction)
      
      // Validate authorizations
      const authValidation = await this.transactionValidator.validateAuthorizations(transaction)
      
      // Validate Cadence code
      const cadenceValidation = await this.transactionValidator.validateCadenceCode(transaction.cadenceCode)
      
      // Assess overall risk
      const riskAssessment = await this.assessTransactionRisk(transaction)
      
      // Generate security warnings
      const warnings = this.generateSecurityWarnings(
        transaction,
        parameterValidation,
        gasValidation,
        authValidation,
        cadenceValidation,
        riskAssessment
      )
      
      // Calculate security score
      const score = this.calculateSecurityScore(
        parameterValidation,
        gasValidation,
        authValidation,
        cadenceValidation,
        riskAssessment
      )
      
      // Determine if confirmation is required
      const requiresConfirmation = this.requireConfirmation(transaction) || 
                                  riskAssessment.overallRisk === RiskLevel.HIGH ||
                                  riskAssessment.overallRisk === RiskLevel.CRITICAL
      
      // Determine if execution should be blocked
      const blockExecution = riskAssessment.overallRisk === this.config.blockExecutionThreshold ||
                            !parameterValidation.isValid ||
                            !gasValidation.isValid ||
                            !authValidation.isValid ||
                            !cadenceValidation.isValid
      
      // Override risk level if validation fails
      let finalRiskLevel = riskAssessment.overallRisk
      if (!parameterValidation.isValid || !cadenceValidation.isValid) {
        finalRiskLevel = RiskLevel.CRITICAL
      } else if (!gasValidation.isValid || !authValidation.isValid) {
        finalRiskLevel = RiskLevel.HIGH
      }

      const assessment: SecurityAssessment = {
        riskLevel: finalRiskLevel,
        warnings,
        recommendations: this.generateRecommendations(warnings, riskAssessment),
        requiresConfirmation,
        blockExecution,
        score
      }
      
      // Log security assessment for monitoring
      this.logSecurityAssessment(transaction, assessment, Date.now() - startTime)
      
      return assessment
      
    } catch (error) {
      console.error('Security validation failed:', error)
      
      // Return critical assessment on validation failure
      return {
        riskLevel: RiskLevel.CRITICAL,
        warnings: [{
          type: SecurityWarningType.SUSPICIOUS_ACTIVITY,
          severity: RiskLevel.CRITICAL,
          message: 'Transaction validation failed',
          details: error instanceof Error ? error.message : 'Unknown validation error',
          actionRequired: true,
          suggestedAction: 'Do not proceed with this transaction'
        }],
        recommendations: ['Do not execute this transaction', 'Contact support if this error persists'],
        requiresConfirmation: true,
        blockExecution: true,
        score: 0
      }
    }
  }

  /**
   * Assesses risk level for a complete workflow
   * Requirement 8.2: Detect high-value transactions and require additional confirmation
   */
  async assessRisk(workflow: ParsedWorkflow): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = []
    
    // Analyze workflow complexity
    if (workflow.actions.length > 10) {
      riskFactors.push({
        type: RiskFactorType.COMPLEX_TRANSACTION,
        severity: RiskLevel.MEDIUM,
        description: 'Workflow contains many actions',
        impact: 'Increased chance of unexpected behavior',
        likelihood: 0.3
      })
    }
    
    // Check for high-value operations
    const totalValue = this.estimateWorkflowValue(workflow)
    if (parseFloat(totalValue) > parseFloat(this.config.highValueThreshold)) {
      const severity = parseFloat(totalValue) > parseFloat(this.config.criticalValueThreshold) 
        ? RiskLevel.CRITICAL 
        : RiskLevel.HIGH
        
      riskFactors.push({
        type: RiskFactorType.HIGH_VALUE,
        severity,
        description: `High-value workflow (${totalValue} FLOW)`,
        impact: 'Significant financial risk',
        likelihood: 1.0
      })
    }
    
    // Check for suspicious patterns
    const suspiciousScore = this.analyzeSuspiciousPatterns(workflow)
    if (suspiciousScore > this.config.suspiciousPatternThreshold) {
      riskFactors.push({
        type: RiskFactorType.SUSPICIOUS_PATTERN,
        severity: RiskLevel.HIGH,
        description: 'Workflow matches suspicious patterns',
        impact: 'Potential malicious activity',
        likelihood: suspiciousScore
      })
    }
    
    // Calculate overall risk
    const overallRisk = this.calculateOverallRisk(riskFactors)
    
    return {
      overallRisk,
      riskFactors,
      mitigationSuggestions: this.generateMitigationSuggestions(riskFactors),
      confidenceScore: this.calculateConfidenceScore(riskFactors),
      assessmentTime: new Date()
    }
  }

  /**
   * Audits a smart contract for security issues
   * Requirement 8.4: Display clear security warnings for unverified contracts
   */
  async auditContract(contractAddress: string): Promise<SecurityAudit> {
    // Check cache first
    const cached = this.securityAuditCache.get(contractAddress)
    if (cached && this.isCacheValid(cached)) {
      return cached
    }
    
    try {
      // Perform contract audit
      const findings: SecurityFinding[] = []
      
      // Check verification status
      const verification = await this.checkContractVerification({ 
        name: '', 
        address: contractAddress 
      })
      
      if (!verification.isVerified) {
        findings.push({
          severity: 'high',
          category: 'Verification',
          description: 'Contract is not verified',
          recommendation: 'Only interact with verified contracts'
        })
      }
      
      // Additional security checks would go here
      // For now, we'll simulate basic audit results
      
      const audit: SecurityAudit = {
        status: findings.some(f => f.severity === 'critical') ? 'failed' :
                findings.some(f => f.severity === 'high') ? 'warning' : 'passed',
        auditedAt: new Date().toISOString(),
        auditor: 'ActionLoom Security Scanner',
        findings,
        score: this.calculateAuditScore(findings)
      }
      
      // Cache the result
      this.securityAuditCache.set(contractAddress, audit)
      
      return audit
      
    } catch (error) {
      console.error('Contract audit failed:', error)
      
      return {
        status: 'failed',
        auditedAt: new Date().toISOString(),
        auditor: 'ActionLoom Security Scanner',
        findings: [{
          severity: 'critical',
          category: 'Audit Error',
          description: 'Failed to audit contract',
          recommendation: 'Do not interact with this contract'
        }],
        score: 0
      }
    }
  }

  /**
   * Checks contract verification status
   * Requirement 8.5: Prevent execution and explain risks when simulation detects issues
   */
  async checkContractVerification(contract: Contract): Promise<VerificationStatus> {
    // Check cache first
    const cached = this.contractVerificationCache.get(contract.address)
    if (cached) {
      return cached
    }
    
    try {
      // In a real implementation, this would query Flow's contract registry
      // For now, we'll simulate verification checking
      
      const isVerified = await this.queryContractRegistry(contract.address)
      
      const status: VerificationStatus = {
        isVerified,
        verificationSource: 'Flow Contract Registry',
        verifiedAt: isVerified ? new Date() : undefined,
        verificationLevel: isVerified ? VerificationLevel.STANDARD : VerificationLevel.NONE,
        certifications: isVerified ? ['Flow Foundation'] : []
      }
      
      // Cache the result
      this.contractVerificationCache.set(contract.address, status)
      
      return status
      
    } catch (error) {
      console.error('Contract verification check failed:', error)
      
      return {
        isVerified: false,
        verificationSource: 'Unknown',
        verificationLevel: VerificationLevel.NONE,
        certifications: []
      }
    }
  }

  /**
   * Determines if a transaction requires additional confirmation
   * Requirement 8.2: Require additional confirmation steps for high-value transactions
   */
  requireConfirmation(transaction: Transaction): boolean {
    // High-value transactions always require confirmation
    if (transaction.value && parseFloat(transaction.value) >= parseFloat(this.config.requireConfirmationThreshold)) {
      return true
    }
    
    // Multiple authorizers require confirmation
    if (transaction.authorizers.length > 1) {
      return true
    }
    
    // High gas usage requires confirmation
    if (transaction.gasLimit > transaction.metadata?.estimatedGas * this.config.maxGasMultiplier) {
      return true
    }
    
    // Unverified contracts require confirmation
    if (transaction.contractAddresses?.some(addr => {
      const verification = this.contractVerificationCache.get(addr)
      return verification && !verification.isVerified
    })) {
      return true
    }
    
    return false
  }

  /**
   * Detects suspicious activity patterns
   * Requirement 8.3: Warn users and require explicit approval for suspicious patterns
   */
  detectSuspiciousActivity(pattern: ActivityPattern): boolean {
    const userId = pattern.userId
    const userActivity = this.activityTracker.get(userId) || []
    
    // Add current pattern to tracking
    userActivity.push(pattern)
    this.activityTracker.set(userId, userActivity)
    
    // Clean old patterns (keep only last hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    const recentActivity = userActivity.filter(p => p.timestamp.getTime() > oneHourAgo)
    this.activityTracker.set(userId, recentActivity)
    
    // Check for suspicious patterns
    
    // Too many transactions in short time
    const timeWindowMs = pattern.timeWindow * 60 * 1000
    const recentCount = recentActivity.filter(p => 
      p.timestamp.getTime() > Date.now() - timeWindowMs
    ).length
    
    // Check if current pattern exceeds limits
    if (pattern.transactionCount > this.config.maxTransactionsPerMinute) {
      return true
    }
    
    if (recentCount > this.config.maxTransactionsPerMinute) {
      return true
    }
    
    // Too many transactions per hour
    if (recentActivity.length > this.config.maxTransactionsPerHour) {
      return true
    }
    
    // Unusual value patterns
    const totalRecentValue = recentActivity.reduce((sum, p) => sum + parseFloat(p.totalValue), 0)
    if (totalRecentValue > parseFloat(this.config.criticalValueThreshold) * 5) {
      return true
    }
    
    // Repeated interactions with same contracts (potential bot behavior)
    const contractCounts = new Map<string, number>()
    recentActivity.forEach(p => {
      p.contractAddresses.forEach(addr => {
        contractCounts.set(addr, (contractCounts.get(addr) || 0) + 1)
      })
    })
    
    const maxContractInteractions = Math.max(...Array.from(contractCounts.values()))
    if (maxContractInteractions > 20) {
      return true
    }
    
    return false
  }

  // Private helper methods
  
  private async assessTransactionRisk(transaction: Transaction): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = []
    
    // High value risk
    if (transaction.value && parseFloat(transaction.value) > parseFloat(this.config.highValueThreshold)) {
      const severity = parseFloat(transaction.value) > parseFloat(this.config.criticalValueThreshold) 
        ? RiskLevel.CRITICAL 
        : RiskLevel.HIGH
        
      riskFactors.push({
        type: RiskFactorType.HIGH_VALUE,
        severity,
        description: `High-value transaction (${transaction.value} FLOW)`,
        impact: 'Significant financial risk',
        likelihood: 1.0
      })
    }
    
    // Gas usage risk
    if (transaction.metadata?.estimatedGas && 
        transaction.gasLimit > transaction.metadata.estimatedGas * this.config.maxGasMultiplier) {
      riskFactors.push({
        type: RiskFactorType.UNUSUAL_GAS,
        severity: RiskLevel.MEDIUM,
        description: 'Gas limit significantly higher than estimated',
        impact: 'Potential gas griefing or inefficient code',
        likelihood: 0.6
      })
    }
    
    // Multiple authorizers risk
    if (transaction.authorizers.length > 1) {
      riskFactors.push({
        type: RiskFactorType.MULTIPLE_AUTHORIZERS,
        severity: RiskLevel.MEDIUM,
        description: 'Transaction requires multiple authorizers',
        impact: 'Complex authorization requirements',
        likelihood: 0.4
      })
    }
    
    const overallRisk = this.calculateOverallRisk(riskFactors)
    
    return {
      overallRisk,
      riskFactors,
      mitigationSuggestions: this.generateMitigationSuggestions(riskFactors),
      confidenceScore: this.calculateConfidenceScore(riskFactors),
      assessmentTime: new Date()
    }
  }

  private generateSecurityWarnings(
    transaction: Transaction,
    parameterValidation: ParameterValidationResult,
    gasValidation: GasValidationResult,
    authValidation: AuthorizationValidationResult,
    cadenceValidation: CadenceValidationResult,
    riskAssessment: RiskAssessment
  ): SecurityWarning[] {
    const warnings: SecurityWarning[] = []
    
    // Parameter validation warnings
    if (!parameterValidation.isValid) {
      warnings.push({
        type: SecurityWarningType.SUSPICIOUS_ACTIVITY,
        severity: RiskLevel.HIGH,
        message: 'Invalid transaction parameters detected',
        details: parameterValidation.errors.map(e => e.message).join(', '),
        actionRequired: true,
        suggestedAction: 'Review and correct transaction parameters'
      })
    }
    
    // Gas validation warnings
    if (!gasValidation.isReasonable) {
      warnings.push({
        type: SecurityWarningType.UNUSUAL_GAS_USAGE,
        severity: RiskLevel.MEDIUM,
        message: 'Unusual gas usage detected',
        details: `Gas limit (${gasValidation.gasLimit}) is much higher than estimated (${gasValidation.estimatedGas})`,
        actionRequired: false,
        suggestedAction: 'Review transaction complexity'
      })
    }
    
    // Authorization warnings
    if (!authValidation.isValid) {
      warnings.push({
        type: SecurityWarningType.MULTIPLE_AUTHORIZATIONS,
        severity: RiskLevel.MEDIUM,
        message: 'Authorization issues detected',
        details: `Missing authorizers: ${authValidation.missingAuthorizers.join(', ')}`,
        actionRequired: true,
        suggestedAction: 'Ensure all required authorizers are present'
      })
    }
    
    // Cadence code warnings
    cadenceValidation.securityIssues.forEach(issue => {
      warnings.push({
        type: SecurityWarningType.SUSPICIOUS_ACTIVITY,
        severity: issue.severity,
        message: `Security issue in Cadence code: ${issue.type}`,
        details: issue.description,
        actionRequired: issue.severity === RiskLevel.HIGH || issue.severity === RiskLevel.CRITICAL,
        suggestedAction: issue.recommendation
      })
    })
    
    // Risk-based warnings
    riskAssessment.riskFactors.forEach(factor => {
      if (factor.severity === RiskLevel.HIGH || factor.severity === RiskLevel.CRITICAL) {
        warnings.push({
          type: this.mapRiskFactorToWarningType(factor.type),
          severity: factor.severity,
          message: factor.description,
          details: factor.impact,
          actionRequired: factor.severity === RiskLevel.CRITICAL,
          suggestedAction: 'Review transaction carefully before proceeding'
        })
      }
    })
    
    return warnings
  }

  private calculateSecurityScore(
    parameterValidation: ParameterValidationResult,
    gasValidation: GasValidationResult,
    authValidation: AuthorizationValidationResult,
    cadenceValidation: CadenceValidationResult,
    riskAssessment: RiskAssessment
  ): number {
    let score = 100
    
    // Deduct points for validation failures
    if (!parameterValidation.isValid) score -= 30
    if (!gasValidation.isValid) score -= 20
    if (!authValidation.isValid) score -= 25
    if (!cadenceValidation.isValid) score -= 35
    
    // If Cadence code is empty or completely invalid, set score to 0
    if (!cadenceValidation.isValid && cadenceValidation.syntaxErrors.some(e => e.includes('cannot be empty'))) {
      score = 0
    }
    
    // Deduct points based on risk level
    switch (riskAssessment.overallRisk) {
      case RiskLevel.CRITICAL:
        score -= 50
        break
      case RiskLevel.HIGH:
        score -= 30
        break
      case RiskLevel.MEDIUM:
        score -= 15
        break
      case RiskLevel.LOW:
        score -= 5
        break
    }
    
    // Deduct points for security issues
    cadenceValidation.securityIssues.forEach(issue => {
      switch (issue.severity) {
        case RiskLevel.CRITICAL:
          score -= 25
          break
        case RiskLevel.HIGH:
          score -= 15
          break
        case RiskLevel.MEDIUM:
          score -= 8
          break
        case RiskLevel.LOW:
          score -= 3
          break
      }
    })
    
    return Math.max(0, Math.min(100, score))
  }

  private calculateOverallRisk(riskFactors: RiskFactor[]): RiskLevel {
    if (riskFactors.some(f => f.severity === RiskLevel.CRITICAL)) {
      return RiskLevel.CRITICAL
    }
    
    const highRiskCount = riskFactors.filter(f => f.severity === RiskLevel.HIGH).length
    if (highRiskCount >= 2) {
      return RiskLevel.CRITICAL
    }
    if (highRiskCount >= 1) {
      return RiskLevel.HIGH
    }
    
    const mediumRiskCount = riskFactors.filter(f => f.severity === RiskLevel.MEDIUM).length
    if (mediumRiskCount >= 3) {
      return RiskLevel.HIGH
    }
    if (mediumRiskCount >= 1) {
      return RiskLevel.MEDIUM
    }
    
    return RiskLevel.LOW
  }

  private generateRecommendations(warnings: SecurityWarning[], riskAssessment: RiskAssessment): string[] {
    const recommendations: string[] = []
    
    // Add warning-specific recommendations
    warnings.forEach(warning => {
      if (warning.suggestedAction) {
        recommendations.push(warning.suggestedAction)
      }
    })
    
    // Add risk-specific recommendations
    recommendations.push(...riskAssessment.mitigationSuggestions)
    
    // Add general security recommendations
    if (riskAssessment.overallRisk === RiskLevel.HIGH || riskAssessment.overallRisk === RiskLevel.CRITICAL) {
      recommendations.push('Consider testing this transaction on testnet first')
      recommendations.push('Double-check all transaction parameters')
      recommendations.push('Ensure you trust all contracts being interacted with')
    }
    
    return [...new Set(recommendations)] // Remove duplicates
  }

  private generateMitigationSuggestions(riskFactors: RiskFactor[]): string[] {
    const suggestions: string[] = []
    
    riskFactors.forEach(factor => {
      switch (factor.type) {
        case RiskFactorType.HIGH_VALUE:
          suggestions.push('Consider splitting into smaller transactions')
          suggestions.push('Verify recipient addresses carefully')
          break
        case RiskFactorType.UNVERIFIED_CONTRACT:
          suggestions.push('Only interact with verified contracts')
          suggestions.push('Research the contract and its developers')
          break
        case RiskFactorType.UNUSUAL_GAS:
          suggestions.push('Review transaction complexity')
          suggestions.push('Consider optimizing the transaction')
          break
        case RiskFactorType.SUSPICIOUS_PATTERN:
          suggestions.push('Take a break between transactions')
          suggestions.push('Review recent transaction history')
          break
      }
    })
    
    return [...new Set(suggestions)]
  }

  private calculateConfidenceScore(riskFactors: RiskFactor[]): number {
    if (riskFactors.length === 0) return 0.95
    
    const avgLikelihood = riskFactors.reduce((sum, f) => sum + f.likelihood, 0) / riskFactors.length
    return Math.max(0.1, Math.min(0.95, 1 - avgLikelihood * 0.5))
  }

  private estimateWorkflowValue(workflow: ParsedWorkflow): string {
    // Simplified value estimation - in reality this would analyze all actions
    let totalValue = 0
    
    workflow.actions.forEach(action => {
      action.parameters.forEach(param => {
        if (param.type === 'UFix64' && (param.name.toLowerCase().includes('amount') || param.name.toLowerCase().includes('value'))) {
          totalValue += parseFloat(param.value) || 0
        }
      })
    })
    
    return totalValue.toString()
  }

  private analyzeSuspiciousPatterns(workflow: ParsedWorkflow): number {
    let suspiciousScore = 0
    
    // Check for unusual action combinations
    const actionTypes = workflow.actions.map(a => a.actionType)
    
    // Multiple high-value transfers
    const transferCount = actionTypes.filter(t => t.includes('transfer')).length
    if (transferCount > 5) {
      suspiciousScore += 0.3
    }
    
    // Unusual action sequences
    if (actionTypes.includes('mint') && actionTypes.includes('transfer')) {
      suspiciousScore += 0.2 // Could be legitimate, but worth flagging
    }
    
    return Math.min(1.0, suspiciousScore)
  }

  private calculateAuditScore(findings: SecurityFinding[]): number {
    let score = 100
    
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          score -= 40
          break
        case 'high':
          score -= 25
          break
        case 'medium':
          score -= 10
          break
        case 'low':
          score -= 5
          break
      }
    })
    
    return Math.max(0, score)
  }

  private mapRiskFactorToWarningType(riskType: RiskFactorType): SecurityWarningType {
    switch (riskType) {
      case RiskFactorType.HIGH_VALUE:
        return SecurityWarningType.HIGH_VALUE_TRANSACTION
      case RiskFactorType.UNVERIFIED_CONTRACT:
        return SecurityWarningType.UNVERIFIED_CONTRACT
      case RiskFactorType.SUSPICIOUS_PATTERN:
        return SecurityWarningType.SUSPICIOUS_ACTIVITY
      case RiskFactorType.UNUSUAL_GAS:
        return SecurityWarningType.UNUSUAL_GAS_USAGE
      case RiskFactorType.MULTIPLE_AUTHORIZERS:
        return SecurityWarningType.MULTIPLE_AUTHORIZATIONS
      default:
        return SecurityWarningType.SUSPICIOUS_ACTIVITY
    }
  }

  private async queryContractRegistry(contractAddress: string): Promise<boolean> {
    // Simulate contract registry query
    // In a real implementation, this would query Flow's contract registry
    
    // Throw error for invalid addresses to test error handling
    if (!this.isValidFlowAddress(contractAddress)) {
      throw new Error('Invalid contract address format')
    }
    
    // For demo purposes, consider contracts with certain patterns as verified
    const verifiedPatterns = [
      '0x1654653399040a61', // Flow Token
      '0xf233dcee88fe0abe', // FUSD
      '0xa983fecbed621163'  // USDC
    ]
    
    return verifiedPatterns.some(pattern => contractAddress.includes(pattern))
  }

  private isValidFlowAddress(address: string): boolean {
    // Flow addresses are 16-character hex strings with 0x prefix
    const flowAddressRegex = /^0x[a-fA-F0-9]{16}$/
    return flowAddressRegex.test(address)
  }

  private isCacheValid(audit: SecurityAudit): boolean {
    if (!audit.auditedAt) return false
    
    const auditTime = new Date(audit.auditedAt)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    
    return auditTime > oneHourAgo
  }

  private logSecurityAssessment(transaction: Transaction, assessment: SecurityAssessment, executionTime: number): void {
    // In a real implementation, this would log to a monitoring system
    console.log('Security Assessment:', {
      transactionId: transaction.id,
      riskLevel: assessment.riskLevel,
      score: assessment.score,
      warningCount: assessment.warnings.length,
      requiresConfirmation: assessment.requiresConfirmation,
      blockExecution: assessment.blockExecution,
      executionTime
    })
  }
}
/*
*
 * FlowTransactionValidator - Validates Flow transactions for security and correctness
 * 
 * Implements comprehensive transaction parameter validation, gas limit checking,
 * authorization validation, and Cadence code security analysis
 */
export class FlowTransactionValidator implements TransactionValidator {
  
  private isValidFlowAddress(address: string): boolean {
    // Flow addresses are 16-character hex strings with 0x prefix
    const flowAddressRegex = /^0x[a-fA-F0-9]{16}$/
    return flowAddressRegex.test(address)
  }
  
  /**
   * Validates transaction parameters for type safety and format compliance
   * Requirement 8.1: Validate all transaction parameters against expected formats
   */
  async validateParameters(transaction: Transaction): Promise<ParameterValidationResult> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    const sanitizedParameters: Argument[] = []
    
    try {
      for (const arg of transaction.arguments) {
        const validation = await this.validateArgument(arg)
        
        if (!validation.isValid) {
          errors.push(...validation.errors)
        }
        
        warnings.push(...validation.warnings)
        
        // Add sanitized parameter if valid
        if (validation.sanitizedValue !== undefined) {
          sanitizedParameters.push({
            type: arg.type,
            value: validation.sanitizedValue
          })
        } else {
          sanitizedParameters.push(arg)
        }
      }
      
      // Validate transaction structure
      if (!transaction.id || typeof transaction.id !== 'string') {
        errors.push({
          type: ValidationErrorType.INVALID_FORMAT,
          message: 'Transaction ID is required and must be a string',
          severity: 'error'
        })
      }
      
      if (!transaction.cadenceCode || typeof transaction.cadenceCode !== 'string') {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED,
          message: 'Cadence code is required',
          severity: 'error'
        })
      }
      
      if (!transaction.proposer || !this.isValidFlowAddress(transaction.proposer)) {
        errors.push({
          type: ValidationErrorType.INVALID_FORMAT,
          message: 'Valid proposer address is required',
          severity: 'error'
        })
      }
      
      if (!Array.isArray(transaction.authorizers) || transaction.authorizers.length === 0) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED,
          message: 'At least one authorizer is required',
          severity: 'error'
        })
      } else {
        // Validate each authorizer address
        transaction.authorizers.forEach((auth, index) => {
          if (!this.isValidFlowAddress(auth)) {
            errors.push({
              type: ValidationErrorType.INVALID_FORMAT,
              message: `Invalid authorizer address at index ${index}: ${auth}`,
              severity: 'error'
            })
          }
        })
      }
      
      if (!transaction.payer || !this.isValidFlowAddress(transaction.payer)) {
        errors.push({
          type: ValidationErrorType.INVALID_FORMAT,
          message: 'Valid payer address is required',
          severity: 'error'
        })
      }
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        sanitizedParameters: sanitizedParameters.length > 0 ? sanitizedParameters : undefined
      }
      
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          type: ValidationErrorType.CUSTOM_VALIDATION,
          message: 'Parameter validation failed',
          severity: 'error'
        }],
        warnings: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  /**
   * Validates gas limits for reasonableness and safety
   */
  async validateGasLimits(transaction: Transaction): Promise<GasValidationResult> {
    try {
      const estimatedGas = transaction.metadata?.estimatedGas || 0
      const gasLimit = transaction.gasLimit
      
      const warnings: string[] = []
      let isReasonable = true
      
      // Check if gas limit is reasonable compared to estimate
      if (estimatedGas > 0) {
        const ratio = gasLimit / estimatedGas
        
        if (ratio > 3.0) {
          warnings.push('Gas limit is significantly higher than estimated')
          isReasonable = false
        } else if (ratio < 0.8) {
          warnings.push('Gas limit might be too low for successful execution')
          isReasonable = false
        }
      }
      
      // Check absolute gas limits
      const MAX_GAS_LIMIT = 9999 // Flow's maximum gas limit
      const MIN_GAS_LIMIT = 100  // Reasonable minimum
      
      if (gasLimit > MAX_GAS_LIMIT) {
        warnings.push(`Gas limit exceeds maximum allowed (${MAX_GAS_LIMIT})`)
        isReasonable = false
      }
      
      if (gasLimit < MIN_GAS_LIMIT) {
        warnings.push(`Gas limit is below recommended minimum (${MIN_GAS_LIMIT})`)
        isReasonable = false
      }
      
      return {
        isValid: gasLimit > 0 && gasLimit <= MAX_GAS_LIMIT,
        estimatedGas,
        gasLimit,
        isReasonable,
        warnings
      }
      
    } catch (error) {
      return {
        isValid: false,
        estimatedGas: 0,
        gasLimit: transaction.gasLimit,
        isReasonable: false,
        warnings: [`Gas validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      }
    }
  }

  /**
   * Validates transaction authorizations
   */
  async validateAuthorizations(transaction: Transaction): Promise<AuthorizationValidationResult> {
    try {
      const providedAuthorizers = transaction.authorizers
      const requiredAuthorizers = await this.extractRequiredAuthorizers(transaction.cadenceCode)
      
      const missingAuthorizers = requiredAuthorizers.filter(
        required => !providedAuthorizers.includes(required)
      )
      
      const unnecessaryAuthorizers = providedAuthorizers.filter(
        provided => !requiredAuthorizers.includes(provided) && provided !== transaction.payer
      )
      
      return {
        isValid: missingAuthorizers.length === 0,
        requiredAuthorizers,
        providedAuthorizers,
        missingAuthorizers,
        unnecessaryAuthorizers
      }
      
    } catch (error) {
      return {
        isValid: false,
        requiredAuthorizers: [],
        providedAuthorizers: transaction.authorizers,
        missingAuthorizers: [],
        unnecessaryAuthorizers: []
      }
    }
  }

  /**
   * Validates Cadence code for security issues and correctness
   * Requirement 8.5: Prevent execution and explain risks when simulation detects issues
   */
  async validateCadenceCode(cadenceCode: string): Promise<CadenceValidationResult> {
    try {
      const syntaxErrors: string[] = []
      const securityIssues: SecurityIssue[] = []
      
      // Basic syntax validation
      if (!cadenceCode.trim()) {
        syntaxErrors.push('Cadence code cannot be empty')
      }
      
      if (!cadenceCode.includes('transaction')) {
        syntaxErrors.push('Code must contain a transaction block')
      }
      
      // Security analysis
      const lines = cadenceCode.split('\n')
      
      lines.forEach((line, index) => {
        const lineNumber = index + 1
        
        // Check for unsafe resource access patterns
        if (line.includes('borrow<') && !line.includes('??')) {
          securityIssues.push({
            type: SecurityIssueType.UNSAFE_RESOURCE_ACCESS,
            severity: RiskLevel.HIGH,
            line: lineNumber,
            description: 'Unsafe resource borrowing without nil check',
            recommendation: 'Use nil-coalescing operator (??) or proper error handling'
          })
        }
        
        // Check for hardcoded addresses
        if (line.match(/0x[a-fA-F0-9]{16}/)) {
          securityIssues.push({
            type: SecurityIssueType.HARDCODED_ADDRESS,
            severity: RiskLevel.MEDIUM,
            line: lineNumber,
            description: 'Hardcoded address found',
            recommendation: 'Use parameters or constants instead of hardcoded addresses'
          })
        }
        
        // Check for dangerous capabilities
        if (line.includes('AuthAccount') && line.includes('save')) {
          securityIssues.push({
            type: SecurityIssueType.DANGEROUS_CAPABILITY,
            severity: RiskLevel.HIGH,
            line: lineNumber,
            description: 'Direct account storage modification',
            recommendation: 'Ensure proper access control and validation'
          })
        }
        
        // Check for potential reentrancy
        if (line.includes('call') && line.includes('callback')) {
          securityIssues.push({
            type: SecurityIssueType.POTENTIAL_REENTRANCY,
            severity: RiskLevel.MEDIUM,
            line: lineNumber,
            description: 'Potential reentrancy vulnerability',
            recommendation: 'Use checks-effects-interactions pattern'
          })
        }
      })
      
      // Calculate resource usage
      const resourceUsage = this.calculateResourceUsage(cadenceCode)
      
      // Calculate code complexity
      const complexity = this.calculateCodeComplexity(cadenceCode)
      
      return {
        isValid: syntaxErrors.length === 0 && !securityIssues.some(i => i.severity === RiskLevel.CRITICAL),
        syntaxErrors,
        securityIssues,
        resourceUsage,
        complexity
      }
      
    } catch (error) {
      return {
        isValid: false,
        syntaxErrors: [`Code validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        securityIssues: [],
        resourceUsage: {
          computationUnits: 0,
          storageUnits: 0,
          networkCalls: 0,
          contractInteractions: 0
        },
        complexity: {
          cyclomaticComplexity: 0,
          linesOfCode: 0,
          functionCount: 0,
          branchCount: 0
        }
      }
    }
  }

  // Private helper methods
  
  private async validateArgument(arg: Argument): Promise<{
    isValid: boolean
    errors: ValidationError[]
    warnings: string[]
    sanitizedValue?: any
  }> {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    let sanitizedValue: any = arg.value
    
    try {
      switch (arg.type) {
        case 'Address':
          if (!this.isValidFlowAddress(arg.value)) {
            errors.push({
              type: ValidationErrorType.INVALID_FORMAT,
              message: `Invalid Flow address: ${arg.value}`,
              severity: 'error'
            })
          }
          break
          
        case 'UFix64':
          const numValue = parseFloat(arg.value)
          if (isNaN(numValue) || numValue < 0) {
            errors.push({
              type: ValidationErrorType.INVALID_TYPE,
              message: `Invalid UFix64 value: ${arg.value}`,
              severity: 'error'
            })
          } else {
            sanitizedValue = numValue.toFixed(8) // Ensure proper precision
          }
          break
          
        case 'String':
          if (typeof arg.value !== 'string') {
            errors.push({
              type: ValidationErrorType.INVALID_TYPE,
              message: `Expected string, got ${typeof arg.value}`,
              severity: 'error'
            })
          } else if (arg.value.length > 1000) {
            warnings.push('String parameter is very long')
          }
          break
          
        case 'Bool':
          if (typeof arg.value !== 'boolean' && arg.value !== 'true' && arg.value !== 'false') {
            errors.push({
              type: ValidationErrorType.INVALID_TYPE,
              message: `Invalid boolean value: ${arg.value}`,
              severity: 'error'
            })
          } else {
            sanitizedValue = arg.value === true || arg.value === 'true'
          }
          break
          
        case 'UInt64':
          const uintValue = parseInt(arg.value)
          if (isNaN(uintValue) || uintValue < 0 || uintValue > Number.MAX_SAFE_INTEGER) {
            errors.push({
              type: ValidationErrorType.OUT_OF_RANGE,
              message: `Invalid UInt64 value: ${arg.value}`,
              severity: 'error'
            })
          } else {
            sanitizedValue = uintValue
          }
          break
          
        default:
          warnings.push(`Unknown parameter type: ${arg.type}`)
      }
      
    } catch (error) {
      errors.push({
        type: ValidationErrorType.CUSTOM_VALIDATION,
        message: `Argument validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitizedValue
    }
  }

  private async extractRequiredAuthorizers(cadenceCode: string): Promise<string[]> {
    // Simple extraction of authorizers from Cadence code
    // In a real implementation, this would use proper Cadence parsing
    
    const authorizers: string[] = []
    const lines = cadenceCode.split('\n')
    
    lines.forEach(line => {
      // Look for AuthAccount usage patterns
      if (line.includes('AuthAccount') || line.includes('prepare(')) {
        // Extract addresses from prepare block
        const matches = line.match(/0x[a-fA-F0-9]{16}/g)
        if (matches) {
          authorizers.push(...matches)
        }
      }
    })
    
    return [...new Set(authorizers)] // Remove duplicates
  }

  private calculateResourceUsage(cadenceCode: string): ResourceUsage {
    const lines = cadenceCode.split('\n')
    let computationUnits = lines.length * 10 // Base computation
    let storageUnits = 0
    let networkCalls = 0
    let contractInteractions = 0
    
    lines.forEach(line => {
      // Count storage operations
      if (line.includes('save') || line.includes('load') || line.includes('borrow')) {
        storageUnits += 100
        computationUnits += 50
      }
      
      // Count network calls (imports, etc.)
      if (line.includes('import')) {
        networkCalls += 1
        computationUnits += 20
      }
      
      // Count contract interactions
      if (line.includes('.') && line.includes('(')) {
        contractInteractions += 1
        computationUnits += 30
      }
      
      // Count loops and complex operations
      if (line.includes('for') || line.includes('while')) {
        computationUnits += 100
      }
    })
    
    return {
      computationUnits,
      storageUnits,
      networkCalls,
      contractInteractions
    }
  }

  private calculateCodeComplexity(cadenceCode: string): CodeComplexity {
    const lines = cadenceCode.split('\n').filter(line => line.trim().length > 0)
    let functionCount = 0
    let branchCount = 0
    let cyclomaticComplexity = 1 // Base complexity
    
    lines.forEach(line => {
      // Count functions
      if (line.includes('fun ') || line.includes('function ')) {
        functionCount += 1
        cyclomaticComplexity += 1
      }
      
      // Count branches
      if (line.includes('if') || line.includes('else') || line.includes('switch')) {
        branchCount += 1
        cyclomaticComplexity += 1
      }
      
      // Count loops
      if (line.includes('for') || line.includes('while')) {
        branchCount += 1
        cyclomaticComplexity += 1
      }
    })
    
    return {
      cyclomaticComplexity,
      linesOfCode: lines.length,
      functionCount,
      branchCount
    }
  }
}