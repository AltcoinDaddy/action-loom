import {
  ActionValidationRules,
  ConditionalRequirement,
  EnhancedActionParameter,
  ParameterType,
  ParameterConstraints,
  ParameterSuggestion,
  ValidationContext,
  ValidationResult,
  ValidationError
} from './types'

/**
 * Action Validation Templates
 * 
 * Provides reusable validation rule templates for common action patterns
 * Requirements: 2.3, 3.1, 4.2, 5.1
 */

/**
 * DeFi Action Validation Templates
 */
export const DEFI_VALIDATION_TEMPLATES = {
  /**
   * Token Swap Actions
   */
  TOKEN_SWAP: {
    requiredParameterGroups: [['fromToken', 'toToken', 'amount']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => params.fromToken === params.toToken,
        requiredParameters: [],
        message: 'Source and destination tokens must be different'
      },
      {
        condition: (params) => parseFloat(params.amount || '0') <= 0,
        requiredParameters: [],
        message: 'Swap amount must be greater than 0'
      },
      {
        condition: (params) => parseFloat(params.slippage || '0') > 50,
        requiredParameters: [],
        message: 'Slippage tolerance cannot exceed 50%'
      }
    ]
  } as ActionValidationRules,

  /**
   * Liquidity Pool Actions
   */
  LIQUIDITY_POOL: {
    requiredParameterGroups: [['token1', 'token2', 'amount1', 'amount2']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => params.token1 === params.token2,
        requiredParameters: [],
        message: 'Pool tokens must be different'
      },
      {
        condition: (params) => parseFloat(params.amount1 || '0') <= 0 || parseFloat(params.amount2 || '0') <= 0,
        requiredParameters: [],
        message: 'Both token amounts must be greater than 0'
      }
    ]
  } as ActionValidationRules,

  /**
   * Staking Actions
   */
  STAKING: {
    requiredParameterGroups: [['amount', 'duration']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.amount || '0') <= 0,
        requiredParameters: [],
        message: 'Stake amount must be greater than 0'
      },
      {
        condition: (params) => parseInt(params.duration || '0') < 86400,
        requiredParameters: [],
        message: 'Minimum staking duration is 1 day'
      },
      {
        condition: (params) => parseInt(params.duration || '0') > 31536000,
        requiredParameters: [],
        message: 'Maximum staking duration is 1 year'
      }
    ]
  } as ActionValidationRules,

  /**
   * Lending Actions
   */
  LENDING: {
    requiredParameterGroups: [['asset', 'amount']],
    mutuallyExclusive: [['collateralAsset', 'borrowAsset']],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.amount || '0') <= 0,
        requiredParameters: [],
        message: 'Lending amount must be greater than 0'
      },
      {
        condition: (params) => params.collateralAsset === params.borrowAsset,
        requiredParameters: [],
        message: 'Collateral and borrow assets must be different'
      }
    ]
  } as ActionValidationRules
}

/**
 * NFT Action Validation Templates
 */
export const NFT_VALIDATION_TEMPLATES = {
  /**
   * NFT Minting Actions
   */
  MINTING: {
    requiredParameterGroups: [['recipient', 'metadata']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => !params.metadata || params.metadata.trim().length === 0,
        requiredParameters: [],
        message: 'NFT metadata is required'
      },
      {
        condition: (params) => params.metadata && !isValidURI(params.metadata),
        requiredParameters: [],
        message: 'Metadata must be a valid URI'
      }
    ]
  } as ActionValidationRules,

  /**
   * NFT Transfer Actions
   */
  TRANSFER: {
    requiredParameterGroups: [['recipient', 'tokenId']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseInt(params.tokenId || '0') <= 0,
        requiredParameters: [],
        message: 'Token ID must be a positive integer'
      }
    ]
  } as ActionValidationRules,

  /**
   * NFT Marketplace Actions
   */
  MARKETPLACE: {
    requiredParameterGroups: [['tokenId', 'price']],
    mutuallyExclusive: [['fixedPrice', 'auctionDuration']],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.price || '0') <= 0,
        requiredParameters: [],
        message: 'Price must be greater than 0'
      },
      {
        condition: (params) => params.auctionDuration && parseInt(params.auctionDuration) < 3600,
        requiredParameters: [],
        message: 'Minimum auction duration is 1 hour'
      }
    ]
  } as ActionValidationRules
}

/**
 * Token Action Validation Templates
 */
