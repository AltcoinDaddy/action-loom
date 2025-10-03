"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Wallet, ExternalLink } from "lucide-react"

interface WalletConnectProps {
  onConnect?: (wallet: string) => void
}

export function WalletConnect({ onConnect }: WalletConnectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [connectedWallet, setConnectedWallet] = useState<string | null>(null)

  const wallets = [
    {
      name: "Blocto",
      description: "Easy-to-use wallet for everyone",
      icon: "🔷",
    },
    {
      name: "Lilico",
      description: "Secure Flow wallet extension",
      icon: "🦊",
    },
    {
      name: "Dapper",
      description: "Official Dapper Labs wallet",
      icon: "💎",
    },
  ]

  const handleConnect = (walletName: string) => {
    // Simulate wallet connection
    setConnectedWallet(walletName)
    setIsConnected(true)
    setIsOpen(false)
    onConnect?.(walletName)
  }

  const handleDisconnect = () => {
    setConnectedWallet(null)
    setIsConnected(false)
  }

  return (
    <>
      {isConnected ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-sm text-foreground font-medium">{connectedWallet}</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <Button onClick={() => setIsOpen(true)} className="bg-white text-black hover:bg-white/90">
          <Wallet className="w-4 h-4 mr-2" />
          Connect Wallet
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Your Wallet</DialogTitle>
            <DialogDescription>
              Choose a Flow wallet to execute your workflow on-chain. Don't have a wallet?{" "}
              <a
                href="https://flow.com/wallets"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Get one here
                <ExternalLink className="w-3 h-3" />
              </a>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {wallets.map((wallet) => (
              <button
                key={wallet.name}
                onClick={() => handleConnect(wallet.name)}
                className="w-full p-4 rounded-lg border border-border/50 hover:border-primary/50 hover:bg-card transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{wallet.icon}</span>
                  <div>
                    <div className="font-semibold text-foreground">{wallet.name}</div>
                    <div className="text-sm text-muted-foreground">{wallet.description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">Note:</span> Wallet connection is only required to execute
              workflows on-chain. You can build and preview workflows without connecting.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
