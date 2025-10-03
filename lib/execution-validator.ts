import {
    ParsedWorkflow,
    ActionMetadata,
    ValidationError,
    ValidationErrorType
} from './types'
import { WorkflowValidator, WorkflowValidationResult } from './workflow-validator'
import { ParameterValidator } from './parameter-validator'

export interface ExecutionValidationResult {
    canExecute: boolean
    validationResult: WorkflowValidationResult
    executionReadiness: ExecutionReadinessStatus
    blockingErrors: ValidationError[]
    warnings: ValidationError[]
    estimatedGasCost?: number
    estimatedExecutionTime?: number
}

export interface ExecutionReadinessStatus {
    parametersConfigured: boolean
    dataFlowValid: boolean
    noCircularDependencies: boolean
    allActionsValid: boolean
    readinessScore: number // 0-100
    readinessMessage: string
}

export interface ValidationCache {
    workflowHash: string
    parameterHash: string
    result: ExecutionValidationResult
    timestamp: number
    ttl: number // Time to live in milliseconds
}

/**
 * ExecutionValidator provides comprehensive pre-execution validation
 * with caching and detailed error reporting
 */
export class ExecutionValidator {
    private workflowValidator: WorkflowValidator
    private parameterValidator: ParameterValidator
    private validationCache: Map<string, ValidationCache>
    private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

    constructor() {
        this.workflowValidator = new WorkflowValidator()
        this.parameterValidator = new ParameterValidator()
        this.validationCache = new Map()
    }

    /**
     * Validates a workflow for execution readiness with caching
     */
    async validateForExecution(
        workflow: ParsedWorkflow,
        actionMetadata: Record<string, ActionMetadata>,
        parameterValues: Record<string, Record<string, any>>
    ): Promise<ExecutionValidationResult> {
        // Generate cache key
        const cacheKey = this.generateCacheKey(workflow, parameterValues)

        // Check cache first
        const cachedResult = this.getCachedValidation(cacheKey)
        if (cachedResult) {
            return cachedResult
        }

        // Perform validation
        const validationResult = this.workflowValidator.validateWorkflow(
            workflow,
            actionMetadata,
            parameterValues
        )

        // Analyze execution readiness
        const executionReadiness = this.analyzeExecutionReadiness(
            workflow,
            validationResult,
            parameterValues
        )

        // Categorize errors
        const { blockingErrors, warnings } = this.categorizeValidationIssues(validationResult)

        // Estimate execution costs
        const estimatedGasCost = this.estimateGasCost(workflow, actionMetadata)
        const estimatedExecutionTime = this.estimateExecutionTime(workflow)

        const result: ExecutionValidationResult = {
            canExecute: validationResult.isValid && blockingErrors.length === 0,
            validationResult,
            executionReadiness,
            blockingErrors,
            warnings,
            estimatedGasCost,
            estimatedExecutionTime
        }

        // Cache the result
        this.cacheValidationResult(cacheKey, result, workflow, parameterValues)

        return result
    }

    /**
     * Quick validation check for UI responsiveness
     */
    quickValidationCheck(
        workflow: ParsedWorkflow,
        parameterValues: Record<string, Record<string, any>>
    ): { isValid: boolean; errorCount: number; warningCount: number } {
        let errorCount = 0
        let warningCount = 0

        // Quick parameter check
        for (const action of workflow.actions) {
            const actionParams = parameterValues[action.id] || {}
            const requiredParams = action.parameters.filter(p => p.required)

            // Check if user has started configuring this action
            const hasUserInteraction = Object.values(actionParams).some(value => {
                if (typeof value === 'string') return value.trim() !== ''
                if (typeof value === 'boolean') return true
                if (typeof value === 'number') return !isNaN(value)
                return value !== null && value !== undefined
            })

            // Only count missing parameters as errors if user has started configuring
            if (hasUserInteraction || Object.keys(actionParams).length > 0) {
                for (const param of requiredParams) {
                    const value = actionParams[param.name]
                    if (!value || (typeof value === 'string' && value.trim() === '')) {
                        errorCount++
                    }
                }
            }
        }

        // Quick structure check
        if (workflow.actions.length === 0) {
            errorCount++
        }

        return {
            isValid: errorCount === 0,
            errorCount,
            warningCount
        }
    }

