import { FlowNetworkConfig } from '@/lib/types'

// Environment-based configuration
const getFlowConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production'
  const defaultNetwork = process.env.NEXT_PUBLIC_FLOW_NETWORK || 'testnet'
  
  return {
    defaultNetwork: defaultNetwork as 'testnet' | 'mainnet',
    isProduction,
    
    // API endpoints
    testnetAccessNode: process.env.NEXT_PUBLIC_FLOW_TESTNET_ACCESS_NODE || 'https://rest-testnet.onflow.org',
    mainnetAccessNode: process.env.NEXT_PUBLIC_FLOW_MAINNET_ACCESS_NODE || 'https://rest-mainnet.onflow.org',
    
    // Wallet discovery endpoints
    testnetWalletDiscovery: process.env.NEXT_PUBLIC_FLOW_TESTNET_WALLET_DISCOVERY || 'https://fcl-discovery.onflow.org/testnet/authn',
    mainnetWalletDiscovery: process.env.NEXT_PUBLIC_FLOW_MAINNET_WALLET_DISCOVERY || 'https://fcl-discovery.onflow.org/authn',
    
    // App details
    appTitle: process.env.NEXT_PUBLIC_APP_TITLE || 'ActionLoom',
    appIcon: process.env.NEXT_PUBLIC_APP_ICON || '/placeholder-logo.svg',
    
    // Feature flags
    enableMainnet: process.env.NEXT_PUBLIC_ENABLE_MAINNET === 'true',
    enableWalletConnect: process.env.NEXT_PUBLIC_ENABLE_WALLET_CONNECT !== 'false',
    
    // Timeouts and limits
    connectionTimeout: parseInt(process.env.NEXT_PUBLIC_FLOW_CONNECTION_TIMEOUT || '10000'),
    retryAttempts: parseInt(process.env.NEXT_PUBLIC_FLOW_RETRY_ATTEMPTS || '3'),
  }
}

// Create network configurations based on environment
export const createNetworkConfigs = (): { testnet: FlowNetworkConfig; mainnet: FlowNetworkConfig } => {
  const config = getFlowConfig()
  
  const testnet: FlowNetworkConfig = {
    name: 'Flow Testnet',
    chainId: 'flow-testnet',
    accessNode: config.testnetAccessNode,
    discoveryWallet: config.testnetWalletDiscovery,
    walletDiscovery: config.testnetWalletDiscovery,
    fclConfig: {
      'accessNode.api': config.testnetAccessNode,
      'discovery.wallet': config.testnetWalletDiscovery,
      'discovery.authn': config.testnetWalletDiscovery,
      'app.detail.title': config.appTitle,
      'app.detail.icon': config.appIcon
    }
  }
  
  const mainnet: FlowNetworkConfig = {
    name: 'Flow Mainnet',
    chainId: 'flow-mainnet',
    accessNode: config.mainnetAccessNode,
    discoveryWallet: config.mainnetWalletDiscovery,
    walletDiscovery: config.mainnetWalletDiscovery,
    fclConfig: {
      'accessNode.api': config.mainnetAccessNode,
      'discovery.wallet': config.mainnetWalletDiscovery,
      'discovery.authn': config.mainnetWalletDiscovery,
      'app.detail.title': config.appTitle,
      'app.detail.icon': config.appIcon
    }
  }
  
  return { testnet, mainnet }
}

// Export the configuration
export const flowConfig = getFlowConfig()

// Validation function for network configuration
export const validateNetworkConfig = (config: FlowNetworkConfig): boolean => {
  const requiredFields = [
    'name',
    'chainId', 
    'accessNode',
    'discoveryWallet',
    'walletDiscovery'
  ]
  
  const requiredFCLFields = [
    'accessNode.api',
    'discovery.wallet',
    'discovery.authn',
    'app.detail.title',
    'app.detail.icon'
  ]
  
  // Check main config fields
  for (const field of requiredFields) {
    if (!config[field as keyof FlowNetworkConfig]) {
      console.error(`Missing required field: ${field}`)
      return false
    }
  }
  
  // Check FCL config fields
  for (const field of requiredFCLFields) {
    if (!config.fclConfig[field as keyof typeof config.fclConfig]) {
      console.error(`Missing required FCL config field: ${field}`)
      return false
    }
  }
  
  // Validate URLs
  try {
    new URL(config.accessNode)
    new URL(config.discoveryWallet)
    new URL(config.walletDiscovery)
  } catch (err) {
    console.error('Invalid URL in network configuration:', err)
    return false
  }
  
  return true
}

// Helper function to get network by name
export const getNetworkByName = (name: 'testnet' | 'mainnet'): FlowNetworkConfig => {
  const networks = createNetworkConfigs()
  return networks[name]
}

// Helper function to determine if we're on mainnet
export const isMainnet = (network: FlowNetworkConfig): boolean => {
  return network.chainId === 'flow-mainnet'
}

// Helper function to determine if we're on testnet
export const isTestnet = (network: FlowNetworkConfig): boolean => {
  return network.chainId === 'flow-testnet'
}

// Legacy exports for backward compatibility
export const FLOW_NETWORKS = createNetworkConfigs()

export const DEFAULT_FLOW_CONFIG = flowConfig

// Flow Error Codes
export enum FlowErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  SCRIPT_EXECUTION_ERROR = 'SCRIPT_EXECUTION_ERROR',
  TRANSACTION_ERROR = 'TRANSACTION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

// Forte Constants
export const FORTE_CONSTANTS = {
  // Cache TTL values (in seconds)
  ACTION_CACHE_TTL: 3600, // 1 hour
  REGISTRY_CACHE_TTL: 1800, // 30 minutes
  ACCOUNT_CACHE_TTL: 300, // 5 minutes
  
  // Search and discovery limits
  MAX_SEARCH_RESULTS: 50,
  MAX_ACTIONS_PER_REGISTRY: 1000,
  MAX_REGISTRIES: 10,
  
  // Security thresholds
  MIN_SECURITY_SCORE: 70,
  MAX_SECURITY_ISSUES: 5,
  
  // Gas and transaction limits
  DEFAULT_GAS_LIMIT: 1000,
  MAX_GAS_LIMIT: 9999,
  MAX_TRANSACTION_SIZE: 1024 * 1024, // 1MB
  
  // Compatibility limits
  MAX_COMPATIBILITY_ISSUES: 3,
  MAX_DEPENDENCIES: 10,
  
  // API limits
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000,
  REQUEST_TIMEOUT_MS: 30000,
  
  // Validation limits
  MAX_PARAMETER_COUNT: 20,
  MAX_PARAMETER_NAME_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 500
}

// Legacy function aliases for backward compatibility
export const getFlowNetwork = getNetworkByName

export const checkNetworkHealth = async (network: FlowNetworkConfig): Promise<boolean> => {
  try {
    // Simple health check by trying to access the network endpoint
    const response = await fetch(`${network.accessNode}/v1/blocks?height=sealed`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    })
    return response.ok
  } catch (error) {
    console.error(`Network health check failed for ${network.name}:`, error)
    return false
  }
}