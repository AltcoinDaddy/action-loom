import {
  ValidationError,
  ValidationErrorType,
  ParameterType,
  ActionMetadata,
  EnhancedActionParameter
} from './types'

/**
 * Error severity levels for prioritization
 */
export enum ErrorSeverity {
  CRITICAL = 'critical',
  ERROR = 'error', 
  WARNING = 'warning',
  INFO = 'info'
}

/**
 * Error categories for better organization
 */
export enum ErrorCategory {
  PARAMETER_VALIDATION = 'parameter_validation',
  DATA_FLOW = 'data_flow',
  WORKFLOW_STRUCTURE = 'workflow_structure',
  EXECUTION = 'execution',
  COMPATIBILITY = 'compatibility'
}

/**
 * Enhanced validation error with additional context
 */
export interface EnhancedValidationError extends ValidationError {
  category: ErrorCategory
  priority: number
  helpText?: string
  suggestedFix?: string
  documentationUrl?: string
  autoFixable?: boolean
  context?: Record<string, any>
}

/**
 * Error recovery suggestion
 */
export interface ErrorRecoverySuggestion {
  title: string
  description: string
  action: 'auto_fix' | 'manual_fix' | 'guidance'
  autoFixFunction?: () => Promise<any>
  steps?: string[]
  estimatedTime?: string
}

/**
 * Contextual help information
 */
export interface ContextualHelp {
  title: string
  description: string
  examples?: string[]
  commonMistakes?: string[]
  relatedTopics?: string[]
  videoUrl?: string
  documentationUrl?: string
}

/**
 * User-friendly error message system
 */
export class ErrorMessageSystem {
  private static readonly ERROR_PRIORITIES = {
    [ValidationErrorType.MISSING_REQUIRED]: 10,
    [ValidationErrorType.INVALID_TYPE]: 8,
    [ValidationErrorType.INVALID_FORMAT]: 7,
    [ValidationErrorType.OUT_OF_RANGE]: 6,
    [ValidationErrorType.PATTERN_MISMATCH]: 5,
    [ValidationErrorType.ENUM_VIOLATION]: 4,
    [ValidationErrorType.CUSTOM_VALIDATION]: 3
  }

  /**
   * Enhances a validation error with user-friendly information
   */
  static enhanceError(
    error: ValidationError,
    parameter?: EnhancedActionParameter,
    action?: ActionMetadata
  ): EnhancedValidationError {
    const enhanced: EnhancedValidationError = {
      ...error,
      category: this.categorizeError(error),
      priority: this.ERROR_PRIORITIES[error.type] || 1,
      helpText: this.generateHelpText(error, parameter),
      suggestedFix: this.generateSuggestedFix(error, parameter),
      documentationUrl: this.getDocumentationUrl(error, parameter),
      autoFixable: this.isAutoFixable(error, parameter),
      context: {
        parameterName: parameter?.name,
        parameterType: parameter?.type,
        actionName: action?.name,
        actionId: action?.id
      }
    }

    return enhanced
  }

  /**
   * Generates user-friendly error messages with specific guidance
   */
  static generateUserFriendlyMessage(
    error: ValidationError,
    parameter?: EnhancedActionParameter,
    action?: ActionMetadata
  ): string {
    const actionContext = action ? ` in "${action.name}"` : ''
    const paramName = parameter?.name || error.field || 'parameter'

    switch (error.type) {
      case ValidationErrorType.MISSING_REQUIRED:
        return `${paramName}${actionContext} is required. Please provide a value to continue.`

      case ValidationErrorType.INVALID_TYPE:
        const expectedType = parameter?.validation?.type || parameter?.type
        return `${paramName}${actionContext} expects a ${expectedType} value. ${this.getTypeGuidance(expectedType)}`

      case ValidationErrorType.INVALID_FORMAT:
        return `${paramName}${actionContext} format is incorrect. ${this.getFormatGuidance(parameter)}`

      case ValidationErrorType.OUT_OF_RANGE:
        return `${paramName}${actionContext} value is outside the allowed range. ${this.getRangeGuidance(parameter)}`

      case ValidationErrorType.PATTERN_MISMATCH:
        return `${paramName}${actionContext} doesn't match the required pattern. ${this.getPatternGuidance(parameter)}`

      case ValidationErrorType.ENUM_VIOLATION:
        return `${paramName}${actionContext} must be one of the allowed values. ${this.getEnumGuidance(parameter)}`

      case ValidationErrorType.CUSTOM_VALIDATION:
        return `${paramName}${actionContext}: ${error.message}`

      default:
        return error.message
    }
  }

