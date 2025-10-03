"use client"

import { memo, useCallback, useState, useEffect, useMemo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Zap, Shield, AlertCircle, Settings } from "lucide-react"
import { ActionMetadata, SecurityLevel } from "@/lib/types"
import { ConfigurationStatusBadge, type ConfigurationStatus } from "@/components/configuration-status-badge"
// Tooltip temporarily disabled to prevent infinite loop

const actionIcons: Record<string, string> = {
  swap: "M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4",
  stake: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  mint: "M12 4v16m8-8H4",
  vote: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  transfer: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  liquidity: "M13 10V3L4 14h7v7l9-11h-7z",
  bridge: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  oracle: "M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  default: "M13 10V3L4 14h7v7l9-11h-7z",
}

// Security level colors
const securityLevelColors: Record<SecurityLevel, string> = {
  [SecurityLevel.LOW]: "text-green-500",
  [SecurityLevel.MEDIUM]: "text-yellow-500",
  [SecurityLevel.HIGH]: "text-orange-500",
  [SecurityLevel.CRITICAL]: "text-red-500"
}

const actionGradients: Record<string, string> = {
  defi: "from-primary via-primary/80 to-primary/60",
  nft: "from-secondary via-secondary/80 to-secondary/60",
  governance: "from-chart-3 via-chart-3/80 to-chart-3/60",
  default: "from-primary via-primary/80 to-primary/60",
}

interface ActionNodeData {
  label: string
  type: string
  category: string
  metadata?: ActionMetadata | null
  hasValidationErrors?: boolean
  onConfigureParameters?: (id: string, metadata: ActionMetadata) => void
}

// Helper function to get settings button className based on configuration status
const getSettingsButtonClassName = (configurationStatus: ConfigurationStatus): string => {
  const baseClasses = "p-2.5 rounded-lg transition-all duration-200 shadow-md border-2 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary/50"
  
  switch (configurationStatus) {
    case 'unconfigured':
      return `${baseClasses} bg-gradient-to-br from-orange-100 to-orange-200 text-orange-700 hover:from-orange-200 hover:to-orange-300 border-orange-400 dark:from-orange-950/40 dark:to-orange-950/60 dark:text-orange-400 dark:hover:from-orange-950/60 dark:hover:to-orange-950/80 dark:border-orange-600 animate-pulse`
    case 'error':
      return `${baseClasses} bg-gradient-to-br from-red-100 to-red-200 text-red-700 hover:from-red-200 hover:to-red-300 border-red-400 dark:from-red-950/40 dark:to-red-950/60 dark:text-red-400 dark:hover:from-red-950/60 dark:hover:to-red-950/80 dark:border-red-600`
    case 'partial':
      return `${baseClasses} bg-gradient-to-br from-yellow-100 to-yellow-200 text-yellow-700 hover:from-yellow-200 hover:to-yellow-300 border-yellow-400 dark:from-yellow-950/40 dark:to-yellow-950/60 dark:text-yellow-400 dark:hover:from-yellow-950/60 dark:hover:to-yellow-950/80 dark:border-yellow-600`
    default:
      return `${baseClasses} bg-gradient-to-br from-muted to-muted/80 text-muted-foreground hover:from-primary/10 hover:to-primary/20 hover:text-primary border-border hover:border-primary`
  }
}

