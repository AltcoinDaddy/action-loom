import type { Node, Edge } from "@xyflow/react"
import type { ParsedWorkflow, ParsedAction, ActionParameter } from "./types"

export class WorkflowParser {
  /**
   * Parse React Flow nodes and edges into a structured workflow
   */
  static parse(nodes: Node[], edges: Edge[]): ParsedWorkflow {
    // Build adjacency map for quick edge lookups
    const adjacencyMap = new Map<string, string[]>()
    edges.forEach((edge) => {
      const targets = adjacencyMap.get(edge.source) || []
      targets.push(edge.target)
      adjacencyMap.set(edge.source, targets)
    })

    // Find root nodes (nodes with no incoming edges)
    const targetNodeIds = new Set(edges.map((e) => e.target))
    const rootNodes = nodes.filter((node) => !targetNodeIds.has(node.id))

    // Parse each node into an action
    const actions: ParsedAction[] = nodes.map((node) => {
      const nextActions = adjacencyMap.get(node.id) || []

      return {
        id: node.id,
        actionType: node.data.actionId,
        name: node.data.label,
        parameters: this.getDefaultParameters(node.data.actionId),
        nextActions,
        position: node.position,
      }
    })

    // Determine execution order using topological sort
    const executionOrder = this.topologicalSort(nodes, edges)

    return {
      actions,
      executionOrder,
      rootActions: rootNodes.map((n) => n.id),
      metadata: {
        totalActions: nodes.length,
        totalConnections: edges.length,
        createdAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Topological sort to determine execution order
   */
  private static topologicalSort(nodes: Node[], edges: Edge[]): string[] {
    const inDegree = new Map<string, number>()
    const adjacencyList = new Map<string, string[]>()

    // Initialize
    nodes.forEach((node) => {
      inDegree.set(node.id, 0)
      adjacencyList.set(node.id, [])
    })

    // Build graph
    edges.forEach((edge) => {
      adjacencyList.get(edge.source)?.push(edge.target)
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
    })

    // Find all nodes with no incoming edges
    const queue: string[] = []
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId)
    })

    const result: string[] = []

    while (queue.length > 0) {
      const current = queue.shift()!
      result.push(current)

      adjacencyList.get(current)?.forEach((neighbor) => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      })
    }

    return result
  }

  /**
   * Get default parameters for each action type
   */
  private static getDefaultParameters(actionId: string): ActionParameter[] {
    const parameterMap: Record<string, ActionParameter[]> = {
      "swap-tokens": [
        { name: "fromToken", type: "Address", value: "", required: true },
        { name: "toToken", type: "Address", value: "", required: true },
        { name: "amount", type: "UFix64", value: "", required: true },
        { name: "slippage", type: "UFix64", value: "0.01", required: false },
      ],
      "add-liquidity": [
        { name: "tokenA", type: "Address", value: "", required: true },
        { name: "tokenB", type: "Address", value: "", required: true },
        { name: "amountA", type: "UFix64", value: "", required: true },
        { name: "amountB", type: "UFix64", value: "", required: true },
      ],
      "stake-tokens": [
        { name: "token", type: "Address", value: "", required: true },
        { name: "amount", type: "UFix64", value: "", required: true },
        { name: "validator", type: "Address", value: "", required: false },
      ],
      "mint-nft": [
        { name: "collectionAddress", type: "Address", value: "", required: true },
        { name: "metadata", type: "String", value: "", required: true },
        { name: "recipient", type: "Address", value: "", required: false },
      ],
      "transfer-nft": [
        { name: "nftId", type: "UInt64", value: "", required: true },
        { name: "recipient", type: "Address", value: "", required: true },
      ],
      "list-nft": [
        { name: "nftId", type: "UInt64", value: "", required: true },
        { name: "price", type: "UFix64", value: "", required: true },
        { name: "marketplace", type: "Address", value: "", required: true },
      ],
      "create-proposal": [
        { name: "title", type: "String", value: "", required: true },
        { name: "description", type: "String", value: "", required: true },
        { name: "votingPeriod", type: "UInt64", value: "", required: true },
      ],
      vote: [
        { name: "proposalId", type: "UInt64", value: "", required: true },
        { name: "choice", type: "Bool", value: "", required: true },
      ],
    }

    return parameterMap[actionId] || []
  }

  /**
   * Validate workflow structure
   */
  static validate(workflow: ParsedWorkflow): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check for cycles
    if (workflow.executionOrder.length !== workflow.actions.length) {
      errors.push("Workflow contains cycles or disconnected nodes")
    }

    // Check for missing required parameters
    workflow.actions.forEach((action) => {
      const missingParams = action.parameters.filter((p) => p.required && !p.value)
      if (missingParams.length > 0) {
        errors.push(
          `Action "${action.name}" is missing required parameters: ${missingParams.map((p) => p.name).join(", ")}`,
        )
      }
    })

    // Check for at least one root action
    if (workflow.rootActions.length === 0) {
      errors.push("Workflow must have at least one starting action")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }
}
