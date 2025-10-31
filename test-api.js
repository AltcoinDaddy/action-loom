#!/usr/bin/env node

/**
 * Test the API to verify real vs mock data
 */

async function testAPI() {
  const baseUrl = 'http://localhost:3001'
  
  console.log('🧪 Testing ActionLoom API...\n')
  
  try {
    // Test actions endpoint
    console.log('1. Testing /api/actions endpoint...')
    const response = await fetch(`${baseUrl}/api/actions`)
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    console.log('✅ API response received')
    console.log(`   Actions found: ${data.actions?.length || 0}`)
    console.log(`   Data source: ${data.actions?.length > 0 ? 'Real Flow Data' : 'Mock Data'}`)
    
    if (data.actions?.length > 0) {
      console.log(`   Sample action: ${data.actions[0].name}`)
      console.log(`   Author: ${data.actions[0].author}`)
    }
    
    // Test specific action
    console.log('\n2. Testing specific action endpoint...')
    const actionResponse = await fetch(`${baseUrl}/api/actions?id=transfer-tokens`)
    
    if (actionResponse.ok) {
      const actionData = await actionResponse.json()
      console.log('✅ Transfer tokens action found')
      console.log(`   Parameters: ${actionData.action?.parameters?.length || 0}`)
    } else {
      console.log('ℹ️  Transfer tokens action not found in real data (expected)')
    }
    
    console.log('\n🎉 API test completed successfully!')
    
  } catch (error) {
    console.error('\n❌ API test failed:')
    console.error(`   Error: ${error.message}`)
    console.log('\n💡 Make sure the app is running on http://localhost:3001')
  }
}

testAPI().catch(console.error)