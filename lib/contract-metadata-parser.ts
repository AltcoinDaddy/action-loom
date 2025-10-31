import { 
  ActionMetadata, 
  ActionInput, 
  ActionOutput, 
  ActionParameter, 
  CompatibilityInfo, 
  SecurityLevel,
  Contract,
  ValidationResult,
  ValidationError,
  ValidationErrorType
} from './types'
import { logger } from './logging-service'

/**
 * Interface for contract ABI function definition
 */
export interface ContractFunction {
  name: string
  type: 'function' | 'constructor' | 'event'
  inputs: ContractParameter[]
  outputs: ContractParameter[]
  stateMutability: 'pure' | 'view' | 'nonpayable' | 'payable'
  visibility: 'public' | 'private' | 'internal' | 'external'
  documentation?: string
  annotations?: Record<string, any>
}

/**
 * Interface for contract parameter definition
 */
export interface ContractParameter {
  name: string
  type: string
  indexed?: boolean
  description?: string
  constraints?: ParameterConstraints
}

/**
 * Interface for parameter constraints
 */
export interface ParameterConstraints {
  min?: number
  max?: number
  pattern?: string
  enum?: string[]
  required?: boolean
}

/**
 * Interface for contract ABI
 */
export interface ContractABI {
  contractName: string
  contractAddress: string
  version: string
  functions: ContractFunction[]
  events: ContractEvent[]
  structs: ContractStruct[]
  resources: ContractResource[]
  interfaces: ContractInterface[]
  imports: ContractImport[]
  metadata?: ContractMetadata
}

/**
 * Interface for contract events
 */
export interface ContractEvent {
  name: string
  inputs: ContractParameter[]
  documentation?: string
}

/**
 * Interface for contract structs
 */
export interface ContractStruct {
  name: string
  fields: ContractParameter[]
  documentation?: string
}

/**
 * Interface for contract resources
 */
export interface ContractResource {
  name: string
  fields: ContractParameter[]
  functions: ContractFunction[]
  interfaces: string[]
  documentation?: string
}

/**
 * Interface for contract interfaces
 */
export interface ContractInterface {
  name: string
  functions: ContractFunction[]
  documentation?: string
}

/**
 * Interface for contract imports
 */
export interface ContractImport {
  name: string
  address: string
  alias?: string
}

/**
 * Interface for contract metadata
 */
export interface ContractMetadata {
  author?: string
  version?: string
  description?: string
  license?: string
  tags?: string[]
  category?: string
  securityAudit?: SecurityAuditInfo
  dependencies?: ContractDependency[]
}

/**
 * Interface for security audit information
 */
export interface SecurityAuditInfo {
  auditor: string
  auditDate: string
  status: 'passed' | 'failed' | 'pending'
  findings: SecurityFinding[]
  score: number
}

/**
 * Interface for security findings
 */
export interface SecurityFinding {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  recommendation: string
  line?: number
}

/**
 * Interface for contract dependencies
 */
export interface ContractDependency {
  contractAddress: string
  contractName: string
  requiredVersion?: string
  isOptional: boolean
  purpose: string
}

/**
 * Interface for Action generation options
 */
export interface ActionGenerationOptions {
  includePrivateFunctions: boolean
  includeViewFunctions: boolean
  includeEvents: boolean
  generateParameterValidation: boolean
  inferCategories: boolean
  estimateGas: boolean
  checkSecurity: boolean
  resolveTypes: boolean
}

/**
 * Interface for type resolution result
 */
export interface TypeResolutionResult {
  resolvedType: string
  isValid: boolean
  constraints?: ParameterConstraints
  description?: string
  examples?: any[]
}

/**
 * ContractMetadataParser - Parses smart contract ABIs and generates Action metadata
 */
export class ContractMetadataParser {
  private typeResolver: TypeResolver
  private categoryInferrer: CategoryInferrer
  private gasEstimator: GasEstimator
  private securityAnalyzer: SecurityAnalyzer
  private dependencyResolver: DependencyResolver

