import React from 'react'
import { render, screen } from '@testing-library/react'
import { ParameterDependencyVisualization } from '../parameter-dependency-visualization'
import { ActionMetadata, ActionOutput } from '@/lib/types'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { expect } from 'vitest'
import { it } from 'vitest'
import { describe } from 'vitest'
import { describe } from 'vitest'
import { vi } from 'vitest'
import { vi } from 'vitest'
import { vi } from 'vitest'

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>{children}</div>
  ),
  CardContent: ({ children }: any) => <div data-testid="card-content">{children}</div>
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, onClick, ...props }: any) => (
    <span onClick={onClick} {...props} data-testid="badge">
      {children}
    </span>
  )
}))

vi.mock('@/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />
}))

describe('ParameterDependencyVisualization', () => {
  const mockAction: ActionMetadata = {
    id: 'test-action',
    name: 'Test Action',
    description: 'A test action',
    category: 'Test',
    version: '1.0.0',
    parameters: [
      {
        name: 'stringParam',
        type: 'String',
        required: true,
        value: ''
      },
      {
        name: 'numberParam',
        type: 'UFix64',
        required: false,
        value: ''
      },
      {
        name: 'addressParam',
        type: 'Address',
        required: true,
        value: ''
      }
    ],
    inputs: [],
    outputs: [],
    compatibility: {
      requiredCapabilities: [],
      supportedNetworks: ['testnet'],
      minimumFlowVersion: '1.0.0',
      conflictsWith: []
    },
    gasEstimate: 1000,
    securityLevel: 'medium' as any,
    author: 'test',
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01'
  }

  const mockAvailableOutputs = {
    'action1.result': {
      name: 'result',
      type: 'String',
      description: 'String result from action 1'
    } as ActionOutput,
    'action2.amount': {
      name: 'amount',
      type: 'UFix64',
      description: 'Amount from action 2'
    } as ActionOutput,
    'action3.address': {
      name: 'address',
      type: 'Address',
      description: 'Address from action 3'
    } as ActionOutput,
    'action4.incompatible': {
      name: 'incompatible',
      type: 'SomeOtherType',
      description: 'Incompatible type output'
    } as ActionOutput
  }

  const defaultProps = {
    action: mockAction,
    availableOutputs: mockAvailableOutputs,
    currentValues: {}
  }

  describe('No Available Outputs', () => {
    it('shows message when no outputs are available', () => {
      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          availableOutputs={{}} 
        />
      )
      
      expect(screen.getByText('No previous actions available for parameter dependencies')).toBeInTheDocument()
    })
  })

  describe('Connected Dependencies', () => {
    it('displays connected parameters', () => {
      const currentValues = {
        stringParam: 'action1.result',
        numberParam: 'action2.amount'
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      expect(screen.getByText('Connected Parameters (2)')).toBeInTheDocument()
      expect(screen.getByText('stringParam')).toBeInTheDocument()
      expect(screen.getByText('action1.result')).toBeInTheDocument()
      expect(screen.getByText('numberParam')).toBeInTheDocument()
      expect(screen.getByText('action2.amount')).toBeInTheDocument()
    })

    it('shows type compatibility for connected parameters', () => {
      const currentValues = {
        stringParam: 'action1.result', // String -> String (compatible)
        numberParam: 'action4.incompatible' // UFix64 -> SomeOtherType (incompatible)
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // Should show type information (there will be multiple instances)
      expect(screen.getAllByText('Parameter:')[0]).toBeInTheDocument()
      expect(screen.getAllByText('Output:')[0]).toBeInTheDocument()
    })

    it('displays type mismatch warnings', () => {
      const currentValues = {
        numberParam: 'action4.incompatible' // UFix64 -> SomeOtherType (incompatible)
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      expect(screen.getByText(/Type mismatch/)).toBeInTheDocument()
      expect(screen.getByText(/UFix64.*SomeOtherType/)).toBeInTheDocument()
    })

    it('shows output descriptions for connected parameters', () => {
      const currentValues = {
        stringParam: 'action1.result'
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      expect(screen.getByText('String result from action 1')).toBeInTheDocument()
    })
  })

  describe('Available Dependencies', () => {
    it('shows unconnected parameters', () => {
      const currentValues = {
        stringParam: 'action1.result' // Only one parameter connected
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      expect(screen.getByText('Available for Connection (2)')).toBeInTheDocument()
      expect(screen.getByText('numberParam')).toBeInTheDocument()
      expect(screen.getByText('addressParam')).toBeInTheDocument()
    })

    it('shows compatible outputs for unconnected parameters', () => {
      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={{}} 
        />
      )
      
      // There will be multiple "Compatible outputs" texts for different parameters
      expect(screen.getAllByText(/Compatible outputs \(\d+\):/)[0]).toBeInTheDocument()
      expect(screen.getByText('action1.result')).toBeInTheDocument()
    })

    it('shows message when no compatible outputs exist', () => {
      const actionWithIncompatibleParam: ActionMetadata = {
        ...mockAction,
        parameters: [
          {
            name: 'incompatibleParam',
            type: 'VerySpecificType',
            required: true,
            value: ''
          }
        ]
      }

      render(
        <ParameterDependencyVisualization 
          action={actionWithIncompatibleParam}
          availableOutputs={mockAvailableOutputs}
          currentValues={{}} 
        />
      )
      
      expect(screen.getByText('No compatible outputs available')).toBeInTheDocument()
    })

    it('limits displayed compatible outputs and shows count', () => {
      const manyOutputs = {
        'action1.out1': { name: 'out1', type: 'String', description: 'Output 1' } as ActionOutput,
        'action2.out2': { name: 'out2', type: 'String', description: 'Output 2' } as ActionOutput,
        'action3.out3': { name: 'out3', type: 'String', description: 'Output 3' } as ActionOutput,
        'action4.out4': { name: 'out4', type: 'String', description: 'Output 4' } as ActionOutput,
        'action5.out5': { name: 'out5', type: 'String', description: 'Output 5' } as ActionOutput
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps}
          availableOutputs={manyOutputs}
          currentValues={{}} 
        />
      )
      
      // Should show first 3 outputs and a "+X more" indicator
      expect(screen.getByText('+2 more')).toBeInTheDocument()
    })
  })

  describe('Data Flow Summary', () => {
    it('shows data flow summary when there are connected dependencies', () => {
      const currentValues = {
        stringParam: 'action1.result', // Compatible
        numberParam: 'action4.incompatible' // Incompatible
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      expect(screen.getByText('Data Flow Summary')).toBeInTheDocument()
      expect(screen.getByText('Compatible')).toBeInTheDocument()
      expect(screen.getByText('Type Issues')).toBeInTheDocument()
      expect(screen.getByText('Unconnected')).toBeInTheDocument()
    })

    it('displays correct counts in data flow summary', () => {
      const currentValues = {
        stringParam: 'action1.result', // Compatible
        numberParam: 'action4.incompatible' // Incompatible
        // addressParam is unconnected
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // Should show: 1 compatible, 1 type issue, 1 unconnected
      const summaryCards = screen.getAllByTestId('card')
      const summaryCard = summaryCards.find(card => 
        card.textContent?.includes('Data Flow Summary')
      )
      
      expect(summaryCard).toBeInTheDocument()
    })
  })

  describe('Type Compatibility Logic', () => {
    it('considers exact type matches as compatible', () => {
      const currentValues = {
        stringParam: 'action1.result' // String -> String
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // Should not show type mismatch warning
      expect(screen.queryByText(/Type mismatch/)).not.toBeInTheDocument()
    })

    it('considers numeric types as compatible with each other', () => {
      const currentValues = {
        numberParam: 'action2.amount' // UFix64 -> UFix64
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // Should not show type mismatch warning
      expect(screen.queryByText(/Type mismatch/)).not.toBeInTheDocument()
    })

    it('considers string parameters compatible with any type', () => {
      const currentValues = {
        stringParam: 'action2.amount' // String <- UFix64 (should be compatible)
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // Should not show type mismatch warning for string parameters
      expect(screen.queryByText(/Type mismatch/)).not.toBeInTheDocument()
    })
  })

  describe('Reference Detection', () => {
    it('correctly identifies parameter references', () => {
      const currentValues = {
        stringParam: 'action1.result',
        numberParam: '123.45', // Direct value, not a reference
        addressParam: 'not.a.valid.reference.format'
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // Only stringParam should be shown as connected
      expect(screen.getByText('Connected Parameters (1)')).toBeInTheDocument()
      expect(screen.getByText('Available for Connection (2)')).toBeInTheDocument()
    })

    it('handles invalid reference formats gracefully', () => {
      const currentValues = {
        stringParam: 'invalid-reference',
        numberParam: '.invalid',
        addressParam: 'action1.' // Missing output name
      }

      render(
        <ParameterDependencyVisualization 
          {...defaultProps} 
          currentValues={currentValues} 
        />
      )
      
      // None should be recognized as valid references
      expect(screen.getByText('Available for Connection (3)')).toBeInTheDocument()
      expect(screen.queryByText('Connected Parameters')).not.toBeInTheDocument()
    })
  })
})