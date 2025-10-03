# ActionLoom Forte Integration

This directory contains the enhanced type system and Flow Access API integration for ActionLoom's Forte upgrade compatibility.

## Overview

The Forte integration transforms ActionLoom from a static workflow builder into a dynamic, AI-ready blockchain automation platform by adding:

- **Dynamic Action Discovery**: Automatically discover Actions from Flow's on-chain registries
- **Enhanced Type System**: Rich metadata and compatibility checking for Actions and Agents
- **Flow Access API Client**: Robust client with retry logic and error handling
- **Action Validation**: Security and compatibility validation for discovered Actions

## Key Components

### 1. Enhanced Type System (`types.ts`)

Extended the existing Action interface with Forte-specific features:

```typescript
interface ForteAction extends Action {
  version: string
  contractAddress: string
  metadata: ActionMetadata
  compatibility: CompatibilityInfo
  gasEstimate: number
  securityAudit: SecurityAudit
  dependencies: string[]
  tags: string[]
}
```

Added Agent types for automation:

```typescript
interface Agent {
  id: string
  name: string
  workflowId: string
  schedule: Schedule
  triggers: EventTrigger[]
  status: AgentStatus
}
```

### 2. Flow Access API Client (`flow-api-client.ts`)

Provides methods for interacting with Flow's Access API:

```typescript
const client = createFlowAPIClient('testnet', 'your-api-key')

// Discover Action registries
const registries = await client.discoverActionRegistries()

// Get Action metadata
const metadata = await client.getActionMetadata(registryAddress, actionId)

// Execute Cadence scripts
const result = await client.executeScript(script, args)
```

### 3. Action Discovery Service (`action-discovery.ts`)

Interfaces and base implementations for Action discovery:

```typescript
const discoveryService = createActionDiscoveryService(flowClient)

// Discover all available Actions
const actions = await discoveryService.discoverActions()

// Search Actions by keyword
const swapActions = await discoveryService.searchActions('swap')

// Validate Action compatibility
const validation = await discoveryService.validateCompatibility(actions)
```

### 4. Utilities and Configuration

- **Flow Configuration** (`flow-config.ts`): Network configurations and constants
- **Error Handling** (`flow-errors.ts`): Comprehensive error handling with retry logic
- **Forte Utils** (`forte-utils.ts`): Utility functions for validation and parsing

## Usage Examples

### Basic Setup

```typescript
import { createForteIntegration } from './lib/forte-integration'

// Create integration instance
const integration = createForteIntegration({
  network: FLOW_NETWORKS.testnet,
  apiKey: 'your-api-key'
})

// Discover Actions
const actions = await integration.discoveryService.discoverActions()
```

### Action Validation

```typescript
import { validateForteAction, parseForteMetadata } from './lib/forte-integration'

// Parse raw metadata from Flow
const metadata = parseForteMetadata(rawData)

// Create and validate ForteAction
const forteAction = createForteAction(metadata, contractAddress, securityAudit)
const validation = validateForteAction(forteAction)

if (validation.isValid) {
  console.log('Action is valid and secure')
} else {
  console.log('Validation errors:', validation.errors)
}
```

### Error Handling

```typescript
import { FlowErrorHandler, retryFlowOperation } from './lib/forte-integration'

try {
  const result = await retryFlowOperation(
    () => flowClient.discoverActions(),
    3 // max retries
  )
} catch (error) {
  const flowError = FlowErrorHandler.handleAPIError(error)
  const userMessage = FlowErrorHandler.formatUserError(flowError)
  console.error(userMessage)
}
```

## Architecture

The Forte integration follows a modular architecture:

```
lib/
├── types.ts                 # Enhanced type definitions
├── flow-api-client.ts       # Flow Access API client
├── action-discovery.ts      # Action discovery interfaces
├── flow-config.ts          # Network configuration
├── flow-errors.ts          # Error handling
├── forte-utils.ts          # Utility functions
├── forte-integration.ts    # Main export module
└── examples/               # Usage examples
```

## Security Considerations

- **Input Validation**: All user inputs are validated against Action schemas
- **Security Auditing**: Actions are validated against security audit results
- **Error Handling**: Comprehensive error handling prevents information leakage
- **Rate Limiting**: Built-in retry logic with exponential backoff

## Testing

Run the test suite to verify the integration:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- lib/__tests__/forte-integration.test.ts
```

## Next Steps

This foundation enables the implementation of:

1. **Action Discovery Service** (Task 2.1-2.4)
2. **Natural Language Processing** (Task 3.1-3.4)
3. **Workflow Validation** (Task 4.1-4.4)
4. **Agent Automation** (Task 6.1-6.3)

Each subsequent task builds upon this foundation to create the complete Forte integration.