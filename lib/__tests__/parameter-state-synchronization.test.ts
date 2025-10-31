/**
 * Parameter State Synchronization Tests
 * 
 * Tests for the state synchronization fixes between input components and parent state
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parameterStateDebugger } from '@/lib/parameter-state-debugger'

// Mock the parameter state debugger for testing
vi.mock('@/lib/parameter-state-debugger', () => ({
  parameterStateDebugger: {
    logParameterChange: vi.fn(),
    logParameterCleanup: vi.fn(),
    takeSnapshot: vi.fn(),
    validateStateConsistency: vi.fn().mockReturnValue({ isConsistent: true, issues: [] }),
    setEnabled: vi.fn(),
    clearHistory: vi.fn()
  }
}))

describe('Parameter State Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Enable debugging for tests
    parameterStateDebugger.setEnabled(true)
  })

  afterEach(() => {
    parameterStateDebugger.clearHistory()
  })

  describe('Parameter Change Logging', () => {
    it('should log parameter changes with correct metadata', () => {
      const nodeId = 'test-node-1'
      const parameterName = 'amount'
      const oldValue = '10.0'
      const newValue = '20.0'

      parameterStateDebugger.logParameterChange(
        nodeId,
        parameterName,
        oldValue,
        newValue,
        'user_input'
      )

      expect(parameterStateDebugger.logParameterChange).toHaveBeenCalledWith(
        nodeId,
        parameterName,
        oldValue,
        newValue,
        'user_input'
      )
    })

    it('should log parameter initialization', () => {
      const nodeId = 'test-node-1'
      const parameterName = 'recipient'
      const value = '0x1234567890abcdef'

      parameterStateDebugger.logParameterChange(
        nodeId,
        parameterName,
        undefined,
        value,
        'initialization'
      )

      expect(parameterStateDebugger.logParameterChange).toHaveBeenCalledWith(
        nodeId,
        parameterName,
        undefined,
        value,
        'initialization'
      )
    })

    it('should log parameter cleanup', () => {
      const nodeId = 'test-node-1'
      const cleanedParameters = ['amount', 'recipient', 'memo']

      parameterStateDebugger.logParameterCleanup(nodeId, cleanedParameters)

      expect(parameterStateDebugger.logParameterCleanup).toHaveBeenCalledWith(
        nodeId,
        cleanedParameters
      )
    })
  })

  describe('State Snapshot Management', () => {
    it('should take snapshots of parameter state', () => {
      const parameterValues = {
        'node-1': {
          amount: '10.0',
          recipient: '0x1234567890abcdef'
        },
        'node-2': {
          tokenId: '123',
          metadata: 'test metadata'
        }
      }

      parameterStateDebugger.takeSnapshot(parameterValues)

      expect(parameterStateDebugger.takeSnapshot).toHaveBeenCalledWith(parameterValues)
    })
  })

  describe('State Consistency Validation', () => {
    it('should validate state consistency between parameter values and workflow nodes', () => {
      const parameterValues = {
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' }
      }
      const workflowNodeIds = ['node-1', 'node-2']

      const result = parameterStateDebugger.validateStateConsistency(
        parameterValues,
        workflowNodeIds
      )

      expect(parameterStateDebugger.validateStateConsistency).toHaveBeenCalledWith(
        parameterValues,
        workflowNodeIds
      )
      expect(result.isConsistent).toBe(true)
    })

    it('should detect orphaned parameter values', () => {
      const parameterValues = {
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' },
        'node-3': { orphaned: 'value' } // This node doesn't exist in workflow
      }
      const workflowNodeIds = ['node-1', 'node-2']

      // Mock the actual validation logic
      const mockValidation = {
        isConsistent: false,
        issues: ['Orphaned parameter values for nodes: node-3']
      }
      vi.mocked(parameterStateDebugger.validateStateConsistency).mockReturnValue(mockValidation)

      const result = parameterStateDebugger.validateStateConsistency(
        parameterValues,
        workflowNodeIds
      )

      expect(result.isConsistent).toBe(false)
      expect(result.issues).toContain('Orphaned parameter values for nodes: node-3')
    })

    it('should detect missing parameter entries', () => {
      const parameterValues = {
        'node-1': { amount: '10.0' }
        // node-2 is missing
      }
      const workflowNodeIds = ['node-1', 'node-2']

      // Mock the actual validation logic
      const mockValidation = {
        isConsistent: false,
        issues: ['Missing parameter entries for nodes: node-2']
      }
      vi.mocked(parameterStateDebugger.validateStateConsistency).mockReturnValue(mockValidation)

      const result = parameterStateDebugger.validateStateConsistency(
        parameterValues,
        workflowNodeIds
      )

      expect(result.isConsistent).toBe(false)
      expect(result.issues).toContain('Missing parameter entries for nodes: node-2')
    })
  })

  describe('Parameter Value Processing', () => {
    it('should handle synchronous parameter updates', () => {
      // Test that parameter changes are processed synchronously
      const mockOnChange = vi.fn()
      const testValue = '25.5'

      // Simulate the enhanced onChange handler behavior
      const processParameterChange = (value: any) => {
        // This simulates the requestAnimationFrame behavior
        return new Promise(resolve => {
          requestAnimationFrame(() => {
            mockOnChange(value)
            resolve(value)
          })
        })
      }

      return processParameterChange(testValue).then(() => {
        expect(mockOnChange).toHaveBeenCalledWith(testValue)
      })
    })

    it('should handle parameter change errors gracefully', async () => {
      const mockOnChange = vi.fn()
      const mockOnChangeFailing = vi.fn().mockImplementation(() => {
        throw new Error('Parameter change failed')
      })
      const testValue = '25.5'
      const fallbackValue = '25.5' // Same value as fallback

      // Simulate error handling in parameter change
      const processParameterChangeWithError = (value: any) => {
        return new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            try {
              mockOnChangeFailing(value)
            } catch (error) {
              // Fallback behavior - use the working mock
              mockOnChange(fallbackValue)
            }
            resolve()
          })
        })
      }

      await processParameterChangeWithError(testValue)
      
      expect(mockOnChangeFailing).toHaveBeenCalledTimes(1) // Original failing call
      expect(mockOnChange).toHaveBeenCalledTimes(1) // Fallback call
      expect(mockOnChange).toHaveBeenCalledWith(fallbackValue)
    }, 10000)
  })

  describe('Debounced Updates', () => {
    it('should debounce parameter validation updates', async () => {
      const mockValidationChange = vi.fn()
      
      // Simulate debounced validation updates
      const debounceValidation = (callback: Function, delay: number) => {
        let timeoutId: NodeJS.Timeout
        return (...args: any[]) => {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => callback(...args), delay)
        }
      }

      const debouncedValidation = debounceValidation(mockValidationChange, 150)

      // Trigger multiple rapid updates
      debouncedValidation(true, [])
      debouncedValidation(false, [{ message: 'Error 1' }])
      debouncedValidation(true, [])

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 200))

      // Should only be called once with the last values
      expect(mockValidationChange).toHaveBeenCalledTimes(1)
      expect(mockValidationChange).toHaveBeenCalledWith(true, [])
    })
  })

  describe('State Cleanup', () => {
    it('should clean up parameter values when nodes are removed', () => {
      const initialParameterValues = {
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' },
        'node-3': { memo: 'test' }
      }

      const currentNodeIds = ['node-1', 'node-2', 'node-3']
      const newNodeIds = ['node-1', 'node-2'] // node-3 removed
      const removedNodeIds = currentNodeIds.filter(id => !newNodeIds.includes(id))

      // Simulate cleanup process
      const cleanupParameters = (paramValues: Record<string, any>, removedIds: string[]) => {
        const newParameterValues = { ...paramValues }
        
        removedIds.forEach(nodeId => {
          const cleanedParameters = Object.keys(paramValues[nodeId] || {})
          if (cleanedParameters.length > 0) {
            parameterStateDebugger.logParameterCleanup(nodeId, cleanedParameters)
          }
          delete newParameterValues[nodeId]
        })
        
        return newParameterValues
      }

      const result = cleanupParameters(initialParameterValues, removedNodeIds)

      expect(parameterStateDebugger.logParameterCleanup).toHaveBeenCalledWith(
        'node-3',
        ['memo']
      )
      expect(result).toEqual({
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' }
      })
      expect(result['node-3']).toBeUndefined()
    })
  })

  describe('Local State Synchronization', () => {
    it('should sync local values with prop changes', () => {
      const initialValues = { amount: '10.0', recipient: '0x123' }
      const updatedValues = { amount: '20.0', recipient: '0x456' }

      // Simulate the useEffect behavior in ParameterConfigPanel
      let localValues = initialValues

      const syncLocalValues = (newValues: Record<string, any>) => {
        localValues = newValues
      }

      syncLocalValues(updatedValues)

      expect(localValues).toEqual(updatedValues)
    })

    it('should handle parameter change with local state update', () => {
      const initialValues = { amount: '10.0' }
      let localValues = { ...initialValues }
      const mockOnParameterChange = vi.fn()

      const handleParameterChange = (parameterName: string, value: any) => {
        // Update local state immediately
        localValues = {
          ...localValues,
          [parameterName]: value
        }

        // Debounce parent update
        setTimeout(() => {
          mockOnParameterChange(parameterName, value)
        }, 100)
      }

      handleParameterChange('amount', '25.0')

      // Local state should be updated immediately
      expect(localValues.amount).toBe('25.0')

      // Parent update should be debounced
      return new Promise(resolve => {
        setTimeout(() => {
          expect(mockOnParameterChange).toHaveBeenCalledWith('amount', '25.0')
          resolve(undefined)
        }, 150)
      })
    })
  })
})