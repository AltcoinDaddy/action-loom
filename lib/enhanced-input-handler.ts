/**
 * Enhanced Input Handler for Parameter Inputs
 * 
 * Provides robust handling for rapid typing, special characters, Unicode,
 * and various edge cases in parameter input components.
 */

import { ParameterValueProcessor, ValueProcessorOptions } from '@/lib/parameter-value-processor'

export interface InputEventOptions {
  debounceMs?: number
  throttleMs?: number
  maxInputLength?: number
  allowUnicode?: boolean
  preserveCursorPosition?: boolean
  autoCorrect?: boolean
  sanitizeOnInput?: boolean
}

export interface InputEventResult {
  value: any
  shouldUpdate: boolean
  cursorPosition?: number
  warnings: string[]
  errors: string[]
}

export interface InputState {
  value: string
  lastInputTime: number
  inputSequence: number
  cursorPosition: number
  selectionStart: number
  selectionEnd: number
}

/**
 * Enhanced input handler that manages rapid typing, special characters,
 * and provides robust error recovery for parameter inputs
 */
export class EnhancedInputHandler {
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private throttleTimers = new Map<string, number>()
  private inputStates = new Map<string, InputState>()
  private eventQueue = new Map<string, Array<{ value: string; timestamp: number }>>()

  // Unicode categories that are generally safe for parameter inputs
  private static readonly SAFE_UNICODE_CATEGORIES = [
    /[\u0020-\u007E]/, // Basic Latin (ASCII printable)
    /[\u00A0-\u00FF]/, // Latin-1 Supplement
    /[\u0100-\u017F]/, // Latin Extended-A
    /[\u0180-\u024F]/, // Latin Extended-B
    /[\u1E00-\u1EFF]/, // Latin Extended Additional
    /[\u2000-\u206F]/, // General Punctuation
    /[\u20A0-\u20CF]/, // Currency Symbols
    /[\u2100-\u214F]/, // Letterlike Symbols
    /[\u2190-\u21FF]/, // Arrows
    /[\u2200-\u22FF]/, // Mathematical Operators
  ]

  // Characters that should be filtered out or handled specially
  private static readonly PROBLEMATIC_CHARACTERS = [
    /[\u0000-\u001F]/, // Control characters (except tab, newline, carriage return)
    /[\u007F-\u009F]/, // DEL and C1 control characters
    /[\uFEFF]/,        // Byte Order Mark
    /[\u200B-\u200D]/, // Zero-width characters
    /[\uFFF0-\uFFFF]/, // Specials block
  ]

  /**
   * Handles input events with debouncing, throttling, and error recovery
   */
  handleInputEvent(
    inputId: string,
    value: string,
    parameterType: string,
    options: InputEventOptions = {}
  ): Promise<InputEventResult> {
    return new Promise((resolve) => {
      const {
        debounceMs = 150,
        throttleMs = 50,
        maxInputLength = 10000,
        allowUnicode = true,
        preserveCursorPosition = true,
        autoCorrect = false,
        sanitizeOnInput = true
      } = options

      // Clear existing debounce timer
      if (this.debounceTimers.has(inputId)) {
        clearTimeout(this.debounceTimers.get(inputId)!)
      }

      // Check throttling
      const now = Date.now()
      const lastThrottle = this.throttleTimers.get(inputId) || 0
      
      if (now - lastThrottle < throttleMs) {
        // Queue the event for later processing
        this.queueInputEvent(inputId, value, now)
        
        // Set debounced processing
        this.debounceTimers.set(inputId, setTimeout(() => {
          this.processQueuedEvents(inputId, parameterType, options).then(resolve)
        }, debounceMs))
        
        return
      }

      // Update throttle timer
      this.throttleTimers.set(inputId, now)

      // Process immediately
      this.processInputValue(inputId, value, parameterType, options).then(resolve)
    })
  }

