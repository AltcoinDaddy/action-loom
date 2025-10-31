/**
 * Parameter State Debugger
 * 
 * Utility for debugging parameter state changes and synchronization issues
 * in the WorkflowBuilder component.
 */

export interface ParameterStateChange {
  timestamp: number
  nodeId: string
  parameterName: string
  oldValue: any
  newValue: any
  source: 'user_input' | 'initialization' | 'cleanup' | 'validation'
  stackTrace?: string
}

export interface ParameterStateSnapshot {
  timestamp: number
  parameterValues: Record<string, Record<string, any>>
  nodeIds: string[]
  totalParameters: number
}

export class ParameterStateDebugger {
  private static instance: ParameterStateDebugger | null = null
  private changes: ParameterStateChange[] = []
  private snapshots: ParameterStateSnapshot[] = []
  private isEnabled: boolean = false
  private maxHistorySize: number = 1000

  private constructor() {
    // Enable debugging in development mode
    this.isEnabled = process.env.NODE_ENV === 'development'
  }

  static getInstance(): ParameterStateDebugger {
    if (!ParameterStateDebugger.instance) {
      ParameterStateDebugger.instance = new ParameterStateDebugger()
    }
    return ParameterStateDebugger.instance
  }

  /**
   * Enable or disable debugging
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    if (enabled) {
      console.log('🔍 Parameter State Debugger enabled')
    }
  }

  /**
   * Log a parameter value change
   */
  logParameterChange(
    nodeId: string,
    parameterName: string,
    oldValue: any,
    newValue: any,
    source: ParameterStateChange['source'] = 'user_input'
  ): void {
    if (!this.isEnabled) return

    const change: ParameterStateChange = {
      timestamp: Date.now(),
      nodeId,
      parameterName,
      oldValue,
      newValue,
      source,
      stackTrace: this.getStackTrace()
    }

    this.changes.push(change)

    // Trim history if it gets too large
    if (this.changes.length > this.maxHistorySize) {
      this.changes = this.changes.slice(-this.maxHistorySize / 2)
    }

    // Log to console with color coding
    const color = this.getSourceColor(source)
    console.log(
      `%c🔄 Parameter Change [${source}]`,
      `color: ${color}; font-weight: bold`,
      {
        nodeId,
        parameter: parameterName,
        oldValue,
        newValue,
        timestamp: new Date(change.timestamp).toISOString()
      }
    )
  }

  /**
   * Take a snapshot of the current parameter state
   */
  takeSnapshot(parameterValues: Record<string, Record<string, any>>): void {
    if (!this.isEnabled) return

    const nodeIds = Object.keys(parameterValues)
    const totalParameters = nodeIds.reduce(
      (total, nodeId) => total + Object.keys(parameterValues[nodeId] || {}).length,
      0
    )

    const snapshot: ParameterStateSnapshot = {
      timestamp: Date.now(),
      parameterValues: JSON.parse(JSON.stringify(parameterValues)), // Deep clone
      nodeIds,
      totalParameters
    }

    this.snapshots.push(snapshot)

    // Trim snapshots if too many
    if (this.snapshots.length > 50) {
      this.snapshots = this.snapshots.slice(-25)
    }

    console.log(
      '%c📸 Parameter State Snapshot',
      'color: #8b5cf6; font-weight: bold',
      {
        nodeCount: nodeIds.length,
        totalParameters,
        timestamp: new Date(snapshot.timestamp).toISOString()
      }
    )
  }

  /**
   * Log parameter state cleanup
   */
  logParameterCleanup(nodeId: string, cleanedParameters: string[]): void {
    if (!this.isEnabled) return

    console.log(
      '%c🧹 Parameter Cleanup',
      'color: #f59e0b; font-weight: bold',
      {
        nodeId,
        cleanedParameters,
        timestamp: new Date().toISOString()
      }
    )

    // Log individual parameter cleanups
    cleanedParameters.forEach(paramName => {
      this.logParameterChange(nodeId, paramName, 'existing_value', undefined, 'cleanup')
    })
  }

