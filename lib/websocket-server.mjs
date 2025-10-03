import { WebSocketServer } from 'ws'

// Create WebSocket server
const wss = new WebSocketServer({ 
  port: 8080
})

console.log('NLP WebSocket server started on ws://localhost:8080')

wss.on('connection', (ws, request) => {
  console.log('New WebSocket connection established')

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'parse_input') {
        await handleParseInput(ws, message.payload)
      } else if (message.type === 'validate_input') {
        await handleValidateInput(ws, message.payload)
      } else if (message.type === 'get_suggestions') {
        await handleGetSuggestions(ws, message.payload)
      }
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        payload: {
          message: 'Invalid message format',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }))
    }
  })

  ws.on('close', () => {
    console.log('WebSocket connection closed')
  })

  ws.on('error', (error) => {
    console.error('WebSocket error:', error)
  })

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    payload: {
      message: 'Real-time NLP feedback connected',
      timestamp: new Date().toISOString()
    }
  }))
})

/**
 * Handle real-time input parsing with incremental feedback
 */
async function handleParseInput(ws, payload) {
  const { input, partial = false } = payload

  try {
    // Send parsing started event
    ws.send(JSON.stringify({
      type: 'parsing_started',
      payload: {
        input,
        timestamp: new Date().toISOString()
      }
    }))

    // For partial input, do lightweight entity extraction
    if (partial) {
      const entities = extractEntitiesSimple(input)
      
      ws.send(JSON.stringify({
        type: 'entities_detected',
        payload: {
          entities,
          input,
          timestamp: new Date().toISOString()
        }
      }))
    } else {
      // Full parsing for complete input - simplified mock result
      const result = {
        confidence: 0.8,
        steps: [{
          actionId: 'mock_action',
          actionName: 'Mock Action',
          parameters: {},
          confidence: 0.8,
          position: 0
        }],
        ambiguities: [],
        suggestions: [],
        processingTime: 100
      }
      
      ws.send(JSON.stringify({
        type: 'parsing_complete',
        payload: {
          result,
          input,
          timestamp: new Date().toISOString()
        }
      }))
    }
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'parsing_error',
      payload: {
        input,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }))
  }
}

/**
 * Handle input validation with real-time feedback
 */
async function handleValidateInput(ws, payload) {
  const { input } = payload

  try {
    // Basic validation checks
    const validationResults = {
      length: input.length <= 1000,
      hasContent: input.trim().length > 0,
      hasNumbers: /\d/.test(input),
      hasTokens: /\b[A-Z]{3,5}\b/.test(input),
      hasActions: /\b(swap|stake|mint|transfer|bridge|lend|borrow)\b/i.test(input),
      complexity: calculateComplexity(input)
    }

    ws.send(JSON.stringify({
      type: 'validation_result',
      payload: {
        input,
        validation: validationResults,
        timestamp: new Date().toISOString()
      }
    }))
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'validation_error',
      payload: {
        input,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }))
  }
}

/**
 * Handle suggestion requests for incomplete inputs
 */
async function handleGetSuggestions(ws, payload) {
  const { input, cursorPosition = input.length } = payload

  try {
    const suggestions = generateSuggestions(input, cursorPosition)
    
    ws.send(JSON.stringify({
      type: 'suggestions_ready',
      payload: {
        input,
        cursorPosition,
        suggestions,
        timestamp: new Date().toISOString()
      }
    }))
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'suggestions_error',
      payload: {
        input,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }))
  }
}

/**
 * Simple entity extraction for demo purposes
 */
