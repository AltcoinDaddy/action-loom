import { describe, it, expect, beforeEach } from 'vitest'
import {
  ParameterValidator,
  ValidationErrorType,
  ParameterValidationResult,
  ActionValidationResult
} from '../parameter-validator'
import {
  ActionMetadata,
  ParsedWorkflow,
  ParsedAction,
  ActionOutput,
  ParameterType,
  EnhancedActionParameter,
  ValidationContext
} from '../types'

describe('ParameterValidator', () => {
  let validator: ParameterValidator
  let mockContext: ValidationContext

  beforeEach(() => {
    validator = new ParameterValidator()
    mockContext = {
      workflow: {
        actions: [],
        executionOrder: [],
        rootActions: [],
        metadata: {
          totalActions: 0,
          totalConnections: 0,
          createdAt: new Date().toISOString()
        }
      },
      currentAction: {
        id: 'test-action',
        actionType: 'test',
        name: 'Test Action',
        parameters: [],
        nextActions: [],
        position: { x: 0, y: 0 }
      },
      availableOutputs: {}
    }
  })

  describe('validateParameter', () => {
    describe('Address validation', () => {
      const addressParameter: EnhancedActionParameter = {
        name: 'recipient',
        type: 'Address',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.ADDRESS,
          constraints: {
            pattern: /^0x[a-fA-F0-9]{16}$/,
            minLength: 18,
            maxLength: 18
          }
        }
      }

      it('should validate correct Flow address', () => {
        const result = validator.validateParameter(
          addressParameter,
          '0x1234567890abcdef',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject invalid address format', () => {
        const result = validator.validateParameter(
          addressParameter,
          '0x123',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(e => e.type === ValidationErrorType.INVALID_FORMAT)).toBe(true)
        expect(result.suggestions).toContain('Flow addresses must start with 0x and be 16 characters long')
      })

      it('should reject non-string address', () => {
        const result = validator.validateParameter(
          addressParameter,
          123,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_FORMAT)
      })

      it('should handle missing required address', () => {
        const result = validator.validateParameter(
          addressParameter,
          '',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.MISSING_REQUIRED)
      })

      it('should allow empty optional address', () => {
        const optionalAddress = { ...addressParameter, validation: { ...addressParameter.validation!, required: false } }
        const result = validator.validateParameter(
          optionalAddress,
          '',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })
    })

    describe('UFix64 validation', () => {
      const ufixParameter: EnhancedActionParameter = {
        name: 'amount',
        type: 'UFix64',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.UFIX64,
          constraints: {
            min: 0,
            decimals: 8
          }
        }
      }

      it('should validate positive decimal number', () => {
        const result = validator.validateParameter(
          ufixParameter,
          '123.45',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate positive integer', () => {
        const result = validator.validateParameter(
          ufixParameter,
          '100',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate zero', () => {
        const result = validator.validateParameter(
          ufixParameter,
          '0',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject negative numbers', () => {
        const result = validator.validateParameter(
          ufixParameter,
          '-10.5',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(e => e.type === ValidationErrorType.INVALID_TYPE)).toBe(true)
        expect(result.suggestions).toContain('UFix64 values must be positive decimal numbers')
      })

      it('should reject non-numeric strings', () => {
        const result = validator.validateParameter(
          ufixParameter,
          'abc',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })

      it('should warn about excessive decimal places', () => {
        const result = validator.validateParameter(
          ufixParameter,
          '123.123456789',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.warnings).toContain('amount has more than 8 decimal places')
      })
    })

    describe('String validation', () => {
      const stringParameter: EnhancedActionParameter = {
        name: 'message',
        type: 'String',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            minLength: 3,
            maxLength: 100
          }
        }
      }

      it('should validate valid string', () => {
        const result = validator.validateParameter(
          stringParameter,
          'Hello World',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject string too short', () => {
        const result = validator.validateParameter(
          stringParameter,
          'Hi',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toContain('at least 3 characters')
      })

      it('should reject string too long', () => {
        const longString = 'a'.repeat(101)
        const result = validator.validateParameter(
          stringParameter,
          longString,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].message).toContain('no more than 100 characters')
      })

      it('should reject non-string values', () => {
        const result = validator.validateParameter(
          stringParameter,
          123,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Bool validation', () => {
      const boolParameter: EnhancedActionParameter = {
        name: 'enabled',
        type: 'Bool',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.BOOL
        }
      }

      it('should validate boolean true', () => {
        const result = validator.validateParameter(
          boolParameter,
          true,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate boolean false', () => {
        const result = validator.validateParameter(
          boolParameter,
          false,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate string "true"', () => {
        const result = validator.validateParameter(
          boolParameter,
          'true',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate string "false"', () => {
        const result = validator.validateParameter(
          boolParameter,
          'false',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject invalid boolean values', () => {
        const result = validator.validateParameter(
          boolParameter,
          'maybe',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Int validation', () => {
      const intParameter: EnhancedActionParameter = {
        name: 'count',
        type: 'Int',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.INT,
          constraints: {
            min: -100,
            max: 100
          }
        }
      }

      it('should validate positive integer', () => {
        const result = validator.validateParameter(
          intParameter,
          42,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate negative integer', () => {
        const result = validator.validateParameter(
          intParameter,
          -42,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate zero', () => {
        const result = validator.validateParameter(
          intParameter,
          0,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate integer string', () => {
        const result = validator.validateParameter(
          intParameter,
          '42',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject decimal numbers', () => {
        const result = validator.validateParameter(
          intParameter,
          42.5,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })

      it('should reject values outside range', () => {
        const result = validator.validateParameter(
          intParameter,
          150,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.OUT_OF_RANGE)
      })
    })

    describe('UInt64 validation', () => {
      const uint64Parameter: EnhancedActionParameter = {
        name: 'id',
        type: 'UInt64',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.UINT64
        }
      }

      it('should validate positive integer', () => {
        const result = validator.validateParameter(
          uint64Parameter,
          42,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should validate zero', () => {
        const result = validator.validateParameter(
          uint64Parameter,
          0,
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject negative numbers', () => {
        const result = validator.validateParameter(
          uint64Parameter,
          -1,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
        expect(result.suggestions).toContain('UInt64 values must be positive integers')
      })

      it('should reject decimal numbers', () => {
        const result = validator.validateParameter(
          uint64Parameter,
          42.5,
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_TYPE)
      })
    })

    describe('Pattern validation', () => {
      const patternParameter: EnhancedActionParameter = {
        name: 'email',
        type: 'String',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          }
        }
      }

      it('should validate matching pattern', () => {
        const result = validator.validateParameter(
          patternParameter,
          'test@example.com',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject non-matching pattern', () => {
        const result = validator.validateParameter(
          patternParameter,
          'invalid-email',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.PATTERN_MISMATCH)
      })
    })

    describe('Enum validation', () => {
      const enumParameter: EnhancedActionParameter = {
        name: 'status',
        type: 'String',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          constraints: {
            enum: ['active', 'inactive', 'pending']
          }
        }
      }

      it('should validate valid enum value', () => {
        const result = validator.validateParameter(
          enumParameter,
          'active',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should reject invalid enum value', () => {
        const result = validator.validateParameter(
          enumParameter,
          'unknown',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.ENUM_VIOLATION)
        expect(result.errors[0].message).toContain('active, inactive, pending')
      })
    })

    describe('Custom validation', () => {
      const customParameter: EnhancedActionParameter = {
        name: 'custom',
        type: 'String',
        value: '',
        required: true,
        validation: {
          required: true,
          type: ParameterType.STRING,
          customValidator: (value: any) => {
            if (value === 'forbidden') {
              return {
                isValid: false,
                errors: [{
                  type: ValidationErrorType.CUSTOM_VALIDATION,
                  message: 'This value is not allowed',
                  severity: 'error' as const
                }],
                warnings: [],
                suggestions: ['Try using a different value']
              }
            }
            return {
              isValid: true,
              errors: [],
              warnings: [],
              suggestions: []
            }
          }
        }
      }

      it('should pass custom validation', () => {
        const result = validator.validateParameter(
          customParameter,
          'allowed',
          mockContext
        )

        expect(result.isValid).toBe(true)
        expect(result.errors).toHaveLength(0)
      })

      it('should fail custom validation', () => {
        const result = validator.validateParameter(
          customParameter,
          'forbidden',
          mockContext
        )

        expect(result.isValid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0].type).toBe(ValidationErrorType.CUSTOM_VALIDATION)
        expect(result.suggestions).toContain('Try using a different value')
      })
    })
  })

  describe('validateAllParameters', () => {
    const mockAction: ActionMetadata = {
      id: 'swap-tokens',
      name: 'Swap Tokens',
      description: 'Swap tokens on DEX',
      category: 'DeFi',
      version: '1.0.0',
      inputs: [],
      outputs: [],
      parameters: [
        {
          name: 'tokenIn',
          type: 'Address',
          value: '',
          required: true
        },
        {
          name: 'tokenOut',
          type: 'Address',
          value: '',
          required: true
        },
        {
          name: 'amountIn',
          type: 'UFix64',
          value: '',
          required: true
        },
        {
          name: 'slippage',
          type: 'UFix64',
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
      author: 'ActionLoom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    it('should validate all parameters successfully', () => {
      const parameterValues = {
        tokenIn: '0x1234567890abcdef',
        tokenOut: '0xfedcba0987654321',
        amountIn: '100.0',
        slippage: '0.5'
      }

      const result = validator.validateAllParameters(
        mockAction,
        parameterValues,
        mockContext
      )

      expect(result.isValid).toBe(true)
      expect(result.missingParameters).toHaveLength(0)
      expect(Object.keys(result.invalidParameters)).toHaveLength(0)
    })

    it('should detect missing required parameters', () => {
      const parameterValues = {
        tokenIn: '0x1234567890abcdef'
        // Missing tokenOut and amountIn
      }

      const result = validator.validateAllParameters(
        mockAction,
        parameterValues,
        mockContext
      )

      expect(result.isValid).toBe(false)
      expect(result.missingParameters).toContain('tokenOut')
      expect(result.missingParameters).toContain('amountIn')
      expect(result.missingParameters).not.toContain('slippage') // Optional parameter
    })

    it('should detect invalid parameter values', () => {
      const parameterValues = {
        tokenIn: 'invalid-address',
        tokenOut: '0xfedcba0987654321',
        amountIn: '-100.0', // Invalid negative amount
        slippage: '0.5'
      }

      const result = validator.validateAllParameters(
        mockAction,
        parameterValues,
        mockContext
      )

      expect(result.isValid).toBe(false)
      expect(result.invalidParameters.tokenIn).toBeDefined()
      expect(result.invalidParameters.amountIn).toBeDefined()
      expect(result.invalidParameters.tokenOut).toBeUndefined()
      expect(result.invalidParameters.slippage).toBeUndefined()
    })

    it('should handle empty parameter values correctly', () => {
      const parameterValues = {}

      const result = validator.validateAllParameters(
        mockAction,
        parameterValues,
        mockContext
      )

      expect(result.isValid).toBe(false)
      expect(result.missingParameters).toHaveLength(3) // All required parameters
      expect(result.missingParameters).toContain('tokenIn')
      expect(result.missingParameters).toContain('tokenOut')
      expect(result.missingParameters).toContain('amountIn')
      expect(result.missingParameters).not.toContain('slippage')
    })

    it('should allow optional parameters to be empty', () => {
      const parameterValues = {
        tokenIn: '0x1234567890abcdef',
        tokenOut: '0xfedcba0987654321',
        amountIn: '100.0'
        // slippage is optional and not provided
      }

      const result = validator.validateAllParameters(
        mockAction,
        parameterValues,
        mockContext
      )

      expect(result.isValid).toBe(true)
      expect(result.missingParameters).toHaveLength(0)
    })
  })



  describe('Edge cases', () => {
    it('should handle null values', () => {
      const param: EnhancedActionParameter = {
        name: 'optional',
        type: 'String',
        value: '',
        required: false,
        validation: {
          required: false,
          type: ParameterType.STRING
        }
      }

      const result = validator.validateParameter(param, null, mockContext)
      expect(result.isValid).toBe(true)
    })

    it('should handle undefined values', () => {
      const param: EnhancedActionParameter = {
        name: 'optional',
        type: 'String',
        value: '',
        required: false,
        validation: {
          required: false,
          type: ParameterType.STRING
        }
      }

      const result = validator.validateParameter(param, undefined, mockContext)
      expect(result.isValid).toBe(true)
    })

    it('should handle empty string values for optional parameters', () => {
      const param: EnhancedActionParameter = {
        name: 'optional',
        type: 'String',
        value: '',
        required: false,
        validation: {
          required: false,
          type: ParameterType.STRING
        }
      }

      const result = validator.validateParameter(param, '', mockContext)
      expect(result.isValid).toBe(true)
    })

    it('should handle parameters without validation rules', () => {
      const param: EnhancedActionParameter = {
        name: 'basic',
        type: 'String',
        value: '',
        required: true
      }

      const result = validator.validateParameter(param, 'test', mockContext)
      expect(result.isValid).toBe(true) // Should pass because the validator enhances parameters automatically
    })
  })
})