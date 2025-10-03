import { 
  ForteAction, 
  ActionMetadata, 
  ValidationResult, 
  SecurityLevel,
  FlowAPIConfig 
} from './types'
import { FlowAPIClient, createFlowAPIClient } from './flow-api-client'
import { createActionDiscoveryService, IActionDiscoveryService } from './action-discovery'
import { FORTE_CONSTANTS } from './flow-config'

/**
 * Create a complete Forte integration instance
 */
export function createForteIntegration(config?: Partial<FlowAPIConfig>): {
  flowClient: FlowAPIClient
  discoveryService: IActionDiscoveryService
} {
  const flowClient = createFlowAPIClient(
    config?.network?.name as any || 'testnet',
    config?.apiKey
  )
  
  const discoveryService = createActionDiscoveryService(flowClient)
  
  return {
    flowClient,
    discoveryService
  }
}

/**
 * Validate a Forte Action against security and compatibility requirements
 */
export function validateForteAction(action: ForteAction): ValidationResult {
  const errors: any[] = []
  const warnings: string[] = []
  const compatibilityIssues: any[] = []

  // Security validation
  if (action.securityAudit.score < FORTE_CONSTANTS.MIN_SECURITY_SCORE) {
    errors.push({
      type: 'security_error',
      message: `Security score ${action.securityAudit.score} is below minimum threshold ${FORTE_CONSTANTS.MIN_SECURITY_SCORE}`,
      severity: 'error' as const
    })
  }

  // Critical security findings
  const criticalFindings = action.securityAudit.findings.filter(f => f.severity === 'critical')
  if (criticalFindings.length > 0) {
    errors.push({
      type: 'security_error',
      message: `Action has ${criticalFindings.length} critical security findings`,
      severity: 'error' as const
    })
  }

  // Version validation
  if (!isValidVersion(action.version)) {
    errors.push({
      type: 'version_error',
      message: 'Invalid version format',
      field: 'version',
      severity: 'error' as const
    })
  }

  // Contract address validation
  if (!isValidFlowAddress(action.contractAddress)) {
    errors.push({
      type: 'address_error',
      message: 'Invalid contract address format',
      field: 'contractAddress',
      severity: 'error' as const
    })
  }

  // Gas estimate validation
  if (action.gasEstimate > FORTE_CONSTANTS.MAX_GAS_LIMIT) {
    warnings.push(`Gas estimate ${action.gasEstimate} exceeds recommended maximum ${FORTE_CONSTANTS.MAX_GAS_LIMIT}`)
  }

  // Dependency validation
  if (action.dependencies.length > 10) {
    warnings.push('Action has many dependencies, which may affect performance')
  }

  // Compatibility validation
  if (action.compatibility.conflictsWith.length > FORTE_CONSTANTS.MAX_COMPATIBILITY_ISSUES) {
    warnings.push('Action has many compatibility conflicts')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    compatibilityIssues
  }
}

/**
 * Parse raw metadata into ActionMetadata format
 */
export function parseForteMetadata(rawData: any): ActionMetadata | null {
  try {
    // Validate required fields
    if (!rawData.id || !rawData.name || !rawData.version) {
      console.error('Missing required fields in metadata:', rawData)
      return null
    }

    const metadata: ActionMetadata = {
      id: rawData.id,
      name: rawData.name,
      description: rawData.description || '',
      category: rawData.category || 'uncategorized',
      version: rawData.version,
      inputs: parseActionInputs(rawData.inputs || []),
      outputs: parseActionOutputs(rawData.outputs || []),
      parameters: parseActionParameters(rawData.parameters || []),
      compatibility: parseCompatibilityInfo(rawData.compatibility || {}),
      gasEstimate: parseInt(rawData.gasEstimate) || FORTE_CONSTANTS.DEFAULT_GAS_LIMIT,
      securityLevel: parseSecurityLevel(rawData.securityLevel),
      author: rawData.author || 'unknown',
      createdAt: rawData.createdAt || new Date().toISOString(),
      updatedAt: rawData.updatedAt || new Date().toISOString()
    }

    return metadata
  } catch (error) {
    console.error('Error parsing Forte metadata:', error)
    return null
  }
}

