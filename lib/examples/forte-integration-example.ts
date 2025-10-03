/**
 * Example usage of Forte Integration
 * 
 * This example demonstrates how to use the new Forte integration features
 * for Action discovery and workflow composition.
 */

import { 
  createForteIntegration,
  validateForteAction,
  parseForteMetadata,
  FLOW_NETWORKS,
  FlowErrorHandler
} from '../forte-integration'

/**
 * Example: Basic Forte Integration Setup
 */
export async function basicIntegrationExample() {
  console.log('🚀 Setting up Forte Integration...')
  
  // Create integration instance
  const integration = createForteIntegration({
    network: FLOW_NETWORKS.testnet,
    apiKey: process.env.FLOW_API_KEY // Optional API key
  })

  try {
    // Discover available Actions
    console.log('🔍 Discovering Actions...')
    const actions = await integration.discoveryService.discoverActions()
    console.log(`Found ${actions.length} Actions`)

    // Search for specific Actions
    console.log('🔎 Searching for swap Actions...')
    const swapActions = await integration.discoveryService.searchActions('swap')
    console.log(`Found ${swapActions.length} swap Actions`)

    // Get specific Action by ID
    if (actions.length > 0) {
      const firstAction = await integration.discoveryService.getActionById(actions[0].id)
      console.log(`Retrieved Action: ${firstAction?.name}`)
    }

  } catch (error) {
    const flowError = FlowErrorHandler.handleAPIError(error)
    console.error('❌ Error:', FlowErrorHandler.formatUserError(flowError))
  }
}

/**
 * Example: Action Validation
 */
export function actionValidationExample() {
  console.log('✅ Validating Forte Action...')

  // Example raw metadata from Flow network
  const rawMetadata = {
    id: 'swap-tokens-v1',
    name: 'Token Swap',
    description: 'Swap one token for another using a DEX',
    version: '1.2.0',
    category: 'defi',
    inputs: [
      { name: 'tokenIn', type: 'String', required: true },
      { name: 'tokenOut', type: 'String', required: true },
      { name: 'amountIn', type: 'UFix64', required: true },
      { name: 'minAmountOut', type: 'UFix64', required: true }
    ],
    outputs: [
      { name: 'amountOut', type: 'UFix64' },
      { name: 'transactionId', type: 'String' }
    ],
    gasEstimate: 2500,
    securityLevel: 'high',
    author: 'FlowDEX',
    compatibility: {
      requiredCapabilities: ['TokenSwap'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    }
  }

  // Parse metadata
  const metadata = parseForteMetadata(rawMetadata)
  if (!metadata) {
    console.error('❌ Failed to parse metadata')
    return
  }

  console.log(`📋 Parsed Action: ${metadata.name} v${metadata.version}`)

  // Create ForteAction (this would normally come from discovery)
  const forteAction = {
    ...metadata,
    contractAddress: '0x1234567890abcdef',
    securityAudit: {
      status: 'passed' as const,
      score: 92,
      findings: [],
      auditedAt: '2024-01-15T10:00:00Z',
      auditor: 'FlowSecurity'
    },
    dependencies: ['token-registry-v1'],
    tags: ['defi', 'swap', 'dex']
  }

  // Validate the Action
  const validation = validateForteAction(forteAction)
  
  if (validation.isValid) {
    console.log('✅ Action is valid and secure')
  } else {
    console.log('❌ Action validation failed:')
    validation.errors.forEach(error => {
      console.log(`  - ${error.message}`)
    })
  }

  if (validation.warnings.length > 0) {
    console.log('⚠️  Warnings:')
    validation.warnings.forEach(warning => {
      console.log(`  - ${warning}`)
    })
  }
}

/**
 * Example: Workflow Composition with Forte Actions
 */
export async function workflowCompositionExample() {
  console.log('🔧 Composing workflow with Forte Actions...')

  const integration = createForteIntegration()

  try {
    // Discover Actions for a DeFi workflow
    const allActions = await integration.discoveryService.discoverActions()
    
    // Find specific Actions for our workflow
    const swapAction = allActions.find(a => a.name.toLowerCase().includes('swap'))
    const stakeAction = allActions.find(a => a.name.toLowerCase().includes('stake'))
    
    if (!swapAction || !stakeAction) {
      console.log('❌ Required Actions not found')
      return
    }

    // Validate workflow compatibility
    const workflowActions = [swapAction, stakeAction]
    const compatibility = await integration.discoveryService.validateCompatibility(workflowActions)

    if (compatibility.isValid) {
      console.log('✅ Workflow Actions are compatible')
      console.log('🎯 Ready to generate Cadence code and deploy')
    } else {
      console.log('❌ Workflow compatibility issues:')
      compatibility.compatibilityIssues.forEach(issue => {
        console.log(`  - ${issue.issue}`)
        console.log(`    Suggestion: ${issue.suggestion}`)
      })
    }

  } catch (error) {
    console.error('❌ Workflow composition failed:', error)
  }
}

/**
 * Example: Error Handling
 */
export async function errorHandlingExample() {
  console.log('🛡️  Testing error handling...')

  const integration = createForteIntegration({
    network: {
      name: 'Invalid Network',
      endpoint: 'https://invalid-endpoint.example.com',
      chainId: 'invalid'
    }
  })

  try {
    await integration.discoveryService.discoverActions()
  } catch (error) {
    const flowError = FlowErrorHandler.handleAPIError(error)
    
    console.log(`Error Type: ${flowError.code}`)
    console.log(`User Message: ${FlowErrorHandler.formatUserError(flowError)}`)
    console.log(`Recoverable: ${FlowErrorHandler.isRecoverable(flowError)}`)
    
    if (FlowErrorHandler.isRecoverable(flowError)) {
      const retryDelay = FlowErrorHandler.getRetryDelay(1)
      console.log(`Retry in ${retryDelay}ms`)
    }
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('🎬 Running Forte Integration Examples...\n')
  
  try {
    await basicIntegrationExample()
    console.log('\n' + '='.repeat(50) + '\n')
    
    actionValidationExample()
    console.log('\n' + '='.repeat(50) + '\n')
    
    await workflowCompositionExample()
    console.log('\n' + '='.repeat(50) + '\n')
    
    await errorHandlingExample()
    
    console.log('\n✨ All examples completed!')
    
  } catch (error) {
    console.error('❌ Example execution failed:', error)
  }
}

// Export for use in other files
export default {
  basicIntegrationExample,
  actionValidationExample,
  workflowCompositionExample,
  errorHandlingExample,
  runAllExamples
}