"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Wallet, ExternalLink, Loader2 } from "lucide-react"
import { WalletSelectionDialog } from "@/components/wallet-selection-dialog"
import { useFlowIntegration } from "@/lib/flow-integration-provider"
import { WalletType, WalletConnection } from "@/lib/types"

interface WalletConnectProps {
  onConnect?: (connection: WalletConnection) => void
  onDisconnect?: () => void
}

export function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { 
    isConnected, 
    currentUser, 
    connect, 
    disconnect, 
    isConnecting, 
    error,
    clearError 
  } = useFlowIntegration()

  // Clear error when dialog opens
  useEffect(() => {
    if (isDialogOpen && error) {
      clearError()
    }
  }, [isDialogOpen, error, clearError])

  const handleConnect = async (walletType: WalletType) => {
    try {
      const connection = await connect(walletType)
      onConnect?.(connection)
    } catch (err) {
      // Error is handled by the FlowIntegrationProvider
      console.error('Wallet connection failed:', err)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      onDisconnect?.()
    } catch (err) {
      console.error('Wallet disconnection failed:', err)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <>
      {isConnected && currentUser ? (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm text-foreground font-medium">
              {formatAddress(currentUser.addr || '')}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleDisconnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Disconnecting...
              </>
            ) : (
              'Disconnect'
            )}
          </Button>
        </div>
      ) : (
        <Button 
          onClick={() => setIsDialogOpen(true)} 
          className="bg-white text-black hover:bg-white/90"
          disabled={isConnecting}
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-4 h-4 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
      )}

      <WalletSelectionDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onWalletSelect={handleConnect}
        isConnecting={isConnecting}
        error={error}
      />
    </>
  )
}
