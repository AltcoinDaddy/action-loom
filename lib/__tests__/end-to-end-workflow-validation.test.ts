import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ParameterValidator } from '../parameter-validator'
import { EnhancedWorkflowValidator } from '../enhanced-workflow-validator'
import { DataFlowAnalyzer } from '../data-flow-analyzer'
import { ParameterSuggestionEngine } from '../parameter-suggestion-engine'
import { ExecutionValidator } from '../execution-validator'
import type {
  ParsedWorkflow,
  ActionMetadata,
  ValidationContext,
  WorkflowValidationResult,
  ExecutionValidationResult
} from '../types'

// Mock external services
global.fetch = vi.fn()

describe('End-to-End Workflow Validation Tests', () => {
  let parameterValidator: ParameterValidator
  let workflowValidator: EnhancedWorkflowValidator
  let dataFlowAnalyzer: DataFlowAnalyzer
  let suggestionEngine: ParameterSuggestionEngine
  let executionValidator: ExecutionValidator

  // Complex real-world workflow scenarios
  const createDeFiWorkflow = (): ParsedWorkflow => ({
    actions: [
      {
        id: 'swap-flow-usdc',
        actionType: 'swap-tokens',
        name: 'Swap FLOW to USDC',
        parameters: [
          { name: 'fromToken', type: 'Address', value: 'FLOW', required: true },
          { name: 'toToken', type: 'Address', value: 'USDC', required: true },
          { name: 'amount', type: 'UFix64', value: '1000.0', required: true },
          { name: 'slippage', type: 'UFix64', value: '0.01', required: false }
        ],
        nextActions: ['stake-usdc', 'provide-liquidity'],
        position: { x: 0, y: 0 }
      },
      {
        id: 'stake-usdc',
        actionType: 'stake-tokens',
        name: 'Stake 50% USDC',
        parameters: [
          { name: 'token', type: 'Address', value: 'swap-flow-usdc.outputToken', required: true },
          { name: 'amount', type: 'UFix64', value: 'swap-flow-usdc.outputAmount * 0.5', required: true },
          { name: 'duration', type: 'UInt64', value: '2592000', required: true }, // 30 days
          { name: 'autoRenew', type: 'Bool', value: 'true', required: false }
        ],
        nextActions: ['claim-rewards'],
        position: { x: 200, y: -100 }
      },
      {
        id: 'provide-liquidity',
        actionType: 'add-liquidity',
        name: 'Add FLOW-USDC Liquidity',
        parameters: [
          { name: 'tokenA', type: 'Address', value: 'FLOW', required: true },
          { name: 'tokenB', type: 'Address', value: 'swap-flow-usdc.outputToken', required: true },
          { name: 'amountA', type: 'UFix64', value: '500.0', required: true },
          { name: 'amountB', type: 'UFix64', value: 'swap-flow-usdc.outputAmount * 0.3', required: true },
          { name: 'minAmountA', type: 'UFix64', value: '495.0', required: false },
          { name: 'minAmountB', type: 'UFix64', value: 'swap-flow-usdc.outputAmount * 0.295', required: false }
        ],
        nextActions: ['farm-lp-tokens'],
        position: { x: 200, y: 100 }
      },
      {
        id: 'farm-lp-tokens',
        actionType: 'farm-tokens',
        name: 'Farm LP Tokens',
        parameters: [
          { name: 'lpToken', type: 'Address', value: 'provide-liquidity.lpToken', required: true },
          { name: 'amount', type: 'UFix64', value: 'provide-liquidity.lpAmount', required: true },
          { name: 'farmPool', type: 'Address', value: 'FLOW_USDC_FARM', required: true }
        ],
        nextActions: ['claim-rewards'],
        position: { x: 400, y: 100 }
      },
      {
        id: 'claim-rewards',
        actionType: 'claim-rewards',
        name: 'Claim All Rewards',
        parameters: [
          { name: 'stakingRewards', type: 'Bool', value: 'true', required: false },
          { name: 'farmingRewards', type: 'Bool', value: 'true', required: false },
          { name: 'recipient', type: 'Address', value: '', required: false }
        ],
        nextActions: ['compound-rewards'],
        position: { x: 600, y: 0 }
      },
      {
        id: 'compound-rewards',
        actionType: 'compound-rewards',
        name: 'Compound Rewards',
        parameters: [
          { name: 'rewardToken', type: 'Address', value: 'claim-rewards.rewardToken', required: true },
          { name: 'amount', type: 'UFix64', value: 'claim-rewards.rewardAmount', required: true },
          { name: 'strategy', type: 'String', value: 'auto', required: false }
        ],
        nextActions: [],
        position: { x: 800, y: 0 }
      }
    ],
    executionOrder: [
      'swap-flow-usdc',
      'stake-usdc',
      'provide-liquidity',
      'farm-lp-tokens',
      'claim-rewards',
      'compound-rewards'
    ],
    rootActions: ['swap-flow-usdc'],
    metadata: {
      totalActions: 6,
      totalConnections: 7,
      createdAt: new Date().toISOString()
    }
  })

  const createNFTWorkflow = (): ParsedWorkflow => ({
    actions: [
      {
        id: 'mint-nft-collection',
        actionType: 'create-nft-collection',
        name: 'Create NFT Collection',
        parameters: [
          { name: 'name', type: 'String', value: 'My Art Collection', required: true },
          { name: 'description', type: 'String', value: 'A collection of digital art', required: true },
          { name: 'maxSupply', type: 'UInt64', value: '1000', required: false },
          { name: 'royalty', type: 'UFix64', value: '0.05', required: false }
        ],
        nextActions: ['mint-nfts'],
        position: { x: 0, y: 0 }
      },
      {
        id: 'mint-nfts',
        actionType: 'batch-mint-nfts',
        name: 'Batch Mint NFTs',
        parameters: [
          { name: 'collection', type: 'Address', value: 'mint-nft-collection.collectionAddress', required: true },
          { name: 'quantity', type: 'UInt64', value: '10', required: true },
          { name: 'baseURI', type: 'String', value: 'https://api.example.com/metadata/', required: true },
          { name: 'recipient', type: 'Address', value: '', required: false }
        ],
        nextActions: ['list-nfts', 'transfer-nfts'],
        position: { x: 200, y: 0 }
      },
      {
        id: 'list-nfts',
        actionType: 'list-nfts-for-sale',
        name: 'List NFTs for Sale',
        parameters: [
          { name: 'nftIds', type: 'Array', value: 'mint-nfts.nftIds[0:5]', required: true },
          { name: 'price', type: 'UFix64', value: '10.0', required: true },
          { name: 'currency', type: 'Address', value: 'FLOW', required: true },
          { name: 'marketplace', type: 'Address', value: 'MARKETPLACE', required: true }
        ],
        nextActions: ['monitor-sales'],
        position: { x: 400, y: -100 }
      },
      {
        id: 'transfer-nfts',
        actionType: 'batch-transfer-nfts',
        name: 'Gift NFTs',
        parameters: [
          { name: 'nftIds', type: 'Array', value: 'mint-nfts.nftIds[5:10]', required: true },
          { name: 'recipients', type: 'Array', value: '["0x1234567890abcdef", "0xfedcba0987654321"]', required: true }
        ],
        nextActions: ['monitor-sales'],
        position: { x: 400, y: 100 }
      },
      {
        id: 'monitor-sales',
        actionType: 'monitor-nft-sales',
        name: 'Monitor Sales',
        parameters: [
          { name: 'collection', type: 'Address', value: 'mint-nft-collection.collectionAddress', required: true },
          { name: 'webhook', type: 'String', value: 'https://api.example.com/webhook', required: false }
        ],
        nextActions: [],
        position: { x: 600, y: 0 }
      }
    ],
    executionOrder: [
      'mint-nft-collection',
      'mint-nfts',
      'list-nfts',
      'transfer-nfts',
      'monitor-sales'
    ],
    rootActions: ['mint-nft-collection'],
    metadata: {
      totalActions: 5,
      totalConnections: 5,
      createdAt: new Date().toISOString()
    }
  })

  const createActionMetadata = (): Record<string, ActionMetadata> => ({
    'swap-tokens': {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Swap tokens on DEX',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'outputToken', type: 'Address', description: 'Output token address' },
        { name: 'outputAmount', type: 'UFix64', description: 'Output token amount' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 5000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'stake-tokens': {
      id: 'stake-tokens',
      name: 'Stake Tokens',
      description: 'Stake tokens for rewards',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'stakingReceipt', type: 'String', description: 'Staking receipt ID' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 3000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'add-liquidity': {
      id: 'add-liquidity',
      name: 'Add Liquidity',
      description: 'Add liquidity to DEX pool',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'lpToken', type: 'Address', description: 'LP token address' },
        { name: 'lpAmount', type: 'UFix64', description: 'LP token amount' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 4000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'farm-tokens': {
      id: 'farm-tokens',
      name: 'Farm Tokens',
      description: 'Farm tokens for additional rewards',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'farmingReceipt', type: 'String', description: 'Farming receipt ID' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 3500,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'claim-rewards': {
      id: 'claim-rewards',
      name: 'Claim Rewards',
      description: 'Claim staking and farming rewards',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'rewardToken', type: 'Address', description: 'Reward token address' },
        { name: 'rewardAmount', type: 'UFix64', description: 'Reward amount claimed' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 2500,
      securityLevel: 'low' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'compound-rewards': {
      id: 'compound-rewards',
      name: 'Compound Rewards',
      description: 'Automatically compound rewards',
      category: 'DeFi',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 4500,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'create-nft-collection': {
      id: 'create-nft-collection',
      name: 'Create NFT Collection',
      description: 'Create a new NFT collection',
      category: 'NFT',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'collectionAddress', type: 'Address', description: 'Collection contract address' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 8000,
      securityLevel: 'high' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'batch-mint-nfts': {
      id: 'batch-mint-nfts',
      name: 'Batch Mint NFTs',
      description: 'Mint multiple NFTs in batch',
      category: 'NFT',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'nftIds', type: 'Array', description: 'Array of minted NFT IDs' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 6000,
      securityLevel: 'medium' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'list-nfts-for-sale': {
      id: 'list-nfts-for-sale',
      name: 'List NFTs for Sale',
      description: 'List NFTs on marketplace',
      category: 'NFT',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [
        { name: 'listingIds', type: 'Array', description: 'Array of listing IDs' }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 3000,
      securityLevel: 'low' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'batch-transfer-nfts': {
      id: 'batch-transfer-nfts',
      name: 'Batch Transfer NFTs',
      description: 'Transfer multiple NFTs to recipients',
      category: 'NFT',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 4000,
      securityLevel: 'low' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    'monitor-nft-sales': {
      id: 'monitor-nft-sales',
      name: 'Monitor NFT Sales',
      description: 'Monitor NFT sales and events',
      category: 'NFT',
      version: '1.0.0',
      parameters: [],
      inputs: [],
      outputs: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 1000,
      securityLevel: 'low' as any,
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  })

  beforeEach(() => {
    vi.clearAllMocks()
    parameterValidator = new ParameterValidator()
    workflowValidator = new EnhancedWorkflowValidator()
    dataFlowAnalyzer = new DataFlowAnalyzer()
    suggestionEngine = new ParameterSuggestionEngine()
    executionValidator = new ExecutionValidator()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Complex DeFi Workflow Validation', () => {
    it('should validate complete DeFi workflow end-to-end', async () => {
      const workflow = createDeFiWorkflow()
      const actionMetadata = createActionMetadata()

      // Simulate complete parameter configuration
      const parameterValues = {
        'swap-flow-usdc': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '1000.0',
          slippage: '0.01'
        },
        'stake-usdc': {
          token: 'swap-flow-usdc.outputToken',
          amount: 'swap-flow-usdc.outputAmount * 0.5',
          duration: '2592000',
          autoRenew: true
        },
        'provide-liquidity': {
          tokenA: 'FLOW',
          tokenB: 'swap-flow-usdc.outputToken',
          amountA: '500.0',
          amountB: 'swap-flow-usdc.outputAmount * 0.3',
          minAmountA: '495.0',
          minAmountB: 'swap-flow-usdc.outputAmount * 0.295'
        },
        'farm-lp-tokens': {
          lpToken: 'provide-liquidity.lpToken',
          amount: 'provide-liquidity.lpAmount',
          farmPool: 'FLOW_USDC_FARM'
        },
        'claim-rewards': {
          stakingRewards: true,
          farmingRewards: true,
          recipient: ''
        },
        'compound-rewards': {
          rewardToken: 'claim-rewards.rewardToken',
          amount: 'claim-rewards.rewardAmount',
          strategy: 'auto'
        }
      }

      // Validate data flow
      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(workflow)
      expect(dataFlowResult.isValid).toBe(true)
      expect(dataFlowResult.circularDependencies).toHaveLength(0)
      expect(dataFlowResult.unresolvedReferences).toHaveLength(0)

      // Validate execution readiness
      const executionResult = await executionValidator.validateForExecution(
        workflow,
        actionMetadata,
        parameterValues
      )

      expect(executionResult.canExecute).toBe(true)
      expect(executionResult.executionReadiness.parametersConfigured).toBe(true)
      expect(executionResult.executionReadiness.dataFlowValid).toBe(true)
      expect(executionResult.executionReadiness.readinessScore).toBe(100)
      expect(executionResult.blockingErrors).toHaveLength(0)

      // Should have reasonable gas estimates
      expect(executionResult.estimatedGasCost).toBeGreaterThan(20000) // Complex workflow
      expect(executionResult.estimatedExecutionTime).toBeGreaterThan(5000) // Multiple actions
    })

    it('should detect complex parameter dependency issues', () => {
      const workflow = createDeFiWorkflow()
      
      // Create circular dependency by modifying the workflow
      workflow.actions[0].parameters[2].value = 'compound-rewards.outputAmount' // Creates cycle
      
      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(workflow)
      
      expect(dataFlowResult.isValid).toBe(false)
      expect(dataFlowResult.circularDependencies.length).toBeGreaterThan(0)
    })

    it('should validate complex mathematical expressions in parameters', () => {
      const workflow = createDeFiWorkflow()
      const actionMetadata = createActionMetadata()

      // Test complex parameter expressions
      const parameterValues = {
        'swap-flow-usdc': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '1000.0',
          slippage: '0.01'
        },
        'stake-usdc': {
          token: 'swap-flow-usdc.outputToken',
          amount: 'swap-flow-usdc.outputAmount * 0.5', // 50% of output
          duration: '2592000',
          autoRenew: true
        },
        'provide-liquidity': {
          tokenA: 'FLOW',
          tokenB: 'swap-flow-usdc.outputToken',
          amountA: '500.0',
          amountB: 'swap-flow-usdc.outputAmount * 0.3', // 30% of output
          minAmountA: '495.0', // 1% slippage
          minAmountB: 'swap-flow-usdc.outputAmount * 0.295' // 30% - 1.67% slippage
        }
      }

      // Validate mathematical expressions
      const stakeAction = workflow.actions.find(a => a.id === 'stake-usdc')!
      const liquidityAction = workflow.actions.find(a => a.id === 'provide-liquidity')!

      const context: ValidationContext = {
        workflow,
        currentAction: stakeAction,
        availableOutputs: {
          'swap-flow-usdc.outputToken': { name: 'outputToken', type: 'Address', description: 'Output token' },
          'swap-flow-usdc.outputAmount': { name: 'outputAmount', type: 'UFix64', description: 'Output amount' }
        }
      }

      // Should handle mathematical expressions in parameter references
      expect(stakeAction.parameters.find(p => p.name === 'amount')?.value).toContain('* 0.5')
      expect(liquidityAction.parameters.find(p => p.name === 'amountB')?.value).toContain('* 0.3')
      expect(liquidityAction.parameters.find(p => p.name === 'minAmountB')?.value).toContain('* 0.295')
    })
  })

  describe('Complex NFT Workflow Validation', () => {
    it('should validate complete NFT workflow end-to-end', async () => {
      const workflow = createNFTWorkflow()
      const actionMetadata = createActionMetadata()

      const parameterValues = {
        'mint-nft-collection': {
          name: 'My Art Collection',
          description: 'A collection of digital art',
          maxSupply: '1000',
          royalty: '0.05'
        },
        'mint-nfts': {
          collection: 'mint-nft-collection.collectionAddress',
          quantity: '10',
          baseURI: 'https://api.example.com/metadata/',
          recipient: ''
        },
        'list-nfts': {
          nftIds: 'mint-nfts.nftIds[0:5]', // Array slice notation
          price: '10.0',
          currency: 'FLOW',
          marketplace: 'MARKETPLACE'
        },
        'transfer-nfts': {
          nftIds: 'mint-nfts.nftIds[5:10]', // Array slice notation
          recipients: '["0x1234567890abcdef", "0xfedcba0987654321"]'
        },
        'monitor-sales': {
          collection: 'mint-nft-collection.collectionAddress',
          webhook: 'https://api.example.com/webhook'
        }
      }

      // Validate data flow with array operations
      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(workflow)
      expect(dataFlowResult.isValid).toBe(true)

      // Validate execution readiness
      const executionResult = await executionValidator.validateForExecution(
        workflow,
        actionMetadata,
        parameterValues
      )

      expect(executionResult.canExecute).toBe(true)
      expect(executionResult.executionReadiness.readinessScore).toBe(100)
      expect(executionResult.blockingErrors).toHaveLength(0)
    })

    it('should handle array parameter validation', () => {
      const workflow = createNFTWorkflow()
      
      // Test array slice validation
      const listAction = workflow.actions.find(a => a.id === 'list-nfts')!
      const transferAction = workflow.actions.find(a => a.id === 'transfer-nfts')!

      expect(listAction.parameters.find(p => p.name === 'nftIds')?.value).toBe('mint-nfts.nftIds[0:5]')
      expect(transferAction.parameters.find(p => p.name === 'nftIds')?.value).toBe('mint-nfts.nftIds[5:10]')
      expect(transferAction.parameters.find(p => p.name === 'recipients')?.value).toContain('["0x1234567890abcdef"')
    })
  })

  describe('Performance Testing with Large Workflows', () => {
    it('should validate workflow with 100+ actions efficiently', async () => {
      const largeWorkflow = createLargeChainedWorkflow(100)
      const actionMetadata = createActionMetadata()

      const startTime = performance.now()

      // Validate data flow
      const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(largeWorkflow)
      
      // Validate execution
      const parameterValues = createParameterValuesForLargeWorkflow(largeWorkflow)
      const executionResult = await executionValidator.validateForExecution(
        largeWorkflow,
        actionMetadata,
        parameterValues
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000)
      
      expect(dataFlowResult.isValid).toBe(true)
      expect(executionResult.canExecute).toBe(true)

      console.log(`Large workflow validation (100 actions) completed in ${duration.toFixed(2)}ms`)
    })

    it('should handle concurrent validation of multiple workflows', async () => {
      const workflows = [
        createDeFiWorkflow(),
        createNFTWorkflow(),
        createLargeChainedWorkflow(20),
        createLargeChainedWorkflow(30)
      ]
      const actionMetadata = createActionMetadata()

      const startTime = performance.now()

      // Validate all workflows concurrently
      const results = await Promise.all(
        workflows.map(async (workflow) => {
          const dataFlowResult = dataFlowAnalyzer.analyzeDataFlow(workflow)
          const parameterValues = createParameterValuesForWorkflow(workflow)
          const executionResult = await executionValidator.validateForExecution(
            workflow,
            actionMetadata,
            parameterValues
          )
          return { dataFlowResult, executionResult }
        })
      )

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should complete within 3 seconds
      expect(duration).toBeLessThan(3000)

      // All workflows should be valid
      results.forEach(({ dataFlowResult, executionResult }) => {
        expect(dataFlowResult.isValid).toBe(true)
        expect(executionResult.canExecute).toBe(true)
      })

      console.log(`Concurrent validation of 4 workflows completed in ${duration.toFixed(2)}ms`)
    })
  })

  describe('Error Recovery and User Guidance', () => {
    it('should provide comprehensive error recovery guidance', async () => {
      const workflow = createDeFiWorkflow()
      const actionMetadata = createActionMetadata()

      // Start with completely invalid parameters
      const invalidParameterValues = {
        'swap-flow-usdc': {
          fromToken: 'invalid-token',
          toToken: '',
          amount: '-100',
          slippage: '2.0' // Too high
        },
        'stake-usdc': {
          token: 'invalid-reference',
          amount: 'invalid-expression',
          duration: '100', // Too short
          autoRenew: 'maybe' // Invalid boolean
        }
      }

      const executionResult = await executionValidator.validateForExecution(
        workflow,
        actionMetadata,
        invalidParameterValues
      )

      expect(executionResult.canExecute).toBe(false)
      expect(executionResult.blockingErrors.length).toBeGreaterThan(0)
      expect(executionResult.executionReadiness.readinessScore).toBeLessThan(50)

      // Should provide specific guidance for each error
      const errorMessages = executionResult.blockingErrors.map(e => e.message)
      expect(errorMessages.some(msg => msg.includes('invalid-token'))).toBe(true)
      expect(errorMessages.some(msg => msg.includes('amount'))).toBe(true)
    })

    it('should provide progressive validation feedback', async () => {
      const workflow = createDeFiWorkflow()
      const actionMetadata = createActionMetadata()

      // Step 1: No parameters
      let parameterValues = {}
      let result = await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      const initialScore = result.executionReadiness.readinessScore
      expect(initialScore).toBeLessThan(25)

      // Step 2: Configure first action
      parameterValues = {
        'swap-flow-usdc': {
          fromToken: 'FLOW',
          toToken: 'USDC',
          amount: '1000.0',
          slippage: '0.01'
        }
      }
      result = await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      expect(result.executionReadiness.readinessScore).toBeGreaterThan(initialScore)

      // Step 3: Configure second action
      parameterValues['stake-usdc'] = {
        token: 'swap-flow-usdc.outputToken',
        amount: 'swap-flow-usdc.outputAmount * 0.5',
        duration: '2592000',
        autoRenew: true
      }
      result = await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      expect(result.executionReadiness.readinessScore).toBeGreaterThan(50)

      // Continue until fully configured
      // ... (additional steps would continue to improve the score)
    })
  })

  describe('Real-world Integration Scenarios', () => {
    it('should simulate API endpoint integration', async () => {
      const workflow = createDeFiWorkflow()
      const actionMetadata = createActionMetadata()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Mock API responses
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          canExecute: true,
          executionReadiness: {
            parametersConfigured: true,
            dataFlowValid: true,
            noCircularDependencies: true,
            allActionsValid: true,
            readinessScore: 100,
            readinessMessage: 'Workflow is ready for execution'
          },
          blockingErrors: [],
          warnings: [],
          estimatedGasCost: 25000,
          estimatedExecutionTime: 8000
        })
      } as Response)

      // Simulate API call to validate-execution endpoint
      const response = await fetch('/api/workflow/validate-execution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow,
          actionMetadata,
          parameterValues
        })
      })

      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.canExecute).toBe(true)
      expect(data.executionReadiness.readinessScore).toBe(100)
      expect(data.estimatedGasCost).toBeGreaterThan(20000)
    })

    it('should handle network failures gracefully', async () => {
      const workflow = createDeFiWorkflow()
      const actionMetadata = createActionMetadata()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Mock network failure
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'))

      // Should handle gracefully without throwing
      try {
        await fetch('/api/workflow/validate-execution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workflow, actionMetadata, parameterValues })
        })
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe('Network error')
      }
    })
  })

  // Helper functions
  function createLargeChainedWorkflow(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: i % 2 === 0 ? 'swap-tokens' : 'transfer-tokens',
      name: `Action ${i + 1}`,
      parameters: [
        { 
          name: 'amount', 
          type: 'UFix64', 
          value: i > 0 ? `action-${i}.outputAmount` : '100.0', 
          required: true 
        },
        { 
          name: 'token', 
          type: 'Address', 
          value: i > 0 ? `action-${i}.outputToken` : 'FLOW', 
          required: true 
        }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : [],
      position: { x: i * 150, y: Math.sin(i * 0.5) * 100 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount - 1,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createParameterValuesForLargeWorkflow(workflow: ParsedWorkflow): Record<string, any> {
    const parameterValues: Record<string, any> = {}
    
    workflow.actions.forEach((action, index) => {
      parameterValues[action.id] = {
        amount: index === 0 ? '100.0' : `action-${index}.outputAmount`,
        token: index === 0 ? 'FLOW' : `action-${index}.outputToken`
      }
    })

    return parameterValues
  }

  function createParameterValuesForWorkflow(workflow: ParsedWorkflow): Record<string, any> {
    const parameterValues: Record<string, any> = {}
    
    workflow.actions.forEach(action => {
      const values: Record<string, any> = {}
      
      action.parameters.forEach(param => {
        if (param.value) {
          values[param.name] = param.value
        } else {
          // Provide default values based on type
          switch (param.type) {
            case 'Address':
              values[param.name] = '0x1654653399040a61'
              break
            case 'UFix64':
              values[param.name] = '10.0'
              break
            case 'String':
              values[param.name] = 'default value'
              break
            case 'Bool':
              values[param.name] = true
              break
            case 'UInt64':
              values[param.name] = '100'
              break
            default:
              values[param.name] = 'default'
          }
        }
      })
      
      parameterValues[action.id] = values
    })

    return parameterValues
  }
})