# Design Document

## Overview

The token transfer parameter validation issues stem from inconsistencies between the parameter definitions in the mock actions, the enhanced parameter templates, and the validation logic. The design focuses on fixing the parameter validation pipeline to ensure consistent and accurate validation for the transfer-tokens action.

## Architecture

The parameter validation system consists of several interconnected components:

1. **Mock Action Definition** (`app/api/actions/route.ts`) - Defines the basic action structure
2. **Enhanced Action Metadata Service** (`lib/enhanced-action-metadata-service.ts`) - Provides enhanced parameter templates
3. **Parameter Validator** (`lib/parameter-validator.ts`) - Validates parameter values
4. **Frontend Parameter Components** - Display and collect parameter values

The issue occurs when these components have mismatched expectations about parameter structure and validation rules.

## Components and Interfaces

### Enhanced Parameter Template Fix

The `transfer-tokens` parameter template needs to be corrected to match the expected parameter structure:

```typescript
interface ParameterTemplateFix {
  name: string
  type: ParameterType
  value: string | number | boolean
  required: boolean
  validation: ParameterValidationRules
  suggestions: ParameterSuggestion[]
  defaultValue?: any
}
```

### Parameter Validation Enhancement

The parameter validator needs to handle edge cases better:

```typescript
interface ValidationEnhancement {
  // Better empty value detection
  isEmpty(value: any): boolean
  
  // Improved UFix64 validation
  isValidUFix64(value: any): boolean
  
  // Enhanced enum validation
  validateEnum(value: any, options: string[]): boolean
}
```

### Mock Action Alignment

The mock action definition needs to align with the enhanced parameter structure:

```typescript
interface ActionParameterAlignment {
  // Consistent parameter structure
  parameters: ActionParameter[]
  
  // Proper type definitions
  inputs: ActionInput[]
  
  // Validation rule consistency
  validation: ParameterValidationRules
}
```

## Data Models

### Parameter Configuration Model

```typescript
interface ParameterConfiguration {
  recipient: {
    type: 'Address'
    required: true
    validation: {
      pattern: /^0x[a-fA-F0-9]{16}$/
      length: 18
    }
    placeholder: '0x1234567890abcdef'
  }
  
  amount: {
    type: 'UFix64'
    required: true
    validation: {
      min: 0.000001
      max: 1000000
      decimals: 8
    }
    placeholder: '10.5'
  }
  
  token: {
    type: 'String'
    required: true
    validation: {
      enum: ['FLOW', 'USDC', 'FUSD', 'WBTC', 'WETH']
    }
    defaultValue: 'FLOW'
  }
}
```

### Validation State Model

```typescript
interface ValidationState {
  parameterName: string
  value: any
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  suggestions: string[]
}
```

## Error Handling

### Parameter Validation Errors

1. **Missing Required Parameter**: Clear messaging when required parameters are not provided
2. **Invalid Type**: Specific guidance on expected parameter types
3. **Format Validation**: Detailed format requirements for addresses and numbers
4. **Enum Validation**: Available options display for string parameters

### Validation Error Messages

```typescript
const ERROR_MESSAGES = {
  MISSING_REQUIRED: (param: string) => `${param} is required and must be provided`,
  INVALID_UFIX64: (param: string) => `${param} must be a positive decimal number with up to 8 decimal places`,
  INVALID_ADDRESS: (param: string) => `${param} must be a valid Flow address (0x followed by 16 hex characters)`,
  INVALID_ENUM: (param: string, options: string[]) => `${param} must be one of: ${options.join(', ')}`
}
```

## Testing Strategy

### Unit Tests

1. **Parameter Validator Tests**
   - Test UFix64 validation with various inputs
   - Test Address format validation
   - Test enum validation with valid/invalid options
   - Test empty value handling

2. **Enhanced Metadata Service Tests**
   - Test parameter template generation
   - Test validation rule application
   - Test default value assignment

3. **Mock Action Tests**
   - Test parameter structure consistency
   - Test validation rule alignment

### Integration Tests

1. **End-to-End Parameter Configuration**
   - Test complete parameter configuration flow
   - Test validation feedback display
   - Test successful action configuration

2. **API Validation Tests**
   - Test parameter validation through API endpoints
   - Test error response formatting
   - Test validation state persistence

### Validation Test Cases

```typescript
const testCases = {
  validInputs: {
    recipient: '0x1234567890abcdef',
    amount: '10.5',
    token: 'FLOW'
  },
  invalidInputs: {
    recipient: 'invalid-address',
    amount: '-5.0',
    token: 'INVALID_TOKEN'
  },
  edgeCases: {
    recipient: '0x123', // too short
    amount: '0', // zero amount
    token: '' // empty token
  }
}
```

## Implementation Plan

### Phase 1: Fix Parameter Templates
- Update enhanced action metadata service parameter templates
- Ensure consistent parameter structure across all components
- Add proper validation rules and constraints

### Phase 2: Enhance Parameter Validation
- Improve UFix64 validation logic
- Fix empty value detection
- Enhance enum validation with better error messages

### Phase 3: Align Mock Action Definition
- Update mock action parameters to match enhanced templates
- Ensure consistent parameter types and validation rules
- Add proper default values and suggestions

### Phase 4: Frontend Integration
- Ensure frontend components use enhanced parameter metadata
- Implement proper validation state display
- Add real-time validation feedback

## Success Metrics

1. **Zero Parameter Validation Errors**: Users can configure transfer-tokens without validation errors
2. **Clear Error Messages**: All validation errors provide specific, actionable guidance
3. **Consistent Validation**: Parameter validation works consistently across all interfaces
4. **Improved User Experience**: Users can quickly configure token transfers with proper guidance