  /**
   * Processes rapid typing events by handling the most recent value
   */
  handleRapidTyping(
    inputId: string,
    events: Array<{ value: string; timestamp: number }>,
    parameterType: string,
    options: InputEventOptions = {}
  ): InputEventResult {
    // Sort events by timestamp
    const sortedEvents = events.sort((a, b) => a.timestamp - b.timestamp)
    
    // Take the most recent event
    const latestEvent = sortedEvents[sortedEvents.length - 1]
    
    // Check for rapid typing patterns
    const rapidTypingThreshold = 100 // ms between keystrokes
    let isRapidTyping = false
    
    if (sortedEvents.length > 1) {
      const timeDiffs = sortedEvents.slice(1).map((event, index) => 
        event.timestamp - sortedEvents[index].timestamp
      )
      isRapidTyping = timeDiffs.some(diff => diff < rapidTypingThreshold)
    }

    const warnings: string[] = []
    if (isRapidTyping && sortedEvents.length > 5) {
      warnings.push('Rapid typing detected - some keystrokes may be processed with delay')
    }

    // Process the latest value
    const result = this.processInputValueSync(inputId, latestEvent.value, parameterType, options)
    
    return {
      ...result,
      warnings: [...result.warnings, ...warnings]
    }
  }

  /**
   * Handles special characters and Unicode input
   */
  handleSpecialCharacters(
    value: string,
    parameterType: string,
    options: InputEventOptions = {}
  ): { sanitized: string; warnings: string[]; errors: string[] } {
    const { allowUnicode = true, autoCorrect = false } = options
    const warnings: string[] = []
    const errors: string[] = []
    let sanitized = value

    // Handle null bytes and control characters
    const hasControlChars = /[\u0000-\u001F\u007F-\u009F]/.test(sanitized)
    if (hasControlChars) {
      if (autoCorrect) {
        // Remove control characters except tab, newline, carriage return
        sanitized = sanitized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '')
        warnings.push('Control characters were removed from input')
      } else {
        errors.push('Input contains invalid control characters')
      }
    }

    // Handle Unicode characters
    if (!allowUnicode) {
      const hasUnicode = /[^\u0000-\u007F]/.test(sanitized)
      if (hasUnicode) {
        if (autoCorrect) {
          sanitized = sanitized.replace(/[^\u0000-\u007F]/g, '')
          warnings.push('Non-ASCII characters were removed')
        } else {
          errors.push('Unicode characters are not allowed for this parameter type')
        }
      }
    } else {
      // Check for problematic Unicode characters
      for (const pattern of EnhancedInputHandler.PROBLEMATIC_CHARACTERS) {
        if (pattern.test(sanitized)) {
          if (autoCorrect) {
            sanitized = sanitized.replace(pattern, '')
            warnings.push('Problematic Unicode characters were removed')
          } else {
            warnings.push('Input contains potentially problematic Unicode characters')
          }
        }
      }
    }

