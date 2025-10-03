import {
  ValidationError,
  ValidationErrorType,
  WorkflowValidationResult,
  ActionValidationResult,
  DataFlowValidationResult
} from './types'
import {
  EnhancedValidationError,
  ErrorCategory,
  ErrorSeverity,
  ErrorRecoverySuggestion,
  ErrorMessageSystem
} from './error-message-system'

/**
 * Error group for related errors
 */
export interface ErrorGroup {
  category: ErrorCategory
  severity: ErrorSeverity
  title: string
  description: string
  errors: EnhancedValidationError[]
  suggestions: ErrorRecoverySuggestion[]
  affectedActions: string[]
  canProceed: boolean
}

/**
 * Categorized validation results
 */
export interface CategorizedValidationResult {
  isValid: boolean
  canExecute: boolean
  errorGroups: ErrorGroup[]
  criticalErrors: EnhancedValidationError[]
  warnings: EnhancedValidationError[]
  totalErrors: number
  totalWarnings: number
  prioritizedErrors: EnhancedValidationError[]
}

/**
 * Service for categorizing and prioritizing validation errors
 */
export class ErrorCategorizationService {
  /**
   * Categorizes and prioritizes workflow validation results
   */
  static categorizeWorkflowErrors(
    validationResult: WorkflowValidationResult
  ): CategorizedValidationResult {
    const allErrors: EnhancedValidationError[] = []
    const affectedActions = new Set<string>()

    // Process global errors
    validationResult.globalErrors.forEach(error => {
      const enhanced = ErrorMessageSystem.enhanceError(error)
      enhanced.category = ErrorCategory.WORKFLOW_STRUCTURE
      allErrors.push(enhanced)
    })

    // Process action-specific errors
    Object.entries(validationResult.actionResults).forEach(([actionId, result]) => {
      if (!result.isValid) {
        affectedActions.add(actionId)
        
        // Missing parameters
        result.missingParameters.forEach(paramName => {
          const error: ValidationError = {
            type: ValidationErrorType.MISSING_REQUIRED,
            message: `${paramName} is required`,
            field: paramName,
            severity: 'error'
          }
          const enhanced = ErrorMessageSystem.enhanceError(error)
          enhanced.context = { ...enhanced.context, actionId }
          allErrors.push(enhanced)
        })

        // Invalid parameters
        Object.entries(result.invalidParameters).forEach(([paramName, paramResult]) => {
          paramResult.errors.forEach(error => {
            const enhanced = ErrorMessageSystem.enhanceError(error)
            enhanced.context = { ...enhanced.context, actionId, parameterName: paramName }
            allErrors.push(enhanced)
          })
        })

        // Warnings
        result.warnings.forEach(warning => {
          const error: ValidationError = {
            type: ValidationErrorType.CUSTOM_VALIDATION,
            message: warning,
            severity: 'warning'
          }
          const enhanced = ErrorMessageSystem.enhanceError(error)
          enhanced.context = { ...enhanced.context, actionId }
          allErrors.push(enhanced)
        })
      }
    })

    // Process data flow errors
    if (!validationResult.dataFlowResult.isValid) {
      this.processDataFlowErrors(validationResult.dataFlowResult, allErrors, affectedActions)
    }

    return this.categorizeAndPrioritize(allErrors, Array.from(affectedActions))
  }

