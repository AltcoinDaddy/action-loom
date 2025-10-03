"use client"

import React, { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// Popover temporarily disabled to prevent infinite loop
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Check, ChevronDown, Link, Sparkles } from 'lucide-react'
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
}

export function ParameterInput({
  parameter,
  value,
  onChange,
  validation,
  availableOutputs,
  suggestions
}: ParameterInputProps) {
  const [isReferenceMode, setIsReferenceMode] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [showOutputs, setShowOutputs] = useState(false)

  // Check if current value is a parameter reference
  useEffect(() => {
    if (typeof value === 'string' && value.includes('.')) {
      const parts = value.split('.')
      if (parts.length >= 2 && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(parts[0])) {
        setIsReferenceMode(true)
      }
    }
  }, [value])

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
    const hasError = validation?.errors && validation.errors.length > 0
    const inputClassName = cn(
      "w-full",
      hasError && "border-destructive focus-visible:ring-destructive"
    )

    switch (paramType) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              checked={value === true || value === 'true'}
              onCheckedChange={(checked) => onChange(checked)}
            />
            <span className="text-sm text-muted-foreground">
              {value === true || value === 'true' ? 'True' : 'False'}
            </span>
          </div>
        )

      case 'address':
        return (
          <div className="space-y-2">
            <Input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0x1234567890abcdef"
              className={inputClassName}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestions.slice(0, 3).map((suggestion, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => onChange(suggestion)}
                    className="h-6 text-xs"
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
            <Input
              type="number"
              step="any"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder="0.0"
              className={inputClassName}
            />
            {parameter.type.toLowerCase().includes('ufix64') && (
              <p className="text-xs text-muted-foreground">
                UFix64: Positive decimal number with up to 8 decimal places
              </p>
            )}
          </div>
        )

      default:
        // For now, we'll use regular text input since we don't have enum constraints in the basic ActionParameter
        // This could be enhanced later with action metadata that includes validation rules

        // Long text parameters use textarea
        if (parameter.name.toLowerCase().includes('description') ||
          parameter.name.toLowerCase().includes('metadata')) {
          return (
            <Textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={`Enter ${parameter.name}`}
              className={inputClassName}
              rows={3}
            />
          )
        }

        // Default to text input
        return (
          <Input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter ${parameter.name}`}
            className={inputClassName}
          />
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
          variant="outline"
          className="w-full justify-between"
          onClick={() => setShowOutputs(!showOutputs)}
        >
          {value ? (
            <div className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              <span>{value}</span>
            </div>
          ) : (
            "Select output reference..."
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        
        {showOutputs && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-md shadow-md max-h-60 overflow-y-auto">
            {availableOutputsList.map((output) => (
              <div
                key={output.key}
                className="flex items-center gap-2 p-3 hover:bg-accent cursor-pointer"
                onClick={() => {
                  onChange(output.key)
                  setShowOutputs(false)
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === output.key ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span className="font-medium">{output.key}</span>
                  <span className="text-sm text-muted-foreground">
                    {output.type} - {output.description}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const hasAvailableOutputs = Object.keys(availableOutputs).length > 0

  return (
    <div className="space-y-3">
      {/* Input Mode Toggle */}
      {hasAvailableOutputs && (
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background p-1">
            <button
              onClick={() => {
                setIsReferenceMode(false)
                if (typeof value === 'string' && value.includes('.')) {
                  onChange('')
                }
              }}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                !isReferenceMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Direct Input
            </button>
            <button
              onClick={() => setIsReferenceMode(true)}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                isReferenceMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
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
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="h-7 px-2 text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Suggestions
            </Button>
          )}
        </div>
      )}

      {/* Input Field */}
      {isReferenceMode ? renderReferenceInput() : renderDirectInput()}

      {/* Suggestions */}
      {!isReferenceMode && showSuggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Suggestions:</p>
          <div className="flex flex-wrap gap-1">
            {suggestions.map((suggestion, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                onClick={() => {
                  onChange(suggestion)
                  setShowSuggestions(false)
                }}
              >
                {suggestion}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Type Information */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {parameter.type}
        </Badge>
        {isReferenceMode && (
          <span className="flex items-center gap-1">
            <Link className="h-3 w-3" />
            Using output reference
          </span>
        )}
      </div>
    </div>
  )
}