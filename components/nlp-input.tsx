"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useNLPWebSocket } from "@/hooks/use-nlp-websocket"
import type { Workflow } from "@/lib/types"

interface NLPInputProps {
  onWorkflowGenerated: (workflow: Workflow) => void
  onClose: () => void
}

export function NLPInput({ onWorkflowGenerated, onClose }: NLPInputProps) {
  const [input, setInput] = useState("")
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const highlightRef = useRef<HTMLDivElement>(null)
  
  const { 
    isConnected, 
    feedback, 
    parseInput, 
    validateInput, 
    getSuggestions, 
    clearFeedback 
  } = useNLPWebSocket()

  // Handle input changes with real-time feedback
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newInput = e.target.value
    const newCursorPosition = e.target.selectionStart
    
    setInput(newInput)
    setCursorPosition(newCursorPosition)
    
    if (newInput.trim()) {
      // Debounced real-time parsing for partial input
      const timeoutId = setTimeout(() => {
        parseInput(newInput, true)
        validateInput(newInput)
      }, 300)
      
      return () => clearTimeout(timeoutId)
    } else {
      clearFeedback()
    }
  }, [parseInput, validateInput, clearFeedback])

  // Handle cursor position changes for suggestions
  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      const newCursorPosition = textareaRef.current.selectionStart
      setCursorPosition(newCursorPosition)
      
      if (input.trim()) {
        getSuggestions(input, newCursorPosition)
      }
    }
  }, [input, getSuggestions])

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((suggestion: string) => {
    if (textareaRef.current) {
      const beforeCursor = input.slice(0, cursorPosition)
      const afterCursor = input.slice(cursorPosition)
      const newInput = beforeCursor + suggestion + afterCursor
      
      setInput(newInput)
      setShowSuggestions(false)
      
      // Focus back to textarea and set cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(
            cursorPosition + suggestion.length,
            cursorPosition + suggestion.length
          )
        }
      }, 0)
    }
  }, [input, cursorPosition])

  // Generate highlighted text with entity recognition
  const generateHighlightedText = useCallback(() => {
    if (!input || feedback.highlights.length === 0) {
      return input
    }

    let highlightedText = ''
    let lastIndex = 0

    feedback.highlights.forEach((highlight, index) => {
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
  }, [input, feedback.highlights])

  // Handle final submission
  const handleSubmit = async () => {
    if (!input.trim()) return

    // Parse complete input
    parseInput(input, false)
    
    // Wait for parsing to complete, then generate workflow
    // This is a simplified version - in practice, you'd wait for the WebSocket response
    setTimeout(() => {
      if (feedback.result) {
        // Convert NLP result to workflow format
        const mockWorkflow: Workflow = {
          nodes: feedback.result.steps.map((step, index) => ({
            id: `${index + 1}`,
            type: "action",
            position: { x: 250, y: 100 + (index * 100) },
            data: { 
              label: step.actionName, 
              type: step.actionId, 
              category: "defi",
              parameters: step.parameters
            },
          })),
          edges: feedback.result.steps.length > 1 
            ? feedback.result.steps.slice(0, -1).map((_, index) => ({
                id: `e${index + 1}-${index + 2}`,
                source: `${index + 1}`,
                target: `${index + 2}`
              }))
            : []
        }

        onWorkflowGenerated(mockWorkflow)
        setInput("")
        clearFeedback()
        onClose()
      }
    }, 1000)
  }

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  // Show/hide suggestions based on focus and content
  useEffect(() => {
    setShowSuggestions(feedback.suggestions.length > 0 && input.trim().length > 0)
  }, [feedback.suggestions, input])

  return (
    <div className="border-b border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 relative">
          {/* Connection status indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {isConnected ? 'Real-time feedback active' : 'Connecting to feedback service...'}
            </span>
            {feedback.isProcessing && (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-primary">Processing...</span>
              </div>
            )}
          </div>

          {/* Input container with highlighting overlay */}
          <div className="relative">
            {/* Highlight overlay */}
            <div
              ref={highlightRef}
              className="absolute inset-0 w-full h-full px-4 py-3 text-sm pointer-events-none overflow-hidden whitespace-pre-wrap break-words z-10"
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
              ref={textareaRef}
              value={input}
              onChange={handleInputChange}
              onSelect={handleSelectionChange}
              onScroll={handleScroll}
              placeholder="Describe your workflow in natural language... e.g., 'Swap 100 USDC to FLOW, then stake it for 30 days'"
              className="relative w-full resize-none rounded-lg border border-border bg-transparent px-4 py-3 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 z-20"
              style={{ color: feedback.highlights.length > 0 ? 'transparent' : 'inherit' }}
              rows={3}
            />
          </div>

          {/* Validation indicators */}
          {feedback.validation && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <div className={`flex items-center gap-1 ${feedback.validation.hasContent ? 'text-green-600' : 'text-red-600'}`}>
                <div className={`w-2 h-2 rounded-full ${feedback.validation.hasContent ? 'bg-green-500' : 'bg-red-500'}`} />
                Content
              </div>
              <div className={`flex items-center gap-1 ${feedback.validation.hasActions ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-2 h-2 rounded-full ${feedback.validation.hasActions ? 'bg-green-500' : 'bg-yellow-500'}`} />
                Actions
              </div>
              <div className={`flex items-center gap-1 ${feedback.validation.hasTokens ? 'text-green-600' : 'text-yellow-600'}`}>
                <div className={`w-2 h-2 rounded-full ${feedback.validation.hasTokens ? 'bg-green-500' : 'bg-yellow-500'}`} />
                Tokens
              </div>
              <div className="text-muted-foreground">
                Complexity: {Math.round(feedback.validation.complexity * 100)}%
              </div>
            </div>
          )}

          {/* Entity summary */}
          {feedback.entities.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {feedback.entities.map((entity, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ 
                    backgroundColor: `${feedback.highlights.find(h => h.entity === entity)?.color || '#6b7280'}20`,
                    color: feedback.highlights.find(h => h.entity === entity)?.color || '#6b7280'
                  }}
                >
                  {entity.type}: {entity.value}
                  <span className="text-xs opacity-70">
                    ({Math.round(entity.confidence * 100)}%)
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && feedback.suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
              {feedback.suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors border-b border-border last:border-b-0"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Error display */}
          {feedback.error && (
            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-600">{feedback.error}</p>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {feedback.entities.length > 0 
                ? `Detected ${feedback.entities.length} entities` 
                : 'Try: "Swap tokens", "Mint an NFT", "Vote on proposal #42"'
              }
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || feedback.isProcessing || !isConnected}
                className="rounded-lg bg-gradient-to-r from-secondary to-secondary/80 px-4 py-1.5 text-xs font-semibold text-white transition-all hover:shadow-lg hover:glow-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {feedback.isProcessing ? "Processing..." : "Generate Workflow"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
