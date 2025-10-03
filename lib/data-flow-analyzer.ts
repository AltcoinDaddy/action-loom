import {
  ParsedWorkflow,
  ParsedAction,
  ActionMetadata,
  ActionOutput,
  ValidationError,
  ValidationErrorType
} from './types'

// Data flow analysis types
export interface DataFlowAnalysisResult {
  dependencies: ActionDependencyMap
  connections: ParameterConnection[]
  circularDependencies: CircularDependency[]
  unresolvedReferences: UnresolvedReference[]
  typeCompatibilityIssues: TypeCompatibilityIssue[]
  orphanedActions: string[]
  executionOrder: string[]
  dataFlowGraph: DataFlowGraph
}

export interface ActionDependencyMap {
  [actionId: string]: ActionDependency
}

export interface ActionDependency {
  actionId: string
  dependsOn: string[]
  provides: string[]
  parameterDependencies: ParameterDependency[]
  outputDependents: OutputDependent[]
}

export interface ParameterDependency {
  parameterName: string
  sourceActionId: string
  sourceOutputName: string
  isTypeCompatible: boolean
  transformationNeeded: boolean
  transformationSuggestion?: string
}

export interface OutputDependent {
  outputName: string
  dependentActions: Array<{
    actionId: string
    parameterName: string
    isTypeCompatible: boolean
  }>
}

export interface ParameterConnection {
  id: string
  sourceActionId: string
  sourceOutputName: string
  targetActionId: string
  targetParameterName: string
  sourceType: string
  targetType: string
  isTypeCompatible: boolean
  transformationSuggestion?: string
  connectionStrength: number // 0-1, based on type compatibility and usage
}

export interface CircularDependency {
  cycle: string[]
  description: string
  severity: 'warning' | 'error'
  breakingSuggestions: string[]
}

export interface UnresolvedReference {
  actionId: string
  parameterName: string
  referencedAction: string
  referencedOutput: string
  reason: string
  suggestions: string[]
}

export interface TypeCompatibilityIssue {
  sourceAction: string
  sourceOutput: string
  targetAction: string
  targetParameter: string
  sourceType: string
  targetType: string
  canConvert: boolean
  conversionComplexity: 'simple' | 'moderate' | 'complex'
  suggestion?: string
  autoFixAvailable: boolean
}

export interface DataFlowGraph {
  nodes: DataFlowNode[]
  edges: DataFlowEdge[]
  clusters: ActionCluster[]
}

export interface DataFlowNode {
  id: string
  type: 'action' | 'parameter' | 'output'
  actionId: string
  label: string
  metadata: {
    actionType?: string
    parameterType?: string
    outputType?: string
    isRequired?: boolean
    hasValue?: boolean
  }
  position?: { x: number; y: number }
}

export interface DataFlowEdge {
  id: string
  source: string
  target: string
  type: 'parameter-dependency' | 'execution-order' | 'data-flow'
  metadata: {
    parameterName?: string
    outputName?: string
    isTypeCompatible: boolean
    transformationNeeded: boolean
    strength: number
  }
  style?: {
    color: string
    width: number
    dashArray?: string
  }
}

export interface ActionCluster {
  id: string
  actionIds: string[]
  type: 'sequential' | 'parallel' | 'conditional'
  description: string
}

/**
 * DataFlowAnalyzer provides comprehensive analysis of parameter dependencies
 * and data flow within workflows
 */
export class DataFlowAnalyzer {
  
