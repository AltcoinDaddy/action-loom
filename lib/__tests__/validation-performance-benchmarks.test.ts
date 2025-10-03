import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ParameterValidator } from '../parameter-validator'
import { EnhancedWorkflowValidator } from '../enhanced-workflow-validator'
import { DataFlowAnalyzer } from '../data-flow-analyzer'
import { ExecutionValidator } from '../execution-validator'
import type {
  ParsedWorkflow,
  ActionMetadata,
  ValidationContext,
  EnhancedActionParameter,
  ParameterType
} from '../types'

describe('Validation Performance Benchmarks', () => {
  let parameterValidator: ParameterValidator
  let workflowValidator: EnhancedWorkflowValidator
  let dataFlowAnalyzer: DataFlowAnalyzer
  let executionValidator: ExecutionValidator

  // Performance thresholds (in milliseconds)
  const PERFORMANCE_THRESHOLDS = {
    SINGLE_PARAMETER_VALIDATION: 1,
    ACTION_VALIDATION: 10,
    SMALL_WORKFLOW_VALIDATION: 50,
    MEDIUM_WORKFLOW_VALIDATION: 200,
    LARGE_WORKFLOW_VALIDATION: 1000,
    DATA_FLOW_ANALYSIS: 100,
    CONCURRENT_VALIDATIONS: 500
  }

  beforeEach(() => {
    vi.clearAllMocks()
    parameterValidator = new ParameterValidator()
    workflowValidator = new EnhancedWorkflowValidator()
    dataFlowAnalyzer = new DataFlowAnalyzer()
    executionValidator = new ExecutionValidator()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('Parameter Validation Performance', () => {
    it('should validate single parameter within performance threshold', () => {
      const parameter: EnhancedActionParameter = {
        name: 'amount',
        type: 'UFix64',
        required: true,
        value: '',
        validation: {
          required: true,
          type: ParameterType.UFIX64,
          constraints: {
            min: 0.000001,
            max: 1000000,
            decimals: 8
          }
        }
      }

      const context: ValidationContext = {
        workflow: createSimpleWorkflow(),
        currentAction: createSimpleWorkflow().actions[0],
        availableOutputs: {}
      }

      // Warm up
      for (let i = 0; i < 10; i++) {
        parameterValidator.validateParameter(parameter, '100.0', context)
      }

      // Benchmark
      const iterations = 1000
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        parameterValidator.validateParameter(parameter, `${i}.0`, context)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_PARAMETER_VALIDATION)
      console.log(`Single parameter validation: ${avgTime.toFixed(3)}ms avg (${iterations} iterations)`)
    })

    it('should validate all parameter types efficiently', () => {
      const parameterTypes = [
        { type: 'Address', value: '0x1654653399040a61' },
        { type: 'UFix64', value: '123.456' },
        { type: 'String', value: 'test string' },
        { type: 'Bool', value: true },
        { type: 'Int', value: -42 },
        { type: 'UInt64', value: 42 }
      ]

      const context: ValidationContext = {
        workflow: createSimpleWorkflow(),
        currentAction: createSimpleWorkflow().actions[0],
        availableOutputs: {}
      }

      const results: Record<string, number> = {}

      parameterTypes.forEach(({ type, value }) => {
        const parameter: EnhancedActionParameter = {
          name: 'testParam',
          type,
          required: true,
          value: '',
          validation: {
            required: true,
            type: type as ParameterType
          }
        }

        // Warm up
        for (let i = 0; i < 10; i++) {
          parameterValidator.validateParameter(parameter, value, context)
        }

        // Benchmark
        const iterations = 500
        const startTime = performance.now()
        
        for (let i = 0; i < iterations; i++) {
          parameterValidator.validateParameter(parameter, value, context)
        }
        
        const endTime = performance.now()
        const avgTime = (endTime - startTime) / iterations
        
        results[type] = avgTime
        expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_PARAMETER_VALIDATION)
      })

      console.log('Parameter type validation performance:', results)
    })

    it('should validate complex constraints efficiently', () => {
      const complexParameter: EnhancedActionParameter = {
        name: 'complexParam',
        type: 'String',
        required: true,
        value: '',
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            minLength: 10,
            maxLength: 100,
            pattern: /^[a-zA-Z0-9@._-]+$/,
            enum: Array.from({ length: 50 }, (_, i) => `validOption${i}`)
          },
          customValidator: (value: any) => {
            // Complex custom validation
            if (typeof value !== 'string') return { isValid: false, errors: [], warnings: [], suggestions: [] }
            
            const hasUpperCase = /[A-Z]/.test(value)
            const hasLowerCase = /[a-z]/.test(value)
            const hasNumber = /\d/.test(value)
            
            return {
              isValid: hasUpperCase && hasLowerCase && hasNumber,
              errors: [],
              warnings: [],
              suggestions: []
            }
          }
        }
      }

      const context: ValidationContext = {
        workflow: createSimpleWorkflow(),
        currentAction: createSimpleWorkflow().actions[0],
        availableOutputs: {}
      }

      // Warm up
      for (let i = 0; i < 10; i++) {
        parameterValidator.validateParameter(complexParameter, 'validOption1Test123', context)
      }

      // Benchmark
      const iterations = 200
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        parameterValidator.validateParameter(complexParameter, `validOption${i % 50}Test${i}`, context)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SINGLE_PARAMETER_VALIDATION * 5) // Allow 5x for complex validation
      console.log(`Complex constraint validation: ${avgTime.toFixed(3)}ms avg`)
    })
  })

  describe('Action Validation Performance', () => {
    it('should validate action with multiple parameters efficiently', () => {
      const actionMetadata: ActionMetadata = createComplexActionMetadata()
      const parameterValues = {
        address1: '0x1654653399040a61',
        address2: '0x3c5959b568896393',
        amount1: '100.0',
        amount2: '50.5',
        description: 'A test description that meets the minimum length requirement',
        enabled: true,
        count: 42,
        id: 123
      }

      const context: ValidationContext = {
        workflow: createSimpleWorkflow(),
        currentAction: createSimpleWorkflow().actions[0],
        availableOutputs: {}
      }

      // Warm up
      for (let i = 0; i < 10; i++) {
        parameterValidator.validateAllParameters(actionMetadata, parameterValues, context)
      }

      // Benchmark
      const iterations = 100
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        parameterValidator.validateAllParameters(actionMetadata, parameterValues, context)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.ACTION_VALIDATION)
      console.log(`Action validation (8 parameters): ${avgTime.toFixed(3)}ms avg`)
    })

    it('should scale linearly with parameter count', () => {
      const parameterCounts = [5, 10, 20, 50]
      const results: Array<{ count: number; time: number }> = []

      parameterCounts.forEach(count => {
        const actionMetadata = createActionWithParameterCount(count)
        const parameterValues = createParameterValues(count)
        
        const context: ValidationContext = {
          workflow: createSimpleWorkflow(),
          currentAction: createSimpleWorkflow().actions[0],
          availableOutputs: {}
        }

        // Warm up
        for (let i = 0; i < 5; i++) {
          parameterValidator.validateAllParameters(actionMetadata, parameterValues, context)
        }

        // Benchmark
        const iterations = 50
        const startTime = performance.now()
        
        for (let i = 0; i < iterations; i++) {
          parameterValidator.validateAllParameters(actionMetadata, parameterValues, context)
        }
        
        const endTime = performance.now()
        const avgTime = (endTime - startTime) / iterations
        
        results.push({ count, time: avgTime })
      })

      // Check that scaling is reasonable (not exponential)
      const timeRatio = results[results.length - 1].time / results[0].time
      const parameterRatio = parameterCounts[parameterCounts.length - 1] / parameterCounts[0]
      
      expect(timeRatio).toBeLessThan(parameterRatio * 2) // Should be roughly linear
      
      console.log('Parameter count scaling:', results)
    })
  })

  describe('Workflow Validation Performance', () => {
    it('should validate small workflow efficiently', async () => {
      const workflow = createWorkflowWithActionCount(5)
      const actionMetadata = createActionMetadataMap()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Warm up
      for (let i = 0; i < 5; i++) {
        await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      }

      // Benchmark
      const iterations = 20
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.SMALL_WORKFLOW_VALIDATION)
      console.log(`Small workflow validation (5 actions): ${avgTime.toFixed(3)}ms avg`)
    })

    it('should validate medium workflow efficiently', async () => {
      const workflow = createWorkflowWithActionCount(25)
      const actionMetadata = createActionMetadataMap()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Warm up
      for (let i = 0; i < 3; i++) {
        await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      }

      // Benchmark
      const iterations = 10
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.MEDIUM_WORKFLOW_VALIDATION)
      console.log(`Medium workflow validation (25 actions): ${avgTime.toFixed(3)}ms avg`)
    })

    it('should validate large workflow within acceptable time', async () => {
      const workflow = createWorkflowWithActionCount(100)
      const actionMetadata = createActionMetadataMap()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Single run benchmark (large workflows are expensive)
      const startTime = performance.now()
      const result = await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LARGE_WORKFLOW_VALIDATION)
      expect(result.canExecute).toBe(true)
      
      console.log(`Large workflow validation (100 actions): ${duration.toFixed(3)}ms`)
    })

    it('should demonstrate workflow size scaling', async () => {
      const workflowSizes = [5, 10, 25, 50]
      const results: Array<{ size: number; time: number }> = []

      for (const size of workflowSizes) {
        const workflow = createWorkflowWithActionCount(size)
        const actionMetadata = createActionMetadataMap()
        const parameterValues = createParameterValuesForWorkflow(workflow)

        // Single measurement for larger workflows
        const startTime = performance.now()
        await executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
        const endTime = performance.now()
        const duration = endTime - startTime

        results.push({ size, time: duration })
      }

      console.log('Workflow size scaling:', results)

      // Verify scaling is reasonable
      const largestTime = results[results.length - 1].time
      const smallestTime = results[0].time
      const sizeRatio = workflowSizes[workflowSizes.length - 1] / workflowSizes[0]
      
      // Should not be worse than quadratic scaling
      expect(largestTime / smallestTime).toBeLessThan(sizeRatio * sizeRatio)
    })
  })

  describe('Data Flow Analysis Performance', () => {
    it('should analyze simple data flow efficiently', () => {
      const workflow = createWorkflowWithDataFlow(10)

      // Warm up
      for (let i = 0; i < 10; i++) {
        dataFlowAnalyzer.analyzeDataFlow(workflow)
      }

      // Benchmark
      const iterations = 50
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        dataFlowAnalyzer.analyzeDataFlow(workflow)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATA_FLOW_ANALYSIS)
      console.log(`Data flow analysis (10 actions): ${avgTime.toFixed(3)}ms avg`)
    })

    it('should handle complex data flow patterns efficiently', () => {
      const workflow = createComplexDataFlowWorkflow(20)

      // Warm up
      for (let i = 0; i < 5; i++) {
        dataFlowAnalyzer.analyzeDataFlow(workflow)
      }

      // Benchmark
      const iterations = 20
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        dataFlowAnalyzer.analyzeDataFlow(workflow)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATA_FLOW_ANALYSIS * 2) // Allow 2x for complex patterns
      console.log(`Complex data flow analysis (20 actions): ${avgTime.toFixed(3)}ms avg`)
    })

    it('should detect circular dependencies efficiently', () => {
      const workflow = createWorkflowWithCircularDependency(15)

      // Warm up
      for (let i = 0; i < 5; i++) {
        dataFlowAnalyzer.analyzeDataFlow(workflow)
      }

      // Benchmark
      const iterations = 20
      const startTime = performance.now()
      
      for (let i = 0; i < iterations; i++) {
        const result = dataFlowAnalyzer.analyzeDataFlow(workflow)
        expect(result.isValid).toBe(false)
        expect(result.circularDependencies.length).toBeGreaterThan(0)
      }
      
      const endTime = performance.now()
      const avgTime = (endTime - startTime) / iterations

      expect(avgTime).toBeLessThan(PERFORMANCE_THRESHOLDS.DATA_FLOW_ANALYSIS)
      console.log(`Circular dependency detection (15 actions): ${avgTime.toFixed(3)}ms avg`)
    })
  })

  describe('Concurrent Validation Performance', () => {
    it('should handle concurrent parameter validations efficiently', async () => {
      const parameter: EnhancedActionParameter = {
        name: 'amount',
        type: 'UFix64',
        required: true,
        value: '',
        validation: {
          required: true,
          type: ParameterType.UFIX64
        }
      }

      const context: ValidationContext = {
        workflow: createSimpleWorkflow(),
        currentAction: createSimpleWorkflow().actions[0],
        availableOutputs: {}
      }

      const concurrentCount = 1000
      const startTime = performance.now()
      
      // Run concurrent validations
      const promises = Array.from({ length: concurrentCount }, (_, i) =>
        Promise.resolve(parameterValidator.validateParameter(parameter, `${i}.0`, context))
      )
      
      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_VALIDATIONS)
      expect(results).toHaveLength(concurrentCount)
      results.forEach(result => expect(result.isValid).toBe(true))
      
      console.log(`${concurrentCount} concurrent parameter validations: ${duration.toFixed(3)}ms`)
    })

    it('should handle concurrent workflow validations efficiently', async () => {
      const workflows = Array.from({ length: 10 }, () => createWorkflowWithActionCount(10))
      const actionMetadata = createActionMetadataMap()

      const startTime = performance.now()
      
      // Run concurrent workflow validations
      const promises = workflows.map(workflow => {
        const parameterValues = createParameterValuesForWorkflow(workflow)
        return executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      })
      
      const results = await Promise.all(promises)
      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLDS.CONCURRENT_VALIDATIONS)
      expect(results).toHaveLength(10)
      results.forEach(result => expect(result.canExecute).toBe(true))
      
      console.log(`10 concurrent workflow validations: ${duration.toFixed(3)}ms`)
    })
  })

  describe('Memory Usage and Cleanup', () => {
    it('should not leak memory during repeated validations', () => {
      const workflow = createWorkflowWithActionCount(20)
      const actionMetadata = createActionMetadataMap()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Measure initial memory (if available)
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0

      // Run many validation cycles
      for (let cycle = 0; cycle < 100; cycle++) {
        executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
        
        // Force garbage collection periodically if available
        if (cycle % 10 === 0 && global.gc) {
          global.gc()
        }
      }

      // Measure final memory (if available)
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100
        
        // Memory increase should be reasonable (< 50% for 100 cycles)
        expect(memoryIncreasePercent).toBeLessThan(50)
        
        console.log(`Memory usage: ${initialMemory} -> ${finalMemory} (+${memoryIncreasePercent.toFixed(1)}%)`)
      }
    })

    it('should clean up validation caches appropriately', () => {
      const workflow = createWorkflowWithActionCount(10)
      const actionMetadata = createActionMetadataMap()
      const parameterValues = createParameterValuesForWorkflow(workflow)

      // Fill cache
      for (let i = 0; i < 50; i++) {
        executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      }

      // Clear cache
      executionValidator.clearCache()

      // Validation should still work after cache clear
      const result = executionValidator.validateForExecution(workflow, actionMetadata, parameterValues)
      expect(result).toBeDefined()
    })
  })

  // Helper functions
  function createSimpleWorkflow(): ParsedWorkflow {
    return {
      actions: [{
        id: 'action-1',
        actionType: 'test',
        name: 'Test Action',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      }],
      executionOrder: ['action-1'],
      rootActions: ['action-1'],
      metadata: {
        totalActions: 1,
        totalConnections: 0,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createComplexActionMetadata(): ActionMetadata {
    return {
      id: 'complex-action',
      name: 'Complex Action',
      description: 'An action with many parameters',
      category: 'Test',
      version: '1.0.0',
      parameters: [
        {
          name: 'address1',
          type: 'Address',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.ADDRESS,
            constraints: { pattern: /^0x[a-fA-F0-9]{16}$/ }
          }
        },
        {
          name: 'address2',
          type: 'Address',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.ADDRESS,
            constraints: { pattern: /^0x[a-fA-F0-9]{16}$/ }
          }
        },
        {
          name: 'amount1',
          type: 'UFix64',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.UFIX64,
            constraints: { min: 0.000001, max: 1000000, decimals: 8 }
          }
        },
        {
          name: 'amount2',
          type: 'UFix64',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.UFIX64,
            constraints: { min: 0.000001, max: 1000000, decimals: 8 }
          }
        },
        {
          name: 'description',
          type: 'String',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.STRING,
            constraints: { minLength: 10, maxLength: 500 }
          }
        },
        {
          name: 'enabled',
          type: 'Bool',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.BOOL
          }
        },
        {
          name: 'count',
          type: 'Int',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.INT,
            constraints: { min: -1000, max: 1000 }
          }
        },
        {
          name: 'id',
          type: 'UInt64',
          required: true,
          value: '',
          validation: {
            required: true,
            type: ParameterType.UINT64,
            constraints: { min: 1, max: 999999 }
          }
        }
      ] as EnhancedActionParameter[],
      inputs: [],
      outputs: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 5000,
      securityLevel: 'medium' as any,
      author: 'Test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  function createActionWithParameterCount(count: number): ActionMetadata {
    const parameters = Array.from({ length: count }, (_, i) => ({
      name: `param${i}`,
      type: 'String',
      required: true,
      value: '',
      validation: {
        required: true,
        type: ParameterType.STRING
      }
    })) as EnhancedActionParameter[]

    return {
      id: `action-${count}-params`,
      name: `Action with ${count} Parameters`,
      description: 'Test action',
      category: 'Test',
      version: '1.0.0',
      parameters,
      inputs: [],
      outputs: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 1000,
      securityLevel: 'low' as any,
      author: 'Test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  }

  function createParameterValues(count: number): Record<string, any> {
    const values: Record<string, any> = {}
    for (let i = 0; i < count; i++) {
      values[`param${i}`] = `value${i}`
    }
    return values
  }

  function createWorkflowWithActionCount(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: 'test-action',
      name: `Action ${i + 1}`,
      parameters: [
        { name: 'param1', type: 'String', value: 'test', required: true },
        { name: 'param2', type: 'UFix64', value: '10.0', required: true }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : [],
      position: { x: i * 100, y: 0 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount - 1,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createWorkflowWithDataFlow(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: 'test-action',
      name: `Action ${i + 1}`,
      parameters: [
        { 
          name: 'input', 
          type: 'String', 
          value: i > 0 ? `action-${i}.output` : 'initial', 
          required: true 
        }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : [],
      position: { x: i * 100, y: 0 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount - 1,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createComplexDataFlowWorkflow(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: 'test-action',
      name: `Action ${i + 1}`,
      parameters: [
        { 
          name: 'input1', 
          type: 'String', 
          value: i > 0 ? `action-${Math.max(1, i - 1)}.output1` : 'initial1', 
          required: true 
        },
        { 
          name: 'input2', 
          type: 'UFix64', 
          value: i > 1 ? `action-${Math.max(1, i - 2)}.output2` : '10.0', 
          required: true 
        }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : [],
      position: { x: (i % 5) * 100, y: Math.floor(i / 5) * 100 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount - 1,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createWorkflowWithCircularDependency(actionCount: number): ParsedWorkflow {
    const actions = Array.from({ length: actionCount }, (_, i) => ({
      id: `action-${i + 1}`,
      actionType: 'test-action',
      name: `Action ${i + 1}`,
      parameters: [
        { 
          name: 'input', 
          type: 'String', 
          value: i === 0 ? `action-${actionCount}.output` : `action-${i}.output`, // Creates circular dependency
          required: true 
        }
      ],
      nextActions: i < actionCount - 1 ? [`action-${i + 2}`] : ['action-1'], // Creates cycle
      position: { x: i * 100, y: 0 }
    }))

    return {
      actions,
      executionOrder: actions.map(a => a.id),
      rootActions: ['action-1'],
      metadata: {
        totalActions: actionCount,
        totalConnections: actionCount,
        createdAt: new Date().toISOString()
      }
    }
  }

  function createActionMetadataMap(): Record<string, ActionMetadata> {
    return {
      'test-action': {
        id: 'test-action',
        name: 'Test Action',
        description: 'A test action',
        category: 'Test',
        version: '1.0.0',
        parameters: [],
        inputs: [],
        outputs: [
          { name: 'output', type: 'String', description: 'Test output' },
          { name: 'output1', type: 'String', description: 'Test output 1' },
          { name: 'output2', type: 'UFix64', description: 'Test output 2' }
        ],
        compatibility: {
          requiredCapabilities: [],
          supportedNetworks: ['testnet'],
          minimumFlowVersion: '1.0.0',
          conflictsWith: []
        },
        gasEstimate: 1000,
        securityLevel: 'low' as any,
        author: 'Test',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  }

  function createParameterValuesForWorkflow(workflow: ParsedWorkflow): Record<string, any> {
    const parameterValues: Record<string, any> = {}
    
    workflow.actions.forEach(action => {
      const values: Record<string, any> = {}
      action.parameters.forEach(param => {
        if (param.value && !param.value.includes('action-')) {
          values[param.name] = param.value
        } else {
          // Provide default values
          switch (param.type) {
            case 'String':
              values[param.name] = 'test'
              break
            case 'UFix64':
              values[param.name] = '10.0'
              break
            default:
              values[param.name] = 'default'
          }
        }
      })
      parameterValues[action.id] = values
    })

    return parameterValues
  }
})