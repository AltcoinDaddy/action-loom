/**
 * Parameter Value Processor Utility
 * 
 * Provides type-safe parameter value handling, input sanitization,
 * type conversion, and format validation for ActionLoom workflow parameters.
 */

import { ParameterType, ValidationError, ValidationErrorType } from '@/lib/types'

export interface ValueProcessorOptions {
  strict?: boolean // Whether to enforce strict validation
  preserveUserInput?: boolean // Whether to preserve user input during typing
  autoCorrect?: boolean // Whether to auto-correct common mistakes
  allowPartialInput?: boolean // Whether to allow partial input during typing (e.g., incomplete addresses)
  maxLength?: number // Maximum length for string inputs
  customValidation?: (value: any) => { isValid: boolean; errors: string[]; warnings: string[] }
}

export interface ProcessingResult {
  value: any
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  wasTransformed: boolean
  originalValue?: any
}

/**
 * Core value processor utility for type-safe parameter value handling
 */
export class ParameterValueProcessor {
  private static readonly FLOW_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{16}$/
  private static readonly UFIX64_MAX_DECIMALS = 8
  private static readonly UFIX64_MAX_VALUE = 184467440737.09551615 // 2^64 - 1 / 10^8

  /**
   * Sanitizes input values based on parameter type
   */
  static sanitizeInput(
    value: any, 
    parameterType: string, 
    options: ValueProcessorOptions = {}
  ): ProcessingResult {
    const result: ProcessingResult = {
      value,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false,
      originalValue: value
    }

    // Handle null/undefined values
    if (value === null || value === undefined) {
      result.value = ''
      return result
    }

    // Convert to string for processing
    const stringValue = String(value).trim()
    const normalizedType = this.normalizeParameterType(parameterType)

    try {
      switch (normalizedType) {
        case ParameterType.ADDRESS:
          result.value = this.sanitizeAddress(stringValue, options)
          break

        case ParameterType.UFIX64:
          result.value = this.sanitizeUFix64(stringValue, options)
          break

        case ParameterType.INT:
        case ParameterType.UINT64:
          result.value = this.sanitizeInteger(stringValue, normalizedType, options)
          break

        case ParameterType.BOOL:
          result.value = this.sanitizeBoolean(stringValue, options)
          break

        case ParameterType.STRING:
          result.value = this.sanitizeString(stringValue, options)
          break

        case ParameterType.ARRAY:
          result.value = this.sanitizeArray(value, options)
          break

        case ParameterType.DICTIONARY:
          result.value = this.sanitizeDictionary(value, options)
          break

        default:
          // Default string handling
          result.value = stringValue
      }

      // Check if value was transformed
      result.wasTransformed = result.value !== result.originalValue

    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_FORMAT,
        message: `Failed to sanitize ${parameterType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })
      result.value = result.originalValue // Preserve original on error
    }

    return result
  }

  /**
   * Converts string input to appropriate type
   */
  static convertType(
    value: any, 
    targetType: string, 
    options: ValueProcessorOptions = {}
  ): ProcessingResult {
    const result: ProcessingResult = {
      value,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false,
      originalValue: value
    }

    // Handle empty values
    if (value === '' || value === null || value === undefined) {
      result.value = this.getDefaultValue(targetType)
      return result
    }

    const normalizedType = this.normalizeParameterType(targetType)
    const stringValue = String(value).trim()

    try {
      switch (normalizedType) {
        case ParameterType.UFIX64:
          result.value = this.convertToUFix64(stringValue)
          break

        case ParameterType.INT:
          result.value = this.convertToInt(stringValue)
          break

        case ParameterType.UINT64:
          result.value = this.convertToUInt64(stringValue)
          break

        case ParameterType.BOOL:
          result.value = this.convertToBoolean(stringValue)
          break

        case ParameterType.ADDRESS:
          result.value = this.convertToAddress(stringValue, options)
          break

        case ParameterType.ARRAY:
          result.value = this.convertToArray(value)
          break

        case ParameterType.DICTIONARY:
          result.value = this.convertToDictionary(value)
          break

        default:
          // Keep as string
          result.value = stringValue
      }

      result.wasTransformed = result.value !== result.originalValue

    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: `Cannot convert to ${targetType}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })
      result.value = result.originalValue
    }

    return result
  }

  /**
   * Validates format of parameter values
   */
  static validateFormat(
    value: any, 
    parameterType: string, 
    options: ValueProcessorOptions = {}
  ): ProcessingResult {
    const result: ProcessingResult = {
      value,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false
    }

    // Empty values are handled by required validation
    if (value === '' || value === null || value === undefined) {
      return result
    }

    const normalizedType = this.normalizeParameterType(parameterType)

    try {
      switch (normalizedType) {
        case ParameterType.ADDRESS:
          this.validateAddressFormat(value, result)
          break

        case ParameterType.UFIX64:
          this.validateUFix64Format(value, result)
          break

        case ParameterType.INT:
          this.validateIntFormat(value, result)
          break

        case ParameterType.UINT64:
          this.validateUInt64Format(value, result)
          break

        case ParameterType.BOOL:
          this.validateBooleanFormat(value, result)
          break

        case ParameterType.STRING:
          this.validateStringFormat(value, result)
          break

        case ParameterType.ARRAY:
          this.validateArrayFormat(value, result)
          break

        case ParameterType.DICTIONARY:
          this.validateDictionaryFormat(value, result)
          break
      }
    } catch (error) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_FORMAT,
        message: `Format validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      })
    }

    return result
  }

  // Private helper methods for sanitization

  private static sanitizeAddress(value: string, options: ValueProcessorOptions): string {
    if (!value) return ''

    // Remove whitespace
    let cleaned = value.trim()

    // Auto-correct common mistakes if enabled
    if (options.autoCorrect) {
      // Remove common prefixes that aren't 0x
      cleaned = cleaned.replace(/^(0X|ox|0O)/i, '0x')
      
      // Ensure lowercase hex characters
      if (cleaned.startsWith('0x')) {
        cleaned = '0x' + cleaned.slice(2).toLowerCase()
      }
    }

    // Add 0x prefix if missing and looks like hex address
    if (!cleaned.startsWith('0x') && /^[a-fA-F0-9]{16}$/.test(cleaned)) {
      if (options.autoCorrect !== false) {
        cleaned = '0x' + cleaned.toLowerCase()
      }
    }

    return cleaned
  }

  private static sanitizeUFix64(value: string, options: ValueProcessorOptions): string {
    if (!value) return ''

    let cleaned = value.trim()

    // Remove invalid characters but preserve decimal point and digits
    cleaned = cleaned.replace(/[^0-9.]/g, '')

    // If after sanitization we have an empty string or just a decimal point, 
    // preserve the original for error handling
    if (cleaned === '' || cleaned === '.') {
      return value.trim() // Return original trimmed value for proper error handling
    }

    // Handle multiple decimal points
    const parts = cleaned.split('.')
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('')
    }

    // Limit decimal places to 8 for UFix64
    if (cleaned.includes('.')) {
      const [integer, decimal] = cleaned.split('.')
      if (decimal.length > this.UFIX64_MAX_DECIMALS) {
        cleaned = integer + '.' + decimal.slice(0, this.UFIX64_MAX_DECIMALS)
      }
    }

    return cleaned
  }

  private static sanitizeInteger(value: string, type: ParameterType, options: ValueProcessorOptions): string {
    if (!value) return ''

    let cleaned = value.trim()

    // For signed integers, preserve minus sign
    const isNegativeAllowed = type === ParameterType.INT
    const hasNegativeSign = cleaned.startsWith('-')

    // Remove all non-digit characters except minus for signed integers
    if (isNegativeAllowed && hasNegativeSign) {
      cleaned = '-' + cleaned.slice(1).replace(/[^0-9]/g, '')
    } else {
      cleaned = cleaned.replace(/[^0-9]/g, '')
    }

    // Remove leading zeros but keep single zero
    if (cleaned.length > 1 && !cleaned.startsWith('-')) {
      cleaned = cleaned.replace(/^0+/, '') || '0'
    } else if (cleaned.startsWith('-0') && cleaned.length > 2) {
      cleaned = '-' + (cleaned.slice(2).replace(/^0+/, '') || '0')
    }

    return cleaned
  }

  private static sanitizeBoolean(value: string, options: ValueProcessorOptions): string {
    if (!value) return ''

    const cleaned = value.trim().toLowerCase()
    
    // Convert common boolean representations
    if (['true', '1', 'yes', 'on', 'enabled'].includes(cleaned)) {
      return 'true'
    } else if (['false', '0', 'no', 'off', 'disabled'].includes(cleaned)) {
      return 'false'
    }

    return value // Return original if not recognized
  }

  private static sanitizeString(value: string, options: ValueProcessorOptions): string {
    if (typeof value !== 'string') return String(value)

    // Basic string sanitization - preserve most content
    let cleaned = value

    // Remove null bytes and other control characters except newlines and tabs
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

    // Normalize line endings
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

    return cleaned
  }

  private static sanitizeArray(value: any, options: ValueProcessorOptions): any {
    if (Array.isArray(value)) {
      return value
    }

    if (typeof value === 'string') {
      try {
        // Try to parse as JSON array
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // Try to split by common delimiters
        return value.split(/[,;|\n]/).map(item => item.trim()).filter(item => item)
      }
    }

    return [value] // Wrap single values in array
  }

  private static sanitizeDictionary(value: any, options: ValueProcessorOptions): any {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // Return empty object for invalid JSON
        return {}
      }
    }

    return {} // Default to empty object
  }

  // Private helper methods for type conversion

  private static convertToUFix64(value: string): number {
    const num = parseFloat(value)
    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`)
    }
    if (num < 0) {
      throw new Error('UFix64 cannot be negative')
    }
    if (num > this.UFIX64_MAX_VALUE) {
      throw new Error(`UFix64 value too large: ${num}`)
    }
    return num
  }

  private static convertToInt(value: string): number {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      throw new Error(`Invalid integer: ${value}`)
    }
    return num
  }

  private static convertToUInt64(value: string): number {
    const num = parseInt(value, 10)
    if (isNaN(num)) {
      throw new Error(`Invalid integer: ${value}`)
    }
    if (num < 0) {
      throw new Error('UInt64 cannot be negative')
    }
    if (num > Number.MAX_SAFE_INTEGER) {
      throw new Error(`UInt64 value too large: ${num}`)
    }
    return num
  }

  private static convertToBoolean(value: string): boolean {
    const cleaned = value.trim().toLowerCase()
    if (['true', '1', 'yes', 'on', 'enabled'].includes(cleaned)) {
      return true
    } else if (['false', '0', 'no', 'off', 'disabled'].includes(cleaned)) {
      return false
    }
    throw new Error(`Invalid boolean value: ${value}`)
  }

  private static convertToAddress(value: string, options: ValueProcessorOptions): string {
    const sanitized = this.sanitizeAddress(value, options)
    if (!this.FLOW_ADDRESS_PATTERN.test(sanitized)) {
      throw new Error(`Invalid Flow address format: ${value}`)
    }
    return sanitized
  }

  private static convertToArray(value: any): any[] {
    if (Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // Split by common delimiters
        return value.split(/[,;|\n]/).map(item => item.trim()).filter(item => item)
      }
    }
    return [value]
  }

  private static convertToDictionary(value: any): Record<string, any> {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return value
    }
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value)
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
          return parsed
        }
      } catch {
        // Return empty object for invalid JSON
      }
    }
    return {}
  }

  // Private helper methods for format validation

  private static validateAddressFormat(value: any, result: ProcessingResult): void {
    if (typeof value !== 'string') {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: 'Address must be a string',
        severity: 'error'
      })
      return
    }

    if (!this.FLOW_ADDRESS_PATTERN.test(value)) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.PATTERN_MISMATCH,
        message: 'Invalid Flow address format. Expected: 0x followed by 16 hexadecimal characters',
        severity: 'error'
      })
    }
  }

  private static validateUFix64Format(value: any, result: ProcessingResult): void {
    const num = typeof value === 'string' ? parseFloat(value) : value

    if (typeof num !== 'number' || isNaN(num)) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: 'UFix64 must be a valid number',
        severity: 'error'
      })
      return
    }

    if (num < 0) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: 'UFix64 cannot be negative',
        severity: 'error'
      })
    }

    if (num > this.UFIX64_MAX_VALUE) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: `UFix64 value too large. Maximum: ${this.UFIX64_MAX_VALUE}`,
        severity: 'error'
      })
    }

    // Check decimal places
    if (typeof value === 'string' && value.includes('.')) {
      const decimalPart = value.split('.')[1]
      if (decimalPart && decimalPart.length > this.UFIX64_MAX_DECIMALS) {
        result.warnings.push(`UFix64 supports maximum ${this.UFIX64_MAX_DECIMALS} decimal places`)
      }
    }
  }

  private static validateIntFormat(value: any, result: ProcessingResult): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value

    if (typeof num !== 'number' || isNaN(num) || !Number.isInteger(num)) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: 'Int must be a valid integer',
        severity: 'error'
      })
    }
  }

  private static validateUInt64Format(value: any, result: ProcessingResult): void {
    const num = typeof value === 'string' ? parseInt(value, 10) : value

    if (typeof num !== 'number' || isNaN(num) || !Number.isInteger(num)) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: 'UInt64 must be a valid integer',
        severity: 'error'
      })
      return
    }

    if (num < 0) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: 'UInt64 cannot be negative',
        severity: 'error'
      })
    }

    if (num > Number.MAX_SAFE_INTEGER) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: 'UInt64 value too large for JavaScript number',
        severity: 'error'
      })
    }
  }

  private static validateBooleanFormat(value: any, result: ProcessingResult): void {
    if (typeof value === 'boolean') {
      return // Valid boolean
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().toLowerCase()
      const validBooleanStrings = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off', 'enabled', 'disabled']
      if (!validBooleanStrings.includes(cleaned)) {
        result.isValid = false
        result.errors.push({
          type: ValidationErrorType.INVALID_FORMAT,
          message: `Invalid boolean value. Expected: true, false, 1, 0, yes, no, on, off, enabled, or disabled`,
          severity: 'error'
        })
      }
      return
    }

    result.isValid = false
    result.errors.push({
      type: ValidationErrorType.INVALID_TYPE,
      message: 'Boolean value must be a boolean or valid boolean string',
      severity: 'error'
    })
  }

  private static validateStringFormat(value: any, result: ProcessingResult): void {
    if (typeof value !== 'string') {
      result.warnings.push('Value will be converted to string')
    }

    // Check for potentially problematic characters
    if (typeof value === 'string') {
      if (value.includes('\x00')) {
        result.isValid = false
        result.errors.push({
          type: ValidationErrorType.INVALID_FORMAT,
          message: 'String cannot contain null bytes',
          severity: 'error'
        })
      }
    }
  }

  private static validateArrayFormat(value: any, result: ProcessingResult): void {
    if (!Array.isArray(value)) {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (!Array.isArray(parsed)) {
            result.warnings.push('String value will be converted to array')
          }
        } catch {
          result.warnings.push('String value will be split into array')
        }
      } else {
        result.warnings.push('Value will be wrapped in array')
      }
    }
  }

  private static validateDictionaryFormat(value: any, result: ProcessingResult): void {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value)
          if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            result.isValid = false
            result.errors.push({
              type: ValidationErrorType.INVALID_FORMAT,
              message: 'String must contain valid JSON object',
              severity: 'error'
            })
          }
        } catch {
          result.isValid = false
          result.errors.push({
            type: ValidationErrorType.INVALID_FORMAT,
            message: 'Invalid JSON format for dictionary',
            severity: 'error'
          })
        }
      } else {
        result.isValid = false
        result.errors.push({
          type: ValidationErrorType.INVALID_TYPE,
          message: 'Dictionary must be an object',
          severity: 'error'
        })
      }
    }
  }

  // Utility methods

  private static normalizeParameterType(type: string): ParameterType {
    const normalized = type.toLowerCase().trim()
    
    if (normalized.includes('address')) return ParameterType.ADDRESS
    if (normalized.includes('ufix64')) return ParameterType.UFIX64
    if (normalized.includes('uint64')) return ParameterType.UINT64
    if (normalized.includes('int')) return ParameterType.INT
    if (normalized.includes('bool')) return ParameterType.BOOL
    if (normalized.includes('array')) return ParameterType.ARRAY
    if (normalized.includes('dictionary')) return ParameterType.DICTIONARY
    if (normalized.includes('string')) return ParameterType.STRING
    
    return ParameterType.STRING // Default to string
  }

  /**
   * Enhanced validation for Flow addresses with additional checks
   */
  static validateFlowAddress(address: string, options: ValueProcessorOptions = {}): ProcessingResult {
    const result: ProcessingResult = {
      value: address,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false
    }

    if (!address || typeof address !== 'string') {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: 'Address must be a non-empty string',
        severity: 'error'
      })
      return result
    }

    const trimmed = address.trim()
    
    // Allow partial input during typing if enabled
    if (options.allowPartialInput && trimmed.length < 18) {
      // Check if it looks like it's going to be a valid address
      if (trimmed.startsWith('0x') && /^0x[a-fA-F0-9]*$/.test(trimmed)) {
        result.warnings.push('Address appears incomplete')
        return result
      }
    }

    // Full validation
    if (!this.FLOW_ADDRESS_PATTERN.test(trimmed)) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.PATTERN_MISMATCH,
        message: 'Invalid Flow address format. Expected: 0x followed by 16 hexadecimal characters',
        severity: 'error'
      })

      // Provide helpful suggestions
      if (!trimmed.startsWith('0x')) {
        result.warnings.push('Flow addresses must start with "0x"')
      }
      if (trimmed.length !== 18) {
        result.warnings.push(`Flow addresses must be exactly 18 characters (got ${trimmed.length})`)
      }
    }

    return result
  }

  /**
   * Enhanced validation for UFix64 with precision checks
   */
  static validateUFix64Precision(value: string | number, options: ValueProcessorOptions = {}): ProcessingResult {
    const result: ProcessingResult = {
      value,
      isValid: true,
      errors: [],
      warnings: [],
      wasTransformed: false
    }

    const num = typeof value === 'string' ? parseFloat(value) : value

    if (typeof num !== 'number' || isNaN(num)) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        message: 'UFix64 must be a valid number',
        severity: 'error'
      })
      return result
    }

    // Check precision
    if (typeof value === 'string' && value.includes('.')) {
      const decimalPart = value.split('.')[1]
      if (decimalPart && decimalPart.length > this.UFIX64_MAX_DECIMALS) {
        result.warnings.push(`UFix64 supports maximum ${this.UFIX64_MAX_DECIMALS} decimal places. Value will be truncated.`)
        result.wasTransformed = true
        result.value = parseFloat(num.toFixed(this.UFIX64_MAX_DECIMALS))
      }
    }

    // Check range
    if (num < 0) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: 'UFix64 cannot be negative',
        severity: 'error'
      })
    }

    if (num > this.UFIX64_MAX_VALUE) {
      result.isValid = false
      result.errors.push({
        type: ValidationErrorType.OUT_OF_RANGE,
        message: `UFix64 value too large. Maximum: ${this.UFIX64_MAX_VALUE}`,
        severity: 'error'
      })
    }

    return result
  }

  /**
   * Batch validation for multiple parameters
   */
  static validateParameterBatch(
    parameters: Array<{ value: any; type: string; name: string }>,
    options: ValueProcessorOptions = {}
  ): Record<string, ProcessingResult> {
    const results: Record<string, ProcessingResult> = {}

    for (const param of parameters) {
      try {
        results[param.name] = this.processValue(param.value, param.type, options)
      } catch (error) {
        results[param.name] = {
          value: param.value,
          isValid: false,
          errors: [{
            type: ValidationErrorType.CUSTOM_VALIDATION,
            message: `Batch validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error'
          }],
          warnings: [],
          wasTransformed: false,
          originalValue: param.value
        }
      }
    }

    return results
  }

  /**
   * Get suggested corrections for invalid input
   */
  static getSuggestions(value: any, parameterType: string): string[] {
    const suggestions: string[] = []
    const normalizedType = this.normalizeParameterType(parameterType)

    if (typeof value !== 'string') {
      return suggestions
    }

    const stringValue = value.trim()

    switch (normalizedType) {
      case ParameterType.ADDRESS:
        if (!stringValue.startsWith('0x') && /^[a-fA-F0-9]{16}$/.test(stringValue)) {
          suggestions.push(`0x${stringValue.toLowerCase()}`)
        }
        if (stringValue.startsWith('0X')) {
          suggestions.push(stringValue.toLowerCase())
        }
        break

      case ParameterType.UFIX64:
        // Remove non-numeric characters and suggest cleaned version
        const cleaned = stringValue.replace(/[^0-9.]/g, '')
        if (cleaned !== stringValue && cleaned) {
          suggestions.push(cleaned)
        }
        break

      case ParameterType.BOOL:
        const lower = stringValue.toLowerCase()
        if (['t', 'tr', 'tru'].includes(lower)) {
          suggestions.push('true')
        } else if (['f', 'fa', 'fal', 'fals'].includes(lower)) {
          suggestions.push('false')
        } else if (['y', 'ye'].includes(lower)) {
          suggestions.push('yes')
        } else if (['n'].includes(lower)) {
          suggestions.push('no')
        }
        break
    }

    return suggestions
  }

  private static getDefaultValue(type: string): any {
    const normalizedType = this.normalizeParameterType(type)
    
    switch (normalizedType) {
      case ParameterType.BOOL:
        return false
      case ParameterType.UFIX64:
      case ParameterType.INT:
      case ParameterType.UINT64:
        return 0
      case ParameterType.ARRAY:
        return []
      case ParameterType.DICTIONARY:
        return {}
      default:
        return ''
    }
  }

  /**
   * Comprehensive processing that combines sanitization, conversion, and validation
   */
  static processValue(
    value: any,
    parameterType: string,
    options: ValueProcessorOptions = {}
  ): ProcessingResult {
    // Step 1: Sanitize input
    const sanitized = ParameterValueProcessor.sanitizeInput(value, parameterType, options)
    if (!sanitized.isValid) {
      return sanitized
    }

    // Step 2: Convert type if needed
    const converted = ParameterValueProcessor.convertType(sanitized.value, parameterType, options)
    if (!converted.isValid) {
      return {
        ...converted,
        errors: [...sanitized.errors, ...converted.errors],
        warnings: [...sanitized.warnings, ...converted.warnings],
        originalValue: sanitized.originalValue
      }
    }

    // Step 3: Validate format
    const validated = ParameterValueProcessor.validateFormat(converted.value, parameterType, options)
    
    return {
      value: validated.value,
      isValid: validated.isValid,
      errors: [...sanitized.errors, ...converted.errors, ...validated.errors],
      warnings: [...sanitized.warnings, ...converted.warnings, ...validated.warnings],
      wasTransformed: sanitized.wasTransformed || converted.wasTransformed,
      originalValue: sanitized.originalValue
    }
  }
}

// Export convenience functions for common use cases
export const sanitizeParameterInput = ParameterValueProcessor.sanitizeInput
export const convertParameterType = ParameterValueProcessor.convertType
export const validateParameterFormat = ParameterValueProcessor.validateFormat
export const processParameterValue = ParameterValueProcessor.processValue