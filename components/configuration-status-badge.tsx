"use client"

import { memo } from "react"
import { CheckCircle, AlertCircle, Clock, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type ConfigurationStatus = 'unconfigured' | 'partial' | 'complete' | 'error'

interface ConfigurationStatusBadgeProps {
  status: ConfigurationStatus
  missingParameterCount?: number
  className?: string
}

const statusConfig = {
  unconfigured: {
    icon: Clock,
    label: 'Configure',
    variant: 'outline' as const,
    className: 'border-orange-500 text-orange-700 bg-orange-100 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-600 font-semibold',
  },
  partial: {
    icon: AlertCircle,
    label: 'Partial',
    variant: 'outline' as const,
    className: 'border-yellow-500 text-yellow-700 bg-yellow-100 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-600 font-semibold',
  },
  complete: {
    icon: CheckCircle,
    label: 'Complete',
    variant: 'outline' as const,
    className: 'border-green-500 text-green-700 bg-green-100 dark:bg-green-950/30 dark:text-green-400 dark:border-green-600 font-semibold',
  },
  error: {
    icon: XCircle,
    label: 'Error',
    variant: 'destructive' as const,
    className: 'font-semibold',
  },
} as const

export const ConfigurationStatusBadge = memo(({ 
  status, 
  missingParameterCount,
  className 
}: ConfigurationStatusBadgeProps) => {
  const config = statusConfig[status]
  const Icon = config.icon
  
  const getLabel = () => {
    if (status === 'partial' && missingParameterCount) {
      return `${missingParameterCount} missing`
    }
    return config.label
  }

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "text-xs font-medium transition-colors flex items-center gap-1 px-2 py-1",
        config.className,
        className
      )}
    >
      <Icon className="h-3 w-3 flex-shrink-0" />
      <span>{getLabel()}</span>
    </Badge>
  )
})

ConfigurationStatusBadge.displayName = "ConfigurationStatusBadge"