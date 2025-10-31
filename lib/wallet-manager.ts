import * as fcl from '@onflow/fcl'
import { 
  WalletType, 
  WalletConnection, 
  FlowAccount, 
  TokenBalance, 
  FlowUser,
  FlowNetworkConfig 
} from '@/lib/types'
import { WalletErrorHandler, WalletErrorType } from '@/lib/wallet-error-handler'
import { WalletSessionManager, WalletSession } from '@/lib/wallet-session-manager'

export interface WalletManager {
  // Connection management
  connect: (walletType?: WalletType) => Promise<WalletConnection>
  disconnect: () => Promise<void>
  
  // Account data
  getAccount: () => Promise<FlowAccount>
  getBalance: (tokenType?: string) => Promise<TokenBalance>
  
  // Authentication
  authenticate: () => Promise<AuthResult>
  unauthenticate: () => Promise<void>
  
  // State management
  isConnected: boolean
  currentUser: FlowUser | null
  
  // Event handling
  onAccountChange: (callback: (account: FlowAccount) => void) => void
  onDisconnect: (callback: () => void) => void
  
  // Session management
  persistSession: () => Promise<void>
  restoreSession: () => Promise<boolean>
  clearSession: () => Promise<void>
}

export interface AuthResult {
  success: boolean
  user: FlowUser | null
  error?: string
}

export interface WalletSessionData {
  address: string
  walletType: WalletType
  timestamp: number
  networkChainId: string
}

export class FCLWalletManager implements WalletManager {
  private _currentUser: FlowUser | null = null
  private _isConnected: boolean = false
  private _accountChangeCallbacks: ((account: FlowAccount) => void)[] = []
  private _disconnectCallbacks: (() => void)[] = []
  private _currentNetwork: FlowNetworkConfig | null = null
  private _errorHandler: WalletErrorHandler
  private _sessionManager: WalletSessionManager

  constructor(network: FlowNetworkConfig) {
    this._currentNetwork = network
    this._errorHandler = new WalletErrorHandler()
    this._sessionManager = new WalletSessionManager(undefined, this._errorHandler)
    
    this.initializeFCL()
    this.subscribeToUserChanges()
  }

  private initializeFCL() {
    if (!this._currentNetwork) {
      throw new Error('Network configuration is required')
    }

    try {
      fcl.config(this._currentNetwork.fclConfig)
      console.log(`FCL initialized for ${this._currentNetwork.name}`)
    } catch (error) {
      console.error('Failed to initialize FCL:', error)
      throw new Error(`Failed to initialize FCL: ${error}`)
    }
  }

  private subscribeToUserChanges() {
    fcl.currentUser.subscribe((user: FlowUser) => {
      const wasConnected = this._isConnected
      this._currentUser = user
      this._isConnected = user?.loggedIn || false

      if (this._isConnected && !wasConnected) {
        // User just connected
        this.handleUserConnected(user)
      } else if (!this._isConnected && wasConnected) {
        // User just disconnected
        this.handleUserDisconnected()
      }
    })
  }

  private async handleUserConnected(user: FlowUser) {
    console.log('User connected:', user.addr)
    
    try {
      // Persist session
      await this.persistSession()
      
      // Fetch account data and notify callbacks
      const account = await this.getAccount()
      this._accountChangeCallbacks.forEach(callback => {
        try {
          callback(account)
        } catch (error) {
          console.error('Error in account change callback:', error)
        }
      })
    } catch (error) {
      console.error('Error handling user connection:', error)
    }
  }

  private handleUserDisconnected() {
    console.log('User disconnected')
    
    // Clear session
    this.clearSession()
    
    // Notify disconnect callbacks
    this._disconnectCallbacks.forEach(callback => {
      try {
        callback()
      } catch (error) {
        console.error('Error in disconnect callback:', error)
      }
    })
  }

  // Public interface implementation
  get isConnected(): boolean {
    return this._isConnected
  }

  get currentUser(): FlowUser | null {
    return this._currentUser
  }

  async connect(walletType?: WalletType): Promise<WalletConnection> {
    return this._errorHandler.handleError(
      async () => {
        console.log('Attempting to connect wallet:', walletType || 'auto-detect')

        // If a specific wallet type is requested, we could configure FCL for that wallet
        // For now, we'll use the default FCL authentication flow
        const user = await fcl.authenticate()
        
        if (!user?.addr) {
          throw this._errorHandler.createError(
            WalletErrorType.AUTHENTICATION_FAILED,
            'Authentication failed - no address returned'
          )
        }

        // Determine wallet type from user services if not specified
        const detectedWalletType = walletType || this.detectWalletType(user)

        // Create session
        if (this._currentNetwork) {
          await this._sessionManager.createSession(user, detectedWalletType, this._currentNetwork)
        }

        const connection: WalletConnection = {
          address: user.addr,
          walletType: detectedWalletType,
          isAuthenticated: true,
          capabilities: this.extractCapabilities(user)
        }

        console.log('Wallet connected successfully:', connection.address)
        return connection
      },
      'connect wallet',
      { maxAttempts: 2 }
    )
  }

