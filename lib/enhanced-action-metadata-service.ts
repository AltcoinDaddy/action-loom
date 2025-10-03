import {
  ActionMetadata,
  EnhancedActionMetadata,
  EnhancedActionParameter,
  ParameterValidationRules,
  ParameterConstraints,
  ParameterType,
  ParameterSuggestion,
  ActionValidationRules,
  ConditionalRequirement,
  ParameterDependency,
  ValidationContext,
  ValidationResult,
  ValidationError
} from './types'

/**
 * Enhanced Action Metadata Service
 * 
 * Provides validation rules and enhanced metadata for actions
 * Requirements: 2.3, 3.1, 4.2, 5.1
 */
export class EnhancedActionMetadataService {
  private validationRuleTemplates: Map<string, ActionValidationRules> = new Map()
  private parameterTemplates: Map<string, EnhancedActionParameter[]> = new Map()

  constructor() {
    this.initializeValidationTemplates()
  }

  /**
   * Initialize validation rule templates for common action patterns
   */
  private initializeValidationTemplates(): void {
    // Swap Tokens validation rules
    this.validationRuleTemplates.set('swap-tokens', {
      requiredParameterGroups: [['fromToken', 'toToken', 'amount']],
      mutuallyExclusive: [],
      conditionalRequirements: [
        {
          condition: (params) => params.fromToken === params.toToken,
          requiredParameters: [],
          message: 'Cannot swap the same token to itself'
        },
        {
          condition: (params) => parseFloat(params.amount || '0') <= 0,
          requiredParameters: [],
          message: 'Swap amount must be greater than 0'
        }
      ],
      customValidation: this.validateSwapTokens.bind(this)
    })

    // Stake Tokens validation rules
    this.validationRuleTemplates.set('stake-tokens', {
      requiredParameterGroups: [['amount', 'duration']],
      mutuallyExclusive: [],
      conditionalRequirements: [
        {
          condition: (params) => parseFloat(params.amount || '0') <= 0,
          requiredParameters: [],
          message: 'Stake amount must be greater than 0'
        },
        {
          condition: (params) => parseInt(params.duration || '0') < 86400, // 1 day minimum
          requiredParameters: [],
          message: 'Minimum staking duration is 1 day (86400 seconds)'
        }
      ],
      customValidation: this.validateStakeTokens.bind(this)
    })

    // Transfer Tokens validation rules
    this.validationRuleTemplates.set('transfer-tokens', {
      requiredParameterGroups: [['recipient', 'amount', 'token']],
      mutuallyExclusive: [],
      conditionalRequirements: [
        {
          condition: (params) => parseFloat(params.amount || '0') <= 0,
          requiredParameters: [],
          message: 'Transfer amount must be greater than 0'
        }
      ],
      customValidation: this.validateTransferTokens.bind(this)
    })

    // Initialize parameter templates
    this.initializeParameterTemplates()
  }

