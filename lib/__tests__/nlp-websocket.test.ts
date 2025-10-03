import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import WebSocket from 'ws'

describe('NLP WebSocket Real-time Feedback', () => {
  let ws: WebSocket
  const WS_URL = 'ws://localhost:8080'

  beforeAll(async () => {
    // Wait a bit for the WebSocket server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000))
  })

  afterAll(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close()
    }
  })

  it('should connect to WebSocket server', (done) => {
    ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN)
      done()
    })

    ws.on('error', (error) => {
      console.error('WebSocket connection error:', error)
      done(error)
    })
  })

  it('should receive welcome message on connection', (done) => {
    ws = new WebSocket(WS_URL)

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'connected') {
        expect(message.payload.message).toBe('Real-time NLP feedback connected')
        expect(message.payload.timestamp).toBeDefined()
        done()
      }
    })

    ws.on('error', done)
  })

  it('should handle parse_input message for partial input', (done) => {
    ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'parse_input',
        payload: {
          input: 'Swap 100 USDC',
          partial: true
        }
      }))
    })

    let messagesReceived = 0
    const expectedMessages = ['parsing_started', 'entities_detected']

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'connected') return // Skip welcome message

      if (expectedMessages.includes(message.type)) {
        messagesReceived++

        if (message.type === 'parsing_started') {
          expect(message.payload.input).toBe('Swap 100 USDC')
        }

        if (message.type === 'entities_detected') {
          expect(message.payload.entities).toBeDefined()
          expect(Array.isArray(message.payload.entities)).toBe(true)
          
          // Should detect amount and action entities
          const entityTypes = message.payload.entities.map((e: any) => e.type)
          expect(entityTypes).toContain('amount')
          expect(entityTypes).toContain('action')
        }

        if (messagesReceived === expectedMessages.length) {
          done()
        }
      }
    })

    ws.on('error', done)
  })

  it('should handle validate_input message', (done) => {
    ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'validate_input',
        payload: {
          input: 'Swap 100 USDC to FLOW'
        }
      }))
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'validation_result') {
        expect(message.payload.validation).toBeDefined()
        expect(message.payload.validation.hasContent).toBe(true)
        expect(message.payload.validation.hasNumbers).toBe(true)
        expect(message.payload.validation.hasTokens).toBe(true)
        expect(message.payload.validation.hasActions).toBe(true)
        expect(message.payload.validation.complexity).toBeGreaterThan(0)
        done()
      }
    })

    ws.on('error', done)
  })

  it('should handle get_suggestions message', (done) => {
    ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'get_suggestions',
        payload: {
          input: 'Swap 100 USDC',
          cursorPosition: 13
        }
      }))
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'suggestions_ready') {
        expect(message.payload.suggestions).toBeDefined()
        expect(Array.isArray(message.payload.suggestions)).toBe(true)
        expect(message.payload.suggestions.length).toBeGreaterThan(0)
        
        // Should suggest completion for swap action
        const suggestions = message.payload.suggestions
        expect(suggestions.some((s: string) => s.includes('to'))).toBe(true)
        done()
      }
    })

    ws.on('error', done)
  })

  it('should handle invalid message format gracefully', (done) => {
    ws = new WebSocket(WS_URL)

    ws.on('open', () => {
      ws.send('invalid json')
    })

    ws.on('message', (data) => {
      const message = JSON.parse(data.toString())
      
      if (message.type === 'error') {
        expect(message.payload.message).toBe('Invalid message format')
        expect(message.payload.error).toBeDefined()
        done()
      }
    })

    ws.on('error', done)
  })
})