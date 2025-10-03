/**
 * Comprehensive API Error Handling Utility
 * Provides standardized error responses and HTTP status codes
 */

import { NextResponse } from "next/server"

export interface APIError {
  success: false
  error: string
  details?: string
  code?: string
  timestamp: string
  correlationId?: string
}

export interface APISuccess<T = any> {
  success: true
  data?: T
  timestamp: string
  correlationId?: string
  [key: string]: any
}

export type APIResponse<T = any> = APIError | APISuccess<T>

/**
 * Standard error codes for consistent error handling
 */
export enum ErrorCode {
  // Client errors (4xx)
  INVALID_REQUEST = 'INVALID_REQUEST',
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  INVALID_PARAMETERS = 'INVALID_PARAMETERS',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR'
}

/**
 * Error class for API errors with structured information
 */
export class APIErrorClass extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: string
  public readonly correlationId?: string

  constructor(
    message: string,
    code: ErrorCode,
    statusCode: number,
    details?: string,
    correlationId?: string
  ) {
    super(message)
    this.name = 'APIError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.correlationId = correlationId
  }
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  error: string | Error | APIErrorClass,
  statusCode: number = 500,
  code?: ErrorCode,
  details?: string,
  correlationId?: string
): NextResponse<APIError> {
  let errorMessage: string
  let errorCode: ErrorCode
  let errorDetails: string | undefined
  let finalStatusCode: number
  let finalCorrelationId: string | undefined

  if (error instanceof APIErrorClass) {
    errorMessage = error.message
    errorCode = error.code
    errorDetails = error.details
    finalStatusCode = error.statusCode
    finalCorrelationId = error.correlationId
  } else if (error instanceof Error) {
    errorMessage = error.message
    errorCode = code || getErrorCodeFromStatus(statusCode)
    errorDetails = details || error.stack
    finalStatusCode = statusCode
    finalCorrelationId = correlationId
  } else {
    errorMessage = error
    errorCode = code || getErrorCodeFromStatus(statusCode)
    errorDetails = details
    finalStatusCode = statusCode
    finalCorrelationId = correlationId
  }

  // Generate correlation ID if not provided
  if (!finalCorrelationId) {
    finalCorrelationId = generateCorrelationId()
  }

  const errorResponse: APIError = {
    success: false,
    error: errorMessage,
    code: errorCode,
    timestamp: new Date().toISOString(),
    correlationId: finalCorrelationId
  }

  // Only include details in development or for specific error types
  if (errorDetails && (process.env.NODE_ENV === 'development' || shouldIncludeDetails(errorCode))) {
    errorResponse.details = errorDetails
  }

  // Log error for monitoring
  console.error(`[API Error] ${errorCode}: ${errorMessage}`, {
    statusCode: finalStatusCode,
    correlationId: finalCorrelationId,
    details: errorDetails
  })

  return NextResponse.json(errorResponse, { status: finalStatusCode })
}

/**
 * Create standardized success response
 */
export function createSuccessResponse<T = any>(
  data?: T,
  additionalFields?: Record<string, any>,
  correlationId?: string
): NextResponse<APISuccess<T>> {
  const finalCorrelationId = correlationId || generateCorrelationId()

  const successResponse: APISuccess<T> = {
    success: true,
    timestamp: new Date().toISOString(),
    correlationId: finalCorrelationId,
    ...additionalFields
  }

  if (data !== undefined) {
    successResponse.data = data
  }

  return NextResponse.json(successResponse)
}