    /**
     * Validates specific action for execution
     */
    validateActionForExecution(
        action: ParsedWorkflow['actions'][0],
        actionMetadata: ActionMetadata,
        parameterValues: Record<string, any>,
        availableOutputs: Record<string, any>
    ): { canExecute: boolean; errors: ValidationError[]; warnings: string[] } {
        const validationContext = {
            workflow: { actions: [action] } as ParsedWorkflow,
            currentAction: action,
            availableOutputs
        }

        const result = this.parameterValidator.validateAllParameters(
            actionMetadata,
            parameterValues,
            validationContext
        )

        const errors: ValidationError[] = []

        // Add missing parameter errors
        result.missingParameters.forEach(param => {
            errors.push({
                type: ValidationErrorType.MISSING_REQUIRED,
                message: `${param} is required for execution`,
                field: param,
                severity: 'error'
            })
        })

        // Add invalid parameter errors
        Object.values(result.invalidParameters).forEach(paramValidation => {
            errors.push(...paramValidation.errors)
        })

        return {
            canExecute: result.isValid,
            errors,
            warnings: result.warnings
        }
    }

    /**
     * Clears validation cache
     */
    clearCache(): void {
        this.validationCache.clear()
    }

    /**
     * Clears expired cache entries
     */
    clearExpiredCache(): void {
        const now = Date.now()
        for (const [key, cache] of this.validationCache.entries()) {
            if (now - cache.timestamp > cache.ttl) {
                this.validationCache.delete(key)
            }
        }
    }

    private generateCacheKey(
        workflow: ParsedWorkflow,
        parameterValues: Record<string, Record<string, any>>
    ): string {
        // Create a hash of the workflow structure and parameter values
        const workflowData = {
            actions: workflow.actions.map(a => ({
                id: a.id,
                actionType: a.actionType,
                parameters: a.parameters.map(p => ({ name: p.name, type: p.type, required: p.required }))
            })),
            executionOrder: workflow.executionOrder
        }

        const workflowHash = this.simpleHash(JSON.stringify(workflowData))
        const parameterHash = this.simpleHash(JSON.stringify(parameterValues))

        return `${workflowHash}-${parameterHash}`
    }

    private getCachedValidation(cacheKey: string): ExecutionValidationResult | null {
        const cached = this.validationCache.get(cacheKey)
        if (!cached) return null

        const now = Date.now()
        if (now - cached.timestamp > cached.ttl) {
            this.validationCache.delete(cacheKey)
            return null
        }

        return cached.result
    }

    private cacheValidationResult(
        cacheKey: string,
        result: ExecutionValidationResult,
        workflow: ParsedWorkflow,
        parameterValues: Record<string, Record<string, any>>
    ): void {
        const cache: ValidationCache = {
            workflowHash: this.simpleHash(JSON.stringify(workflow)),
            parameterHash: this.simpleHash(JSON.stringify(parameterValues)),
            result,
            timestamp: Date.now(),
            ttl: this.CACHE_TTL
        }

        this.validationCache.set(cacheKey, cache)

        // Clean up old entries periodically
        if (this.validationCache.size > 100) {
            this.clearExpiredCache()
        }
    }

    private analyzeExecutionReadiness(
        workflow: ParsedWorkflow,
        validationResult: WorkflowValidationResult,
        parameterValues: Record<string, Record<string, any>>
    ): ExecutionReadinessStatus {
        let score = 0
        const checks = {
            parametersConfigured: false,
            dataFlowValid: false,
            noCircularDependencies: false,
            allActionsValid: false
        }

        // Check parameters configured (25 points)
        const totalRequiredParams = workflow.actions.reduce((total, action) => {
            return total + action.parameters.filter(p => p.required).length
        }, 0)

        const configuredParams = workflow.actions.reduce((total, action) => {
            const actionParams = parameterValues[action.id] || {}
            return total + action.parameters.filter(p =>
                p.required && actionParams[p.name] && actionParams[p.name] !== ''
            ).length
        }, 0)

        if (totalRequiredParams > 0) {
            const paramScore = (configuredParams / totalRequiredParams) * 25
            score += paramScore
            checks.parametersConfigured = paramScore === 25
        } else {
            score += 25
            checks.parametersConfigured = true
        }

        // Check data flow valid (25 points)
        if (validationResult.dataFlowResult.isValid) {
            score += 25
            checks.dataFlowValid = true
        }

        // Check no circular dependencies (25 points)
        if (validationResult.dataFlowResult.circularDependencies.length === 0) {
            score += 25
            checks.noCircularDependencies = true
        }

        // Check all actions valid (25 points)
        const validActions = Object.values(validationResult.actionResults).filter(r => r.isValid).length
        if (workflow.actions.length > 0) {
            const actionScore = (validActions / workflow.actions.length) * 25
            score += actionScore
            checks.allActionsValid = actionScore === 25
        } else {
            checks.allActionsValid = true
        }

        // Generate readiness message
        let message = ''
        if (score === 100) {
            message = 'Workflow is ready for execution'
        } else if (score >= 75) {
            message = 'Workflow is mostly ready, minor issues remain'
        } else if (score >= 50) {
            message = 'Workflow needs configuration before execution'
        } else {
            message = 'Workflow requires significant configuration'
        }

        return {
            ...checks,
            readinessScore: Math.round(score),
            readinessMessage: message
        }
    }

