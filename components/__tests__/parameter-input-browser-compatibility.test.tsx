import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ParameterInput } from '../parameter-input'
import { ActionParameter, ActionOutput } from '@/lib/types'

// Mock UI components with enhanced browser compatibility testing
vi.mock('@/components/ui/input', () => ({
  Input: React.forwardRef<HTMLInputElement, any>(({ onChange, onFocus, onBlur, onKeyDown, ...props }, ref) => (
    <input 
      ref={ref}
      {...props} 
      onChange={(e) => onChange?.(e)} 
      onFocus={(e) => onFocus?.(e)}
      onBlur={(e) => onBlur?.(e)}
      onKeyDown={(e) => onKeyDown?.(e)}
      data-testid="input" 
    />
  ))
}))

vi.mock('@/components/ui/textarea', () => ({
  Textarea: React.forwardRef<HTMLTextAreaElement, any>(({ onChange, onFocus, onBlur, onKeyDown, ...props }, ref) => (
    <textarea 
      ref={ref}
      {...props} 
      onChange={(e) => on