const ActionNodeComponent = ({ data, id }: NodeProps & { data: ActionNodeData }) => {
  const metadata = data.metadata as ActionMetadata | null
  const iconPath = actionIcons[data.type as string] || actionIcons.default
  const gradient = actionGradients[data.category as string] || actionGradients.default

  // Get validation status and parameter configuration handler from data
  const hasValidationErrors = Boolean(data.hasValidationErrors)
  const onConfigureParameters = data.onConfigureParameters

  // Context menu state
  const [showContextMenu, setShowContextMenu] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })

  // Configuration status - determine based on metadata and current state
  const configurationStatus = useMemo((): ConfigurationStatus => {
    if (!metadata?.parameters || metadata.parameters.length === 0) {
      return 'complete' // No parameters needed
    }

    if (hasValidationErrors) {
      return 'error'
    }

    const requiredParams = metadata.parameters.filter(p => p.required)
    const configuredParams = requiredParams.filter(p => p.value && p.value.trim() !== '')

    if (configuredParams.length === 0) {
      return 'unconfigured'
    } else if (configuredParams.length < requiredParams.length) {
      return 'partial'
    } else {
      return 'complete'
    }
  }, [metadata?.parameters, hasValidationErrors])

  const requiredParams = useMemo(() => metadata?.parameters?.filter(p => p.required) || [], [metadata?.parameters])
  const configuredParams = useMemo(() => 
    metadata?.parameters?.filter(p => p.required && p.value && p.value.trim() !== '') || [], 
    [metadata?.parameters]
  )
  const missingParameterCount = requiredParams.length - configuredParams.length

  const needsConfiguration = useMemo(() =>
    metadata && metadata.parameters && metadata.parameters.some(p => p.required),
    [metadata?.parameters]
  )
  const showConfigurationBadge = needsConfiguration || hasValidationErrors

  const formatGasEstimate = (gasEstimate: number): string => {
    if (gasEstimate < 1000) return gasEstimate.toString()
    if (gasEstimate < 1000000) return `${(gasEstimate / 1000).toFixed(1)}K`
    return `${(gasEstimate / 1000000).toFixed(1)}M`
  }

  // Interaction handlers
  const handleSingleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()

    // Only open configuration if the action has configurable parameters
    if (metadata && onConfigureParameters && needsConfiguration) {
      onConfigureParameters(id, metadata)
    }
  }, [id, metadata, onConfigureParameters, needsConfiguration])

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()

    // Double-click always opens configuration if available
    if (metadata && onConfigureParameters) {
      onConfigureParameters(id, metadata)
    }
  }, [id, metadata, onConfigureParameters])

  const handleRightClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    // Show context menu only if configuration is available
    if (metadata && onConfigureParameters) {
      setContextMenuPosition({ x: event.clientX, y: event.clientY })
      setShowContextMenu(true)
    }
  }, [metadata, onConfigureParameters])

  const handleContextMenuAction = useCallback((action: string) => {
    setShowContextMenu(false)

    if (action === 'configure' && metadata && onConfigureParameters) {
      onConfigureParameters(id, metadata)
    }
  }, [id, metadata, onConfigureParameters])

  const handleSettingsClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation()
    event.preventDefault()

    if (metadata && onConfigureParameters) {
      onConfigureParameters(id, metadata)
    }
  }, [id, metadata, onConfigureParameters])

  // Close context menu when clicking outside
  const handleClickOutside = useCallback(() => {
    setShowContextMenu(false)
  }, [])

  // Close context menu on escape key
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setShowContextMenu(false)
    }
  }, [])

  // Add event listeners for context menu
  useEffect(() => {
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.removeEventListener('click', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [showContextMenu, handleClickOutside, handleKeyDown])

  const getSecurityIcon = (level: SecurityLevel) => {
    switch (level) {
      case SecurityLevel.LOW:
        return Shield
      case SecurityLevel.MEDIUM:
      case SecurityLevel.HIGH:
      case SecurityLevel.CRITICAL:
        return AlertCircle
      default:
        return Shield
    }
  }

  const nodeContent = (
    <div className="group relative">
      <div
        className={`absolute inset-0 rounded-xl bg-gradient-to-br ${gradient} opacity-20 blur-xl transition-opacity group-hover:opacity-40`}
      />

      <div
        className={`relative rounded-xl border-2 bg-card px-5 py-4 shadow-2xl transition-all duration-200 min-w-[200px] select-none ${
          // Interactive styling for configurable actions
          metadata && onConfigureParameters
            ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98] hover:shadow-xl'
            : 'cursor-default'
          } ${
          // Status-based styling
          configurationStatus === 'error'
            ? 'border-red-500 group-hover:border-red-400 shadow-red-500/20 hover:shadow-red-500/40'
            : configurationStatus === 'unconfigured'
              ? 'border-dashed border-orange-500 group-hover:border-orange-400 shadow-orange-500/20 hover:shadow-orange-500/40 animate-pulse'
              : configurationStatus === 'partial'
                ? 'border-yellow-500 group-hover:border-yellow-400 shadow-yellow-500/20 hover:shadow-yellow-500/40'
                : configurationStatus === 'complete'
                  ? 'border-green-500 group-hover:border-green-400 shadow-green-500/20 hover:shadow-green-500/40'
                  : 'border-border group-hover:border-primary hover:shadow-primary/40'
          } ${
          // Enhanced interactivity indicators
          metadata && onConfigureParameters && needsConfiguration
            ? 'ring-2 ring-transparent hover:ring-primary/20 focus-within:ring-primary/30'
            : ''
          }`}
        onClick={handleSingleClick}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleRightClick}
        title={
          metadata && onConfigureParameters
            ? needsConfiguration
              ? "⚙️ Click to configure parameters • Right-click for options • Double-click to configure"
              : "⚙️ Click to view/edit configuration • Right-click for options"
            : undefined
        }
        role={metadata && onConfigureParameters ? "button" : undefined}
        tabIndex={metadata && onConfigureParameters ? 0 : undefined}
        onKeyDown={(e) => {
          if (metadata && onConfigureParameters && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onConfigureParameters(id, metadata)
          }
        }}
      >
        {/* Configuration status indicator for unconfigured actions */}
        {configurationStatus === 'unconfigured' && (
          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs px-3 py-1.5 rounded-full font-semibold shadow-lg animate-bounce">
            ⚙️ Setup Required
          </div>
        )}

        {/* Interactive indicator for all configurable actions */}
        {metadata && onConfigureParameters && (
          <>
            {/* Hover indicator */}
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-card shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center">
              <Settings className="h-2.5 w-2.5 text-white" />
            </div>

            {/* Click instruction overlay */}
            {needsConfiguration && (
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <div className="bg-primary/90 text-white text-xs px-2 py-1 rounded-md font-medium shadow-lg backdrop-blur-sm">
                  Click to Configure
                </div>
              </div>
            )}
          </>
        )}

        <Handle
          type="target"
          position={Position.Top}
          className="!h-3 !w-3 !rounded-full !border-2 !border-secondary !bg-secondary glow-secondary"
        />

        <div className="flex items-start gap-3 mb-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} shadow-lg flex-shrink-0`}
          >
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold truncate">{data.label}</div>
              {metadata && onConfigureParameters && (
                <button
                  onClick={handleSettingsClick}
                  className={getSettingsButtonClassName(configurationStatus)}
                  title={`Configure Parameters - ${
                    configurationStatus === 'unconfigured'
                      ? 'Setup Required'
                      : configurationStatus === 'partial'
                        ? 'Complete Configuration'
                        : configurationStatus === 'error'
                          ? 'Fix Configuration Errors'
                          : 'Edit Configuration'
                  }`}
                  aria-label={`Configure parameters for ${data.label}`}
                >
                  <Settings className="h-5 w-5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1">
              <div className="flex flex-col gap-1">
                {data.category && (
                  <div className="text-xs text-muted-foreground capitalize">{data.category}</div>
                )}
                {metadata?.version && (
                  <div className="text-xs text-muted-foreground">v{metadata.version}</div>
                )}
              </div>
              {showConfigurationBadge && (
                <ConfigurationStatusBadge
                  status={configurationStatus}
                  missingParameterCount={missingParameterCount}
                />
              )}
            </div>
          </div>
        </div>

        {/* Action metadata */}
        {metadata && (
          <div className="space-y-2 text-xs">
            {/* Gas estimate and security level */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Zap className="h-3 w-3" />
                <span>{formatGasEstimate(metadata.gasEstimate)}</span>
              </div>

              <div className={`flex items-center gap-1 ${securityLevelColors[metadata.securityLevel]}`}>
                {(() => {
                  const SecurityIcon = getSecurityIcon(metadata.securityLevel)
                  return <SecurityIcon className="h-3 w-3" />
                })()}
                <span className="uppercase">{metadata.securityLevel}</span>
              </div>
            </div>

            {/* Validation status */}
            {hasValidationErrors && (
              <div className="flex items-center gap-1 text-red-500">
                <AlertCircle className="h-3 w-3" />
                <span>Parameter errors</span>
              </div>
            )}

            {/* Compatibility warnings */}
            {metadata.compatibility.conflictsWith.length > 0 && (
              <div className="flex items-center gap-1 text-orange-500">
                <AlertCircle className="h-3 w-3" />
                <span>Conflicts: {metadata.compatibility.conflictsWith.length}</span>
              </div>
            )}

            {/* Required capabilities */}
            {metadata.compatibility.requiredCapabilities.length > 0 && (
              <div className="text-muted-foreground">
                <span>Requires: {metadata.compatibility.requiredCapabilities.slice(0, 2).join(', ')}</span>
                {metadata.compatibility.requiredCapabilities.length > 2 && (
                  <span> +{metadata.compatibility.requiredCapabilities.length - 2}</span>
                )}
              </div>
            )}
          </div>
        )}

        <Handle
          type="source"
          position={Position.Bottom}
          className="!h-3 !w-3 !rounded-full !border-2 !border-primary !bg-primary glow-primary"
        />
      </div>
    </div>
  )

  // Context menu component
  const contextMenu = showContextMenu && (
    <div
      className="fixed z-50 min-w-[180px] rounded-lg border border-border bg-card shadow-xl backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-200"
      style={{
        left: Math.min(contextMenuPosition.x, window.innerWidth - 200), // Prevent overflow
        top: Math.min(contextMenuPosition.y, window.innerHeight - 100),
      }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      aria-label="Action configuration menu"
    >
      <div className="p-1">
        <button
          onClick={() => handleContextMenuAction('configure')}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors focus:bg-muted focus:outline-none"
          role="menuitem"
          autoFocus
        >
          <Settings className="h-4 w-4 text-primary" />
          <div className="flex flex-col items-start">
            <span className="font-medium">Configure Parameters</span>
            <span className="text-xs text-muted-foreground">
              {configurationStatus === 'unconfigured'
                ? 'Set up required parameters'
                : configurationStatus === 'partial'
                  ? 'Complete missing parameters'
                  : configurationStatus === 'error'
                    ? 'Fix configuration errors'
                    : 'Modify configuration'
              }
            </span>
          </div>
        </button>

        {/* Additional context menu items could go here */}
        <div className="my-1 h-px bg-border" />

        <div className="px-3 py-2">
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center gap-2 mb-1">
              <span>💡 Tip:</span>
            </div>
            <div className="text-xs leading-relaxed">
              Double-click the action node for quick access to configuration
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {nodeContent}
      {contextMenu}
    </>
  )
}

// Memoize the component with a proper comparison function
export const ActionNode = memo(ActionNodeComponent, (prevProps, nextProps) => {
  // Compare the essential props that should trigger re-renders
  return (
    prevProps.id === nextProps.id &&
    prevProps.data.label === nextProps.data.label &&
    prevProps.data.type === nextProps.data.type &&
    prevProps.data.category === nextProps.data.category &&
    prevProps.data.hasValidationErrors === nextProps.data.hasValidationErrors &&
    prevProps.data.metadata === nextProps.data.metadata &&
    prevProps.data.onConfigureParameters === nextProps.data.onConfigureParameters
  )
})

ActionNode.displayName = "ActionNode"