  /**
   * Validate parameter state consistency
   */
  validateStateConsistency(
    parameterValues: Record<string, Record<string, any>>,
    workflowNodeIds: string[]
  ): {
    isConsistent: boolean
    issues: string[]
  } {
    const issues: string[] = []
    const parameterNodeIds = Object.keys(parameterValues)

    // Check for orphaned parameter values (parameters for nodes that don't exist)
    const orphanedNodes = parameterNodeIds.filter(nodeId => !workflowNodeIds.includes(nodeId))
    if (orphanedNodes.length > 0) {
      issues.push(`Orphaned parameter values for nodes: ${orphanedNodes.join(', ')}`)
    }

    // Check for missing parameter values (nodes without parameter entries)
    const missingParameterNodes = workflowNodeIds.filter(nodeId => !parameterNodeIds.includes(nodeId))
    if (missingParameterNodes.length > 0) {
      issues.push(`Missing parameter entries for nodes: ${missingParameterNodes.join(', ')}`)
    }

    // Check for null/undefined parameter objects
    parameterNodeIds.forEach(nodeId => {
      if (!parameterValues[nodeId] || typeof parameterValues[nodeId] !== 'object') {
        issues.push(`Invalid parameter object for node: ${nodeId}`)
      }
    })

    const isConsistent = issues.length === 0

    if (!isConsistent && this.isEnabled) {
      console.warn(
        '%c⚠️ Parameter State Inconsistency Detected',
        'color: #ef4444; font-weight: bold',
        {
          issues,
          parameterNodeIds,
          workflowNodeIds,
          timestamp: new Date().toISOString()
        }
      )
    }

    return { isConsistent, issues }
  }

  /**
   * Get recent parameter changes for a specific node
   */
  getNodeChanges(nodeId: string, limit: number = 10): ParameterStateChange[] {
    return this.changes
      .filter(change => change.nodeId === nodeId)
      .slice(-limit)
  }

  /**
   * Get all recent changes
   */
  getRecentChanges(limit: number = 20): ParameterStateChange[] {
    return this.changes.slice(-limit)
  }

  /**
   * Get recent snapshots
   */
  getRecentSnapshots(limit: number = 5): ParameterStateSnapshot[] {
    return this.snapshots.slice(-limit)
  }

  /**
   * Clear debugging history
   */
  clearHistory(): void {
    this.changes = []
    this.snapshots = []
    if (this.isEnabled) {
      console.log('%c🗑️ Parameter debugging history cleared', 'color: #6b7280')
    }
  }

  /**
   * Export debugging data for analysis
   */
  exportDebugData(): {
    changes: ParameterStateChange[]
    snapshots: ParameterStateSnapshot[]
    summary: {
      totalChanges: number
      totalSnapshots: number
      timeRange: { start: number; end: number } | null
      nodeIds: string[]
      parameterNames: string[]
    }
  } {
    const nodeIds = [...new Set(this.changes.map(c => c.nodeId))]
    const parameterNames = [...new Set(this.changes.map(c => c.parameterName))]
    const timestamps = this.changes.map(c => c.timestamp)
    
    return {
      changes: this.changes,
      snapshots: this.snapshots,
      summary: {
        totalChanges: this.changes.length,
        totalSnapshots: this.snapshots.length,
        timeRange: timestamps.length > 0 
          ? { start: Math.min(...timestamps), end: Math.max(...timestamps) }
          : null,
        nodeIds,
        parameterNames
      }
    }
  }

  private getStackTrace(): string {
    try {
      throw new Error()
    } catch (e) {
      return (e as Error).stack?.split('\n').slice(3, 8).join('\n') || ''
    }
  }

  private getSourceColor(source: ParameterStateChange['source']): string {
    switch (source) {
      case 'user_input': return '#10b981'
      case 'initialization': return '#3b82f6'
      case 'cleanup': return '#f59e0b'
      case 'validation': return '#8b5cf6'
      default: return '#6b7280'
    }
  }
}

// Export singleton instance
export const parameterStateDebugger = ParameterStateDebugger.getInstance()

// Global debugging functions for console access
if (typeof window !== 'undefined') {
  (window as any).debugParameterState = {
    enable: () => parameterStateDebugger.setEnabled(true),
    disable: () => parameterStateDebugger.setEnabled(false),
    getChanges: (limit?: number) => parameterStateDebugger.getRecentChanges(limit),
    getSnapshots: (limit?: number) => parameterStateDebugger.getRecentSnapshots(limit),
    getNodeChanges: (nodeId: string, limit?: number) => parameterStateDebugger.getNodeChanges(nodeId, limit),
    validate: (parameterValues: any, nodeIds: string[]) => 
      parameterStateDebugger.validateStateConsistency(parameterValues, nodeIds),
    export: () => parameterStateDebugger.exportDebugData(),
    clear: () => parameterStateDebugger.clearHistory()
  }
}