/**
 * Wrap API route handler with comprehensive error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<any>>,
  operationName?: string
) {
  return async (...args: T): Promise<NextResponse<any>> => {
    const correlationId = generateCorrelationId()
    const startTime = Date.now()

    try {
      console.log(`[API] Starting ${operationName || 'operation'}`, {
        correlationId,
        timestamp: new Date().toISOString()
      })

      const result = await handler(...args)
      
      const duration = Date.now() - startTime
      console.log(`[API] Completed ${operationName || 'operation'}`, {
        correlationId,
        duration: `${duration}ms`,
        status: result.status
      })

      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(`[API] Failed ${operationName || 'operation'}`, {
        correlationId,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      })

      if (error instanceof APIErrorClass) {
        return createErrorResponse(error, error.statusCode, error.code, error.details, correlationId)
      }

      // Handle specific error types
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        return createErrorResponse(
          'Invalid JSON in request body',
          400,
          ErrorCode.INVALID_REQUEST,
          error.message,
          correlationId
        )
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        return createErrorResponse(
          'External service unavailable',
          503,
          ErrorCode.EXTERNAL_SERVICE_ERROR,
          error.message,
          correlationId
        )
      }

      // Default to internal server error
      return createErrorResponse(
        'Internal server error',
        500,
        ErrorCode.INTERNAL_SERVER_ERROR,
        error instanceof Error ? error.message : String(error),
        correlationId
      )
    }
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  requiredFields: string[],
  correlationId?: string
): void {
  const missingFields = requiredFields.filter(field => {
    const value = body[field]
    return value === undefined || value === null || value === ''
  })

  if (missingFields.length > 0) {
    throw new APIErrorClass(
      `Missing required fields: ${missingFields.join(', ')}`,
      ErrorCode.MISSING_REQUIRED_FIELDS,
      400,
      `Required fields: ${requiredFields.join(', ')}. Missing: ${missingFields.join(', ')}`,
      correlationId
    )
  }
}

/**
 * Validate request parameters
 */
export function validateParameters(
  params: Record<string, any>,
  validations: Record<string, (value: any) => boolean | string>,
  correlationId?: string
): void {
  const errors: string[] = []

  for (const [field, validator] of Object.entries(validations)) {
    const value = params[field]
    const result = validator(value)
    
    if (result !== true) {
      errors.push(typeof result === 'string' ? result : `Invalid ${field}`)
    }
  }

  if (errors.length > 0) {
    throw new APIErrorClass(
      'Parameter validation failed',
      ErrorCode.INVALID_PARAMETERS,
      400,
      errors.join('; '),
      correlationId
    )
  }
}

/**
 * Handle resource not found errors
 */
export function throwNotFound(
  resource: string,
  identifier: string,
  correlationId?: string
): never {
  throw new APIErrorClass(
    `${resource} not found`,
    ErrorCode.RESOURCE_NOT_FOUND,
    404,
    `${resource} with identifier '${identifier}' does not exist`,
    correlationId
  )
}

/**
 * Handle unauthorized access
 */
export function throwUnauthorized(
  message: string = 'Unauthorized access',
  correlationId?: string
): never {
  throw new APIErrorClass(
    message,
    ErrorCode.UNAUTHORIZED,
    401,
    undefined,
    correlationId
  )
}

/**
 * Handle forbidden access
 */
export function throwForbidden(
  message: string = 'Access forbidden',
  correlationId?: string
): never {
  throw new APIErrorClass(
    message,
    ErrorCode.FORBIDDEN,
    403,
    undefined,
    correlationId
  )
}

/**
 * Handle validation errors
 */
export function throwValidationError(
  message: string,
  details?: string,
  correlationId?: string
): never {
  throw new APIErrorClass(
    message,
    ErrorCode.VALIDATION_FAILED,
    400,
    details,
    correlationId
  )
}

// Helper functions

function getErrorCodeFromStatus(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 400: return ErrorCode.INVALID_REQUEST
    case 401: return ErrorCode.UNAUTHORIZED
    case 403: return ErrorCode.FORBIDDEN
    case 404: return ErrorCode.RESOURCE_NOT_FOUND
    case 422: return ErrorCode.VALIDATION_FAILED
    case 429: return ErrorCode.RATE_LIMIT_EXCEEDED
    case 503: return ErrorCode.SERVICE_UNAVAILABLE
    default: return ErrorCode.INTERNAL_SERVER_ERROR
  }
}

function shouldIncludeDetails(code: ErrorCode): boolean {
  // Include details for client errors that might help with debugging
  return [
    ErrorCode.INVALID_REQUEST,
    ErrorCode.MISSING_REQUIRED_FIELDS,
    ErrorCode.INVALID_PARAMETERS,
    ErrorCode.VALIDATION_FAILED
  ].includes(code)
}

function generateCorrelationId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}