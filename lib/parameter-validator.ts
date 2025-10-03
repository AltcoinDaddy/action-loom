import {
  ActionParameter,
  ActionMetadata,
  EnhancedActionMetadata,
  EnhancedActionParameter,
  ParameterValidationRules,
  ParameterConstraints,
  ParameterSuggestion,
  ParameterDependency,
  ParameterType,
  ParsedWorkflow,
  ParsedAction,
  ActionOutput,
  ValidationError,
  ValidationErrorType,
  ParameterValidationResult as SharedParameterValidationResult
} from './types'
import { enhancedActionMetadataService } from './enhanced-action-metadata-service'

// Validation context and results
export interface ValidationContext {
  workflow: ParsedWorkflow
  currentAction: ParsedAction
  availableOutputs: Record<string, ActionOutput>
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  suggestions?: string[]
}

export interface ParameterValidationResult extends ValidationResult {
  parameterName: string
  value: any
}

export interface ActionValidationResult {
  actionId: string
  isValid: boolean
  missingParameters: string[]
  invalidParameters: Record<string, ParameterValidationResult>
  warnings: string[]
}

// ValidationError and ValidationErrorType are now imported from './types'

// Error message templates
export const ERROR_MESSAGES = {
  [ValidationErrorType.MISSING_REQUIRED]: (param: string) =>
    `${param} is required and must be provided`,
  [ValidationErrorType.INVALID_TYPE]: (param: string, expected: string, actual: string) =>
    `${param} expects ${expected} but received ${actual}`,
  [ValidationErrorType.INVALID_FORMAT]: (param: string, format: string) =>
    `${param} must be in ${format} format`,
  [ValidationErrorType.OUT_OF_RANGE]: (param: string, min: number, max: number) =>
    `${param} must be between ${min} and ${max}`,
  [ValidationErrorType.PATTERN_MISMATCH]: (param: string, pattern: string) =>
    `${param} does not match required pattern: ${pattern}`,
  [ValidationErrorType.ENUM_VIOLATION]: (param: string, options: string[]) =>
    `${param} must be one of: ${options.join(', ')}`,
  [ValidationErrorType.CUSTOM_VALIDATION]: (param: string, message: string) =>
    `${param}: ${message}`
}

/**
 * ParameterValidator class for validating action parameters
 */
