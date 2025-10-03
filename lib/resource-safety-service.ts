import { ParsedWorkflow, ActionMetadata } from './types'

export interface ResourceAnalysis {
  resourceLeaks: ResourceLeak[]
  unsafeOperations: UnsafeOperation[]
  securityIssues: SecurityIssue[]
  recommendations: string[]
  overallSafety: 'safe' | 'warning' | 'unsafe'
}

export interface ResourceLeak {
  type: 'resource' | 'capability' | 'reference'
  location: string
  description: string
  severity: 'low' | 'medium' | 'high'
  suggestion: string
}

export interface UnsafeOperation {
  operation: string
  location: string
  risk: string
  mitigation: string
  severity: 'low' | 'medium' | 'high'
}

export interface SecurityIssue {
  type: 'access_control' | 'resource_management' | 'input_validation' | 'reentrancy'
  description: string
  location: string
  severity: 'low' | 'medium' | 'high'
  cwe?: string // Common Weakness Enumeration ID
  recommendation: string
}

export interface CadencePattern {
  pattern: RegExp
  type: 'resource_creation' | 'resource_destruction' | 'capability_link' | 'unsafe_operation'
  severity: 'low' | 'medium' | 'high'
  description: string
}

export class ResourceSafetyService {
  private static readonly CADENCE_PATTERNS: CadencePattern[] = [
    {
      pattern: /create\s+\w+\s*\(/g,
      type: 'resource_creation',
      severity: 'medium',
      description: 'Resource creation detected - ensure proper lifecycle management'
    },
    {
      pattern: /destroy\s+\w+/g,
      type: 'resource_destruction',
      severity: 'medium',
      description: 'Resource destruction detected - verify all references are handled'
    },
    {
      pattern: /getCapability\s*\(/g,
      type: 'capability_link',
      severity: 'low',
      description: 'Capability access detected - ensure proper authorization'
    },
    {
      pattern: /panic\s*\(/g,
      type: 'unsafe_operation',
      severity: 'high',
      description: 'Panic operation detected - consider graceful error handling'
    },
    {
      pattern: /\w+!/g,
      type: 'unsafe_operation',
      severity: 'high',
      description: 'Force unwrap detected - potential runtime crash risk'
    }
  ]

  private static readonly SECURITY_PATTERNS = [
    {
      pattern: /access\(all\)/g,
      type: 'access_control' as const,
      severity: 'medium' as const,
      description: 'Public access modifier detected - ensure intentional exposure',
      cwe: 'CWE-732'
    },
    {
      pattern: /AuthAccount\s*\(/g,
      type: 'access_control' as const,
      severity: 'high' as const,
      description: 'AuthAccount usage detected - verify proper authorization',
      cwe: 'CWE-285'
    },
    {
      pattern: /\.borrow\s*\(/g,
      type: 'resource_management' as const,
      severity: 'medium' as const,
      description: 'Resource borrowing detected - ensure reference validity',
      cwe: 'CWE-416'
    }
  ]

  /**
   * Analyzes generated Cadence code for resource safety issues
   */
  async analyzeResourceSafety(
    cadenceCode: string,
    workflow: ParsedWorkflow,
    actions: ActionMetadata[]
  ): Promise<ResourceAnalysis> {
    const resourceLeaks = this.detectResourceLeaks(cadenceCode)
    const unsafeOperations = this.detectUnsafeOperations(cadenceCode)
    const securityIssues = this.detectSecurityIssues(cadenceCode)
    const recommendations = this.generateRecommendations(resourceLeaks, unsafeOperations, securityIssues)
    
    const overallSafety = this.calculateOverallSafety(resourceLeaks, unsafeOperations, securityIssues)

    return {
      resourceLeaks,
      unsafeOperations,
      securityIssues,
      recommendations,
      overallSafety
    }
  }

  /**
   * Detects potential resource leaks in Cadence code
   */
  private detectResourceLeaks(cadenceCode: string): ResourceLeak[] {
    const leaks: ResourceLeak[] = []
    const lines = cadenceCode.split('\n')
    
    // Track resource creation and destruction
    const resourceCreations = new Map<string, number>()
    const resourceDestructions = new Set<string>()
    const resourceStorage = new Set<string>()
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1
      
      // Check for resource creation
      const createMatch = line.match(/let\s+(\w+)\s*<-\s*create\s+(\w+)/g)
      if (createMatch) {
        createMatch.forEach(match => {
          const varMatch = match.match(/let\s+(\w+)/)
          if (varMatch) {
            resourceCreations.set(varMatch[1], lineNumber)
          }
        })
      }
      
      // Check for resource destruction
      const destroyMatch = line.match(/destroy\s+(\w+)/g)
      if (destroyMatch) {
        destroyMatch.forEach(match => {
          const varMatch = match.match(/destroy\s+(\w+)/)
          if (varMatch) {
            resourceDestructions.add(varMatch[1])
          }
        })
      }
      
      // Check for resource storage (save operations)
      const saveMatch = line.match(/\.save\s*\(\s*<-\s*(\w+)/g)
      if (saveMatch) {
        saveMatch.forEach(match => {
          const varMatch = match.match(/<-\s*(\w+)/)
          if (varMatch) {
            resourceStorage.add(varMatch[1])
          }
        })
      }
      
      // Check for resource moves without proper handling
      const moveMatch = line.match(/(\w+)\s*<-\s*(\w+)/g)
      if (moveMatch && !line.includes('create') && !line.includes('destroy') && !line.includes('save')) {
        leaks.push({
          type: 'resource',
          location: `Line ${lineNumber}`,
          description: 'Resource move detected without clear lifecycle management',
          severity: 'medium',
          suggestion: 'Ensure resource is properly handled after move operation'
        })
      }
    })
    
    // Check for unmatched resource creations
    resourceCreations.forEach((lineNumber, resourceName) => {
      if (!resourceDestructions.has(resourceName) && !resourceStorage.has(resourceName)) {
        leaks.push({
          type: 'resource',
          location: `Line ${lineNumber}`,
          description: `Resource '${resourceName}' created but not explicitly destroyed or stored`,
          severity: 'high',
          suggestion: `Add explicit destroy statement for resource '${resourceName}' or ensure it's properly stored`
        })
      }
    })
    
    return leaks
  }

  /**
   * Detects unsafe operations in Cadence code
   */
  private detectUnsafeOperations(cadenceCode: string): UnsafeOperation[] {
    const operations: UnsafeOperation[] = []
    const lines = cadenceCode.split('\n')
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1
      
      ResourceSafetyService.CADENCE_PATTERNS.forEach(pattern => {
        const matches = line.match(pattern.pattern)
        if (matches) {
          matches.forEach(match => {
            operations.push({
              operation: match,
              location: `Line ${lineNumber}`,
              risk: pattern.description,
              mitigation: this.getMitigationForPattern(pattern.type),
              severity: pattern.severity
            })
          })
        }
      })
    })
    
    return operations
  }

  /**
   * Detects security issues in Cadence code
   */
  private detectSecurityIssues(cadenceCode: string): SecurityIssue[] {
    const issues: SecurityIssue[] = []
    const lines = cadenceCode.split('\n')
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1
      
      ResourceSafetyService.SECURITY_PATTERNS.forEach(pattern => {
        const matches = line.match(pattern.pattern)
        if (matches) {
          matches.forEach(() => {
            issues.push({
              type: pattern.type,
              description: pattern.description,
              location: `Line ${lineNumber}`,
              severity: pattern.severity,
              cwe: pattern.cwe,
              recommendation: this.getSecurityRecommendation(pattern.type)
            })
          })
        }
      })
    })
    
    return issues
  }

