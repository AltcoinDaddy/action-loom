# Requirements Document

## Introduction

The token transfer action in ActionLoom is experiencing parameter validation issues that prevent users from properly configuring the action. Users are seeing "missing required parameter" and "invalid parameter" errors for the `amount` and `token` parameters, even when values are provided. This prevents the successful configuration and execution of token transfer workflows.

## Requirements

### Requirement 1

**User Story:** As a workflow builder, I want to configure token transfer parameters without validation errors, so that I can create functional token transfer workflows.

#### Acceptance Criteria

1. WHEN a user selects the transfer-tokens action THEN the system SHALL display all required parameters with proper validation rules
2. WHEN a user enters a valid UFix64 amount THEN the system SHALL accept the value without showing "amount is required" errors
3. WHEN a user selects a token from the dropdown THEN the system SHALL accept the selection without showing "token is required" errors
4. WHEN a user enters a valid Flow address THEN the system SHALL validate the address format correctly
5. WHEN all required parameters are provided THEN the system SHALL show the action as properly configured

### Requirement 2

**User Story:** As a workflow builder, I want clear parameter validation feedback, so that I can understand what values are expected and fix any errors.

#### Acceptance Criteria

1. WHEN a parameter validation fails THEN the system SHALL display specific error messages explaining what is wrong
2. WHEN a UFix64 parameter is invalid THEN the system SHALL show "UFix64: Positive decimal number with up to 8 decimal places" guidance
3. WHEN an Address parameter is invalid THEN the system SHALL show "18 characters" and format guidance
4. WHEN a String parameter is invalid THEN the system SHALL show available options for selection
5. WHEN validation passes THEN the system SHALL show "Valid" status for each parameter

### Requirement 3

**User Story:** As a workflow builder, I want parameter suggestions and defaults, so that I can quickly configure common token transfer scenarios.

#### Acceptance Criteria

1. WHEN configuring the token parameter THEN the system SHALL provide a dropdown with available token options (FLOW, USDC, FUSD)
2. WHEN configuring the amount parameter THEN the system SHALL accept decimal numbers with up to 8 decimal places
3. WHEN configuring the recipient parameter THEN the system SHALL validate Flow address format (0x + 16 hex characters)
4. WHEN a parameter has a default value THEN the system SHALL pre-populate the field with the default
5. WHEN parameter dependencies exist THEN the system SHALL show reference options from previous actions

### Requirement 4

**User Story:** As a workflow builder, I want the parameter validation to work consistently, so that I don't encounter unexpected errors during workflow configuration.

#### Acceptance Criteria

1. WHEN the enhanced action metadata service processes transfer-tokens THEN it SHALL apply the correct parameter templates
2. WHEN the parameter validator validates UFix64 values THEN it SHALL accept positive decimal numbers
3. WHEN the parameter validator validates String values THEN it SHALL accept values from the enum constraints
4. WHEN the parameter validator validates Address values THEN it SHALL accept properly formatted Flow addresses
5. WHEN parameter values are set THEN the validation state SHALL update immediately without requiring page refresh