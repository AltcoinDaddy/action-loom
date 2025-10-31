import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FCLWalletManager } from '@/lib/wallet-manager'
import { FlowNetworkConfig, WalletType, FlowUser } from '@/lib/types'
import * as fcl from '@onflow/fcl'

// Mock FCL
vi.mock('@onflow/fcl', () => ({
  config: vi.fn(),
  authenticate: vi.fn(),
  unauthenticate: vi.fn(),
  account: vi.fn(),
  currentUser: {
    subscribe: vi.fn(),
    snapshot: vi.fn()
  }
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('FCLWalletManager', () => {
  let walletManager: FCLWalletManager
  let mockNetwork: FlowNetworkConfig
  let mockUser: FlowUser
  let mockUnsubscribe: () => void

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

    mockUser = {
      addr: '0x1234567890abcdef',
      cid: 'test-cid',
      expiresAt: Date.now() + 3600000,
      f_type: 'User',
      f_vsn: '1.0.0',
      loggedIn: true,
      services: [
        {
          f_type: 'Service',
          f_vsn: '1.0.0',
          type: 'authn',
          method: 'HTTP/POST',
          endpoint: 'https://test-wallet.com/authn',
          uid: 'test-uid',
          id: 'test-id',
          identity: {
            address: '0x1234567890abcdef',
            keyId: 0
          },
          provider: {
            address: '0x1234567890abcdef',
            name: 'Test Wallet',
            icon: 'https://test-wallet.com/icon.png',
            description: 'Test wallet for testing'
          }
        }
      ]
    }

    mockUnsubscribe = vi.fn()
    vi.mocked(fcl.currentUser.subscribe).mockReturnValue(mockUnsubscribe)
    
    walletManager = new FCLWalletManager(mockNetwork)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should initialize FCL with network configuration', () => {
      expect(fcl.config).toHaveBeenCalledWith(mockNetwork.fclConfig)
    })

    it('should subscribe to FCL user changes', () => {
      expect(fcl.currentUser.subscribe).toHaveBeenCalled()
    })

    it('should throw error if network configuration is missing', () => {
      expect(() => {
        new FCLWalletManager(null as any)
      }).toThrow('Network configuration is required')
    })
  })

  describe('connect', () => {
    it('should successfully connect wallet', async () => {
      vi.mocked(fcl.authenticate).mockResolvedValue(mockUser)

      const connection = await walletManager.connect(WalletType.BLOCTO)

      expect(fcl.authenticate).toHaveBeenCalled()
      expect(connection).toEqual({
        address: mockUser.addr,
        walletType: WalletType.BLOCTO,
        isAuthenticated: true,
        capabilities: ['authentication']
      })
    })

    it('should throw error if authentication fails', async () => {
      vi.mocked(fcl.authenticate).mockResolvedValue({ ...mockUser, addr: null })

      await expect(walletManager.connect()).rejects.toThrow('Authentication failed - no address returned')
    })

    it('should handle FCL authentication errors', async () => {
      const error = new Error('FCL authentication failed')
      vi.mocked(fcl.authenticate).mockRejectedValue(error)

      await expect(walletManager.connect()).rejects.toThrow('FCL authentication failed')
    })
  })

  describe('disconnect', () => {
    it('should successfully disconnect wallet', async () => {
      vi.mocked(fcl.unauthenticate).mockResolvedValue(undefined)

      await walletManager.disconnect()

      expect(fcl.unauthenticate).toHaveBeenCalled()
    })

    it('should handle FCL unauthentication errors', async () => {
      const error = new Error('FCL unauthentication failed')
      vi.mocked(fcl.unauthenticate).mockRejectedValue(error)

      await expect(walletManager.disconnect()).rejects.toThrow('FCL unauthentication failed')
    })
  })

  describe('getAccount', () => {
    beforeEach(() => {
      // Simulate connected user
      walletManager['_currentUser'] = mockUser
      walletManager['_isConnected'] = true
    })

    it('should fetch account information', async () => {
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

      const account = await walletManager.getAccount()

      expect(fcl.account).toHaveBeenCalledWith(mockUser.addr)
      expect(account).toEqual(mockAccount)
    })

    it('should throw error if no authenticated user', async () => {
      walletManager['_currentUser'] = null
      walletManager['_isConnected'] = false

      await expect(walletManager.getAccount()).rejects.toThrow('No authenticated user')
    })

    it('should handle FCL account fetch errors', async () => {
      const error = new Error('Account fetch failed')
      vi.mocked(fcl.account).mockRejectedValue(error)

      await expect(walletManager.getAccount()).rejects.toThrow('Account fetch failed')
    })
  })

  describe('getBalance', () => {
    beforeEach(() => {
      // Simulate connected user
      walletManager['_currentUser'] = mockUser
      walletManager['_isConnected'] = true
    })

    it('should fetch FLOW balance', async () => {
      const mockAccount = {
        address: '0x1234567890abcdef',
        balance: '100.00000000',
        code: '',
        keys: [],
        contracts: {}
      }

      vi.mocked(fcl.account).mockResolvedValue(mockAccount)

      const balance = await walletManager.getBalance('FLOW')

      expect(balance).toEqual({
        token: 'FLOW',
        amount: '100.00000000',
        decimals: 8
      })
    })

    it('should return zero balance for other tokens', async () => {
      const balance = await walletManager.getBalance('USDC')

      expect(balance).toEqual({
        token: 'USDC',
        amount: '0.00000000',
        decimals: 8
      })
    })

    it('should throw error if no authenticated user', async () => {
      walletManager['_currentUser'] = null
      walletManager['_isConnected'] = false

      await expect(walletManager.getBalance()).rejects.toThrow('No authenticated user')
    })
  })

  describe('session management', () => {
    beforeEach(() => {
      walletManager['_currentUser'] = mockUser
      walletManager['_isConnected'] = true
    })

    it('should persist session data', async () => {
      await walletManager.persistSession()

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'actionloom_wallet_session',
        expect.stringContaining(mockUser.addr!)
      )
    })

    it('should restore valid session', async () => {
      const sessionData = {
        address: mockUser.addr,
        walletType: WalletType.FLOW_WALLET,
        timestamp: Date.now(),
        networkChainId: mockNetwork.chainId
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))
      vi.mocked(fcl.currentUser.snapshot).mockResolvedValue(mockUser)

      const restored = await walletManager.restoreSession()

      expect(restored).toBe(true)
    })

    it('should not restore expired session', async () => {
      const sessionData = {
        address: mockUser.addr,
        walletType: WalletType.FLOW_WALLET,
        timestamp: Date.now() - (25 * 60 * 60 * 1000), // 25 hours ago
        networkChainId: mockNetwork.chainId
      }

      localStorageMock.getItem.mockReturnValue(JSON.stringify(sessionData))

      const restored = await walletManager.restoreSession()

      expect(restored).toBe(false)
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('actionloom_wallet_session')
    })

    it('should clear session data', async () => {
      await walletManager.clearSession()

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('actionloom_wallet_session')
    })
  })

  describe('event handling', () => {
    it('should register account change callbacks', () => {
      const callback = vi.fn()
      walletManager.onAccountChange(callback)

      expect(walletManager['_accountChangeCallbacks']).toContain(callback)
    })

    it('should register disconnect callbacks', () => {
      const callback = vi.fn()
      walletManager.onDisconnect(callback)

      expect(walletManager['_disconnectCallbacks']).toContain(callback)
    })
  })

  describe('network management', () => {
    it('should update network configuration', () => {
      const newNetwork = { ...mockNetwork, name: 'Flow Mainnet', chainId: 'flow-mainnet' }
      
      walletManager.updateNetwork(newNetwork)

      expect(fcl.config).toHaveBeenCalledWith(newNetwork.fclConfig)
    })
  })
})