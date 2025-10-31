import * as fcl from '@onflow/fcl'
import { flowConfig, createNetworkConfigs } from '@/lib/flow-config'

// Initialize FCL with default configuration
export const initializeFCL = () => {
  const networks = createNetworkConfigs()
  const defaultNetwork = networks[flowConfig.defaultNetwork]
  
  try {
    // Configure FCL with default network
    fcl.config(defaultNetwork.fclConfig)
    
    console.log(`FCL initialized with ${defaultNetwork.name}`)
    console.log('FCL Configuration:', {
      network: defaultNetwork.name,
      accessNode: defaultNetwork.fclConfig['accessNode.api'],
      walletDiscovery: defaultNetwork.fclConfig['discovery.wallet']
    })
    
    return true
  } catch (error) {
    console.error('Failed to initialize FCL:', error)
    return false
  }
}

// Get current FCL configuration
export const getFCLConfig = () => {
  return {
    accessNode: fcl.config().get('accessNode.api'),
    walletDiscovery: fcl.config().get('discovery.wallet'),
    appTitle: fcl.config().get('app.detail.title'),
    appIcon: fcl.config().get('app.detail.icon')
  }
}

// Utility to check if FCL is properly configured
export const isFCLConfigured = (): boolean => {
  try {
    const config = getFCLConfig()
    return !!(config.accessNode && config.walletDiscovery)
  } catch {
    return false
  }
}

// Export for use in other modules
export { fcl }