    // Handle zero-width characters
    const hasZeroWidth = /[\u200B-\u200D\uFEFF]/g.test(sanitized)
    if (hasZeroWidth) {
      if (autoCorrect) {
        sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '')
        warnings.push('Zero-width characters were removed')
      } else {
        warnings.push('Input contains invisible zero-width characters')
      }
    }

    // Parameter-specific character handling
    const normalizedType = parameterType.toLowerCase()
    
    if (normalizedType.includes('address')) {
      // Flow addresses should only contain hex characters and 0x prefix
      if (autoCorrect && !/^0x[a-fA-F0-9]*$/.test(sanitized)) {
        const cleaned = sanitized.replace(/[^0-9a-fA-Fx]/g, '')
        if (cleaned !== sanitized) {
          sanitized = cleaned
          warnings.push('Invalid characters removed from address')
        }
      }
    } else if (normalizedType.includes('ufix64') || normalizedType.includes('int')) {
      // Numeric types should only contain digits, decimal point, and minus sign
      const allowedPattern = normalizedType.includes('ufix64') ? /[^0-9.]/g : /[^0-9.-]/g
      if (autoCorrect && allowedPattern.test(sanitized)) {
        const cleaned = sanitized.replace(allowedPattern, '')
        if (cleaned !== sanitized) {
          sanitized = cleaned
          warnings.push('Non-numeric characters removed')
        }
      }
    }

    return { sanitized, warnings, errors }
  }

  /**
   * Handles input length limits and memory management
   */
  handleInputLength(
    value: string,
    maxLength: number = 10000
  ): { truncated: string; wasTruncated: boolean; warning?: string } {
    // Handle null/undefined values
    if (value == null) {
      return { truncated: '', wasTruncated: false }
    }

    const stringValue = String(value)
    
    if (stringValue.length <= maxLength) {
      return { truncated: stringValue, wasTruncated: false }
    }

    // Truncate at word boundary if possible
    let truncated = stringValue.substring(0, maxLength)
    const lastSpace = truncated.lastIndexOf(' ')
    
    if (lastSpace > maxLength * 0.8) {
      truncated = truncated.substring(0, lastSpace)
    }

    return {
      truncated,
      wasTruncated: true,
      warning: `Input truncated to ${maxLength} characters`
    }
  }

  /**
   * Preserves cursor position during input processing
   */
  preserveCursorPosition(
    inputElement: HTMLInputElement | HTMLTextAreaElement,
    originalValue: string,
    newValue: string,
    originalCursorPos: number
  ): number {
    // If values are the same, keep cursor position
    if (originalValue === newValue) {
      return originalCursorPos
    }

    // Calculate new cursor position based on changes
    let newCursorPos = originalCursorPos

    // If text was inserted before cursor
    const lengthDiff = newValue.length - originalValue.length
    if (lengthDiff > 0) {
      // Text was added - check if it was before cursor
      const beforeCursor = originalValue.substring(0, originalCursorPos)
      const afterCursor = originalValue.substring(originalCursorPos)
      
      if (newValue.startsWith(beforeCursor) && newValue.endsWith(afterCursor)) {
        // Text was inserted at cursor position
        newCursorPos = originalCursorPos + lengthDiff
      }
    } else if (lengthDiff < 0) {
      // Text was removed - adjust cursor position
      newCursorPos = Math.max(0, originalCursorPos + lengthDiff)
    }

    // Ensure cursor position is within bounds
    newCursorPos = Math.max(0, Math.min(newCursorPos, newValue.length))

    return newCursorPos
  }

  /**
   * Provides error recovery mechanisms
   */
  recoverFromError(
    inputId: string,
    error: Error,
    lastKnownGoodValue: string,
    parameterType: string
  ): InputEventResult {
    console.warn(`Input error recovery for ${inputId}:`, error)

    // Clear any pending timers for this input
    if (this.debounceTimers.has(inputId)) {
      clearTimeout(this.debounceTimers.get(inputId)!)
      this.debounceTimers.delete(inputId)
    }

    // Clear state
    this.inputStates.delete(inputId)
    this.eventQueue.delete(inputId)
    this.throttleTimers.delete(inputId)

    // Try to process the last known good value
    try {
      const result = ParameterValueProcessor.sanitizeInput(
        lastKnownGoodValue,
        parameterType,
        { preserveUserInput: true, autoCorrect: true }
      )

      return {
        value: result.value,
        shouldUpdate: true,
        warnings: [
          'Input error occurred - recovered with last known good value',
          ...result.warnings
        ],
        errors: result.errors.map(e => e.message)
      }
    } catch (recoveryError) {
      // If recovery also fails, return empty value
      return {
        value: '',
        shouldUpdate: true,
        warnings: ['Input error occurred - reset to empty value'],
        errors: [`Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`]
      }
    }
  }

  /**
   * Cleans up resources for a specific input
   */
  cleanup(inputId: string): void {
    if (this.debounceTimers.has(inputId)) {
      clearTimeout(this.debounceTimers.get(inputId)!)
      this.debounceTimers.delete(inputId)
    }
    
    this.throttleTimers.delete(inputId)
    this.inputStates.delete(inputId)
    this.eventQueue.delete(inputId)
  }

  /**
   * Cleans up all resources
   */
  cleanupAll(): void {
    // Clear all timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    
    this.debounceTimers.clear()
    this.throttleTimers.clear()
    this.inputStates.clear()
    this.eventQueue.clear()
  }

  // Private helper methods

  private queueInputEvent(inputId: string, value: string, timestamp: number): void {
    if (!this.eventQueue.has(inputId)) {
      this.eventQueue.set(inputId, [])
    }
    
    const queue = this.eventQueue.get(inputId)!
    queue.push({ value, timestamp })
    
    // Keep only recent events (last 10 or within 5 seconds)
    const cutoff = timestamp - 5000
    const filtered = queue.filter(event => event.timestamp > cutoff).slice(-10)
    this.eventQueue.set(inputId, filtered)
  }

  private async processQueuedEvents(
    inputId: string,
    parameterType: string,
    options: InputEventOptions
  ): Promise<InputEventResult> {
    const queue = this.eventQueue.get(inputId) || []
    if (queue.length === 0) {
      return {
        value: '',
        shouldUpdate: false,
        warnings: [],
        errors: []
      }
    }

    // Process rapid typing
    const result = this.handleRapidTyping(inputId, queue, parameterType, options)
    
    // Clear the queue
    this.eventQueue.delete(inputId)
    
    return result
  }

  private async processInputValue(
    inputId: string,
    value: string,
    parameterType: string,
    options: InputEventOptions
  ): Promise<InputEventResult> {
    try {
      return this.processInputValueSync(inputId, value, parameterType, options)
    } catch (error) {
      const lastState = this.inputStates.get(inputId)
      const lastKnownGoodValue = lastState?.value || ''
      
      return this.recoverFromError(
        inputId,
        error instanceof Error ? error : new Error('Unknown processing error'),
        lastKnownGoodValue,
        parameterType
      )
    }
  }

  private processInputValueSync(
    inputId: string,
    value: string,
    parameterType: string,
    options: InputEventOptions
  ): InputEventResult {
    const {
      maxInputLength = 10000,
      allowUnicode = true,
      autoCorrect = false,
      sanitizeOnInput = true
    } = options

    const warnings: string[] = []
    const errors: string[] = []
    let processedValue = value

    // Handle input length
    const lengthResult = this.handleInputLength(processedValue, maxInputLength)
    processedValue = lengthResult.truncated
    if (lengthResult.wasTruncated && lengthResult.warning) {
      warnings.push(lengthResult.warning)
    }

    // Handle special characters and Unicode
    const charResult = this.handleSpecialCharacters(processedValue, parameterType, {
      allowUnicode,
      autoCorrect
    })
    processedValue = charResult.sanitized
    warnings.push(...charResult.warnings)
    errors.push(...charResult.errors)

    // Sanitize input if enabled
    if (sanitizeOnInput) {
      try {
        const sanitizeResult = ParameterValueProcessor.sanitizeInput(
          processedValue,
          parameterType,
          { preserveUserInput: true, autoCorrect }
        )
        
        processedValue = sanitizeResult.value
        warnings.push(...sanitizeResult.warnings)
        errors.push(...sanitizeResult.errors.map(e => e.message))
      } catch (error) {
        errors.push(`Sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    // Update input state
    this.inputStates.set(inputId, {
      value: processedValue,
      lastInputTime: Date.now(),
      inputSequence: (this.inputStates.get(inputId)?.inputSequence || 0) + 1,
      cursorPosition: 0,
      selectionStart: 0,
      selectionEnd: 0
    })

    return {
      value: processedValue,
      shouldUpdate: true,
      warnings,
      errors
    }
  }
}

// Export singleton instance
export const enhancedInputHandler = new EnhancedInputHandler()

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    enhancedInputHandler.cleanupAll()
  })
}