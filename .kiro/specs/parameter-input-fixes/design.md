# Design Document

## Overview

The parameter input functionality issue in ActionLoom stems from potential problems in the React state management, event handling, and component lifecycle within the `ParameterInput` component. The design focuses on ensuring robust text input handling, proper state synchronization, and reliable onChange event propagation throughout the parameter configuration system.

## Architecture

### Component Hierarchy
```
WorkflowBuilder
├── ParameterConfigPanel
│   └── ParameterInput (multiple instances)
│       ├── Input (shadcn/ui)
│       ├── Textarea (shadcn/ui)
│       ├── Select (shadcn/ui)
│       └── Switch (shadcn/ui)
```

### State Flow
```
User Input → ParameterInput.onChange → ParameterConfigPanel.onParameterChange → WorkflowBuilder.handleParameterChange → parameterValues state
```

### Data Flow Architecture
- **Unidirectional Data Flow**: Changes flow from child components up to parent state
- **Controlled Components**: All input components are controlled by React state
- **State Synchronization**: Parameter values are synchronized across the workflow builder
- **Validation Pipeline**: Input changes trigger validation and UI updates

## Components and Interfaces

### Enhanced ParameterInput Component

**Current Issues Identified:**
1. Potential race conditions in state updates
2. Missing input event handling edge cases
3. Inconsistent value type handling
4. Focus management issues

**Design Solutions:**

#### 1. Robust Input Event Handling
```typescript
interface InputEventHandlers {
  onChange: (value: any) => void
  onFocus: (event: FocusEvent) => void
  onBlur: (event: FocusEvent) => void
  onKeyDown: (event: KeyboardEvent) => void
}
```

#### 2. Value Type Management
```typescript
interface ValueProcessor {
  sanitizeInput: (value: string, type: ParameterType) => any
  validateFormat: (value: any, type: ParameterType) => boolean
  convertType: (value: string, targetType: ParameterType) => any
}
```

#### 3. Input State Management
```typescript
interface InputState {
  internalValue: string
  isValid: boolean
  isFocused: boolean
  hasChanged: boolean
}
```

### Enhanced ParameterConfigPanel Integration

**State Management Improvements:**
- Debounced parameter updates to prevent excessive re-renders
- Optimistic UI updates with rollback capability
- Proper cleanup of event listeners and state

**Validation Integration:**
- Real-time validation feedback
- Error state management
- Success state indicators

## Data Models

### Parameter Input Types
```typescript
type ParameterType = 
  | 'String'
  | 'UFix64'
  | 'Int'
  | 'Address'
  | 'Bool'
  | 'Array'
  | 'Dictionary'

interface EnhancedActionParameter extends ActionParameter {
  inputConfig?: {
    placeholder?: string
    helpText?: string
    validation?: ValidationRule[]
    format?: InputFormat
  }
}
```

### Input Validation Rules
```typescript
interface ValidationRule {
  type: 'required' | 'format' | 'range' | 'custom'
  message: string
  validator?: (value: any) => boolean
}

interface InputFormat {
  pattern?: RegExp
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
}
```

### State Management Models
```typescript
interface ParameterInputState {
  [nodeId: string]: {
    [parameterName: string]: {
      value: any
      isValid: boolean
      errors: ValidationError[]
      lastUpdated: number
    }
  }
}
```

## Error Handling

### Input Error Categories
1. **Type Conversion Errors**: Invalid format for parameter type
2. **Validation Errors**: Failed validation rules
3. **State Synchronization Errors**: Failed to update parent state
4. **Focus Management Errors**: Lost focus or cursor position

### Error Recovery Strategies
- **Graceful Degradation**: Fall back to basic text input if enhanced features fail
- **State Recovery**: Restore previous valid state on error
- **User Feedback**: Clear error messages and recovery suggestions
- **Logging**: Comprehensive error logging for debugging

### Error Boundaries
```typescript
interface InputErrorBoundary {
  fallbackComponent: React.ComponentType
  onError: (error: Error, errorInfo: ErrorInfo) => void
  resetOnPropsChange: boolean
}
```

## Testing Strategy

### Unit Testing
- **Input Component Tests**: Test all input types and edge cases
- **State Management Tests**: Test parameter value updates and synchronization
- **Validation Tests**: Test all validation rules and error states
- **Event Handling Tests**: Test keyboard, mouse, and touch interactions

### Integration Testing
- **Parameter Flow Tests**: Test complete parameter configuration workflow
- **Cross-Browser Tests**: Test input behavior across different browsers
- **Accessibility Tests**: Test keyboard navigation and screen reader support
- **Performance Tests**: Test input responsiveness with large workflows

### Test Cases
```typescript
describe('ParameterInput', () => {
  describe('Text Input', () => {
    it('should handle basic text input')
    it('should handle special characters')
    it('should handle rapid typing')
    it('should preserve cursor position on re-render')
  })
  
  describe('Numeric Input', () => {
    it('should handle decimal numbers')
    it('should validate UFix64 format')
    it('should handle negative numbers for Int type')
  })
  
  describe('Address Input', () => {
    it('should validate Flow address format')
    it('should handle 0x prefix')
    it('should show format hints')
  })
})
```

### End-to-End Testing
- **User Journey Tests**: Complete parameter configuration workflows
- **Cross-Device Tests**: Mobile and desktop input behavior
- **Network Condition Tests**: Input behavior under poor connectivity
- **Stress Tests**: Input performance with many parameters

## Implementation Approach

### Phase 1: Core Input Fixes
1. **Input Event Handling**: Fix onChange, onFocus, onBlur event handling
2. **State Synchronization**: Ensure proper state updates and propagation
3. **Type Conversion**: Robust value type handling and conversion
4. **Basic Validation**: Essential input validation and error display

### Phase 2: Enhanced Features
1. **Debounced Updates**: Implement debounced parameter updates
2. **Focus Management**: Proper focus and cursor position handling
3. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
4. **Performance**: Optimize re-rendering and state updates

### Phase 3: Advanced Functionality
1. **Auto-completion**: Smart suggestions and auto-complete
2. **Format Helpers**: Input masks and format assistance
3. **Bulk Operations**: Copy/paste and bulk parameter updates
4. **Undo/Redo**: Parameter change history and undo functionality

## Technical Considerations

### Performance Optimizations
- **React.memo**: Prevent unnecessary re-renders of input components
- **useCallback**: Memoize event handlers to prevent callback recreation
- **Debouncing**: Debounce parameter updates to reduce state churn
- **Virtual Scrolling**: For large parameter lists

### Browser Compatibility
- **Input Events**: Handle browser differences in input event firing
- **Clipboard API**: Cross-browser clipboard operations
- **Touch Events**: Mobile and tablet input handling
- **Autofill**: Browser autofill integration

### Accessibility Requirements
- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Tab order and keyboard shortcuts
- **Focus Indicators**: Clear visual focus indicators
- **Error Announcements**: Screen reader error announcements

### Security Considerations
- **Input Sanitization**: Prevent XSS through parameter inputs
- **Validation**: Server-side validation of all parameter values
- **Rate Limiting**: Prevent excessive parameter update requests
- **Data Persistence**: Secure storage of parameter values