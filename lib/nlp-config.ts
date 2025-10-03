import { NLPConfig } from './types'

/**
 * Default NLP configuration
 */
export const DEFAULT_NLP_CONFIG: NLPConfig = {
  timeout: 10000, // 10 seconds
  maxTokens: 512,
  temperature: 0.3, // Lower temperature for more consistent results
  confidenceThreshold: 0.7, // 70% confidence threshold
  modelEndpoint: process.env.HUGGINGFACE_MODEL_ENDPOINT,
  apiKey: process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN
}

/**
 * Environment-specific configurations
 */
export const NLP_CONFIGS = {
  development: {
    ...DEFAULT_NLP_CONFIG,
    timeout: 15000, // Longer timeout for development
    confidenceThreshold: 0.6 // Lower threshold for testing
  },
  
  production: {
    ...DEFAULT_NLP_CONFIG,
    timeout: 8000, // Faster timeout for production
    confidenceThreshold: 0.8 // Higher threshold for production
  },
  
  test: {
    ...DEFAULT_NLP_CONFIG,
    timeout: 5000,
    confidenceThreshold: 0.5,
    apiKey: undefined // Don't use external APIs in tests
  }
} as const

/**
 * Get NLP configuration for current environment
 */
export function getNLPConfig(): NLPConfig {
  const env = process.env.NODE_ENV || 'development'
  return NLP_CONFIGS[env as keyof typeof NLP_CONFIGS] || DEFAULT_NLP_CONFIG
}

/**
 * Workflow intent patterns for classification
 */
export const INTENT_PATTERNS = {
  swap: {
    keywords: ['swap', 'exchange', 'trade', 'convert', 'change'],
    patterns: [
      /swap\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i,
      /exchange\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i,
      /trade\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'fromToken', 'toToken']
  },
  
  stake: {
    keywords: ['stake', 'delegate', 'lock', 'deposit'],
    patterns: [
      /stake\s+(\d+\.?\d*)\s+(\w+)/i,
      /delegate\s+(\d+\.?\d*)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'token']
  },
  
  unstake: {
    keywords: ['unstake', 'undelegate', 'unlock', 'withdraw'],
    patterns: [
      /unstake\s+(\d+\.?\d*)\s+(\w+)/i,
      /withdraw\s+(\d+\.?\d*)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'token']
  },
  
  mint: {
    keywords: ['mint', 'create', 'generate', 'issue'],
    patterns: [
      /mint\s+(\d+\.?\d*)\s+(\w+)/i,
      /create\s+(\d+\.?\d*)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'token']
  },
  
  transfer: {
    keywords: ['transfer', 'send', 'move', 'pay'],
    patterns: [
      /(?:transfer|send)\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]+)/i,
      /pay\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]+)/i
    ],
    requiredParams: ['amount', 'token', 'address']
  },
  
  bridge: {
    keywords: ['bridge', 'cross-chain', 'move between'],
    patterns: [
      /bridge\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|from)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'token', 'targetChain']
  },
  
  lend: {
    keywords: ['lend', 'supply', 'provide'],
    patterns: [
      /(?:lend|supply)\s+(\d+\.?\d*)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'token']
  },
  
  borrow: {
    keywords: ['borrow', 'loan', 'take'],
    patterns: [
      /borrow\s+(\d+\.?\d*)\s+(\w+)/i
    ],
    requiredParams: ['amount', 'token']
  }
} as const

/**
 * Common token symbols and their variations
 */
export const TOKEN_ALIASES = {
  'FLOW': ['flow', 'flowtoken'],
  'USDC': ['usdc', 'usd-coin', 'usdcoin'],
  'USDT': ['usdt', 'tether', 'usdt-tether'],
  'FUSD': ['fusd', 'flow-usd'],
  'BTC': ['btc', 'bitcoin'],
  'ETH': ['eth', 'ethereum', 'ether'],
  'WETH': ['weth', 'wrapped-eth', 'wrapped-ethereum']
} as const

/**
 * Address validation patterns
 */
export const ADDRESS_PATTERNS = {
  flow: /^0x[a-fA-F0-9]{16}$/,
  ethereum: /^0x[a-fA-F0-9]{40}$/,
  bitcoin: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
} as const

/**
 * Amount validation patterns
 */
export const AMOUNT_PATTERNS = {
  decimal: /^\d+\.?\d*$/,
  scientific: /^\d+\.?\d*[eE][+-]?\d+$/,
  withCommas: /^\d{1,3}(,\d{3})*\.?\d*$/
} as const