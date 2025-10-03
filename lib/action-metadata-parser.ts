import { 
  ActionMetadata, 
  ActionInput, 
  ActionOutput, 
  ActionParameter, 
  CompatibilityInfo, 
  SecurityLevel,
  ValidationRule,
  ValidationResult,
  ValidationError,
  CompatibilityIssue
} from './types'

/**
 * Parser for Action metadata from Flow blockchain responses
 */
export class ActionMetadataParser {
  /**
   * Parse raw Action metadata from Flow API response
   */
  static parseActionMetadata(rawData: any): ActionMetadata | null {
    try {
      if (!rawData || typeof rawData !== 'object') {
        throw new Error('Invalid metadata format: expected object')
      }

      // Validate required fields
      const requiredFields = ['id', 'name', 'description', 'version']
      for (const field of requiredFields) {
        if (!rawData[field]) {
          throw new Error(`Missing required field: ${field}`)
        }
      }

      const metadata: ActionMetadata = {
        id: this.validateString(rawData.id, 'id'),
        name: this.validateString(rawData.name, 'name'),
        description: this.validateString(rawData.description, 'description'),
        category: this.validateString(rawData.category || 'general', 'category'),
        version: this.validateString(rawData.version, 'version'),
        inputs: this.parseInputs(rawData.inputs || []),
        outputs: this.parseOutputs(rawData.outputs || []),
        parameters: this.parseParameters(rawData.parameters || []),
        compatibility: this.parseCompatibility(rawData.compatibility || {}),
        gasEstimate: this.validateNumber(rawData.gasEstimate || 0, 'gasEstimate'),
        securityLevel: this.parseSecurityLevel(rawData.securityLevel),
        author: this.validateString(rawData.author || 'unknown', 'author'),
        createdAt: this.validateString(rawData.createdAt || new Date().toISOString(), 'createdAt'),
        updatedAt: this.validateString(rawData.updatedAt || new Date().toISOString(), 'updatedAt')
      }

      // Validate the parsed metadata
      const validation = this.validateMetadata(metadata)
      if (!validation.isValid) {
        console.warn(`Metadata validation warnings for ${metadata.id}:`, validation.errors)
      }

      return metadata
    } catch (error) {
      console.error('Failed to parse Action metadata:', error)
      return null
    }
  }

  /**
   * Parse Action inputs from raw data
   */
  private static parseInputs(rawInputs: any[]): ActionInput[] {
    if (!Array.isArray(rawInputs)) {
      console.warn('Invalid inputs format: expected array')
      return []
    }

    return rawInputs.map((input, index) => {
      try {
        return {
          name: this.validateString(input.name, `input[${index}].name`),
          type: this.validateString(input.type, `input[${index}].type`),
          required: Boolean(input.required),
          description: input.description ? this.validateString(input.description, `input[${index}].description`) : undefined,
          validation: this.parseValidationRules(input.validation || [])
        }
      } catch (error) {
        console.warn(`Failed to parse input at index ${index}:`, error)
        return {
          name: `input_${index}`,
          type: 'String',
          required: false,
          description: 'Invalid input definition'
        }
      }
    })
  }

  /**
   * Parse Action outputs from raw data
   */
  private static parseOutputs(rawOutputs: any[]): ActionOutput[] {
    if (!Array.isArray(rawOutputs)) {
      console.warn('Invalid outputs format: expected array')
      return []
    }

    return rawOutputs.map((output, index) => {
      try {
        return {
          name: this.validateString(output.name, `output[${index}].name`),
          type: this.validateString(output.type, `output[${index}].type`),
          description: output.description ? this.validateString(output.description, `output[${index}].description`) : undefined
        }
      } catch (error) {
        console.warn(`Failed to parse output at index ${index}:`, error)
        return {
          name: `output_${index}`,
          type: 'String',
          description: 'Invalid output definition'
        }
      }
    })
  }

  /**
   * Parse Action parameters from raw data
   */
  private static parseParameters(rawParameters: any[]): ActionParameter[] {
    if (!Array.isArray(rawParameters)) {
      console.warn('Invalid parameters format: expected array')
      return []
    }

    return rawParameters.map((param, index) => {
      try {
        return {
          name: this.validateString(param.name, `parameter[${index}].name`),
          type: this.validateString(param.type, `parameter[${index}].type`),
          value: param.value || '',
          required: Boolean(param.required)
        }
      } catch (error) {
        console.warn(`Failed to parse parameter at index ${index}:`, error)
        return {
          name: `param_${index}`,
          type: 'String',
          value: '',
          required: false
        }
      }
    })
  }

