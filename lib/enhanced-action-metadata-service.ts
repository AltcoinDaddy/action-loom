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

    // Transfer Tokens validation rules (mock action)
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

    // Real Flow Actions validation rules
    this.validationRuleTemplates.set('transfer-flow', {
      requiredParameterGroups: [['recipient', 'amount']],
      mutuallyExclusive: [],
      conditionalRequirements: [
        {
          condition: (params) => parseFloat(params.amount || '0') <= 0,
          requiredParameters: [],
          message: 'Transfer amount must be greater than 0'
        }
      ],
      customValidation: this.validateTransferFlow.bind(this)
    })

    this.validationRuleTemplates.set('get-account-balance', {
      requiredParameterGroups: [['address']],
      mutuallyExclusive: [],
      conditionalRequirements: [],
      customValidation: this.validateGetAccountBalance.bind(this)
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

    // Transfer Tokens parameters (mock action)
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
        ],
        defaultValue: ''
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
          { value: '10.0', label: '10 Tokens', description: 'Medium amount', category: 'common' },
          { value: '100.0', label: '100 Tokens', description: 'Large amount', category: 'common' }
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
            enum: ['FLOW', 'USDC', 'FUSD', 'WBTC', 'WETH'],
            minLength: 1,
            maxLength: 20
          }
        },
        suggestions: [
          { value: 'FLOW', label: 'Flow Token', description: 'Native Flow blockchain token', category: 'native' },
          { value: 'USDC', label: 'USD Coin', description: 'Stablecoin pegged to USD', category: 'stablecoin' },
          { value: 'FUSD', label: 'Flow USD', description: 'Flow-native stablecoin', category: 'stablecoin' },
          { value: 'WBTC', label: 'Wrapped Bitcoin', description: 'Bitcoin on Flow', category: 'wrapped' },
          { value: 'WETH', label: 'Wrapped Ethereum', description: 'Ethereum on Flow', category: 'wrapped' }
        ],
        defaultValue: 'FLOW'
      }
    ])

    // Real Flow Actions parameter templates
    this.parameterTemplates.set('transfer-flow', [
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
        ],
        defaultValue: ''
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
          { value: '1.0', label: '1 FLOW', description: 'Small amount', category: 'common' },
          { value: '10.0', label: '10 FLOW', description: 'Medium amount', category: 'common' },
          { value: '100.0', label: '100 FLOW', description: 'Large amount', category: 'common' }
        ],
        defaultValue: '1.0'
      }
    ])

    this.parameterTemplates.set('get-account-balance', [
      {
        name: 'address',
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
          { value: '0x1654653399040a61', label: 'Flow Service Account', description: 'Flow service account (mainnet)', category: 'system' },
          { value: '0x7e60df042a9c0868', label: 'Flow Service Account', description: 'Flow service account (testnet)', category: 'system' }
        ],
        defaultValue: ''
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
    const parameterType = this.mapToParameterType(param.type)
    const defaultConstraints = this.getDefaultConstraints(param.type)
    
    // Handle special cases for specific parameters
    let constraints = defaultConstraints
    let suggestions: ParameterSuggestion[] = []
    let defaultValue = param.value || this.getDefaultValue(param.type)

    // Add enum constraints for parameters with options
    if (param.options && Array.isArray(param.options)) {
      constraints = {
        ...constraints,
        enum: param.options
      }
      
      // Create suggestions from options
      suggestions = param.options.map((option: string) => ({
        value: option,
        label: option,
        description: `${option} token`,
        category: 'option'
      }))
      
      // Set default value to first option if not already set
      if (!defaultValue && param.options.length > 0) {
        defaultValue = param.options[0]
      }
    }

    return {
      name: param.name,
      type: parameterType,
      value: param.value || '',
      required: param.required || false,
      validation: {
        required: param.required || false,
        type: parameterType,
        constraints
      },
      suggestions,
      defaultValue
    }
  }

  /**
   * Map string type to ParameterType enum
   * Enhanced to handle all Flow types correctly
   */
  private mapToParameterType(type: string): ParameterType {
    // Normalize the type string by removing whitespace and converting to lowercase
    const normalizedType = type.trim().toLowerCase()
    
    switch (normalizedType) {
      // Flow Address type
      case 'address':
        return ParameterType.ADDRESS
      
      // Flow fixed-point number types
      case 'ufix64':
      case 'fix64':
        return ParameterType.UFIX64
      
      // Flow integer types
      case 'uint64':
      case 'uint32':
      case 'uint16':
      case 'uint8':
        return ParameterType.UINT64
      
      case 'int':
      case 'int64':
      case 'int32':
      case 'int16':
      case 'int8':
      case 'integer':
        return ParameterType.INT
      
      // Flow string type
      case 'string':
        return ParameterType.STRING
      
      // Flow boolean type
      case 'bool':
      case 'boolean':
        return ParameterType.BOOL
      
      // Flow collection types
      case 'array':
      case '[string]':
      case '[address]':
      case '[ufix64]':
        return ParameterType.ARRAY
      
      case 'dictionary':
      case 'dict':
      case '{string: string}':
      case '{address: ufix64}':
        return ParameterType.DICTIONARY
      
      // Flow optional types
      case 'optional':
      case 'address?':
      case 'string?':
      case 'ufix64?':
      case 'bool?':
        return ParameterType.OPTIONAL
      
      // Flow resource and struct types (treat as string for now)
      case 'resource':
      case 'struct':
      case 'capability':
      case 'path':
        return ParameterType.STRING
      
      // Default fallback
      default:
        // Handle complex types like Optional<String> or Array<Address>
        if (normalizedType.includes('optional') || normalizedType.includes('?')) {
          return ParameterType.OPTIONAL
        }
        if (normalizedType.includes('array') || normalizedType.includes('[')) {
          return ParameterType.ARRAY
        }
        if (normalizedType.includes('dictionary') || normalizedType.includes('{')) {
          return ParameterType.DICTIONARY
        }
        
        // Default to STRING for unknown types
        return ParameterType.STRING
    }
  }

  /**
   * Get default constraints for parameter type
   * Enhanced to provide proper constraints for all Flow types
   */
  private getDefaultConstraints(type: string): ParameterConstraints {
    const normalizedType = type.trim().toLowerCase()
    
    switch (normalizedType) {
      case 'address':
        return {
          pattern: /^0x[a-fA-F0-9]{16}$/,
          minLength: 18,
          maxLength: 18
        }
      
      case 'ufix64':
      case 'fix64':
        return {
          min: 0.00000001, // Minimum positive UFix64 value (1e-8)
          max: 184467440737.09551615, // Maximum UFix64 value in Flow
          decimals: 8
        }
      
      case 'uint64':
      case 'uint32':
      case 'uint16':
      case 'uint8':
        return {
          min: 0,
          max: this.getMaxValueForUIntType(normalizedType)
        }
      
      case 'int':
      case 'int64':
      case 'int32':
      case 'int16':
      case 'int8':
      case 'integer':
        const { min, max } = this.getMinMaxForIntType(normalizedType)
        return { min, max }
      
      case 'string':
        return {
          minLength: 0, // Allow empty strings by default
          maxLength: 1000 // Reasonable default max length
        }
      
      case 'bool':
      case 'boolean':
        return {} // No constraints needed for boolean
      
      case 'array':
      case '[string]':
      case '[address]':
      case '[ufix64]':
        return {
          minLength: 0, // Allow empty arrays
          maxLength: 100 // Reasonable default max array size
        }
      
      case 'dictionary':
      case 'dict':
      case '{string: string}':
      case '{address: ufix64}':
        return {
          minLength: 0, // Allow empty dictionaries
          maxLength: 100 // Reasonable default max dictionary size
        }
      
      case 'optional':
      case 'address?':
      case 'string?':
      case 'ufix64?':
      case 'bool?':
        return {} // Optional types have no constraints by default
      
      default:
        // For unknown types, provide minimal constraints
        return {
          minLength: 0,
          maxLength: 1000
        }
    }
  }

  /**
   * Get maximum value for unsigned integer types
   */
  private getMaxValueForUIntType(type: string): number {
    switch (type) {
      case 'uint8': return 255
      case 'uint16': return 65535
      case 'uint32': return 4294967295
      case 'uint64': return Number.MAX_SAFE_INTEGER // JavaScript safe integer limit
      default: return Number.MAX_SAFE_INTEGER
    }
  }

  /**
   * Get min/max values for signed integer types
   */
  private getMinMaxForIntType(type: string): { min: number; max: number } {
    switch (type) {
      case 'int8': return { min: -128, max: 127 }
      case 'int16': return { min: -32768, max: 32767 }
      case 'int32': return { min: -2147483648, max: 2147483647 }
      case 'int64':
      case 'int':
      case 'integer':
      default:
        return { min: Number.MIN_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER }
    }
  }

  /**
   * Get default value for parameter type
   * Enhanced to provide appropriate defaults for all Flow types
   */
  private getDefaultValue(type: string): any {
    const normalizedType = type.trim().toLowerCase()
    
    switch (normalizedType) {
      case 'address':
        return '' // Empty string for user input
      
      case 'ufix64':
      case 'fix64':
        return '' // Empty string for user input (will be validated as UFix64)
      
      case 'uint64':
      case 'uint32':
      case 'uint16':
      case 'uint8':
        return '' // Empty string for user input (will be validated as UInt)
      
      case 'int':
      case 'int64':
      case 'int32':
      case 'int16':
      case 'int8':
      case 'integer':
        return '' // Empty string for user input (will be validated as Int)
      
      case 'string':
        return '' // Empty string
      
      case 'bool':
      case 'boolean':
        return false // Default boolean value
      
      case 'array':
      case '[string]':
      case '[address]':
      case '[ufix64]':
        return [] // Empty array
      
      case 'dictionary':
      case 'dict':
      case '{string: string}':
      case '{address: ufix64}':
        return {} // Empty dictionary
      
      case 'optional':
      case 'address?':
      case 'string?':
      case 'ufix64?':
      case 'bool?':
        return null // Null for optional types
      
      case 'resource':
      case 'struct':
      case 'capability':
      case 'path':
        return '' // Empty string for complex types
      
      default:
        // Handle complex types
        if (normalizedType.includes('optional') || normalizedType.includes('?')) {
          return null
        }
        if (normalizedType.includes('array') || normalizedType.includes('[')) {
          return []
        }
        if (normalizedType.includes('dictionary') || normalizedType.includes('{')) {
          return {}
        }
        
        // Default to empty string for unknown types
        return ''
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
   * Custom validation for Transfer Flow action
   */
  private validateTransferFlow(parameters: Record<string, any>, context: ValidationContext): ValidationResult {
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
      warnings.push('Large FLOW transfer detected. Please verify the recipient and amount.')
    }

    // Warning for very small transfers
    if (amount < 0.001 && amount > 0) {
      warnings.push('Very small FLOW transfer. Consider transaction fees.')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  /**
   * Custom validation for Get Account Balance action
   */
  private validateGetAccountBalance(parameters: Record<string, any>, context: ValidationContext): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Validate address format
    const address = parameters.address || ''
    const addressPattern = /^0x[a-fA-F0-9]{16}$/
    if (!addressPattern.test(address)) {
      errors.push({
        type: 'INVALID_ADDRESS_FORMAT',
        message: 'Address must be a valid Flow address (0x followed by 16 hex characters)',
        field: 'address',
        severity: 'error'
      })
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