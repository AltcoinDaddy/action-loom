import { 
  ParsedWorkflow, 
  ParsedAction, 
  ActionMetadata, 
  ValidationResult, 
  ValidationError, 
  CompatibilityIssue,
  ActionInput,
  ActionOutput 
} from './types'

export interface DependencyNode {
  actionId: string
  action: ParsedAction
  dependencies: string[]
  dependents: string[]
  depth: number
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>
  edges: Array<{ from: string; to: string }>
  cycles: string[][]
  maxDepth: number
}

export interface TypeCompatibilityResult {
  compatible: boolean
  issues: CompatibilityIssue[]
  suggestions: string[]
}

export interface WorkflowCompatibilityResult {
  isValid: boolean
  typeCompatibility: TypeCompatibilityResult
  dependencyGraph: DependencyGraph
  circularDependencies: string[][]
  errors: ValidationError[]
  warnings: string[]
}

export class WorkflowCompatibilityService {
  private actionMetadataCache: Map<string, ActionMetadata> = new Map()

  /**
   * Main method to check workflow compatibility
   */
  async checkWorkflowCompatibility(
    workflow: ParsedWorkflow,
    actionMetadata: ActionMetadata[]
  ): Promise<WorkflowCompatibilityResult> {
    // Cache action metadata for quick lookup
    this.cacheActionMetadata(actionMetadata)

    // Build dependency graph
    const dependencyGraph = this.buildDependencyGraph(workflow)

    // Check for circular dependencies
    const circularDependencies = this.detectCircularDependencies(dependencyGraph)

    // Check type compatibility
    const typeCompatibility = this.checkTypeCompatibility(workflow, dependencyGraph)

    // Collect all errors and warnings
    const errors: ValidationError[] = []
    const warnings: string[] = []

    // Add circular dependency errors
    if (circularDependencies.length > 0) {
      errors.push({
        type: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependencies detected: ${circularDependencies.map(cycle => cycle.join(' -> ')).join(', ')}`,
        severity: 'error'
      })
    }

    // Add type compatibility errors
    errors.push(...typeCompatibility.issues.map(issue => ({
      type: 'TYPE_COMPATIBILITY',
      message: issue.issue,
      actionId: issue.sourceActionId,
      severity: 'error' as const
    })))

    // Add warnings for complex workflows
    if (dependencyGraph.maxDepth > 10) {
      warnings.push('Workflow has deep dependency chains (>10 levels). Consider breaking into smaller workflows.')
    }

    if (workflow.actions.length > 50) {
      warnings.push('Large workflow detected (>50 actions). Performance may be impacted.')
    }

    const isValid = errors.length === 0 && circularDependencies.length === 0 && typeCompatibility.compatible

    return {
      isValid,
      typeCompatibility,
      dependencyGraph,
      circularDependencies,
      errors,
      warnings
    }
  }

  /**
   * Build dependency graph from workflow
   */
  private buildDependencyGraph(workflow: ParsedWorkflow): DependencyGraph {
    const nodes = new Map<string, DependencyNode>()
    const edges: Array<{ from: string; to: string }> = []

    // Initialize nodes
    for (const action of workflow.actions) {
      nodes.set(action.id, {
        actionId: action.id,
        action,
        dependencies: [],
        dependents: [],
        depth: 0
      })
    }

    // Build edges based on nextActions
    for (const action of workflow.actions) {
      for (const nextActionId of action.nextActions) {
        edges.push({ from: action.id, to: nextActionId })
        
        const sourceNode = nodes.get(action.id)
        const targetNode = nodes.get(nextActionId)
        
        if (sourceNode && targetNode) {
          targetNode.dependencies.push(action.id)
          sourceNode.dependents.push(nextActionId)
        }
      }
    }

    // Calculate depths using topological sort
    const maxDepth = this.calculateNodeDepths(nodes)

    // Detect cycles
    const cycles = this.findCycles(nodes)

    return {
      nodes,
      edges,
      cycles,
      maxDepth
    }
  }

  /**
   * Calculate depth of each node in the dependency graph
   */
  private calculateNodeDepths(nodes: Map<string, DependencyNode>): number {
    const visited = new Set<string>()
    const visiting = new Set<string>()
    let maxDepth = 0

    const visit = (nodeId: string): number => {
      if (visiting.has(nodeId)) {
        // Cycle detected, return high depth to indicate issue
        return 1000
      }
      
      if (visited.has(nodeId)) {
        return nodes.get(nodeId)?.depth || 0
      }

      visiting.add(nodeId)
      const node = nodes.get(nodeId)
      
      if (!node) return 0

      let depth = 0
      for (const depId of node.dependencies) {
        depth = Math.max(depth, visit(depId) + 1)
      }

      node.depth = depth
      maxDepth = Math.max(maxDepth, depth)
      
      visiting.delete(nodeId)
      visited.add(nodeId)
      
      return depth
    }

    // Visit all nodes
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        visit(nodeId)
      }
    }

    return maxDepth
  }

  /**
   * Detect circular dependencies using DFS
   */
  private detectCircularDependencies(graph: DependencyGraph): string[][] {
    return graph.cycles
  }

  /**
   * Find cycles in the dependency graph
   */
  private findCycles(nodes: Map<string, DependencyNode>): string[][] {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const cycles: string[][] = []

    const dfs = (nodeId: string, path: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId)
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeId])
        }
        return
      }

      if (visited.has(nodeId)) {
        return
      }

      visited.add(nodeId)
      recursionStack.add(nodeId)
      path.push(nodeId)

      const node = nodes.get(nodeId)
      if (node) {
        for (const dependentId of node.dependents) {
          dfs(dependentId, [...path])
        }
      }

      recursionStack.delete(nodeId)
      path.pop()
    }

    // Check all nodes for cycles
    for (const nodeId of nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId, [])
      }
    }

    return cycles
  }

  /**
   * Check type compatibility between connected actions
   */
  private checkTypeCompatibility(
    workflow: ParsedWorkflow,
    graph: DependencyGraph
  ): TypeCompatibilityResult {
    const issues: CompatibilityIssue[] = []
    const suggestions: string[] = []

    for (const edge of graph.edges) {
      const sourceAction = workflow.actions.find(a => a.id === edge.from)
      const targetAction = workflow.actions.find(a => a.id === edge.to)

      if (!sourceAction || !targetAction) continue

      const sourceMetadata = this.actionMetadataCache.get(sourceAction.actionType)
      const targetMetadata = this.actionMetadataCache.get(targetAction.actionType)

      if (!sourceMetadata || !targetMetadata) {
        issues.push({
          sourceActionId: edge.from,
          targetActionId: edge.to,
          issue: 'Missing action metadata for compatibility check',
          suggestion: 'Ensure all actions have valid metadata'
        })
        continue
      }

      // Check output-to-input compatibility
      const compatibilityResult = this.checkActionCompatibility(
        sourceMetadata,
        targetMetadata,
        edge.from,
        edge.to
      )

      issues.push(...compatibilityResult.issues)
      suggestions.push(...compatibilityResult.suggestions)
    }

    return {
      compatible: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * Check compatibility between two specific actions
   */
  private checkActionCompatibility(
    sourceAction: ActionMetadata,
    targetAction: ActionMetadata,
    sourceId: string,
    targetId: string
  ): TypeCompatibilityResult {
    const issues: CompatibilityIssue[] = []
    const suggestions: string[] = []

    // Check if source outputs can satisfy target inputs
    for (const targetInput of targetAction.inputs) {
      if (!targetInput.required) continue

      const compatibleOutput = sourceAction.outputs.find(output => 
        this.areTypesCompatible(output.type, targetInput.type)
      )

      if (!compatibleOutput) {
        issues.push({
          sourceActionId: sourceId,
          targetActionId: targetId,
          issue: `Required input '${targetInput.name}' of type '${targetInput.type}' cannot be satisfied by any output from source action`,
          suggestion: `Add an intermediate action that can convert available outputs to required input type '${targetInput.type}'`
        })
      }
    }

    // Check network compatibility
    if (sourceAction.compatibility.supportedNetworks.length > 0 && 
        targetAction.compatibility.supportedNetworks.length > 0) {
      const commonNetworks = sourceAction.compatibility.supportedNetworks.filter(
        network => targetAction.compatibility.supportedNetworks.includes(network)
      )

      if (commonNetworks.length === 0) {
        issues.push({
          sourceActionId: sourceId,
          targetActionId: targetId,
          issue: 'Actions support different networks and cannot be chained',
          suggestion: 'Use bridge actions to connect different networks or choose actions on the same network'
        })
      }
    }

    // Check for explicit conflicts
    if (sourceAction.compatibility.conflictsWith.includes(targetAction.id) ||
        targetAction.compatibility.conflictsWith.includes(sourceAction.id)) {
      issues.push({
        sourceActionId: sourceId,
        targetActionId: targetId,
        issue: 'Actions are explicitly marked as incompatible',
        suggestion: 'Choose alternative actions that are compatible'
      })
    }

    // Check capability requirements
    for (const requiredCap of targetAction.compatibility.requiredCapabilities) {
      // This would need to be enhanced based on how capabilities are tracked
      // For now, we'll add a placeholder check
      suggestions.push(`Ensure the workflow environment supports capability: ${requiredCap}`)
    }

    return {
      compatible: issues.length === 0,
      issues,
      suggestions
    }
  }

  /**
   * Check if two types are compatible
   */
  private areTypesCompatible(sourceType: string, targetType: string): boolean {
    // Exact match
    if (sourceType === targetType) return true

    // Define type compatibility rules
    const compatibilityRules: Record<string, string[]> = {
      'UFix64': ['UInt64', 'Int64', 'Fix64'],
      'UInt64': ['UFix64', 'UInt32', 'UInt16', 'UInt8'],
      'String': ['Address'], // Address can be converted to String
      'Address': ['String'], // String can be converted to Address (with validation)
      'Resource': ['AnyResource'],
      'Struct': ['AnyStruct'],
      'Array': ['[AnyStruct]', '[AnyResource]'],
      // Add more compatibility rules as needed
    }

    // Check if source type can be converted to target type
    const compatibleTypes = compatibilityRules[sourceType] || []
    return compatibleTypes.includes(targetType)
  }

  /**
   * Cache action metadata for quick lookup
   */
  private cacheActionMetadata(actionMetadata: ActionMetadata[]): void {
    this.actionMetadataCache.clear()
    for (const metadata of actionMetadata) {
      this.actionMetadataCache.set(metadata.id, metadata)
    }
  }

  /**
   * Get dependency path between two actions
   */
  getDependencyPath(
    graph: DependencyGraph,
    fromActionId: string,
    toActionId: string
  ): string[] | null {
    const visited = new Set<string>()
    const queue: Array<{ nodeId: string; path: string[] }> = [
      { nodeId: fromActionId, path: [fromActionId] }
    ]

    while (queue.length > 0) {
      const { nodeId, path } = queue.shift()!

      if (nodeId === toActionId) {
        return path
      }

      if (visited.has(nodeId)) continue
      visited.add(nodeId)

      const node = graph.nodes.get(nodeId)
      if (node) {
        for (const dependentId of node.dependents) {
          queue.push({
            nodeId: dependentId,
            path: [...path, dependentId]
          })
        }
      }
    }

    return null
  }

  /**
   * Suggest workflow optimizations
   */
  suggestOptimizations(result: WorkflowCompatibilityResult): string[] {
    const suggestions: string[] = []

    // Suggest parallel execution opportunities
    const parallelizableActions = this.findParallelizableActions(result.dependencyGraph)
    if (parallelizableActions.length > 0) {
      suggestions.push(`Consider parallelizing these independent action groups: ${parallelizableActions.join(', ')}`)
    }

    // Suggest workflow simplification
    if (result.dependencyGraph.maxDepth > 5) {
      suggestions.push('Consider breaking this workflow into smaller, more manageable sub-workflows')
    }

    // Add type compatibility suggestions
    suggestions.push(...result.typeCompatibility.suggestions)

    return suggestions
  }

  /**
   * Find actions that can be executed in parallel
   */
  private findParallelizableActions(graph: DependencyGraph): string[] {
    const parallelGroups: string[] = []
    const processed = new Set<string>()

    for (const [nodeId, node] of graph.nodes) {
      if (processed.has(nodeId)) continue

      // Find all nodes at the same depth with no dependencies between them
      const sameDepthNodes = Array.from(graph.nodes.values())
        .filter(n => n.depth === node.depth && !processed.has(n.actionId))

      if (sameDepthNodes.length > 1) {
        const groupIds = sameDepthNodes.map(n => n.actionId)
        parallelGroups.push(`[${groupIds.join(', ')}]`)
        groupIds.forEach(id => processed.add(id))
      } else {
        processed.add(nodeId)
      }
    }

    return parallelGroups
  }
}

export const workflowCompatibilityService = new WorkflowCompatibilityService()