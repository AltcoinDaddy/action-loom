"use client"

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { ArrowRight, AlertTriangle, CheckCircle, Zap } from 'lucide-react'
import { ParameterConnection } from '@/lib/data-flow-analyzer'
import { cn } from '@/lib/utils'

export interface DataFlowConnectionIndicatorProps {
  connection: ParameterConnection
  className?: string
  showDetails?: boolean
}

export function DataFlowConnectionIndicator({
  connection,
  className,
  showDetails = false
}: DataFlowConnectionIndicatorProps) {
  const strengthColor = connection.connectionStrength > 0.8 
    ? 'text-green-500' 
    : connection.connectionStrength > 0.5 
    ? 'text-yellow-500' 
    : 'text-red-500'

  const connectionColor = connection.isTypeCompatible 
    ? 'border-green-200 bg-green-50 dark:bg-green-900/20' 
    : 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20'

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded border",
      connectionColor,
      className
    )}>
      {/* Source */}
      <Badge variant="outline" className="text-xs">
        {connection.sourceActionId}
      </Badge>
      
      {/* Connection indicator */}
      <div className="flex items-center gap-1">
        <ArrowRight className="h-3 w-3 text-muted-foreground" />
        
        {/* Connection strength */}
        <div className="flex items-center gap-1">
          <Zap className={cn("h-3 w-3", strengthColor)} />
          <span className="text-xs text-muted-foreground">
            {Math.round(connection.connectionStrength * 100)}%
          </span>
        </div>
        
        {/* Type compatibility */}
        {connection.isTypeCompatible ? (
          <CheckCircle className="h-3 w-3 text-green-500" />
        ) : (
          <AlertTriangle className="h-3 w-3 text-yellow-500" />
        )}
      </div>
      
      {/* Target */}
      <Badge variant="secondary" className="text-xs">
        {connection.targetActionId}
      </Badge>

      {/* Details */}
      {showDetails && (
        <div className="ml-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              <code className="bg-muted px-1 rounded">{connection.sourceType}</code>
              {" → "}
              <code className="bg-muted px-1 rounded">{connection.targetType}</code>
            </span>
            
            {connection.transformationSuggestion && (
              <span className="text-yellow-600 dark:text-yellow-400">
                💡 {connection.transformationSuggestion}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export interface DataFlowConnectionsListProps {
  connections: ParameterConnection[]
  className?: string
  maxConnections?: number
}

export function DataFlowConnectionsList({
  connections,
  className,
  maxConnections = 5
}: DataFlowConnectionsListProps) {
  const displayConnections = connections.slice(0, maxConnections)
  const remainingCount = connections.length - maxConnections

  if (connections.length === 0) {
    return (
      <div className={cn("text-center text-sm text-muted-foreground p-4", className)}>
        No data flow connections detected
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {displayConnections.map((connection) => (
        <DataFlowConnectionIndicator
          key={connection.id}
          connection={connection}
          showDetails
        />
      ))}
      
      {remainingCount > 0 && (
        <div className="text-center text-xs text-muted-foreground p-2">
          +{remainingCount} more connections
        </div>
      )}
    </div>
  )
}