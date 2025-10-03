import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { 
  DataFlowConnectionIndicator, 
  DataFlowConnectionsList 
} from '../data-flow-connection-indicator'
import { ParameterConnection } from '@/lib/data-flow-analyzer'

describe('DataFlowConnectionIndicator', () => {
  const mockConnection: ParameterConnection = {
    id: 'action-1.amountOut->action-2.amount',
    sourceActionId: 'action-1',
    sourceOutputName: 'amountOut',
    targetActionId: 'action-2',
    targetParameterName: 'amount',
    sourceType: 'UFix64',
    targetType: 'UFix64',
    isTypeCompatible: true,
    connectionStrength: 0.9
  }

  const mockIncompatibleConnection: ParameterConnection = {
    id: 'action-1.transactionId->action-2.amount',
    sourceActionId: 'action-1',
    sourceOutputName: 'transactionId',
    targetActionId: 'action-2',
    targetParameterName: 'amount',
    sourceType: 'String',
    targetType: 'UFix64',
    isTypeCompatible: false,
    connectionStrength: 0.6,
    transformationSuggestion: 'Parse string as decimal number'
  }

  describe('Component Rendering', () => {
    it('renders connection indicator with basic information', () => {
      render(<DataFlowConnectionIndicator connection={mockConnection} />)

      expect(screen.getByText('action-1')).toBeInTheDocument()
      expect(screen.getByText('action-2')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
    })

    it('shows type compatibility indicator for compatible types', () => {
      render(<DataFlowConnectionIndicator connection={mockConnection} />)

      // Should show green checkmark for compatible types
      const checkIcon = document.querySelector('.text-green-500')
      expect(checkIcon).toBeInTheDocument()
    })

    it('shows type compatibility warning for incompatible types', () => {
      render(<DataFlowConnectionIndicator connection={mockIncompatibleConnection} />)

      // Should show yellow warning for incompatible types
      const warningIcon = document.querySelector('.text-yellow-500')
      expect(warningIcon).toBeInTheDocument()
    })

    it('displays connection strength with appropriate color', () => {
      render(<DataFlowConnectionIndicator connection={mockConnection} />)

      expect(screen.getByText('90%')).toBeInTheDocument()
      
      // High strength should show green
      const strengthIcon = document.querySelector('.text-green-500')
      expect(strengthIcon).toBeInTheDocument()
    })

    it('shows details when showDetails is true', () => {
      render(<DataFlowConnectionIndicator connection={mockConnection} showDetails />)

      expect(screen.getAllByText('UFix64')).toHaveLength(2) // Source and target types
    })

    it('shows transformation suggestion when available', () => {
      render(<DataFlowConnectionIndicator connection={mockIncompatibleConnection} showDetails />)

      expect(screen.getByText(/Parse string as decimal number/)).toBeInTheDocument()
    })
  })

  describe('Connection Strength Colors', () => {
    it('shows green for high strength connections', () => {
      const highStrengthConnection = { ...mockConnection, connectionStrength: 0.9 }
      render(<DataFlowConnectionIndicator connection={highStrengthConnection} />)

      const strengthIcon = document.querySelector('.text-green-500')
      expect(strengthIcon).toBeInTheDocument()
    })

    it('shows yellow for medium strength connections', () => {
      const mediumStrengthConnection = { ...mockConnection, connectionStrength: 0.6 }
      render(<DataFlowConnectionIndicator connection={mediumStrengthConnection} />)

      const strengthIcon = document.querySelector('.text-yellow-500')
      expect(strengthIcon).toBeInTheDocument()
    })

    it('shows red for low strength connections', () => {
      const lowStrengthConnection = { ...mockConnection, connectionStrength: 0.3 }
      render(<DataFlowConnectionIndicator connection={lowStrengthConnection} />)

      const strengthIcon = document.querySelector('.text-red-500')
      expect(strengthIcon).toBeInTheDocument()
    })
  })

  describe('Type Compatibility Styling', () => {
    it('applies green styling for compatible connections', () => {
      render(<DataFlowConnectionIndicator connection={mockConnection} />)

      const container = document.querySelector('.border-green-200')
      expect(container).toBeInTheDocument()
    })

    it('applies yellow styling for incompatible connections', () => {
      render(<DataFlowConnectionIndicator connection={mockIncompatibleConnection} />)

      const container = document.querySelector('.border-yellow-200')
      expect(container).toBeInTheDocument()
    })
  })
})

describe('DataFlowConnectionsList', () => {
  const mockConnections: ParameterConnection[] = [
    {
      id: 'connection-1',
      sourceActionId: 'action-1',
      sourceOutputName: 'output1',
      targetActionId: 'action-2',
      targetParameterName: 'param1',
      sourceType: 'String',
      targetType: 'String',
      isTypeCompatible: true,
      connectionStrength: 0.8
    },
    {
      id: 'connection-2',
      sourceActionId: 'action-2',
      sourceOutputName: 'output2',
      targetActionId: 'action-3',
      targetParameterName: 'param2',
      sourceType: 'UFix64',
      targetType: 'UFix64',
      isTypeCompatible: true,
      connectionStrength: 0.9
    },
    {
      id: 'connection-3',
      sourceActionId: 'action-3',
      sourceOutputName: 'output3',
      targetActionId: 'action-4',
      targetParameterName: 'param3',
      sourceType: 'Address',
      targetType: 'String',
      isTypeCompatible: false,
      connectionStrength: 0.5
    }
  ]

  describe('Component Rendering', () => {
    it('renders all connections when count is within limit', () => {
      render(<DataFlowConnectionsList connections={mockConnections} />)

      expect(screen.getByText('action-1')).toBeInTheDocument()
      expect(screen.getAllByText('action-2')).toHaveLength(2) // Appears as source and target
      expect(screen.getAllByText('action-3')).toHaveLength(2) // Appears as source and target
    })

    it('shows empty state when no connections provided', () => {
      render(<DataFlowConnectionsList connections={[]} />)

      expect(screen.getByText('No data flow connections detected')).toBeInTheDocument()
    })

    it('limits displayed connections and shows remaining count', () => {
      const manyConnections = Array.from({ length: 8 }, (_, i) => ({
        ...mockConnections[0],
        id: `connection-${i}`,
        sourceActionId: `action-${i}`,
        targetActionId: `action-${i + 1}`
      }))

      render(<DataFlowConnectionsList connections={manyConnections} maxConnections={5} />)

      expect(screen.getByText('+3 more connections')).toBeInTheDocument()
    })

    it('respects custom maxConnections prop', () => {
      render(<DataFlowConnectionsList connections={mockConnections} maxConnections={2} />)

      expect(screen.getByText('action-1')).toBeInTheDocument()
      expect(screen.getAllByText('action-2')).toHaveLength(2) // First connection source and target
      expect(screen.getByText('+1 more connections')).toBeInTheDocument()
    })
  })

  describe('Connection Details', () => {
    it('shows details for all connections by default', () => {
      render(<DataFlowConnectionsList connections={mockConnections} />)

      // Should show type information for connections
      expect(screen.getAllByText('String').length).toBeGreaterThan(0)
      expect(screen.getAllByText('UFix64').length).toBeGreaterThan(0)
    })

    it('displays connection strengths', () => {
      render(<DataFlowConnectionsList connections={mockConnections} />)

      expect(screen.getByText('80%')).toBeInTheDocument()
      expect(screen.getByText('90%')).toBeInTheDocument()
      expect(screen.getByText('50%')).toBeInTheDocument()
    })
  })
})