import { 
  ParsedWorkflow, 
  ParsedAction, 
  ActionOutput, 
  ActionMetadata,
  ValidationError
} from './types'
import { 
  ParameterValidator, 
  ActionValidationResult, 
  ValidationContext,
  ValidationResult
} from './parameter-validator'
import { ValidationErrorType } from './types'

// Workflow-specific validation types
export interface WorkflowValidationResult {
  isValid: boolean
  actionResults: Record<string, ActionValidationResult>
  dataFlowResult: DataFlowValidationResult
  globalErrors: ValidationError[]
  warnings: string[]
}

export interface DataFlowValidationResult {
  isValid: boolean
  circularDependencies: CircularDependency[]
  unresolvedReferences: UnresolvedReference[]
  typeCompatibilityIssues: TypeCompatibilityIssue[]
  orphanedActions: string[]
}

export interface CircularDependency {
  cycle: string[]
  description: string
}

export interface UnresolvedReference {
  actionId: string
  parameterName: string
  referencedAction: string
  referencedOutput: string
  reason: string
}

export interface TypeCompatibilityIssue {
  sourceAction: string
  sourceOutput: string
  targetAction: string
  targetParameter: string
  sourceType: string
  targetType: string
  canConvert: boolean
  suggestion?: string
}

export interface ActionDependency {
  actionId: string
  dependsOn: string[]
  provides: string[]
}

/**
 * WorkflowValidator class for complete workflow validation
 */
export class WorkflowValidator {
  private parameterValidator: ParameterValidator

  constructor() {
    this.parameterValidator = new ParameterValidator()
  }

  /**
   * Validates an entire workflow including all actions and data flow
   */
  validateWorkflow(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): WorkflowValidationResult {
    const actionResults: Record<string, ActionValidationResult> = {}
    const globalErrors: ValidationError[] = []
    const warnings: string[] = []

    // Build available outputs map for validation context
    const availableOutputs = this.buildAvailableOutputsMap(workflow, actionMetadata)

    // Validate each action individually
    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      if (!metadata) {
        globalErrors.push({
          type: ValidationErrorType.MISSING_REQUIRED,
          message: `Action metadata not found for action type: ${action.actionType}`,
          field: action.id,
          severity: 'error'
        })
        continue
      }

      const context: ValidationContext = {
        workflow,
        currentAction: action,
        availableOutputs: availableOutputs[action.id] || {}
      }

      const actionParams = parameterValues[action.id] || {}
      const actionResult = this.parameterValidator.validateAllParameters(
        metadata,
        actionParams,
        context
      )

      actionResults[action.id] = actionResult
      warnings.push(...actionResult.warnings)
    }

    // Perform data flow analysis
    const dataFlowResult = this.analyzeDataFlow(workflow, actionMetadata, parameterValues)

    // Check for global workflow issues
    this.validateWorkflowStructure(workflow, globalErrors, warnings)

    const isValid = 
      Object.values(actionResults).every(result => result.isValid) &&
      dataFlowResult.isValid &&
      globalErrors.length === 0