  /**
   * Performs complete data flow analysis on a workflow
   */
  analyzeDataFlow(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): DataFlowAnalysisResult {
    // Build dependency map
    const dependencies = this.buildDependencyMap(workflow, actionMetadata, parameterValues)
    
    // Analyze parameter connections
    const connections = this.analyzeParameterConnections(workflow, actionMetadata, parameterValues)
    
    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(dependencies)
    
    // Find unresolved references
    const unresolvedReferences = this.findUnresolvedReferences(workflow, actionMetadata, parameterValues)
    
    // Check type compatibility
    const typeCompatibilityIssues = this.analyzeTypeCompatibility(workflow, actionMetadata, parameterValues)
    
    // Find orphaned actions
    const orphanedActions = this.findOrphanedActions(workflow, dependencies)
    
    // Calculate optimal execution order
    const executionOrder = this.calculateExecutionOrder(workflow, dependencies)
    
    // Build data flow graph for visualization
    const dataFlowGraph = this.buildDataFlowGraph(workflow, actionMetadata, parameterValues, connections)

    return {
      dependencies,
      connections,
      circularDependencies,
      unresolvedReferences,
      typeCompatibilityIssues,
      orphanedActions,
      executionOrder,
      dataFlowGraph
    }
  }

  /**
   * Builds a comprehensive dependency map for all actions
   */
  private buildDependencyMap(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): ActionDependencyMap {
    const dependencies: ActionDependencyMap = {}

    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      if (!metadata) continue

      const actionParams = parameterValues[action.id] || {}
      const dependsOn: string[] = []
      const provides: string[] = []
      const parameterDependencies: ParameterDependency[] = []
      const outputDependents: OutputDependent[] = []

      // Analyze parameter dependencies
      for (const parameter of metadata.parameters) {
        const paramValue = actionParams[parameter.name]
        
        if (this.isParameterReference(paramValue)) {
          const { actionId: sourceActionId, outputName } = this.parseParameterReference(paramValue)
          
          if (sourceActionId && outputName && sourceActionId !== action.id) {
            dependsOn.push(sourceActionId)
            
            // Get source output type for compatibility check
            const sourceMetadata = actionMetadata[
              workflow.actions.find(a => a.id === sourceActionId)?.actionType || ''
            ]
            const sourceOutput = sourceMetadata?.outputs.find(o => o.name === outputName)
            
            const isTypeCompatible = sourceOutput ? 
              this.areTypesCompatible(sourceOutput.type, parameter.type) : false
            
            parameterDependencies.push({
              parameterName: parameter.name,
              sourceActionId,
              sourceOutputName: outputName,
              isTypeCompatible,
              transformationNeeded: !isTypeCompatible && sourceOutput ? 
                this.canConvertTypes(sourceOutput.type, parameter.type) : false,
              transformationSuggestion: sourceOutput && !isTypeCompatible ? 
                this.getTransformationSuggestion(sourceOutput.type, parameter.type) : undefined
            })
          }
        }
      }

      // Analyze what this action provides
      for (const output of metadata.outputs) {
        provides.push(`${action.id}.${output.name}`)
        
        // Find actions that depend on this output
        const dependentActions = workflow.actions
          .filter(a => a.id !== action.id)
          .map(dependentAction => {
            const depMetadata = actionMetadata[dependentAction.actionType]
            if (!depMetadata) return null
            
            const depParams = parameterValues[dependentAction.id] || {}
            
            for (const param of depMetadata.parameters) {
              const paramValue = depParams[param.name]
              if (this.isParameterReference(paramValue)) {
                const { actionId, outputName } = this.parseParameterReference(paramValue)
                if (actionId === action.id && outputName === output.name) {
                  return {
                    actionId: dependentAction.id,
                    parameterName: param.name,
                    isTypeCompatible: this.areTypesCompatible(output.type, param.type)
                  }
                }
              }
            }
            return null
          })
          .filter(Boolean) as Array<{
            actionId: string
            parameterName: string
            isTypeCompatible: boolean
          }>

        if (dependentActions.length > 0) {
          outputDependents.push({
            outputName: output.name,
            dependentActions
          })
        }
      }

      dependencies[action.id] = {
        actionId: action.id,
        dependsOn: [...new Set(dependsOn)],
        provides,
        parameterDependencies,
        outputDependents
      }
    }

