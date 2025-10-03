import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ActionMetadata, SecurityLevel } from '../types'

// Mock the useActions hook
const mockActions: ActionMetadata[] = [
  {
    id: 'swap-tokens-v2',
    name: 'Swap Tokens',
    description: 'Exchange one token for another using AMM',
    category: 'defi',
    version: '2.1.0',
    inputs: [
      { name: 'tokenIn', type: 'String', required: true, description: 'Input token address' },
      { name: 'tokenOut', type: 'String', required: true, description: 'Output token address' },
      { name: 'amountIn', type: 'UFix64', required: true, description: 'Amount to swap' }
    ],
    outputs: [
      { name: 'amountOut', type: 'UFix64', description: 'Amount received' }
    ],
    parameters: [],
    compatibility: {
      requiredCapabilities: ['TokenSwap', 'AMM'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 1500,
    securityLevel: SecurityLevel.MEDIUM,
    author: 'FlowDeFi',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z'
  },
  {
    id: 'mint-nft-v1',
    name: 'Mint NFT',
    description: 'Create a new NFT with metadata',
    category: 'nft',
    version: '1.0.0',
    inputs: [
      { name: 'recipient', type: 'Address', required: true, description: 'NFT recipient' },
      { name: 'metadata', type: 'String', required: true, description: 'NFT metadata URI' }
    ],
    outputs: [
      { name: 'tokenId', type: 'UInt64', description: 'Minted token ID' }
    ],
    parameters: [],
    compatibility: {
      requiredCapabilities: ['NFTMinting'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: ['batch-mint-nft']
    },
    gasEstimate: 2500,
    securityLevel: SecurityLevel.LOW,
    author: 'FlowNFT',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'stake-flow-v3',
    name: 'Stake FLOW',
    description: 'Stake FLOW tokens for rewards',
    category: 'defi',
    version: '3.0.0',
    inputs: [
      { name: 'amount', type: 'UFix64', required: true, description: 'Amount to stake' },
      { name: 'validator', type: 'String', required: true, description: 'Validator node ID' }
    ],
    outputs: [
      { name: 'stakingId', type: 'UInt64', description: 'Staking position ID' }
    ],
    parameters: [],
    compatibility: {
      requiredCapabilities: ['FlowStaking', 'ValidatorSelection'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 3200,
    securityLevel: SecurityLevel.HIGH,
    author: 'FlowFoundation',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-02-01T00:00:00Z'
  }
]

// Mock the useActions hook
vi.mock('../../hooks/use-actions', () => ({
  useActions: () => ({
    actions: mockActions,
    categories: ['defi', 'nft'],
    loading: false,
    error: null,
    searchActions: vi.fn().mockImplementation((query: string) => {
      return Promise.resolve(
        mockActions.filter(action => 
          action.name.toLowerCase().includes(query.toLowerCase()) ||
          action.description.toLowerCase().includes(query.toLowerCase())
        )
      )
    }),
    getActionsByCategory: vi.fn().mockImplementation((category: string) => {
      return mockActions.filter(action => action.category === category)
    }),
    refreshActions: vi.fn(),
    getActionById: vi.fn().mockImplementation((id: string) => {
      return mockActions.find(action => action.id === id)
    })
  })
}))

describe('ActionLibrary Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should provide mock actions with correct structure', () => {
    expect(mockActions).toHaveLength(3)
    
    // Verify first action structure
    const swapAction = mockActions[0]
    expect(swapAction.id).toBe('swap-tokens-v2')
    expect(swapAction.name).toBe('Swap Tokens')
    expect(swapAction.category).toBe('defi')
    expect(swapAction.version).toBe('2.1.0')
    expect(swapAction.gasEstimate).toBe(1500)
    expect(swapAction.securityLevel).toBe(SecurityLevel.MEDIUM)
    expect(swapAction.compatibility.requiredCapabilities).toContain('TokenSwap')
    expect(swapAction.compatibility.conflictsWith).toHaveLength(0)
  })

  it('should provide actions with different security levels', () => {
    const securityLevels = mockActions.map(action => action.securityLevel)
    expect(securityLevels).toContain(SecurityLevel.LOW)
    expect(securityLevels).toContain(SecurityLevel.MEDIUM)
    expect(securityLevels).toContain(SecurityLevel.HIGH)
  })

  it('should provide actions with compatibility information', () => {
    const nftAction = mockActions.find(action => action.category === 'nft')
    expect(nftAction?.compatibility.conflictsWith).toContain('batch-mint-nft')
    
    const stakeAction = mockActions.find(action => action.name === 'Stake FLOW')
    expect(stakeAction?.compatibility.requiredCapabilities).toContain('FlowStaking')
    expect(stakeAction?.compatibility.requiredCapabilities).toContain('ValidatorSelection')
  })

  it('should provide actions with different gas estimates', () => {
    const gasEstimates = mockActions.map(action => action.gasEstimate)
    expect(Math.min(...gasEstimates)).toBe(1500)
    expect(Math.max(...gasEstimates)).toBe(3200)
  })

  it('should categorize actions correctly', () => {
    const defiActions = mockActions.filter(action => action.category === 'defi')
    const nftActions = mockActions.filter(action => action.category === 'nft')
    
    expect(defiActions).toHaveLength(2)
    expect(nftActions).toHaveLength(1)
    
    expect(defiActions.map(a => a.name)).toContain('Swap Tokens')
    expect(defiActions.map(a => a.name)).toContain('Stake FLOW')
    expect(nftActions.map(a => a.name)).toContain('Mint NFT')
  })

  it('should provide actions with proper metadata structure', () => {
    mockActions.forEach(action => {
      // Required fields
      expect(action.id).toBeDefined()
      expect(action.name).toBeDefined()
      expect(action.description).toBeDefined()
      expect(action.category).toBeDefined()
      expect(action.version).toBeDefined()
      expect(action.gasEstimate).toBeGreaterThan(0)
      expect(action.securityLevel).toBeDefined()
      expect(action.author).toBeDefined()
      expect(action.createdAt).toBeDefined()
      expect(action.updatedAt).toBeDefined()
      
      // Arrays should be defined
      expect(Array.isArray(action.inputs)).toBe(true)
      expect(Array.isArray(action.outputs)).toBe(true)
      expect(Array.isArray(action.parameters)).toBe(true)
      expect(Array.isArray(action.compatibility.requiredCapabilities)).toBe(true)
      expect(Array.isArray(action.compatibility.supportedNetworks)).toBe(true)
      expect(Array.isArray(action.compatibility.conflictsWith)).toBe(true)
      
      // Compatibility info
      expect(action.compatibility.minimumFlowVersion).toBeDefined()
      expect(action.compatibility.supportedNetworks).toContain('testnet')
    })
  })
})

describe('ActionLibrary Component Data Flow', () => {
  it('should handle drag and drop data correctly', () => {
    const action = mockActions[0]
    
    // Simulate the data that would be set in drag and drop
    const dragData = {
      actionId: action.id,
      actionName: action.name,
      actionCategory: action.category,
      actionType: action.id,
      actionMetadata: JSON.stringify(action)
    }
    
    expect(dragData.actionId).toBe('swap-tokens-v2')
    expect(dragData.actionName).toBe('Swap Tokens')
    expect(dragData.actionCategory).toBe('defi')
    expect(dragData.actionType).toBe('swap-tokens-v2')
    
    // Verify metadata can be parsed
    const parsedMetadata = JSON.parse(dragData.actionMetadata)
    expect(parsedMetadata.gasEstimate).toBe(1500)
    expect(parsedMetadata.securityLevel).toBe(SecurityLevel.MEDIUM)
  })

  it('should format gas estimates correctly', () => {
    const formatGasEstimate = (gasEstimate: number): string => {
      if (gasEstimate < 1000) return gasEstimate.toString()
      if (gasEstimate < 1000000) return `${(gasEstimate / 1000).toFixed(1)}K`
      return `${(gasEstimate / 1000000).toFixed(1)}M`
    }
    
    expect(formatGasEstimate(500)).toBe('500')
    expect(formatGasEstimate(1500)).toBe('1.5K')
    expect(formatGasEstimate(2500)).toBe('2.5K')
    expect(formatGasEstimate(1500000)).toBe('1.5M')
  })

  it('should group actions by category correctly', () => {
    const actionsByCategory: Record<string, ActionMetadata[]> = {}
    
    mockActions.forEach(action => {
      if (!actionsByCategory[action.category]) {
        actionsByCategory[action.category] = []
      }
      actionsByCategory[action.category].push(action)
    })
    
    expect(Object.keys(actionsByCategory)).toEqual(['defi', 'nft'])
    expect(actionsByCategory.defi).toHaveLength(2)
    expect(actionsByCategory.nft).toHaveLength(1)
  })
})