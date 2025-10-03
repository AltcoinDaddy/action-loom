"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { Search, Info, RefreshCw, AlertCircle, Zap, Shield, Clock } from "lucide-react"
import { useActions } from "@/hooks/use-actions"
import { ActionMetadata, SecurityLevel } from "@/lib/types"

// Category icons mapping
const categoryIcons: Record<string, string> = {
  defi: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  nft: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  governance: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  token: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  bridge: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  oracle: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  default: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
}

// Security level colors
const securityLevelColors: Record<SecurityLevel, string> = {
  [SecurityLevel.LOW]: "text-green-500",
  [SecurityLevel.MEDIUM]: "text-yellow-500", 
  [SecurityLevel.HIGH]: "text-orange-500",
  [SecurityLevel.CRITICAL]: "text-red-500"
}

// Security level icons
const securityLevelIcons: Record<SecurityLevel, React.ComponentType<any>> = {
  [SecurityLevel.LOW]: Shield,
  [SecurityLevel.MEDIUM]: AlertCircle,
  [SecurityLevel.HIGH]: AlertCircle,
  [SecurityLevel.CRITICAL]: AlertCircle
}

export function ActionLibrary() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredActions, setFilteredActions] = useState<ActionMetadata[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const { 
    actions, 
    categories, 
    loading, 
    error, 
    searchActions, 
    getActionsByCategory, 
    refreshActions 
  } = useActions()

  // Group actions by category
  const actionsByCategory = useMemo(() => {
    const grouped: Record<string, ActionMetadata[]> = {}
    
    const actionsToGroup = searchQuery ? filteredActions : actions
    
    actionsToGroup.forEach(action => {
      if (!grouped[action.category]) {
        grouped[action.category] = []
      }
      grouped[action.category].push(action)
    })
    
    return grouped
  }, [actions, filteredActions, searchQuery])

  // Handle search with debouncing
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredActions([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchActions(searchQuery)
        setFilteredActions(results)
      } catch (err) {
        console.error('Search failed:', err)
        // Fallback to client-side filtering
        const filtered = actions.filter(action => 
          action.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          action.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          action.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        setFilteredActions(filtered)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, searchActions, actions])

  const onDragStart = (
    event: React.DragEvent,
    action: ActionMetadata
  ) => {
    event.dataTransfer.setData("application/reactflow", action.id)
    event.dataTransfer.setData("actionName", action.name)
    event.dataTransfer.setData("actionCategory", action.category)
    event.dataTransfer.setData("actionType", action.id) // Use full action ID as type
    event.dataTransfer.setData("actionMetadata", JSON.stringify(action))
    event.dataTransfer.effectAllowed = "move"
  }

  const formatGasEstimate = (gasEstimate: number): string => {
    if (gasEstimate < 1000) return gasEstimate.toString()
    if (gasEstimate < 1000000) return `${(gasEstimate / 1000).toFixed(1)}K`
    return `${(gasEstimate / 1000000).toFixed(1)}M`
  }

  const getCategoryIcon = (category: string): string => {
    return categoryIcons[category.toLowerCase()] || categoryIcons.default
  }

  const renderSecurityBadge = (action: ActionMetadata) => {
    const SecurityIcon = securityLevelIcons[action.securityLevel]
    const colorClass = securityLevelColors[action.securityLevel]
    
    return (
      <div className={`flex items-center gap-1 ${colorClass}`} title={`Security Level: ${action.securityLevel}`}>
        <SecurityIcon className="h-3 w-3" />
        <span className="text-xs uppercase">{action.securityLevel}</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-bold mb-3 text-foreground">Action Library</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Discovering Actions...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-border p-4">
          <h2 className="text-sm font-bold mb-3 text-foreground">Action Library</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-3">{error}</p>
            <button
              onClick={refreshActions}
              className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-foreground">Action Library</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {actions.length} actions
            </span>
            <button
              onClick={refreshActions}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              title="Refresh Actions"
            >
              <RefreshCw className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search actions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          {isSearching && (
            <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {Object.entries(actionsByCategory).length === 0 ? (
          <div className="text-center py-8">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery ? 'No actions found matching your search.' : 'No actions available.'}
            </p>
          </div>
        ) : (
          Object.entries(actionsByCategory).map(([categoryName, categoryActions]) => (
            <div key={categoryName} className="mb-6 last:mb-0">
              <div className="mb-3 flex items-center gap-2 px-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                  <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getCategoryIcon(categoryName)} />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-foreground capitalize">{categoryName}</h3>
                <div className="ml-auto text-xs text-muted-foreground">
                  {categoryActions.length}
                </div>
              </div>
              <div className="space-y-2">
                {categoryActions.map((action) => (
                  <div
                    key={action.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, action)}
                    className="group cursor-grab rounded-lg border border-border bg-card p-3 transition-all hover:border-primary hover:bg-primary/5 hover:shadow-lg hover:glow-secondary active:cursor-grabbing"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground mb-1">{action.name}</div>
                        <div className="text-xs text-muted-foreground leading-relaxed mb-2">
                          {action.description}
                        </div>
                      </div>
                      <svg
                        className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 flex-shrink-0 ml-2"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    
                    {/* Action metadata */}
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        {/* Gas estimate */}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          <span>{formatGasEstimate(action.gasEstimate)}</span>
                        </div>
                        
                        {/* Version */}
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>v{action.version}</span>
                        </div>
                      </div>
                      
                      {/* Security level */}
                      {renderSecurityBadge(action)}
                    </div>
                    
                    {/* Compatibility info */}
                    {action.compatibility.conflictsWith.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-border">
                        <div className="text-xs text-orange-500 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Conflicts with {action.compatibility.conflictsWith.length} action(s)</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
              <Info className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-1.5 text-foreground">How to Use</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Drag any action onto the canvas to add it to your workflow. Actions show gas estimates, security levels, and compatibility information. Connect actions by dragging from the bottom handle of one action to the top handle of another.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