  async disconnect(): Promise<void> {
    return this._errorHandler.handleError(
      async () => {
        console.log('Disconnecting wallet...')
        
        // Clear session first
        await this._sessionManager.clearSession()
        
        // Then unauthenticate with FCL
        await fcl.unauthenticate()
        
        console.log('Wallet disconnected successfully')
      },
      'disconnect wallet',
      { maxAttempts: 1 }
    )
  }

  async authenticate(): Promise<AuthResult> {
    try {
      const user = await fcl.authenticate()
      
      return {
        success: !!user?.addr,
        user: user,
        error: user?.addr ? undefined : 'Authentication failed - no address returned'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed'
      return {
        success: false,
        user: null,
        error: errorMessage
      }
    }
  }

  async unauthenticate(): Promise<void> {
    await this.disconnect()
  }

  async getAccount(): Promise<FlowAccount> {
    if (!this._currentUser?.addr) {
      throw this._errorHandler.createError(
        WalletErrorType.ACCOUNT_NOT_FOUND,
        'No authenticated user'
      )
    }

    return this._errorHandler.handleError(
      async () => {
        const account = await fcl.account(this._currentUser!.addr!)
        
        return {
          address: account.address,
          balance: account.balance.toString(),
          code: account.code,
          keys: account.keys.map((key: any) => ({
            index: key.index,
            publicKey: key.publicKey,
            signAlgo: key.signAlgo,
            hashAlgo: key.hashAlgo,
            weight: key.weight,
            sequenceNumber: key.sequenceNumber,
            revoked: key.revoked
          })),
          contracts: account.contracts || {}
        }
      },
      'fetch account',
      { maxAttempts: 2 }
    )
  }

  async getBalance(tokenType = 'FLOW'): Promise<TokenBalance> {
    if (!this._currentUser?.addr) {
      throw new Error('No authenticated user')
    }

    try {
      if (tokenType === 'FLOW') {
        // Get FLOW balance from account
        const account = await fcl.account(this._currentUser.addr)
        
        return {
          token: 'FLOW',
          amount: account.balance.toString(),
          decimals: 8 // FLOW has 8 decimals
        }
      } else {
        // For other tokens, we would need to execute scripts to check balances
        // This is a placeholder implementation
        return {
          token: tokenType,
          amount: '0.00000000',
          decimals: 8
        }
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch balance'
      throw new Error(errorMessage)
    }
  }

  onAccountChange(callback: (account: FlowAccount) => void): void {
    this._accountChangeCallbacks.push(callback)
  }

  onDisconnect(callback: () => void): void {
    this._disconnectCallbacks.push(callback)
  }

  async persistSession(): Promise<void> {
    if (!this._currentUser?.addr || !this._currentNetwork) {
      return
    }

    try {
      const walletType = this.detectWalletType(this._currentUser)
      await this._sessionManager.createSession(this._currentUser, walletType, this._currentNetwork)
    } catch (error) {
      const walletError = this._errorHandler.parseError(error, 'persistSession')
      console.error('Failed to persist session:', walletError)
    }
  }

  async restoreSession(): Promise<boolean> {
    if (!this._currentNetwork) {
      return false
    }

    try {
      const session = await this._sessionManager.restoreSession(this._currentNetwork)
      if (!session) {
        return false
      }

      // Try to restore FCL session
      const currentUser = await fcl.currentUser.snapshot()
      if (currentUser?.addr === session.address && currentUser?.loggedIn) {
        console.log('Session restored successfully')
        return true
      }

      // FCL session doesn't match, clear our session
      await this._sessionManager.clearSession()
      return false
    } catch (error) {
      const walletError = this._errorHandler.parseError(error, 'restoreSession')
      console.error('Failed to restore session:', walletError)
      return false
    }
  }

  async clearSession(): Promise<void> {
    await this._sessionManager.clearSession()
  }

  // Helper methods
  private detectWalletType(user: FlowUser): WalletType {
    // Try to detect wallet type from user services
    if (user.services && user.services.length > 0) {
      const service = user.services[0]
      const providerName = service.provider?.name?.toLowerCase() || ''
      
      if (providerName.includes('blocto')) {
        return WalletType.BLOCTO
      } else if (providerName.includes('lilico')) {
        return WalletType.LILICO
      } else if (providerName.includes('dapper')) {
        return WalletType.DAPPER
      }
    }
    
    // Default to Flow Wallet
    return WalletType.FLOW_WALLET
  }

  private extractCapabilities(user: FlowUser): string[] {
    // Extract capabilities from user services
    const capabilities: string[] = []
    
    if (user.services) {
      user.services.forEach(service => {
        if (service.type === 'authn') {
          capabilities.push('authentication')
        }
        if (service.type === 'authz') {
          capabilities.push('authorization')
        }
        if (service.type === 'user-signature') {
          capabilities.push('user-signature')
        }
      })
    }
    
    return capabilities
  }

  // Network management
  updateNetwork(network: FlowNetworkConfig): void {
    this._currentNetwork = network
    this.initializeFCL()
  }

  // Error handling
  getErrorHandler(): WalletErrorHandler {
    return this._errorHandler
  }

  getSessionManager(): WalletSessionManager {
    return this._sessionManager
  }

  // Cleanup
  destroy(): void {
    this._sessionManager.destroy()
  }
}