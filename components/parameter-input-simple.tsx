"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Check, ChevronDown, Link, AlertTriangle, CheckCircle, Info, Asterisk } from 'lucide-react'
import { ActionParameter, ActionOutput } from '@/lib/types'
import { ParameterValidationResult } from '@/lib/parameter-validator'
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
  const [internalValue, setInternalValue] = useState(String(value || ''))
  
  // Validation state helpers
  const hasErrors = validation?.errors && validation.errors.length > 0
  const hasWarnings = validation?.warnings && validation.warnings.length > 0
  const isValid = validation?.isValid !== false && !hasErrors
  const isEmpty = !value || (typeof value === 'string' && value.trim() === '')
  const isRequiredAndEmpty = required && isEmpty
  
  // Generate unique IDs for accessibility
  const inputId = `parameter-${parameter.name}`
  const errorId = `${inputId}-error`
  const helpId = `${inputId}-help`
  const warningId = `${inputId}-warning`

  // Sync internal value with prop value
  useEffect(() => {
    setInternalValue(String(value || ''))
  }, [value])

  // Check if current value is a parameter reference
  useEffect(() => {
    if (typeof value === 'string' &&