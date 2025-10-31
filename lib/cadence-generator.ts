import type { ParsedWorkflow, ParsedAction, ActionMetadata, ForteAction, EnhancedWorkflow } from "./types"
import { ActionDiscoveryService, getDefaultActionDiscoveryService } from "./action-discovery-service"
import { gracefulErrorHandler, ActionDiscoveryError } from "./graceful-error-handler"
import { logger } from "./logging-service"

export interface CadenceGenerationResult {
  code: string
  success: boolean
  errors: string[]
  warnings: string[]
  fallbackUsed: boolean
  executionTime: number
}

export interface CadenceGenerationOptions {
  enableFallbacks: boolean
  includeComments: boolean
  validateSyntax: boolean
  timeout: number
}

export class CadenceGenerator {
  private static _discoveryService: ActionDiscoveryService | null = null
  
  private static getDiscoveryService(): ActionDiscoveryService {
    if (!this._discoveryService) {
      this._discoveryService = getDefaultActionDiscoveryService()
    }
    return this._discoveryService
  }
  
  /**
   * Generate Cadence transaction code from parsed workflow with enhanced error handling
   */
  static async generateTransaction(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    options: Partial<CadenceGenerationOptions> = {}
  ): Promise<string> {
    const result = await this.generateTransactionWithDetails(workflow, options)
    return result.code
  }

  /**
   * Generate Cadence transaction code with detailed result information
   */
  static async generateTransactionWithDetails(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    options: Partial<CadenceGenerationOptions> = {}
  ): Promise<CadenceGenerationResult> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()
    const config: CadenceGenerationOptions = {
      enableFallbacks: true,
      includeComments: true,
      validateSyntax: false,
      timeout: 30000,
      ...options
    }

    logger.info('Starting Cadence generation', {
      correlationId,
      component: 'cadence-generator',
      operation: 'generate-transaction',
      metadata: {
        workflowId: workflow.metadata?.name || 'unknown',
        actionCount: workflow.actions.length,
        enableFallbacks: config.enableFallbacks
      }
    })

    const result: CadenceGenerationResult = {
      code: '',
      success: false,
      errors: [],
      warnings: [],
      fallbackUsed: false,
      executionTime: 0
    }