    return {
      isValid,
      actionResults,
      dataFlowResult,
      globalErrors,
      warnings
    }
  }

  /**
   * Validates a single action within workflow context
   */
  validateAction(
    action: ParsedAction,
    metadata: ActionMetadata,
    parameterValues: Record<string, any>,
    context: ValidationContext
  ): ActionValidationResult {
    return this.parameterValidator.validateAllParameters(metadata, parameterValues, context)
  }

  /**
   * Analyzes data flow integrity and dependencies
   */
  analyzeDataFlow(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): DataFlowValidationResult {
    const dependencies = this.buildDependencyGraph(workflow, actionMetadata, parameterValues)
    
    // Detect circular dependencies
    const circularDependencies = this.detectCircularDependencies(dependencies)
    
    // Find unresolved references
    const unresolvedReferences = this.findUnresolvedReferences(
      workflow, 
      actionMetadata, 
      parameterValues
    )
    
    // Check type compatibility
    const typeCompatibilityIssues = this.checkTypeCompatibility(
      workflow, 
      actionMetadata, 
      parameterValues
    )
    
    // Find orphaned actions (actions with no path to execution)
    const orphanedActions = this.findOrphanedActions(workflow, dependencies)

    const isValid = 
      circularDependencies.length === 0 &&
      unresolvedReferences.length === 0 &&
      typeCompatibilityIssues.filter(issue => !issue.canConvert).length === 0

    return {
      isValid,
      circularDependencies,
      unresolvedReferences,
      typeCompatibilityIssues,
      orphanedActions
    }
  }

  /**
   * Builds a dependency graph for the workflow
   */
  private buildDependencyGraph(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): Record<string, ActionDependency> {
    const dependencies: Record<string, ActionDependency> = {}

    for (const action of workflow.actions) {
      const metadata = actionMetadata[action.actionType]
      if (!metadata) continue

      const actionParams = parameterValues[action.id] || {}
      const dependsOn: string[] = []
      const provides: string[] = []

      // Analyze parameter dependencies
      for (const [paramName, paramValue] of Object.entries(actionParams)) {
        if (this.isParameterReference(paramValue)) {
          const { actionId: referencedAction } = this.parseParameterReference(paramValue)
          if (referencedAction && referencedAction !== action.id) {
            dependsOn.push(referencedAction)
          }
        }
      }

      // Note: We don't add nextActions as dependencies for circular dependency detection
      // because nextActions represent execution order, not data dependencies
      // Only parameter references create true data dependencies

      // Add outputs this action provides
      provides.push(...metadata.outputs.map(output => `${action.id}.${output.name}`))

      dependencies[action.id] = {
        actionId: action.id,
        dependsOn: [...new Set(dependsOn)], // Remove duplicates
        provides
      }
    }

    return dependencies
  }

  /**
   * Detects circular dependencies in the workflow
   */
  private detectCircularDependencies(
    dependencies: Record<string, ActionDependency>
  ): CircularDependency[] {
    const circularDependencies: CircularDependency[] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    const dfs = (actionId: string, path: string[]): void => {
      if (recursionStack.has(actionId)) {
        // Found a cycle
        const cycleStart = path.indexOf(actionId)
        const cycle = path.slice(cycleStart).concat(actionId)
        circularDependencies.push({
          cycle,
          description: `Circular dependency detected: ${cycle.join(' → ')}`
        })
        return
      }

      if (visited.has(actionId)) {
        return
      }

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

    // Check each action for cycles
    for (const actionId of Object.keys(dependencies)) {
      if (!visited.has(actionId)) {
        dfs(actionId, [])
      }
    }

    return circularDependencies
  }

  /**
   * Finds unresolved parameter references
   */
  private findUnresolvedReferences(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): UnresolvedReference[] {
    const unresolvedReferences: UnresolvedReference[] = []
    const availableOutputs = this.buildAvailableOutputsMap(workflow, actionMetadata)

    for (const action of workflow.actions) {
      const actionParams = parameterValues[action.id] || {}
      const actionOutputs = availableOutputs[action.id] || {}

      for (const [paramName, paramValue] of Object.entries(actionParams)) {
        if (this.isParameterReference(paramValue)) {
          const { actionId: referencedAction, outputName } = this.parseParameterReference(paramValue)
          
          if (!referencedAction || !outputName) {
            unresolvedReferences.push({
              actionId: action.id,
              parameterName: paramName,
              referencedAction: referencedAction || 'unknown',
              referencedOutput: outputName || 'unknown',
              reason: 'Invalid parameter reference format'
            })
            continue
          }

          // Check if referenced action exists
          const referencedActionExists = workflow.actions.some(a => a.id === referencedAction)
          if (!referencedActionExists) {
            unresolvedReferences.push({
              actionId: action.id,
              parameterName: paramName,
              referencedAction,
              referencedOutput: outputName,
              reason: 'Referenced action does not exist in workflow'
            })
            continue
          }

          // Check if referenced output exists
          const outputKey = `${referencedAction}.${outputName}`
          if (!actionOutputs[outputKey]) {
            unresolvedReferences.push({
              actionId: action.id,
              parameterName: paramName,
              referencedAction,
              referencedOutput: outputName,
              reason: 'Referenced output does not exist on the specified action'
            })
          }
        }
      }
    }

    return unresolvedReferences
  }

  /**
   * Checks type compatibility between connected parameters
   */
  private checkTypeCompatibility(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>,
    parameterValues: Record<string, Record<string, any>>
  ): TypeCompatibilityIssue[] {
    const typeCompatibilityIssues: TypeCompatibilityIssue[] = []

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
          
          if (!canConvert) {
            typeCompatibilityIssues.push({
              sourceAction,
              sourceOutput: outputName,
              targetAction: action.id,
              targetParameter: parameter.name,
              sourceType: sourceOutput.type,
              targetType: parameter.type,
              canConvert: false,
              suggestion: this.getTypeConversionSuggestion(sourceOutput.type, parameter.type)
            })
          } else if (sourceOutput.type !== parameter.type) {
            // Types are different but convertible - add as warning
            typeCompatibilityIssues.push({
              sourceAction,
              sourceOutput: outputName,
              targetAction: action.id,
              targetParameter: parameter.name,
              sourceType: sourceOutput.type,
              targetType: parameter.type,
              canConvert: true,
              suggestion: `Automatic conversion from ${sourceOutput.type} to ${parameter.type}`
            })
          }
        }
      }
    }

    return typeCompatibilityIssues
  }

  /**
   * Finds actions that have no path to execution (orphaned actions)
   */
  private findOrphanedActions(
    workflow: ParsedWorkflow,
    dependencies: Record<string, ActionDependency>
  ): string[] {
    const orphanedActions: string[] = []
    const reachableActions = new Set<string>()

    // Start from root actions (actions with no dependencies)
    const rootActions = workflow.rootActions || 
      workflow.actions.filter(action => {
        const deps = dependencies[action.id]
        return !deps || deps.dependsOn.length === 0
      }).map(action => action.id)

    // Perform DFS to find all reachable actions
    const dfs = (actionId: string): void => {
      if (reachableActions.has(actionId)) return
      
      reachableActions.add(actionId)
      const dependency = dependencies[actionId]
      
      if (dependency) {
        // Visit all actions that depend on this one
        for (const [depActionId, depInfo] of Object.entries(dependencies)) {
          if (depInfo.dependsOn.includes(actionId)) {
            dfs(depActionId)
          }
        }
      }
    }

    // Start DFS from all root actions
    for (const rootAction of rootActions) {
      dfs(rootAction)
    }

    // Find actions that are not reachable
    for (const action of workflow.actions) {
      if (!reachableActions.has(action.id)) {
        orphanedActions.push(action.id)
      }
    }

    return orphanedActions
  }

  /**
   * Validates overall workflow structure
   */
  private validateWorkflowStructure(
    workflow: ParsedWorkflow,
    globalErrors: ValidationError[],
    warnings: string[]
  ): void {
    // Check if workflow has any actions
    if (workflow.actions.length === 0) {
      globalErrors.push({
        type: ValidationErrorType.MISSING_REQUIRED,
        message: 'Workflow must contain at least one action',
        severity: 'error'
      })
    }

    // Check for duplicate action IDs
    const actionIds = workflow.actions.map(action => action.id)
    const duplicateIds = actionIds.filter((id, index) => actionIds.indexOf(id) !== index)
    
    if (duplicateIds.length > 0) {
      globalErrors.push({
        type: ValidationErrorType.INVALID_FORMAT,
        message: `Duplicate action IDs found: ${duplicateIds.join(', ')}`,
        severity: 'error'
      })
    }

    // Check execution order consistency
    if (workflow.executionOrder) {
      const missingFromOrder = actionIds.filter(id => !workflow.executionOrder.includes(id))
      const extraInOrder = workflow.executionOrder.filter(id => !actionIds.includes(id))

      if (missingFromOrder.length > 0) {
        warnings.push(`Actions missing from execution order: ${missingFromOrder.join(', ')}`)
      }

      if (extraInOrder.length > 0) {
        warnings.push(`Unknown actions in execution order: ${extraInOrder.join(', ')}`)
      }
    }
  }

  /**
   * Builds a map of available outputs for each action
   */
  private buildAvailableOutputsMap(
    workflow: ParsedWorkflow,
    actionMetadata: Record<string, ActionMetadata>
  ): Record<string, Record<string, ActionOutput>> {
    const availableOutputs: Record<string, Record<string, ActionOutput>> = {}

    for (const action of workflow.actions) {
      const outputs: Record<string, ActionOutput> = {}
      
      // Add outputs from actions that can provide data to this action
      // For simplicity, we'll include all other actions for now
      // In a more sophisticated implementation, we'd consider execution order
      for (const otherAction of workflow.actions) {
        if (otherAction.id === action.id) continue
        
        const metadata = actionMetadata[otherAction.actionType]
        if (metadata) {
          for (const output of metadata.outputs) {
            outputs[`${otherAction.id}.${output.name}`] = output
          }
        }
      }

      availableOutputs[action.id] = outputs
    }

    return availableOutputs
  }

  // Helper methods for parameter reference handling
  private isParameterReference(value: any): boolean {
    if (typeof value !== 'string') return false
    
    // Check if it looks like an action reference (actionId.outputName)
    const parts = value.split('.')
    if (parts.length < 2) return false
    
    // First part should be a valid action ID (alphanumeric, hyphens, underscores)
    // and should not be a number (to avoid treating decimal numbers as references)
    const actionIdPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/
    return actionIdPattern.test(parts[0])
  }

  private extractReferencedAction(paramValue: string): string | null {
    const parts = paramValue.split('.')
    return parts.length >= 2 ? parts[0] : null
  }

  private parseParameterReference(paramValue: string): { actionId: string | null, outputName: string | null } {
    const parts = paramValue.split('.')
    return {
      actionId: parts.length >= 2 ? parts[0] : null,
      outputName: parts.length >= 2 ? parts.slice(1).join('.') : null
    }
  }

  private canConvertTypes(sourceType: string, targetType: string): boolean {
    // Normalize types for comparison
    const normalizeType = (type: string) => type.toLowerCase().trim()
    const source = normalizeType(sourceType)
    const target = normalizeType(targetType)

    // Same types are always compatible
    if (source === target) return true

    // Define conversion rules
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

  private getTypeConversionSuggestion(sourceType: string, targetType: string): string {
    const source = sourceType.toLowerCase()
    const target = targetType.toLowerCase()

    if (source === 'string' && target === 'address') {
      return 'Ensure the string is a valid Flow address format (0x...)'
    }
    if (source === 'string' && target === 'ufix64') {
      return 'Ensure the string represents a valid decimal number'
    }
    if (source === 'ufix64' && target === 'string') {
      return 'Number will be converted to string representation'
    }
    if (source === 'address' && target === 'string') {
      return 'Address will be converted to string format'
    }

    return `Consider adding explicit conversion from ${sourceType} to ${targetType}`
  }
}