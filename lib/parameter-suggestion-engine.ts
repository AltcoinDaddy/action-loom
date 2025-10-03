import { 
  ActionParameter, 
  ActionMetadata, 
  ParsedWorkflow, 
  ParsedAction, 
  ActionOutput 
} from './types'
import { 
  ParameterType, 
  ParameterSuggestion, 
  ValidationContext,
  EnhancedActionParameter 
} from './parameter-validator'
import { FlowAPIClient, createFlowAPIClient } from './flow-api-client'

// Flow network token information
export interface FlowToken {
  symbol: string
  name: string
  address: string
  decimals: number
  logoURI?: string
  verified: boolean
  category: 'native' | 'fungible' | 'nft'
}

// Common Flow addresses for suggestions
export interface FlowAddress {
  name: string
  address: string
  category: 'service' | 'contract' | 'user'
  description?: string
}

// Default value configuration
export interface DefaultValueConfig {
  parameterType: ParameterType
  actionCategory?: string
  defaultValue: any
  condition?: (parameter: ActionParameter, context: ValidationContext) => boolean
}

/**
 * ParameterSuggestionEngine provides smart parameter suggestions and default values
 */
export class ParameterSuggestionEngine {
  private flowClient: FlowAPIClient
  private tokenCache: Map<string, FlowToken[]> = new Map()
  private addressCache: Map<string, FlowAddress[]> = new Map()
  private cacheExpiry: number = 5 * 60 * 1000 // 5 minutes

  constructor(flowClient?: FlowAPIClient) {
    this.flowClient = flowClient || createFlowAPIClient('testnet')
  }

