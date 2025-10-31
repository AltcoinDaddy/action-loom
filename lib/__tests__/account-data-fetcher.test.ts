import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FlowAccountDataFetcher } from '@/lib/account-data-fetcher'
import { FlowNetworkConfig } from '@/lib/types'
import * as fcl from '@onflow/fcl'

// Mock FCL
vi.mock('@onflow/fcl', () => ({
  account: vi.fn(),
  query: vi.fn()
}))

describe('FlowAccountDataFetcher', () => {
  let accountDataFetcher: FlowAccountDataFetcher
  let mockNetwork: FlowNetworkConfig

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockNetwork = {
      name: 'Flow Testnet',
      chainId: 'flow-testnet',
      accessNode: 'https://rest-testnet.onflow.org',
      discoveryWallet: 'https://fcl-discovery.onflow.org/testnet/authn',
      walletDiscovery: 'https://fcl-discovery.onflow.org/testnet/authn',
      fclConfig: {
        'accessNode.api': 'https://rest-testnet.onflow.org',
        'discovery.wallet': 'https://fcl-discovery.onflow.org/testnet/authn',
        'discovery.authn': 'https://fcl-discovery.onflow.org/testnet/authn',
        'app.detail.title': 'ActionLoom',
        'app.detail.icon': '/logo.svg'
      }
    }

    accountDataFetcher = new FlowAccountDataFetcher(mockNetwork)
  })

  afterEach(() => {
    accountDataFetcher.destroy()
    vi.restoreAllMocks()
  })

  describe('fetchAccount', () => {
    it('should fetch account data successfully', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [
          {
            index: 0,
            publicKey: 'test-public-key',
            signAlgo: 1,
            hashAlgo: 1,
            weight: 1000,
            sequenceNumber: 0,
            revoked: false
          }
        ],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      const result = await accountDataFetcher.fetchAccount('0x1234567890abcdef')

      expect(fcl.account).toHaveBeenCalledWith('0x1234567890abcdef')
      expect(result).toEqual(mockAccount)
    })

    it('should return cached account if available', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      // First call should fetch from FCL
      const result1 = await accountDataFetcher.fetchAccount('0x1234567890abcdef')
      
      // Second call should return cached result
      const result2 = await accountDataFetcher.fetchAccount('0x1234567890abcdef')

      expect(fcl.account).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })

    it('should handle FCL errors', async () => {
      const error = new Error('FCL account fetch failed')
      vi.mocked(fcl.account).mockRejectedValue(error)

      await expect(accountDataFetcher.fetchAccount('0x1234567890abcdef'))
        .rejects.toThrow('Failed to fetch account: Error: FCL account fetch failed')
    })
  })

  describe('fetchBalance', () => {
    it('should fetch FLOW balance successfully', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      const result = await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'FLOW')

      expect(result).toEqual({
        token: 'FLOW',
        amount: '100.00000000',
        decimals: 8
      })
    })

    it('should return cached balance if available', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      // First call should fetch from FCL
      const result1 = await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'FLOW')
      
      // Second call should return cached result
      const result2 = await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'FLOW')

      expect(fcl.account).toHaveBeenCalledTimes(1)
      expect(result1).toEqual(result2)
    })

    it('should return zero balance for unknown tokens', async () => {
      const result = await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'UNKNOWN')

      expect(result).toEqual({
        token: 'UNKNOWN',
        amount: '0',
        decimals: 8
      })
    })

    it('should handle supported tokens', async () => {
      const result = await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'USDC')

      expect(result).toEqual({
        token: 'USDC',
        amount: '0.00000000',
        decimals: 6
      })
    })
  })

  describe('fetchMultipleBalances', () => {
    it('should fetch multiple balances successfully', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      const result = await accountDataFetcher.fetchMultipleBalances('0x1234567890abcdef', ['FLOW', 'USDC'])

      expect(result).toHaveLength(2)
      expect(result[0].token).toBe('FLOW')
      expect(result[1].token).toBe('USDC')
    })

    it('should handle partial failures gracefully', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      const result = await accountDataFetcher.fetchMultipleBalances('0x1234567890abcdef', ['FLOW', 'INVALID'])

      expect(result).toHaveLength(2)
      expect(result.some(b => b.token === 'FLOW')).toBe(true)
      expect(result.some(b => b.token === 'INVALID')).toBe(true)
    })
  })

  describe('caching', () => {
    it('should cache account data', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      await accountDataFetcher.fetchAccount('0x1234567890abcdef')
      
      const cached = accountDataFetcher.getCachedAccount('0x1234567890abcdef')
      expect(cached).toEqual(mockAccount)
    })

    it('should cache balance data', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'FLOW')
      
      const cached = accountDataFetcher.getCachedBalance('0x1234567890abcdef', 'FLOW')
      expect(cached).toEqual({
        token: 'FLOW',
        amount: '100.00000000',
        decimals: 8
      })
    })

    it('should invalidate cache', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      await accountDataFetcher.fetchAccount('0x1234567890abcdef')
      await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'FLOW')
      
      // Verify cache exists
      expect(accountDataFetcher.getCachedAccount('0x1234567890abcdef')).toBeTruthy()
      expect(accountDataFetcher.getCachedBalance('0x1234567890abcdef', 'FLOW')).toBeTruthy()
      
      // Invalidate cache
      accountDataFetcher.invalidateCache('0x1234567890abcdef')
      
      // Verify cache is cleared
      expect(accountDataFetcher.getCachedAccount('0x1234567890abcdef')).toBeNull()
      expect(accountDataFetcher.getCachedBalance('0x1234567890abcdef', 'FLOW')).toBeNull()
    })

    it('should invalidate all cache', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      await accountDataFetcher.fetchAccount('0x1234567890abcdef')
      await accountDataFetcher.fetchBalance('0x1234567890abcdef', 'FLOW')
      
      // Invalidate all cache
      accountDataFetcher.invalidateCache()
      
      // Verify cache is cleared
      expect(accountDataFetcher.getCachedAccount('0x1234567890abcdef')).toBeNull()
      expect(accountDataFetcher.getCachedBalance('0x1234567890abcdef', 'FLOW')).toBeNull()
    })
  })

  describe('subscriptions', () => {
    it('should set up account change subscription', () => {
      const callback = vi.fn()
      const unsubscribe = accountDataFetcher.subscribeToAccountChanges('0x1234567890abcdef', callback)
      
      expect(typeof unsubscribe).toBe('function')
      
      // Clean up
      unsubscribe()
    })

    it('should set up balance change subscription', () => {
      const callback = vi.fn()
      const unsubscribe = accountDataFetcher.subscribeToBalanceChanges('0x1234567890abcdef', 'FLOW', callback)
      
      expect(typeof unsubscribe).toBe('function')
      
      // Clean up
      unsubscribe()
    })

    it('should clean up subscriptions on destroy', () => {
      const callback = vi.fn()
      const unsubscribe1 = accountDataFetcher.subscribeToAccountChanges('0x1234567890abcdef', callback)
      const unsubscribe2 = accountDataFetcher.subscribeToBalanceChanges('0x1234567890abcdef', 'FLOW', callback)
      
      // Destroy should clean up all subscriptions
      accountDataFetcher.destroy()
      
      // Verify subscriptions are cleaned up (no way to directly test this, but destroy should not throw)
      expect(() => accountDataFetcher.destroy()).not.toThrow()
    })
  })

  describe('fetchMultipleAccounts', () => {
    it('should fetch multiple accounts successfully', async () => {
      const mockAccount1 = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      const mockAccount2 = {
        address: '0xabcdef1234567890',
        balance: '200.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account)
        .mockResolvedValueOnce(mockAccount1)
        .mockResolvedValueOnce(mockAccount2)

      const result = await accountDataFetcher.fetchMultipleAccounts(['0x1234567890abcdef', '0xabcdef1234567890'])

      expect(result).toHaveLength(2)
      expect(result[0].address).toBe('0x1234567890abcdef')
      expect(result[1].address).toBe('0xabcdef1234567890')
    })

    it('should handle partial failures gracefully', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account)
        .mockResolvedValueOnce(mockAccount)
        .mockRejectedValueOnce(new Error('Account not found'))

      const result = await accountDataFetcher.fetchMultipleAccounts(['0x1234567890abcdef', '0xinvalid'])

      expect(result).toHaveLength(1)
      expect(result[0].address).toBe('0x1234567890abcdef')
    })
  })
})