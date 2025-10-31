import * as fcl from '@onflow/fcl'
import { FlowAccount, TokenBalance, FlowNetworkConfig } from '@/lib/types'

export interface AccountDataFetcher {
  // Account data fetching
  fetchAccount: (address: string) => Promise<FlowAccount>
  fetchBalance: (address: string, tokenType?: string) => Promise<TokenBalance>
  fetchMultipleBalances: (address: string, tokenTypes: string[]) => Promise<TokenBalance[]>
  
  // Real-time updates
  subscribeToAccountChanges: (address: string, callback: (account: FlowAccount) => void) => () => void
  subscribeToBalanceChanges: (address: string, tokenType: string, callback: (balance: TokenBalance) => void) => () => void
  
  // Caching
  getCachedAccount: (address: string) => FlowAccount | null
  getCachedBalance: (address: string, tokenType: string) => TokenBalance | null
  invalidateCache: (address?: string) => void
  
  // Batch operations
  fetchMultipleAccounts: (addresses: string[]) => Promise<FlowAccount[]>
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

export interface AccountCache {
  accounts: Map<string, CacheEntry<FlowAccount>>
  balances: Map<string, CacheEntry<TokenBalance>>
}

export class FlowAccountDataFetcher implements AccountDataFetcher {
  private cache: AccountCache
  private network: FlowNetworkConfig
  private subscriptions: Map<string, NodeJS.Timeout> = new Map()
  
  // Cache TTL values (in milliseconds)
  private readonly ACCOUNT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly BALANCE_CACHE_TTL = 30 * 1000 // 30 seconds
  private readonly POLLING_INTERVAL = 10 * 1000 // 10 seconds for real-time updates

  constructor(network: FlowNetworkConfig) {
    this.network = network
    this.cache = {
      accounts: new Map(),
      balances: new Map()
    }
  }

  async fetchAccount(address: string): Promise<FlowAccount> {
    try {
      // Check cache first
      const cached = this.getCachedAccount(address)
      if (cached) {
        return cached
      }

      console.log(`Fetching account data for ${address}`)
      const account = await fcl.account(address)
      
      const flowAccount: FlowAccount = {
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

      // Cache the result
      this.cacheAccount(address, flowAccount)
      
      return flowAccount
    } catch (error) {
      console.error(`Failed to fetch account ${address}:`, error)
      throw new Error(`Failed to fetch account: ${error}`)
    }
  }

  async fetchBalance(address: string, tokenType = 'FLOW'): Promise<TokenBalance> {
    try {
      // Check cache first
      const cached = this.getCachedBalance(address, tokenType)
      if (cached) {
        return cached
      }

      console.log(`Fetching ${tokenType} balance for ${address}`)
      
      let balance: TokenBalance

      if (tokenType === 'FLOW') {
        // Get FLOW balance from account
        const account = await fcl.account(address)
        balance = {
          token: 'FLOW',
          amount: account.balance.toString(),
          decimals: 8
        }
      } else {
        // For other tokens, execute a script to check balance
        balance = await this.fetchTokenBalance(address, tokenType)
      }

      // Cache the result
      this.cacheBalance(address, tokenType, balance)
      
      return balance
    } catch (error) {
      console.error(`Failed to fetch ${tokenType} balance for ${address}:`, error)
      throw new Error(`Failed to fetch balance: ${error}`)
    }
  }

  async fetchMultipleBalances(address: string, tokenTypes: string[]): Promise<TokenBalance[]> {
    try {
      const balancePromises = tokenTypes.map(tokenType => 
        this.fetchBalance(address, tokenType)
      )
      
      const balances = await Promise.allSettled(balancePromises)
      
      return balances
        .filter((result): result is PromiseFulfilledResult<TokenBalance> => result.status === 'fulfilled')
        .map(result => result.value)
    } catch (error) {
      console.error(`Failed to fetch multiple balances for ${address}:`, error)
      throw new Error(`Failed to fetch multiple balances: ${error}`)
    }
  }

  subscribeToAccountChanges(address: string, callback: (account: FlowAccount) => void): () => void {
    const subscriptionKey = `account_${address}`
    
    // Clear existing subscription if any
    if (this.subscriptions.has(subscriptionKey)) {
      clearInterval(this.subscriptions.get(subscriptionKey)!)
    }

    // Set up polling for account changes
    const intervalId = setInterval(async () => {
      try {
        // Invalidate cache to force fresh fetch
        this.invalidateAccountCache(address)
        const account = await this.fetchAccount(address)
        callback(account)
      } catch (error) {
        console.error(`Error polling account changes for ${address}:`, error)
      }
    }, this.POLLING_INTERVAL)

    this.subscriptions.set(subscriptionKey, intervalId)

    // Return unsubscribe function
    return () => {
      clearInterval(intervalId)
      this.subscriptions.delete(subscriptionKey)
    }
  }

  subscribeToBalanceChanges(address: string, tokenType: string, callback: (balance: TokenBalance) => void): () => void {
    const subscriptionKey = `balance_${address}_${tokenType}`
    
    // Clear existing subscription if any
    if (this.subscriptions.has(subscriptionKey)) {
      clearInterval(this.subscriptions.get(subscriptionKey)!)
    }

    // Set up polling for balance changes
    const intervalId = setInterval(async () => {
      try {
        // Invalidate cache to force fresh fetch
        this.invalidateBalanceCache(address, tokenType)
        const balance = await this.fetchBalance(address, tokenType)
        callback(balance)
      } catch (error) {
        console.error(`Error polling balance changes for ${address} ${tokenType}:`, error)
      }
    }, this.POLLING_INTERVAL)

    this.subscriptions.set(subscriptionKey, intervalId)

    // Return unsubscribe function
    return () => {
      clearInterval(intervalId)
      this.subscriptions.delete(subscriptionKey)
    }
  }

  getCachedAccount(address: string): FlowAccount | null {
    const entry = this.cache.accounts.get(address)
    if (!entry) {
      return null
    }

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.accounts.delete(address)
      return null
    }

    return entry.data
  }