    return dependencies
  }

  /**
   * Analyzes all parameter connections in the workflow
   */
  private analyzeParameterConnections(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): ParameterConnection[] {
    const connections: ParameterConnection[] = []

    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      if (!metadata) continue

      const actionParams = parameterValues[action.id] || {}

      for (const parameter of metadata.parameters) {
        const paramValue = actionParams[parameter.name]
        
        if (this.isParameterReference(paramValue)) {
          const { actionId: sourceActionId, outputName } = this.parseParameterReference(paramValue)
          
          if (sourceActionId && outputName) {
            const sourceMetadata = actionMetadata[
              workflow.actions.find(a => a.id === sourceActionId)?.actionType || ''
            ]
            const sourceOutput = sourceMetadata?.outputs.find(o => o.name === outputName)
            
            if (sourceOutput) {
              const isTypeCompatible = this.areTypesCompatible(sourceOutput.type, parameter.type)
              const connectionStrength = this.calculateConnectionStrength(
                sourceOutput.type, 
                parameter.type, 
                isTypeCompatible
              )

              connections.push({
                id: `${sourceActionId}.${outputName}->${action.id}.${parameter.name}`,
                sourceActionId,
                sourceOutputName: outputName,
                targetActionId: action.id,
                targetParameterName: parameter.name,
                sourceType: sourceOutput.type,
                targetType: parameter.type,
                isTypeCompatible,
                transformationSuggestion: !isTypeCompatible ? 
                  this.getTransformationSuggestion(sourceOutput.type, parameter.type) : undefined,
                connectionStrength
              })
            }
          }
        }
      }
    }

    return connections
  }

  /**
   * Detects circular dependencies with enhanced analysis
   */
  private detectCircularDependencies(dependencies: ActionDependencyMap): CircularDependency[] {
    const circularDependencies: CircularDependency[] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (actionId: string, path: string[]): void => {
      if (recursionStack.has(actionId)) {
        const cycleStart = path.indexOf(actionId)
        const cycle = path.slice(cycleStart).concat(actionId)
        
        // Determine severity based on cycle length and complexity
        const severity: 'warning' | 'error' = cycle.length <= 3 ? 'warning' : 'error'
        
        circularDependencies.push({
          cycle,
          description: `Circular dependency detected: ${cycle.join(' → ')}`,
          severity,
          breakingSuggestions: this.generateBreakingSuggestions(cycle, dependencies)
        })
        return
      }

      if (visited.has(actionId)) return

      visited.add(actionId)
      recursionStack.add(actionId)

      const dependency = dependencies[actionId]
      if (dependency) {
        for (const dependentAction of dependency.dependsOn) {
          dfs(dependentAction, [...path, actionId])
        }
      }

      recursionStack.delete(actionId)
    }

    for (const actionId of Object.keys(dependencies)) {
      if (!visited.has(actionId)) {
        dfs(actionId, [])
      }
    }

    return circularDependencies
  }

  /**
   * Enhanced type compatibility analysis
   */
  private analyzeTypeCompatibility(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): TypeCompatibilityIssue[] {
    const issues: TypeCompatibilityIssue[] = []

    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      if (!metadata) continue

      const actionParams = parameterValues[action.id] || {}

      for (const parameter of metadata.parameters) {
        const paramValue = actionParams[parameter.name]
        
        if (this.isParameterReference(paramValue)) {
          const { actionId: sourceAction, outputName } = this.parseParameterReference(paramValue)
          
          if (!sourceAction || !outputName) continue

          const sourceMetadata = actionMetadata[
            workflow.actions.find(a => a.id === sourceAction)?.actionType || ''
          ]
          
          if (!sourceMetadata) continue

          const sourceOutput = sourceMetadata.outputs.find(output => output.name === outputName)
          if (!sourceOutput) continue

          const canConvert = this.canConvertTypes(sourceOutput.type, parameter.type)
          const conversionComplexity = this.getConversionComplexity(sourceOutput.type, parameter.type)
          
          if (!this.areTypesCompatible(sourceOutput.type, parameter.type)) {
            issues.push({
              sourceAction,
              sourceOutput: outputName,
              targetAction: action.id,
              targetParameter: parameter.name,
              sourceType: sourceOutput.type,
              targetType: parameter.type,
              canConvert,
              conversionComplexity,
              suggestion: this.getTransformationSuggestion(sourceOutput.type, parameter.type),
              autoFixAvailable: canConvert && conversionComplexity === 'simple'
            })
          }
        }
      }
    }

    return issues
  }

  /**
   * Builds a visual data flow graph
   */
  private buildDataFlowGraph(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>,
    connections: ParameterConnection[]
  ): DataFlowGraph {
    const nodes: DataFlowNode[] = []
    const edges: DataFlowEdge[] = []
    const clusters: ActionCluster[] = []

    // Create action nodes
    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      
      nodes.push({
        id: action.id,
        type: 'action',
        actionId: action.id,
        label: action.name || metadata?.name || action.actionType,
        metadata: {
          actionType: action.actionType
        },
        position: action.position
      })

      // Create parameter and output nodes for detailed view
      if (metadata) {
        for (const param of metadata.parameters) {
          nodes.push({
            id: `${action.id}.param.${param.name}`,
            type: 'parameter',
            actionId: action.id,
            label: param.name,
            metadata: {
              parameterType: param.type,
              isRequired: param.required,
              hasValue: !!parameterValues[action.id]?.[param.name]
            }
          })
        }

        for (const output of metadata.outputs) {
          nodes.push({
            id: `${action.id}.output.${output.name}`,
            type: 'output',
            actionId: action.id,
            label: output.name,
            metadata: {
              outputType: output.type
            }
          })
        }
      }
    }

    // Create edges from connections
    for (const connection of connections) {
      const edgeColor = connection.isTypeCompatible ? '#10b981' : '#ef4444'
      const edgeWidth = Math.max(1, connection.connectionStrength * 3)
      
      edges.push({
        id: connection.id,
        source: `${connection.sourceActionId}.output.${connection.sourceOutputName}`,
        target: `${connection.targetActionId}.param.${connection.targetParameterName}`,
        type: 'data-flow',
        metadata: {
          outputName: connection.sourceOutputName,
          parameterName: connection.targetParameterName,
          isTypeCompatible: connection.isTypeCompatible,
          transformationNeeded: !!connection.transformationSuggestion,
          strength: connection.connectionStrength
        },
        style: {
          color: edgeColor,
          width: edgeWidth,
          dashArray: connection.isTypeCompatible ? undefined : '5,5'
        }
      })
    }

    // Create clusters for related actions
    clusters.push(...this.identifyActionClusters(workflow, connections))

    return { nodes, edges, clusters }
  }

  /**
   * Identifies clusters of related actions
   */
  private identifyActionClusters(
    workflow: ParsedWorkflow,
    connections: ParameterConnection[]
  ): ActionCluster[] {
    const clusters: ActionCluster[] = []
    const visited = new Set<string>()

    // Group actions by their connections
    const connectionGroups = new Map<string, Set<string>>()
    
    for (const connection of connections) {
      if (!connectionGroups.has(connection.sourceActionId)) {
        connectionGroups.set(connection.sourceActionId, new Set())
      }
      connectionGroups.get(connection.sourceActionId)!.add(connection.targetActionId)
    }

    // Find connected components
    for (const action of workflow.actions) {
      if (visited.has(action.id)) continue

      const cluster = new Set<string>()
      const queue = [action.id]

      while (queue.length > 0) {
        const currentId = queue.shift()!
        if (visited.has(currentId)) continue

        visited.add(currentId)
        cluster.add(currentId)

        // Add connected actions
        const connected = connectionGroups.get(currentId) || new Set()
        for (const connectedId of connected) {
          if (!visited.has(connectedId)) {
            queue.push(connectedId)
          }
        }
      }

      if (cluster.size > 1) {
        clusters.push({
          id: `cluster-${clusters.length}`,
          actionIds: Array.from(cluster),
          type: 'sequential', // Could be enhanced to detect parallel vs sequential
          description: `Connected actions: ${Array.from(cluster).join(', ')}`
        })
      }
    }

    return clusters
  }

  // Helper methods
  private findOrphanedActions(
    workflow: ParsedWorkflow,
    dependencies: ActionDependencyMap
  ): string[] {
    const orphanedActions: string[] = []
    const reachableActions = new Set<string>()

    // Use workflow's designated root actions, or find actions with no dependencies
    const rootActions = workflow.rootActions && workflow.rootActions.length > 0 
      ? workflow.rootActions
      : workflow.actions
          .filter(action => {
            const deps = dependencies[action.id]
            return !deps || deps.dependsOn.length === 0
          })
          .map(action => action.id)

    // If no root actions found, all actions with dependencies are potentially orphaned
    if (rootActions.length === 0) {
      // All actions have dependencies, so they're all potentially orphaned
      // unless they form a connected component
      return workflow.actions.map(action => action.id)
    }

    // DFS to find all reachable actions from root actions
    const dfs = (actionId: string): void => {
      if (reachableActions.has(actionId)) return
      
      reachableActions.add(actionId)
      
      // Find actions that depend on this action (forward traversal)
      for (const [depActionId, depInfo] of Object.entries(dependencies)) {
        if (depInfo.dependsOn.includes(actionId) && !reachableActions.has(depActionId)) {
          dfs(depActionId)
        }
      }
    }

    // Start DFS from all root actions
    for (const rootAction of rootActions) {
      dfs(rootAction)
    }

    // Actions not reachable from root actions are orphaned
    for (const action of workflow.actions) {
      if (!reachableActions.has(action.id)) {
        orphanedActions.push(action.id)
      }
    }

    return orphanedActions
  }

  private calculateExecutionOrder(
    workflow: ParsedWorkflow,
    dependencies: ActionDependencyMap
  ): string[] {
    const order: string[] = []
    const visited = new Set<string>()
    const temp = new Set<string>()

    const visit = (actionId: string): void => {
      if (temp.has(actionId)) return // Circular dependency, skip
      if (visited.has(actionId)) return

      temp.add(actionId)
      
      const deps = dependencies[actionId]
      if (deps) {
        for (const depId of deps.dependsOn) {
          visit(depId)
        }
      }

      temp.delete(actionId)
      visited.add(actionId)
      order.push(actionId)
    }

    for (const action of workflow.actions) {
      if (!visited.has(action.id)) {
        visit(action.id)
      }
    }

    return order
  }

  private findUnresolvedReferences(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): UnresolvedReference[] {
    const unresolvedReferences: UnresolvedReference[] = []

    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      if (!metadata) continue

      const actionParams = parameterValues[action.id] || {}

      for (const parameter of metadata.parameters) {
        const paramValue = actionParams[parameter.name]
        
        if (this.isParameterReference(paramValue)) {
          const { actionId: referencedAction, outputName } = this.parseParameterReference(paramValue)
          
          if (!referencedAction || !outputName) {
            unresolvedReferences.push({
              actionId: action.id,
              parameterName: parameter.name,
              referencedAction: referencedAction || 'unknown',
              referencedOutput: outputName || 'unknown',
              reason: 'Invalid parameter reference format',
              suggestions: ['Use format: actionId.outputName']
            })
            continue
          }

          const referencedActionExists = workflow.actions.some(a => a.id === referencedAction)
          if (!referencedActionExists) {
            unresolvedReferences.push({
              actionId: action.id,
              parameterName: parameter.name,
              referencedAction,
              referencedOutput: outputName,
              reason: 'Referenced action does not exist in workflow',
              suggestions: [
                'Check action ID spelling',
                'Ensure the referenced action is added to the workflow'
              ]
            })
            continue
          }

          const sourceMetadata = actionMetadata[
            workflow.actions.find(a => a.id === referencedAction)?.actionType || ''
          ]
          
          if (sourceMetadata) {
            const outputExists = sourceMetadata.outputs.some(o => o.name === outputName)
            if (!outputExists) {
              unresolvedReferences.push({
                actionId: action.id,
                parameterName: parameter.name,
                referencedAction,
                referencedOutput: outputName,
                reason: 'Referenced output does not exist on the specified action',
                suggestions: [
                  `Available outputs: ${sourceMetadata.outputs.map(o => o.name).join(', ')}`,
                  'Check output name spelling'
                ]
              })
            }
          }
        }
      }
    }

    return unresolvedReferences
  }

  // Type compatibility helper methods
  private isParameterReference(value: any): boolean {
    if (typeof value !== 'string') return false
    const parts = value.split('.')
    if (parts.length < 2) return false
    const actionIdPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/
    return actionIdPattern.test(parts[0])
  }

  private parseParameterReference(paramValue: string): { actionId: string | null, outputName: string | null } {
    const parts = paramValue.split('.')
    return {
      actionId: parts.length >= 2 ? parts[0] : null,
      outputName: parts.length >= 2 ? parts.slice(1).join('.') : null
    }
  }

  private areTypesCompatible(sourceType: string, targetType: string): boolean {
    const normalizeType = (type: string) => type.toLowerCase().trim()
    return normalizeType(sourceType) === normalizeType(targetType)
  }

  private canConvertTypes(sourceType: string, targetType: string): boolean {
    const source = sourceType.toLowerCase().trim()
    const target = targetType.toLowerCase().trim()

    if (source === target) return true

    const conversionRules: Record<string, string[]> = {
      'string': ['address', 'ufix64', 'int', 'uint64', 'bool'],
      'ufix64': ['string', 'int', 'uint64'],
      'int': ['string', 'ufix64', 'uint64'],
      'uint64': ['string', 'ufix64', 'int'],
      'bool': ['string'],
      'address': ['string']
    }

    return conversionRules[source]?.includes(target) || false
  }

  private getConversionComplexity(sourceType: string, targetType: string): 'simple' | 'moderate' | 'complex' {
    const source = sourceType.toLowerCase()
    const target = targetType.toLowerCase()

    // Simple conversions
    if (source === 'string' || target === 'string') return 'simple'
    if (['ufix64', 'int', 'uint64'].includes(source) && ['ufix64', 'int', 'uint64'].includes(target)) {
      return 'simple'
    }

    // Moderate conversions
    if (source === 'address' || target === 'address') return 'moderate'
    if (source === 'bool' || target === 'bool') return 'moderate'

    return 'complex'
  }

  private getTransformationSuggestion(sourceType: string, targetType: string): string {
    const source = sourceType.toLowerCase()
    const target = targetType.toLowerCase()

    if (source === 'string' && target === 'address') {
      return 'Ensure the string is a valid Flow address format (0x...)'
    }
    if (source === 'string' && target === 'ufix64') {
      return 'Parse string as decimal number'
    }
    if (source === 'ufix64' && target === 'string') {
      return 'Convert number to string representation'
    }
    if (source === 'address' && target === 'string') {
      return 'Convert address to string format'
    }
    if (source === 'bool' && target === 'string') {
      return 'Convert boolean to "true"/"false" string'
    }

    return `Add transformation from ${sourceType} to ${targetType}`
  }

  private calculateConnectionStrength(
    sourceType: string,
    targetType: string,
    isTypeCompatible: boolean
  ): number {
    let strength = 0.5 // Base strength

    if (isTypeCompatible) {
      strength += 0.4 // Boost for compatible types
    } else if (this.canConvertTypes(sourceType, targetType)) {
      strength += 0.2 // Smaller boost for convertible types
    }

    // Boost for common type patterns
    if (sourceType.toLowerCase() === 'string' || targetType.toLowerCase() === 'string') {
      strength += 0.1
    }

    return Math.min(1, strength)
  }

  private generateBreakingSuggestions(
    cycle: string[],
    dependencies: ActionDependencyMap
  ): string[] {
    const suggestions: string[] = []

    // Suggest breaking the weakest link
    suggestions.push(`Consider removing parameter dependency between ${cycle[cycle.length - 2]} and ${cycle[cycle.length - 1]}`)
    
    // Suggest introducing intermediate actions
    if (cycle.length === 3) {
      suggestions.push('Consider adding an intermediate action to break the circular dependency')
    }

    // Suggest conditional logic
    suggestions.push('Consider using conditional parameters or default values')

    return suggestions
  }
}