  constructor() {
    this.typeResolver = new TypeResolver()
    this.categoryInferrer = new CategoryInferrer()
    this.gasEstimator = new GasEstimator()
    this.securityAnalyzer = new SecurityAnalyzer()
    this.dependencyResolver = new DependencyResolver()
  }

  /**
   * Parse contract ABI and generate Action metadata
   */
  async parseContractABI(
    contractABI: ContractABI,
    options: Partial<ActionGenerationOptions> = {}
  ): Promise<ActionMetadata[]> {
    const correlationId = logger.generateCorrelationId()
    const timingId = logger.startTiming('parse-contract-abi', correlationId)

    const fullOptions: ActionGenerationOptions = {
      includePrivateFunctions: false,
      includeViewFunctions: true,
      includeEvents: false,
      generateParameterValidation: true,
      inferCategories: true,
      estimateGas: true,
      checkSecurity: true,
      resolveTypes: true,
      ...options
    }

    logger.info('Starting contract ABI parsing', {
      correlationId,
      component: 'contract-metadata-parser',
      operation: 'parse-contract-abi',
      metadata: {
        contractName: contractABI.contractName,
        contractAddress: contractABI.contractAddress,
        functionCount: contractABI.functions.length,
        options: fullOptions
      }
    })

    try {
      const actions: ActionMetadata[] = []

      // Parse functions into Actions
      for (const func of contractABI.functions) {
        if (!this.shouldIncludeFunction(func, fullOptions)) {
          continue
        }

        const action = await this.parseFunctionToAction(func, contractABI, fullOptions)
        if (action) {
          actions.push(action)
        }
      }

      // Parse events into Actions if requested
      if (fullOptions.includeEvents) {
        for (const event of contractABI.events) {
          const action = await this.parseEventToAction(event, contractABI, fullOptions)
          if (action) {
            actions.push(action)
          }
        }
      }

      logger.info('Contract ABI parsing completed', {
        correlationId,
        component: 'contract-metadata-parser',
        operation: 'parse-contract-abi',
        metadata: {
          contractName: contractABI.contractName,
          actionsGenerated: actions.length
        }
      })

      logger.endTiming(correlationId, 'parse-contract-abi', true)
      return actions

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.endTiming(correlationId, 'parse-contract-abi', false, errorMessage)
      logger.error('Contract ABI parsing failed', error as Error, {
        correlationId,
        component: 'contract-metadata-parser',
        operation: 'parse-contract-abi',
        metadata: {
          contractName: contractABI.contractName,
          contractAddress: contractABI.contractAddress
        }
      })
      throw error
    }
  }

  /**
   * Determine if a function should be included in Action generation
   */
  private shouldIncludeFunction(func: ContractFunction, options: ActionGenerationOptions): boolean {
    // Skip constructors
    if (func.type === 'constructor') {
      return false
    }

    // Check visibility
    if (func.visibility === 'private' && !options.includePrivateFunctions) {
      return false
    }

    // Check state mutability
    if ((func.stateMutability === 'view' || func.stateMutability === 'pure') && !options.includeViewFunctions) {
      return false
    }

    return true
  }

