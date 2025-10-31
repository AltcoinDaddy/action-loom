import { ActionDiscoveryService, getDefaultActionDiscoveryService } from './action-discovery-service'
import { SemanticSearchEngine, SearchResult } from './semantic-search-engine'
import { 
  ActionMetadata, 
  ParsedStep, 
  Entity, 
  IntentClassification, 
  WorkflowIntent,
  ValidationResult,
  ValidationError,
  ActionParameter
} from './types'
import { normalizeTokenName, parseAmount, validateAddress } from './nlp-utils'

/**
 * Service for mapping parsed NLP intents to discovered Actions and validating parameters
 */
export class ActionMappingService {
  private discoveryService: ActionDiscoveryService

  constructor(discoveryService?: ActionDiscoveryService) {
    this.discoveryService = discoveryService || getDefaultActionDiscoveryService()
  }

  /**
   * Map parsed intents to discovered Actions using semantic matching
   */
  async mapIntentToActions(
    intent: IntentClassification,
    entities: Entity[],
    maxResults: number = 5
  ): Promise<ActionMappingResult[]> {
    try {
      // Build search query from intent and entities
      const searchQuery = this.buildSearchQuery(intent, entities)
      
      // Search for matching Actions
      const searchResults = await this.discoveryService.searchActions(searchQuery, {
        limit: maxResults * 2, // Get more results to filter
        includeMetadata: true
      })

      // Score and rank Actions based on intent matching
      const mappingResults = await this.scoreActionMatches(intent, entities, searchResults)

      // Sort by score and return top results
      return mappingResults
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, maxResults)

    } catch (error) {
      console.error('Error mapping intent to actions:', error)
      throw new ActionMappingError(
        'Failed to map intent to actions',
        'MAPPING_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Validate extracted parameters against Action schemas
   */
  async validateActionParameters(
    action: ActionMetadata,
    extractedParams: Record<string, any>
  ): Promise<ParameterValidationResult> {
    const result: ParameterValidationResult = {
      isValid: true,
      validatedParams: {},
      errors: [],
      warnings: [],
      missingRequired: [],
      typeConversions: []
    }

    try {
      // Check required parameters
      const requiredParams = action.inputs.filter(input => input.required)
      for (const requiredParam of requiredParams) {
        if (!(requiredParam.name in extractedParams)) {
          result.missingRequired.push(requiredParam.name)
          result.errors.push({
            type: 'missing_required',
            message: `Required parameter '${requiredParam.name}' is missing`,
            field: requiredParam.name,
            severity: 'error'
          })
          result.isValid = false
        }
      }

      // Validate and convert each parameter
      for (const [paramName, paramValue] of Object.entries(extractedParams)) {
        const paramSchema = action.inputs.find(input => input.name === paramName)
        
        if (!paramSchema) {
          // Parameter not defined in schema - add warning but allow it
          result.warnings.push(`Parameter '${paramName}' is not defined in Action schema`)
          result.validatedParams[paramName] = paramValue
          continue
        }

        // Validate and convert parameter
        const validation = await this.validateParameter(paramSchema, paramValue)
        
        if (validation.isValid) {
          result.validatedParams[paramName] = validation.convertedValue
          if (validation.wasConverted) {
            result.typeConversions.push({
              parameter: paramName,
              originalValue: paramValue,
              convertedValue: validation.convertedValue,
              originalType: typeof paramValue,
              targetType: paramSchema.type
            })
          }
        } else {
          result.errors.push(...validation.errors)
          result.isValid = false
        }

        result.warnings.push(...validation.warnings)
      }

      // Validate parameter combinations and business rules
      const businessValidation = this.validateBusinessRules(action, result.validatedParams)
      result.errors.push(...businessValidation.errors)
      result.warnings.push(...businessValidation.warnings)
      
      if (businessValidation.errors.length > 0) {
        result.isValid = false
      }

    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: 'validation_error',
        message: `Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })
    }

    return result
  }

  /**
   * Convert and validate a single parameter
   */
  private async validateParameter(
    paramSchema: ActionInput,
    value: any
  ): Promise<SingleParameterValidation> {
    const result: SingleParameterValidation = {
      isValid: true,
      convertedValue: value,
      wasConverted: false,
      errors: [],
      warnings: []
    }

    try {
      // Handle different parameter types
      switch (paramSchema.type.toLowerCase()) {
        case 'string':
          result.convertedValue = String(value)
          result.wasConverted = typeof value !== 'string'
          break

        case 'number':
        case 'uint64':
        case 'int':
        case 'float':
          const numResult = this.convertToNumber(value, paramSchema.type)
          result.convertedValue = numResult.value
          result.wasConverted = numResult.wasConverted
          if (!numResult.isValid) {
            result.isValid = false
            result.errors.push({
              type: 'type_conversion',
              message: `Cannot convert '${value}' to ${paramSchema.type}`,
              field: paramSchema.name,
              severity: 'error'
            })
          }
          break

        case 'bool':
        case 'boolean':
          const boolResult = this.convertToBoolean(value)
          result.convertedValue = boolResult.value
          result.wasConverted = boolResult.wasConverted
          if (!boolResult.isValid) {
            result.isValid = false
            result.errors.push({
              type: 'type_conversion',
              message: `Cannot convert '${value}' to boolean`,
              field: paramSchema.name,
              severity: 'error'
            })
          }
          break

        case 'address':
          const addressResult = this.validateAndNormalizeAddress(value)
          result.convertedValue = addressResult.normalized || value
          result.wasConverted = addressResult.normalized !== value
          if (!addressResult.isValid) {
            result.isValid = false
            result.errors.push({
              type: 'invalid_address',
              message: `Invalid address format: '${value}'`,
              field: paramSchema.name,
              severity: 'error'
            })
          }
          break

        case 'token':
          result.convertedValue = normalizeTokenName(String(value))
          result.wasConverted = result.convertedValue !== value
          break

        default:
          // For unknown types, keep as string but add warning
          result.convertedValue = String(value)
          result.wasConverted = typeof value !== 'string'
          result.warnings.push(`Unknown parameter type '${paramSchema.type}', treating as string`)
      }

      // Apply validation rules if defined
      if (paramSchema.validation && result.isValid) {
        const ruleValidation = this.applyValidationRules(
          paramSchema.validation,
          result.convertedValue,
          paramSchema.name
        )
        
        if (!ruleValidation.isValid) {
          result.isValid = false
          result.errors.push(...ruleValidation.errors)
        }
        result.warnings.push(...ruleValidation.warnings)
      }

    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: 'validation_error',
        message: `Parameter validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        field: paramSchema.name,
        severity: 'error'
      })
    }

    return result
  }

