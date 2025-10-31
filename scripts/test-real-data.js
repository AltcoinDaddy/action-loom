#!/usr/bin/env node

/**
 * Test script to verify real Flow blockchain data connection
 */

// Define Flow networks directly since we can't import TypeScript modules
const FLOW_NETWORKS = {
  testnet: {
    name: 'Flow Testnet',
    endpoint: 'https://rest-testnet.onflow.org',
    chainId: 'flow-testnet'
  },
  mainnet: {
    name: 'Flow Mainnet',
    endpoint: 'https://rest-mainnet.onflow.org', 
    chainId: 'flow-mainnet'
  }
}

async function testFlowConnection() {
  console.log('🔍 Testing Flow blockchain connection...\n')
  
  const network = process.env.FLOW_NETWORK || 'testnet'
  const flowNetwork = FLOW_NETWORKS[network]
  
  if (!flowNetwork) {
    console.error(`❌ Unknown network: ${network}`)
    process.exit(1)
  }
  
  console.log(`📡 Testing ${flowNetwork.name}`)
  console.log(`🌐 Endpoint: ${flowNetwork.endpoint}`)
  
  try {
    // Test basic network connectivity
    console.log('\n1. Testing network parameters...')
    const response = await fetch(`${flowNetwork.endpoint}/v1/network/parameters`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const networkParams = await response.json()
    console.log('✅ Network parameters retrieved successfully')
    console.log(`   Chain ID: ${networkParams.chain_id || 'Unknown'}`)
    
    // Test blocks endpoint
    console.log('\n2. Testing latest block...')
    const blockResponse = await fetch(`${flowNetwork.endpoint}/v1/blocks?height=sealed`)
    
    if (!blockResponse.ok) {
      throw new Error(`HTTP ${blockResponse.status}: ${blockResponse.statusText}`)
    }
    
    const blocks = await blockResponse.json()
    console.log('✅ Latest block retrieved successfully')
    console.log(`   Block height: ${blocks[0]?.header?.height || 'Unknown'}`)
    
    // Test accounts endpoint (using a known service account)
    console.log('\n3. Testing accounts endpoint...')
    const serviceAccount = network === 'mainnet' ? '0x1654653399040a61' : '0x7e60df042a9c0868'
    const accountResponse = await fetch(`${flowNetwork.endpoint}/v1/accounts/${serviceAccount}`)
    
    if (!accountResponse.ok) {
      throw new Error(`HTTP ${accountResponse.status}: ${accountResponse.statusText}`)
    }
    
    const account = await accountResponse.json()
    console.log('✅ Account data retrieved successfully')
    console.log(`   Balance: ${account.balance || 'Unknown'} FLOW`)
    
    console.log('\n🎉 All tests passed! Real Flow data connection is working.')
    console.log('\n💡 You can now use real Flow blockchain data in your app.')
    
  } catch (error) {
    console.error('\n❌ Connection test failed:')
    console.error(`   Error: ${error.message}`)
    console.log('\n🔧 Troubleshooting:')
    console.log('   1. Check your internet connection')
    console.log('   2. Verify the Flow network is operational')
    console.log('   3. Try switching to a different network (testnet/mainnet)')
    process.exit(1)
  }
}

// Run the test
testFlowConnection().catch(console.error)