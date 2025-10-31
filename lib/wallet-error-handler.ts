export enum WalletErrorType {
  // Connection errors
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  CONNECTION_REJECTED = 'CONNECTION_REJECTED',
  
  // Authentication errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  AUTHENTICATION_TIMEOUT = 'AUTHENTICATION_TIMEOUT',
  AUTHENTICATION_CANCELLED = 'AUTHENTICATION_CANCELLED',
  
  // Session errors
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  SESSION_INVALID = 'SESSION_INVALID',
  SESSION_RESTORE_FAILED = 'SESSION_RESTORE_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  NETWORK_MISMATCH = 'NETWORK_MISMATCH',
  NETWORK_UNAVAILABLE = 'NETWORK_UNAVAILABLE',
  
  // Wallet specific errors
  WALLET_NOT_FOUND = 'WALLET_NOT_FOUND',
  WALLET_NOT_INSTALLED = 'WALLET_NOT_INSTALLED',
  WALLET_LOCKED = 'WALLET_LOCKED',
  WALLET_INCOMPATIBLE = 'WALLET_INCOMPATIBLE',
  
  // Account errors
  ACCOUNT_NOT_FOUND = 'ACCOUNT_NOT_FOUND',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  ACCOUNT_ACCESS_DENIED = 'ACCOUNT_ACCESS_DENIED',
  
  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  RATE_LIMITED = 'RATE_LIMITED'
}

export interface WalletError {
  type: WalletErrorType
  message: string
  originalError?: Error
  code?: string
  details?: Record<string, any>
  timestamp: number
  recoverable: boolean
  retryable: boolean
  userMessage: string
  technicalMessage: string
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: WalletErrorType[]
}

export interface FallbackStrategy {
  errorType: WalletErrorType
  fallbackAction: () => Promise<void>
  description: string
}

