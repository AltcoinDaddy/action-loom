# Real-time NLP Feedback System

This document describes the implementation of the real-time NLP feedback system for ActionLoom, which provides live natural language processing with visual entity highlighting and contextual suggestions.

## Overview

The real-time NLP feedback system consists of:

1. **WebSocket Server** (`lib/websocket-server.mjs`) - Handles real-time communication
2. **React Hook** (`hooks/use-nlp-websocket.ts`) - Manages WebSocket connection and state
3. **Enhanced NLP Input Component** (`components/nlp-input.tsx`) - Provides visual feedback
4. **Demo Component** (`components/nlp-demo.tsx`) - Demonstrates all features

## Features

### ✅ Real-time Entity Detection
- **Actions**: swap, stake, mint, transfer, bridge, lend, borrow, compound
- **Amounts**: Numbers with various formats (100, 1.5, 1,000, 100k, 1m)
- **Tokens**: 3-5 letter uppercase tokens (FLOW, USDC, USDT, etc.)
- **Addresses**: Hex addresses (0x1234567890abcdef...)
- **Parameters**: Slippage, deadlines, gas limits, etc.

### ✅ Visual Highlighting
- Color-coded entity highlighting with confidence scores
- Hover tooltips showing entity details
- Real-time highlighting as user types
- Smooth animations and transitions

### ✅ Input Validation
- Content validation (has text, actions, tokens, numbers)
- Complexity scoring (0-100%)
- Real-time validation indicators
- Error handling and display

### ✅ Contextual Suggestions
- Smart suggestions based on cursor position
- Action-specific completions
- Common workflow patterns
- Interactive suggestion selection

### ✅ WebSocket Communication
- Persistent connection with auto-reconnect
- Message types: parse_input, validate_input, get_suggestions
- Error handling and graceful degradation
- Connection status indicators

## Architecture

```
┌─────────────────┐    WebSocket    ┌──────────────────┐
│   React Hook    │ ←──────────────→ │ WebSocket Server │
│ (Client State)  │                 │   (Port 8080)    │
└─────────────────┘                 └──────────────────┘
         ↑                                    ↑
         │                                    │
         ↓                                    ↓
┌─────────────────┐                 ┌──────────────────┐
│ NLP Input       │                 │ Entity Extraction│
│ Component       │                 │ & Validation     │
└─────────────────┘                 └──────────────────┘
```

## Usage

### Starting the System

```bash
# Start WebSocket server
pnpm run dev:ws

# Start Next.js dev server
pnpm run dev

# Or start both together
pnpm run dev:full
```

### Using the Hook

```typescript
import { useNLPWebSocket } from '@/hooks/use-nlp-websocket'

function MyComponent() {
  const { 
    isConnected, 
    feedback, 
    parseInput, 
    validateInput, 
    getSuggestions 
  } = useNLPWebSocket()

  const handleInput = (text: string) => {
    parseInput(text, true) // partial=true for real-time
    validateInput(text)
    getSuggestions(text, cursorPosition)
  }

  return (
    <div>
      <div>Status: {isConnected ? 'Connected' : 'Disconnected'}</div>
      <div>Entities: {feedback.entities.length}</div>
      <div>Suggestions: {feedback.suggestions.join(', ')}</div>
    </div>
  )
}
```

### WebSocket Message Format

#### Client → Server

```typescript
// Parse input (partial or complete)
{
  type: 'parse_input',
  payload: {
    input: string,
    partial?: boolean
  }
}

// Validate input format
{
  type: 'validate_input',
  payload: {
    input: string
  }
}

// Get contextual suggestions
{
  type: 'get_suggestions',
  payload: {
    input: string,
    cursorPosition?: number
  }
}
```

#### Server → Client

```typescript
// Connection established
{
  type: 'connected',
  payload: {
    message: string,
    timestamp: string
  }
}

// Entities detected (partial parsing)
{
  type: 'entities_detected',
  payload: {
    entities: Entity[],
    input: string,
    timestamp: string
  }
}

// Full parsing complete
{
  type: 'parsing_complete',
  payload: {
    result: NLPResult,
    input: string,
    timestamp: string
  }
}

// Validation result
{
  type: 'validation_result',
  payload: {
    validation: ValidationResult,
    input: string,
    timestamp: string
  }
}

// Suggestions ready
{
  type: 'suggestions_ready',
  payload: {
    suggestions: string[],
    input: string,
    cursorPosition: number,
    timestamp: string
  }
}
```

## Entity Types and Colors

| Entity Type | Color | Description |
|-------------|-------|-------------|
| `action` | Blue (#3b82f6) | Blockchain actions (swap, stake, etc.) |
| `amount` | Green (#10b981) | Numeric amounts and quantities |
| `token` | Amber (#f59e0b) | Token symbols (FLOW, USDC, etc.) |
| `address` | Purple (#8b5cf6) | Blockchain addresses |
| `parameter` | Red (#ef4444) | Action parameters (slippage, etc.) |

## Testing

### Unit Tests
```bash
# Run WebSocket tests
pnpm test lib/__tests__/nlp-websocket.test.ts
```

### Manual Testing
1. Visit `/nlp-demo` page
2. Type example inputs:
   - "Swap 100 USDC to FLOW"
   - "Stake 50 FLOW for rewards"
   - "Transfer 25 FLOW to 0x1234567890abcdef"
3. Observe real-time highlighting and suggestions

## Performance Considerations

### Debouncing
- Input parsing is debounced by 300ms to avoid excessive API calls
- Suggestions are generated on cursor position changes
- Validation runs on every input change

### Memory Management
- WebSocket connections are properly cleaned up
- Entity highlights are recalculated efficiently
- Suggestion arrays are limited to 5 items

### Error Handling
- WebSocket reconnection on connection loss
- Graceful degradation when server is unavailable
- User-friendly error messages

## Future Enhancements

### Planned Features
- [ ] Voice input support
- [ ] Multi-language support
- [ ] Advanced entity relationships
- [ ] Workflow templates from NLP
- [ ] Integration with Action Discovery Service

### Performance Improvements
- [ ] Server-side caching of common patterns
- [ ] WebSocket connection pooling
- [ ] Optimized highlighting algorithms
- [ ] Reduced bundle size

## Troubleshooting

### Common Issues

**WebSocket connection fails**
- Ensure WebSocket server is running on port 8080
- Check firewall settings
- Verify no other services are using port 8080

**Entity highlighting not working**
- Check CSS styles are loaded
- Verify entity positions are calculated correctly
- Ensure textarea and overlay are properly aligned

**Suggestions not appearing**
- Check WebSocket connection status
- Verify cursor position is being tracked
- Ensure suggestion generation logic is working

### Debug Mode

Enable debug logging:
```typescript
const { feedback } = useNLPWebSocket('ws://localhost:8080?debug=true')
```

## Contributing

When adding new features:

1. Update entity extraction patterns in `websocket-server.mjs`
2. Add corresponding colors in `use-nlp-websocket.ts`
3. Update CSS styles in `globals.css`
4. Add tests in `nlp-websocket.test.ts`
5. Update this documentation

## Dependencies

- `ws` - WebSocket server implementation
- `@types/ws` - TypeScript definitions for ws
- `concurrently` - Run multiple commands simultaneously

## License

This implementation is part of the ActionLoom project and follows the same license terms.