  /**
   * Processes data flow validation errors
   */
  private static processDataFlowErrors(
    dataFlowResult: DataFlowValidationResult,
    allErrors: EnhancedValidationError[],
    affectedActions: Set<string>
  ): void {
    // Circular dependencies
    dataFlowResult.circularDependencies.forEach(cycle => {
      const error: ValidationError = {
        type: ValidationErrorType.CUSTOM_VALIDATION,
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
        severity: 'error'
      }
      const enhanced = ErrorMessageSystem.enhanceError(error)
      enhanced.category = ErrorCategory.DATA_FLOW
      enhanced.priority = 9 // High priority for circular dependencies
      enhanced.helpText = 'Circular dependencies prevent workflow execution. Remove or restructure connections to break the cycle.'
      enhanced.suggestedFix = 'Review the parameter connections and remove circular references.'
      allErrors.push(enhanced)
      
      cycle.forEach(actionId => affectedActions.add(actionId))
    })

    // Unresolved references
    dataFlowResult.unresolvedReferences.forEach(ref => {
      const error: ValidationError = {
        type: ValidationErrorType.CUSTOM_VALIDATION,
        message: `Unresolved reference: ${ref.referencedAction}.${ref.referencedOutput}`,
        field: ref.parameterName,
        severity: 'error'
      }
      const enhanced = ErrorMessageSystem.enhanceError(error)
      enhanced.category = ErrorCategory.DATA_FLOW
      enhanced.priority = 8
      enhanced.helpText = 'This parameter references an output that doesn\'t exist or isn\'t available.'
      enhanced.suggestedFix = 'Check that the referenced action exists and produces the expected output.'
      enhanced.context = {
        actionId: ref.actionId,
        parameterName: ref.parameterName,
        referencedAction: ref.referencedAction,
        referencedOutput: ref.referencedOutput
      }
      allErrors.push(enhanced)
      
      affectedActions.add(ref.actionId)
    })

    // Type compatibility issues
    dataFlowResult.typeCompatibilityIssues.forEach(issue => {
      const severity = issue.canConvert ? 'warning' : 'error'
      const error: ValidationError = {
        type: ValidationErrorType.INVALID_TYPE,
        message: `Type mismatch: ${issue.sourceType} → ${issue.targetType}`,
        severity: severity as 'error' | 'warning'
      }
      const enhanced = ErrorMessageSystem.enhanceError(error)
      enhanced.category = ErrorCategory.DATA_FLOW
      enhanced.priority = issue.canConvert ? 4 : 7
      enhanced.helpText = issue.canConvert 
        ? 'Types are compatible but may require conversion. This might affect precision or format.'
        : 'Types are incompatible and cannot be automatically converted.'
      enhanced.suggestedFix = issue.canConvert
        ? 'Consider if the automatic conversion is acceptable for your use case.'
        : 'Use a compatible data type or add a conversion action between these steps.'
      enhanced.context = {
        sourceAction: issue.sourceAction,
        sourceOutput: issue.sourceOutput,
        targetAction: issue.targetAction,
        targetParameter: issue.targetParameter,
        canConvert: issue.canConvert
      }
      allErrors.push(enhanced)
      
      affectedActions.add(issue.targetAction)
    })
  }

  /**
   * Categorizes and prioritizes all errors
   */
  private static categorizeAndPrioritize(
    allErrors: EnhancedValidationError[],
    affectedActions: string[]
  ): CategorizedValidationResult {
    // Separate errors and warnings
    const errors = allErrors.filter(e => e.severity === 'error')
    const warnings = allErrors.filter(e => e.severity === 'warning')

    // Find critical errors (high priority errors that block execution)
    const criticalErrors = errors.filter(e => e.priority >= 8)

    // Sort by priority (highest first)
    const prioritizedErrors = [...allErrors].sort((a, b) => b.priority - a.priority)

    // Group errors by category
    const errorGroups = this.groupErrorsByCategory(allErrors, affectedActions)

    return {
      isValid: allErrors.length === 0,
      canExecute: criticalErrors.length === 0,
      errorGroups,
      criticalErrors,
      warnings,
      totalErrors: errors.length,
      totalWarnings: warnings.length,
      prioritizedErrors
    }
  }

  /**
   * Groups errors by category
   */
  private static groupErrorsByCategory(
    allErrors: EnhancedValidationError[],
    affectedActions: string[]
  ): ErrorGroup[] {
    const groups = new Map<ErrorCategory, ErrorGroup>()

    allErrors.forEach(error => {
      if (!groups.has(error.category)) {
        groups.set(error.category, {
          category: error.category,
          severity: this.determineSeverity(error.category),
          title: this.getCategoryTitle(error.category),
          description: this.getCategoryDescription(error.category),
          errors: [],
          suggestions: [],
          affectedActions: [],
          canProceed: true
        })
      }

      const group = groups.get(error.category)!
      group.errors.push(error)
      
      // Update group severity if this error is more severe
      if (error.severity === 'error' && group.severity !== ErrorSeverity.CRITICAL) {
        group.severity = error.priority >= 8 ? ErrorSeverity.CRITICAL : ErrorSeverity.ERROR
      }

      // Update canProceed flag
      if (error.severity === 'error' && error.priority >= 8) {
        group.canProceed = false
      }

      // Add affected actions
      if (error.context?.actionId && !group.affectedActions.includes(error.context.actionId)) {
        group.affectedActions.push(error.context.actionId)
      }
    })

    // Generate suggestions for each group
    groups.forEach(group => {
      group.suggestions = this.generateGroupSuggestions(group)
    })

    return Array.from(groups.values()).sort((a, b) => {
      // Sort by severity first, then by number of errors
      const severityOrder = { critical: 4, error: 3, warning: 2, info: 1 }
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      return severityDiff !== 0 ? severityDiff : b.errors.length - a.errors.length
    })
  }

