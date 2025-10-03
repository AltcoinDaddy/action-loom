import { NextRequest } from 'next/server'
import { WebSocketServer } from 'ws'
import { NLPService } from '@/lib/nlp-service'
import { getNLPConfig } from '@/lib/nlp-config'

// WebSocket server instance
let wss: WebSocketServer | null = null

/**
 * Initialize WebSocket server for real-time NLP feedback
 */
function initializeWebSocketServer() {
  if (wss) return wss

  wss = new WebSocketServer({ 
    port: 8080,
    path: '/api/nlp/realtime'
  })

  wss.on('connection', (ws, request) => {
    console.log('New WebSocket connection established')

    // Create NLP service instance for this connection
    const nlpService = new NLPService(getNLPConfig())

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString())
        
        if (message.type === 'parse_input') {
          await handleParseInput(ws, nlpService, message.payload)
        } else if (message.type === 'validate_input') {
          await handleValidateInput(ws, nlpService, message.payload)
        } else if (message.type === 'get_suggestions') {
          await handleGetSuggestions(ws, nlpService, message.payload)
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

  return wss
}

/**
 * Handle real-time input parsing with incremental feedback
 */
async function handleParseInput(ws: any, nlpService: NLPService, payload: any) {
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
      const entities = await nlpService.extractEntities(input)
      
      ws.send(JSON.stringify({
        type: 'entities_detected',
        payload: {
          entities,
          input,
          timestamp: new Date().toISOString()
        }
      }))
    } else {
      // Full parsing for complete input
      const result = await nlpService.parseWorkflow(input)
      
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
async function handleValidateInput(ws: any, nlpService: NLPService, payload: any) {
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
async function handleGetSuggestions(ws: any, nlpService: NLPService, payload: any) {
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
 * Calculate input complexity score
 */
function calculateComplexity(input: string): number {
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
function generateSuggestions(input: string, cursorPosition: number): string[] {
  const suggestions: string[] = []
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

/**
 * GET endpoint to provide WebSocket connection info
 */
export async function GET() {
  // Initialize WebSocket server if not already done
  initializeWebSocketServer()
  
  return new Response(JSON.stringify({
    message: 'WebSocket server for real-time NLP feedback',
    endpoint: 'ws://localhost:8080/api/nlp/realtime',
    supportedMessages: [
      {
        type: 'parse_input',
        description: 'Parse input text with real-time feedback',
        payload: {
          input: 'string (required)',
          partial: 'boolean (optional, default: false)'
        }
      },
      {
        type: 'validate_input',
        description: 'Validate input format and content',
        payload: {
          input: 'string (required)'
        }
      },
      {
        type: 'get_suggestions',
        description: 'Get contextual suggestions for input',
        payload: {
          input: 'string (required)',
          cursorPosition: 'number (optional)'
        }
      }
    ],
    responseTypes: [
      'connected',
      'parsing_started',
      'entities_detected',
      'parsing_complete',
      'parsing_error',
      'validation_result',
      'validation_error',
      'suggestions_ready',
      'suggestions_error'
    ]
  }), {
    headers: {
      'Content-Type': 'application/json'
    }
  })
}

// Initialize WebSocket server on module load
if (typeof window === 'undefined') {
  initializeWebSocketServer()
}