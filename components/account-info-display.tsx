'use client'

import React, { useState, useEffect } from 'react'
import { FlowAccount, TokenBalance } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { 
  Wallet, 
  Copy, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  ExternalLink,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AccountInfoDisplayProps {
  account: FlowAccount | null
  balances: TokenBalance[]
  isLoading: boolean
  error?: string | null
  onRefresh: () => void
  networkName: string
}

export function AccountInfoDisplay({
  account,
  balances,
  isLoading,
  error,
  onRefresh,
  networkName
}: AccountInfoDisplayProps) {
  const [showFullAddress, setShowFullAddress] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (account && !isLoading) {
      setLastUpdated(new Date())
    }
  }, [account, isLoading])

  const formatAddress = (address: string) => {
    if (showFullAddress) {
      return address
    }
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied to clipboard",
        description: "Address copied successfully",
      })
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Could not copy address to clipboard",
        variant: "destructive"
      })
    }
  }

  const formatBalance = (balance: TokenBalance) => {
    const amount = parseFloat(balance.amount)
    if (amount === 0) {
      return '0.00'
    }
    if (amount < 0.01) {
      return '< 0.01'
    }
    return amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    })
  }

  const getExplorerUrl = (address: string) => {
    const baseUrl = networkName.toLowerCase().includes('mainnet') 
      ? 'https://flowscan.org/account'
      : 'https://testnet.flowscan.org/account'
    return `${baseUrl}/${address}`
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRefresh}
            className="w-full mt-4"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!account) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2 text-muted-foreground">
            <Wallet className="h-5 w-5" />
            <span className="text-sm">No wallet connected</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg">Account Info</CardTitle>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-xs">
              {networkName}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {lastUpdated && (
          <CardDescription className="text-xs">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Address Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Address</span>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFullAddress(!showFullAddress)}
                className="h-6 px-2 text-xs"
              >
                {showFullAddress ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(account.address)}
                className="h-6 px-2"
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(getExplorerUrl(account.address), '_blank')}
                className="h-6 px-2"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="font-mono text-sm bg-muted p-2 rounded">
            {formatAddress(account.address)}
          </div>
        </div>

        <Separator />

        {/* Balances Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Balances</span>
            {isLoading && (
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            {balances.length > 0 ? (
              balances.map((balance) => (
                <div key={balance.token} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-blue-600">
                        {balance.token.charAt(0)}
                      </span>
                    </div>
                    <span className="font-medium text-sm">{balance.token}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">
                      {formatBalance(balance)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {balance.token}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No balances available
              </div>
            )}
          </div>
        </div>

        <Separator />

        {/* Account Details */}
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">Account Details</span>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Keys:</span>
              <span className="ml-2 font-mono">{account.keys.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Contracts:</span>
              <span className="ml-2 font-mono">{Object.keys(account.contracts).length}</span>
            </div>
          </div>
          
          {account.keys.length > 0 && (
            <div className="mt-2">
              <div className="text-xs text-muted-foreground mb-1">Active Keys:</div>
              <div className="space-y-1">
                {account.keys.filter(key => !key.revoked).map((key) => (
                  <div key={key.index} className="flex items-center justify-between text-xs bg-muted/30 p-2 rounded">
                    <span>Key #{key.index}</span>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs px-1 py-0">
                        Weight: {key.weight}
                      </Badge>
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}