  /**
   * Determines severity for error category
   */
  private static determineSeverity(category: ErrorCategory): ErrorSeverity {
    switch (category) {
      case ErrorCategory.WORKFLOW_STRUCTURE:
        return ErrorSeverity.CRITICAL
      case ErrorCategory.DATA_FLOW:
        return ErrorSeverity.ERROR
      case ErrorCategory.PARAMETER_VALIDATION:
        return ErrorSeverity.ERROR
      case ErrorCategory.EXECUTION:
        return ErrorSeverity.CRITICAL
      case ErrorCategory.COMPATIBILITY:
        return ErrorSeverity.WARNING
      default:
        return ErrorSeverity.ERROR
    }
  }

  /**
   * Gets user-friendly title for error category
   */
  private static getCategoryTitle(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.PARAMETER_VALIDATION:
        return 'Parameter Issues'
      case ErrorCategory.DATA_FLOW:
        return 'Data Flow Problems'
      case ErrorCategory.WORKFLOW_STRUCTURE:
        return 'Workflow Structure Issues'
      case ErrorCategory.EXECUTION:
        return 'Execution Problems'
      case ErrorCategory.COMPATIBILITY:
        return 'Compatibility Warnings'
      default:
        return 'Validation Issues'
    }
  }

  /**
   * Gets description for error category
   */
  private static getCategoryDescription(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.PARAMETER_VALIDATION:
        return 'Issues with action parameters that need to be resolved before execution.'
      case ErrorCategory.DATA_FLOW:
        return 'Problems with how data flows between actions in your workflow.'
      case ErrorCategory.WORKFLOW_STRUCTURE:
        return 'Structural issues with the workflow that prevent proper execution.'
      case ErrorCategory.EXECUTION:
        return 'Issues that would prevent the workflow from executing successfully.'
      case ErrorCategory.COMPATIBILITY:
        return 'Compatibility concerns that may affect workflow behavior.'
      default:
        return 'Validation issues that need attention.'
    }
  }

  /**
   * Generates recovery suggestions for error groups
   */
  private static generateGroupSuggestions(group: ErrorGroup): ErrorRecoverySuggestion[] {
    const suggestions: ErrorRecoverySuggestion[] = []

    switch (group.category) {
      case ErrorCategory.PARAMETER_VALIDATION:
        suggestions.push({
          title: 'Fix Parameter Issues',
          description: 'Review and correct the highlighted parameter values.',
          action: 'manual_fix',
          steps: [
            'Click on each action with parameter errors',
            'Review the parameter configuration panel',
            'Correct invalid values based on the error messages',
            'Verify all required parameters are filled'
          ],
          estimatedTime: '2-5 minutes'
        })
        break

      case ErrorCategory.DATA_FLOW:
        suggestions.push({
          title: 'Fix Data Flow Issues',
          description: 'Resolve parameter connections and data type mismatches.',
          action: 'manual_fix',
          steps: [
            'Review the workflow canvas for connection issues',
            'Check parameter references between actions',
            'Ensure output types match input requirements',
            'Remove or fix circular dependencies'
          ],
          estimatedTime: '3-10 minutes'
        })
        break

      case ErrorCategory.WORKFLOW_STRUCTURE:
        suggestions.push({
          title: 'Fix Workflow Structure',
          description: 'Address structural issues with the workflow.',
          action: 'manual_fix',
          steps: [
            'Review the overall workflow structure',
            'Ensure all actions are properly configured',
            'Check for missing or duplicate actions',
            'Verify workflow execution order'
          ],
          estimatedTime: '5-15 minutes'
        })
        break
    }

    return suggestions
  }
}