  getCachedBalance(address: string, tokenType: string): TokenBalance | null {
    const key = `${address}_${tokenType}`
    const entry = this.cache.balances.get(key)
    if (!entry) {
      return null
    }

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.balances.delete(key)
      return null
    }

    return entry.data
  }

  invalidateCache(address?: string): void {
    if (address) {
      // Invalidate specific address
      this.invalidateAccountCache(address)
      // Invalidate all balances for this address
      for (const key of this.cache.balances.keys()) {
        if (key.startsWith(`${address}_`)) {
          this.cache.balances.delete(key)
        }
      }
    } else {
      // Invalidate all cache
      this.cache.accounts.clear()
      this.cache.balances.clear()
    }
  }

  async fetchMultipleAccounts(addresses: string[]): Promise<FlowAccount[]> {
    try {
      const accountPromises = addresses.map(address => 
        this.fetchAccount(address)
      )
      
      const accounts = await Promise.allSettled(accountPromises)
      
      return accounts
        .filter((result): result is PromiseFulfilledResult<FlowAccount> => result.status === 'fulfilled')
        .map(result => result.value)
    } catch (error) {
      console.error('Failed to fetch multiple accounts:', error)
      throw new Error(`Failed to fetch multiple accounts: ${error}`)
    }
  }

  // Private helper methods
  private cacheAccount(address: string, account: FlowAccount): void {
    this.cache.accounts.set(address, {
      data: account,
      timestamp: Date.now(),
      ttl: this.ACCOUNT_CACHE_TTL
    })
  }

  private cacheBalance(address: string, tokenType: string, balance: TokenBalance): void {
    const key = `${address}_${tokenType}`
    this.cache.balances.set(key, {
      data: balance,
      timestamp: Date.now(),
      ttl: this.BALANCE_CACHE_TTL
    })
  }

  private invalidateAccountCache(address: string): void {
    this.cache.accounts.delete(address)
  }

  private invalidateBalanceCache(address: string, tokenType: string): void {
    const key = `${address}_${tokenType}`
    this.cache.balances.delete(key)
  }

  private async fetchTokenBalance(address: string, tokenType: string): Promise<TokenBalance> {
    // This is a placeholder implementation for fetching token balances
    // In a real implementation, you would execute Cadence scripts to check token balances
    
    const tokenConfigs = {
      'USDC': { decimals: 6, contractAddress: '0xA0b86991c31cC51f' },
      'FUSD': { decimals: 8, contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
      'FLOW': { decimals: 8, contractAddress: null }
    }

    const config = tokenConfigs[tokenType as keyof typeof tokenConfigs]
    
    if (!config) {
      // Unknown token, return zero balance
      return {
        token: tokenType,
        amount: '0',
        decimals: 8
      }
    }

    try {
      // For now, return a placeholder balance
      // In a real implementation, you would execute a Cadence script like:
      // 
      // const script = `
      //   import FungibleToken from 0xFungibleToken
      //   import ${tokenType} from ${config.contractAddress}
      //   
      //   pub fun main(address: Address): UFix64 {
      //     let account = getAccount(address)
      //     let vaultRef = account.getCapability(${tokenType}.VaultPublicPath)
      //       .borrow<&${tokenType}.Vault{FungibleToken.Balance}>()
      //     return vaultRef?.balance ?? 0.0
      //   }
      // `
      // 
      // const balance = await fcl.query({
      //   cadence: script,
      //   args: (arg, t) => [arg(address, t.Address)]
      // })

      return {
        token: tokenType,
        amount: '0.00000000',
        decimals: config.decimals
      }
    } catch (error) {
      console.error(`Failed to fetch ${tokenType} balance:`, error)
      return {
        token: tokenType,
        amount: '0',
        decimals: config.decimals
      }
    }
  }

  // Cleanup method
  destroy(): void {
    // Clear all subscriptions
    for (const intervalId of this.subscriptions.values()) {
      clearInterval(intervalId)
    }
    this.subscriptions.clear()
    
    // Clear cache
    this.invalidateCache()
  }
}