  /**
   * Parse compatibility information from raw data
   */
  private static parseCompatibility(rawCompatibility: any): CompatibilityInfo {
    return {
      requiredCapabilities: Array.isArray(rawCompatibility.requiredCapabilities) 
        ? rawCompatibility.requiredCapabilities.filter(cap => typeof cap === 'string')
        : [],
      supportedNetworks: Array.isArray(rawCompatibility.supportedNetworks)
        ? rawCompatibility.supportedNetworks.filter(net => typeof net === 'string')
        : ['testnet', 'mainnet'],
      minimumFlowVersion: this.validateString(rawCompatibility.minimumFlowVersion || '1.0.0', 'minimumFlowVersion'),
      conflictsWith: Array.isArray(rawCompatibility.conflictsWith)
        ? rawCompatibility.conflictsWith.filter(conflict => typeof conflict === 'string')
        : []
    }
  }

  /**
   * Parse security level from raw data
   */
  private static parseSecurityLevel(rawLevel: any): SecurityLevel {
    const validLevels = Object.values(SecurityLevel)
    if (validLevels.includes(rawLevel)) {
      return rawLevel as SecurityLevel
    }
    return SecurityLevel.MEDIUM // Default to medium security level
  }

  /**
   * Parse validation rules from raw data
   */
  private static parseValidationRules(rawRules: any[]): ValidationRule[] {
    if (!Array.isArray(rawRules)) {
      return []
    }

    return rawRules.map((rule, index) => {
      try {
        const validTypes = ['range', 'pattern', 'custom']
        const type = validTypes.includes(rule.type) ? rule.type : 'custom'
        
        return {
          type,
          value: rule.value,
          message: this.validateString(rule.message || 'Validation failed', `rule[${index}].message`)
        }
      } catch (error) {
        console.warn(`Failed to parse validation rule at index ${index}:`, error)
        return {
          type: 'custom',
          value: null,
          message: 'Invalid validation rule'
        }
      }
    })
  }

  /**
   * Validate Action metadata structure and content
   */
  static validateMetadata(metadata: ActionMetadata): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Validate ID format
    if (!/^[a-zA-Z0-9_-]+$/.test(metadata.id)) {
      errors.push({
        type: 'format',
        message: 'Action ID contains invalid characters',
        field: 'id',
        severity: 'error'
      })
    }

    // Validate version format (semantic versioning)
    if (!/^\d+\.\d+\.\d+/.test(metadata.version)) {
      warnings.push('Version does not follow semantic versioning format')
    }

    // Validate inputs and outputs
    const inputs = metadata.inputs || []
    const outputs = metadata.outputs || []
    
    if (inputs.length === 0 && outputs.length === 0) {
      warnings.push('Action has no inputs or outputs defined')
    }

    // Check for duplicate input names
    const inputNames = inputs.map(input => input.name)
    const duplicateInputs = inputNames.filter((name, index) => inputNames.indexOf(name) !== index)
    if (duplicateInputs.length > 0) {
      errors.push({
        type: 'duplicate',
        message: `Duplicate input names found: ${duplicateInputs.join(', ')}`,
        field: 'inputs',
        severity: 'error'
      })
    }

    // Check for duplicate output names
    const outputNames = outputs.map(output => output.name)
    const duplicateOutputs = outputNames.filter((name, index) => outputNames.indexOf(name) !== index)
    if (duplicateOutputs.length > 0) {
      errors.push({
        type: 'duplicate',
        message: `Duplicate output names found: ${duplicateOutputs.join(', ')}`,
        field: 'outputs',
        severity: 'error'
      })
    }

    // Validate gas estimate
    if (metadata.gasEstimate < 0) {
      errors.push({
        type: 'range',
        message: 'Gas estimate cannot be negative',
        field: 'gasEstimate',
        severity: 'error'
      })
    }

    if (metadata.gasEstimate > 10000) {
      warnings.push('Gas estimate is unusually high (>10000)')
    }

