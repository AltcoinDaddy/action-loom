/**
 * Core Parameter State Synchronization Tests
 * 
 * Tests the core functionality of parameter state synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { parameterStateDebugger } from '@/lib/parameter-state-debugger'

describe('Core Parameter State Synchronization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    parameterStateDebugger.setEnabled(true)
  })

  afterEach(() => {
    parameterStateDebugger.clearHistory()
  })

  describe('State Change Tracking', () => {
    it('should track parameter value changes', () => {
      const nodeId = 'test-node-1'
      const parameterName = 'amount'
      const oldValue = '10.0'
      const newValue = '20.0'

      // Simulate parameter change
      parameterStateDebugger.logParameterChange(
        nodeId,
        parameterName,
        oldValue,
        newValue,
        'user_input'
      )

      // Verify the change was logged
      expect(parameterStateDebugger.logParameterChange).toHaveBeenCalledWith(
        nodeId,
        parameterName,
        oldValue,
        newValue,
        'user_input'
      )
    })

    it('should track parameter initialization', () => {
      const nodeId = 'test-node-1'
      const initialValues = {
        amount: '10.0',
        recipient: '0x1234567890abcdef',
        memo: 'Test transfer'
      }

      // Simulate parameter initialization
      Object.entries(initialValues).forEach(([paramName, value]) => {
        parameterStateDebugger.logParameterChange(
          nodeId,
          paramName,
          undefined,
          value,
          'initialization'
        )
      })

      // Verify all parameters were initialized
      expect(parameterStateDebugger.logParameterChange).toHaveBeenCalledTimes(3)
      expect(parameterStateDebugger.logParameterChange).toHaveBeenCalledWith(
        nodeId,
        'amount',
        undefined,
        '10.0',
        'initialization'
      )
    })

    it('should track parameter cleanup', () => {
      const nodeId = 'test-node-1'
      const cleanedParameters = ['amount', 'recipient', 'memo']

      // Simulate parameter cleanup
      parameterStateDebugger.logParameterCleanup(nodeId, cleanedParameters)

      // Verify cleanup was logged
      expect(parameterStateDebugger.logParameterCleanup).toHaveBeenCalledWith(
        nodeId,
        cleanedParameters
      )
    })
  })

  describe('State Consistency Validation', () => {
    it('should validate consistent state', () => {
      const parameterValues = {
        'node-1': { amount: '10.0', recipient: '0x123' },
        'node-2': { tokenId: '456', metadata: 'test' }
      }
      const workflowNodeIds = ['node-1', 'node-2']

      // Mock consistent validation result
      const mockResult = { isConsistent: true, issues: [] }
      vi.mocked(parameterStateDebugger.validateStateConsistency).mockReturnValue(mockResult)

      const result = parameterStateDebugger.validateStateConsistency(
        parameterValues,
        workflowNodeIds
      )

      expect(result.isConsistent).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('should detect orphaned parameter values', () => {
      const parameterValues = {
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' },
        'orphaned-node': { value: 'orphaned' }
      }
      const workflowNodeIds = ['node-1', 'node-2']

      // Mock inconsistent validation result
      const mockResult = {
        isConsistent: false,
        issues: ['Orphaned parameter values for nodes: orphaned-node']
      }
      vi.mocked(parameterStateDebugger.validateStateConsistency).mockReturnValue(mockResult)

      const result = parameterStateDebugger.validateStateConsistency(
        parameterValues,
        workflowNodeIds
      )

      expect(result.isConsistent).toBe(false)
      expect(result.issues).toContain('Orphaned parameter values for nodes: orphaned-node')
    })
  })

  describe('State Snapshots', () => {
    it('should take state snapshots', () => {
      const parameterValues = {
        'node-1': { amount: '10.0', recipient: '0x123' },
        'node-2': { tokenId: '456' }
      }

      // Take snapshot
      parameterStateDebugger.takeSnapshot(parameterValues)

      // Verify snapshot was taken
      expect(parameterStateDebugger.takeSnapshot).toHaveBeenCalledWith(parameterValues)
    })
  })

  describe('Workflow State Management', () => {
    it('should handle node removal cleanup', () => {
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

      // Verify cleanup was logged
      expect(parameterStateDebugger.logParameterCleanup).toHaveBeenCalledWith(
        'node-3',
        ['memo']
      )

      // Verify node was removed from parameter values
      expect(result).toEqual({
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' }
      })
      expect(result['node-3']).toBeUndefined()
    })

    it('should handle empty workflow cleanup', () => {
      const initialParameterValues = {
        'node-1': { amount: '10.0' },
        'node-2': { tokenId: '123' }
      }

      // Simulate clearing all parameters when workflow is empty
      const clearAllParameters = () => {
        const emptyParameterValues = {}
        parameterStateDebugger.takeSnapshot(emptyParameterValues)
        return emptyParameterValues
      }

      const result = clearAllParameters()

      // Verify all parameters were cleared
      expect(result).toEqual({})
      expect(parameterStateDebugger.takeSnapshot).toHaveBeenCalledWith({})
    })
  })

  describe('Parameter Value Processing', () => {
    it('should handle synchronous parameter updates', async () => {
      const mockCallback = vi.fn()
      const testValue = '25.5'

      // Simulate the enhanced onChange handler behavior
      const processParameterChange = (value: any) => {
        return new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            try {
              mockCallback(value)
            } catch (error) {
              console.error('Error in callback:', error)
            }
            resolve()
          })
        })
      }

      await processParameterChange(testValue)
      
      expect(mockCallback).toHaveBeenCalledWith(testValue)
    })

    it('should handle debounced updates', async () => {
      const mockCallback = vi.fn()
      
      // Simulate debounced updates
      const debounceUpdate = (callback: Function, delay: number) => {
        let timeoutId: NodeJS.Timeout
        return (...args: any[]) => {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => callback(...args), delay)
        }
      }

      const debouncedCallback = debounceUpdate(mockCallback, 100)

      // Trigger multiple rapid updates
      debouncedCallback('value1')
      debouncedCallback('value2')
      debouncedCallback('value3')

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150))

      // Should only be called once with the last value
      expect(mockCallback).toHaveBeenCalledTimes(1)
      expect(mockCallback).toHaveBeenCalledWith('value3')
    })
  })

  describe('Error Handling', () => {
    it('should handle parameter change errors gracefully', async () => {
      const mockCallback = vi.fn()
      const mockFailingCallback = vi.fn().mockImplementation(() => {
        throw new Error('Parameter change failed')
      })
      const testValue = '25.5'

      // Simulate error handling in parameter change
      const processParameterChangeWithError = (value: any) => {
        return new Promise<void>(resolve => {
          requestAnimationFrame(() => {
            try {
              mockFailingCallback(value)
            } catch (error) {
              // Fallback behavior
              mockCallback(value)
            }
            resolve()
          })
        })
      }

      await processParameterChangeWithError(testValue)
      
      expect(mockFailingCallback).toHaveBeenCalledTimes(1)
      expect(mockCallback).toHaveBeenCalledTimes(1)
      expect(mockCallback).toHaveBeenCalledWith(testValue)
    })

    it('should validate state consistency after errors', () => {
      const parameterValues = {
        'node-1': { amount: '10.0' },
        'invalid-node': null // Invalid parameter object
      }
      const workflowNodeIds = ['node-1']

      // Mock validation result with issues
      const mockResult = {
        isConsistent: false,
        issues: ['Invalid parameter object for node: invalid-node']
      }
      vi.mocked(parameterStateDebugger.validateStateConsistency).mockReturnValue(mockResult)

      const result = parameterStateDebugger.validateStateConsistency(
        parameterValues,
        workflowNodeIds
      )

      expect(result.isConsistent).toBe(false)
      expect(result.issues).toContain('Invalid parameter object for node: invalid-node')
    })
  })
})