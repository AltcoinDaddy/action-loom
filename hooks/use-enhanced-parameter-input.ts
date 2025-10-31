/**
 * Enhanced Parameter Input Hook
 * 
 * Provides robust input handling with error recovery, rapid typing support,
 * and special character handling for parameter input components.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { enhancedInputHandler, InputEventOptions, InputEventResult } from '@/lib/enhanced-input-handler'
import { useParameterInputErrorHandler } from '@/components/parameter-input-error-boundary'

export interface UseEnhancedParameterInputOptions extends InputEventOptions {
  parameterType: string
  parameterName: string
  onError?: (error: Error) => void
  enableErrorRecovery?: boolean
  logErrors?: boolean
}

export interface UseEnhancedParameterInputResult {
  // Input handling
  handleInputChange: (value: string, element?: HTMLInputElement | HTMLTextAreaElement) => void
  handleInputFocus: (event: React.FocusEvent) => void
  handleInputBlur: (event: React.FocusEvent) => void
  handleKeyDown: (event: React.KeyboardEvent) => void
  
  // State
  internalValue: string
  isFocused: boolean
  isProcessing: boolean
  
  // Validation and feedback
  warnings: string[]
  processingErrors: string[]
  hasProcessingErrors: boolean
  
  // Error recovery
  errorHandler: ReturnType<typeof useParameterInputErrorHandler>
  recoverFromError: () => void
  
  // Cursor management
  cursorPosition: number
  setCursorPosition: (position: number) => void
  
  // Cleanup
  cleanup: () => void
}

/**
 * Enhanced hook for parameter input handling with error recovery and edge case support
 */