  /**
   * Generates recommendations based on analysis results
   */
  private generateRecommendations(
    resourceLeaks: ResourceLeak[],
    unsafeOperations: UnsafeOperation[],
    securityIssues: SecurityIssue[]
  ): string[] {
    const recommendations: string[] = []
    
    if (resourceLeaks.length > 0) {
      recommendations.push('Implement proper resource lifecycle management with explicit destroy statements')
      recommendations.push('Consider using resource storage patterns to avoid manual resource management')
    }
    
    if (unsafeOperations.some(op => op.severity === 'high')) {
      recommendations.push('Replace force unwrap operations with safe optional handling')
      recommendations.push('Implement graceful error handling instead of panic operations')
    }
    
    if (securityIssues.some(issue => issue.severity === 'high')) {
      recommendations.push('Review access control modifiers and ensure principle of least privilege')
      recommendations.push('Implement proper authorization checks for sensitive operations')
    }
    
    if (recommendations.length === 0) {
      recommendations.push('Code appears to follow resource safety best practices')
    }
    
    return recommendations
  }

  /**
   * Calculates overall safety rating
   */
  private calculateOverallSafety(
    resourceLeaks: ResourceLeak[],
    unsafeOperations: UnsafeOperation[],
    securityIssues: SecurityIssue[]
  ): 'safe' | 'warning' | 'unsafe' {
    const highSeverityIssues = [
      ...resourceLeaks.filter(leak => leak.severity === 'high'),
      ...unsafeOperations.filter(op => op.severity === 'high'),
      ...securityIssues.filter(issue => issue.severity === 'high')
    ]
    
    if (highSeverityIssues.length > 0) {
      return 'unsafe'
    }
    
    const mediumSeverityIssues = [
      ...resourceLeaks.filter(leak => leak.severity === 'medium'),
      ...unsafeOperations.filter(op => op.severity === 'medium'),
      ...securityIssues.filter(issue => issue.severity === 'medium')
    ]
    
    if (mediumSeverityIssues.length > 2) {
      return 'warning'
    }
    
    return 'safe'
  }