  /**
   * Get parameter suggestions based on type and context
   */
  async getParameterSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): Promise<ParameterSuggestion[]> {
    const parameterType = this.inferParameterType(parameter.type)
    const suggestions: ParameterSuggestion[] = []

    switch (parameterType) {
      case ParameterType.ADDRESS:
        suggestions.push(...await this.getAddressSuggestions(parameter, context))
        break
      case ParameterType.STRING:
        if (this.isTokenParameter(parameter)) {
          suggestions.push(...await this.getTokenSuggestions(parameter, context))
        } else {
          suggestions.push(...this.getStringSuggestions(parameter, context))
        }
        break
      case ParameterType.UFIX64:
        suggestions.push(...this.getAmountSuggestions(parameter, context))
        break
      case ParameterType.UINT64:
        suggestions.push(...this.getIntegerSuggestions(parameter, context))
        break
      case ParameterType.BOOL:
        suggestions.push(...this.getBooleanSuggestions(parameter, context))
        break
      default:
        suggestions.push(...this.getGenericSuggestions(parameter, context))
    }

    // Add parameter reference suggestions from other actions
    suggestions.push(...this.getParameterReferenceSuggestions(parameter, context))

    return suggestions
  }

  /**
   * Get default value for a parameter
   */
  getDefaultValue(
    parameter: ActionParameter,
    context: ValidationContext
  ): any {
    const parameterType = this.inferParameterType(parameter.type)
    
    // Check for custom default value configurations
    const customDefault = this.getCustomDefaultValue(parameter, context)
    if (customDefault !== undefined) {
      return customDefault
    }

    // Standard default values by type
    switch (parameterType) {
      case ParameterType.ADDRESS:
        return this.getDefaultAddress(parameter, context)
      case ParameterType.STRING:
        if (this.isTokenParameter(parameter)) {
          return this.getDefaultToken(parameter, context)
        }
        return ''
      case ParameterType.UFIX64:
        return this.getDefaultAmount(parameter, context)
      case ParameterType.UINT64:
        return '0'
      case ParameterType.INT:
        return '0'
      case ParameterType.BOOL:
        return false
      default:
        return ''
    }
  }

  /**
   * Populate default values for all parameters in an action
   */
  populateDefaultValues(
    action: ActionMetadata,
    context: ValidationContext
  ): Record<string, any> {
    const defaultValues: Record<string, any> = {}

    for (const parameter of action.parameters) {
      if (!parameter.required) {
        continue // Skip optional parameters
      }

      const defaultValue = this.getDefaultValue(parameter, context)
      if (defaultValue !== undefined && defaultValue !== '') {
        defaultValues[parameter.name] = defaultValue
      }
    }

    return defaultValues
  }

  /**
   * Get token suggestions from Flow network
   */
  private async getTokenSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): Promise<ParameterSuggestion[]> {
    try {
      const tokens = await this.getFlowTokens()
      const suggestions: ParameterSuggestion[] = []

      // Prioritize common tokens
      const commonTokens = tokens.filter(token => 
        ['FLOW', 'USDC', 'USDT', 'FUSD'].includes(token.symbol)
      )

      // Add common tokens first
      for (const token of commonTokens) {
        suggestions.push({
          value: token.symbol,
          label: `${token.symbol} (${token.name})`,
          description: `${token.name} - ${token.address}`,
          category: 'common'
        })
      }

      // Add other verified tokens
      const otherTokens = tokens.filter(token => 
        token.verified && !commonTokens.includes(token)
      ).slice(0, 10) // Limit to 10 additional tokens

      for (const token of otherTokens) {
        suggestions.push({
          value: token.symbol,
          label: `${token.symbol} (${token.name})`,
          description: `${token.name} - ${token.address}`,
          category: 'verified'
        })
      }

      return suggestions
    } catch (error) {
      console.warn('Failed to fetch token suggestions:', error)
      return this.getFallbackTokenSuggestions()
    }
  }

  /**
   * Get address suggestions
   */
  private async getAddressSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): Promise<ParameterSuggestion[]> {
    try {
      const addresses = await this.getFlowAddresses()
      const suggestions: ParameterSuggestion[] = []

      // Filter addresses based on parameter context
      const relevantAddresses = this.filterAddressesByContext(addresses, parameter, context)

      for (const address of relevantAddresses) {
        suggestions.push({
          value: address.address,
          label: `${address.name} (${address.address})`,
          description: address.description || `${address.category} address`,
          category: address.category
        })
      }

      return suggestions
    } catch (error) {
      console.warn('Failed to fetch address suggestions:', error)
      return this.getFallbackAddressSuggestions()
    }
  }

  /**
   * Get amount suggestions based on context
   */
  private getAmountSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): ParameterSuggestion[] {
    const suggestions: ParameterSuggestion[] = []

    // Common amount suggestions
    const commonAmounts = ['1.0', '10.0', '100.0', '1000.0']
    
    for (const amount of commonAmounts) {
      suggestions.push({
        value: amount,
        label: amount,
        description: `${amount} tokens`,
        category: 'common'
      })
    }

    // Context-specific amounts
    if (parameter.name.toLowerCase().includes('fee')) {
      suggestions.push({
        value: '0.001',
        label: '0.001',
        description: 'Typical transaction fee',
        category: 'fee'
      })
    }

    if (parameter.name.toLowerCase().includes('minimum')) {
      suggestions.push({
        value: '0.1',
        label: '0.1',
        description: 'Minimum amount',
        category: 'minimum'
      })
    }

    return suggestions
  }

  /**
   * Get integer suggestions
   */
  private getIntegerSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): ParameterSuggestion[] {
    const suggestions: ParameterSuggestion[] = []

    if (parameter.name.toLowerCase().includes('count') || 
        parameter.name.toLowerCase().includes('quantity')) {
      const counts = ['1', '5', '10', '50', '100']
      for (const count of counts) {
        suggestions.push({
          value: count,
          label: count,
          description: `${count} items`,
          category: 'quantity'
        })
      }
    }

    if (parameter.name.toLowerCase().includes('percentage')) {
      const percentages = ['25', '50', '75', '100']
      for (const percentage of percentages) {
        suggestions.push({
          value: percentage,
          label: `${percentage}%`,
          description: `${percentage} percent`,
          category: 'percentage'
        })
      }
    }

    return suggestions
  }

  /**
   * Get boolean suggestions
   */
  private getBooleanSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): ParameterSuggestion[] {
    return [
      {
        value: true,
        label: 'True',
        description: 'Enable this option',
        category: 'boolean'
      },
      {
        value: false,
        label: 'False',
        description: 'Disable this option',
        category: 'boolean'
      }
    ]
  }

  /**
   * Get string suggestions based on parameter name
   */
  private getStringSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): ParameterSuggestion[] {
    const suggestions: ParameterSuggestion[] = []
    const paramName = parameter.name.toLowerCase()

    if (paramName.includes('name') || paramName.includes('title')) {
      suggestions.push(
        {
          value: 'My NFT',
          label: 'My NFT',
          description: 'Default NFT name',
          category: 'name'
        },
        {
          value: 'ActionLoom Token',
          label: 'ActionLoom Token',
          description: 'Default token name',
          category: 'name'
        }
      )
    }

    if (paramName.includes('description')) {
      suggestions.push({
        value: 'Created with ActionLoom',
        label: 'Created with ActionLoom',
        description: 'Default description',
        category: 'description'
      })
    }

    if (paramName.includes('url') || paramName.includes('uri')) {
      suggestions.push({
        value: 'https://example.com',
        label: 'https://example.com',
        description: 'Example URL',
        category: 'url'
      })
    }

    return suggestions
  }

  /**
   * Get generic suggestions for unknown parameter types
   */
  private getGenericSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): ParameterSuggestion[] {
    // Return empty array for unknown types
    return []
  }

  /**
   * Get parameter reference suggestions from other actions
   */
  private getParameterReferenceSuggestions(
    parameter: ActionParameter,
    context: ValidationContext
  ): ParameterSuggestion[] {
    const suggestions: ParameterSuggestion[] = []
    const parameterType = this.inferParameterType(parameter.type)

    // Find compatible outputs from other actions
    for (const [actionId, output] of Object.entries(context.availableOutputs)) {
      if (this.isTypeCompatible(parameterType, output.type)) {
        suggestions.push({
          value: `${actionId}.${output.name}`,
          label: `${actionId}.${output.name}`,
          description: `Use output from ${actionId}: ${output.description || output.name}`,
          category: 'reference'
        })
      }
    }

    return suggestions
  }

  /**
   * Get Flow tokens from network or cache
   */
  private async getFlowTokens(): Promise<FlowToken[]> {
    const cacheKey = 'flow-tokens'
    const cached = this.tokenCache.get(cacheKey)
    
    if (cached && this.isCacheValid(cacheKey)) {
      return cached
    }

    try {
      // In a real implementation, this would query the Flow network for token information
      // For now, return hardcoded common tokens
      const tokens: FlowToken[] = [
        {
          symbol: 'FLOW',
          name: 'Flow Token',
          address: '0x1654653399040a61',
          decimals: 8,
          verified: true,
          category: 'native'
        },
        {
          symbol: 'USDC',
          name: 'USD Coin',
          address: '0xb19436aae4d94622',
          decimals: 8,
          verified: true,
          category: 'fungible'
        },
        {
          symbol: 'USDT',
          name: 'Tether USD',
          address: '0xcfdd90d4a00f7b5b',
          decimals: 8,
          verified: true,
          category: 'fungible'
        },
        {
          symbol: 'FUSD',
          name: 'Flow USD',
          address: '0x3c5959b568896393',
          decimals: 8,
          verified: true,
          category: 'fungible'
        }
      ]

      this.tokenCache.set(cacheKey, tokens)
      return tokens
    } catch (error) {
      console.error('Failed to fetch Flow tokens:', error)
      return this.getFallbackTokenSuggestions().map(s => ({
        symbol: s.value,
        name: s.label,
        address: '0x0000000000000000',
        decimals: 8,
        verified: false,
        category: 'fungible' as const
      }))
    }
  }

  /**
   * Get Flow addresses from network or cache
   */
  private async getFlowAddresses(): Promise<FlowAddress[]> {
    const cacheKey = 'flow-addresses'
    const cached = this.addressCache.get(cacheKey)
    
    if (cached && this.isCacheValid(cacheKey)) {
      return cached
    }

    try {
      // Common Flow service addresses
      const addresses: FlowAddress[] = [
        {
          name: 'Flow Token',
          address: '0x1654653399040a61',
          category: 'contract',
          description: 'Native FLOW token contract'
        },
        {
          name: 'USDC Contract',
          address: '0xb19436aae4d94622',
          category: 'contract',
          description: 'USD Coin contract'
        },
        {
          name: 'Flow Service Account',
          address: '0xf8d6e0586b0a20c7',
          category: 'service',
          description: 'Flow blockchain service account'
        },
        {
          name: 'Flow Fees',
          address: '0xe5a8b7f23e8b548f',
          category: 'service',
          description: 'Flow network fees account'
        }
      ]

      this.addressCache.set(cacheKey, addresses)
      return addresses
    } catch (error) {
      console.error('Failed to fetch Flow addresses:', error)
      return this.getFallbackAddressSuggestions().map(s => ({
        name: s.label,
        address: s.value,
        category: 'contract' as const,
        description: s.description
      }))
    }
  }

  /**
   * Filter addresses based on parameter context
   */
  private filterAddressesByContext(
    addresses: FlowAddress[],
    parameter: ActionParameter,
    context: ValidationContext
  ): FlowAddress[] {
    const paramName = parameter.name.toLowerCase()

    // Filter by parameter name patterns
    if (paramName.includes('token') || paramName.includes('contract')) {
      return addresses.filter(addr => addr.category === 'contract')
    }

    if (paramName.includes('service') || paramName.includes('admin')) {
      return addresses.filter(addr => addr.category === 'service')
    }

    if (paramName.includes('recipient') || paramName.includes('to')) {
      return addresses.filter(addr => addr.category === 'user' || addr.category === 'contract')
    }

    // Return all addresses if no specific pattern matches
    return addresses
  }

  /**
   * Get custom default value based on configuration
   */
  private getCustomDefaultValue(
    parameter: ActionParameter,
    context: ValidationContext
  ): any {
    // Define custom default value rules
    const defaultConfigs: DefaultValueConfig[] = [
      {
        parameterType: ParameterType.UFIX64,
        actionCategory: 'defi',
        defaultValue: '1.0',
        condition: (param) => param.name.toLowerCase().includes('amount')
      },
      {
        parameterType: ParameterType.ADDRESS,
        defaultValue: '0x1654653399040a61', // Flow token address
        condition: (param) => param.name.toLowerCase().includes('token')
      },
      {
        parameterType: ParameterType.BOOL,
        defaultValue: true,
        condition: (param) => param.name.toLowerCase().includes('enable')
      }
    ]

    const parameterType = this.inferParameterType(parameter.type)
    
    for (const config of defaultConfigs) {
      if (config.parameterType === parameterType) {
        if (config.condition && !config.condition(parameter, context)) {
          continue
        }
        if (config.actionCategory && context.currentAction.actionType !== config.actionCategory) {
          continue
        }
        return config.defaultValue
      }
    }

    return undefined
  }

  /**
   * Get default address based on parameter context
   */
  private getDefaultAddress(
    parameter: ActionParameter,
    context: ValidationContext
  ): string {
    const paramName = parameter.name.toLowerCase()

    if (paramName.includes('token')) {
      return '0x1654653399040a61' // Flow token address
    }

    if (paramName.includes('usdc')) {
      return '0xb19436aae4d94622' // USDC address
    }

    return '' // No default for generic addresses
  }

  /**
   * Get default token based on parameter context
   */
  private getDefaultToken(
    parameter: ActionParameter,
    context: ValidationContext
  ): string {
    const paramName = parameter.name.toLowerCase()

    if (paramName.includes('from') || paramName.includes('input')) {
      return 'FLOW'
    }

    // More specific matching for "to" tokens to avoid matching "token"
    if (paramName === 'to' || paramName === 'totoken' || paramName.startsWith('to_') || paramName.includes('output')) {
      return 'USDC'
    }

    return 'FLOW' // Default to FLOW token
  }

  /**
   * Get default amount based on parameter context
   */
  private getDefaultAmount(
    parameter: ActionParameter,
    context: ValidationContext
  ): string {
    const paramName = parameter.name.toLowerCase()

    if (paramName.includes('fee')) {
      return '0.001'
    }

    if (paramName.includes('minimum')) {
      return '0.1'
    }

    return '1.0' // Default amount
  }

  /**
   * Check if parameter is likely a token parameter
   */
  private isTokenParameter(parameter: ActionParameter): boolean {
    const paramName = parameter.name.toLowerCase()
    const tokenKeywords = ['token', 'currency', 'coin', 'asset']
    
    return tokenKeywords.some(keyword => paramName.includes(keyword))
  }

  /**
   * Check if two types are compatible for parameter references
   */
  private isTypeCompatible(targetType: ParameterType, sourceType: string): boolean {
    const sourceParameterType = this.inferParameterType(sourceType)
    
    // Exact match
    if (targetType === sourceParameterType) {
      return true
    }

    // Compatible type conversions
    if (targetType === ParameterType.STRING) {
      return true // Strings can accept most types
    }

    if (targetType === ParameterType.UFIX64 && sourceParameterType === ParameterType.UINT64) {
      return true // UInt64 can be converted to UFix64
    }

    if (targetType === ParameterType.ADDRESS && sourceParameterType === ParameterType.STRING) {
      return true // String addresses can be used as Address type
    }

    return false
  }

  /**
   * Infer parameter type from string
   */
  private inferParameterType(typeString: string): ParameterType {
    const normalizedType = typeString.toLowerCase()
    
    if (normalizedType.includes('address')) return ParameterType.ADDRESS
    if (normalizedType.includes('ufix64')) return ParameterType.UFIX64
    if (normalizedType.includes('string')) return ParameterType.STRING
    if (normalizedType.includes('bool')) return ParameterType.BOOL
    if (normalizedType.includes('int') && !normalizedType.includes('uint')) return ParameterType.INT
    if (normalizedType.includes('uint64')) return ParameterType.UINT64
    if (normalizedType.includes('array')) return ParameterType.ARRAY
    if (normalizedType.includes('dictionary')) return ParameterType.DICTIONARY
    
    return ParameterType.STRING
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(cacheKey: string): boolean {
    // Simple time-based cache validation
    // In a real implementation, this could be more sophisticated
    return true // For now, assume cache is always valid within expiry
  }

  /**
   * Get fallback token suggestions when network is unavailable
   */
  private getFallbackTokenSuggestions(): ParameterSuggestion[] {
    return [
      {
        value: 'FLOW',
        label: 'FLOW (Flow Token)',
        description: 'Native Flow blockchain token',
        category: 'native'
      },
      {
        value: 'USDC',
        label: 'USDC (USD Coin)',
        description: 'USD-pegged stablecoin',
        category: 'stablecoin'
      },
      {
        value: 'USDT',
        label: 'USDT (Tether USD)',
        description: 'USD-pegged stablecoin',
        category: 'stablecoin'
      }
    ]
  }

  /**
   * Get fallback address suggestions when network is unavailable
   */
  private getFallbackAddressSuggestions(): ParameterSuggestion[] {
    return [
      {
        value: '0x1654653399040a61',
        label: 'Flow Token Contract',
        description: 'Native FLOW token contract address',
        category: 'contract'
      },
      {
        value: '0xb19436aae4d94622',
        label: 'USDC Contract',
        description: 'USD Coin contract address',
        category: 'contract'
      }
    ]
  }
}

