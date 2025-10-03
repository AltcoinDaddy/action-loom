import { ActionMetadata, DiscoveryResult, ValidationResult, CompatibilityInfo } from './types'
import { FlowAPIClient } from './flow-api-client'

/**
 * Interface for Action discovery services
 */
export interface IActionDiscoveryService {
  discoverActions(): Promise<ActionMetadata[]>
  searchActions(query: string): Promise<ActionMetadata[]>
  getActionById(id: string): Promise<ActionMetadata | null>
  refreshCache(): Promise<void>
  validateCompatibility(actions: ActionMetadata[]): Promise<ValidationResult>
}

/**
 * Interface for Action metadata handling
 */
export interface IActionMetadataHandler {
  parseMetadata(rawData: any): ActionMetadata | null
  validateMetadata(metadata: ActionMetadata): ValidationResult
  extractCompatibilityInfo(metadata: ActionMetadata): CompatibilityInfo
  calculateGasEstimate(metadata: ActionMetadata): number
}

/**
 * Interface for Action caching
 */
export interface IActionCache {
  get(key: string): Promise<ActionMetadata | null>
  set(key: string, value: ActionMetadata, ttl?: number): Promise<void>
  delete(key: string): Promise<void>
  clear(): Promise<void>
  exists(key: string): Promise<boolean>
}

/**
 * Interface for Action search
 */
export interface IActionSearchEngine {
  indexAction(action: ActionMetadata): Promise<void>
  searchByKeyword(query: string): Promise<ActionMetadata[]>
  searchBySemantic(query: string): Promise<ActionMetadata[]>
  searchByCategory(category: string): Promise<ActionMetadata[]>
  searchByTags(tags: string[]): Promise<ActionMetadata[]>
  rebuildIndex(): Promise<void>
}

/**
 * Base Action Discovery Service implementation
 */
export class BaseActionDiscoveryService implements IActionDiscoveryService {
  protected flowClient: FlowAPIClient
  protected cache?: IActionCache
  protected searchEngine?: IActionSearchEngine
  protected metadataHandler: IActionMetadataHandler

  constructor(
    flowClient: FlowAPIClient,
    metadataHandler: IActionMetadataHandler,
    cache?: IActionCache,
    searchEngine?: IActionSearchEngine
  ) {
    this.flowClient = flowClient
    this.metadataHandler = metadataHandler
    this.cache = cache
    this.searchEngine = searchEngine
  }

  async discoverActions(): Promise<ActionMetadata[]> {
    try {
      // Check cache first
      if (this.cache) {
        const cachedActions = await this.getCachedActions()
        if (cachedActions.length > 0) {
          return cachedActions
        }
      }

      // Discover from Flow network
      const discoveryResult = await this.flowClient.discoverAllActions()
      const validActions = discoveryResult.actions.filter(action => {
        const validation = this.metadataHandler.validateMetadata(action)
        return validation.isValid
      })

      // Cache the results
      if (this.cache) {
        await this.cacheActions(validActions)
      }

      // Index for search
      if (this.searchEngine) {
        for (const action of validActions) {
          await this.searchEngine.indexAction(action)
        }
      }

      return validActions
    } catch (error) {
      console.error('Error discovering Actions:', error)
      throw error
    }
  }