    try {
      // Set timeout for the entire generation process
      const generationPromise = this.performGeneration(workflow, config, correlationId)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Generation timeout')), config.timeout)
      })

      const { imports, prepareBlock, executeBlock } = await Promise.race([
        generationPromise,
        timeoutPromise
      ])

      result.code = `${imports}

transaction() {
${prepareBlock}

${executeBlock}
}`
      result.success = true

      logger.info('Cadence generation completed successfully', {
        correlationId,
        component: 'cadence-generator',
        operation: 'generate-transaction',
        metadata: {
          codeLength: result.code.length,
          fallbackUsed: result.fallbackUsed,
          warningCount: result.warnings.length
        }
      })

    } catch (error) {
      const actionError = this.handleGenerationError(error, correlationId)
      result.errors.push(actionError.message)

      if (config.enableFallbacks) {
        logger.info('Attempting fallback generation', {
          correlationId,
          component: 'cadence-generator',
          operation: 'generate-transaction',
          metadata: { originalError: actionError.code }
        })

        try {
          result.code = await this.generateFallbackTransaction(workflow, correlationId)
          result.fallbackUsed = true
          result.warnings.push('Generated using fallback method due to action discovery issues')
          result.success = true
        } catch (fallbackError) {
          result.errors.push(`Fallback generation failed: ${(fallbackError as Error).message}`)
          result.code = this.generateErrorTransaction(workflow, result.errors)
        }
      } else {
        result.code = this.generateErrorTransaction(workflow, result.errors)
      }

      logger.error('Cadence generation failed', actionError, {
        correlationId,
        component: 'cadence-generator',
        operation: 'generate-transaction',
        metadata: {
          fallbackUsed: result.fallbackUsed,
          errorCount: result.errors.length
        }
      })
    }

    result.executionTime = Date.now() - startTime
    return result
  }

  /**
   * Perform the actual generation with error handling
   */
  private static async performGeneration(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    config: CadenceGenerationOptions,
    correlationId: string
  ): Promise<{ imports: string; prepareBlock: string; executeBlock: string }> {
    const imports = await this.generateImports(workflow)
    const prepareBlock = await this.generatePrepareBlock(workflow)
    const executeBlock = await this.generateExecuteBlock(workflow)

    return { imports, prepareBlock, executeBlock }
  }

  /**
   * Handle generation errors and convert them to ActionDiscoveryError format
   */
  private static handleGenerationError(error: Error | unknown, correlationId: string): ActionDiscoveryError {
    // Handle case where error might be undefined or not an Error object
    if (!error) {
      error = new Error('Unknown error occurred during generation')
    }
    
    if (!(error instanceof Error)) {
      error = new Error(String(error))
    }

    const actualError = error as Error

    logger.error('Generation error occurred', actualError, {
      correlationId,
      component: 'cadence-generator',
      operation: 'handle-generation-error'
    })

    // Check if it's already an ActionDiscoveryError
    if (actualError && typeof actualError === 'object' && 'code' in actualError && 'retryable' in actualError) {
      return actualError as ActionDiscoveryError
    }

    // Determine error type based on error message
    let code: ActionDiscoveryError['code'] = 'UNKNOWN_ERROR'
    const message = actualError.message || 'Unknown error'
    
    if (message.includes('discovery') && message.includes('progress')) {
      code = 'DISCOVERY_IN_PROGRESS'
    } else if (message.includes('network') || message.includes('fetch')) {
      code = 'NETWORK_ERROR'
    } else if (message.includes('timeout')) {
      code = 'TIMEOUT'
    } else if (message.includes('API') || message.includes('400')) {
      code = 'API_ERROR'
    } else if (message.includes('validation')) {
      code = 'VALIDATION_ERROR'
    }

    return gracefulErrorHandler.createActionDiscoveryError(actualError, code, {
      correlationId,
      operation: 'cadence-generation'
    })
  }

  /**
   * Generate fallback transaction when action discovery fails
   */
  private static async generateFallbackTransaction(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    correlationId: string
  ): Promise<string> {
    logger.info('Generating fallback transaction', {
      correlationId,
      component: 'cadence-generator',
      operation: 'generate-fallback-transaction',
      metadata: { actionCount: workflow.actions.length }
    })

    const imports = this.generateFallbackImports(workflow)
    const prepareBlock = this.generateFallbackPrepareBlock(workflow)
    const executeBlock = this.generateFallbackExecuteBlock(workflow)

    return `${imports}

// FALLBACK TRANSACTION - Action discovery unavailable
// This transaction was generated using static fallback methods
transaction() {
${prepareBlock}

${executeBlock}
}`
  }

  /**
   * Generate error transaction when all generation methods fail
   */
  private static generateErrorTransaction(
    workflow: ParsedWorkflow | EnhancedWorkflow,
    errors: string[]
  ): string {
    const errorComments = errors.map(error => `// ERROR: ${error}`).join('\n')
    
    return `${errorComments}

// TRANSACTION GENERATION FAILED
// Unable to generate Cadence code due to the following errors:
${errors.map(error => `// - ${error}`).join('\n')}

transaction() {
  prepare(signer: auth(Storage, Contracts) &Account) {
    // Transaction preparation failed
    log("Transaction generation failed - see comments above")
  }

  execute {
    // Transaction execution failed
    panic("Cannot execute - transaction generation failed")
  }
}`
  }

  /**
   * Generate fallback imports using static mappings
   */
  private static generateFallbackImports(workflow: ParsedWorkflow | EnhancedWorkflow): string {
    const imports = new Set<string>()
    
    // Add standard Flow imports
    imports.add('import "FungibleToken"')
    imports.add('import "NonFungibleToken"')
    imports.add('import "FlowToken"')

    // Add action-specific imports based on action types
    for (const action of workflow.actions) {
      const actionImports = this.getStaticActionImports(action.actionType)
      actionImports.forEach(imp => imports.add(imp))
    }

    return Array.from(imports).join('\n')
  }

  /**
   * Get static imports for action types (used in fallback generation)
   */
  private static getStaticActionImports(actionType: string): string[] {
    const importMap: Record<string, string[]> = {
      "swap-tokens": ['import "SwapRouter"'],
      "add-liquidity": ['import "LiquidityPool"'],
      "stake-tokens": ['import "StakingContract"'],
      "mint-nft": ['import "NFTContract"'],
      "transfer-nft": [],
      "list-nft": ['import "NFTMarketplace"'],
      "create-proposal": ['import "GovernanceContract"'],
      "vote": ['import "GovernanceContract"'],
      "transfer-flow": [],
      "transfer-tokens": []
    }

    return importMap[actionType] || []
  }

  /**
   * Generate fallback prepare block using static patterns
   */
  private static generateFallbackPrepareBlock(workflow: ParsedWorkflow | EnhancedWorkflow): string {
    const lines: string[] = ["  prepare(signer: auth(Storage, Contracts) &Account) {"]
    
    lines.push(`    // FALLBACK MODE - ${workflow.actions.length} actions`)
    lines.push("    // Action discovery unavailable, using static generation")
    lines.push("")

    for (let i = 0; i < workflow.actions.length; i++) {
      const action = workflow.actions[i]
      lines.push(`    // Action ${i + 1}: ${action.name} (${action.actionType})`)
      const setup = this.generateStaticActionSetup(action)
      if (setup) {
        lines.push(setup)
      }
      lines.push("")
    }

    lines.push("  }")
    return lines.join('\n')
  }

  /**
   * Generate fallback execute block using static patterns
   */
  private static generateFallbackExecuteBlock(workflow: ParsedWorkflow | EnhancedWorkflow): string {
    const lines: string[] = ["  execute {"]
    lines.push("    // FALLBACK EXECUTION - Static action generation")
    lines.push("")

    for (const actionId of workflow.executionOrder) {
      const action = workflow.actions.find(a => a.id === actionId)
      if (action) {
        lines.push(`    // ${action.name}`)
        const code = this.generateStaticActionCode(action)
        lines.push(code)
        lines.push("")
      }
    }

    lines.push('    log("Fallback workflow execution completed")')
    lines.push("  }")
    return lines.join('\n')
  }



  /**
   * Generate static action setup (fallback method)
   */
  private static generateStaticActionSetup(action: ParsedAction): string {
    const setupMap: Record<string, (action: ParsedAction) => string> = {
      "swap-tokens": () => `    // Setup for token swap
    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("Could not borrow reference to the owner's Vault!")`,
      
      "stake-tokens": () => `    // Setup for token staking
    let stakingRef = signer.storage.borrow<auth(StakingContract.Stake) &StakingContract.Staker>(from: /storage/flowStaker)
      ?? panic("Could not borrow staking reference")`,
      
      "mint-nft": () => `    // Setup for NFT minting
    let collectionRef = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &NFTContract.Collection>(from: /storage/NFTCollection)
      ?? panic("Could not borrow NFT collection reference")`,
      
      "transfer-flow": () => `    // Setup for FLOW transfer
    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &FlowToken.Vault>(from: /storage/flowTokenVault)
      ?? panic("Could not borrow FLOW vault reference")`
    }

    const generator = setupMap[action.actionType]
    return generator ? generator(action) : `    // Setup for ${action.actionType} - no specific setup required`
  }

  /**
   * Generate Cadence transaction code with dynamic Action integration
   */
  static async generateForteTransaction(workflow: EnhancedWorkflow): Promise<string> {
    const imports = await this.generateForteImports(workflow)
    const prepareBlock = await this.generateFortePrepareBlock(workflow)
    const executeBlock = await this.generateForteExecuteBlock(workflow)
    const resourceManagement = this.generateResourceManagement(workflow)

    return `${imports}

transaction() {
${prepareBlock}

${executeBlock}

${resourceManagement}
}`
  }

  /**
   * Generate import statements based on actions used
   */
  private static async generateImports(workflow: ParsedWorkflow): Promise<string> {
    const imports = new Set<string>()

    for (const action of workflow.actions) {
      const actionImports = await this.getActionImports(action.actionType, action.id)
      actionImports.forEach((imp) => imports.add(imp))
    }

    return Array.from(imports).join("\n")
  }

  /**
   * Generate dynamic imports for Forte Actions with error handling
   */
  private static async generateForteImports(workflow: EnhancedWorkflow): Promise<string> {
    const imports = new Set<string>()
    const dependencies = new Set<string>()

    // Add standard Flow imports
    imports.add('import "FungibleToken"')
    imports.add('import "NonFungibleToken"')
    imports.add('import "FlowToken"')

    for (const action of workflow.actions) {
      try {
        // Get Action metadata from discovery service
        const actionMetadata = await this.getDiscoveryService().getAction(action.id)
        if (actionMetadata) {
          // Add Action-specific imports
          if (actionMetadata.contractAddress) {
            imports.add(`import "${actionMetadata.name}" from ${actionMetadata.contractAddress}`)
          }

          // Add dependencies
          actionMetadata.dependencies.forEach(dep => dependencies.add(dep))
        }
      } catch (error) {
        // Log error and add fallback imports for this action
        logger.warn('Failed to get action metadata for imports, using fallback', {
          component: 'cadence-generator',
          operation: 'generate-forte-imports',
          metadata: { 
            actionId: action.id, 
            actionType: action.actionType,
            error: (error as Error).message 
          }
        })
        
        // Add fallback imports based on action type
        const fallbackImports = this.getStaticActionImports(action.actionType)
        fallbackImports.forEach(imp => imports.add(imp))
      }
    }

    // Add dependency imports
    for (const dep of dependencies) {
      try {
        const depAction = await this.getDiscoveryService().getAction(dep)
        if (depAction && depAction.contractAddress) {
          imports.add(`import "${depAction.name}" from ${depAction.contractAddress}`)
        }
      } catch (error) {
        logger.warn('Failed to get dependency action for imports', {
          component: 'cadence-generator',
          operation: 'generate-forte-imports',
          metadata: { dependency: dep, error: (error as Error).message }
        })
      }
    }

    return Array.from(imports).join("\n")
  }

  /**
   * Get required imports for each action type with error handling
   */
  private static async getActionImports(actionType: string, actionId?: string): Promise<string[]> {
    // Try to get dynamic imports from discovered Actions first
    if (actionId) {
      try {
        const actionMetadata = await this.getDiscoveryService().getAction(actionId)
        if (actionMetadata) {
          const imports: string[] = []
          if (actionMetadata.contractAddress) {
            imports.push(`import "${actionMetadata.name}" from ${actionMetadata.contractAddress}`)
          }
          // Add dependency imports
          for (const dep of actionMetadata.dependencies) {
            try {
              const depAction = await this.getDiscoveryService().getAction(dep)
              if (depAction && depAction.contractAddress) {
                imports.push(`import "${depAction.name}" from ${depAction.contractAddress}`)
              }
            } catch (depError) {
              // Log dependency error but continue
              logger.warn('Failed to get dependency action', {
                component: 'cadence-generator',
                operation: 'get-action-imports',
                metadata: { dependency: dep, error: (depError as Error).message }
              })
            }
          }
          return imports
        }
      } catch (error) {
        // Log error but fall back to static imports
        logger.warn('Failed to get dynamic action imports, using static fallback', {
          component: 'cadence-generator',
          operation: 'get-action-imports',
          metadata: { actionId, actionType, error: (error as Error).message }
        })
      }
    }

    // Fallback to static imports for backward compatibility
    return this.getStaticActionImports(actionType)
  }

  /**
   * Generate prepare block with resource setup
   */
  private static async generatePrepareBlock(workflow: ParsedWorkflow): Promise<string> {
    const lines: string[] = ["  prepare(signer: auth(Storage, Contracts) &Account) {"]

    // Add workflow metadata comment
    lines.push(`    // Workflow: ${workflow.metadata.totalActions} actions`)
    lines.push(`    // Execution order: ${workflow.executionOrder.join(" -> ")}`)
    lines.push("")

    // Setup resources for each action
    for (let i = 0; i < workflow.actions.length; i++) {
      const action = workflow.actions[i]
      lines.push(`    // Action ${i + 1}: ${action.name}`)
      const setup = await this.generateActionSetup(action)
      if (setup) {
        lines.push(setup)
      }
    }

    lines.push("  }")

    return lines.join("\n")
  }

  /**
   * Generate Forte-specific prepare block with dynamic resource management
   */
  private static async generateFortePrepareBlock(workflow: EnhancedWorkflow): Promise<string> {
    const lines: string[] = ["  prepare(signer: auth(Storage, Contracts) &Account) {"]

    // Add enhanced workflow metadata
    lines.push(`    // Enhanced Workflow: ${workflow.metadata.totalActions} actions`)
    lines.push(`    // Security Level: ${workflow.securityLevel}`)
    lines.push(`    // Estimated Gas: ${workflow.estimatedGas}`)
    lines.push(`    // Execution order: ${workflow.executionOrder.join(" -> ")}`)
    lines.push("")

    // Add resource safety checks
    lines.push("    // Resource safety validation")
    lines.push("    pre {")
    lines.push("      signer.address != nil: \"Invalid signer address\"")
    
    // Add balance requirements validation
    if (workflow.requiredBalance && workflow.requiredBalance.length > 0) {
      for (const balance of workflow.requiredBalance) {
        lines.push(`      // Validate ${balance.token} balance requirement`)
        lines.push(`      // Required: ${balance.amount}`)
      }
    }
    
    lines.push("    }")
    lines.push("")

    // Setup resources for each action with enhanced metadata
    for (let i = 0; i < workflow.actions.length; i++) {
      const action = workflow.actions[i]
      let actionMetadata: ActionMetadata | undefined
      
      try {
        actionMetadata = await this.getDiscoveryService().getAction(action.id)
      } catch (error) {
        logger.warn('Failed to get action metadata for prepare block', {
          component: 'cadence-generator',
          operation: 'generate-forte-prepare-block',
          metadata: { 
            actionId: action.id, 
            actionType: action.actionType,
            error: (error as Error).message 
          }
        })
      }
      
      lines.push(`    // Action ${i + 1}: ${action.name}`)
      if (actionMetadata) {
        lines.push(`    // Contract: ${actionMetadata.contractAddress}`)
        lines.push(`    // Gas Estimate: ${actionMetadata.gasEstimate}`)
        lines.push(`    // Security Level: ${actionMetadata.securityLevel}`)
      } else {
        lines.push(`    // Metadata unavailable - using fallback setup`)
      }
      
      const setup = await this.generateForteActionSetup(action, actionMetadata)
      if (setup) {
        lines.push(setup)
      }
      lines.push("")
    }

    lines.push("  }")

    return lines.join("\n")
  }

  /**
   * Generate execute block with action logic
   */
  private static async generateExecuteBlock(workflow: ParsedWorkflow): Promise<string> {
    const lines: string[] = ["  execute {"]
    lines.push("    // Execute actions in order")
    lines.push("")

    for (const actionId of workflow.executionOrder) {
      const action = workflow.actions.find((a) => a.id === actionId)
      if (action) {
        lines.push(`    // ${action.name}`)
        const code = await this.generateActionCode(action)
        lines.push(code)
        lines.push("")
      }
    }

    lines.push('    log("Workflow execution completed successfully")')
    lines.push("  }")

    return lines.join("\n")
  }

  /**
   * Generate Forte-specific execute block with enhanced error handling
   */
  private static async generateForteExecuteBlock(workflow: EnhancedWorkflow): Promise<string> {
    const lines: string[] = ["  execute {"]
    lines.push("    // Execute Forte Actions with enhanced error handling")
    lines.push("")

    // Add pre-execution validation
    lines.push("    // Pre-execution validation")
    lines.push("    assert(signer.address != nil, message: \"Invalid signer\")")
    lines.push("")

    for (const actionId of workflow.executionOrder) {
      const action = workflow.actions.find((a) => a.id === actionId)
      if (action) {
        let actionMetadata: ActionMetadata | undefined
        
        try {
          actionMetadata = await this.getDiscoveryService().getAction(action.id)
        } catch (error) {
          logger.warn('Failed to get action metadata for execute block', {
            component: 'cadence-generator',
            operation: 'generate-forte-execute-block',
            metadata: { 
              actionId: action.id, 
              actionType: action.actionType,
              error: (error as Error).message 
            }
          })
        }
        
        lines.push(`    // Execute: ${action.name}`)
        if (actionMetadata) {
          lines.push(`    // Action ID: ${actionMetadata.id}`)
          lines.push(`    // Version: ${actionMetadata.version}`)
        } else {
          lines.push(`    // Metadata unavailable - using fallback execution`)
        }
        
        // Add error handling wrapper
        lines.push("    do {")
        const code = await this.generateForteActionCode(action, actionMetadata)
        lines.push("      " + code.split('\n').join('\n      '))
        lines.push("    } catch (error) {")
        lines.push(`      panic("Action ${action.name} failed: ".concat(error.message))`)
        lines.push("    }")
        lines.push("")
      }
    }

    lines.push('    log("Enhanced workflow execution completed successfully")')
    lines.push("  }")

    return lines.join("\n")
  }

  /**
   * Generate setup code for specific action with error handling
   */
  private static async generateActionSetup(action: ParsedAction): Promise<string> {
    // Try to get dynamic setup from discovered Actions first
    try {
      const actionMetadata = await this.getDiscoveryService().getAction(action.id)
      if (actionMetadata) {
        return this.generateForteActionSetup(action, actionMetadata)
      }
    } catch (error) {
      // Log error but continue with static setup
      logger.warn('Failed to get action metadata for setup, using static fallback', {
        component: 'cadence-generator',
        operation: 'generate-action-setup',
        metadata: { 
          actionId: action.id, 
          actionType: action.actionType,
          error: (error as Error).message 
        }
      })
    }

    // Fallback to static setup for backward compatibility
    return this.generateStaticActionSetup(action)
  }

  /**
   * Generate Forte-specific action setup with dynamic resource management
   */
  private static async generateForteActionSetup(action: ParsedAction, actionMetadata?: ActionMetadata): Promise<string> {
    if (!actionMetadata) {
      return `    // Setup for ${action.name} - metadata not available`
    }

    const lines: string[] = []

    // Generate resource setup based on Action inputs
    for (const input of actionMetadata.inputs) {
      if (input.type.includes('Vault') || input.type.includes('FungibleToken')) {
        lines.push(`    let ${input.name}Ref = signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(from: /storage/${input.name}Vault)`)
        lines.push(`      ?? panic("Could not borrow ${input.name} vault reference")`)
      } else if (input.type.includes('Collection') || input.type.includes('NonFungibleToken')) {
        lines.push(`    let ${input.name}Ref = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(from: /storage/${input.name}Collection)`)
        lines.push(`      ?? panic("Could not borrow ${input.name} collection reference")`)
      } else if (input.type.includes('Capability')) {
        lines.push(`    let ${input.name}Cap = signer.capabilities.get<&{${input.type}}>(${input.name}Path)`)
        lines.push(`      ?? panic("Could not get ${input.name} capability")`)
      }
    }

    // Add parameter validation
    for (const param of action.parameters) {
      if (param.required && !param.value) {
        lines.push(`    assert(${param.name} != nil, message: "Required parameter ${param.name} is missing")`)
      }
    }

    return lines.join('\n    ')
  }

  /**
   * Generate execution code for specific action with error handling
   */
  private static async generateActionCode(action: ParsedAction): Promise<string> {
    // Try to get dynamic code from discovered Actions first
    try {
      const actionMetadata = await this.getDiscoveryService().getAction(action.id)
      if (actionMetadata) {
        return this.generateForteActionCode(action, actionMetadata)
      }
    } catch (error) {
      // Log error but continue with static code generation
      logger.warn('Failed to get action metadata for code generation, using static fallback', {
        component: 'cadence-generator',
        operation: 'generate-action-code',
        metadata: { 
          actionId: action.id, 
          actionType: action.actionType,
          error: (error as Error).message 
        }
      })
    }

    // Fallback to static code generation
    return this.generateStaticActionCode(action)
  }

  /**
   * Generate static action code for backward compatibility
   */
  private static generateStaticActionCode(action: ParsedAction): string {
    const codeMap: Record<string, (action: ParsedAction) => string> = {
      "swap-tokens": (a) => {
        const fromToken = a.parameters.find((p) => p.name === "fromToken")?.value || "0x0"
        const toToken = a.parameters.find((p) => p.name === "toToken")?.value || "0x0"
        const amount = a.parameters.find((p) => p.name === "amount")?.value || "0.0"
        const slippage = a.parameters.find((p) => p.name === "slippage")?.value || "0.01"

        return `    SwapRouter.swap(
      fromToken: ${fromToken},
      toToken: ${toToken},
      amount: ${amount},
      slippage: ${slippage}
    )`
      },
      "add-liquidity": (a) => {
        const tokenA = a.parameters.find((p) => p.name === "tokenA")?.value || "0x0"
        const tokenB = a.parameters.find((p) => p.name === "tokenB")?.value || "0x0"
        const amountA = a.parameters.find((p) => p.name === "amountA")?.value || "0.0"
        const amountB = a.parameters.find((p) => p.name === "amountB")?.value || "0.0"

        return `    LiquidityPool.addLiquidity(
      tokenA: ${tokenA},
      tokenB: ${tokenB},
      amountA: ${amountA},
      amountB: ${amountB}
    )`
      },
      "stake-tokens": (a) => {
        const token = a.parameters.find((p) => p.name === "token")?.value || "0x0"
        const amount = a.parameters.find((p) => p.name === "amount")?.value || "0.0"

        return `    StakingContract.stake(
      token: ${token},
      amount: ${amount}
    )`
      },
      "mint-nft": (a) => {
        const metadata = a.parameters.find((p) => p.name === "metadata")?.value || '""'

        return `    NFTContract.mintNFT(
      recipient: signer.address,
      metadata: ${metadata}
    )`
      },
      "transfer-nft": (a) => {
        const nftId = a.parameters.find((p) => p.name === "nftId")?.value || "0"
        const recipient = a.parameters.find((p) => p.name === "recipient")?.value || "0x0"

        return `    NonFungibleToken.transfer(
      id: ${nftId},
      recipient: ${recipient}
    )`
      },
      "list-nft": (a) => {
        const nftId = a.parameters.find((p) => p.name === "nftId")?.value || "0"
        const price = a.parameters.find((p) => p.name === "price")?.value || "0.0"

        return `    NFTMarketplace.listNFT(
      id: ${nftId},
      price: ${price}
    )`
      },
      "create-proposal": (a) => {
        const title = a.parameters.find((p) => p.name === "title")?.value || '""'
        const description = a.parameters.find((p) => p.name === "description")?.value || '""'

        return `    GovernanceContract.createProposal(
      title: ${title},
      description: ${description}
    )`
      },
      vote: (a) => {
        const proposalId = a.parameters.find((p) => p.name === "proposalId")?.value || "0"
        const choice = a.parameters.find((p) => p.name === "choice")?.value || "true"

        return `    GovernanceContract.vote(
      proposalId: ${proposalId},
      choice: ${choice}
    )`
      },
    }

    const generator = codeMap[action.actionType]
    return generator ? generator(action) : `    // TODO: Implement ${action.actionType}`
  }

  /**
   * Generate Forte-specific action code with dynamic integration
   */
  private static async generateForteActionCode(action: ParsedAction, actionMetadata?: ActionMetadata): Promise<string> {
    if (!actionMetadata) {
      return `// Action ${action.name} - metadata not available`
    }

    const lines: string[] = []
    
    // Generate function call based on Action metadata
    const functionName = actionMetadata.name.charAt(0).toLowerCase() + actionMetadata.name.slice(1)
    const contractName = actionMetadata.name
    
    // Build parameter list from action parameters
    const params: string[] = []
    for (const param of action.parameters) {
      if (param.value) {
        // Type conversion based on parameter type
        let value = param.value
        if (param.type === 'UFix64' || param.type === 'Fix64') {
          value = `${param.value}`
        } else if (param.type === 'String') {
          value = `"${param.value}"`
        } else if (param.type === 'Address') {
          value = param.value.startsWith('0x') ? param.value : `0x${param.value}`
        } else if (param.type === 'Bool') {
          value = param.value.toLowerCase() === 'true' ? 'true' : 'false'
        }
        params.push(`${param.name}: ${value}`)
      }
    }

    // Generate the function call
    if (params.length > 0) {
      lines.push(`${contractName}.${functionName}(`)
      params.forEach((param, index) => {
        const comma = index < params.length - 1 ? ',' : ''
        lines.push(`  ${param}${comma}`)
      })
      lines.push(')')
    } else {
      lines.push(`${contractName}.${functionName}()`)
    }

    return lines.join('\n')
  }

  /**
   * Generate resource management code for complex Action chains
   */
  private static generateResourceManagement(workflow: EnhancedWorkflow): string {
    const lines: string[] = []
    
    lines.push("  // Resource cleanup and management")
    lines.push("  post {")
    lines.push("    // Ensure no resources are left dangling")
    lines.push("    result != nil: \"Transaction must return a result\"")
    
    // Add specific resource checks based on workflow
    if (workflow.actions.some(a => a.actionType.includes('nft'))) {
      lines.push("    // NFT resource safety checks")
      lines.push("    // Ensure all NFT resources are properly handled")
    }
    
    if (workflow.actions.some(a => a.actionType.includes('token') || a.actionType.includes('swap'))) {
      lines.push("    // Token resource safety checks")
      lines.push("    // Ensure all token vaults are properly managed")
    }
    
    lines.push("  }")
    
    return lines.join('\n')
  }



  /**
   * Generate script (read-only query) instead of transaction
   */
  static async generateScript(workflow: ParsedWorkflow): Promise<string> {
    const imports = await this.generateImports(workflow)

    return `${imports}

access(all) fun main(): String {
  // Query workflow data
  log("Querying workflow state")
  
  return "Workflow query completed"
}`
  }

  /**
   * Generate Forte-specific script with dynamic Action queries
   */
  static async generateForteScript(workflow: EnhancedWorkflow): Promise<string> {
    const imports = await this.generateForteImports(workflow)

    const lines: string[] = []
    lines.push(`${imports}`)
    lines.push("")
    lines.push("access(all) fun main(): {String: AnyStruct} {")
    lines.push("  let result: {String: AnyStruct} = {}")
    lines.push("")
    
    // Generate queries for each action
    for (const action of workflow.actions) {
      const actionMetadata = await this.getDiscoveryService().getAction(action.id)
      if (actionMetadata) {
        lines.push(`  // Query ${action.name}`)
        lines.push(`  result["${action.id}"] = ${actionMetadata.name}.getActionInfo()`)
      }
    }
    
    lines.push("")
    lines.push("  return result")
    lines.push("}")

    return lines.join('\n')
  }

  /**
   * Generate Agent deployment transaction
   */
  static async generateAgentDeployment(workflow: EnhancedWorkflow): Promise<string> {
    const imports = await this.generateAgentImports(workflow)
    const agentResource = await this.generateAgentResource(workflow)
    const deploymentTransaction = this.generateAgentDeploymentTransaction(workflow)

    return `${imports}

${agentResource}

${deploymentTransaction}`
  }

  /**
   * Generate imports for Agent deployment
   */
  private static async generateAgentImports(workflow: EnhancedWorkflow): Promise<string> {
    const imports = new Set<string>()
    
    // Standard Agent imports
    imports.add('import "ForteAgent"')
    imports.add('import "ForteScheduler"')
    imports.add('import "FungibleToken"')
    imports.add('import "NonFungibleToken"')
    
    // Add workflow-specific imports
    const workflowImports = await this.generateForteImports(workflow)
    workflowImports.split('\n').forEach(imp => {
      if (imp.trim()) imports.add(imp.trim())
    })

    return Array.from(imports).join('\n')
  }

  /**
   * Generate Agent resource definition
   */
  private static async generateAgentResource(workflow: EnhancedWorkflow): Promise<string> {
    const lines: string[] = []
    
    lines.push("// Agent resource for automated workflow execution")
    lines.push(`pub resource ${workflow.metadata.name || 'WorkflowAgent'}: ForteAgent.IAgent {`)
    lines.push(`  pub let id: String`)
    lines.push(`  pub let workflowId: String`)
    lines.push(`  pub let name: String`)
    lines.push(`  pub var isActive: Bool`)
    lines.push(`  pub let schedule: ForteScheduler.Schedule`)
    lines.push(`  pub let triggers: [ForteScheduler.EventTrigger]`)
    lines.push("")
    
    // Constructor
    lines.push("  init(")
    lines.push("    id: String,")
    lines.push("    workflowId: String,")
    lines.push("    name: String,")
    lines.push("    schedule: ForteScheduler.Schedule,")
    lines.push("    triggers: [ForteScheduler.EventTrigger]")
    lines.push("  ) {")
    lines.push("    self.id = id")
    lines.push("    self.workflowId = workflowId")
    lines.push("    self.name = name")
    lines.push("    self.isActive = true")
    lines.push("    self.schedule = schedule")
    lines.push("    self.triggers = triggers")
    lines.push("  }")
    lines.push("")
    
    // Execute function
    lines.push("  pub fun execute(): ForteAgent.ExecutionResult {")
    lines.push("    pre {")
    lines.push("      self.isActive: \"Agent is not active\"")
    lines.push("    }")
    lines.push("")
    lines.push("    // Execute workflow logic")
    lines.push("    do {")
    
    // Add workflow execution logic
    lines.push("      // Execute workflow actions")
    for (const actionId of workflow.executionOrder) {
      const action = workflow.actions.find(a => a.id === actionId)
      if (action) {
        lines.push(`      // Execute ${action.name}`)
        lines.push(`      ${action.actionType}(/* parameters */)`)
      }
    }
    
    lines.push("")
    lines.push("      return ForteAgent.ExecutionResult(")
    lines.push("        success: true,")
    lines.push("        message: \"Workflow executed successfully\",")
    lines.push("        timestamp: getCurrentBlock().timestamp")
    lines.push("      )")
    lines.push("    } catch (error) {")
    lines.push("      return ForteAgent.ExecutionResult(")
    lines.push("        success: false,")
    lines.push("        message: \"Execution failed: \".concat(error.message),")
    lines.push("        timestamp: getCurrentBlock().timestamp")
    lines.push("      )")
    lines.push("    }")
    lines.push("  }")
    lines.push("")
    
    // Schedule management functions
    lines.push("  pub fun updateSchedule(newSchedule: ForteScheduler.Schedule) {")
    lines.push("    self.schedule = newSchedule")
    lines.push("  }")
    lines.push("")
    lines.push("  pub fun pause() {")
    lines.push("    self.isActive = false")
    lines.push("  }")
    lines.push("")
    lines.push("  pub fun resume() {")
    lines.push("    self.isActive = true")
    lines.push("  }")
    lines.push("")
    lines.push("  pub fun destroy() {")
    lines.push("    // Cleanup resources")
    lines.push("    destroy self")
    lines.push("  }")
    lines.push("}")
    
    return lines.join('\n')
  }

  /**
   * Generate Agent deployment transaction
   */
  private static generateAgentDeploymentTransaction(workflow: EnhancedWorkflow): string {
    const lines: string[] = []
    
    lines.push("transaction(")
    lines.push("  agentId: String,")
    lines.push("  agentName: String,")
    lines.push("  scheduleType: String,")
    lines.push("  scheduleInterval: UInt64?,")
    lines.push("  cronExpression: String?,")
    lines.push("  eventTriggers: [String]")
    lines.push(") {")
    lines.push("")
    lines.push("  prepare(signer: auth(Storage, Contracts) &Account) {")
    lines.push("    // Create schedule based on type")
    lines.push("    let schedule: ForteScheduler.Schedule")
    lines.push("    switch scheduleType {")
    lines.push("      case \"recurring\":")
    lines.push("        schedule = ForteScheduler.RecurringSchedule(")
    lines.push("          interval: scheduleInterval ?? 3600 // Default 1 hour")
    lines.push("        )")
    lines.push("      case \"cron\":")
    lines.push("        schedule = ForteScheduler.CronSchedule(")
    lines.push("          expression: cronExpression ?? \"0 * * * *\" // Default hourly")
    lines.push("        )")
    lines.push("      default:")
    lines.push("        schedule = ForteScheduler.OneTimeSchedule()")
    lines.push("    }")
    lines.push("")
    lines.push("    // Create event triggers")
    lines.push("    let triggers: [ForteScheduler.EventTrigger] = []")
    lines.push("    for triggerType in eventTriggers {")
    lines.push("      let trigger = ForteScheduler.EventTrigger(type: triggerType)")
    lines.push("      triggers.append(trigger)")
    lines.push("    }")
    lines.push("")
    lines.push("    // Create Agent resource")
    lines.push(`    let agent <- create ${workflow.metadata.name || 'WorkflowAgent'}(`)
    lines.push("      id: agentId,")
    lines.push(`      workflowId: "${workflow.metadata.name || 'unknown'}",`)
    lines.push("      name: agentName,")
    lines.push("      schedule: schedule,")
    lines.push("      triggers: triggers")
    lines.push("    )")
    lines.push("")
    lines.push("    // Store Agent in account storage")
    lines.push("    let agentStoragePath = StoragePath(identifier: \"ForteAgent_\".concat(agentId))")
    lines.push("      ?? panic(\"Invalid storage path for agent\")")
    lines.push("")
    lines.push("    signer.storage.save(<-agent, to: agentStoragePath)")
    lines.push("")
    lines.push("    // Create public capability for Agent management")
    lines.push("    let agentPublicPath = PublicPath(identifier: \"ForteAgent_\".concat(agentId))")
    lines.push("      ?? panic(\"Invalid public path for agent\")")
    lines.push("")
    lines.push("    signer.capabilities.publish(")
    lines.push("      signer.capabilities.storage.issue<&ForteAgent.IAgent>(agentStoragePath),")
    lines.push("      at: agentPublicPath")
    lines.push("    )")
    lines.push("  }")
    lines.push("")
    lines.push("  execute {")
    lines.push("    // Register Agent with scheduler")
    lines.push("    ForteScheduler.registerAgent(agentId: agentId)")
    lines.push("    log(\"Agent deployed successfully with ID: \".concat(agentId))")
    lines.push("  }")
    lines.push("}")
    
    return lines.join('\n')
  }

  /**
   * Generate scheduling logic for recurring workflows
   */
  static generateSchedulingLogic(agentConfig: AgentConfiguration): string {
    const lines: string[] = []
    
    lines.push("// Scheduling logic generation")
    lines.push("pub struct ScheduleConfig {")
    lines.push("  pub let type: String")
    lines.push("  pub let interval: UInt64?")
    lines.push("  pub let cronExpression: String?")
    lines.push("  pub let startTime: UFix64?")
    lines.push("  pub let endTime: UFix64?")
    lines.push("")
    
    // Constructor based on schedule type
    lines.push("  init(schedule: Schedule) {")
    lines.push("    switch schedule.type {")
    lines.push("      case \"recurring\":")
    lines.push("        self.type = \"recurring\"")
    lines.push(`        self.interval = ${agentConfig.schedule.interval || 3600}`)
    lines.push("        self.cronExpression = nil")
    lines.push("      case \"event-driven\":")
    lines.push("        self.type = \"event-driven\"")
    lines.push("        self.interval = nil")
    lines.push("        self.cronExpression = nil")
    lines.push("      default:")
    lines.push("        self.type = \"one-time\"")
    lines.push("        self.interval = nil")
    lines.push("        self.cronExpression = nil")
    lines.push("    }")
    
    if (agentConfig.schedule.startTime) {
      lines.push(`    self.startTime = ${agentConfig.schedule.startTime.getTime() / 1000}`)
    } else {
      lines.push("    self.startTime = getCurrentBlock().timestamp")
    }
    
    if (agentConfig.schedule.endTime) {
      lines.push(`    self.endTime = ${agentConfig.schedule.endTime.getTime() / 1000}`)
    } else {
      lines.push("    self.endTime = nil")
    }
    
    lines.push("  }")
    lines.push("}")
    
    return lines.join('\n')
  }

  /**
   * Generate event trigger code for oracle-based automation
   */
  static generateEventTriggerCode(triggers: EventTrigger[]): string {
    const lines: string[] = []
    
    lines.push("// Event trigger code generation")
    lines.push("pub struct EventTriggerConfig {")
    lines.push("  pub let triggers: [TriggerDefinition]")
    lines.push("")
    lines.push("  pub struct TriggerDefinition {")
    lines.push("    pub let type: String")
    lines.push("    pub let condition: String")
    lines.push("    pub let value: AnyStruct")
    lines.push("    pub let oracleAction: String?")
    lines.push("")
    lines.push("    init(type: String, condition: String, value: AnyStruct, oracleAction: String?) {")
    lines.push("      self.type = type")
    lines.push("      self.condition = condition")
    lines.push("      self.value = value")
    lines.push("      self.oracleAction = oracleAction")
    lines.push("    }")
    lines.push("  }")
    lines.push("")
    lines.push("  init() {")
    lines.push("    self.triggers = []")
    
    // Generate trigger definitions
    for (const trigger of triggers) {
      lines.push("    self.triggers.append(TriggerDefinition(")
      lines.push(`      type: "${trigger.type}",`)
      lines.push(`      condition: "${trigger.condition.operator}",`)
      lines.push(`      value: ${JSON.stringify(trigger.condition.value)},`)
      lines.push(`      oracleAction: ${trigger.oracleAction ? `"${trigger.oracleAction}"` : 'nil'}`)
      lines.push("    ))")
    }
    
    lines.push("  }")
    lines.push("")
    lines.push("  pub fun evaluateTriggers(): Bool {")
    lines.push("    for trigger in self.triggers {")
    lines.push("      if !self.evaluateTrigger(trigger) {")
    lines.push("        return false")
    lines.push("      }")
    lines.push("    }")
    lines.push("    return true")
    lines.push("  }")
    lines.push("")
    lines.push("  priv fun evaluateTrigger(_ trigger: TriggerDefinition): Bool {")
    lines.push("    // Implement trigger evaluation logic")
    lines.push("    switch trigger.type {")
    lines.push("      case \"price\":")
    lines.push("        return self.evaluatePriceTrigger(trigger)")
    lines.push("      case \"balance\":")
    lines.push("        return self.evaluateBalanceTrigger(trigger)")
    lines.push("      case \"time\":")
    lines.push("        return self.evaluateTimeTrigger(trigger)")
    lines.push("      default:")
    lines.push("        return true")
    lines.push("    }")
    lines.push("  }")
    lines.push("")
    lines.push("  // Trigger evaluation methods would be implemented here")
    lines.push("  priv fun evaluatePriceTrigger(_ trigger: TriggerDefinition): Bool { return true }")
    lines.push("  priv fun evaluateBalanceTrigger(_ trigger: TriggerDefinition): Bool { return true }")
    lines.push("  priv fun evaluateTimeTrigger(_ trigger: TriggerDefinition): Bool { return true }")
    lines.push("}")
    
    return lines.join('\n')
  }

  /**
   * Generate security-focused Cadence code with best practices
   */
  static async generateSecureTransaction(workflow: EnhancedWorkflow): Promise<string> {
    const imports = await this.generateSecureImports(workflow)
    const securityChecks = this.generateSecurityChecks(workflow)
    const prepareBlock = await this.generateSecurePrepareBlock(workflow)
    const executeBlock = await this.generateSecureExecuteBlock(workflow)
    const postConditions = this.generatePostConditions(workflow)

    return `${imports}

${securityChecks}

transaction() {
${prepareBlock}

${executeBlock}

${postConditions}
}`
  }

  /**
   * Generate secure imports with security validation
   */
  private static async generateSecureImports(workflow: EnhancedWorkflow): Promise<string> {
    const imports = new Set<string>()
    
    // Add security-focused imports
    imports.add('import "SecurityUtils"')
    imports.add('import "InputValidator"')
    imports.add('import "ResourceSafety"')
    
    // Add standard imports
    const standardImports = await this.generateForteImports(workflow)
    standardImports.split('\n').forEach(imp => {
      if (imp.trim()) imports.add(imp.trim())
    })

    return Array.from(imports).join('\n')
  }

  /**
   * Generate comprehensive security checks
   */
  private static generateSecurityChecks(workflow: EnhancedWorkflow): string {
    const lines: string[] = []
    
    lines.push("// Security validation functions")
    lines.push("pub fun validateWorkflowSecurity(): Bool {")
    lines.push("  // Validate workflow security level")
    lines.push(`  let requiredSecurityLevel = "${workflow.securityLevel}"`)
    lines.push("  ")
    lines.push("  // Check gas limits to prevent DoS")
    lines.push(`  let estimatedGas = ${workflow.estimatedGas}`)
    lines.push("  if estimatedGas > 10000 {")
    lines.push("    panic(\"Gas estimate exceeds safety limit\")")
    lines.push("  }")
    lines.push("")
    
    // Add balance validation
    if (workflow.requiredBalance && workflow.requiredBalance.length > 0) {
      lines.push("  // Validate required balances")
      for (const balance of workflow.requiredBalance) {
        lines.push(`  // ${balance.token}: ${balance.amount}`)
      }
    }
    
    lines.push("  return true")
    lines.push("}")
    lines.push("")
    
    // Input sanitization function
    lines.push("pub fun sanitizeInput(input: String): String {")
    lines.push("  // Remove potentially dangerous characters")
    lines.push("  let dangerous = [\"<\", \">\", \"&\", \"'\", '\"', \"script\", \"eval\"]")
    lines.push("  var sanitized = input")
    lines.push("  ")
    lines.push("  for char in dangerous {")
    lines.push("    sanitized = sanitized.replaceAll(of: char, with: \"\")")
    lines.push("  }")
    lines.push("  ")
    lines.push("  return sanitized")
    lines.push("}")
    
    return lines.join('\n')
  }

  /**
   * Generate secure prepare block with input validation
   */
  private static async generateSecurePrepareBlock(workflow: EnhancedWorkflow): Promise<string> {
    const lines: string[] = ["  prepare(signer: auth(Storage, Contracts) &Account) {"]

    // Add security validation
    lines.push("    // Security validation")
    lines.push("    assert(validateWorkflowSecurity(), message: \"Workflow security validation failed\")")
    lines.push("")
    
    // Add signer validation
    lines.push("    // Signer validation")
    lines.push("    assert(signer.address != nil, message: \"Invalid signer address\")")
    lines.push("    assert(signer.balance >= 0.001, message: \"Insufficient balance for transaction fees\")")
    lines.push("")

    // Add workflow metadata with security info
    lines.push(`    // Secure Workflow: ${workflow.metadata.totalActions} actions`)
    lines.push(`    // Security Level: ${workflow.securityLevel}`)
    lines.push(`    // Estimated Gas: ${workflow.estimatedGas}`)
    lines.push(`    // Execution order: ${workflow.executionOrder.join(" -> ")}`)
    lines.push("")

    // Add input sanitization for each action
    for (let i = 0; i < workflow.actions.length; i++) {
      const action = workflow.actions[i]
      const actionMetadata = await this.getDiscoveryService().getAction(action.id)
      
      lines.push(`    // Secure Action ${i + 1}: ${action.name}`)
      if (actionMetadata) {
        lines.push(`    // Security Audit: ${actionMetadata.securityAudit?.status || 'pending'}`)
        lines.push(`    // Security Score: ${actionMetadata.securityAudit?.score || 0}/100`)
      }
      
      // Sanitize action parameters
      lines.push("    // Parameter sanitization")
      for (const param of action.parameters) {
        if (param.type === 'String' && param.value) {
          lines.push(`    let sanitized${param.name} = sanitizeInput("${param.value}")`)
        }
      }
      
      const setup = await this.generateSecureActionSetup(action, actionMetadata)
      if (setup) {
        lines.push(setup)
      }
      lines.push("")
    }

    lines.push("  }")

    return lines.join("\n")
  }

  /**
   * Generate secure action setup with resource safety
   */
  private static async generateSecureActionSetup(action: ParsedAction, actionMetadata?: ActionMetadata): Promise<string> {
    if (!actionMetadata) {
      return `    // Secure setup for ${action.name} - metadata not available`
    }

    const lines: string[] = []

    // Add security checks for the action
    lines.push(`    // Security checks for ${action.name}`)
    if (actionMetadata.securityAudit) {
      if (actionMetadata.securityAudit.status === 'failed') {
        lines.push(`    panic("Action ${action.name} failed security audit")`)
        return lines.join('\n    ')
      } else if (actionMetadata.securityAudit.status === 'warning') {
        lines.push(`    log("Warning: Action ${action.name} has security warnings")`)
      }
    }

    // Generate secure resource setup
    for (const input of actionMetadata.inputs) {
      if (input.type.includes('Vault') || input.type.includes('FungibleToken')) {
        lines.push(`    // Secure vault access for ${input.name}`)
        lines.push(`    let ${input.name}Ref = signer.storage.borrow<auth(FungibleToken.Withdraw) &{FungibleToken.Vault}>(from: /storage/${input.name}Vault)`)
        lines.push(`      ?? panic("Could not borrow ${input.name} vault reference")`)
        lines.push(`    assert(${input.name}Ref.balance > 0.0, message: "${input.name} vault is empty")`)
      } else if (input.type.includes('Collection') || input.type.includes('NonFungibleToken')) {
        lines.push(`    // Secure collection access for ${input.name}`)
        lines.push(`    let ${input.name}Ref = signer.storage.borrow<auth(NonFungibleToken.Withdraw) &{NonFungibleToken.Collection}>(from: /storage/${input.name}Collection)`)
        lines.push(`      ?? panic("Could not borrow ${input.name} collection reference")`)
        lines.push(`    assert(${input.name}Ref.getIDs().length > 0, message: "${input.name} collection is empty")`)
      }
    }

    // Add parameter validation with security checks
    for (const param of action.parameters) {
      if (param.required && !param.value) {
        lines.push(`    panic("Required parameter ${param.name} is missing")`)
      } else if (param.value) {
        // Add type-specific validation
        if (param.type === 'UFix64' || param.type === 'Fix64') {
          lines.push(`    assert(${param.value} >= 0.0, message: "Amount must be positive")`)
          lines.push(`    assert(${param.value} <= 1000000.0, message: "Amount exceeds maximum limit")`)
        } else if (param.type === 'Address') {
          lines.push(`    assert(${param.value} != 0x0, message: "Invalid address")`)
        } else if (param.type === 'String') {
          lines.push(`    assert(sanitized${param.name}.length > 0, message: "String parameter cannot be empty")`)
          lines.push(`    assert(sanitized${param.name}.length <= 1000, message: "String parameter too long")`)
        }
      }
    }

    return lines.join('\n    ')
  }

  /**
   * Generate secure execute block with error handling
   */
  private static async generateSecureExecuteBlock(workflow: EnhancedWorkflow): Promise<string> {
    const lines: string[] = ["  execute {"]
    lines.push("    // Secure execution with comprehensive error handling")
    lines.push("")

    // Add pre-execution security validation
    lines.push("    // Pre-execution security validation")
    lines.push("    ResourceSafety.validateResourceState()")
    lines.push("")

    for (const actionId of workflow.executionOrder) {
      const action = workflow.actions.find((a) => a.id === actionId)
      if (action) {
        const actionMetadata = await this.getDiscoveryService().getAction(action.id)
        
        lines.push(`    // Secure execution: ${action.name}`)
        if (actionMetadata) {
          lines.push(`    // Action ID: ${actionMetadata.id}`)
          lines.push(`    // Version: ${actionMetadata.version}`)
          lines.push(`    // Security Level: ${actionMetadata.securityLevel}`)
        }
        
        // Add comprehensive error handling with security context
        lines.push("    do {")
        lines.push("      // Pre-action security check")
        lines.push(`      SecurityUtils.validateActionExecution("${action.id}")`)
        lines.push("")
        
        const code = await this.generateSecureActionCode(action, actionMetadata)
        lines.push("      " + code.split('\n').join('\n      '))
        
        lines.push("")
        lines.push("      // Post-action security validation")
        lines.push("      ResourceSafety.validateResourceState()")
        lines.push("    } catch (error) {")
        lines.push("      // Security-aware error handling")
        lines.push(`      log("Security error in action ${action.name}: ".concat(error.message))`)
        lines.push("      // Attempt to recover resources safely")
        lines.push("      ResourceSafety.emergencyCleanup()")
        lines.push(`      panic("Secure execution failed for ${action.name}: ".concat(error.message))`)
        lines.push("    }")
        lines.push("")
      }
    }

    lines.push('    log("Secure workflow execution completed successfully")')
    lines.push("  }")

    return lines.join("\n")
  }

  /**
   * Generate secure action code with input validation
   */
  private static async generateSecureActionCode(action: ParsedAction, actionMetadata?: ActionMetadata): Promise<string> {
    if (!actionMetadata) {
      return `// Secure action ${action.name} - metadata not available`
    }

    const lines: string[] = []
    
    // Add input validation before execution
    lines.push("// Input validation and sanitization")
    for (const param of action.parameters) {
      if (param.value) {
        if (param.type === 'String') {
          lines.push(`let validated${param.name} = InputValidator.validateString(sanitized${param.name})`)
        } else if (param.type === 'UFix64' || param.type === 'Fix64') {
          lines.push(`let validated${param.name} = InputValidator.validateAmount(${param.value})`)
        } else if (param.type === 'Address') {
          lines.push(`let validated${param.name} = InputValidator.validateAddress(${param.value})`)
        }
      }
    }
    
    lines.push("")
    lines.push("// Secure function execution")
    
    // Generate the secure function call
    const functionName = actionMetadata.name.charAt(0).toLowerCase() + actionMetadata.name.slice(1)
    const contractName = actionMetadata.name
    
    // Build parameter list with validated inputs
    const params: string[] = []
    for (const param of action.parameters) {
      if (param.value) {
        let value = param.value
        if (param.type === 'String') {
          value = `validated${param.name}`
        } else if (param.type === 'UFix64' || param.type === 'Fix64') {
          value = `validated${param.name}`
        } else if (param.type === 'Address') {
          value = `validated${param.name}`
        } else if (param.type === 'Bool') {
          value = param.value.toLowerCase() === 'true' ? 'true' : 'false'
        }
        params.push(`${param.name}: ${value}`)
      }
    }

    // Generate the secure function call with resource tracking
    lines.push("// Track resources before execution")
    lines.push("let resourcesBefore = ResourceSafety.getResourceCount()")
    lines.push("")
    
    if (params.length > 0) {
      lines.push(`let result = ${contractName}.${functionName}(`)
      params.forEach((param, index) => {
        const comma = index < params.length - 1 ? ',' : ''
        lines.push(`  ${param}${comma}`)
      })
      lines.push(')')
    } else {
      lines.push(`let result = ${contractName}.${functionName}()`)
    }
    
    lines.push("")
    lines.push("// Validate resources after execution")
    lines.push("let resourcesAfter = ResourceSafety.getResourceCount()")
    lines.push("assert(resourcesAfter >= resourcesBefore, message: \"Resource leak detected\")")

    return lines.join('\n')
  }

  /**
   * Generate post-conditions for security validation
   */
  private static generatePostConditions(workflow: EnhancedWorkflow): string {
    const lines: string[] = []
    
    lines.push("  // Post-execution security validation")
    lines.push("  post {")
    lines.push("    // Ensure transaction completed successfully")
    lines.push("    result != nil: \"Transaction must return a result\"")
    lines.push("")
    
    // Add resource safety post-conditions
    lines.push("    // Resource safety validation")
    lines.push("    ResourceSafety.validateNoResourceLeaks(): \"Resource leak detected\"")
    lines.push("    ResourceSafety.validateResourceIntegrity(): \"Resource integrity check failed\"")
    lines.push("")
    
    // Add workflow-specific post-conditions
    if (workflow.actions.some(a => a.actionType.includes('nft'))) {
      lines.push("    // NFT-specific security checks")
      lines.push("    ResourceSafety.validateNFTIntegrity(): \"NFT resource integrity check failed\"")
    }
    
    if (workflow.actions.some(a => a.actionType.includes('token') || a.actionType.includes('swap'))) {
      lines.push("    // Token-specific security checks")
      lines.push("    ResourceSafety.validateTokenBalances(): \"Token balance validation failed\"")
    }
    
    // Add gas usage validation
    lines.push("")
    lines.push("    // Gas usage validation")
    lines.push(`    // Estimated: ${workflow.estimatedGas}, Actual: [runtime value]`)
    lines.push("    // Note: Actual gas validation would be implemented by the runtime")
    
    lines.push("  }")
    
    return lines.join('\n')
  }

  /**
   * Generate security audit report for generated code
   */
  static generateSecurityAuditReport(workflow: EnhancedWorkflow): string {
    const lines: string[] = []
    
    lines.push("# Security Audit Report")
    lines.push("=" .repeat(50))
    lines.push(`Workflow: ${workflow.metadata.name || 'Unnamed'}`)
    lines.push(`Security Level: ${workflow.securityLevel}`)
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push("")
    
    lines.push("## Security Measures Implemented")
    lines.push("- Input sanitization and validation")
    lines.push("- Resource safety checks")
    lines.push("- Gas limit enforcement")
    lines.push("- Comprehensive error handling")
    lines.push("- Post-execution validation")
    lines.push("")
    
    lines.push("## Action Security Analysis")
    workflow.actions.forEach((action, index) => {
      lines.push(`### Action ${index + 1}: ${action.name}`)
      lines.push(`- Type: ${action.actionType}`)
      lines.push(`- Parameters: ${action.parameters.length}`)
      lines.push(`- Required parameters validated: ${action.parameters.filter(p => p.required).length}`)
      lines.push("")
    })
    
    lines.push("## Recommendations")
    lines.push("- Review all parameter validations")
    lines.push("- Test with malicious inputs")
    lines.push("- Verify resource cleanup")
    lines.push("- Monitor gas usage in production")
    lines.push("")
    
    return lines.join('\n')
  }

  /**
   * Set custom discovery service for testing
   */
  static setDiscoveryService(service: ActionDiscoveryService): void {
    this._discoveryService = service
  }

  /**
   * Generate human-readable workflow summary with discovery status
   */
  static async generateSummary(workflow: ParsedWorkflow | EnhancedWorkflow): Promise<string> {
    const lines: string[] = []
    
    lines.push(`// Workflow Summary: ${workflow.metadata?.name || 'Unnamed Workflow'}`)
    lines.push(`// Actions: ${workflow.actions.length}`)
    lines.push(`// Execution Order: ${workflow.executionOrder.join(' → ')}`)
    lines.push("")

    // Check action discovery status
    let discoveryIssues = 0
    for (const action of workflow.actions) {
      try {
        const metadata = await this.getDiscoveryService().getAction(action.id)
        lines.push(`✓ ${action.name} (${action.actionType})`)
        if (metadata) {
          lines.push(`  Contract: ${metadata.contractAddress || 'Unknown'}`)
          lines.push(`  Gas Estimate: ${metadata.gasEstimate || 'Unknown'}`)
        }
      } catch (error) {
        discoveryIssues++
        lines.push(`⚠ ${action.name} (${action.actionType}) - Discovery failed`)
        lines.push(`  Error: ${(error as Error).message}`)
        lines.push(`  Will use fallback generation`)
      }
      lines.push("")
    }

    if (discoveryIssues > 0) {
      lines.push(`// WARNING: ${discoveryIssues} action(s) had discovery issues`)
      lines.push("// Transaction will be generated using fallback methods")
      lines.push("// Some features may be limited")
    } else {
      lines.push("// All actions discovered successfully")
      lines.push("// Full dynamic generation available")
    }

    return lines.join('\n')
  }
}
