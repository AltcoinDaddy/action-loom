'use client'

import React from 'react'
import { useFlowIntegration } from '@/lib/flow-integration-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Wallet, Network, User, AlertCircle } from 'lucide-react'

export function FlowIntegrationDemo() {
  const {
    currentNetwork,
    switchNetwork,
    isConnected,
    currentUser,
    connect,
    disconnect,
    getAccount,
    getBalance,
    networks,
    isConnecting,
    isLoading,
    error,
    clearError
  } = useFlowIntegration()

  const [accountData, setAccountData] = React.useState<any>(null)
  const [balance, setBalance] = React.useState<any>(null)

  const handleConnect = async () => {
    try {
      await connect()
    } catch (err) {
      console.error('Connection failed:', err)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      setAccountData(null)
      setBalance(null)
    } catch (err) {
      console.error('Disconnection failed:', err)
    }
  }

  const handleGetAccount = async () => {
    try {
      const account = await getAccount()
      setAccountData(account)
    } catch (err) {
      console.error('Failed to get account:', err)
    }
  }

  const handleGetBalance = async () => {
    try {
      const tokenBalance = await getBalance()
      setBalance(tokenBalance)
    } catch (err) {
      console.error('Failed to get balance:', err)
    }
  }

  const handleSwitchNetwork = async (networkName: 'testnet' | 'mainnet') => {
    try {
      await switchNetwork(networks[networkName])
    } catch (err) {
      console.error('Failed to switch network:', err)
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Flow Integration Demo</h2>
        <Badge variant={currentNetwork.chainId === 'flow-mainnet' ? 'destructive' : 'secondary'}>
          {currentNetwork.name}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button variant="outline" size="sm" onClick={clearError}>
              Clear
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Network Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network Management
            </CardTitle>
            <CardDescription>
              Switch between Flow testnet and mainnet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">Current Network:</p>
              <Badge variant="outline">{currentNetwork.name}</Badge>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={currentNetwork.chainId === 'flow-testnet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSwitchNetwork('testnet')}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Testnet
              </Button>
              <Button
                variant={currentNetwork.chainId === 'flow-mainnet' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSwitchNetwork('mainnet')}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Mainnet
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Wallet Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet Connection
            </CardTitle>
            <CardDescription>
              Connect your Flow wallet to interact with the blockchain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              {currentUser?.addr && (
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {currentUser.addr.slice(0, 8)}...
                </code>
              )}
            </div>

            <div className="flex gap-2">
              {!isConnected ? (
                <Button onClick={handleConnect} disabled={isConnecting}>
                  {isConnecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Connect Wallet
                </Button>
              ) : (
                <Button variant="outline" onClick={handleDisconnect} disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Account Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Account Information
            </CardTitle>
            <CardDescription>
              View your Flow account details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleGetAccount} 
              disabled={!isConnected || isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Account Data
            </Button>

            {accountData && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Address:</span>
                  <code className="ml-2 bg-muted px-2 py-1 rounded text-xs">
                    {accountData.address}
                  </code>
                </div>
                <div>
                  <span className="font-medium">Balance:</span>
                  <span className="ml-2">{accountData.balance} FLOW</span>
                </div>
                <div>
                  <span className="font-medium">Keys:</span>
                  <span className="ml-2">{accountData.keys.length} key(s)</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Token Balance */}
        <Card>
          <CardHeader>
            <CardTitle>Token Balance</CardTitle>
            <CardDescription>
              Check your FLOW token balance
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleGetBalance} 
              disabled={!isConnected || isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Get Balance
            </Button>

            {balance && (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Token:</span>
                  <span className="ml-2">{balance.token}</span>
                </div>
                <div>
                  <span className="font-medium">Amount:</span>
                  <span className="ml-2">{balance.amount}</span>
                </div>
                <div>
                  <span className="font-medium">Decimals:</span>
                  <span className="ml-2">{balance.decimals}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}