export function useEnhancedParameterInput(
  value: any,
  onChange: (value: any) => void,
  options: UseEnhancedParameterInputOptions
): UseEnhancedParameterInputResult {
  const {
    parameterType,
    parameterName,
    onError,
    enableErrorRecovery = true,
    logErrors = true,
    ...inputOptions
  } = options

  // State management
  const [internalValue, setInternalValue] = useState<string>(String(value || ''))
  const [isFocused, setIsFocused] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [warnings, setWarnings] = useState<string[]>([])
  const [processingErrors, setProcessingErrors] = useState<string[]>([])
  const [cursorPosition, setCursorPosition] = useState(0)

  // Refs for managing input elements and state
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const lastKnownGoodValue = useRef<string>(String(value || ''))
  const processingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const inputId = useRef(`${parameterName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)

  // Error handling
  const errorHandler = useParameterInputErrorHandler()

  // Sync internal value with prop value
  useEffect(() => {
    const newValue = String(value || '')
    if (newValue !== internalValue && !isFocused) {
      setInternalValue(newValue)
      lastKnownGoodValue.current = newValue
    }
  }, [value, internalValue, isFocused])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      enhancedInputHandler.cleanup(inputId.current)
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [])

  // Handle input changes with enhanced processing
  const handleInputChange = useCallback(async (
    newValue: string,
    element?: HTMLInputElement | HTMLTextAreaElement
  ) => {
    try {
      setIsProcessing(true)
      setInternalValue(newValue)

      // Store cursor position if element is provided
      if (element) {
        inputRef.current = element
        setCursorPosition(element.selectionStart || 0)
      }

      // Process input with enhanced handler
      const result: InputEventResult = await enhancedInputHandler.handleInputEvent(
        inputId.current,
        newValue,
        parameterType,
        inputOptions
      )

      // Update state based on processing result
      setWarnings(result.warnings)
      setProcessingErrors(result.errors)

      if (result.shouldUpdate) {
        // Update internal value if it was transformed
        if (result.value !== newValue) {
          setInternalValue(String(result.value))
          
          // Restore cursor position if needed
          if (element && result.cursorPosition !== undefined) {
            requestAnimationFrame(() => {
              element.setSelectionRange(result.cursorPosition!, result.cursorPosition!)
            })
          }
        }

        // Call parent onChange
        if (onChange) {
          onChange(result.value)
          lastKnownGoodValue.current = String(result.value)
        }
      }

      // Log errors if enabled
      if (logErrors && result.errors.length > 0) {
        console.warn(`Parameter input processing errors for ${parameterName}:`, result.errors)
      }

    } catch (error) {
      const inputError = error instanceof Error ? error : new Error('Unknown input processing error')
      
      if (logErrors) {
        console.error(`Enhanced input handler error for ${parameterName}:`, inputError)
      }

      // Handle error with error handler
      if (enableErrorRecovery) {
        errorHandler.captureError(inputError)
        
        // Attempt recovery
        const recoveryResult = enhancedInputHandler.recoverFromError(
          inputId.current,
          inputError,
          lastKnownGoodValue.current,
          parameterType
        )

        setWarnings(recoveryResult.warnings)
        setProcessingErrors(recoveryResult.errors)
        
        if (recoveryResult.shouldUpdate) {
          setInternalValue(String(recoveryResult.value))
          if (onChange) {
            onChange(recoveryResult.value)
          }
        }
      }

      // Call custom error handler
      if (onError) {
        onError(inputError)
      }

    } finally {
      setIsProcessing(false)
    }
  }, [parameterType, parameterName, onChange, onError, enableErrorRecovery, logErrors, inputOptions, errorHandler])

  // Handle focus events
  const handleInputFocus = useCallback((event: React.FocusEvent) => {
    try {
      setIsFocused(true)
      
      const element = event.target as HTMLInputElement | HTMLTextAreaElement
      inputRef.current = element
      setCursorPosition(element.selectionStart || 0)
      
      // Clear any processing errors on focus
      setProcessingErrors([])
      
    } catch (error) {
      if (logErrors) {
        console.error(`Focus handler error for ${parameterName}:`, error)
      }
    }
  }, [parameterName, logErrors])

  // Handle blur events
  const handleInputBlur = useCallback((event: React.FocusEvent) => {
    try {
      setIsFocused(false)
      
      const element = event.target as HTMLInputElement | HTMLTextAreaElement
      const finalValue = element.value

      // Perform final validation and processing on blur
      if (finalValue !== lastKnownGoodValue.current) {
        handleInputChange(finalValue, element)
      }
      
    } catch (error) {
      if (logErrors) {
        console.error(`Blur handler error for ${parameterName}:`, error)
      }
    }
  }, [parameterName, logErrors, handleInputChange])

  // Handle keyboard events
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    try {
      const element = event.target as HTMLInputElement | HTMLTextAreaElement
      
      // Handle special keys
      switch (event.key) {
        case 'Escape':
          // Reset to last known good value
          setInternalValue(lastKnownGoodValue.current)
          element.blur()
          break
          
        case 'Enter':
          // Handle enter key (except in textarea with shift)
          if (element.tagName !== 'TEXTAREA' || !event.shiftKey) {
            event.preventDefault()
            element.blur()
          }
          break
          
        case 'Tab':
          // Allow normal tab behavior but ensure processing is complete
          if (isProcessing) {
            event.preventDefault()
            // Wait for processing to complete then continue
            processingTimeoutRef.current = setTimeout(() => {
              element.blur()
            }, 100)
          }
          break
      }
      
      // Update cursor position
      requestAnimationFrame(() => {
        setCursorPosition(element.selectionStart || 0)
      })
      
    } catch (error) {
      if (logErrors) {
        console.error(`KeyDown handler error for ${parameterName}:`, error)
      }
    }
  }, [parameterName, logErrors, isProcessing])

  // Error recovery function
  const recoverFromError = useCallback(() => {
    try {
      errorHandler.resetError()
      setProcessingErrors([])
      setWarnings([])
      
      // Reset to last known good value
      setInternalValue(lastKnownGoodValue.current)
      
      if (onChange) {
        onChange(lastKnownGoodValue.current)
      }
      
    } catch (error) {
      if (logErrors) {
        console.error(`Error recovery failed for ${parameterName}:`, error)
      }
    }
  }, [parameterName, logErrors, onChange, errorHandler])

  // Cleanup function
  const cleanup = useCallback(() => {
    enhancedInputHandler.cleanup(inputId.current)
    if (processingTimeoutRef.current) {
      clearTimeout(processingTimeoutRef.current)
    }
  }, [])

  return {
    // Input handling
    handleInputChange,
    handleInputFocus,
    handleInputBlur,
    handleKeyDown,
    
    // State
    internalValue,
    isFocused,
    isProcessing,
    
    // Validation and feedback
    warnings,
    processingErrors,
    hasProcessingErrors: processingErrors.length > 0,
    
    // Error recovery
    errorHandler,
    recoverFromError,
    
    // Cursor management
    cursorPosition,
    setCursorPosition,
    
    // Cleanup
    cleanup
  }
}

/**
 * Simplified hook for basic enhanced input handling
 */
export function useSimpleEnhancedInput(
  value: any,
  onChange: (value: any) => void,
  parameterType: string,
  parameterName: string
) {
  return useEnhancedParameterInput(value, onChange, {
    parameterType,
    parameterName,
    debounceMs: 150,
    throttleMs: 50,
    allowUnicode: true,
    autoCorrect: true,
    sanitizeOnInput: true,
    enableErrorRecovery: true
  })
}