export class ParameterValidator {
  /**
   * Validates a single parameter value against its rules
   */
  validateParameter(
    parameter: EnhancedActionParameter,
    value: any,
    context: ValidationContext
  ): ParameterValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    // Check if required parameter is missing
    if (parameter.validation?.required && (value === undefined || value === null || value === '')) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED,
        message: ERROR_MESSAGES[ValidationErrorType.MISSING_REQUIRED](parameter.name),
        field: parameter.name,
        severity: 'error'
      })
    }

    // Skip further validation if value is empty and not required
    if (!parameter.validation?.required && (value === undefined || value === null || value === '')) {
      return {
        parameterName: parameter.name,
        value,
        isValid: true,
        errors: [],
        warnings: [],
        suggestions: []
      }
    }

    // Type validation
    if (value !== undefined && value !== null && value !== '') {
      const typeValidation = this.validateType(parameter, value)
      errors.push(...typeValidation.errors)
      warnings.push(...typeValidation.warnings)
      suggestions.push(...typeValidation.suggestions || [])
    }

    // Constraint validation
    if (parameter.validation?.constraints && value !== undefined && value !== null && value !== '') {
      const constraintValidation = this.validateConstraints(parameter, value)
      errors.push(...constraintValidation.errors)
      warnings.push(...constraintValidation.warnings)
    }

    // Custom validation
    if (parameter.validation?.customValidator && value !== undefined && value !== null && value !== '') {
      const customValidation = parameter.validation.customValidator(value, context)
      errors.push(...customValidation.errors)
      warnings.push(...customValidation.warnings)
      if (customValidation.suggestions) {
        suggestions.push(...customValidation.suggestions)
      }
    }

    return {
      parameterName: parameter.name,
      value,
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    }
  }

  /**
   * Validates all parameters for an action
   */
  validateAllParameters(
    action: ActionMetadata,
    parameterValues: Record<string, any>,
    context: ValidationContext
  ): ActionValidationResult {
    const missingParameters: string[] = []
    const invalidParameters: Record<string, ParameterValidationResult> = {}
    const warnings: string[] = []

    // Get enhanced action metadata
    const enhancedAction = enhancedActionMetadataService.enhanceActionMetadata(action)

    // Check if this is a newly added action (no parameter values set yet)
    const hasAnyParameterValues = Object.keys(parameterValues).length > 0 &&
      Object.values(parameterValues).some(value => value !== '' && value !== null && value !== undefined)

    for (const parameter of enhancedAction.parameters) {
      const value = parameterValues[parameter.name]

      // Skip validation for parameter references - they will be validated by workflow validator
      if (this.isParameterReference(value)) {
        continue
      }

      const validation = this.validateParameter(parameter, value, context)

      if (!validation.isValid) {
        invalidParameters[parameter.name] = validation
      }

      // Only report missing required parameters if the user has started configuring parameters
      // This prevents showing "missing required parameter" errors immediately when an action is added
      if (parameter.validation?.required && (value === undefined || value === null || value === '')) {
        if (hasAnyParameterValues || this.hasUserInteractedWithAction(parameterValues)) {
          missingParameters.push(parameter.name)
        }
      }

      warnings.push(...validation.warnings)
    }

    // Run action-level validation rules if they exist
    if (enhancedAction.validationRules?.customValidation) {
      const actionValidation = enhancedAction.validationRules.customValidation(parameterValues, context)
      if (!actionValidation.isValid) {
        actionValidation.errors.forEach(error => {
          warnings.push(error.message)
        })
      }
      warnings.push(...actionValidation.warnings)
    }

    return {
      actionId: action.id,
      isValid: missingParameters.length === 0 && Object.keys(invalidParameters).length === 0,
      missingParameters,
      invalidParameters,
      warnings
    }
  }

  /**
   * Checks if the user has interacted with the action parameters
   * This helps determine whether to show "missing required parameter" errors
   */
  private hasUserInteractedWithAction(parameterValues: Record<string, any>): boolean {
    // If any parameter has a non-empty value, consider it as user interaction
    return Object.values(parameterValues).some(value => {
      if (typeof value === 'string') {
        return value.trim() !== ''
      }
      if (typeof value === 'boolean') {
        return true // Boolean values are always considered as set
      }
      if (typeof value === 'number') {
        return !isNaN(value)
      }
      return value !== null && value !== undefined
    })
  }

  /**
   * Checks if a value is a parameter reference
   */
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

  /**
   * Validates parameter type
   */
  private validateType(parameter: EnhancedActionParameter, value: any): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    const expectedType = parameter.validation?.type || this.inferParameterType(parameter.type)

    switch (expectedType) {
      case ParameterType.ADDRESS:
        if (!this.isValidAddress(value)) {
          errors.push({
            type: ValidationErrorType.INVALID_FORMAT,
            message: ERROR_MESSAGES[ValidationErrorType.INVALID_FORMAT](parameter.name, 'Flow address (0x...)'),
            field: parameter.name,
            severity: 'error'
          })
          suggestions.push('Flow addresses must start with 0x and be 16 characters long')
        }
        break

      case ParameterType.UFIX64:
        if (!this.isValidUFix64(value)) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            message: ERROR_MESSAGES[ValidationErrorType.INVALID_TYPE](parameter.name, 'UFix64', typeof value),
            field: parameter.name,
            severity: 'error'
          })
          suggestions.push('UFix64 values must be positive decimal numbers')
        }
        break

      case ParameterType.STRING:
        if (typeof value !== 'string') {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            message: ERROR_MESSAGES[ValidationErrorType.INVALID_TYPE](parameter.name, 'String', typeof value),
            field: parameter.name,
            severity: 'error'
          })
        }
        break

      case ParameterType.BOOL:
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            message: ERROR_MESSAGES[ValidationErrorType.INVALID_TYPE](parameter.name, 'Bool', typeof value),
            field: parameter.name,
            severity: 'error'
          })
        }
        break

      case ParameterType.INT:
        if (!this.isValidInt(value)) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            message: ERROR_MESSAGES[ValidationErrorType.INVALID_TYPE](parameter.name, 'Int', typeof value),
            field: parameter.name,
            severity: 'error'
          })
        }
        break

      case ParameterType.UINT64:
        if (!this.isValidUInt64(value)) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            message: ERROR_MESSAGES[ValidationErrorType.INVALID_TYPE](parameter.name, 'UInt64', typeof value),
            field: parameter.name,
            severity: 'error'
          })
          suggestions.push('UInt64 values must be positive integers')
        }
        break
    }

    return { isValid: errors.length === 0, errors, warnings, suggestions }
  }

  /**
   * Validates parameter constraints
   */
  private validateConstraints(parameter: EnhancedActionParameter, value: any): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: string[] = []
    const constraints = parameter.validation?.constraints

    if (!constraints) {
      return { isValid: true, errors: [], warnings: [] }
    }

    // Range validation
    if (constraints.min !== undefined || constraints.max !== undefined) {
      const numValue = parseFloat(value)
      if (!isNaN(numValue)) {
        if (constraints.min !== undefined && numValue < constraints.min) {
          errors.push({
            type: ValidationErrorType.OUT_OF_RANGE,
            message: ERROR_MESSAGES[ValidationErrorType.OUT_OF_RANGE](
              parameter.name,
              constraints.min,
              constraints.max || Infinity
            ),
            field: parameter.name,
            severity: 'error'
          })
        }
        if (constraints.max !== undefined && numValue > constraints.max) {
          errors.push({
            type: ValidationErrorType.OUT_OF_RANGE,
            message: ERROR_MESSAGES[ValidationErrorType.OUT_OF_RANGE](
              parameter.name,
              constraints.min || -Infinity,
              constraints.max
            ),
            field: parameter.name,
            severity: 'error'
          })
        }
      }
    }

    // String length validation
    if (typeof value === 'string') {
      if (constraints.minLength !== undefined && value.length < constraints.minLength) {
        errors.push({
          type: ValidationErrorType.OUT_OF_RANGE,
          message: `${parameter.name} must be at least ${constraints.minLength} characters long`,
          field: parameter.name,
          severity: 'error'
        })
      }
      if (constraints.maxLength !== undefined && value.length > constraints.maxLength) {
        errors.push({
          type: ValidationErrorType.OUT_OF_RANGE,
          message: `${parameter.name} must be no more than ${constraints.maxLength} characters long`,
          field: parameter.name,
          severity: 'error'
        })
      }
    }

    // Pattern validation
    if (constraints.pattern && typeof value === 'string') {
      if (!constraints.pattern.test(value)) {
        errors.push({
          type: ValidationErrorType.PATTERN_MISMATCH,
          message: ERROR_MESSAGES[ValidationErrorType.PATTERN_MISMATCH](
            parameter.name,
            constraints.pattern.toString()
          ),
          field: parameter.name,
          severity: 'error'
        })
      }
    }

    // Enum validation
    if (constraints.enum && !constraints.enum.includes(value)) {
      errors.push({
        type: ValidationErrorType.ENUM_VIOLATION,
        message: ERROR_MESSAGES[ValidationErrorType.ENUM_VIOLATION](parameter.name, constraints.enum),
        field: parameter.name,
        severity: 'error'
      })
    }

    // Decimal places validation for UFix64
    if (constraints.decimals !== undefined && parameter.validation?.type === ParameterType.UFIX64) {
      const decimalPlaces = this.getDecimalPlaces(value)
      if (decimalPlaces > constraints.decimals) {
        warnings.push(`${parameter.name} has more than ${constraints.decimals} decimal places`)
      }
    }

    return { isValid: errors.length === 0, errors, warnings }
  }



  /**
   * Infers ParameterType from string type
   */
  private inferParameterType(typeString: string): ParameterType {
    switch (typeString) {
      case 'Address':
        return ParameterType.ADDRESS
      case 'UFix64':
        return ParameterType.UFIX64
      case 'String':
        return ParameterType.STRING
      case 'Bool':
        return ParameterType.BOOL
      case 'Int':
        return ParameterType.INT
      case 'UInt64':
        return ParameterType.UINT64
      case 'Array':
        return ParameterType.ARRAY
      case 'Dictionary':
        return ParameterType.DICTIONARY
      case 'Optional':
        return ParameterType.OPTIONAL
      default:
        return ParameterType.STRING
    }
  }

  /**
   * Gets default constraints for a parameter type
   */
  private getDefaultConstraints(typeString: string): ParameterConstraints | undefined {
    const paramType = this.inferParameterType(typeString)

    switch (paramType) {
      case ParameterType.ADDRESS:
        return {
          pattern: /^0x[a-fA-F0-9]{16}$/,
          minLength: 18,
          maxLength: 18
        }
      case ParameterType.UFIX64:
        return {
          min: 0,
          decimals: 8
        }
      case ParameterType.UINT64:
        return {
          min: 0,
          max: Number.MAX_SAFE_INTEGER // Use safe integer limit for JavaScript
        }
      case ParameterType.INT:
        return {
          min: Number.MIN_SAFE_INTEGER, // Use safe integer limit for JavaScript
          max: Number.MAX_SAFE_INTEGER
        }
      default:
        return undefined
    }
  }

  // Type validation helpers
  private isValidAddress(value: any): boolean {
    if (typeof value !== 'string') return false
    return /^0x[a-fA-F0-9]{16}$/.test(value)
  }

  private isValidUFix64(value: any): boolean {
    if (typeof value === 'number') return value >= 0 && isFinite(value)
    if (typeof value === 'string') {
      const num = parseFloat(value)
      return !isNaN(num) && num >= 0 && isFinite(num)
    }
    return false
  }

  private isValidInt(value: any): boolean {
    if (typeof value === 'number') return Number.isInteger(value)
    if (typeof value === 'string') {
      const num = parseInt(value, 10)
      return !isNaN(num) && num.toString() === value
    }
    return false
  }

  private isValidUInt64(value: any): boolean {
    if (typeof value === 'number') {
      return Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER
    }
    if (typeof value === 'string') {
      const num = parseInt(value, 10)
      return !isNaN(num) && num >= 0 && num <= Number.MAX_SAFE_INTEGER && num.toString() === value
    }
    return false
  }

  private getDecimalPlaces(value: any): number {
    if (typeof value === 'number') {
      const str = value.toString()
      const decimalIndex = str.indexOf('.')
      return decimalIndex === -1 ? 0 : str.length - decimalIndex - 1
    }
    if (typeof value === 'string') {
      const decimalIndex = value.indexOf('.')
      return decimalIndex === -1 ? 0 : value.length - decimalIndex - 1
    }
    return 0
  }
}