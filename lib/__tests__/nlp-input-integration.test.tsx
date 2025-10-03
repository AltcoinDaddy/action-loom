import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NLPInput } from '@/components/nlp-input'
import type { Workflow } from '@/lib/types'

// Mock the NLP WebSocket hook
vi.mock('@/hooks/use-nlp-websocket', () => ({
  useNLPWebSocket: () => ({
    isConnected: true,
    feedback: {
      highlights: [],
      entities: [],
      suggestions: [],
      validation: {
        hasContent: false,
        hasActions: false,
        hasTokens: false,
        complexity: 0
      },
      result: null,
      error: null,
      isProcessing: false
    },
    parseInput: vi.fn(),
    validateInput: vi.fn(),
    getSuggestions: vi.fn(),
    clearFeedback: vi.fn()
  })
}))

describe('NLP Input Integration Tests', () => {
  const mockOnWorkflowGenerated = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('renders NLP input interface correctly', () => {
    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByPlaceholderText(/describe your workflow/i)).toBeInTheDocument()
    expect(screen.getByText('Real-time feedback active')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /generate workflow/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('shows connection status indicator', () => {
    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    // Should show connected status (green dot)
    const statusIndicator = document.querySelector('.bg-green-500')
    expect(statusIndicator).toBeInTheDocument()
    expect(screen.getByText('Real-time feedback active')).toBeInTheDocument()
  })

  it('handles text input and triggers parsing', async () => {
    const user = userEvent.setup()
    
    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your workflow/i)
    
    await user.type(textarea, 'Swap 100 USDC to FLOW')
    
    expect(textarea).toHaveValue('Swap 100 USDC to FLOW')
  })

  it('shows validation indicators when content is entered', async () => {
    const user = userEvent.setup()
    
    // Mock the hook to return validation feedback
    vi.doMock('@/hooks/use-nlp-websocket', () => ({
      useNLPWebSocket: () => ({
        isConnected: true,
        feedback: {
          highlights: [],
          entities: [
            { type: 'token', value: 'USDC', confidence: 0.95 },
            { type: 'amount', value: '100', confidence: 0.98 }
          ],
          suggestions: [],
          validation: {
            hasContent: true,
            hasActions: true,
            hasTokens: true,
            complexity: 0.7
          },
          result: null,
          error: null,
          isProcessing: false
        },
        parseInput: vi.fn(),
        validateInput: vi.fn(),
        getSuggestions: vi.fn(),
        clearFeedback: vi.fn()
      })
    }))

    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your workflow/i)
    await user.type(textarea, 'Swap 100 USDC to FLOW')

    // Should show entity tags
    await waitFor(() => {
      expect(screen.getByText(/token: USDC/i)).toBeInTheDocument()
      expect(screen.getByText(/amount: 100/i)).toBeInTheDocument()
    })
  })

  it('handles workflow generation and calls callback', async () => {
    const user = userEvent.setup()
    
    // Mock successful parsing result
    vi.doMock('@/hooks/use-nlp-websocket', () => ({
      useNLPWebSocket: () => ({
        isConnected: true,
        feedback: {
          highlights: [],
          entities: [],
          suggestions: [],
          validation: {
            hasContent: true,
            hasActions: true,
            hasTokens: true,
            complexity: 0.8
          },
          result: {
            confidence: 0.9,
            steps: [
              {
                actionId: 'swap-tokens',
                actionName: 'Swap Tokens',
                parameters: { from: 'USDC', to: 'FLOW', amount: 100 },
                confidence: 0.95
              }
            ],
            ambiguities: [],
            suggestions: []
          },
          error: null,
          isProcessing: false
        },
        parseInput: vi.fn(),
        validateInput: vi.fn(),
        getSuggestions: vi.fn(),
        clearFeedback: vi.fn()
      })
    }))

    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    const textarea = screen.getByPlaceholderText(/describe your workflow/i)
    const generateButton = screen.getByRole('button', { name: /generate workflow/i })

    await user.type(textarea, 'Swap 100 USDC to FLOW')
    await user.click(generateButton)

    // Should call the workflow generation callback after processing
    await waitFor(() => {
      expect(mockOnWorkflowGenerated).toHaveBeenCalled()
    }, { timeout: 2000 })
  })

  it('handles cancel action', async () => {
    const user = userEvent.setup()
    
    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('disables generate button when no input', () => {
    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    const generateButton = screen.getByRole('button', { name: /generate workflow/i })
    expect(generateButton).toBeDisabled()
  })

  it('shows processing state', () => {
    // Mock processing state
    vi.doMock('@/hooks/use-nlp-websocket', () => ({
      useNLPWebSocket: () => ({
        isConnected: true,
        feedback: {
          highlights: [],
          entities: [],
          suggestions: [],
          validation: {
            hasContent: false,
            hasActions: false,
            hasTokens: false,
            complexity: 0
          },
          result: null,
          error: null,
          isProcessing: true
        },
        parseInput: vi.fn(),
        validateInput: vi.fn(),
        getSuggestions: vi.fn(),
        clearFeedback: vi.fn()
      })
    }))

    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Processing...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /processing.../i })).toBeDisabled()
  })

  it('shows error state', () => {
    // Mock error state
    vi.doMock('@/hooks/use-nlp-websocket', () => ({
      useNLPWebSocket: () => ({
        isConnected: true,
        feedback: {
          highlights: [],
          entities: [],
          suggestions: [],
          validation: {
            hasContent: false,
            hasActions: false,
            hasTokens: false,
            complexity: 0
          },
          result: null,
          error: 'Failed to parse input',
          isProcessing: false
        },
        parseInput: vi.fn(),
        validateInput: vi.fn(),
        getSuggestions: vi.fn(),
        clearFeedback: vi.fn()
      })
    }))

    render(
      <NLPInput
        onWorkflowGenerated={mockOnWorkflowGenerated}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Failed to parse input')).toBeInTheDocument()
  })
})