  /**
   * Build search query from intent and entities
   */
  private buildSearchQuery(intent: IntentClassification, entities: Entity[]): string {
    const queryParts: string[] = []

    // Add intent as primary search term
    if (intent.intent !== WorkflowIntent.CUSTOM) {
      queryParts.push(intent.intent)
    }

    // Add action entities
    const actionEntities = entities.filter(e => e.type === 'action')
    actionEntities.forEach(entity => {
      if (!queryParts.includes(entity.value)) {
        queryParts.push(entity.value)
      }
    })

    // Add token entities for context
    const tokenEntities = entities.filter(e => e.type === 'token')
    if (tokenEntities.length > 0) {
      queryParts.push(...tokenEntities.map(e => e.value))
    }

    return queryParts.join(' ')
  }

  /**
   * Score Action matches based on intent and entities
   */
  private async scoreActionMatches(
    intent: IntentClassification,
    entities: Entity[],
    searchResults: SearchResult[]
  ): Promise<ActionMappingResult[]> {
    const results: ActionMappingResult[] = []

    for (const searchResult of searchResults) {
      const action = searchResult.action
      let score = searchResult.score || 0

      // Boost score for exact intent matches
      if (intent.intent !== WorkflowIntent.CUSTOM) {
        const intentKeywords = this.getIntentKeywords(intent.intent)
        const actionNameLower = action.name.toLowerCase()
        const actionDescLower = action.description.toLowerCase()
        
        for (const keyword of intentKeywords) {
          if (actionNameLower.includes(keyword) || actionDescLower.includes(keyword)) {
            score += 0.3
          }
        }
      }

      // Boost score for parameter compatibility
      const paramCompatibility = this.calculateParameterCompatibility(action, entities)
      score += paramCompatibility * 0.2

      // Boost score for category relevance
      const categoryScore = this.calculateCategoryRelevance(action.category, intent.intent)
      score += categoryScore * 0.1

      // Penalize for missing required parameters
      const missingRequiredCount = this.countMissingRequiredParams(action, entities)
      score -= missingRequiredCount * 0.1

      results.push({
        action,
        matchScore: Math.max(0, Math.min(1, score)),
        reasons: this.generateMatchReasons(action, intent, entities, searchResult),
        parameterMapping: this.generateParameterMapping(action, entities),
        confidence: intent.confidence * score
      })
    }

    return results
  }