export class WalletErrorHandler {
  private retryConfig: RetryConfig
  private fallbackStrategies: Map<WalletErrorType, FallbackStrategy> = new Map()
  private errorHistory: WalletError[] = []
  private maxHistorySize = 50

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        WalletErrorType.CONNECTION_TIMEOUT,
        WalletErrorType.NETWORK_ERROR,
        WalletErrorType.RATE_LIMITED,
        WalletErrorType.SESSION_RESTORE_FAILED
      ],
      ...retryConfig
    }

    this.setupDefaultFallbackStrategies()
  }

  createError(
    type: WalletErrorType,
    message: string,
    originalError?: Error,
    details?: Record<string, any>
  ): WalletError {
    const error: WalletError = {
      type,
      message,
      originalError,
      details,
      timestamp: Date.now(),
      recoverable: this.isRecoverable(type),
      retryable: this.isRetryable(type),
      userMessage: this.getUserMessage(type, message),
      technicalMessage: this.getTechnicalMessage(type, message, originalError)
    }

    this.addToHistory(error)
    return error
  }

  async handleError<T>(
    operation: () => Promise<T>,
    errorContext: string,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.retryConfig, ...customRetryConfig }
    let lastError: WalletError | null = null

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        const walletError = this.parseError(error, errorContext)
        lastError = walletError

        console.error(`${errorContext} failed (attempt ${attempt}/${config.maxAttempts}):`, walletError)

        // If not retryable or last attempt, throw the error
        if (!walletError.retryable || attempt === config.maxAttempts) {
          // Try fallback strategy if available
          const fallback = this.fallbackStrategies.get(walletError.type)
          if (fallback && walletError.recoverable) {
            try {
              console.log(`Attempting fallback strategy for ${walletError.type}: ${fallback.description}`)
              await fallback.fallbackAction()
              // If fallback succeeds, retry the operation once more
              return await operation()
            } catch (fallbackError) {
              console.error('Fallback strategy failed:', fallbackError)
            }
          }
          
          throw walletError
        }

        // Calculate delay for next attempt
        const delay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        )

        console.log(`Retrying ${errorContext} in ${delay}ms...`)
        await this.delay(delay)
      }
    }

    throw lastError!
  }

  parseError(error: unknown, context: string): WalletError {
    if (error instanceof Error) {
      // Try to determine error type from error message or properties
      const errorType = this.determineErrorType(error)
      return this.createError(errorType, error.message, error, { context })
    }

    if (typeof error === 'string') {
      const errorType = this.determineErrorTypeFromString(error)
      return this.createError(errorType, error, undefined, { context })
    }

    return this.createError(
      WalletErrorType.UNKNOWN_ERROR,
      'An unknown error occurred',
      undefined,
      { context, originalError: error }
    )
  }

  addFallbackStrategy(errorType: WalletErrorType, strategy: FallbackStrategy): void {
    this.fallbackStrategies.set(errorType, strategy)
  }

  getErrorHistory(): WalletError[] {
    return [...this.errorHistory]
  }

  clearErrorHistory(): void {
    this.errorHistory = []
  }

  getErrorStats(): Record<WalletErrorType, number> {
    const stats: Record<string, number> = {}
    
    for (const error of this.errorHistory) {
      stats[error.type] = (stats[error.type] || 0) + 1
    }

    return stats as Record<WalletErrorType, number>
  }

  private setupDefaultFallbackStrategies(): void {
    // Session expired - try to restore or clear session
    this.addFallbackStrategy(WalletErrorType.SESSION_EXPIRED, {
      errorType: WalletErrorType.SESSION_EXPIRED,
      fallbackAction: async () => {
        localStorage.removeItem('actionloom_wallet_session')
        console.log('Cleared expired session')
      },
      description: 'Clear expired session data'
    })

    // Network error - wait and retry with different endpoint
    this.addFallbackStrategy(WalletErrorType.NETWORK_ERROR, {
      errorType: WalletErrorType.NETWORK_ERROR,
      fallbackAction: async () => {
        await this.delay(2000)
        console.log('Waited for network recovery')
      },
      description: 'Wait for network recovery'
    })

    // Wallet not found - provide installation guidance
    this.addFallbackStrategy(WalletErrorType.WALLET_NOT_FOUND, {
      errorType: WalletErrorType.WALLET_NOT_FOUND,
      fallbackAction: async () => {
        console.log('Wallet not found - user should install wallet')
      },
      description: 'Guide user to install wallet'
    })
  }

  private determineErrorType(error: Error): WalletErrorType {
    const message = error.message.toLowerCase()
    const name = error.name?.toLowerCase() || ''

    // Connection errors
    if (message.includes('connection') && message.includes('failed')) {
      return WalletErrorType.CONNECTION_FAILED
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return WalletErrorType.CONNECTION_TIMEOUT
    }
    if (message.includes('rejected') || message.includes('denied')) {
      return WalletErrorType.CONNECTION_REJECTED
    }

    // Authentication errors
    if (message.includes('authentication') && message.includes('failed')) {
      return WalletErrorType.AUTHENTICATION_FAILED
    }
    if (message.includes('authentication') && message.includes('cancelled')) {
      return WalletErrorType.AUTHENTICATION_CANCELLED
    }

    // Session errors
    if (message.includes('session') && message.includes('expired')) {
      return WalletErrorType.SESSION_EXPIRED
    }
    if (message.includes('session') && message.includes('invalid')) {
      return WalletErrorType.SESSION_INVALID
    }

    // Network errors
    if (message.includes('network') || name.includes('networkerror')) {
      return WalletErrorType.NETWORK_ERROR
    }
    if (message.includes('network') && message.includes('mismatch')) {
      return WalletErrorType.NETWORK_MISMATCH
    }

    // Wallet errors
    if (message.includes('wallet') && message.includes('not found')) {
      return WalletErrorType.WALLET_NOT_FOUND
    }
    if (message.includes('wallet') && message.includes('not installed')) {
      return WalletErrorType.WALLET_NOT_INSTALLED
    }
    if (message.includes('wallet') && message.includes('locked')) {
      return WalletErrorType.WALLET_LOCKED
    }

    // Account errors
    if (message.includes('account') && message.includes('not found')) {
      return WalletErrorType.ACCOUNT_NOT_FOUND
    }
    if (message.includes('insufficient') && message.includes('balance')) {
      return WalletErrorType.INSUFFICIENT_BALANCE
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return WalletErrorType.RATE_LIMITED
    }

    return WalletErrorType.UNKNOWN_ERROR
  }

  private determineErrorTypeFromString(error: string): WalletErrorType {
    const message = error.toLowerCase()

    if (message.includes('connection failed')) return WalletErrorType.CONNECTION_FAILED
    if (message.includes('timeout')) return WalletErrorType.CONNECTION_TIMEOUT
    if (message.includes('authentication failed')) return WalletErrorType.AUTHENTICATION_FAILED
    if (message.includes('session expired')) return WalletErrorType.SESSION_EXPIRED
    if (message.includes('network error')) return WalletErrorType.NETWORK_ERROR
    if (message.includes('wallet not found')) return WalletErrorType.WALLET_NOT_FOUND

    return WalletErrorType.UNKNOWN_ERROR
  }

  private isRecoverable(type: WalletErrorType): boolean {
    const recoverableErrors = [
      WalletErrorType.CONNECTION_TIMEOUT,
      WalletErrorType.NETWORK_ERROR,
      WalletErrorType.SESSION_EXPIRED,
      WalletErrorType.SESSION_RESTORE_FAILED,
      WalletErrorType.RATE_LIMITED,
      WalletErrorType.WALLET_LOCKED
    ]

    return recoverableErrors.includes(type)
  }

  private isRetryable(type: WalletErrorType): boolean {
    return this.retryConfig.retryableErrors.includes(type)
  }

  private getUserMessage(type: WalletErrorType, message: string): string {
    const userMessages: Record<WalletErrorType, string> = {
      [WalletErrorType.CONNECTION_FAILED]: 'Failed to connect to your wallet. Please try again.',
      [WalletErrorType.CONNECTION_TIMEOUT]: 'Connection timed out. Please check your internet connection and try again.',
      [WalletErrorType.CONNECTION_REJECTED]: 'Connection was rejected. Please approve the connection in your wallet.',
      [WalletErrorType.AUTHENTICATION_FAILED]: 'Authentication failed. Please try connecting your wallet again.',
      [WalletErrorType.AUTHENTICATION_TIMEOUT]: 'Authentication timed out. Please try again.',
      [WalletErrorType.AUTHENTICATION_CANCELLED]: 'Authentication was cancelled. Please try again if you want to connect.',
      [WalletErrorType.SESSION_EXPIRED]: 'Your session has expired. Please reconnect your wallet.',
      [WalletErrorType.SESSION_INVALID]: 'Your session is invalid. Please reconnect your wallet.',
      [WalletErrorType.SESSION_RESTORE_FAILED]: 'Failed to restore your session. Please reconnect your wallet.',
      [WalletErrorType.NETWORK_ERROR]: 'Network error occurred. Please check your connection and try again.',
      [WalletErrorType.NETWORK_MISMATCH]: 'Network mismatch. Please switch to the correct network in your wallet.',
      [WalletErrorType.NETWORK_UNAVAILABLE]: 'Network is currently unavailable. Please try again later.',
      [WalletErrorType.WALLET_NOT_FOUND]: 'Wallet not found. Please install a compatible Flow wallet.',
      [WalletErrorType.WALLET_NOT_INSTALLED]: 'Wallet is not installed. Please install a compatible Flow wallet.',
      [WalletErrorType.WALLET_LOCKED]: 'Your wallet is locked. Please unlock it and try again.',
      [WalletErrorType.WALLET_INCOMPATIBLE]: 'Your wallet is not compatible. Please use a supported Flow wallet.',
      [WalletErrorType.ACCOUNT_NOT_FOUND]: 'Account not found. Please check your wallet connection.',
      [WalletErrorType.INSUFFICIENT_BALANCE]: 'Insufficient balance to complete this operation.',
      [WalletErrorType.ACCOUNT_ACCESS_DENIED]: 'Access to account was denied. Please approve access in your wallet.',
      [WalletErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
      [WalletErrorType.OPERATION_CANCELLED]: 'Operation was cancelled.',
      [WalletErrorType.RATE_LIMITED]: 'Too many requests. Please wait a moment and try again.'
    }

    return userMessages[type] || message
  }

  private getTechnicalMessage(type: WalletErrorType, message: string, originalError?: Error): string {
    let technicalMessage = `${type}: ${message}`
    
    if (originalError) {
      technicalMessage += `\nOriginal error: ${originalError.name}: ${originalError.message}`
      if (originalError.stack) {
        technicalMessage += `\nStack trace: ${originalError.stack}`
      }
    }

    return technicalMessage
  }

  private addToHistory(error: WalletError): void {
    this.errorHistory.push(error)
    
    // Keep history size manageable
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}