/**
 * Address validation and formatting utilities
 */
export class AddressValidator {
  /**
   * Validate Flow address format
   */
  static isValidFlowAddress(address: string): boolean {
    if (typeof address !== 'string') {
      return false
    }

    // Flow addresses are 16 characters long (excluding 0x prefix)
    const addressPattern = /^0x[a-fA-F0-9]{16}$/
    return addressPattern.test(address)
  }

  /**
   * Format address for display
   */
  static formatAddress(address: string, truncate: boolean = true): string {
    if (!this.isValidFlowAddress(address)) {
      return address
    }

    if (!truncate) {
      return address
    }

    // Truncate to show first 6 and last 4 characters
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  /**
   * Normalize address format (ensure 0x prefix and lowercase)
   */
  static normalizeAddress(address: string): string {
    if (typeof address !== 'string') {
      return address
    }

    let normalized = address.toLowerCase()
    
    // Add 0x prefix if missing
    if (!normalized.startsWith('0x')) {
      normalized = '0x' + normalized
    }

    // Pad with zeros if too short (Flow addresses should be 18 chars total)
    if (normalized.length < 18) {
      const padding = '0'.repeat(18 - normalized.length)
      normalized = '0x' + padding + normalized.slice(2)
    }

    return normalized
  }

  /**
   * Get address suggestions based on input
   */
  static getAddressSuggestions(input: string): string[] {
    const suggestions: string[] = []

    // If input looks like the start of an address, suggest completion
    if (input.startsWith('0x') && input.length < 18) {
      const remaining = 18 - input.length
      const padding = '0'.repeat(remaining)
      suggestions.push(input + padding)
    }

    // If input doesn't start with 0x, suggest adding it
    if (!input.startsWith('0x') && /^[a-fA-F0-9]+$/.test(input)) {
      suggestions.push('0x' + input)
    }

    return suggestions
  }
}

/**
 * Create default parameter suggestion engine
 */
export function createParameterSuggestionEngine(
  flowClient?: FlowAPIClient
): ParameterSuggestionEngine {
  return new ParameterSuggestionEngine(flowClient)
}

/**
 * Default parameter suggestion engine instance
 */
export const defaultSuggestionEngine = createParameterSuggestionEngine()