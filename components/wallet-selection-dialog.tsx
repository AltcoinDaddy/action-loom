'use client'

import React, { useState } from 'react'
import { WalletType } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wallet, Shield, Zap, Globe } from 'lucide-react'

interface WalletOption {
  type: WalletType
  name: string
  description: string
  icon: React.ReactNode
  features: string[]
  recommended?: boolean
  comingSoon?: boolean
}

interface WalletSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onWalletSelect: (walletType: WalletType) => Promise<void>
  isConnecting: boolean
  error?: string | null
}

const walletOptions: WalletOption[] = [
  {
    type: WalletType.BLOCTO,
    name: 'Blocto',
    description: 'User-friendly wallet with social login options',
    icon: <Wallet className="h-6 w-6" />,
    features: ['Social Login', 'Mobile Friendly', 'Beginner Friendly'],
    recommended: true
  },
  {
    type: WalletType.LILICO,
    name: 'Lilico',
    description: 'Feature-rich browser extension wallet',
    icon: <Shield className="h-6 w-6" />,
    features: ['Browser Extension', 'Advanced Features', 'Developer Tools']
  },
  {
    type: WalletType.FLOW_WALLET,
    name: 'Flow Wallet',
    description: 'Official Flow blockchain wallet',
    icon: <Zap className="h-6 w-6" />,
    features: ['Official Wallet', 'Full Features', 'Secure']
  },
  {
    type: WalletType.DAPPER,
    name: 'Dapper',
    description: 'Consumer-focused wallet for mainstream users',
    icon: <Globe className="h-6 w-6" />,
    features: ['Mainstream Focus', 'Easy Onboarding', 'Credit Card Support'],
    comingSoon: true
  }
]

export function WalletSelectionDialog({
  open,
  onOpenChange,
  onWalletSelect,
  isConnecting,
  error
}: WalletSelectionDialogProps) {
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null)

  const handleWalletSelect = async (walletType: WalletType) => {
    setSelectedWallet(walletType)
    try {
      await onWalletSelect(walletType)
      onOpenChange(false)
    } catch (err) {
      // Error is handled by parent component
      console.error('Wallet selection failed:', err)
    } finally {
      setSelectedWallet(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Connect Your Wallet</DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to ActionLoom and start executing blockchain workflows.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-md bg-red-50 p-4 border border-red-200">
            <div className="text-sm text-red-800">
              <strong>Connection Failed:</strong> {error}
            </div>
          </div>
        )}

        <div className="grid gap-4 py-4">
          {walletOptions.map((wallet) => (
            <Card 
              key={wallet.type}
              className={`cursor-pointer transition-all hover:shadow-md ${
                wallet.comingSoon ? 'opacity-50 cursor-not-allowed' : ''
              } ${
                selectedWallet === wallet.type ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => !wallet.comingSoon && !isConnecting && handleWalletSelect(wallet.type)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                      {wallet.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {wallet.name}
                        {wallet.recommended && (
                          <Badge variant="secondary" className="text-xs">
                            Recommended
                          </Badge>
                        )}
                        {wallet.comingSoon && (
                          <Badge variant="outline" className="text-xs">
                            Coming Soon
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {wallet.description}
                      </CardDescription>
                    </div>
                  </div>
                  {isConnecting && selectedWallet === wallet.type && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {wallet.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            Don't have a wallet?{' '}
            <a 
              href="https://docs.onflow.org/flow-token/available-wallets/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Learn more about Flow wallets
            </a>
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isConnecting}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}