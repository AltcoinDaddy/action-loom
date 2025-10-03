import { FlowNetwork } from './types'

/**
 * Flow network configurations
 */
export const FLOW_NETWORKS: Record<string, FlowNetwork> = {
  testnet: {
    name: 'Flow Testnet',
    endpoint: 'https://rest-testnet.onflow.org',
    chainId: 'flow-testnet'
  },
  mainnet: {
    name: 'Flow Mainnet',
    endpoint: 'https://rest-mainnet.onflow.org', 
    chainId: 'flow-mainnet'
  },
  emulator: {
    name: 'Flow Emulator',
    endpoint: 'http://localhost:8888',
    chainId: 'flow-emulator'
  }
}

/**
 * Default Flow configuration
 */
export const DEFAULT_FLOW_CONFIG = {
  network: FLOW_NETWORKS.testnet,
  timeout: 30000,
  retryAttempts: 3
}

/**
 * Forte-specific constants
 */
export const FORTE_CONSTANTS = {
  // Registry contract addresses (these would be actual addresses in production)
  ACTION_REGISTRY_ADDRESS: '0x1234567890abcdef',
  AGENT_REGISTRY_ADDRESS: '0xabcdef1234567890',
  
  // Default gas limits
  DEFAULT_GAS_LIMIT: 1000,
  MAX_GAS_LIMIT: 9999,
  
  // Cache TTL values (in seconds)
  ACTION_CACHE_TTL: 3600, // 1 hour
  REGISTRY_CACHE_TTL: 1800, // 30 minutes
  
  // Search configuration
  MAX_SEARCH_RESULTS: 50,
  SEARCH_TIMEOUT: 5000,
  
  // Validation thresholds
  MIN_SECURITY_SCORE: 70,
  MAX_COMPATIBILITY_ISSUES: 5
}

/**
 * Error codes for Flow operations
 */
export enum FlowErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SCRIPT_EXECUTION_ERROR = 'SCRIPT_EXECUTION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'
}

/**
 * Utility function to get network by name
 */
export function getFlowNetwork(networkName: string): FlowNetwork {
  const network = FLOW_NETWORKS[networkName.toLowerCase()]
  if (!network) {
    throw new Error(`Unknown Flow network: ${networkName}`)
  }
  return network
}

/**
 * Utility function to validate network configuration
 */
export function validateNetworkConfig(network: FlowNetwork): boolean {
  return !!(network.name && network.endpoint && network.chainId)
}

/**
 * Utility function to check if network is available
 */
export async function checkNetworkHealth(network: FlowNetwork): Promise<boolean> {
  try {
    const response = await fetch(`${network.endpoint}/v1/network/parameters`, {
      method: 'GET',
      timeout: 5000
    })
    return response.ok
  } catch (error) {
    console.error(`Network health check failed for ${network.name}:`, error)
    return false
  }
}