  /**
   * Gets mitigation strategy for detected patterns
   */
  private getMitigationForPattern(patternType: string): string {
    switch (patternType) {
      case 'resource_creation':
        return 'Ensure resource is stored or explicitly destroyed'
      case 'resource_destruction':
        return 'Verify all references are invalidated before destruction'
      case 'capability_link':
        return 'Implement proper authorization checks'
      case 'unsafe_operation':
        return 'Use safe alternatives or add proper error handling'
      default:
        return 'Review operation for potential safety issues'
    }
  }

  /**
   * Gets security recommendation for issue type
   */
  private getSecurityRecommendation(issueType: string): string {
    switch (issueType) {
      case 'access_control':
        return 'Use more restrictive access modifiers and implement proper authorization'
      case 'resource_management':
        return 'Ensure resource references are valid and properly managed'
      case 'input_validation':
        return 'Implement comprehensive input validation and sanitization'
      case 'reentrancy':
        return 'Use checks-effects-interactions pattern to prevent reentrancy attacks'
      default:
        return 'Review code for security best practices'
    }
  }

  /**
   * Integrates with Flow security tools for comprehensive analysis
   */
  async integrateFlowSecurityTools(cadenceCode: string): Promise<{
    flowLintResults: any[]
    cadenceAnalyzerResults: any[]
    recommendations: string[]
  }> {
    // This would integrate with actual Flow security tools
    // For now, we'll simulate the integration
    
    const flowLintResults = await this.simulateFlowLint(cadenceCode)
    const cadenceAnalyzerResults = await this.simulateCadenceAnalyzer(cadenceCode)
    
    const recommendations = [
      ...flowLintResults.map(result => `Flow Lint: ${result.message}`),
      ...cadenceAnalyzerResults.map(result => `Cadence Analyzer: ${result.message}`)
    ]
    
    return {
      flowLintResults,
      cadenceAnalyzerResults,
      recommendations
    }
  }

  /**
   * Simulates Flow lint integration
   */
  private async simulateFlowLint(cadenceCode: string): Promise<any[]> {
    // Simulate Flow lint results
    const results = []
    
    if (cadenceCode.includes('panic')) {
      results.push({
        type: 'warning',
        message: 'Consider using Result type instead of panic for error handling',
        line: cadenceCode.split('\n').findIndex(line => line.includes('panic')) + 1
      })
    }
    
    if (cadenceCode.includes('access(all)')) {
      results.push({
        type: 'info',
        message: 'Consider using more restrictive access modifiers',
        line: cadenceCode.split('\n').findIndex(line => line.includes('access(all)')) + 1
      })
    }
    
    return results
  }

  /**
   * Simulates Cadence analyzer integration
   */
  private async simulateCadenceAnalyzer(cadenceCode: string): Promise<any[]> {
    // Simulate Cadence analyzer results
    const results = []
    
    // Remove comments to avoid false matches
    const cleanCode = cadenceCode.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    
    const resourceCreations = (cleanCode.match(/create\s+\w+/g) || []).length
    const resourceDestructions = (cleanCode.match(/destroy\s+\w+/g) || []).length
    const resourceStorage = (cleanCode.match(/\.save\s*\(/g) || []).length
    
    if (resourceCreations > (resourceDestructions + resourceStorage)) {
      results.push({
        type: 'warning',
        message: 'Potential resource leak detected - more resources created than destroyed or stored',
        severity: 'medium'
      })
    }
    
    if (cleanCode.match(/\w+!/)) {
      results.push({
        type: 'error',
        message: 'Force unwrap detected - potential runtime crash',
        severity: 'high'
      })
    }
    
    return results
  }
}