  /**
   * Parse a contract function into ActionMetadata
   */
  private async parseFunctionToAction(
    func: ContractFunction,
    contractABI: ContractABI,
    options: ActionGenerationOptions
  ): Promise<ActionMetadata | null> {
    try {
      const actionId = `${contractABI.contractAddress}:${contractABI.contractName}:${func.name}`
      
      // Generate basic metadata
      const name = this.generateActionName(func, contractABI)
      const description = this.generateActionDescription(func, contractABI)
      const category = options.inferCategories 
        ? this.categoryInferrer.inferCategory(func, contractABI)
        : 'utility'

      // Parse inputs
      const inputs: ActionInput[] = []
      const parameters: ActionParameter[] = []

      for (const input of func.inputs) {
        const resolvedType = options.resolveTypes 
          ? await this.typeResolver.resolveType(input.type, contractABI)
          : { resolvedType: input.type, isValid: true }

        if (!resolvedType.isValid) {
          logger.warn('Invalid input type detected', {
            component: 'contract-metadata-parser',
            operation: 'parse-function-to-action',
            metadata: {
              functionName: func.name,
              inputName: input.name,
              inputType: input.type
            }
          })
          continue
        }

        const actionInput: ActionInput = {
          name: input.name,
          type: resolvedType.resolvedType,
          required: input.constraints?.required !== false,
          description: input.description || `${input.name} parameter`
        }

        const actionParameter: ActionParameter = {
          name: input.name,
          type: resolvedType.resolvedType,
          value: '',
          required: actionInput.required,
          description: actionInput.description
        }

        inputs.push(actionInput)
        parameters.push(actionParameter)
      }

      // Parse outputs
      const outputs: ActionOutput[] = func.outputs.map(output => {
        const resolvedType = options.resolveTypes 
          ? this.typeResolver.resolveTypeSync(output.type, contractABI)
          : { resolvedType: output.type, isValid: true }

        return {
          name: output.name || 'result',
          type: resolvedType.resolvedType,
          description: output.description || 'Function return value'
        }
      })

      // Generate compatibility info
      const compatibility = await this.generateCompatibilityInfo(func, contractABI, options)

      // Estimate gas
      const gasEstimate = options.estimateGas 
        ? this.gasEstimator.estimateGas(func, contractABI)
        : 100

      // Assess security level
      const securityLevel = options.checkSecurity 
        ? this.securityAnalyzer.assessSecurityLevel(func, contractABI)
        : SecurityLevel.MEDIUM

      const actionMetadata: ActionMetadata = {
        id: actionId,
        name,
        description,
        category,
        version: contractABI.version || '1.0.0',
        inputs,
        outputs,
        parameters,
        compatibility,
        gasEstimate,
        securityLevel,
        author: contractABI.metadata?.author || 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      return actionMetadata

    } catch (error) {
      logger.error('Failed to parse function to Action', error as Error, {
        component: 'contract-metadata-parser',
        operation: 'parse-function-to-action',
        metadata: {
          functionName: func.name,
          contractName: contractABI.contractName
        }
      })
      return null
    }
  }

  /**
   * Parse a contract event into ActionMetadata
   */
  private async parseEventToAction(
    event: ContractEvent,
    contractABI: ContractABI,
    options: ActionGenerationOptions
  ): Promise<ActionMetadata | null> {
    try {
      const actionId = `${contractABI.contractAddress}:${contractABI.contractName}:event:${event.name}`
      
      const name = `Listen to ${event.name} Event`
      const description = event.documentation || `Listen for ${event.name} events from ${contractABI.contractName}`
      const category = 'event'

      // Parse event inputs as Action outputs (since events emit data)
      const outputs: ActionOutput[] = event.inputs.map(input => ({
        name: input.name,
        type: input.type,
        description: input.description || `${input.name} from ${event.name} event`
      }))

      // Events typically don't have inputs (they're listeners)
      const inputs: ActionInput[] = []
      const parameters: ActionParameter[] = []

      const compatibility: CompatibilityInfo = {
        requiredCapabilities: ['event_listening'],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      }

      const actionMetadata: ActionMetadata = {
        id: actionId,
        name,
        description,
        category,
        version: contractABI.version || '1.0.0',
        inputs,
        outputs,
        parameters,
        compatibility,
        gasEstimate: 0, // Events don't consume gas to listen
        securityLevel: SecurityLevel.LOW,
        author: contractABI.metadata?.author || 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      return actionMetadata

    } catch (error) {
      logger.error('Failed to parse event to Action', error as Error, {
        component: 'contract-metadata-parser',
        operation: 'parse-event-to-action',
        metadata: {
          eventName: event.name,
          contractName: contractABI.contractName
        }
      })
      return null
    }
  }

  /**
   * Generate Action name from function
   */
  private generateActionName(func: ContractFunction, contractABI: ContractABI): string {
    // Use function documentation if available
    if (func.documentation) {
      const match = func.documentation.match(/@title\s+(.+)/i)
      if (match) {
        return match[1].trim()
      }
    }

    // Generate from function name
    const functionName = func.name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim()

    return `${functionName} (${contractABI.contractName})`
  }

  /**
   * Generate Action description from function
   */
  private generateActionDescription(func: ContractFunction, contractABI: ContractABI): string {
    // Use function documentation if available
    if (func.documentation) {
      const match = func.documentation.match(/@dev\s+(.+)/i)
      if (match) {
        return match[1].trim()
      }
      
      // Use the first line of documentation
      const firstLine = func.documentation.split('\n')[0].trim()
      if (firstLine && !firstLine.startsWith('@')) {
        return firstLine
      }
    }

    // Generate basic description
    const action = func.stateMutability === 'view' ? 'Query' : 'Execute'
    return `${action} ${func.name} function from ${contractABI.contractName} contract`
  }

  /**
   * Generate compatibility information
   */
  private async generateCompatibilityInfo(
    func: ContractFunction,
    contractABI: ContractABI,
    options: ActionGenerationOptions
  ): Promise<CompatibilityInfo> {
    const requiredCapabilities: string[] = []

    // Add capabilities based on function characteristics
    if (func.stateMutability === 'payable') {
      requiredCapabilities.push('token_transfer')
    }

    if (func.visibility === 'external') {
      requiredCapabilities.push('external_call')
    }

    // Check for storage operations
    if (func.stateMutability === 'nonpayable') {
      requiredCapabilities.push('storage_write')
    }

    // Resolve dependencies
    const dependencies = await this.dependencyResolver.resolveDependencies(contractABI)
    const conflictsWith = dependencies
      .filter(dep => !dep.isOptional)
      .map(dep => dep.contractName)

    return {
      requiredCapabilities,
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith
    }
  }

  /**
   * Validate generated Action metadata
   */
  validateActionMetadata(action: ActionMetadata): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Validate required fields
    if (!action.id) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED,
        message: 'Action ID is required',
        field: 'id',
        severity: 'error'
      })
    }

    if (!action.name) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED,
        message: 'Action name is required',
        field: 'name',
        severity: 'error'
      })
    }

    if (!action.category) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED,
        message: 'Action category is required',
        field: 'category',
        severity: 'error'
      })
    }

    // Validate parameters
    for (const param of action.parameters) {
      if (!param.name) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED,
          message: 'Parameter name is required',
          field: `parameters.${param.name}.name`,
          severity: 'error'
        })
      }

      if (!param.type) {
        errors.push({
          type: ValidationErrorType.MISSING_REQUIRED,
          message: 'Parameter type is required',
          field: `parameters.${param.name}.type`,
          severity: 'error'
        })
      }

      // Validate type format
      if (param.type && !this.typeResolver.isValidType(param.type)) {
        errors.push({
          type: ValidationErrorType.INVALID_TYPE,
          message: `Invalid parameter type: ${param.type}`,
          field: `parameters.${param.name}.type`,
          severity: 'error'
        })
      }
    }

    // Validate inputs/outputs consistency
    if (action.inputs.length !== action.parameters.length) {
      warnings.push('Input count does not match parameter count')
    }

    // Validate gas estimate
    if (action.gasEstimate < 0) {
      errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: 'Gas estimate cannot be negative',
        field: 'gasEstimate',
        severity: 'error'
      })
    }

    if (action.gasEstimate > 10000) {
      warnings.push('High gas estimate detected - consider optimization')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Check compatibility between two Actions
   */
  checkActionCompatibility(sourceAction: ActionMetadata, targetAction: ActionMetadata): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Check network compatibility
    const sourceNetworks = new Set(sourceAction.compatibility.supportedNetworks)
    const targetNetworks = new Set(targetAction.compatibility.supportedNetworks)
    const commonNetworks = [...sourceNetworks].filter(network => targetNetworks.has(network))

    if (commonNetworks.length === 0) {
      errors.push({
        type: ValidationErrorType.TYPE_MISMATCH,
        message: 'Actions have no common supported networks',
        severity: 'error'
      })
    }

    // Check capability conflicts
    const sourceCapabilities = new Set(sourceAction.compatibility.requiredCapabilities)
    const targetConflicts = new Set(targetAction.compatibility.conflictsWith)

    for (const capability of sourceCapabilities) {
      if (targetConflicts.has(capability)) {
        errors.push({
          type: ValidationErrorType.TYPE_MISMATCH,
          message: `Capability conflict: ${capability}`,
          severity: 'error'
        })
      }
    }

    // Check output-input type compatibility
    for (const output of sourceAction.outputs) {
      for (const input of targetAction.inputs) {
        if (output.name === input.name && output.type !== input.type) {
          warnings.push(`Type mismatch between ${sourceAction.name}.${output.name} (${output.type}) and ${targetAction.name}.${input.name} (${input.type})`)
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Resolve contract dependencies
   */
  async resolveContractDependencies(contractABI: ContractABI): Promise<ContractDependency[]> {
    return await this.dependencyResolver.resolveDependencies(contractABI)
  }

  /**
   * Get parser statistics
   */
  getStats(): {
    typeResolver: any
    categoryInferrer: any
    gasEstimator: any
    securityAnalyzer: any
  } {
    return {
      typeResolver: this.typeResolver.getStats(),
      categoryInferrer: this.categoryInferrer.getStats(),
      gasEstimator: this.gasEstimator.getStats(),
      securityAnalyzer: this.securityAnalyzer.getStats()
    }
  }
}

/**
 * TypeResolver - Resolves and validates Cadence types
 */
class TypeResolver {
  private typeCache: Map<string, TypeResolutionResult> = new Map()
  private resolutionCount: number = 0

  async resolveType(type: string, contractABI: ContractABI): Promise<TypeResolutionResult> {
    this.resolutionCount++

    // Check cache first
    const cacheKey = `${contractABI.contractAddress}:${type}`
    if (this.typeCache.has(cacheKey)) {
      return this.typeCache.get(cacheKey)!
    }

    const result = this.resolveTypeSync(type, contractABI)
    this.typeCache.set(cacheKey, result)
    return result
  }

  resolveTypeSync(type: string, contractABI: ContractABI): TypeResolutionResult {
    // Handle basic Cadence types
    const basicTypes = [
      'String', 'Bool', 'Int', 'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'UInt256',
      'Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256',
      'Fix64', 'UFix64', 'Address', 'Path', 'Capability'
    ]

    if (basicTypes.includes(type)) {
      return {
        resolvedType: type,
        isValid: true,
        description: `Cadence ${type} type`
      }
    }

    // Handle array types
    if (type.startsWith('[') && type.endsWith(']')) {
      const innerType = type.slice(1, -1)
      const innerResult = this.resolveTypeSync(innerType, contractABI)
      return {
        resolvedType: `[${innerResult.resolvedType}]`,
        isValid: innerResult.isValid,
        description: `Array of ${innerResult.description || innerType}`
      }
    }

    // Handle optional types
    if (type.endsWith('?')) {
      const innerType = type.slice(0, -1)
      const innerResult = this.resolveTypeSync(innerType, contractABI)
      return {
        resolvedType: `${innerResult.resolvedType}?`,
        isValid: innerResult.isValid,
        description: `Optional ${innerResult.description || innerType}`
      }
    }

    // Handle dictionary types
    if (type.startsWith('{') && type.endsWith('}')) {
      const dictContent = type.slice(1, -1)
      const colonIndex = dictContent.indexOf(':')
      if (colonIndex > 0) {
        const keyType = dictContent.slice(0, colonIndex).trim()
        const valueType = dictContent.slice(colonIndex + 1).trim()
        const keyResult = this.resolveTypeSync(keyType, contractABI)
        const valueResult = this.resolveTypeSync(valueType, contractABI)
        
        return {
          resolvedType: `{${keyResult.resolvedType}: ${valueResult.resolvedType}}`,
          isValid: keyResult.isValid && valueResult.isValid,
          description: `Dictionary mapping ${keyType} to ${valueType}`
        }
      }
    }

    // Handle custom types (structs, resources, interfaces)
    const customType = this.resolveCustomType(type, contractABI)
    if (customType) {
      return customType
    }

    // Unknown type
    return {
      resolvedType: type,
      isValid: false,
      description: `Unknown type: ${type}`
    }
  }

  private resolveCustomType(type: string, contractABI: ContractABI): TypeResolutionResult | null {
    // Check structs
    const struct = contractABI.structs.find(s => s.name === type)
    if (struct) {
      return {
        resolvedType: type,
        isValid: true,
        description: struct.documentation || `Struct ${type}`
      }
    }

    // Check resources
    const resource = contractABI.resources.find(r => r.name === type)
    if (resource) {
      return {
        resolvedType: type,
        isValid: true,
        description: resource.documentation || `Resource ${type}`
      }
    }

    // Check interfaces
    const iface = contractABI.interfaces.find(i => i.name === type)
    if (iface) {
      return {
        resolvedType: type,
        isValid: true,
        description: iface.documentation || `Interface ${type}`
      }
    }

    return null
  }

  isValidType(type: string): boolean {
    // This is a simplified validation - in practice, you'd want more comprehensive checking
    return type.length > 0 && !type.includes(' ') && /^[A-Za-z0-9\[\]{}?:_]+$/.test(type)
  }

  getStats() {
    return {
      cacheSize: this.typeCache.size,
      resolutionCount: this.resolutionCount
    }
  }

  clearCache(): void {
    this.typeCache.clear()
  }
}

/**
 * CategoryInferrer - Infers Action categories from contract functions
 */
class CategoryInferrer {
  private categoryCount: Map<string, number> = new Map()

  inferCategory(func: ContractFunction, contractABI: ContractABI): string {
    const functionName = func.name.toLowerCase()
    const contractName = contractABI.contractName.toLowerCase()

    // Check explicit category in metadata
    if (contractABI.metadata?.category) {
      this.incrementCategoryCount(contractABI.metadata.category)
      return contractABI.metadata.category
    }

    // Token-related patterns
    if (this.matchesPatterns(functionName, ['transfer', 'mint', 'burn', 'approve', 'allowance']) ||
        this.matchesPatterns(contractName, ['token', 'ft', 'fungibletoken'])) {
      this.incrementCategoryCount('token')
      return 'token'
    }

    // NFT-related patterns
    if (this.matchesPatterns(functionName, ['mint', 'burn', 'transfer', 'approve', 'setapprovalforall']) ||
        this.matchesPatterns(contractName, ['nft', 'collectible', 'nonfungibletoken'])) {
      this.incrementCategoryCount('nft')
      return 'nft'
    }

    // DeFi-related patterns
    if (this.matchesPatterns(functionName, ['swap', 'stake', 'unstake', 'lend', 'borrow', 'deposit', 'withdraw']) ||
        this.matchesPatterns(contractName, ['defi', 'swap', 'pool', 'vault', 'lending'])) {
      this.incrementCategoryCount('defi')
      return 'defi'
    }

    // Governance-related patterns
    if (this.matchesPatterns(functionName, ['vote', 'propose', 'execute', 'delegate']) ||
        this.matchesPatterns(contractName, ['governance', 'dao', 'voting'])) {
      this.incrementCategoryCount('governance')
      return 'governance'
    }

    // Gaming-related patterns
    if (this.matchesPatterns(functionName, ['play', 'battle', 'craft', 'upgrade']) ||
        this.matchesPatterns(contractName, ['game', 'gaming', 'rpg'])) {
      this.incrementCategoryCount('gaming')
      return 'gaming'
    }

    // Default category
    this.incrementCategoryCount('utility')
    return 'utility'
  }

  private matchesPatterns(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern))
  }

  private incrementCategoryCount(category: string): void {
    const current = this.categoryCount.get(category) || 0
    this.categoryCount.set(category, current + 1)
  }

  getStats() {
    return {
      categoryDistribution: Object.fromEntries(this.categoryCount)
    }
  }
}

/**
 * GasEstimator - Estimates gas usage for contract functions
 */
class GasEstimator {
  private estimationCount: number = 0

  estimateGas(func: ContractFunction, contractABI: ContractABI): number {
    this.estimationCount++

    let gasEstimate = 100 // Base gas cost

    // Add cost based on function complexity
    gasEstimate += func.inputs.length * 25 // Parameter processing cost
    gasEstimate += func.outputs.length * 15 // Return value cost

    // Add cost based on state mutability
    switch (func.stateMutability) {
      case 'pure':
        gasEstimate += 0 // No state access
        break
      case 'view':
        gasEstimate += 50 // Read-only state access
        break
      case 'nonpayable':
        gasEstimate += 200 // State modification
        break
      case 'payable':
        gasEstimate += 300 // State modification + token transfer
        break
    }

    // Add cost based on visibility
    if (func.visibility === 'external') {
      gasEstimate += 100 // External call overhead
    }

    // Add cost for complex types
    for (const input of func.inputs) {
      if (input.type.includes('[') || input.type.includes('{')) {
        gasEstimate += 50 // Complex type processing
      }
    }

    return gasEstimate
  }

  getStats() {
    return {
      estimationCount: this.estimationCount
    }
  }
}

/**
 * SecurityAnalyzer - Analyzes security risks in contract functions
 */
class SecurityAnalyzer {
  private analysisCount: number = 0

  assessSecurityLevel(func: ContractFunction, contractABI: ContractABI): SecurityLevel {
    this.analysisCount++

    let riskScore = 0

    // Check for high-risk operations
    if (func.stateMutability === 'payable') {
      riskScore += 3 // Token transfers are high risk
    }

    if (func.visibility === 'external') {
      riskScore += 2 // External functions are more risky
    }

    if (func.name.toLowerCase().includes('admin') || 
        func.name.toLowerCase().includes('owner') ||
        func.name.toLowerCase().includes('destroy')) {
      riskScore += 4 // Admin functions are very risky
    }

    // Check for dangerous patterns in function name
    const dangerousPatterns = ['selfdestruct', 'delegatecall', 'suicide', 'kill']
    if (dangerousPatterns.some(pattern => func.name.toLowerCase().includes(pattern))) {
      riskScore += 5
    }

    // Check contract security audit
    if (contractABI.metadata?.securityAudit?.status !== 'passed') {
      riskScore += 2
    }

    // Determine security level based on risk score
    if (riskScore >= 7) return SecurityLevel.CRITICAL
    if (riskScore >= 5) return SecurityLevel.HIGH
    if (riskScore >= 3) return SecurityLevel.MEDIUM
    return SecurityLevel.LOW
  }

  getStats() {
    return {
      analysisCount: this.analysisCount
    }
  }
}

/**
 * DependencyResolver - Resolves contract dependencies
 */
class DependencyResolver {
  private resolutionCount: number = 0

  async resolveDependencies(contractABI: ContractABI): Promise<ContractDependency[]> {
    this.resolutionCount++

    const dependencies: ContractDependency[] = []

    // Process imports
    for (const importItem of contractABI.imports) {
      const dependency: ContractDependency = {
        contractAddress: importItem.address,
        contractName: importItem.name,
        isOptional: false,
        purpose: 'Import dependency'
      }
      dependencies.push(dependency)
    }

    // Add explicit dependencies from metadata
    if (contractABI.metadata?.dependencies) {
      dependencies.push(...contractABI.metadata.dependencies)
    }

    return dependencies
  }

  getStats() {
    return {
      resolutionCount: this.resolutionCount
    }
  }
}

/**
 * Create ContractMetadataParser with default configuration
 */
export function createContractMetadataParser(): ContractMetadataParser {
  return new ContractMetadataParser()
}

/**
 * Default parser instance (lazy-loaded)
 */
let _defaultParser: ContractMetadataParser | null = null
export const getDefaultContractMetadataParser = (): ContractMetadataParser => {
  if (!_defaultParser) {
    _defaultParser = new ContractMetadataParser()
  }
  return _defaultParser
}