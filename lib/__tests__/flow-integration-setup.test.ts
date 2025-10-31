import { describe, it, expect, beforeEach } from 'vitest'
import { createNetworkConfigs, validateNetworkConfig, flowConfig } from '@/lib/flow-config'
import { initializeFCL, isFCLConfigured } from '@/lib/flow-init'

describe('Flow Integration Setup', () => {
  beforeEach(() => {
    // Reset any previous FCL configuration
    // Note: FCL doesn't provide a reset method, so we'll just ensure clean state
  })

  describe('Network Configuration', () => {
    it('should create valid network configurations', () => {
      const networks = createNetworkConfigs()
      
      expect(networks).toHaveProperty('testnet')
      expect(networks).toHaveProperty('mainnet')
      
      // Validate testnet config
      expect(networks.testnet.name).toBe('Flow Testnet')
      expect(networks.testnet.chainId).toBe('flow-testnet')
      expect(networks.testnet.accessNode).toContain('testnet')
      
      // Validate mainnet config
      expect(networks.mainnet.name).toBe('Flow Mainnet')
      expect(networks.mainnet.chainId).toBe('flow-mainnet')
      expect(networks.mainnet.accessNode).toContain('mainnet')
    })

    it('should validate network configurations', () => {
      const networks = createNetworkConfigs()
      
      expect(validateNetworkConfig(networks.testnet)).toBe(true)
      expect(validateNetworkConfig(networks.mainnet)).toBe(true)
    })

    it('should reject invalid network configurations', () => {
      const invalidConfig = {
        name: '',
        chainId: '',
        accessNode: 'invalid-url',
        discoveryWallet: '',
        walletDiscovery: '',
        fclConfig: {
          'accessNode.api': '',
          'discovery.wallet': '',
          'discovery.authn': '',
          'app.detail.title': '',
          'app.detail.icon': ''
        }
      }
      
      expect(validateNetworkConfig(invalidConfig as any)).toBe(false)
    })
  })

  describe('Flow Configuration', () => {
    it('should have valid default configuration', () => {
      expect(flowConfig.defaultNetwork).toMatch(/^(testnet|mainnet)$/)
      expect(flowConfig.appTitle).toBe('ActionLoom')
      expect(flowConfig.connectionTimeout).toBeGreaterThan(0)
      expect(flowConfig.retryAttempts).toBeGreaterThan(0)
    })

    it('should have valid network endpoints', () => {
      expect(flowConfig.testnetAccessNode).toContain('testnet')
      expect(flowConfig.mainnetAccessNode).toContain('mainnet')
      
      // Should be valid URLs
      expect(() => new URL(flowConfig.testnetAccessNode)).not.toThrow()
      expect(() => new URL(flowConfig.mainnetAccessNode)).not.toThrow()
    })
  })

  describe('FCL Initialization', () => {
    it('should initialize FCL successfully', () => {
      const result = initializeFCL()
      expect(result).toBe(true)
    })

    it('should report FCL as configured after initialization', () => {
      initializeFCL()
      expect(isFCLConfigured()).toBe(true)
    })
  })

  describe('Environment Variables', () => {
    it('should use environment variables when available', () => {
      // Test that config reads from environment
      expect(flowConfig.testnetAccessNode).toBeDefined()
      expect(flowConfig.mainnetAccessNode).toBeDefined()
      expect(flowConfig.appTitle).toBeDefined()
    })
  })
})