/**
 * Convert ActionMetadata to ForteAction
 */
export function createForteAction(
  metadata: ActionMetadata,
  contractAddress: string,
  securityAudit: any,
  dependencies: string[] = [],
  tags: string[] = []
): ForteAction {
  return {
    id: metadata.id,
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    inputs: metadata.inputs,
    outputs: metadata.outputs,
    version: metadata.version,
    contractAddress,
    metadata,
    compatibility: metadata.compatibility,
    gasEstimate: metadata.gasEstimate,
    securityAudit,
    dependencies,
    tags
  }
}

/**
 * Check if two Actions are compatible for chaining
 */
export function areActionsCompatible(action1: ForteAction, action2: ForteAction): {
  compatible: boolean
  issues: string[]
  suggestions: string[]
} {
  const issues: string[] = []
  const suggestions: string[] = []

  // Check explicit conflicts
  if (action1.compatibility.conflictsWith.includes(action2.id)) {
    issues.push(`${action1.name} explicitly conflicts with ${action2.name}`)
    suggestions.push('These actions cannot be used in the same workflow')
  }

  // Check network compatibility
  const commonNetworks = action1.compatibility.supportedNetworks.filter(
    network => action2.compatibility.supportedNetworks.includes(network)
  )
  
  if (commonNetworks.length === 0) {
    issues.push('Actions do not support any common networks')
    suggestions.push('Ensure both actions support the same Flow network')
  }

  // Check capability requirements
  const missingCapabilities = action2.compatibility.requiredCapabilities.filter(
    cap => !action1.compatibility.requiredCapabilities.includes(cap)
  )
  
  if (missingCapabilities.length > 0) {
    issues.push(`Missing required capabilities: ${missingCapabilities.join(', ')}`)
    suggestions.push('Add actions that provide the missing capabilities')
  }

  // Check input/output type compatibility
  for (const output of action1.outputs) {
    for (const input of action2.inputs) {
      if (input.name === output.name && input.type !== output.type) {
        issues.push(`Type mismatch: ${output.name} (${output.type} -> ${input.type})`)
        suggestions.push('Add a type conversion action between these actions')
      }
    }
  }

  return {
    compatible: issues.length === 0,
    issues,
    suggestions
  }
}

// Helper functions

function parseActionInputs(inputs: any[]): any[] {
  return inputs.map(input => ({
    name: input.name,
    type: input.type,
    required: input.required !== false,
    description: input.description,
    validation: input.validation || []
  }))
}

function parseActionOutputs(outputs: any[]): any[] {
  return outputs.map(output => ({
    name: output.name,
    type: output.type,
    description: output.description
  }))
}

function parseActionParameters(parameters: any[]): any[] {
  return parameters.map(param => ({
    name: param.name,
    type: param.type,
    value: param.value,
    required: param.required !== false
  }))
}

function parseCompatibilityInfo(compatibility: any): any {
  return {
    requiredCapabilities: compatibility.requiredCapabilities || [],
    supportedNetworks: compatibility.supportedNetworks || ['testnet'],
    minimumFlowVersion: compatibility.minimumFlowVersion || '1.0.0',
    conflictsWith: compatibility.conflictsWith || []
  }
}

function parseSecurityLevel(level: string): SecurityLevel {
  switch (level?.toLowerCase()) {
    case 'low': return SecurityLevel.LOW
    case 'medium': return SecurityLevel.MEDIUM
    case 'high': return SecurityLevel.HIGH
    case 'critical': return SecurityLevel.CRITICAL
    default: return SecurityLevel.MEDIUM
  }
}

function isValidVersion(version: string): boolean {
  // Simple semantic version validation
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/
  return semverRegex.test(version)
}

function isValidFlowAddress(address: string): boolean {
  // Flow address validation (0x followed by 16 hex characters)
  const flowAddressRegex = /^0x[a-fA-F0-9]{16}$/
  return flowAddressRegex.test(address)
}