  /**
   * Get keywords associated with an intent
   */
  private getIntentKeywords(intent: WorkflowIntent): string[] {
    const keywordMap: Record<WorkflowIntent, string[]> = {
      [WorkflowIntent.SWAP]: ['swap', 'exchange', 'trade', 'convert'],
      [WorkflowIntent.STAKE]: ['stake', 'delegate', 'lock', 'deposit'],
      [WorkflowIntent.UNSTAKE]: ['unstake', 'undelegate', 'unlock', 'withdraw'],
      [WorkflowIntent.MINT]: ['mint', 'create', 'generate', 'issue'],
      [WorkflowIntent.TRANSFER]: ['transfer', 'send', 'move', 'pay'],
      [WorkflowIntent.BRIDGE]: ['bridge', 'cross-chain', 'move'],
      [WorkflowIntent.LEND]: ['lend', 'supply', 'provide'],
      [WorkflowIntent.BORROW]: ['borrow', 'loan', 'take'],
      [WorkflowIntent.COMPOUND]: ['compound', 'reinvest', 'auto'],
      [WorkflowIntent.CUSTOM]: []
    }

    return keywordMap[intent] || []
  }

  /**
   * Calculate parameter compatibility score
   */
  private calculateParameterCompatibility(action: ActionMetadata, entities: Entity[]): number {
    const entityTypes = new Set(entities.map(e => e.type))
    const requiredInputTypes = new Set(action.inputs.filter(i => i.required).map(i => i.type.toLowerCase()))
    
    let compatibleCount = 0
    let totalRequired = requiredInputTypes.size

    // Check if we have entities that match required input types
    for (const requiredType of requiredInputTypes) {
      if (entityTypes.has(requiredType as any) || 
          (requiredType === 'number' && entityTypes.has('amount')) ||
          (requiredType === 'string' && entityTypes.has('token'))) {
        compatibleCount++
      }
    }

    return totalRequired > 0 ? compatibleCount / totalRequired : 1
  }

  /**
   * Calculate category relevance score
   */
  private calculateCategoryRelevance(category: string, intent: WorkflowIntent): number {
    const categoryIntentMap: Record<string, WorkflowIntent[]> = {
      'defi': [WorkflowIntent.SWAP, WorkflowIntent.LEND, WorkflowIntent.BORROW],
      'staking': [WorkflowIntent.STAKE, WorkflowIntent.UNSTAKE],
      'nft': [WorkflowIntent.MINT, WorkflowIntent.TRANSFER],
      'bridge': [WorkflowIntent.BRIDGE],
      'token': [WorkflowIntent.TRANSFER, WorkflowIntent.MINT]
    }

    const relevantIntents = categoryIntentMap[category.toLowerCase()] || []
    return relevantIntents.includes(intent) ? 1 : 0
  }

  /**
   * Count missing required parameters
   */
  private countMissingRequiredParams(action: ActionMetadata, entities: Entity[]): number {
    const entityTypes = new Set(entities.map(e => e.type))
    const requiredParams = action.inputs.filter(i => i.required)
    
    let missingCount = 0
    for (const param of requiredParams) {
      const paramType = param.type.toLowerCase()
      if (!entityTypes.has(paramType as any) && 
          !(paramType === 'number' && entityTypes.has('amount')) &&
          !(paramType === 'string' && entityTypes.has('token'))) {
        missingCount++
      }
    }

    return missingCount
  }

