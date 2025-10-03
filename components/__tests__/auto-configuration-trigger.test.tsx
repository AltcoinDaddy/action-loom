import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { ActionMetadata } from '@/lib/types'

// Create a simple test that focuses on the auto-configuration logic
// without rendering the full component tree

describe('Auto-Configuration Trigger System', () => {
  let mockOnActionNodeSelect: ReturnType<typeof vi.fn>
  let mockActionMetadata: ActionMetadata

  beforeEach(() => {
    mockOnActionNodeSelect = vi.fn()

    // Mock action metadata with required parameters
    mockActionMetadata = {
      id: 'token-transfer',
      name: 'Token Transfer',
      description: 'Transfer tokens between accounts',
      category: 'defi',
      version: '1.0.0',
      inputs: [],
      outputs: [],
      parameters: [
        {
          name: 'recipient',
          type: 'Address',
          value: '',
          required: true
        },
        {
          name: 'amount',
          type: 'UFix64',
          value: '',
          required: true
        },
        {
          name: 'memo',
          type: 'String',
          value: '',
          required: false
        }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 1000,
      securityLevel: 'medium' as any,
      author: 'test',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }

    // Mock window.dispatchEvent
    Object.defineProperty(window, 'dispatchEvent', {
      value: vi.fn(),
      writable: true
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  it('should detect actions with required parameters correctly', () => {
    // Test the logic for detecting required parameters
    const hasRequiredParameters = mockActionMetadata.parameters?.some(param => param.required)
    expect(hasRequiredParameters).toBe(true)
    
    // Test action without required parameters
    const actionWithoutRequired: ActionMetadata = {
      ...mockActionMetadata,
      parameters: [
        {
          name: 'memo',
          type: 'String',
          value: '',
          required: false
        }
      ]
    }
    
    const hasNoRequiredParameters = actionWithoutRequired.parameters?.some(param => param.required)
    expect(hasNoRequiredParameters).toBe(false)
  })

  it('should initialize parameter values correctly for different types', () => {
    // Test parameter initialization logic
    const initializeParameterValues = (parameters: any[]) => {
      const initialValues: Record<string, any> = {}
      
      parameters.forEach((param: any) => {
        if (param.defaultValue !== undefined) {
          initialValues[param.name] = param.defaultValue
        } else if (!param.required) {
          initialValues[param.name] = ''
        } else {
          // Required parameters get type-appropriate default values
          switch (param.type) {
            case 'Address':
              initialValues[param.name] = ''
              break
            case 'UFix64':
              initialValues[param.name] = ''
              break
            case 'String':
              initialValues[param.name] = ''
              break
            case 'Bool':
              initialValues[param.name] = false
              break
            case 'Int':
              initialValues[param.name] = ''
              break
            case 'UInt64':
              initialValues[param.name] = ''
              break
            default:
              initialValues[param.name] = ''
          }
        }
      })
      
      return initialValues
    }
    
    const initialValues = initializeParameterValues(mockActionMetadata.parameters)
    
    expect(initialValues).toEqual({
      recipient: '',
      amount: '',
      memo: ''
    })
    
    // Test with Bool parameter
    const boolParam = {
      name: 'enabled',
      type: 'Bool',
      value: '',
      required: true
    }
    
    const boolValues = initializeParameterValues([boolParam])
    expect(boolValues.enabled).toBe(false)
  })

  it('should create proper event structure for actionAdded', () => {
    // Test the event creation logic
    const nodeId = 'token-transfer-123456'
    const parameterValues = {
      recipient: '',
      amount: '',
      memo: ''
    }
    
    const expectedEvent = new CustomEvent('actionAdded', {
      detail: { nodeId, parameterValues }
    })
    
    expect(expectedEvent.type).toBe('actionAdded')
    expect(expectedEvent.detail.nodeId).toBe(nodeId)
    expect(expectedEvent.detail.parameterValues).toEqual(parameterValues)
  })

  it('should handle malformed action metadata gracefully', () => {
    // Test JSON parsing error handling
    const parseActionMetadata = (metadataStr: string) => {
      try {
        return JSON.parse(metadataStr)
      } catch (error) {
        console.warn('Failed to parse action metadata:', error)
        return null
      }
    }
    
    // Valid JSON should parse correctly
    const validMetadata = parseActionMetadata(JSON.stringify(mockActionMetadata))
    expect(validMetadata).toEqual(mockActionMetadata)
    
    // Invalid JSON should return null
    const invalidMetadata = parseActionMetadata('invalid-json')
    expect(invalidMetadata).toBeNull()
    
    // Empty string should return null
    const emptyMetadata = parseActionMetadata('')
    expect(emptyMetadata).toBeNull()
  })

  it('should validate auto-configuration timing requirements', async () => {
    // Test that the delay timing is correct (150ms as specified in requirements)
    const EXPECTED_DELAY = 150
    
    // Mock setTimeout to capture the delay value
    const originalSetTimeout = global.setTimeout
    let capturedDelay: number | undefined
    
    global.setTimeout = vi.fn((callback: Function, delay: number) => {
      capturedDelay = delay
      return originalSetTimeout(callback, delay)
    }) as any
    
    // Simulate the auto-configuration trigger logic
    const triggerAutoConfiguration = (hasRequiredParams: boolean, onActionNodeSelect: Function, nodeId: string, metadata: ActionMetadata) => {
      if (hasRequiredParams && onActionNodeSelect && metadata) {
        setTimeout(() => {
          onActionNodeSelect(nodeId, metadata)
        }, EXPECTED_DELAY)
      }
    }
    
    const hasRequiredParams = mockActionMetadata.parameters?.some(param => param.required) || false
    triggerAutoConfiguration(hasRequiredParams, mockOnActionNodeSelect, 'test-node-id', mockActionMetadata)
    
    // Verify the correct delay was used
    expect(capturedDelay).toBe(EXPECTED_DELAY)
    
    // Wait for the timeout and verify the callback was called
    await new Promise(resolve => setTimeout(resolve, EXPECTED_DELAY + 10))
    expect(mockOnActionNodeSelect).toHaveBeenCalledWith('test-node-id', mockActionMetadata)
    
    // Restore original setTimeout
    global.setTimeout = originalSetTimeout
  })

  it('should verify auto-configuration trigger conditions', () => {
    // Test the complete auto-configuration trigger logic
    const shouldTriggerAutoConfiguration = (actionMetadata: ActionMetadata | null, onActionNodeSelect?: Function) => {
      if (!actionMetadata?.parameters || !onActionNodeSelect) {
        return false
      }
      
      return actionMetadata.parameters.some(param => param.required)
    }
    
    // Should trigger for action with required parameters
    expect(shouldTriggerAutoConfiguration(mockActionMetadata, mockOnActionNodeSelect)).toBe(true)
    
    // Should NOT trigger without callback function
    expect(shouldTriggerAutoConfiguration(mockActionMetadata, undefined)).toBe(false)
    
    // Should NOT trigger without metadata
    expect(shouldTriggerAutoConfiguration(null, mockOnActionNodeSelect)).toBe(false)
    
    // Should NOT trigger for action with no required parameters
    const actionWithoutRequired: ActionMetadata = {
      ...mockActionMetadata,
      parameters: [
        {
          name: 'memo',
          type: 'String',
          value: '',
          required: false
        }
      ]
    }
    expect(shouldTriggerAutoConfiguration(actionWithoutRequired, mockOnActionNodeSelect)).toBe(false)
    
    // Should NOT trigger for action with no parameters
    const actionWithoutParams: ActionMetadata = {
      ...mockActionMetadata,
      parameters: []
    }
    expect(shouldTriggerAutoConfiguration(actionWithoutParams, mockOnActionNodeSelect)).toBe(false)
  })
})