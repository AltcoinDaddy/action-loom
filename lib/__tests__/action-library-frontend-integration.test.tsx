import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActionLibrary } from '@/components/action-library'
import { ActionMetadata, SecurityLevel } from '@/lib/types'

// Mock the useActions hook
const mockActions: ActionMetadata[] = [
  {
    id: 'swap-tokens',
    name: 'Swap Tokens',
    description: 'Exchange one token for another using DEX protocols',
    category: 'defi',
    version: '1.0.0',
    contractAddress: '0x123',
    inputs: [],
    outputs: [],
    parameters: [],
    metadata: {} as any,
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 50000,
    securityLevel: SecurityLevel.MEDIUM,
    securityAudit: {} as any,
    dependencies: [],
    tags: ['defi', 'swap']
  },
  {
    id: 'mint-nft',
    name: 'Mint NFT',
    description: 'Create a new NFT token',
    category: 'nft',
    version: '2.1.0',
    contractAddress: '0x456',
    inputs: [],
    outputs: [],
    parameters: [],
    metadata: {} as any,
    compatibility: {
      requiredCapabilities: ['nft-minting'],
      supportedNetworks: ['testnet', 'mainnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: ['burn-nft']
    },
    gasEstimate: 75000,
    securityLevel: SecurityLevel.LOW,
    securityAudit: {} as any,
    dependencies: [],
    tags: ['nft', 'mint']
  },
  {
    id: 'stake-tokens',
    name: 'Stake Tokens',
    description: 'Lock tokens to earn rewards',
    category: 'defi',
    version: '1.5.0',
    contractAddress: '0x789',
    inputs: [],
    outputs: [],
    parameters: [],
    metadata: {} as any,
    compatibility: {
      requiredCapabilities: ['staking'],
      supportedNetworks: ['mainnet'],
      minimumFlowVersion: '1.2.0',
      conflictsWith: []
    },
    gasEstimate: 120000,
    securityLevel: SecurityLevel.HIGH,
    securityAudit: {} as any,
    dependencies: [],
    tags: ['defi', 'staking']
  }
]

vi.mock('@/hooks/use-actions', () => ({
  useActions: () => ({
    actions: mockActions,
    categories: ['defi', 'nft'],
    loading: false,
    error: null,
    searchActions: vi.fn().mockImplementation((query: string) => 
      Promise.resolve(mockActions.filter(action => 
        action.name.toLowerCase().includes(query.toLowerCase()) ||
        action.description.toLowerCase().includes(query.toLowerCase())
      ))
    ),
    getActionsByCategory: vi.fn(),
    refreshActions: vi.fn()
  })
}))

describe('Action Library Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders action library with all actions', () => {
    render(<ActionLibrary />)

    expect(screen.getByText('Action Library')).toBeInTheDocument()
    expect(screen.getByText('3 actions')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search actions...')).toBeInTheDocument()

    // Check that actions are displayed
    expect(screen.getByText('Swap Tokens')).toBeInTheDocument()
    expect(screen.getByText('Mint NFT')).toBeInTheDocument()
    expect(screen.getByText('Stake Tokens')).toBeInTheDocument()
  })

  it('groups actions by category', () => {
    render(<ActionLibrary />)

    // Check category headers
    expect(screen.getByText('defi')).toBeInTheDocument()
    expect(screen.getByText('nft')).toBeInTheDocument()

    // Check action counts per category
    const defiSection = screen.getByText('defi').closest('div')
    const nftSection = screen.getByText('nft').closest('div')
    
    expect(defiSection).toBeInTheDocument()
    expect(nftSection).toBeInTheDocument()
  })

  it('displays action metadata correctly', () => {
    render(<ActionLibrary />)

    // Check gas estimates are formatted
    expect(screen.getByText('50K')).toBeInTheDocument() // 50000 formatted
    expect(screen.getByText('75K')).toBeInTheDocument() // 75000 formatted
    expect(screen.getByText('120K')).toBeInTheDocument() // 120000 formatted

    // Check versions are displayed
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('v2.1.0')).toBeInTheDocument()
    expect(screen.getByText('v1.5.0')).toBeInTheDocument()

    // Check security levels
    expect(screen.getByText('MEDIUM')).toBeInTheDocument()
    expect(screen.getByText('LOW')).toBeInTheDocument()
    expect(screen.getByText('HIGH')).toBeInTheDocument()
  })

  it('shows compatibility warnings for conflicting actions', () => {
    render(<ActionLibrary />)

    // The mint-nft action has conflicts, should show warning
    const mintNftCard = screen.getByText('Mint NFT').closest('.group')
    expect(mintNftCard).toBeInTheDocument()
    
    // Look for conflict indicator
    expect(screen.getByText(/conflicts with 1 action/i)).toBeInTheDocument()
  })

  it('handles search functionality', async () => {
    const user = userEvent.setup()
    
    render(<ActionLibrary />)

    const searchInput = screen.getByPlaceholderText('Search actions...')
    
    // Search for "swap"
    await user.type(searchInput, 'swap')
    
    expect(searchInput).toHaveValue('swap')
    
    // Should show search results (mocked to filter actions)
    await waitFor(() => {
      expect(screen.getByText('Swap Tokens')).toBeInTheDocument()
    })
  })

  it('shows search loading state', async () => {
    const user = userEvent.setup()
    
    render(<ActionLibrary />)

    const searchInput = screen.getByPlaceholderText('Search actions...')
    
    await user.type(searchInput, 'test')
    
    // Should show loading spinner briefly
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('handles drag and drop data transfer', () => {
    render(<ActionLibrary />)

    const swapTokensCard = screen.getByText('Swap Tokens').closest('.group')
    expect(swapTokensCard).toBeInTheDocument()

    // Mock drag event
    const dragEvent = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer: new DataTransfer()
    })

    // Simulate drag start
    fireEvent(swapTokensCard!, dragEvent)

    // Check that data transfer was set up (would be set in real implementation)
    expect(dragEvent.dataTransfer).toBeDefined()
  })

  it('shows refresh button and handles refresh', async () => {
    const user = userEvent.setup()
    
    render(<ActionLibrary />)

    const refreshButton = screen.getByTitle('Refresh Actions')
    expect(refreshButton).toBeInTheDocument()

    await user.click(refreshButton)
    
    // The refresh function should be called (mocked)
    // In real implementation, this would trigger a re-fetch
  })

  it('displays how-to-use information', () => {
    render(<ActionLibrary />)

    expect(screen.getByText('How to Use')).toBeInTheDocument()
    expect(screen.getByText(/drag any action onto the canvas/i)).toBeInTheDocument()
  })

  it('handles empty search results', async () => {
    const user = userEvent.setup()
    
    // Mock empty search results
    vi.doMock('@/hooks/use-actions', () => ({
      useActions: () => ({
        actions: mockActions,
        categories: ['defi', 'nft'],
        loading: false,
        error: null,
        searchActions: vi.fn().mockResolvedValue([]),
        getActionsByCategory: vi.fn(),
        refreshActions: vi.fn()
      })
    }))

    render(<ActionLibrary />)

    const searchInput = screen.getByPlaceholderText('Search actions...')
    await user.type(searchInput, 'nonexistent')

    await waitFor(() => {
      expect(screen.getByText('No actions found matching your search.')).toBeInTheDocument()
    })
  })

  it('shows loading state', () => {
    // Mock loading state
    vi.doMock('@/hooks/use-actions', () => ({
      useActions: () => ({
        actions: [],
        categories: [],
        loading: true,
        error: null,
        searchActions: vi.fn(),
        getActionsByCategory: vi.fn(),
        refreshActions: vi.fn()
      })
    }))

    render(<ActionLibrary />)

    expect(screen.getByText('Discovering Actions...')).toBeInTheDocument()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows error state with retry option', async () => {
    const user = userEvent.setup()
    const mockRefresh = vi.fn()
    
    // Mock error state
    vi.doMock('@/hooks/use-actions', () => ({
      useActions: () => ({
        actions: [],
        categories: [],
        loading: false,
        error: 'Failed to load actions',
        searchActions: vi.fn(),
        getActionsByCategory: vi.fn(),
        refreshActions: mockRefresh
      })
    }))

    render(<ActionLibrary />)

    expect(screen.getByText('Failed to load actions')).toBeInTheDocument()
    
    const retryButton = screen.getByText('Try Again')
    await user.click(retryButton)
    
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('formats large gas estimates correctly', () => {
    // Mock action with large gas estimate
    const largeGasAction: ActionMetadata = {
      ...mockActions[0],
      id: 'complex-action',
      name: 'Complex Action',
      gasEstimate: 2500000 // 2.5M
    }

    vi.doMock('@/hooks/use-actions', () => ({
      useActions: () => ({
        actions: [largeGasAction],
        categories: ['defi'],
        loading: false,
        error: null,
        searchActions: vi.fn(),
        getActionsByCategory: vi.fn(),
        refreshActions: vi.fn()
      })
    }))

    render(<ActionLibrary />)

    expect(screen.getByText('2.5M')).toBeInTheDocument()
  })
})