function extractEntitiesSimple(input) {
  const entities = []

  // Extract numbers (potential amounts)
  const numberPattern = /\b\d+(?:\.\d+)?\b/g
  let numberMatch
  while ((numberMatch = numberPattern.exec(input)) !== null) {
    entities.push({
      type: 'amount',
      value: numberMatch[0],
      confidence: 0.9,
      position: [numberMatch.index, numberMatch.index + numberMatch[0].length],
      metadata: { 
        normalized: parseFloat(numberMatch[0]),
        original: numberMatch[0]
      }
    })
  }

  // Extract potential token names (3-5 uppercase letters)
  const tokenPattern = /\b[A-Z]{3,5}\b/g
  let tokenMatch
  while ((tokenMatch = tokenPattern.exec(input)) !== null) {
    entities.push({
      type: 'token',
      value: tokenMatch[0],
      confidence: 0.8,
      position: [tokenMatch.index, tokenMatch.index + tokenMatch[0].length],
      metadata: { 
        original: tokenMatch[0],
        normalized: tokenMatch[0].toUpperCase()
      }
    })
  }

  // Extract action words
  const actionPattern = /\b(swap|stake|mint|transfer|bridge|lend|borrow|compound)\b/gi
  let actionMatch
  while ((actionMatch = actionPattern.exec(input)) !== null) {
    entities.push({
      type: 'action',
      value: actionMatch[0].toLowerCase(),
      confidence: 0.95,
      position: [actionMatch.index, actionMatch.index + actionMatch[0].length],
      metadata: {
        verb: true,
        intent: actionMatch[0].toLowerCase(),
        originalMatch: actionMatch[0]
      }
    })
  }

  // Extract addresses
  const addressPattern = /0x[a-fA-F0-9]{16,}/g
  let addressMatch
  while ((addressMatch = addressPattern.exec(input)) !== null) {
    entities.push({
      type: 'address',
      value: addressMatch[0],
      confidence: 0.95,
      position: [addressMatch.index, addressMatch.index + addressMatch[0].length],
      metadata: {
        format: 'hex',
        length: addressMatch[0].length
      }
    })
  }

  return entities
}

/**
 * Calculate input complexity score
 */
function calculateComplexity(input) {
  let score = 0
  
  // Word count factor
  const wordCount = input.split(/\s+/).length
  score += Math.min(wordCount / 10, 1) * 0.3
  
  // Action count factor
  const actionMatches = input.match(/\b(swap|stake|mint|transfer|bridge|lend|borrow|compound)\b/gi) || []
  score += Math.min(actionMatches.length / 3, 1) * 0.4
  
  // Entity count factor
  const entityMatches = [
    ...input.match(/\d+\.?\d*/g) || [], // numbers
    ...input.match(/\b[A-Z]{3,5}\b/g) || [], // tokens
    ...input.match(/0x[a-fA-F0-9]+/g) || [] // addresses
  ]
  score += Math.min(entityMatches.length / 5, 1) * 0.3
  
  return Math.min(score, 1)
}

/**
 * Generate contextual suggestions based on input
 */
function generateSuggestions(input, cursorPosition) {
  const suggestions = []
  const beforeCursor = input.slice(0, cursorPosition).toLowerCase()
  const afterCursor = input.slice(cursorPosition).toLowerCase()
  
  // Action suggestions
  if (beforeCursor.includes('swap') && !beforeCursor.includes('to')) {
    suggestions.push('to FLOW', 'to USDC', 'for USDT')
  }
  
  if (beforeCursor.includes('stake') && !beforeCursor.includes('in')) {
    suggestions.push('in validator pool', 'for 30 days', 'with auto-compound')
  }
  
  if (beforeCursor.includes('mint') && !beforeCursor.includes('nft')) {
    suggestions.push('NFT from collection', '100 tokens', 'new token')
  }
  
  if (beforeCursor.includes('transfer') && !beforeCursor.includes('to')) {
    suggestions.push('to address 0x...', 'to wallet', 'to recipient')
  }
  
  // Amount suggestions
  if (/\d+$/.test(beforeCursor.trim())) {
    suggestions.push('FLOW', 'USDC', 'USDT', 'tokens')
  }
  
  // Token suggestions
  if (beforeCursor.endsWith(' ')) {
    const lastWord = beforeCursor.trim().split(' ').pop() || ''
    if (['swap', 'transfer', 'stake', 'lend'].includes(lastWord)) {
      suggestions.push('100', '50', '1000', '0.5')
    }
  }
  
  // Common workflow patterns
  if (input.length < 10) {
    suggestions.push(
      'Swap 100 USDC to FLOW',
      'Stake 50 FLOW for rewards',
      'Transfer 25 FLOW to address',
      'Mint NFT from collection'
    )
  }
  
  return suggestions.slice(0, 5) // Limit to 5 suggestions
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down WebSocket server...')
  wss.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})

process.on('SIGTERM', () => {
  console.log('Shutting down WebSocket server...')
  wss.close(() => {
    console.log('WebSocket server closed')
    process.exit(0)
  })
})