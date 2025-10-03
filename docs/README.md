# ActionLoom AI Agent API Documentation

Welcome to the ActionLoom AI Agent API documentation. This API provides programmatic access to blockchain workflow composition, Action discovery, and Agent management capabilities for the Flow blockchain ecosystem.

## 📚 Documentation Overview

This documentation package includes:

- **[API Reference](./api-documentation.yaml)** - Complete OpenAPI 3.0 specification
- **[Usage Examples](./api-examples.md)** - Comprehensive examples and SDK usage
- **[Integration Tests](../lib/__tests__/api-integration-comprehensive.test.ts)** - Test suite demonstrating API functionality

## 🚀 Quick Start

### 1. Get an API Key

First, create an API key through the ActionLoom dashboard or API:

```bash
curl -X POST https://api.actionloom.com/v1/auth/keys \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "userId": "your-user-id",
    "tier": "pro"
  }'
```

### 2. Make Your First Request

Use your API key to discover available Actions:

```bash
curl "https://api.actionloom.com/v1/actions?q=swap&limit=5" \
  -H "Authorization: Bearer al_your_api_key_here"
```

### 3. Compose a Workflow

Create a blockchain workflow from natural language:

```bash
curl -X POST https://api.actionloom.com/v1/compose \
  -H "Authorization: Bearer al_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "naturalLanguage": "Swap 100 USDC to FLOW and stake in PoolX",
    "options": {
      "validate": true,
      "generateCadence": true
    }
  }'
```

## 🔑 Authentication

All API requests require authentication using API keys. Include your API key in the Authorization header:

```
Authorization: Bearer al_your_64_character_api_key_here
```

## 📊 Rate Limits

API requests are rate-limited based on your subscription tier:

| Tier | Per Minute | Per Hour | Per Day |
|------|------------|----------|---------|
| Free | 10 | 100 | 1,000 |
| Pro | 100 | 5,000 | 50,000 |
| Enterprise | 1,000 | 50,000 | 1,000,000 |

Rate limit information is included in response headers:
- `X-RateLimit-Remaining-Minute`
- `X-RateLimit-Remaining-Hour`
- `X-RateLimit-Remaining-Day`

## 🛠 API Endpoints

### Workflow Composition
- `POST /compose` - Create workflows from natural language or structured input

### Action Discovery
- `GET /actions` - Discover and search blockchain Actions
- `POST /actions` - Validate Actions and compatibility

### Agent Management
- `GET /agents` - List automation Agents
- `POST /agents` - Create new Agents
- `PUT /agents` - Update Agent configuration
- `DELETE /agents` - Delete Agents
- `POST /agents/control` - Control Agent execution
- `GET /agents/health` - Monitor Agent health

### Authentication
- `GET /auth/keys` - List API keys
- `POST /auth/keys` - Create new API keys
- `DELETE /auth/keys` - Revoke API keys

## 📖 Detailed Documentation

### API Reference
The complete OpenAPI 3.0 specification is available in [`api-documentation.yaml`](./api-documentation.yaml). You can:

