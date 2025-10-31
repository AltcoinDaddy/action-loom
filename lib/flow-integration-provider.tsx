'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import * as fcl from '@onflow/fcl'
import { 
  FlowIntegrationContextType, 
  FlowNetworkConfig, 
  FlowUser, 
  WalletType, 
  WalletConnection, 
  FlowAccount, 
  TokenBalance 
} from '@/lib/types'
import { createNetworkConfigs, flowConfig, validateNetworkConfig } from '@/lib/flow-config'
import { FCLWalletManager, WalletManager } from '@/lib/wallet-manager'
import { FlowAccountDataFetcher, AccountDataFetcher } from '@/lib/account-data-fetcher'

// Get network configurations from config
const FLOW_NETWORKS = createNetworkConfigs()

const FlowIntegrationContext = createContext<FlowIntegrationContextType | null>(null)

interface FlowIntegrationProviderProps {
  children: React.ReactNode
  defaultNetwork?: 'testnet' | 'mainnet'
}

export function FlowIntegrationProvider({ 
  children, 
  defaultNetwork 
}: FlowIntegrationProviderProps) {
  const initialNetwork = defaultNetwork || flowConfig.defaultNetwork
  const [currentNetwork, setCurrentNetwork] = useState<FlowNetworkConfig>(FLOW_NETWORKS[initialNetwork])
  const [currentUser, setCurrentUser] = useState<FlowUser | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Service instances
  const walletManagerRef = useRef<WalletManager | null>(null)
  const accountDataFetcherRef = useRef<AccountDataFetcher | null>(null)

  // Initialize services
  useEffect(() => {
    try {
      // Initialize wallet manager
      walletManagerRef.current = new FCLWalletManager(currentNetwork)
      
      // Initialize account data fetcher
      accountDataFetcherRef.current = new FlowAccountDataFetcher(currentNetwork)
      
      // Set up event listeners
      walletManagerRef.current.onAccountChange((account) => {
        console.log('Account changed:', account.address)
      })
      
      walletManagerRef.current.onDisconnect(() => {
        console.log('Wallet disconnected')
        setError(null)
      })
      
      // Try to restore session
      walletManagerRef.current.restoreSession().then((restored) => {
        if (restored) {
          console.log('Session restored successfully')
        }
      }).catch((err) => {
        console.error('Failed to restore session:', err)
      })
      
    } catch (err) {
      console.error('Failed to initialize services:', err)
      setError('Failed to initialize wallet connection')
    }

    // Cleanup function
    return () => {
      if (accountDataFetcherRef.current) {
        accountDataFetcherRef.current.destroy()
      }
    }
  }, [currentNetwork])

  // Subscribe to FCL user changes
  useEffect(() => {
    const unsubscribe = fcl.currentUser.subscribe((user: FlowUser) => {
      setCurrentUser(user)
      setIsConnected(user?.loggedIn || false)
      
      if (user?.loggedIn) {
        console.log('User authenticated:', user.addr)
        setError(null)
      } else {
        console.log('User not authenticated')
      }
    })

    return () => {
      unsubscribe()
    }
  }, [])

  // Switch network function
  const switchNetwork = useCallback(async (network: FlowNetworkConfig) => {
    try {
      setIsLoading(true)
      setError(null)

      // If user is connected, disconnect first
      if (isConnected && walletManagerRef.current) {
        await walletManagerRef.current.disconnect()
      }

      // Update network configuration
      setCurrentNetwork(network)
      
      // Update wallet manager with new network
      if (walletManagerRef.current) {
        walletManagerRef.current.updateNetwork(network)
      }

      console.log(`Switched to ${network.name}`)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to switch network'
      setError(errorMessage)
      console.error('Network switch failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isConnected])

  // Connect wallet function
  const connect = useCallback(async (walletType?: WalletType): Promise<WalletConnection> => {
    if (!walletManagerRef.current) {
      throw new Error('Wallet manager not initialized')
    }

    try {
      setIsConnecting(true)
      setError(null)

      const connection = await walletManagerRef.current.connect(walletType)
      console.log('Wallet connected:', connection.address)
      return connection

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet'
      setError(errorMessage)
      console.error('Wallet connection failed:', err)
      throw new Error(errorMessage)
    } finally {
      setIsConnecting(false)
    }
  }, [])

  // Disconnect wallet function
  const disconnect = useCallback(async () => {
    if (!walletManagerRef.current) {
      return
    }

    try {
      setIsLoading(true)
      setError(null)

      await walletManagerRef.current.disconnect()
      console.log('Wallet disconnected')
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disconnect wallet'
      setError(errorMessage)
      console.error('Wallet disconnection failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Get account information
  const getAccount = useCallback(async (): Promise<FlowAccount> => {
    if (!currentUser?.addr) {
      throw new Error('No authenticated user')
    }

    if (!accountDataFetcherRef.current) {
      throw new Error('Account data fetcher not initialized')
    }

    try {
      setIsLoading(true)
      const account = await accountDataFetcherRef.current.fetchAccount(currentUser.addr)
      return account
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch account'
      setError(errorMessage)
      console.error('Account fetch failed:', err)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  // Get token balance
  const getBalance = useCallback(async (tokenType = 'FLOW'): Promise<TokenBalance> => {
    if (!currentUser?.addr) {
      throw new Error('No authenticated user')
    }

    if (!accountDataFetcherRef.current) {
      throw new Error('Account data fetcher not initialized')
    }

    try {
      setIsLoading(true)
      const balance = await accountDataFetcherRef.current.fetchBalance(currentUser.addr, tokenType)
      return balance
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balance'
      setError(errorMessage)
      console.error('Balance fetch failed:', err)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  // Get multiple balances
  const getMultipleBalances = useCallback(async (tokenTypes: string[]): Promise<TokenBalance[]> => {
    if (!currentUser?.addr) {
      throw new Error('No authenticated user')
    }

    if (!accountDataFetcherRef.current) {
      throw new Error('Account data fetcher not initialized')
    }

    try {
      setIsLoading(true)
      const balances = await accountDataFetcherRef.current.fetchMultipleBalances(currentUser.addr, tokenTypes)
      return balances
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch balances'
      setError(errorMessage)
      console.error('Multiple balances fetch failed:', err)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [currentUser])

  // Subscribe to account changes
  const subscribeToAccountChanges = useCallback((callback: (account: FlowAccount) => void): () => void => {
    if (!currentUser?.addr || !accountDataFetcherRef.current) {
      return () => {} // Return empty unsubscribe function
    }

    return accountDataFetcherRef.current.subscribeToAccountChanges(currentUser.addr, callback)
  }, [currentUser])

  // Subscribe to balance changes
  const subscribeToBalanceChanges = useCallback((tokenType: string, callback: (balance: TokenBalance) => void): () => void => {
    if (!currentUser?.addr || !accountDataFetcherRef.current) {
      return () => {} // Return empty unsubscribe function
    }

    return accountDataFetcherRef.current.subscribeToBalanceChanges(currentUser.addr, tokenType, callback)
  }, [currentUser])

  // Clear error function
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const contextValue: FlowIntegrationContextType = {
    // Network management
    currentNetwork,
    switchNetwork,
    
    // Connection state
    isConnected,
    currentUser,
    
    // Wallet management
    connect,
    disconnect,
    
    // Account data
    getAccount,
    getBalance,
    getMultipleBalances,
    
    // Real-time data
    subscribeToAccountChanges,
    subscribeToBalanceChanges,
    
    // Network configurations
    networks: FLOW_NETWORKS,
    
    // Loading states
    isConnecting,
    isLoading,
    
    // Error handling
    error,
    clearError
  }

  return (
    <FlowIntegrationContext.Provider value={contextValue}>
      {children}
    </FlowIntegrationContext.Provider>
  )
}

// Custom hook to use the Flow integration context
export function useFlowIntegration() {
  const context = useContext(FlowIntegrationContext)
  
  if (!context) {
    throw new Error('useFlowIntegration must be used within a FlowIntegrationProvider')
  }
  
  return context
}

// Export network configurations for external use
export { FLOW_NETWORKS }