  /**
   * Generate match reasons for debugging
   */
  private generateMatchReasons(
    action: ActionMetadata,
    intent: IntentClassification,
    entities: Entity[],
    searchResult: SearchResult
  ): string[] {
    const reasons: string[] = []

    if (searchResult.score && searchResult.score > 0.7) {
      reasons.push('High semantic similarity')
    }

    const intentKeywords = this.getIntentKeywords(intent.intent)
    const actionText = `${action.name} ${action.description}`.toLowerCase()
    
    for (const keyword of intentKeywords) {
      if (actionText.includes(keyword)) {
        reasons.push(`Matches intent keyword: ${keyword}`)
      }
    }

    const compatibilityScore = this.calculateParameterCompatibility(action, entities)
    if (compatibilityScore > 0.8) {
      reasons.push('High parameter compatibility')
    }

    return reasons
  }

  /**
   * Generate parameter mapping suggestions
   */
  private generateParameterMapping(action: ActionMetadata, entities: Entity[]): Record<string, string> {
    const mapping: Record<string, string> = {}

    // Map entities to action parameters
    for (const input of action.inputs) {
      const inputType = input.type.toLowerCase()
      
      // Find matching entity
      let matchingEntity: Entity | undefined

      if (inputType === 'number' || inputType === 'uint64' || inputType === 'int') {
        matchingEntity = entities.find(e => e.type === 'amount')
      } else if (inputType === 'string' || inputType === 'token') {
        matchingEntity = entities.find(e => e.type === 'token')
      } else if (inputType === 'address') {
        matchingEntity = entities.find(e => e.type === 'address')
      } else {
        matchingEntity = entities.find(e => e.type === inputType as any)
      }

      if (matchingEntity) {
        mapping[input.name] = matchingEntity.value
      }
    }

    return mapping
  }

  /**
   * Convert value to number with validation
   */
  private convertToNumber(value: any, targetType: string): NumberConversionResult {
    if (typeof value === 'number') {
      return { value, isValid: true, wasConverted: false }
    }

    if (typeof value === 'string') {
      const parsed = parseAmount(value)
      if (parsed.isValid) {
        // Additional validation based on target type
        if (targetType === 'uint64' && parsed.value < 0) {
          return { value: 0, isValid: false, wasConverted: true }
        }
        return { value: parsed.value, isValid: true, wasConverted: true }
      }
    }

    return { value: 0, isValid: false, wasConverted: true }
  }

  /**
   * Convert value to boolean with validation
   */
  private convertToBoolean(value: any): BooleanConversionResult {
    if (typeof value === 'boolean') {
      return { value, isValid: true, wasConverted: false }
    }

    if (typeof value === 'string') {
      const lower = value.toLowerCase()
      if (['true', 'yes', '1', 'on', 'enabled'].includes(lower)) {
        return { value: true, isValid: true, wasConverted: true }
      }
      if (['false', 'no', '0', 'off', 'disabled'].includes(lower)) {
        return { value: false, isValid: true, wasConverted: true }
      }
    }

    if (typeof value === 'number') {
      return { value: value !== 0, isValid: true, wasConverted: true }
    }

    return { value: false, isValid: false, wasConverted: true }
  }

  /**
   * Validate and normalize address
   */
  private validateAndNormalizeAddress(value: any): AddressValidationResult {
    if (typeof value !== 'string') {
      return { isValid: false }
    }

    const validation = validateAddress(value)
    return {
      isValid: validation.isValid,
      normalized: validation.normalized,
      type: validation.type
    }
  }