  async searchActions(query: string): Promise<ActionMetadata[]> {
    if (!this.searchEngine) {
      // Fallback to simple filtering
      const allActions = await this.discoverActions()
      return allActions.filter(action => 
        action.name.toLowerCase().includes(query.toLowerCase()) ||
        action.description.toLowerCase().includes(query.toLowerCase()) ||
        action.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()))
      )
    }

    try {
      // Try semantic search first, fallback to keyword search
      let results = await this.searchEngine.searchBySemantic(query)
      if (results.length === 0) {
        results = await this.searchEngine.searchByKeyword(query)
      }
      return results
    } catch (error) {
      console.error('Error searching Actions:', error)
      return []
    }
  }

  async getActionById(id: string): Promise<ActionMetadata | null> {
    try {
      // Check cache first
      if (this.cache) {
        const cached = await this.cache.get(id)
        if (cached) {
          return cached
        }
      }

      // Search in discovered actions
      const allActions = await this.discoverActions()
      return allActions.find(action => action.id === id) || null
    } catch (error) {
      console.error('Error getting Action by ID:', error)
      return null
    }
  }

  async refreshCache(): Promise<void> {
    try {
      if (this.cache) {
        await this.cache.clear()
      }
      
      if (this.searchEngine) {
        await this.searchEngine.rebuildIndex()
      }

      // Force fresh discovery
      await this.discoverActions()
    } catch (error) {
      console.error('Error refreshing cache:', error)
      throw error
    }
  }

  async validateCompatibility(actions: ActionMetadata[]): Promise<ValidationResult> {
    const errors: any[] = []
    const warnings: string[] = []
    const compatibilityIssues: any[] = []

    try {
      // Check each action pair for compatibility
      for (let i = 0; i < actions.length - 1; i++) {
        for (let j = i + 1; j < actions.length; j++) {
          const action1 = actions[i]
          const action2 = actions[j]

          // Check if actions conflict
          const conflicts = this.checkActionConflicts(action1, action2)
          compatibilityIssues.push(...conflicts)

          // Check input/output compatibility
          const ioCompatibility = this.checkInputOutputCompatibility(action1, action2)
          if (!ioCompatibility.compatible) {
            compatibilityIssues.push({
              sourceActionId: action1.id,
              targetActionId: action2.id,
              issue: ioCompatibility.issue,
              suggestion: ioCompatibility.suggestion
            })
          }
        }
      }

      return {
        isValid: errors.length === 0 && compatibilityIssues.length === 0,
        errors,
        warnings,
        compatibilityIssues
      }
    } catch (error) {
      console.error('Error validating compatibility:', error)
      return {
        isValid: false,
        errors: [{ type: 'validation_error', message: 'Failed to validate compatibility', severity: 'error' as const }],
        warnings,
        compatibilityIssues
      }
    }
  }

  private async getCachedActions(): Promise<ActionMetadata[]> {
    // This would implement cache retrieval logic
    // For now, return empty array
    return []
  }

  private async cacheActions(actions: ActionMetadata[]): Promise<void> {
    if (!this.cache) return

    for (const action of actions) {
      await this.cache.set(action.id, action, 3600) // 1 hour TTL
    }
  }

  private checkActionConflicts(action1: ActionMetadata, action2: ActionMetadata): any[] {
    const conflicts: any[] = []

    // Check explicit conflicts
    if (action1.compatibility.conflictsWith.includes(action2.id)) {
      conflicts.push({
        sourceActionId: action1.id,
        targetActionId: action2.id,
        issue: `${action1.name} conflicts with ${action2.name}`,
        suggestion: 'These actions cannot be used together in the same workflow'
      })
    }

    return conflicts
  }

  private checkInputOutputCompatibility(action1: ActionMetadata, action2: ActionMetadata): {
    compatible: boolean
    issue?: string
    suggestion?: string
  } {
    // Check if action1's outputs can be used as action2's inputs
    for (const output of action1.outputs) {
      for (const input of action2.inputs) {
        if (input.name === output.name && input.type !== output.type) {
          return {
            compatible: false,
            issue: `Type mismatch: ${action1.name}.${output.name} (${output.type}) cannot connect to ${action2.name}.${input.name} (${input.type})`,
            suggestion: 'Add a type conversion action between these actions'
          }
        }
      }
    }

    return { compatible: true }
  }
}

/**
 * Base Action Metadata Handler implementation
 */
export class BaseActionMetadataHandler implements IActionMetadataHandler {
  parseMetadata(rawData: any): ActionMetadata | null {
    try {
      // This would implement actual parsing logic based on Forte's metadata format
      // For now, return null as placeholder
      return null
    } catch (error) {
      console.error('Error parsing metadata:', error)
      return null
    }
  }

  validateMetadata(metadata: ActionMetadata): ValidationResult {
    const errors: any[] = []
    const warnings: string[] = []

    // Validate required fields
    if (!metadata.id) {
      errors.push({ type: 'missing_field', message: 'Action ID is required', field: 'id', severity: 'error' as const })
    }

    if (!metadata.name) {
      errors.push({ type: 'missing_field', message: 'Action name is required', field: 'name', severity: 'error' as const })
    }

    if (!metadata.version) {
      errors.push({ type: 'missing_field', message: 'Action version is required', field: 'version', severity: 'error' as const })
    }

    // Validate inputs and outputs
    if (metadata.inputs.length === 0 && metadata.outputs.length === 0) {
      warnings.push('Action has no inputs or outputs - this may indicate an incomplete definition')
    }

    // Validate gas estimate
    if (metadata.gasEstimate <= 0) {
      warnings.push('Gas estimate is zero or negative - this may cause execution issues')
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      compatibilityIssues: []
    }
  }

  extractCompatibilityInfo(metadata: ActionMetadata): CompatibilityInfo {
    return metadata.compatibility
  }

  calculateGasEstimate(metadata: ActionMetadata): number {
    // This would implement gas estimation logic
    // For now, return the provided estimate or a default
    return metadata.gasEstimate || 1000
  }
}

/**
 * Factory function to create a configured Action Discovery Service
 */
export function createActionDiscoveryService(
  flowClient: FlowAPIClient,
  cache?: IActionCache,
  searchEngine?: IActionSearchEngine
): IActionDiscoveryService {
  const metadataHandler = new BaseActionMetadataHandler()
  return new BaseActionDiscoveryService(flowClient, metadataHandler, cache, searchEngine)
}