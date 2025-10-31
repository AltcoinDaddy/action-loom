"use client"

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
// Popover temporarily disabled to prevent infinite loop
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronDown, Link, Sparkles, AlertTriangle, CheckCircle, Info, Asterisk, Shield } from 'lucide-react'
import { ActionParameter, ActionOutput } from '@/lib/types'
import { ParameterValidationResult } from '@/lib/parameter-validator'
import { ParameterValueProcessor } from '@/lib/parameter-value-processor'
import { cn } from '@/lib/utils'

export interface ParameterInputProps {
  parameter: ActionParameter
  value: any
  onChange: (value: any) => void
  validation?: ParameterValidationResult
  availableOutputs: Record<string, ActionOutput>
  suggestions: string[]
  required?: boolean
  disabled?: boolean
  'aria-describedby'?: string
}

export function ParameterInput({
  parameter,
  value,
  onChange,
  validation,
  availableOutputs,
  suggestions,
  required = false,
  disabled = false,
  'aria-describedby': ariaDescribedBy
}: ParameterInputProps) {
  const [isReferenceMode, setIsReferenceMode] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showOutputs, setShowOutputs] = useState(false)

  // Fallback input handling - simplified version for immediate functionality
  const [internalValue, setInternalValue] = useState(String(value || ''))
  const [isFocused, setIsFocused] = useState(false)
  
  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(String(value || ''))
  }, [value])
  
  // Simple enhanced input object for compatibility
  const enhancedInput = {
    internalValue,
    isFocused,
    isProcessing: false,
    warnings: [],
    processingErrors: [],
    hasProcessingErrors: false,
    errorHandler: { hasError: false, canRetry: false, maxRetries: 3, retryCount: 0, retryOperation: () => {} },
    handleInputChange: (newValue: string) => {
      setInternalValue(newValue)
      onChange(newValue)
    },
    handleInputFocus: (event: React.FocusEvent) => {
      setIsFocused(true)
    },
    handleInputBlur: (event: React.FocusEvent) => {
      setIsFocused(false)
    },
    handleKeyDown: (event: React.KeyboardEvent) => {
      // Basic key handling
    },
    recoverFromError: () => {
      setInternalValue(String(value || ''))
    },
    cleanup: () => {}
  }

  // Refs for focus management
  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Validation state helpers
  const hasErrors = (validation?.errors && validation.errors.length > 0) || enhancedInput.hasProcessingErrors
  const hasWarnings = (validation?.warnings && validation.warnings.length > 0) || enhancedInput.warnings.length > 0
  const isValid = validation?.isValid !== false && !hasErrors
  const isEmpty = !value || (typeof value === 'string' && value.trim() === '')
  const isRequiredAndEmpty = required && isEmpty
  const isProcessing = enhancedInput.isProcessing

  // Generate unique IDs for accessibility
  const inputId = `parameter-${parameter.name}`
  const errorId = `${inputId}-error`
  const helpId = `${inputId}-help`
  const warningId = `${inputId}-warning`

  // Check if current value is a parameter reference
  useEffect(() => {
    if (typeof value === 'string' && value.includes('.')) {
      const parts = value.split('.')
      if (parts.length >= 2 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(parts[0])) {
        setIsReferenceMode(true)
      }
    }
  }, [value])

  // Cleanup enhanced input on unmount
  useEffect(() => {
    return () => {
      enhancedInput.cleanup()
    }
  }, [enhancedInput])

  // Enhanced onChange handler with robust value processing and state synchronization
  const handleInputChange = useCallback((newValue: any, eventType: 'input' | 'switch' | 'select' = 'input', element?: HTMLInputElement | HTMLTextAreaElement) => {
    try {
      if (eventType === 'input') {
        // Use enhanced input handler for text inputs
        enhancedInput.handleInputChange(String(newValue), element)
      } else if (eventType === 'switch') {
        // Handle boolean switch values with validation
        const result = ParameterValueProcessor.convertType(newValue, parameter.type)
        const processedValue = result.isValid ? result.value : Boolean(newValue)

        // Call onChange directly for non-text inputs
        if (onChange && typeof onChange === 'function') {
          requestAnimationFrame(() => {
            try {
              onChange(processedValue)
            } catch (error) {
              console.error('Error in switch onChange callback:', error)
              onChange(newValue)
            }
          })
        }
      } else if (eventType === 'select') {
        // Handle select/reference values directly
        if (onChange && typeof onChange === 'function') {
          requestAnimationFrame(() => {
            try {
              onChange(newValue)
            } catch (error) {
              console.error('Error in select onChange callback:', error)
              onChange(newValue)
            }
          })
        }
      }
    } catch (error) {
      console.error('Error in handleInputChange:', error)
      // Use enhanced input error recovery
      if (eventType === 'input') {
        enhancedInput.recoverFromError()
      } else {
        // Fallback for non-text inputs
        if (onChange && typeof onChange === 'function') {
          requestAnimationFrame(() => {
            try {
              onChange(newValue)
            } catch (error) {
              console.error('Error in fallback onChange:', error)
            }
          })
        }
      }
    }
  }, [parameter.type, onChange, enhancedInput])

  // Enhanced focus handlers using the enhanced input hook
  const handleFocus = useCallback((event: React.FocusEvent) => {
    try {
      enhancedInput.handleInputFocus(event)
      // Ensure proper event propagation
      event.stopPropagation()
    } catch (error) {
      console.error('Error in handleFocus:', error)
    }
  }, [enhancedInput])

  const handleBlur = useCallback((event: React.FocusEvent) => {
    try {
      enhancedInput.handleInputBlur(event)
      // Ensure proper event propagation
      event.stopPropagation()
    } catch (error) {
      console.error('Error in handleBlur:', error)
      // Fallback error recovery
      enhancedInput.recoverFromError()
    }
  }, [enhancedInput])

  // Enhanced keyboard handler using the enhanced input hook
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    try {
      enhancedInput.handleKeyDown(event)
    } catch (error) {
      console.error('Error in handleKeyDown:', error)
      // Fallback error recovery
      enhancedInput.recoverFromError()
    }
  }, [enhancedInput])

  const getParameterType = () => {
    const normalizedType = parameter.type.toLowerCase()
    if (normalizedType.includes('address')) return 'address'
    if (normalizedType.includes('ufix64')) return 'number'
    if (normalizedType.includes('string')) return 'string'
    if (normalizedType.includes('bool')) return 'boolean'
    if (normalizedType.includes('int')) return 'number'
    return 'string'
  }

  const renderDirectInput = () => {
    const paramType = getParameterType()

    // Enhanced input styling with comprehensive states and animations
    const inputClassName = cn(
      "w-full input-state-transition input-focus-enhanced",
      // Base styling
      "border-input bg-background",
      // Focus states with enhanced visual feedback
      enhancedInput.isFocused && [
        "ring-2 ring-ring/30 ring-offset-2",
        "border-ring shadow-lg",
        "input-focus-enhanced"
      ],
      // Processing state
      isProcessing && [
        "border-blue-400",
        "bg-blue-50/50 dark:bg-blue-950/20",
        "animate-pulse"
      ],
      // Error states with enhanced feedback
      hasErrors && [
        "border-destructive",
        "input-error-glow",
        "focus-visible:ring-destructive/30",
        "aria-invalid:border-destructive",
        "input-error-shake"
      ],
      // Warning states (when no errors but has warnings)
      !hasErrors && hasWarnings && [
        "border-yellow-500",
        "input-warning-glow",
        "focus-visible:ring-yellow-500/30"
      ],
      // Success states (when valid and has value)
      isValid && !isEmpty && !hasWarnings && [
        "border-green-500",
        "input-success-glow",
        "focus-visible:ring-green-500/30"
      ],
      // Required field styling when empty with pulse animation
      isRequiredAndEmpty && [
        "border-orange-400",
        "focus-visible:ring-orange-400/30",
        "required-indicator"
      ],
      // Disabled state
      disabled && [
        "opacity-50 cursor-not-allowed",
        "bg-muted text-muted-foreground"
      ],
      // Enhanced hover states (when not focused and not disabled)
      !enhancedInput.isFocused && !disabled && [
        "hover:border-ring/60",
        "hover:shadow-md",
        "interactive-hover"
      ]
    )

    // Common input props for accessibility and validation
    const commonInputProps = {
      id: inputId,
      disabled,
      'aria-invalid': hasErrors,
      'aria-describedby': cn(
        ariaDescribedBy,
        hasErrors && errorId,
        hasWarnings && warningId,
        helpId
      ).trim() || undefined,
      'aria-required': required,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      className: inputClassName
    }

    switch (paramType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-3">
            <Switch
              id={inputId}
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => handleInputChange(checked, 'switch')}
              disabled={disabled}
              aria-describedby={commonInputProps['aria-describedby']}
              aria-invalid={hasErrors}
              className={cn(
                "transition-all duration-200 interactive-hover focus-ring-enhanced",
                hasErrors && [
                  "data-[state=checked]:bg-destructive data-[state=unchecked]:border-destructive",
                  "input-error-glow"
                ],
                !hasErrors && hasWarnings && [
                  "data-[state=checked]:bg-yellow-500 data-[state=unchecked]:border-yellow-500",
                  "input-warning-glow"
                ],
                isValid && !isEmpty && !hasWarnings && [
                  "data-[state=checked]:bg-green-500",
                  "input-success-glow"
                ],
                isRequiredAndEmpty && [
                  "data-[state=unchecked]:border-orange-400",
                  "required-indicator"
                ]
              )}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />
            <Label
              htmlFor={inputId}
              className={cn(
                "text-sm font-medium cursor-pointer transition-colors",
                disabled && "cursor-not-allowed opacity-50",
                hasErrors && "text-destructive",
                !hasErrors && hasWarnings && "text-yellow-600",
                isValid && !isEmpty && !hasWarnings && "text-green-600"
              )}
            >
              {value === true || value === 'true' ? 'True' : 'False'}
            </Label>
          </div>
        )

      case 'address':
        return (
          <div className="space-y-2">
            <div className="relative">
              <Input
                ref={inputRef}
                type="text"
                value={enhancedInput.internalValue}
                onChange={(e) => {
                  handleInputChange(e.target.value, 'input', e.target)
                }}
                placeholder="0x1234567890abcdef"
                maxLength={18} // 0x + 16 hex characters
                {...commonInputProps}
              />
              {/* Enhanced validation status indicator with animations */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {hasErrors && (
                  <div className="validation-error-enter">
                    <AlertTriangle
                      className="h-4 w-4 text-destructive animate-pulse"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {!hasErrors && hasWarnings && (
                  <div className="validation-error-enter">
                    <Info
                      className="h-4 w-4 text-yellow-500 animate-bounce"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isValid && !isEmpty && !hasWarnings && (
                  <div className="validation-success-enter">
                    <CheckCircle
                      className="h-4 w-4 text-green-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isRequiredAndEmpty && (
                  <div className="required-indicator">
                    <Asterisk
                      className="h-3 w-3 text-orange-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestions.slice(0, 3).map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange(suggestion, 'input')}
                    disabled={disabled}
                    className={cn(
                      "h-6 text-xs transition-all duration-200",
                      "hover:bg-primary hover:text-primary-foreground",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                      "interactive-hover focus-ring-enhanced"
                    )}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </div>
        )

      case 'number':
        return (
          <div className="space-y-2">
            <div className="relative">
              <Input
                ref={inputRef}
                type="number"
                step="any"
                value={enhancedInput.internalValue}
                onChange={(e) => {
                  handleInputChange(e.target.value, 'input', e.target)
                }}
                placeholder="0.0"
                min={parameter.type.toLowerCase().includes('ufix64') ? "0" : undefined}
                {...commonInputProps}
              />
              {/* Enhanced validation status indicator with animations */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {hasErrors && (
                  <div className="validation-error-enter">
                    <AlertTriangle
                      className="h-4 w-4 text-destructive animate-pulse"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {!hasErrors && hasWarnings && (
                  <div className="validation-error-enter">
                    <Info
                      className="h-4 w-4 text-yellow-500 animate-bounce"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isValid && !isEmpty && !hasWarnings && (
                  <div className="validation-success-enter">
                    <CheckCircle
                      className="h-4 w-4 text-green-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isRequiredAndEmpty && (
                  <div className="required-indicator">
                    <Asterisk
                      className="h-3 w-3 text-orange-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>
            {parameter.type.toLowerCase().includes('ufix64') && (
              <p id={helpId} className="text-xs text-muted-foreground">
                UFix64: Positive decimal number with up to 8 decimal places
              </p>
            )}
          </div>
        )

      default:
        // Check if parameter has options for dropdown
        if ((parameter as any).options && Array.isArray((parameter as any).options)) {
          return (
            <div className="relative">
              <Select
                value={enhancedInput.internalValue || ''}
                onValueChange={(value) => handleInputChange(value, 'select')}
                disabled={disabled}
              >
                <SelectTrigger className={inputClassName}>
                  <SelectValue placeholder={`Select ${parameter.name}`} />
                </SelectTrigger>
                <SelectContent>
                  {(parameter as any).options.map((option: string) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Enhanced validation status indicator */}
              <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center pointer-events-none">
                {hasErrors && (
                  <div className="validation-error-enter">
                    <AlertTriangle
                      className="h-4 w-4 text-destructive animate-pulse"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {!hasErrors && hasWarnings && (
                  <div className="validation-error-enter">
                    <Info
                      className="h-4 w-4 text-yellow-500 animate-bounce"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isValid && !isEmpty && !hasWarnings && (
                  <div className="validation-success-enter">
                    <CheckCircle
                      className="h-4 w-4 text-green-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isRequiredAndEmpty && (
                  <div className="required-indicator">
                    <Asterisk
                      className="h-3 w-3 text-orange-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Long text parameters use textarea
        if (parameter.name.toLowerCase().includes('description') ||
          parameter.name.toLowerCase().includes('metadata')) {
          return (
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={enhancedInput.internalValue}
                onChange={(e) => {
                  handleInputChange(e.target.value, 'input', e.target)
                }}
                placeholder={`Enter ${parameter.name}`}
                rows={3}
                {...commonInputProps}
              />
              {/* Enhanced validation status indicator for textarea */}
              <div className="absolute right-3 top-3 flex items-center">
                {hasErrors && (
                  <div className="validation-error-enter">
                    <AlertTriangle
                      className="h-4 w-4 text-destructive animate-pulse"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {!hasErrors && hasWarnings && (
                  <div className="validation-error-enter">
                    <Info
                      className="h-4 w-4 text-yellow-500 animate-bounce"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isValid && !isEmpty && !hasWarnings && (
                  <div className="validation-success-enter">
                    <CheckCircle
                      className="h-4 w-4 text-green-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
                {isRequiredAndEmpty && (
                  <div className="required-indicator">
                    <Asterisk
                      className="h-3 w-3 text-orange-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            </div>
          )
        }

        // Default to text input
        return (
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              value={enhancedInput.internalValue}
              onChange={(e) => {
                handleInputChange(e.target.value, 'input', e.target)
              }}
              placeholder={`Enter ${parameter.name}`}
              {...commonInputProps}
            />
            {/* Enhanced validation status indicator with animations */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
              {hasErrors && (
                <div className="validation-error-enter">
                  <AlertTriangle
                    className="h-4 w-4 text-destructive animate-pulse"
                    aria-hidden="true"
                  />
                </div>
              )}
              {!hasErrors && hasWarnings && (
                <div className="validation-error-enter">
                  <Info
                    className="h-4 w-4 text-yellow-500 animate-bounce"
                    aria-hidden="true"
                  />
                </div>
              )}
              {isValid && !isEmpty && !hasWarnings && (
                <div className="validation-success-enter">
                  <CheckCircle
                    className="h-4 w-4 text-green-500"
                    aria-hidden="true"
                  />
                </div>
              )}
              {isRequiredAndEmpty && (
                <div className="required-indicator">
                  <Asterisk
                    className="h-3 w-3 text-orange-500"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>
          </div>
        )
    }
  }

  const renderReferenceInput = () => {
    const availableOutputsList = Object.entries(availableOutputs).map(([key, output]) => ({
      key,
      ...output
    }))

    return (
      <div className="relative">
        <Button
          id={inputId}
          variant="outline"
          disabled={disabled}
          aria-invalid={hasErrors}
          aria-describedby={cn(
            ariaDescribedBy,
            hasErrors && errorId,
            hasWarnings && warningId,
            helpId
          ).trim() || undefined}
          aria-required={required}
          aria-expanded={showOutputs}
          aria-haspopup="listbox"
          className={cn(
            "w-full justify-between transition-all duration-200",
            "interactive-hover focus-ring-enhanced input-state-transition",
            // Error states with enhanced feedback
            hasErrors && [
              "border-destructive text-destructive",
              "hover:border-destructive/80 hover:text-destructive/80",
              "input-error-glow"
            ],
            // Warning states
            !hasErrors && hasWarnings && [
              "border-yellow-500 text-yellow-700",
              "hover:border-yellow-400 hover:text-yellow-600",
              "input-warning-glow"
            ],
            // Success states
            isValid && !isEmpty && !hasWarnings && [
              "border-green-500 text-green-700",
              "hover:border-green-400 hover:text-green-600",
              "input-success-glow"
            ],
            // Required field styling when empty with pulse animation
            isRequiredAndEmpty && [
              "border-orange-400 text-orange-700",
              "hover:border-orange-300 hover:text-orange-600",
              "required-indicator"
            ],
            // Enhanced focus states
            enhancedInput.isFocused && [
              "ring-2 ring-ring/30 ring-offset-2",
              "border-ring shadow-lg"
            ],
            // Disabled state
            disabled && [
              "opacity-50 cursor-not-allowed"
            ]
          )}
          onClick={() => !disabled && setShowOutputs(!showOutputs)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          {value ? (
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              <span className="truncate">{value}</span>
              {/* Validation status indicator */}
              {hasErrors && (
                <AlertTriangle className="h-3 w-3 text-destructive ml-auto" aria-hidden="true" />
              )}
              {!hasErrors && hasWarnings && (
                <Info className="h-3 w-3 text-yellow-500 ml-auto" aria-hidden="true" />
              )}
              {isValid && !isEmpty && !hasWarnings && (
                <CheckCircle className="h-3 w-3 text-green-500 ml-auto" aria-hidden="true" />
              )}
            </div>
          ) : (
            <span className={cn(
              "text-muted-foreground",
              isRequiredAndEmpty && "text-orange-600"
            )}>
              Select output reference...
              {required && <Asterisk className="h-3 w-3 inline ml-1" aria-hidden="true" />}
            </span>
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {showOutputs && (
          <div
            className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-y-auto"
            role="listbox"
            aria-label="Available output references"
          >
            {availableOutputsList.length > 0 ? (
              availableOutputsList.map((output) => (
                <div
                  key={output.key}
                  role="option"
                  aria-selected={value === output.key}
                  className={cn(
                    "flex items-center gap-3 p-3 cursor-pointer transition-colors duration-150",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground focus:outline-none",
                    value === output.key && "bg-accent/50 text-accent-foreground"
                  )}
                  onClick={() => {
                    try {
                      handleInputChange(output.key, 'select')
                      setShowOutputs(false)
                    } catch (error) {
                      console.error('Error selecting output reference:', error)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      try {
                        handleInputChange(output.key, 'select')
                        setShowOutputs(false)
                      } catch (error) {
                        console.error('Error selecting output reference:', error)
                      }
                    }
                  }}
                  tabIndex={0}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 text-primary",
                      value === output.key ? "opacity-100" : "opacity-0"
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-medium truncate">{output.key}</span>
                    <span className="text-sm text-muted-foreground truncate">
                      {output.type} - {output.description}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-3 text-sm text-muted-foreground text-center">
                No output references available
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const hasAvailableOutputs = Object.keys(availableOutputs).length > 0

  return (
    <div className="space-y-3">
        {/* Parameter Label with Required Indicator */}
        <div className="flex items-center gap-2">
          <Label
            htmlFor={inputId}
            className={cn(
              "text-sm font-medium transition-colors",
              hasErrors && "text-destructive",
              !hasErrors && hasWarnings && "text-yellow-600",
              isValid && !isEmpty && !hasWarnings && "text-green-600"
            )}
          >
            {parameter.name}
            {required && (
              <Asterisk
                className={cn(
                  "h-3 w-3 inline ml-1",
                  isRequiredAndEmpty ? "text-orange-500 required-indicator" : "text-destructive"
                )}
                aria-label="Required"
              />
            )}
          </Label>

          {/* Validation Status Badge */}
          {hasErrors && (
            <Badge variant="destructive" className="text-xs">
              Error
            </Badge>
          )}
          {!hasErrors && hasWarnings && (
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
              Warning
            </Badge>
          )}
          {isValid && !isEmpty && !hasWarnings && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-600">
              Valid
            </Badge>
          )}
        </div>

        {/* Input Mode Toggle */}
        {hasAvailableOutputs && (
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <button
                disabled={disabled}
                onClick={() => {
                  try {
                    setIsReferenceMode(false)
                    if (typeof value === 'string' && value.includes('.')) {
                      handleInputChange('', 'input')
                    }
                  } catch (error) {
                    console.error('Error switching to direct input mode:', error)
                  }
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "interactive-hover focus-ring-enhanced",
                  !isReferenceMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                Direct Input
              </button>
              <button
                disabled={disabled}
                onClick={() => {
                  try {
                    setIsReferenceMode(true)
                  } catch (error) {
                    console.error('Error switching to reference mode:', error)
                  }
                }}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "interactive-hover focus-ring-enhanced",
                  isReferenceMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent",
                  disabled && "opacity-50 cursor-not-allowed"
                )}
              >
                <Link className="h-3 w-3" />
                Reference
              </button>
            </div>

            {!isReferenceMode && suggestions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={() => setShowSuggestions(!showSuggestions)}
                className={cn(
                  "h-7 px-2 text-xs transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "interactive-hover focus-ring-enhanced"
                )}
              >
                <Sparkles className="h-3 w-3 mr-1" />
                Suggestions
              </Button>
            )}
          </div>
        )}

        {/* Input Field */}
        {isReferenceMode ? renderReferenceInput() : renderDirectInput()}

        {/* Error Messages */}
        {hasErrors && (
          <div id={errorId} className="space-y-1" role="alert" aria-live="polite">
            {/* Validation errors */}
            {validation?.errors?.map((error, index) => (
              <div key={`validation-${index}`} className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{error.message}</span>
              </div>
            ))}
            {/* Processing errors */}
            {enhancedInput.processingErrors.map((error, index) => (
              <div key={`processing-${index}`} className="flex items-start gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ))}
            {/* Error recovery option */}
            {enhancedInput.errorHandler.hasError && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={enhancedInput.recoverFromError}
                  className="h-6 text-xs border-destructive text-destructive hover:bg-destructive/10"
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Recover
                </Button>
                {enhancedInput.errorHandler.canRetry && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={enhancedInput.errorHandler.retryOperation}
                    className="h-6 text-xs border-blue-500 text-blue-600 hover:bg-blue-50"
                  >
                    Retry ({enhancedInput.errorHandler.maxRetries - enhancedInput.errorHandler.retryCount} left)
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Warning Messages */}
        {!hasErrors && hasWarnings && (
          <div id={warningId} className="space-y-1" role="alert" aria-live="polite">
            {/* Validation warnings */}
            {validation?.warnings?.map((warning, index) => (
              <div key={`validation-${index}`} className="flex items-start gap-2 text-sm text-yellow-600">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{warning}</span>
              </div>
            ))}
            {/* Processing warnings */}
            {enhancedInput.warnings.map((warning, index) => (
              <div key={`processing-${index}`} className="flex items-start gap-2 text-sm text-yellow-600">
                <Info className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span>{warning}</span>
              </div>
            ))}
          </div>
        )}

        {/* Processing Status */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-xs text-blue-600">
            <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />
            <span>Processing input...</span>
          </div>
        )}

        {/* Suggestions */}
        {!isReferenceMode && showSuggestions && suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((suggestion, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    "hover:bg-primary hover:text-primary-foreground",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                    "interactive-hover focus-ring-enhanced",
                    disabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (disabled) return
                    try {
                      handleInputChange(suggestion, 'input')
                      setShowSuggestions(false)
                    } catch (error) {
                      console.error('Error applying suggestion:', error)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (disabled) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      try {
                        handleInputChange(suggestion, 'input')
                        setShowSuggestions(false)
                      } catch (error) {
                        console.error('Error applying suggestion:', error)
                      }
                    }
                  }}
                  tabIndex={disabled ? -1 : 0}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Help Text and Type Information */}
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {parameter.type}
            </Badge>
            {isReferenceMode && (
              <span className="flex items-center gap-1">
                <Link className="h-3 w-3" />
                Using output reference
              </span>
            )}
            {required && (
              <span className="text-orange-600">Required</span>
            )}
          </div>

          {/* Character count for text inputs */}
          {!isReferenceMode && typeof enhancedInput.internalValue === 'string' && enhancedInput.internalValue.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {enhancedInput.internalValue.length} characters
              {enhancedInput.internalValue.length > 1000 && (
                <span className="text-yellow-600 ml-1">(long input)</span>
              )}
            </span>
          )}
        </div>

        {/* Help text for parameter types */}
        {!hasErrors && !hasWarnings && (
          <div id={helpId} className="text-xs text-muted-foreground">
            {parameter.type.toLowerCase().includes('address') && (
              <p>Enter a Flow blockchain address (e.g., 0x1234567890abcdef)</p>
            )}
            {parameter.type.toLowerCase().includes('ufix64') && (
              <p>Enter a positive decimal number with up to 8 decimal places</p>
            )}
            {parameter.type.toLowerCase().includes('bool') && (
              <p>Toggle between true and false values</p>
            )}
          </div>
        )}
    </div>
  )
}