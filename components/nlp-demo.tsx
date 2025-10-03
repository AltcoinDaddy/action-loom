"use client"

import { useState } from "react"
import { useNLPWebSocket } from "@/hooks/use-nlp-websocket"

export function NLPDemo() {
  const [input, setInput] = useState("")
  const { isConnected, feedback, parseInput, validateInput, getSuggestions, clearFeedback } = useNLPWebSocket()

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newInput = e.target.value
    setInput(newInput)
    
    if (newInput.trim()) {
      parseInput(newInput, true)
      validateInput(newInput)
      getSuggestions(newInput, e.target.selectionStart)
    } else {
      clearFeedback()
    }
  }

  const generateHighlightedText = () => {
    if (!input || feedback.highlights.length === 0) {
      return input
    }

    let highlightedText = ''
    let lastIndex = 0

    feedback.highlights.forEach((highlight) => {
      // Add text before highlight
      highlightedText += input.slice(lastIndex, highlight.startIndex)
      
      // Add highlighted entity
      const entityText = input.slice(highlight.startIndex, highlight.endIndex)
      highlightedText += `<span class="entity-highlight" style="background-color: ${highlight.color}20; color: ${highlight.color}; border-bottom: 2px solid ${highlight.color};" title="${highlight.entity.type}: ${highlight.entity.value} (${Math.round(highlight.entity.confidence * 100)}%)">${entityText}</span>`
      
      lastIndex = highlight.endIndex
    })

    // Add remaining text
    highlightedText += input.slice(lastIndex)
    
    return highlightedText
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-4">NLP Real-time Feedback Demo</h2>
      
      {/* Connection Status */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className="text-sm text-muted-foreground">
          {isConnected ? 'Connected to real-time feedback service' : 'Disconnected'}
        </span>
        {feedback.isProcessing && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 border border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-primary">Processing...</span>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="relative mb-4">
        {/* Highlight overlay */}
        <div
          className="absolute inset-0 w-full h-full px-4 py-3 text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words z-10 border border-transparent rounded-lg"
          style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            letterSpacing: 'inherit',
            wordSpacing: 'inherit'
          }}
          dangerouslySetInnerHTML={{ __html: generateHighlightedText() }}
        />
        
        {/* Actual textarea */}
        <textarea
          value={input}
          onChange={handleInputChange}
          placeholder="Try typing: 'Swap 100 USDC to FLOW' or 'Stake 50 FLOW for rewards'"
          className="relative w-full resize-none rounded-lg border border-border bg-transparent px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 z-20"
          style={{ color: feedback.highlights.length > 0 ? 'transparent' : 'inherit' }}
          rows={4}
        />
      </div>

      {/* Validation Indicators */}
      {feedback.validation && (
        <div className="mb-4 p-3 bg-card border border-border rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Input Validation</h3>
          <div className="flex flex-wrap gap-3 text-xs">
            <div className={`flex items-center gap-1 ${feedback.validation.hasContent ? 'text-green-600' : 'text-red-600'}`}>
              <div className={`w-2 h-2 rounded-full ${feedback.validation.hasContent ? 'bg-green-500' : 'bg-red-500'}`} />
              Has Content
            </div>
            <div className={`flex items-center gap-1 ${feedback.validation.hasActions ? 'text-green-600' : 'text-yellow-600'}`}>
              <div className={`w-2 h-2 rounded-full ${feedback.validation.hasActions ? 'bg-green-500' : 'bg-yellow-500'}`} />
              Has Actions
            </div>
            <div className={`flex items-center gap-1 ${feedback.validation.hasTokens ? 'text-green-600' : 'text-yellow-600'}`}>
              <div className={`w-2 h-2 rounded-full ${feedback.validation.hasTokens ? 'bg-green-500' : 'bg-yellow-500'}`} />
              Has Tokens
            </div>
            <div className={`flex items-center gap-1 ${feedback.validation.hasNumbers ? 'text-green-600' : 'text-yellow-600'}`}>
              <div className={`w-2 h-2 rounded-full ${feedback.validation.hasNumbers ? 'bg-green-500' : 'bg-yellow-500'}`} />
              Has Numbers
            </div>
            <div className="text-muted-foreground">
              Complexity: {Math.round(feedback.validation.complexity * 100)}%
            </div>
          </div>
        </div>
      )}

      {/* Detected Entities */}
      {feedback.entities.length > 0 && (
        <div className="mb-4 p-3 bg-card border border-border rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Detected Entities ({feedback.entities.length})</h3>
          <div className="flex flex-wrap gap-2">
            {feedback.entities.map((entity, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                style={{ 
                  backgroundColor: `${feedback.highlights.find(h => h.entity === entity)?.color || '#6b7280'}20`,
                  color: feedback.highlights.find(h => h.entity === entity)?.color || '#6b7280'
                }}
              >
                <span className="font-semibold">{entity.type}:</span>
                {entity.value}
                <span className="text-xs opacity-70">
                  ({Math.round(entity.confidence * 100)}%)
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {feedback.suggestions.length > 0 && (
        <div className="mb-4 p-3 bg-card border border-border rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Suggestions</h3>
          <div className="flex flex-wrap gap-2">
            {feedback.suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setInput(prev => prev + ' ' + suggestion)}
                className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Parsing Result */}
      {feedback.result && (
        <div className="mb-4 p-3 bg-card border border-border rounded-lg">
          <h3 className="text-sm font-semibold mb-2">Parsing Result</h3>
          <div className="text-xs text-muted-foreground mb-2">
            Confidence: {Math.round(feedback.result.confidence * 100)}%
          </div>
          <div className="space-y-2">
            {feedback.result.steps.map((step, index) => (
              <div key={index} className="p-2 bg-muted rounded text-xs">
                <div className="font-semibold">{step.actionName}</div>
                <div className="text-muted-foreground">ID: {step.actionId}</div>
                <div className="text-muted-foreground">
                  Confidence: {Math.round(step.confidence * 100)}%
                </div>
                {Object.keys(step.parameters).length > 0 && (
                  <div className="mt-1">
                    <div className="font-medium">Parameters:</div>
                    <pre className="text-xs">{JSON.stringify(step.parameters, null, 2)}</pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Display */}
      {feedback.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-semibold text-red-800 mb-1">Error</h3>
          <p className="text-xs text-red-600">{feedback.error}</p>
        </div>
      )}

      {/* Clear Button */}
      <button
        onClick={() => {
          setInput("")
          clearFeedback()
        }}
        className="px-4 py-2 text-sm bg-muted hover:bg-muted/80 rounded-lg transition-colors"
      >
        Clear All
      </button>
    </div>
  )
}