  /**
   * Categorizes errors for better organization
   */
  private static categorizeError(error: ValidationError): ErrorCategory {
    switch (error.type) {
      case ValidationErrorType.MISSING_REQUIRED:
      case ValidationErrorType.INVALID_TYPE:
      case ValidationErrorType.INVALID_FORMAT:
      case ValidationErrorType.OUT_OF_RANGE:
      case ValidationErrorType.PATTERN_MISMATCH:
      case ValidationErrorType.ENUM_VIOLATION:
        return ErrorCategory.PARAMETER_VALIDATION
      case ValidationErrorType.CUSTOM_VALIDATION:
        return ErrorCategory.WORKFLOW_STRUCTURE
      default:
        return ErrorCategory.PARAMETER_VALIDATION
    }
  }

  /**
   * Generates contextual help text
   */
  private static generateHelpText(
    error: ValidationError,
    parameter?: EnhancedActionParameter
  ): string {
    switch (error.type) {
      case ValidationErrorType.MISSING_REQUIRED:
        return `This parameter is essential for the action to work correctly. Without it, the workflow cannot be executed.`

      case ValidationErrorType.INVALID_TYPE:
        const expectedType = parameter?.validation?.type || parameter?.type
        return `This parameter expects a specific data type (${expectedType}). Make sure your input matches this type.`

      case ValidationErrorType.INVALID_FORMAT:
        if (parameter?.validation?.type === ParameterType.ADDRESS) {
          return `Flow addresses must start with "0x" followed by exactly 16 hexadecimal characters (0-9, a-f).`
        }
        return `The input format doesn't match what's expected for this parameter type.`

      case ValidationErrorType.OUT_OF_RANGE:
        return `The value you entered is outside the acceptable range for this parameter.`

      case ValidationErrorType.PATTERN_MISMATCH:
        return `The input doesn't match the required pattern or format for this parameter.`

      case ValidationErrorType.ENUM_VIOLATION:
        return `This parameter only accepts specific predefined values. Choose from the available options.`

      default:
        return `There's an issue with this parameter that needs to be resolved.`
    }
  }

  /**
   * Generates suggested fixes
   */
  private static generateSuggestedFix(
    error: ValidationError,
    parameter?: EnhancedActionParameter
  ): string {
    switch (error.type) {
      case ValidationErrorType.MISSING_REQUIRED:
        return `Enter a value for ${parameter?.name || 'this parameter'}.`

      case ValidationErrorType.INVALID_TYPE:
        const expectedType = parameter?.validation?.type || parameter?.type
        return `Convert your input to ${expectedType} format. ${this.getTypeConversionTip(expectedType)}`

      case ValidationErrorType.INVALID_FORMAT:
        if (parameter?.validation?.type === ParameterType.ADDRESS) {
          return `Use format: 0x1234567890abcdef (16 hex characters after 0x)`
        }
        return `Check the expected format and adjust your input accordingly.`

      case ValidationErrorType.OUT_OF_RANGE:
        const constraints = parameter?.validation?.constraints
        if (constraints?.min !== undefined && constraints?.max !== undefined) {
          return `Enter a value between ${constraints.min} and ${constraints.max}.`
        } else if (constraints?.min !== undefined) {
          return `Enter a value greater than or equal to ${constraints.min}.`
        } else if (constraints?.max !== undefined) {
          return `Enter a value less than or equal to ${constraints.max}.`
        }
        return `Adjust the value to be within the acceptable range.`

      case ValidationErrorType.ENUM_VIOLATION:
        const enumOptions = parameter?.validation?.constraints?.enum
        if (enumOptions) {
          return `Choose one of: ${enumOptions.join(', ')}`
        }
        return `Select from the available dropdown options.`

      default:
        return `Review and correct the parameter value.`
    }
  }