    private categorizeValidationIssues(
        validationResult: WorkflowValidationResult
    ): { blockingErrors: ValidationError[]; warnings: ValidationError[] } {
        const blockingErrors: ValidationError[] = []
        const warnings: ValidationError[] = []

        // Global errors are always blocking
        blockingErrors.push(...validationResult.globalErrors)

        // Action validation errors
        Object.values(validationResult.actionResults).forEach(actionResult => {
            actionResult.missingParameters.forEach(param => {
                blockingErrors.push({
                    type: ValidationErrorType.MISSING_REQUIRED,
                    message: `Missing required parameter: ${param}`,
                    field: param,
                    severity: 'error'
                })
            })

            Object.values(actionResult.invalidParameters).forEach(paramResult => {
                paramResult.errors.forEach(error => {
                    if (error.severity === 'error') {
                        blockingErrors.push(error)
                    } else {
                        warnings.push(error)
                    }
                })
            })
        })

        // Data flow issues
        validationResult.dataFlowResult.circularDependencies.forEach(cycle => {
            blockingErrors.push({
                type: ValidationErrorType.CIRCULAR_DEPENDENCY,
                message: cycle.description,
                severity: 'error'
            })
        })

        validationResult.dataFlowResult.unresolvedReferences.forEach(ref => {
            blockingErrors.push({
                type: ValidationErrorType.UNRESOLVED_REFERENCE,
                message: `Unresolved reference: ${ref.actionId}.${ref.parameterName} -> ${ref.referencedAction}.${ref.referencedOutput}`,
                field: ref.parameterName,
                severity: 'error'
            })
        })

        validationResult.dataFlowResult.typeCompatibilityIssues.forEach(issue => {
            if (!issue.canConvert) {
                blockingErrors.push({
                    type: ValidationErrorType.TYPE_MISMATCH,
                    message: `Type incompatibility: ${issue.sourceType} cannot be converted to ${issue.targetType}`,
                    severity: 'error'
                })
            } else {
                warnings.push({
                    type: ValidationErrorType.TYPE_MISMATCH,
                    message: `Type conversion: ${issue.sourceType} will be converted to ${issue.targetType}`,
                    severity: 'warning'
                })
            }
        })

        return { blockingErrors, warnings }
    }

    private estimateGasCost(
        workflow: ParsedWorkflow,
        actionMetadata: Record<string, ActionMetadata>
    ): number {
        let totalGas = 0

        // Base transaction cost
        totalGas += 1000

        // Per-action costs
        workflow.actions.forEach(action => {
            const metadata = actionMetadata[action.actionType]
            if (metadata?.gasEstimate) {
                totalGas += metadata.gasEstimate
            } else {
                // Default gas estimate based on action type
                const defaultGasEstimates: Record<string, number> = {
                    'swap-tokens': 5000,
                    'add-liquidity': 7000,
                    'stake-tokens': 3000,
                    'mint-nft': 4000,
                    'transfer-nft': 2000,
                    'list-nft': 3000,
                    'create-proposal': 6000,
                    'vote': 2000
                }
                totalGas += defaultGasEstimates[action.actionType] || 2000
            }
        })

        // Connection complexity
        totalGas += workflow.metadata.totalConnections * 100

        return totalGas
    }

    private estimateExecutionTime(workflow: ParsedWorkflow): number {
        // Base time for transaction processing
        let totalTime = 2000 // 2 seconds base

        // Per-action time
        totalTime += workflow.actions.length * 500 // 500ms per action

        // Connection complexity
        totalTime += workflow.metadata.totalConnections * 100

        return totalTime
    }

    private simpleHash(str: string): string {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i)
            hash = ((hash << 5) - hash) + char
            hash = hash & hash // Convert to 32-bit integer
        }
        return hash.toString(36)
    }
}