- View it in [Swagger Editor](https://editor.swagger.io/)
- Generate client SDKs using [OpenAPI Generator](https://openapi-generator.tech/)
- Import into API testing tools like Postman or Insomnia

### Usage Examples
Comprehensive examples for all endpoints are available in [`api-examples.md`](./api-examples.md), including:

- Authentication setup
- Workflow composition examples
- Action discovery patterns
- Agent management workflows
- Error handling best practices
- SDK usage in multiple languages

### Integration Tests
The test suite in [`api-integration-comprehensive.test.ts`](../lib/__tests__/api-integration-comprehensive.test.ts) demonstrates:

- All API endpoints functionality
- Authentication and authorization
- Rate limiting behavior
- Error handling
- Performance characteristics
- Requirements compliance

## 🔧 SDKs and Tools

### Official SDKs
- **JavaScript/TypeScript**: `@actionloom/sdk`
- **Python**: `actionloom-python`
- **Go**: `github.com/actionloom/go-sdk`

### Community Tools
- **Postman Collection**: Import our API collection for easy testing
- **OpenAPI Generator**: Generate clients in 50+ languages
- **Swagger UI**: Interactive API documentation

## 🏗 Use Cases

### AI Trading Bots
```javascript
const client = new ActionLoomClient({ apiKey: 'al_...' })

// Create DCA strategy
const workflow = await client.compose({
  naturalLanguage: 'Buy $10 of FLOW daily when price drops 5%'
})

// Deploy as automated agent
const agent = await client.agents.create({
  workflow: workflow.workflow,
  config: { schedule: { type: 'recurring', interval: 86400 } }
})
```

### DeFi Automation
```python
client = ActionLoomClient(api_key='al_...')

# Complex yield farming strategy
workflow = client.compose(
    natural_language='Swap USDC to FLOW, stake 70%, provide LP with 30%'
)

# Monitor and rebalance
agent = client.agents.create(
    workflow=workflow['workflow'],
    config={'schedule': {'type': 'event-driven'}}
)
```

### Portfolio Management
```go
client := actionloom.NewClient("al_...")

// Rebalancing workflow
workflow, _ := client.Compose(ctx, &actionloom.ComposeRequest{
    NaturalLanguage: "Rebalance portfolio to 60% FLOW, 40% USDC",
})

// Schedule monthly rebalancing
agent, _ := client.Agents.Create(ctx, &actionloom.CreateAgentRequest{
    Workflow: workflow.Workflow,
    Config: &actionloom.AgentConfiguration{
        Schedule: &actionloom.Schedule{Type: "recurring", Interval: 2592000},
    },
})
```

## 🚨 Error Handling

The API uses standard HTTP status codes and returns consistent error responses:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "details": "You have exceeded your hourly rate limit of 5000 requests",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

Common status codes:
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

## 🔒 Security

### API Key Security
- Store API keys securely (environment variables, secret managers)
- Never expose keys in client-side code or version control
- Rotate keys regularly
- Use minimal required permissions

### Request Security
- All requests use HTTPS
- API keys are transmitted as Bearer tokens
- Rate limiting prevents abuse
- Input validation prevents injection attacks

## 📈 Best Practices

1. **Cache Action Data**: Cache frequently used Action metadata to reduce API calls
2. **Handle Rate Limits**: Implement exponential backoff when rate limits are hit
3. **Validate Workflows**: Always validate workflows before creating Agents
4. **Monitor Agent Health**: Regularly check Agent health and handle failures
5. **Use Webhooks**: Set up webhooks for Agent notifications instead of polling
6. **Error Handling**: Implement proper error handling for all API calls
7. **Concurrent Requests**: Use connection pooling for high-throughput applications

## 🆘 Support

### Documentation
- **API Reference**: [https://api.actionloom.com/docs](https://api.actionloom.com/docs)
- **Developer Guide**: [https://docs.actionloom.com](https://docs.actionloom.com)
- **Tutorials**: [https://docs.actionloom.com/tutorials](https://docs.actionloom.com/tutorials)

### Community
- **Discord**: [https://discord.gg/actionloom](https://discord.gg/actionloom)
- **GitHub**: [https://github.com/actionloom](https://github.com/actionloom)
- **Stack Overflow**: Tag questions with `actionloom`

### Support Channels
- **Email**: support@actionloom.com
- **Enterprise Support**: enterprise@actionloom.com
- **Bug Reports**: [GitHub Issues](https://github.com/actionloom/api/issues)

## 📄 License

This API documentation is licensed under the MIT License. See the [LICENSE](../LICENSE) file for details.

## 🔄 Changelog

### v1.0.0 (Current)
- Initial release of AI Agent API
- Workflow composition from natural language
- Action discovery and validation
- Agent-based automation
- Comprehensive authentication and rate limiting
- OpenAPI 3.0 specification
- Multi-language SDK support

---

**Ready to build the future of blockchain automation?** Start with our [Quick Start Guide](#-quick-start) or explore the [API Examples](./api-examples.md).