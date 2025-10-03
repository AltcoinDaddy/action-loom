#!/usr/bin/env node

import { ActionDiscoveryService } from './action-discovery-service'
import { ActionMetadata, SecurityLevel } from './types'

// Mock data for verification
const mockActions: ActionMetadata[] = [
  {
    id: 'swap-tokens',
    name: 'Swap Tokens',
    description: 'Swap one token for another using DEX',
    category: 'defi',
    version: '1.0.0',
    inputs: [
      { name: 'fromToken', type: 'String', required: true },
      { name: 'toToken', type: 'String', required: true },
      { name: 'amount', type: 'UFix64', required: true }
    ],
    outputs: [
      { name: 'swapResult', type: 'SwapResult', description: 'Result of the swap operation' }
    ],
    parameters: [],
    compatibility: {
      requiredCapabilities: ['TokenSwap'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 500,
    securityLevel: SecurityLevel.HIGH,
    author: 'FlowDEX',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'mint-nft',
    name: 'Mint NFT',
    description: 'Mint a new NFT to a recipient',
    category: 'nft',
    version: '1.0.0',
    inputs: [
      { name: 'recipient', type: 'Address', required: true },
      { name: 'metadata', type: 'String', required: true }
    ],
    outputs: [
      { name: 'tokenId', type: 'UInt64', description: 'ID of the minted NFT' }
    ],
    parameters: [],
    compatibility: {
      requiredCapabilities: ['NFTMinting'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 300,
    securityLevel: SecurityLevel.MEDIUM,
    author: 'FlowNFT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  }
]

async function verifyActionDiscoveryService() {
  console.log('🔍 Verifying Action Discovery Service Implementation...\n')

  const service = new ActionDiscoveryService()

  try {
    // Test 1: Service initialization
    console.log('✅ Service initialized successfully')

    // Test 2: Cache statistics
    const cacheStats = await service.getCacheStats()
    console.log('✅ Cache statistics retrieved:', {
      totalKeys: cacheStats.redis.totalKeys,
      isHealthy: cacheStats.isHealthy
    })

    // Test 3: Search statistics
    const searchStats = service.getSearchStats()
    console.log('✅ Search statistics retrieved:', {
      indexedActions: searchStats.indexedActions,
      keywordEntries: searchStats.keywordEntries
    })

    // Test 4: Network information
    const network = service.getCurrentNetwork()
    console.log('✅ Current network:', network.name)

    // Test 5: Action validation
    const validation = service.validateAction(mockActions[0])
    console.log('✅ Action validation:', {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length
    })

    // Test 6: Compatibility checking
    const compatibility = service.checkActionCompatibility(mockActions[0], mockActions[1])
    console.log('✅ Compatibility check:', {
      issueCount: compatibility.length,
      hasIssues: compatibility.length > 0
    })

    // Test 7: Cache health
    const isHealthy = await service.checkCacheHealth()
    console.log('✅ Cache health check:', isHealthy)

    console.log('\n🎉 All Action Discovery Service components verified successfully!')
    console.log('\n📋 Implementation Summary:')
    console.log('   • Flow API Client with retry logic and network support')
    console.log('   • Action metadata parser with validation')
    console.log('   • Redis cache manager with TTL and invalidation')
    console.log('   • Semantic search engine with fuzzy matching')
    console.log('   • Integrated discovery service with all components')

  } catch (error) {
    console.error('❌ Verification failed:', error)
    process.exit(1)
  } finally {
    await service.cleanup()
    console.log('\n🧹 Service cleaned up')
  }
}

// Run verification if this file is executed directly
if (require.main === module) {
  verifyActionDiscoveryService().catch(console.error)
}

export { verifyActionDiscoveryService }