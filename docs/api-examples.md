# ActionLoom AI Agent API Examples

This document provides comprehensive examples of how to use the ActionLoom AI Agent API for programmatic blockchain workflow composition and automation.

## Table of Contents

1. [Authentication](#authentication)
2. [Workflow Composition](#workflow-composition)
3. [Action Discovery](#action-discovery)
4. [Agent Management](#agent-management)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)
7. [SDK Examples](#sdk-examples)

## Authentication

All API requests require authentication using API keys. First, create an API key:

### Create API Key

```bash
curl -X POST https://api.actionloom.com/v1/auth/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Trading Bot",
    "userId": "user123",
    "tier": "pro",
    "permissions": [
      {
        "resource": "compose",
        "actions": ["read", "write"]
      },
      {
        "resource": "agents",
        "actions": ["read", "write", "delete"]
      }
    ],
    "expiresInDays": 90
  }'
```

Response:
```json
{
  "success": true,
  "apiKey": {
    "id": "key_1234567890_abcdef",
    "key": "al_your_64_character_api_key_here_store_securely",
    "name": "My Trading Bot",
    "permissions": [...],
    "rateLimit": {
      "requestsPerMinute": 100,
      "requestsPerHour": 5000,
      "requestsPerDay": 50000,
      "burstLimit": 200
    },
    "createdAt": "2024-01-01T00:00:00Z",
    "expiresAt": "2024-04-01T00:00:00Z"
  },
  "message": "API key created successfully. Store this key securely - it won't be shown again."
}
```

### Using API Key

Include your API key in the Authorization header for all requests:

```bash
curl -H "Authorization: Bearer al_your_64_character_api_key_here_store_securely" \
  https://api.actionloom.com/v1/actions
```

## Workflow Composition

### Natural Language Workflow Composition

Create a workflow from natural language description:

```bash
curl -X POST https://api.actionloom.com/v1/compose \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "naturalLanguage": "Swap 100 USDC to FLOW, then stake 50% in PoolX and provide liquidity with the rest",
    "options": {
      "validate": true,
      "simulate": true,
      "generateCadence": true
    },
    "metadata": {
      "name": "DeFi Strategy",
      "description": "Automated swap, stake, and LP workflow",
      "tags": ["defi", "automation", "yield"]
    }
  }'
```

Response:
```json
{
  "success": true,
  "workflowId": "wf_1704067200_abc123",
  "workflow": {
    "actions": [
      {
        "id": "swap1",
        "actionType": "swap",
        "name": "Swap USDC to FLOW",
        "parameters": [
          {
            "name": "fromToken",
            "type": "string",
            "value": "USDC",
            "required": true
          },
          {
            "name": "toToken",
            "type": "string",
            "value": "FLOW",
            "required": true
          },
          {
            "name": "amount",
            "type": "number",
            "value": "100",
            "required": true
          }
        ],
        "nextActions": ["stake1", "lp1"],
        "position": { "x": 0, "y": 0 }
      },
      {
        "id": "stake1",
        "actionType": "stake",
        "name": "Stake 50% in PoolX",
        "parameters": [
          {
            "name": "token",
            "type": "string",
            "value": "FLOW",
            "required": true
          },
          {
            "name": "amount",
            "type": "percentage",
            "value": "50",
            "required": true
          },
          {
            "name": "pool",
            "type": "string",
            "value": "PoolX",
            "required": true
          }
        ],
        "nextActions": [],
        "position": { "x": 200, "y": -100 }
      },
      {
        "id": "lp1",
        "actionType": "provide_liquidity",
        "name": "Provide Liquidity",
        "parameters": [
          {
            "name": "tokenA",
            "type": "string",
            "value": "FLOW",
            "required": true
          },
          {
            "name": "amountA",
            "type": "percentage",
            "value": "50",
            "required": true
          }
        ],
        "nextActions": [],
        "position": { "x": 200, "y": 100 }
      }
    ],
    "executionOrder": ["swap1", "stake1", "lp1"],
    "rootActions": ["swap1"],
    "metadata": {
      "totalActions": 3,
      "totalConnections": 2,
      "createdAt": "2024-01-01T00:00:00Z",
      "name": "DeFi Strategy"
    },
    "nlpSource": "Swap 100 USDC to FLOW, then stake 50% in PoolX and provide liquidity with the rest",
    "validationResults": {
      "isValid": true,
      "errors": [],
      "warnings": [],
      "compatibilityIssues": []
    },
    "simulationResults": {
      "success": true,
      "gasUsed": 1500,
      "balanceChanges": [
        {
          "address": "0x1234...",
          "token": "USDC",
          "before": "1000.00",
          "after": "900.00",
          "change": "-100.00"
        },
        {
          "address": "0x1234...",
          "token": "FLOW",
          "before": "0.00",
          "after": "95.50",
          "change": "+95.50"
        }
      ],
      "events": [],
      "errors": [],
      "warnings": [],
      "executionTime": 2500
    },
    "estimatedGas": 1500,
    "requiredBalance": [
      {
        "token": "USDC",
        "amount": "100.00",
        "decimals": 6
      }
    ]
  },
  "cadenceCode": "transaction {\n  prepare(signer: AuthAccount) {\n    // Swap 100 USDC to FLOW\n    // Stake 50% in PoolX\n    // Provide liquidity with remaining\n  }\n  execute {\n    log(\"DeFi strategy executed successfully\")\n  }\n}",
  "nlpResult": {
    "confidence": 0.92,
    "steps": [
      {
        "actionId": "swap_usdc_flow",
        "actionName": "Token Swap",
        "parameters": {
          "fromToken": "USDC",
          "toToken": "FLOW",
          "amount": 100
        },
        "confidence": 0.95
      },
      {
        "actionId": "stake_flow_poolx",
        "actionName": "Stake Tokens",
        "parameters": {
          "token": "FLOW",
          "pool": "PoolX",
          "percentage": 50
        },
        "confidence": 0.90
      },
      {
        "actionId": "provide_liquidity",
        "actionName": "Provide Liquidity",
        "parameters": {
          "token": "FLOW",
          "percentage": 50
        },
        "confidence": 0.88
      }
    ],
    "ambiguities": [],
    "suggestions": [],
    "processingTime": 150
  }
}
```

### Structured Workflow Composition

Create a workflow from structured data:

```bash
curl -X POST https://api.actionloom.com/v1/compose \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "actions": [
        {
          "id": "daily_dca",
          "actionType": "swap",
          "name": "Daily DCA Purchase",
          "parameters": [
            {
              "name": "fromToken",
              "type": "string",
              "value": "USDC",
              "required": true
            },
            {
              "name": "toToken",
              "type": "string",
              "value": "FLOW",
              "required": true
            },
            {
              "name": "amount",
              "type": "number",
              "value": "10",
              "required": true
            }
          ],
          "nextActions": [],
          "position": { "x": 0, "y": 0 }
        }
      ],
      "executionOrder": ["daily_dca"],
      "rootActions": ["daily_dca"],
      "metadata": {
        "totalActions": 1,
        "totalConnections": 0,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    },
    "options": {
      "validate": true,
      "generateCadence": true
    },
    "metadata": {
      "name": "Daily DCA",
      "description": "Daily dollar-cost averaging into FLOW"
    }
  }'
```

## Action Discovery

### Search Actions

Search for available Actions:

```bash
curl "https://api.actionloom.com/v1/actions?q=swap&limit=5" \
  -H "Authorization: Bearer al_your_api_key_here"
```

Response:
```json
{
  "success": true,
  "query": "swap",
  "actions": [
    {
      "id": "swap_tokens_v2",
      "name": "Token Swap V2",
      "description": "Swap tokens using AMM with slippage protection",
      "category": "defi",
      "version": "2.1.0",
      "inputs": [
        {
          "name": "fromToken",
          "type": "string",
          "required": true,
          "description": "Source token symbol"
        },
        {
          "name": "toToken",
          "type": "string",
          "required": true,
          "description": "Destination token symbol"
        },
        {
          "name": "amount",
          "type": "number",
          "required": true,
          "description": "Amount to swap"
        },
        {
          "name": "slippage",
          "type": "number",
          "required": false,
          "description": "Maximum slippage percentage (default: 1%)"
        }
      ],
      "outputs": [
        {
          "name": "outputAmount",
          "type": "number",
          "description": "Amount received after swap"
        },
        {
          "name": "transactionId",
          "type": "string",
          "description": "Transaction hash"
        }
      ],
      "gasEstimate": 500,
      "securityLevel": "medium",
      "author": "FlowDEX",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T00:00:00Z"
    }
  ],
  "total": 1,
  "searchResults": [
    {
      "action": { /* action object */ },
      "score": 0.95,
      "matchReasons": ["name match", "description match"]
    }
  ]
}
```

### Get Actions by Category

```bash
curl "https://api.actionloom.com/v1/actions?category=defi&limit=10" \
  -H "Authorization: Bearer al_your_api_key_here"
```

### Get Specific Action

```bash
curl "https://api.actionloom.com/v1/actions?id=swap_tokens_v2" \
  -H "Authorization: Bearer al_your_api_key_here"
```

### Validate Action Compatibility

```bash
curl -X POST https://api.actionloom.com/v1/actions \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "sourceActionId": "swap_tokens_v2",
    "targetActionId": "stake_flow_v1"
  }'
```

Response:
```json
{
  "success": true,
  "compatible": true,
  "issues": []
}
```

## Agent Management

### Create Agent

Create an automated Agent from a workflow:

```bash
curl -X POST https://api.actionloom.com/v1/agents \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow": {
      "actions": [
        {
          "id": "daily_dca",
          "actionType": "swap",
          "name": "Daily DCA Purchase",
          "parameters": [
            {
              "name": "fromToken",
              "type": "string",
              "value": "USDC",
              "required": true
            },
            {
              "name": "toToken",
              "type": "string",
              "value": "FLOW",
              "required": true
            },
            {
              "name": "amount",
              "type": "number",
              "value": "10",
              "required": true
            }
          ],
          "nextActions": [],
          "position": { "x": 0, "y": 0 }
        }
      ],
      "executionOrder": ["daily_dca"],
      "rootActions": ["daily_dca"],
      "metadata": {
        "totalActions": 1,
        "totalConnections": 0,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    },
    "config": {
      "schedule": {
        "type": "recurring",
        "interval": 86400,
        "startTime": "2024-01-01T12:00:00Z"
      },
      "eventTriggers": [],
      "retryPolicy": {
        "maxRetries": 3,
        "backoffStrategy": "exponential",
        "initialDelay": 1000,
        "maxDelay": 10000
      },
      "notifications": {
        "email": "user@example.com",
        "webhook": "https://myapp.com/webhooks/agent-notifications"
      },
      "permissions": []
    },
    "name": "Daily DCA Agent",
    "description": "Automated daily dollar-cost averaging into FLOW",
    "owner": "user123"
  }'
```

Response:
```json
{
  "success": true,
  "agentId": "agent_1704067200_xyz789",
  "agent": {
    "id": "agent_1704067200_xyz789",
    "name": "Daily DCA Agent",
    "description": "Automated daily dollar-cost averaging into FLOW",
    "workflowId": "wf_1704067200_abc123",
    "schedule": {
      "type": "recurring",
      "interval": 86400,
      "startTime": "2024-01-01T12:00:00Z"
    },
    "triggers": [],
    "status": "active",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "owner": "user123"
  },
  "message": "Agent created successfully"
}
```

### List Agents

```bash
curl "https://api.actionloom.com/v1/agents?userId=user123&health=true" \
  -H "Authorization: Bearer al_your_api_key_here"
```

Response:
```json
{
  "success": true,
  "agents": [
    {
      "agent": {
        "id": "agent_1704067200_xyz789",
        "name": "Daily DCA Agent",
        "status": "active",
        "createdAt": "2024-01-01T00:00:00Z",
        "owner": "user123"
      },
      "health": {
        "status": "healthy",
        "uptime": 86400,
        "lastExecution": "2024-01-02T12:00:00Z",
        "successRate": 0.98,
        "errorCount": 1,
        "lastError": null
      }
    }
  ],
  "total": 1
}
```

### Control Agent

Pause, resume, or stop an Agent:

```bash
curl -X POST https://api.actionloom.com/v1/agents/control \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_1704067200_xyz789",
    "action": "pause"
  }'
```

### Update Agent

```bash
curl -X PUT https://api.actionloom.com/v1/agents \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_1704067200_xyz789",
    "updates": {
      "schedule": {
        "type": "recurring",
        "interval": 43200
      },
      "name": "Twice Daily DCA Agent"
    }
  }'
```

### Delete Agent

```bash
curl -X DELETE https://api.actionloom.com/v1/agents \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_1704067200_xyz789"
  }'
```

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": "You have exceeded your hourly rate limit of 5000 requests",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

Common error codes:
- `INVALID_API_KEY`: API key is invalid or expired
- `INSUFFICIENT_PERMISSIONS`: API key lacks required permissions
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `VALIDATION_FAILED`: Request validation failed
- `RESOURCE_NOT_FOUND`: Requested resource not found
- `WORKFLOW_INVALID`: Workflow validation failed
- `SIMULATION_FAILED`: Workflow simulation failed
- `AGENT_NOT_FOUND`: Agent not found
- `INTERNAL_ERROR`: Internal server error

## Rate Limiting

Rate limit information is included in response headers:

```
X-RateLimit-Remaining-Minute: 95
X-RateLimit-Remaining-Hour: 4850
X-RateLimit-Remaining-Day: 49500
```

When rate limits are exceeded, you'll receive a 429 status code:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "remainingRequests": {
    "minute": 0,
    "hour": 0,
    "day": 45000
  }
}
```

## SDK Examples

### JavaScript/TypeScript SDK

```typescript
import { ActionLoomClient } from '@actionloom/sdk'

const client = new ActionLoomClient({
  apiKey: 'al_your_api_key_here',
  baseURL: 'https://api.actionloom.com/v1'
})

// Compose workflow from natural language
const workflow = await client.compose({
  naturalLanguage: 'Swap 100 USDC to FLOW and stake in PoolX',
  options: {
    validate: true,
    generateCadence: true
  }
})

// Create automated agent
const agent = await client.agents.create({
  workflow: workflow.workflow,
  config: {
    schedule: {
      type: 'recurring',
      interval: 86400 // Daily
    },
    retryPolicy: {
      maxRetries: 3,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 10000
    }
  },
  name: 'Daily DCA Agent',
  owner: 'user123'
})

// Search for actions
const actions = await client.actions.search('swap', { limit: 10 })

// Monitor agent health
const health = await client.agents.getHealth(agent.agentId)
```

### Python SDK

```python
from actionloom import ActionLoomClient

client = ActionLoomClient(
    api_key='al_your_api_key_here',
    base_url='https://api.actionloom.com/v1'
)

# Compose workflow
workflow = client.compose(
    natural_language='Swap 100 USDC to FLOW and stake in PoolX',
    options={
        'validate': True,
        'generate_cadence': True
    }
)

# Create agent
agent = client.agents.create(
    workflow=workflow['workflow'],
    config={
        'schedule': {
            'type': 'recurring',
            'interval': 86400
        },
        'retry_policy': {
            'max_retries': 3,
            'backoff_strategy': 'exponential',
            'initial_delay': 1000,
            'max_delay': 10000
        }
    },
    name='Daily DCA Agent',
    owner='user123'
)

# Search actions
actions = client.actions.search('swap', limit=10)

# Control agent
client.agents.pause(agent['agent_id'])
```

### Go SDK

```go
package main

import (
    "context"
    "github.com/actionloom/go-sdk"
)

func main() {
    client := actionloom.NewClient("al_your_api_key_here")
    
    // Compose workflow
    workflow, err := client.Compose(context.Background(), &actionloom.ComposeRequest{
        NaturalLanguage: "Swap 100 USDC to FLOW and stake in PoolX",
        Options: &actionloom.ComposeOptions{
            Validate: true,
            GenerateCadence: true,
        },
    })
    
    // Create agent
    agent, err := client.Agents.Create(context.Background(), &actionloom.CreateAgentRequest{
        Workflow: workflow.Workflow,
        Config: &actionloom.AgentConfiguration{
            Schedule: &actionloom.Schedule{
                Type: "recurring",
                Interval: 86400,
            },
        },
        Name: "Daily DCA Agent",
        Owner: "user123",
    })
    
    // Search actions
    actions, err := client.Actions.Search(context.Background(), "swap", &actionloom.SearchOptions{
        Limit: 10,
    })
}
```

## Best Practices

1. **Store API keys securely**: Never expose API keys in client-side code or version control
2. **Handle rate limits gracefully**: Implement exponential backoff when rate limits are hit
3. **Validate workflows**: Always validate workflows before creating Agents
4. **Monitor Agent health**: Regularly check Agent health and handle failures
5. **Use appropriate permissions**: Grant minimal required permissions to API keys
6. **Handle errors properly**: Implement proper error handling for all API calls
7. **Cache Action data**: Cache frequently used Action metadata to reduce API calls
8. **Use webhooks**: Set up webhooks for Agent notifications instead of polling

## Support

For additional help and support:
- Documentation: https://docs.actionloom.com
- API Reference: https://api.actionloom.com/docs
- Support: support@actionloom.com
- Discord: https://discord.gg/actionloom