  /**
   * Apply validation rules to a parameter value
   */
  private applyValidationRules(
    rules: ValidationRule[],
    value: any,
    paramName: string
  ): RuleValidationResult {
    const result: RuleValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    for (const rule of rules) {
      switch (rule.type) {
        case 'range':
          if (typeof value === 'number' && rule.value) {
            const { min, max } = rule.value
            if ((min !== undefined && value < min) || (max !== undefined && value > max)) {
              result.isValid = false
              result.errors.push({
                type: 'range_validation',
                message: rule.message || `Value ${value} is outside allowed range [${min}, ${max}]`,
                field: paramName,
                severity: 'error'
              })
            }
          }
          break

        case 'pattern':
          if (typeof value === 'string' && rule.value instanceof RegExp) {
            if (!rule.value.test(value)) {
              result.isValid = false
              result.errors.push({
                type: 'pattern_validation',
                message: rule.message || `Value '${value}' does not match required pattern`,
                field: paramName,
                severity: 'error'
              })
            }
          }
          break

        case 'custom':
          // Custom validation would be implemented based on specific requirements
          result.warnings.push(`Custom validation rule not implemented for parameter '${paramName}'`)
          break
      }
    }

    return result
  }

  /**
   * Validate business rules and parameter combinations
   */
  private validateBusinessRules(
    action: ActionMetadata,
    params: Record<string, any>
  ): BusinessRuleValidationResult {
    const result: BusinessRuleValidationResult = {
      errors: [],
      warnings: []
    }

    // Example business rules - these would be expanded based on specific Action requirements
    
    // For swap actions, ensure fromToken != toToken
    if (action.name.toLowerCase().includes('swap')) {
      if (params.fromToken && params.toToken && params.fromToken === params.toToken) {
        result.errors.push({
          type: 'business_rule',
          message: 'Cannot swap a token to itself',
          severity: 'error'
        })
      }
    }

    // For transfer actions, ensure amount > 0
    if (action.name.toLowerCase().includes('transfer')) {
      if (params.amount && typeof params.amount === 'number' && params.amount <= 0) {
        result.errors.push({
          type: 'business_rule',
          message: 'Transfer amount must be greater than 0',
          severity: 'error'
        })
      }
    }

    // Add warnings for potentially risky operations
    if (params.amount && typeof params.amount === 'number' && params.amount > 1000000) {
      result.warnings.push('Large amount detected - please verify this is correct')
    }

    return result
  }
}

/**
 * Error class for Action mapping errors
 */
export class ActionMappingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string
  ) {
    super(message)
    this.name = 'ActionMappingError'
  }
}

// Type definitions for the service

export interface ActionMappingResult {
  action: ActionMetadata
  matchScore: number
  reasons: string[]
  parameterMapping: Record<string, string>
  confidence: number
}

export interface ParameterValidationResult {
  isValid: boolean
  validatedParams: Record<string, any>
  errors: ValidationError[]
  warnings: string[]
  missingRequired: string[]
  typeConversions: TypeConversion[]
}

export interface TypeConversion {
  parameter: string
  originalValue: any
  convertedValue: any
  originalType: string
  targetType: string
}

interface SingleParameterValidation {
  isValid: boolean
  convertedValue: any
  wasConverted: boolean
  errors: ValidationError[]
  warnings: string[]
}

interface NumberConversionResult {
  value: number
  isValid: boolean
  wasConverted: boolean
}

interface BooleanConversionResult {
  value: boolean
  isValid: boolean
  wasConverted: boolean
}

interface AddressValidationResult {
  isValid: boolean
  normalized?: string
  type?: string
}

interface RuleValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
}

interface BusinessRuleValidationResult {
  errors: ValidationError[]
  warnings: string[]
}

// Add missing ValidationRule interface to types if not already defined
interface ValidationRule {
  type: 'range' | 'pattern' | 'custom'
  value: any
  message: string
}

// Add missing ActionInput interface to types if not already defined  
interface ActionInput {
  name: string
  type: string
  required: boolean
  description?: string
  validation?: ValidationRule[]
}

/**
 * Default Action mapping service instance (lazy-loaded)
 */
let _defaultActionMappingService: ActionMappingService | null = null
export const getDefaultActionMappingService = (): ActionMappingService => {
  if (!_defaultActionMappingService) {
    _defaultActionMappingService = new ActionMappingService()
  }
  return _defaultActionMappingService
}

/**
 * Create a new Action mapping service with custom discovery service
 */
export function createActionMappingService(discoveryService?: ActionDiscoveryService): ActionMappingService {
  return new ActionMappingService(discoveryService)
}