import { describe, it, expect } from 'vitest'
import { ActionMappingService } from '../action-mapping-service'

describe('ActionMappingService Integration', () => {
  it('should create service instance', () => {
    const service = new ActionMappingService()
    expect(service).toBeDefined()
  })

  it('should validate basic parameters', async () => {
    const service = new ActionMappingService()
    
    // Mock action metadata
    const mockAction = {
      id: 'test-action',
      name: 'Test Action',
      description: 'Test action for validation',
      category: 'test',
      version: '1.0.0',
      inputs: [
        {
          name: 'amount',
          type: 'number',
          required: true,
          description: 'Test amount'
        }
      ],
      outputs: [],
      parameters: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: [],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 100,
      securityLevel: 'medium' as any,
      author: 'test',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }

    const params = { amount: '100' }
    const result = await service.validateActionParameters(mockAction, params)

    expect(result.isValid).toBe(true)
    expect(result.validatedParams.amount).toBe(100)
  })
})