  /**
   * Gets documentation URL for error type
   */
  private static getDocumentationUrl(
    error: ValidationError,
    parameter?: EnhancedActionParameter
  ): string {
    const baseUrl = 'https://docs.actionloom.com'
    
    switch (error.type) {
      case ValidationErrorType.INVALID_FORMAT:
        if (parameter?.validation?.type === ParameterType.ADDRESS) {
          return `${baseUrl}/parameters/flow-addresses`
        }
        return `${baseUrl}/parameters/formats`
      case ValidationErrorType.INVALID_TYPE:
        return `${baseUrl}/parameters/types`
      case ValidationErrorType.OUT_OF_RANGE:
        return `${baseUrl}/parameters/constraints`
      default:
        return `${baseUrl}/troubleshooting/validation-errors`
    }
  }

  /**
   * Determines if error can be auto-fixed
   */
  private static isAutoFixable(
    error: ValidationError,
    parameter?: EnhancedActionParameter
  ): boolean {
    switch (error.type) {
      case ValidationErrorType.INVALID_FORMAT:
        // Address formatting can be auto-fixed in some cases
        return parameter?.validation?.type === ParameterType.ADDRESS
      case ValidationErrorType.INVALID_TYPE:
        // Simple type conversions can be auto-fixed
        return true
      default:
        return false
    }
  }

  /**
   * Provides type-specific guidance
   */
  private static getTypeGuidance(type?: ParameterType | string): string {
    switch (type) {
      case ParameterType.ADDRESS:
        return 'Flow addresses start with 0x and contain 16 hexadecimal characters.'
      case ParameterType.UFIX64:
        return 'UFix64 values are positive decimal numbers (e.g., 10.5, 0.001).'
      case ParameterType.STRING:
        return 'String values are text enclosed in quotes.'
      case ParameterType.BOOL:
        return 'Boolean values are either true or false.'
      case ParameterType.INT:
        return 'Integer values are whole numbers (positive or negative).'
      case ParameterType.UINT64:
        return 'UInt64 values are positive whole numbers.'
      default:
        return 'Check the expected data type for this parameter.'
    }
  }

  /**
   * Provides format-specific guidance
   */
  private static getFormatGuidance(parameter?: EnhancedActionParameter): string {
    if (parameter?.validation?.type === ParameterType.ADDRESS) {
      return 'Example: 0x1654653399040a61'
    }
    if (parameter?.validation?.constraints?.pattern) {
      return `Must match pattern: ${parameter.validation.constraints.pattern.toString()}`
    }
    return 'Check the required format for this parameter.'
  }

  /**
   * Provides range-specific guidance
   */
  private static getRangeGuidance(parameter?: EnhancedActionParameter): string {
    const constraints = parameter?.validation?.constraints
    if (constraints?.min !== undefined && constraints?.max !== undefined) {
      return `Must be between ${constraints.min} and ${constraints.max}.`
    } else if (constraints?.min !== undefined) {
      return `Must be at least ${constraints.min}.`
    } else if (constraints?.max !== undefined) {
      return `Must be no more than ${constraints.max}.`
    }
    return 'Value is outside the acceptable range.'
  }

  /**
   * Provides enum-specific guidance
   */
  private static getEnumGuidance(parameter?: EnhancedActionParameter): string {
    const enumOptions = parameter?.validation?.constraints?.enum
    if (enumOptions && enumOptions.length <= 5) {
      return `Available options: ${enumOptions.join(', ')}`
    } else if (enumOptions) {
      return `Choose from ${enumOptions.length} available options.`
    }
    return 'Select from the available options.'
  }

  /**
   * Provides pattern-specific guidance
   */
  private static getPatternGuidance(parameter?: EnhancedActionParameter): string {
    const pattern = parameter?.validation?.constraints?.pattern
    if (pattern) {
      return `Required pattern: ${pattern.toString()}`
    }
    return 'Input doesn\'t match the required pattern.'
  }

  /**
   * Provides type conversion tips
   */
  private static getTypeConversionTip(type?: ParameterType | string): string {
    switch (type) {
      case ParameterType.UFIX64:
        return 'Enter as a decimal number (e.g., 10.5).'
      case ParameterType.INT:
        return 'Enter as a whole number (e.g., 42).'
      case ParameterType.BOOL:
        return 'Enter as true or false.'
      case ParameterType.STRING:
        return 'Enter as text.'
      default:
        return ''
    }
  }
}