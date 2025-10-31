import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalletErrorHandler, WalletErrorType } from '@/lib/wallet-error-handler'

describe('WalletErrorHandler', () => {
  let errorHandler: WalletErrorHandler

  beforeEach(() => {
    errorHandler = new WalletErrorHandler()
  })

  describe('createError', () => {
    it('should create a wallet error with correct properties', () => {
      const error = errorHandler.createError(
        WalletErrorType.CONNECTION_FAILED,
        'Connection failed',
        new Error('Original error'),
        { context: 'test' }
      )

      expect(error.type).toBe(WalletErrorType.CONNECTION_FAILED)
      expect(error.message).toBe('Connection failed')
      expect(error.originalError).toBeInstanceOf(Error)
      expect(error.details).toEqual({ context: 'test' })
      expect(error.timestamp).toBeGreaterThan(0)
      expect(error.recoverable).toBe(false)
      expect(error.retryable).toBe(false)
      expect(error.userMessage).toBe('Failed to connect to your wallet. Please try again.')
      expect(error.technicalMessage).toContain('CONNECTION_FAILED: Connection failed')
    })

    it('should mark retryable errors correctly', () => {
      const retryableError = errorHandler.createError(
        WalletErrorType.CONNECTION_TIMEOUT,
        'Timeout'
      )
      const nonRetryableError = errorHandler.createError(
        WalletErrorType.WALLET_NOT_FOUND,
        'Not found'
      )

      expect(retryableError.retryable).toBe(true)
      expect(nonRetryableError.retryable).toBe(false)
    })

    it('should mark recoverable errors correctly', () => {
      const recoverableError = errorHandler.createError(
        WalletErrorType.SESSION_EXPIRED,
        'Session expired'
      )
      const nonRecoverableError = errorHandler.createError(
        WalletErrorType.WALLET_NOT_FOUND,
        'Not found'
      )

      expect(recoverableError.recoverable).toBe(true)
      expect(nonRecoverableError.recoverable).toBe(false)
    })
  })

  describe('parseError', () => {
    it('should parse Error objects correctly', () => {
      const originalError = new Error('Connection failed')
      const walletError = errorHandler.parseError(originalError, 'test context')

      expect(walletError.type).toBe(WalletErrorType.CONNECTION_FAILED)
      expect(walletError.message).toBe('Connection failed')
      expect(walletError.originalError).toBe(originalError)
      expect(walletError.details?.context).toBe('test context')
    })

    it('should parse string errors correctly', () => {
      const walletError = errorHandler.parseError('timeout occurred', 'test context')

      expect(walletError.type).toBe(WalletErrorType.CONNECTION_TIMEOUT)
      expect(walletError.message).toBe('timeout occurred')
      expect(walletError.details?.context).toBe('test context')
    })

    it('should handle unknown error types', () => {
      const walletError = errorHandler.parseError({ unknown: 'error' }, 'test context')

      expect(walletError.type).toBe(WalletErrorType.UNKNOWN_ERROR)
      expect(walletError.message).toBe('An unknown error occurred')
      expect(walletError.details?.context).toBe('test context')
    })
  })

  describe('handleError', () => {
    it('should execute operation successfully on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success')

      const result = await errorHandler.handleError(operation, 'test operation')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry retryable errors', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('timeout'))
        .mockResolvedValue('success')

      const result = await errorHandler.handleError(operation, 'test operation')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('wallet not found'))

      await expect(errorHandler.handleError(operation, 'test operation'))
        .rejects.toThrow()

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should respect max retry attempts', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('timeout'))

      await expect(errorHandler.handleError(
        operation, 
        'test operation',
        { maxAttempts: 2 }
      )).rejects.toThrow()

      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should try fallback strategy for recoverable errors', async () => {
      const fallbackAction = vi.fn().mockResolvedValue(undefined)
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('session expired'))
        .mockResolvedValue('success after fallback')

      errorHandler.addFallbackStrategy(WalletErrorType.SESSION_EXPIRED, {
        errorType: WalletErrorType.SESSION_EXPIRED,
        fallbackAction,
        description: 'Clear expired session'
      })

      const result = await errorHandler.handleError(operation, 'test operation')

      expect(result).toBe('success after fallback')
      expect(fallbackAction).toHaveBeenCalled()
      expect(operation).toHaveBeenCalledTimes(2)
    })
  })

  describe('error history', () => {
    it('should track error history', () => {
      errorHandler.createError(WalletErrorType.CONNECTION_FAILED, 'Error 1')
      errorHandler.createError(WalletErrorType.NETWORK_ERROR, 'Error 2')

      const history = errorHandler.getErrorHistory()
      expect(history).toHaveLength(2)
      expect(history[0].type).toBe(WalletErrorType.CONNECTION_FAILED)
      expect(history[1].type).toBe(WalletErrorType.NETWORK_ERROR)
    })

    it('should provide error statistics', () => {
      errorHandler.createError(WalletErrorType.CONNECTION_FAILED, 'Error 1')
      errorHandler.createError(WalletErrorType.CONNECTION_FAILED, 'Error 2')
      errorHandler.createError(WalletErrorType.NETWORK_ERROR, 'Error 3')

      const stats = errorHandler.getErrorStats()
      expect(stats[WalletErrorType.CONNECTION_FAILED]).toBe(2)
      expect(stats[WalletErrorType.NETWORK_ERROR]).toBe(1)
    })

    it('should clear error history', () => {
      errorHandler.createError(WalletErrorType.CONNECTION_FAILED, 'Error 1')
      expect(errorHandler.getErrorHistory()).toHaveLength(1)

      errorHandler.clearErrorHistory()
      expect(errorHandler.getErrorHistory()).toHaveLength(0)
    })
  })

  describe('fallback strategies', () => {
    it('should allow adding custom fallback strategies', () => {
      const fallbackAction = vi.fn()
      const strategy = {
        errorType: WalletErrorType.WALLET_LOCKED,
        fallbackAction,
        description: 'Prompt user to unlock wallet'
      }

      errorHandler.addFallbackStrategy(WalletErrorType.WALLET_LOCKED, strategy)

      // This is tested indirectly through handleError method
      expect(() => errorHandler.addFallbackStrategy(WalletErrorType.WALLET_LOCKED, strategy))
        .not.toThrow()
    })
  })
})