export const TOKEN_VALIDATION_TEMPLATES = {
  /**
   * Token Transfer Actions
   */
  TRANSFER: {
    requiredParameterGroups: [['recipient', 'amount', 'token']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.amount || '0') <= 0,
        requiredParameters: [],
        message: 'Transfer amount must be greater than 0'
      }
    ]
  } as ActionValidationRules,

  /**
   * Token Approval Actions
   */
  APPROVAL: {
    requiredParameterGroups: [['spender', 'amount', 'token']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.amount || '0') < 0,
        requiredParameters: [],
        message: 'Approval amount cannot be negative'
      }
    ]
  } as ActionValidationRules,

  /**
   * Token Burn Actions
   */
  BURN: {
    requiredParameterGroups: [['amount', 'token']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.amount || '0') <= 0,
        requiredParameters: [],
        message: 'Burn amount must be greater than 0'
      }
    ]
  } as ActionValidationRules
}

/**
 * Governance Action Validation Templates
 */
export const GOVERNANCE_VALIDATION_TEMPLATES = {
  /**
   * Proposal Creation Actions
   */
  PROPOSAL_CREATION: {
    requiredParameterGroups: [['title', 'description', 'votingDuration']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => !params.title || params.title.trim().length < 10,
        requiredParameters: [],
        message: 'Proposal title must be at least 10 characters'
      },
      {
        condition: (params) => !params.description || params.description.trim().length < 50,
        requiredParameters: [],
        message: 'Proposal description must be at least 50 characters'
      },
      {
        condition: (params) => parseInt(params.votingDuration || '0') < 86400,
        requiredParameters: [],
        message: 'Minimum voting duration is 1 day'
      }
    ]
  } as ActionValidationRules,

  /**
   * Voting Actions
   */
  VOTING: {
    requiredParameterGroups: [['proposalId', 'vote']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseInt(params.proposalId || '0') <= 0,
        requiredParameters: [],
        message: 'Proposal ID must be a positive integer'
      },
      {
        condition: (params) => params.vote !== true && params.vote !== false && params.vote !== 'yes' && params.vote !== 'no',
        requiredParameters: [],
        message: 'Vote must be yes/no or true/false'
      }
    ]
  } as ActionValidationRules,

  /**
   * Delegation Actions
   */
  DELEGATION: {
    requiredParameterGroups: [['delegate', 'amount']],
    mutuallyExclusive: [],
    conditionalRequirements: [
      {
        condition: (params) => parseFloat(params.amount || '0') <= 0,
        requiredParameters: [],
        message: 'Delegation amount must be greater than 0'
      }
    ]
  } as ActionValidationRules
}

/**
 * Parameter Constraint Templates
 */
export const PARAMETER_CONSTRAINT_TEMPLATES = {
  /**
   * Flow Address Constraints
   */
  FLOW_ADDRESS: {
    pattern: /^0x[a-fA-F0-9]{16}$/,
    minLength: 18,
    maxLength: 18
  } as ParameterConstraints,

  /**
   * Token Amount Constraints
   */
  TOKEN_AMOUNT: {
    min: 0.000001,
    max: 1000000000,
    decimals: 8
  } as ParameterConstraints,

  /**
   * Duration Constraints (in seconds)
   */
  DURATION: {
    min: 60, // 1 minute
    max: 31536000 // 1 year
  } as ParameterConstraints,

  /**
   * Percentage Constraints
   */
  PERCENTAGE: {
    min: 0,
    max: 100,
    decimals: 2
  } as ParameterConstraints,

  /**
   * Token Symbol Constraints
   */
  TOKEN_SYMBOL: {
    minLength: 1,
    maxLength: 10,
    pattern: /^[A-Z][A-Z0-9]*$/
  } as ParameterConstraints,

  /**
   * URI Constraints
   */
  URI: {
    minLength: 1,
    maxLength: 2048,
    pattern: /^https?:\/\/.+/
  } as ParameterConstraints
}

/**
 * Parameter Suggestion Templates
 */