  /**
   * Initialize enhanced parameter templates for common actions
   */
  private initializeParameterTemplates(): void {
    // Swap Tokens parameters
    this.parameterTemplates.set('swap-tokens', [
      {
        name: 'fromToken',
        type: ParameterType.STRING,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            enum: ['FLOW', 'USDC', 'FUSD', 'BLT', 'REVV'],
            minLength: 1,
            maxLength: 20
          }
        },
        suggestions: [
          { value: 'FLOW', label: 'Flow Token', description: 'Native Flow blockchain token', category: 'native' },
          { value: 'USDC', label: 'USD Coin', description: 'Stablecoin pegged to USD', category: 'stablecoin' },
          { value: 'FUSD', label: 'Flow USD', description: 'Flow-native stablecoin', category: 'stablecoin' }
        ],
        defaultValue: 'FLOW'
      },
      {
        name: 'toToken',
        type: ParameterType.STRING,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            enum: ['FLOW', 'USDC', 'FUSD', 'BLT', 'REVV'],
            minLength: 1,
            maxLength: 20
          }
        },
        suggestions: [
          { value: 'USDC', label: 'USD Coin', description: 'Stablecoin pegged to USD', category: 'stablecoin' },
          { value: 'FUSD', label: 'Flow USD', description: 'Flow-native stablecoin', category: 'stablecoin' },
          { value: 'BLT', label: 'Blocto Token', description: 'Blocto ecosystem token', category: 'utility' }
        ],
        defaultValue: 'USDC'
      },
      {
        name: 'amount',
        type: ParameterType.UFIX64,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.UFIX64,
          constraints: {
            min: 0.000001,
            max: 1000000,
            decimals: 8
          }
        },
        suggestions: [
          { value: '1.0', label: '1 Token', description: 'Small test amount', category: 'common' },
          { value: '10.0', label: '10 Tokens', description: 'Medium amount', category: 'common' },
          { value: '100.0', label: '100 Tokens', description: 'Large amount', category: 'common' }
        ],
        defaultValue: '1.0'
      }
    ])

    // Stake Tokens parameters
    this.parameterTemplates.set('stake-tokens', [
      {
        name: 'amount',
        type: ParameterType.UFIX64,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.UFIX64,
          constraints: {
            min: 1.0,
            max: 1000000,
            decimals: 8
          }
        },
        suggestions: [
          { value: '10.0', label: '10 FLOW', description: 'Minimum staking amount', category: 'minimum' },
          { value: '100.0', label: '100 FLOW', description: 'Recommended amount', category: 'recommended' },
          { value: '1000.0', label: '1000 FLOW', description: 'Large stake', category: 'large' }
        ],
        defaultValue: '10.0'
      },
      {
        name: 'duration',
        type: ParameterType.UINT64,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.UINT64,
          constraints: {
            min: 86400, // 1 day
            max: 31536000 // 1 year
          }
        },
        suggestions: [
          { value: '86400', label: '1 Day', description: 'Minimum staking period', category: 'short' },
          { value: '604800', label: '1 Week', description: 'Short-term staking', category: 'short' },
          { value: '2592000', label: '30 Days', description: 'Medium-term staking', category: 'medium' },
          { value: '7776000', label: '90 Days', description: 'Long-term staking', category: 'long' }
        ],
        defaultValue: '604800'
      }
    ])

    // Transfer Tokens parameters
    this.parameterTemplates.set('transfer-tokens', [
      {
        name: 'recipient',
        type: ParameterType.ADDRESS,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.ADDRESS,
          constraints: {
            pattern: /^0x[a-fA-F0-9]{16}$/,
            minLength: 18,
            maxLength: 18
          }
        },
        suggestions: [
          { value: '0x1234567890abcdef', label: 'Test Address 1', description: 'Common test address', category: 'test' },
          { value: '0xfedcba0987654321', label: 'Test Address 2', description: 'Another test address', category: 'test' }
        ]
      },
      {
        name: 'amount',
        type: ParameterType.UFIX64,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.UFIX64,
          constraints: {
            min: 0.000001,
            max: 1000000,
            decimals: 8
          }
        },
        suggestions: [
          { value: '1.0', label: '1 Token', description: 'Small amount', category: 'common' },
          { value: '10.0', label: '10 Tokens', description: 'Medium amount', category: 'common' }
        ],
        defaultValue: '1.0'
      },
      {
        name: 'token',
        type: ParameterType.STRING,
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            enum: ['FLOW', 'USDC', 'FUSD'],
            minLength: 1,
            maxLength: 20
          }
        },
        suggestions: [
          { value: 'FLOW', label: 'Flow Token', description: 'Native Flow token', category: 'native' },
          { value: 'USDC', label: 'USD Coin', description: 'Stablecoin', category: 'stablecoin' }
        ],
        defaultValue: 'FLOW'
      }
    ])
  }

  /**
   * Enhance action metadata with validation rules
   */
  enhanceActionMetadata(action: ActionMetadata): EnhancedActionMetadata {
    const validationRules = this.validationRuleTemplates.get(action.id)
    const parameterTemplates = this.parameterTemplates.get(action.id)

    // Convert basic parameters to enhanced parameters
    const enhancedParameters: EnhancedActionParameter[] = parameterTemplates || 
      action.parameters.map(param => this.createEnhancedParameter(param, action.id))

    return {
      ...action,
      parameters: enhancedParameters,
      validationRules,
      parameterDependencies: this.getParameterDependencies(action.id)
    }
  }

  /**
   * Create enhanced parameter from basic parameter
   */
  private createEnhancedParameter(param: any, actionId: string): EnhancedActionParameter {
    return {
      name: param.name,
      type: this.mapToParameterType(param.type),
      value: param.value || '',
      required: param.required || false,
      validation: {
        required: param.required || false,
        type: this.mapToParameterType(param.type),
        constraints: this.getDefaultConstraints(param.type)
      },
      suggestions: [],
      defaultValue: this.getDefaultValue(param.type)
    }
  }

  /**
   * Map string type to ParameterType enum
   */
  private mapToParameterType(type: string): ParameterType {
    switch (type.toLowerCase()) {
      case 'address': return ParameterType.ADDRESS
      case 'ufix64': return ParameterType.UFIX64
      case 'string': return ParameterType.STRING
      case 'bool': return ParameterType.BOOL
      case 'int': return ParameterType.INT
      case 'uint64': return ParameterType.UINT64
      case 'array': return ParameterType.ARRAY
      case 'dictionary': return ParameterType.DICTIONARY
      case 'optional': return ParameterType.OPTIONAL
      default: return ParameterType.STRING
    }
  }

  /**
   * Get default constraints for parameter type
   */
  private getDefaultConstraints(type: string): ParameterConstraints {
    switch (type.toLowerCase()) {
      case 'address':
        return {
          pattern: /^0x[a-fA-F0-9]{16}$/,
          minLength: 18,
          maxLength: 18
        }
      case 'ufix64':
        return {
          min: 0,
          max: Number.MAX_SAFE_INTEGER,
          decimals: 8
        }
      case 'string':
        return {
          minLength: 1,
          maxLength: 1000
        }
      case 'uint64':
        return {
          min: 0,
          max: Number.MAX_SAFE_INTEGER
        }
      default:
        return {}
    }
  }

  /**
   * Get default value for parameter type
   */
  private getDefaultValue(type: string): any {
    switch (type.toLowerCase()) {
      case 'address': return ''
      case 'ufix64': return '0.0'
      case 'string': return ''
      case 'bool': return false
      case 'int': return 0
      case 'uint64': return 0
      case 'array': return []
      case 'dictionary': return {}
      default: return ''
    }
  }

  /**
   * Get parameter dependencies for action
   */
  private getParameterDependencies(actionId: string): ParameterDependency[] {
    // Define common parameter dependencies
    const dependencies: Record<string, ParameterDependency[]> = {
      'swap-tokens': [
        {
          sourceActionId: 'get-balance',
          sourceOutputName: 'balance',
          transformFunction: (balance: string) => balance
        }
      ],
      'stake-tokens': [
        {
          sourceActionId: 'get-balance',
          sourceOutputName: 'balance',
          transformFunction: (balance: string) => balance
        }
      ],
      'transfer-tokens': [
        {
          sourceActionId: 'get-balance',
          sourceOutputName: 'balance',
          transformFunction: (balance: string) => balance
        }
      ]
    }

    return dependencies[actionId] || []
  }

  /**
   * Custom validation for Swap Tokens action
   */
  private validateSwapTokens(parameters: Record<string, any>, context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Check if swapping same token
    if (parameters.fromToken === parameters.toToken) {
      errors.push({
        type: 'INVALID_SWAP_PAIR',
        message: 'Cannot swap the same token to itself',
        field: 'toToken',
        severity: 'error'
      })
    }

    // Check amount validity
    const amount = parseFloat(parameters.amount || '0')
    if (amount <= 0) {
      errors.push({
        type: 'INVALID_AMOUNT',
        message: 'Swap amount must be greater than 0',
        field: 'amount',
        severity: 'error'
      })
    }

    // Warning for large amounts
    if (amount > 10000) {
      warnings.push('Large swap amount detected. Please verify the amount is correct.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Custom validation for Stake Tokens action
   */
  private validateStakeTokens(parameters: Record<string, any>, context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Check minimum stake amount
    const amount = parseFloat(parameters.amount || '0')
    if (amount < 1.0) {
      errors.push({
        type: 'INSUFFICIENT_STAKE_AMOUNT',
        message: 'Minimum stake amount is 1.0 FLOW',
        field: 'amount',
        severity: 'error'
      })
    }

    // Check minimum duration
    const duration = parseInt(parameters.duration || '0')
    if (duration < 86400) {
      errors.push({
        type: 'INSUFFICIENT_DURATION',
        message: 'Minimum staking duration is 1 day (86400 seconds)',
        field: 'duration',
        severity: 'error'
      })
    }

    // Warning for very long durations
    if (duration > 15552000) { // 6 months
      warnings.push('Long staking duration detected. Tokens will be locked for an extended period.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Custom validation for Transfer Tokens action
   */
  private validateTransferTokens(parameters: Record<string, any>, context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Validate recipient address format
    const recipient = parameters.recipient || ''
    const addressPattern = /^0x[a-fA-F0-9]{16}$/
    if (!addressPattern.test(recipient)) {
      errors.push({
        type: 'INVALID_ADDRESS_FORMAT',
        message: 'Recipient address must be a valid Flow address (0x followed by 16 hex characters)',
        field: 'recipient',
        severity: 'error'
      })
    }

    // Check transfer amount
    const amount = parseFloat(parameters.amount || '0')
    if (amount <= 0) {
      errors.push({
        type: 'INVALID_AMOUNT',
        message: 'Transfer amount must be greater than 0',
        field: 'amount',
        severity: 'error'
      })
    }

    // Warning for large transfers
    if (amount > 1000) {
      warnings.push('Large transfer amount detected. Please verify the recipient and amount.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Get validation rule template for action pattern
   */
  getValidationRuleTemplate(actionPattern: string): ActionValidationRules | undefined {
    return this.validationRuleTemplates.get(actionPattern)
  }

  /**
   * Get parameter template for action
   */
  getParameterTemplate(actionId: string): EnhancedActionParameter[] | undefined {
    return this.parameterTemplates.get(actionId)
  }

  /**
   * Add custom validation rule template
   */
  addValidationRuleTemplate(actionPattern: string, rules: ActionValidationRules): void {
    this.validationRuleTemplates.set(actionPattern, rules)
  }

  /**
   * Add custom parameter template
   */
  addParameterTemplate(actionId: string, parameters: EnhancedActionParameter[]): void {
    this.parameterTemplates.set(actionId, parameters)
  }
}

// Export singleton instance
export const enhancedActionMetadataService = new EnhancedActionMetadataService()