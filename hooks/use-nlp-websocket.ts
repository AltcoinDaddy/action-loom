import { useEffect, useRef, useState, useCallback } from 'react'
import type { Entity, NLPResult } from '@/lib/types'

export interface NLPWebSocketMessage {
  type: string
  payload: any
}

export interface EntityHighlight {
  entity: Entity
  startIndex: number
  endIndex: number
  color: string
}

export interface ValidationResult {
  length: boolean
  hasContent: boolean
  hasNumbers: boolean
  hasTokens: boolean
  hasActions: boolean
  complexity: number
}

export interface NLPFeedback {
  entities: Entity[]
  highlights: EntityHighlight[]
  suggestions: string[]
  validation: ValidationResult | null
  isProcessing: boolean
  error: string | null
  result: NLPResult | null
}

export function useNLPWebSocket(url: string = 'ws://localhost:8080') {
  const ws = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [feedback, setFeedback] = useState<NLPFeedback>({
    entities: [],
    highlights: [],
    suggestions: [],
    validation: null,
    isProcessing: false,
    error: null,
    result: null
  })

  // Entity type to color mapping
  const entityColors = {
    action: '#3b82f6', // blue
    amount: '#10b981', // green
    token: '#f59e0b', // amber
    address: '#8b5cf6', // purple
    parameter: '#ef4444' // red
  }

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    try {
      ws.current = new WebSocket(url)

      ws.current.onopen = () => {
        console.log('NLP WebSocket connected')
        setIsConnected(true)
        setFeedback(prev => ({ ...prev, error: null }))
      }

      ws.current.onmessage = (event) => {
        try {
          const message: NLPWebSocketMessage = JSON.parse(event.data)
          handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.current.onclose = () => {
        console.log('NLP WebSocket disconnected')
        setIsConnected(false)
      }

      ws.current.onerror = (error) => {
        console.error('NLP WebSocket error:', error)
        setFeedback(prev => ({ 
          ...prev, 
          error: 'WebSocket connection error',
          isProcessing: false 
        }))
      }
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error)
      setFeedback(prev => ({ 
        ...prev, 
        error: 'Failed to connect to real-time feedback service',
        isProcessing: false 
      }))
    }
  }, [url])

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close()
      ws.current = null
    }
    setIsConnected(false)
  }, [])

  const sendMessage = useCallback((message: NLPWebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket not connected, attempting to reconnect...')
      connect()
    }
  }, [connect])

  const handleMessage = useCallback((message: NLPWebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('NLP WebSocket ready:', message.payload.message)
        break

      case 'parsing_started':
        setFeedback(prev => ({
          ...prev,
          isProcessing: true,
          error: null
        }))
        break

      case 'entities_detected':
        const entities = message.payload.entities || []
        const highlights = createEntityHighlights(entities, message.payload.input)
        
        setFeedback(prev => ({
          ...prev,
          entities,
          highlights,
          isProcessing: true
        }))
        break

      case 'parsing_complete':
        const result = message.payload.result
        const completeEntities = result.steps.flatMap((step: any) => 
          step.metadata?.entities || []
        )
        const completeHighlights = createEntityHighlights(completeEntities, message.payload.input)
        
        setFeedback(prev => ({
          ...prev,
          result,
          entities: completeEntities,
          highlights: completeHighlights,
          isProcessing: false,
          error: null
        }))
        break

      case 'parsing_error':
        setFeedback(prev => ({
          ...prev,
          error: message.payload.error,
          isProcessing: false
        }))
        break

      case 'validation_result':
        setFeedback(prev => ({
          ...prev,
          validation: message.payload.validation
        }))
        break

      case 'validation_error':
        setFeedback(prev => ({
          ...prev,
          error: message.payload.error
        }))
        break

      case 'suggestions_ready':
        setFeedback(prev => ({
          ...prev,
          suggestions: message.payload.suggestions || []
        }))
        break

      case 'suggestions_error':
        console.warn('Suggestions error:', message.payload.error)
        break

      case 'error':
        setFeedback(prev => ({
          ...prev,
          error: message.payload.message,
          isProcessing: false
        }))
        break

      default:
        console.log('Unknown message type:', message.type)
    }
  }, [])

  const createEntityHighlights = useCallback((entities: Entity[], input: string): EntityHighlight[] => {
    return entities.map(entity => ({
      entity,
      startIndex: entity.position[0],
      endIndex: entity.position[1],
      color: entityColors[entity.type] || '#6b7280'
    })).sort((a, b) => a.startIndex - b.startIndex)
  }, [])

  // API methods
  const parseInput = useCallback((input: string, partial: boolean = false) => {
    sendMessage({
      type: 'parse_input',
      payload: { input, partial }
    })
  }, [sendMessage])

  const validateInput = useCallback((input: string) => {
    sendMessage({
      type: 'validate_input',
      payload: { input }
    })
  }, [sendMessage])

  const getSuggestions = useCallback((input: string, cursorPosition?: number) => {
    sendMessage({
      type: 'get_suggestions',
      payload: { input, cursorPosition }
    })
  }, [sendMessage])

  const clearFeedback = useCallback(() => {
    setFeedback({
      entities: [],
      highlights: [],
      suggestions: [],
      validation: null,
      isProcessing: false,
      error: null,
      result: null
    })
  }, [])

  // Auto-connect on mount
  useEffect(() => {
    connect()
    return () => disconnect()
  }, [connect, disconnect])

  return {
    isConnected,
    feedback,
    parseInput,
    validateInput,
    getSuggestions,
    clearFeedback,
    connect,
    disconnect
  }
}