export const PARAMETER_SUGGESTION_TEMPLATES = {
  /**
   * Common Flow Tokens
   */
  FLOW_TOKENS: [
    { value: 'FLOW', label: 'Flow Token', description: 'Native Flow blockchain token', category: 'native' },
    { value: 'USDC', label: 'USD Coin', description: 'Stablecoin pegged to USD', category: 'stablecoin' },
    { value: 'FUSD', label: 'Flow USD', description: 'Flow-native stablecoin', category: 'stablecoin' },
    { value: 'BLT', label: 'Blocto Token', description: 'Blocto ecosystem token', category: 'utility' },
    { value: 'REVV', label: 'REVV Token', description: 'Gaming and motorsports token', category: 'gaming' }
  ] as ParameterSuggestion[],

  /**
   * Common Amounts
   */
  COMMON_AMOUNTS: [
    { value: '1.0', label: '1 Token', description: 'Small test amount', category: 'test' },
    { value: '10.0', label: '10 Tokens', description: 'Medium amount', category: 'common' },
    { value: '100.0', label: '100 Tokens', description: 'Large amount', category: 'common' },
    { value: '1000.0', label: '1000 Tokens', description: 'Very large amount', category: 'large' }
  ] as ParameterSuggestion[],

  /**
   * Common Durations
   */
  COMMON_DURATIONS: [
    { value: '3600', label: '1 Hour', description: 'Short duration', category: 'short' },
    { value: '86400', label: '1 Day', description: 'Daily duration', category: 'daily' },
    { value: '604800', label: '1 Week', description: 'Weekly duration', category: 'weekly' },
    { value: '2592000', label: '30 Days', description: 'Monthly duration', category: 'monthly' },
    { value: '7776000', label: '90 Days', description: 'Quarterly duration', category: 'quarterly' }
  ] as ParameterSuggestion[],

  /**
   * Test Addresses
   */
  TEST_ADDRESSES: [
    { value: '0x1234567890abcdef', label: 'Test Address 1', description: 'Common test address', category: 'test' },
    { value: '0xfedcba0987654321', label: 'Test Address 2', description: 'Another test address', category: 'test' },
    { value: '0x0123456789abcdef', label: 'Test Address 3', description: 'Third test address', category: 'test' }
  ] as ParameterSuggestion[]
}

/**
 * Utility Functions
 */

/**
 * Validate URI format
 */
function isValidURI(uri: string): boolean {
  try {
    new URL(uri)
    return true
  } catch {
    return false
  }
}

/**
 * Get validation template by action category and type
 */
export function getValidationTemplate(category: string, actionType: string): ActionValidationRules | undefined {
  const categoryTemplates = {
    'defi': DEFI_VALIDATION_TEMPLATES,
    'nft': NFT_VALIDATION_TEMPLATES,
    'token': TOKEN_VALIDATION_TEMPLATES,
    'governance': GOVERNANCE_VALIDATION_TEMPLATES
  }

  const templates = categoryTemplates[category.toLowerCase() as keyof typeof categoryTemplates]
  if (!templates) return undefined

  return templates[actionType.toUpperCase() as keyof typeof templates]
}

/**
 * Get parameter constraint template by type
 */
export function getConstraintTemplate(constraintType: string): ParameterConstraints | undefined {
  return PARAMETER_CONSTRAINT_TEMPLATES[constraintType.toUpperCase() as keyof typeof PARAMETER_CONSTRAINT_TEMPLATES]
}

/**
 * Get parameter suggestion template by type
 */
export function getSuggestionTemplate(suggestionType: string): ParameterSuggestion[] | undefined {
  return PARAMETER_SUGGESTION_TEMPLATES[suggestionType.toUpperCase() as keyof typeof PARAMETER_SUGGESTION_TEMPLATES]
}

/**
 * Create enhanced parameter with template
 */
export function createEnhancedParameterWithTemplate(
  name: string,
  type: ParameterType,
  required: boolean = false,
  constraintTemplate?: string,
  suggestionTemplate?: string
): EnhancedActionParameter {
  const constraints = constraintTemplate ? getConstraintTemplate(constraintTemplate) : undefined
  const suggestions = suggestionTemplate ? getSuggestionTemplate(suggestionTemplate) : undefined

  return {
    name,
    type,
    value: '',
    required,
    validation: {
      required,
      type,
      constraints
    },
    suggestions: suggestions || [],
    defaultValue: getDefaultValueForType(type)
  }
}

/**
 * Get default value for parameter type
 */
function getDefaultValueForType(type: ParameterType): any {
  switch (type) {
    case ParameterType.ADDRESS: return ''
    case ParameterType.UFIX64: return '0.0'
    case ParameterType.STRING: return ''
    case ParameterType.BOOL: return false
    case ParameterType.INT: return 0
    case ParameterType.UINT64: return 0
    case ParameterType.ARRAY: return []
    case ParameterType.DICTIONARY: return {}
    case ParameterType.OPTIONAL: return null
    default: return ''
  }
}