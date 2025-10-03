import { FlowErrorCode } from './flow-config'

/**
 * Base Flow error class
 */
export class FlowError extends Error {
  public readonly code: FlowErrorCode
  public readonly details: Record<string, any>
  public readonly recoverable: boolean

  constructor(
    code: FlowErrorCode,
    message: string,
    details: Record<string, any> = {},
    recoverable: boolean = false
  ) {
    super(message)
    this.name = 'FlowError'
    this.code = code
    this.details = details
    this.recoverable = recoverable
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      recoverable: this.recoverable,
      stack: this.stack
    }
  }
}

/**
 * Network-related errors
 */
export class FlowNetworkError extends FlowError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(FlowErrorCode.NETWORK_ERROR, message, details, true)
    this.name = 'FlowNetworkError'
  }
}

/**
 * Authentication-related errors
 */
export class FlowAuthenticationError extends FlowError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(FlowErrorCode.AUTHENTICATION_ERROR, message, details, false)
    this.name = 'FlowAuthenticationError'
  }
}

/**
 * Script execution errors
 */
export class FlowScriptError extends FlowError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(FlowErrorCode.SCRIPT_EXECUTION_ERROR, message, details, false)
    this.name = 'FlowScriptError'
  }
}

/**
 * Transaction-related errors
 */
export class FlowTransactionError extends FlowError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(FlowErrorCode.TRANSACTION_ERROR, message, details, false)
    this.name = 'FlowTransactionError'
  }
}

/**
 * Action discovery errors
 */
export class ActionDiscoveryError extends FlowError {
  constructor(message: string, details: Record<string, any> = {}) {
    super(FlowErrorCode.SCRIPT_EXECUTION_ERROR, message, details, true)
    this.name = 'ActionDiscoveryError'
  }
}

/**
 * Error handler utility
 */
export class FlowErrorHandler {
  /**
   * Handle and categorize Flow API errors
   */
  static handleAPIError(error: any): FlowError {
    if (error instanceof FlowError) {
      return error
    }

    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return new FlowNetworkError('Network request failed', { originalError: error.message })
    }

    // HTTP errors
    if (error.status) {
      switch (error.status) {
        case 401:
        case 403:
          return new FlowAuthenticationError('Authentication failed', { status: error.status })
        case 429:
          return new FlowError(FlowErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { status: error.status }, true)
        case 404:
          return new FlowError(FlowErrorCode.ACCOUNT_NOT_FOUND, 'Resource not found', { status: error.status })
        case 500:
        case 502:
        case 503:
          return new FlowNetworkError('Server error', { status: error.status })
        default:
          return new FlowError(FlowErrorCode.NETWORK_ERROR, `HTTP ${error.status}`, { status: error.status })
      }
    }

    // Generic error
    return new FlowError(FlowErrorCode.NETWORK_ERROR, error.message || 'Unknown error', { originalError: error })
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: FlowError): boolean {
    return error.recoverable
  }

  /**
   * Get retry delay for recoverable errors
   */
  static getRetryDelay(attempt: number, maxDelay: number = 30000): number {
    const baseDelay = 1000 // 1 second
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * exponentialDelay
    return exponentialDelay + jitter
  }

  /**
   * Format error for user display
   */
  static formatUserError(error: FlowError): string {
    switch (error.code) {
      case FlowErrorCode.NETWORK_ERROR:
        return 'Unable to connect to Flow network. Please check your internet connection and try again.'
      case FlowErrorCode.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please check your API credentials.'
      case FlowErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment and try again.'
      case FlowErrorCode.INSUFFICIENT_BALANCE:
        return 'Insufficient balance to complete this transaction.'
      case FlowErrorCode.ACCOUNT_NOT_FOUND:
        return 'Account or resource not found on the Flow network.'
      default:
        return error.message || 'An unexpected error occurred.'
    }
  }
}

/**
 * Retry utility for Flow operations
 */
export async function retryFlowOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  shouldRetry: (error: FlowError) => boolean = FlowErrorHandler.isRecoverable
): Promise<T> {
  let lastError: FlowError

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      const flowError = FlowErrorHandler.handleAPIError(error)
      lastError = flowError

      if (attempt === maxRetries || !shouldRetry(flowError)) {
        throw flowError
      }

      const delay = FlowErrorHandler.getRetryDelay(attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}