    // Validate network support
    const validNetworks = ['testnet', 'mainnet', 'emulator']
    const compatibility = metadata.compatibility || { supportedNetworks: [] }
    const supportedNetworks = compatibility.supportedNetworks || []
    const invalidNetworks = supportedNetworks.filter(
      network => !validNetworks.includes(network)
    )
    if (invalidNetworks.length > 0) {
      warnings.push(`Unknown networks in compatibility: ${invalidNetworks.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Check compatibility between two Actions for chaining
   */
  static checkCompatibility(sourceAction: ActionMetadata, targetAction: ActionMetadata): CompatibilityIssue[] {
    const issues: CompatibilityIssue[] = []

    // Check if source outputs match target inputs
    const sourceOutputTypes = sourceAction.outputs.map(output => ({ name: output.name, type: output.type }))
    const targetInputTypes = targetAction.inputs.filter(input => input.required).map(input => ({ name: input.name, type: input.type }))

    for (const requiredInput of targetInputTypes) {
      const matchingOutput = sourceOutputTypes.find(output => 
        output.name === requiredInput.name || output.type === requiredInput.type
      )

      if (!matchingOutput) {
        issues.push({
          sourceActionId: sourceAction.id,
          targetActionId: targetAction.id,
          issue: `Required input '${requiredInput.name}' of type '${requiredInput.type}' not provided by source action`,
          suggestion: `Ensure source action outputs a value of type '${requiredInput.type}' or add a transformation step`
        })
      }
    }

    // Check network compatibility
    const sourceNetworks = new Set(sourceAction.compatibility.supportedNetworks)
    const targetNetworks = new Set(targetAction.compatibility.supportedNetworks)
    const commonNetworks = [...sourceNetworks].filter(network => targetNetworks.has(network))

    if (commonNetworks.length === 0) {
      issues.push({
        sourceActionId: sourceAction.id,
        targetActionId: targetAction.id,
        issue: 'Actions do not share any common supported networks',
        suggestion: 'Deploy both actions to a common network or use network-specific alternatives'
      })
    }

    // Check for explicit conflicts
    if (sourceAction.compatibility.conflictsWith.includes(targetAction.id)) {
      issues.push({
        sourceActionId: sourceAction.id,
        targetActionId: targetAction.id,
        issue: 'Actions are explicitly marked as conflicting',
        suggestion: 'Use alternative actions or separate the conflicting operations'
      })
    }

    // Check Flow version compatibility
    const sourceVersion = this.parseVersion(sourceAction.compatibility.minimumFlowVersion)
    const targetVersion = this.parseVersion(targetAction.compatibility.minimumFlowVersion)
    const maxVersion = this.compareVersions(sourceVersion, targetVersion) >= 0 ? sourceVersion : targetVersion

    if (maxVersion.major > 1 || (maxVersion.major === 1 && maxVersion.minor > 0)) {
      issues.push({
        sourceActionId: sourceAction.id,
        targetActionId: targetAction.id,
        issue: `Requires Flow version ${maxVersion.major}.${maxVersion.minor}.${maxVersion.patch} or higher`,
        suggestion: 'Ensure your Flow environment meets the minimum version requirements'
      })
    }

    return issues
  }

  /**
   * Validate a string field
   */
  private static validateString(value: any, fieldName: string): string {
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`)
    }
    if (value.trim().length === 0) {
      throw new Error(`${fieldName} cannot be empty`)
    }
    return value.trim()
  }

  /**
   * Validate a number field
   */
  private static validateNumber(value: any, fieldName: string): number {
    const num = Number(value)
    if (isNaN(num)) {
      throw new Error(`${fieldName} must be a valid number`)
    }
    return num
  }

  /**
   * Parse version string into components
   */
  private static parseVersion(versionString: string): { major: number, minor: number, patch: number } {
    const parts = versionString.split('.').map(part => parseInt(part, 10))
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0
    }
  }

  /**
   * Compare two version objects
   */
  private static compareVersions(a: { major: number, minor: number, patch: number }, b: { major: number, minor: number, patch: number }): number {
    if (a.major !== b.major) return a.major - b.major
    if (a.minor !== b.minor) return a.minor - b.minor
    return a.patch - b.patch
  }
}