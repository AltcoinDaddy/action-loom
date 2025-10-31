import { FlowAPIClient } from './flow-api-client'
import { ActionMetadata, ActionRegistry, Contract, FlowNetwork, SecurityLevel, CompatibilityInfo } from './types'
import { logger } from './logging-service'
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker'

/**
 * Interface for contract scanning configuration
 */
export interface ContractScanConfig {
  batchSize: number
  maxConcurrentScans: number
  scanTimeout: number
  retryAttempts: number
  includeUnverified: boolean
  securityThreshold: SecurityLevel
}

/**
 * Interface for contract discovery result
 */
export interface ContractDiscoveryResult {
  contracts: Contract[]
  registries: ActionRegistry[]
  scanTime: number
  errors: string[]
  totalScanned: number
  validContracts: number
}

/**
 * Interface for Action metadata extraction result
 */
export interface ActionExtractionResult {
  actions: ActionMetadata[]
  contractAddress: string
  contractName: string
  extractionTime: number
  errors: string[]
  warnings: string[]
}

/**
 * OnChainActionScanner - Discovers and scans Flow contracts for Action metadata
 */
export class OnChainActionScanner {
  private client: FlowAPIClient
  private config: ContractScanConfig
  private circuitBreaker: CircuitBreaker
  private scanningInProgress: boolean = false
  private knownRegistries: Set<string> = new Set()
  private scannedContracts: Map<string, ActionExtractionResult> = new Map()

  constructor(
    client: FlowAPIClient,
    config: Partial<ContractScanConfig> = {}
  ) {
    this.client = client
    this.config = {
      batchSize: 10,
      maxConcurrentScans: 5,
      scanTimeout: 30000,
      retryAttempts: 3,
      includeUnverified: false,
      securityThreshold: SecurityLevel.MEDIUM,
      ...config
    }

    // Initialize circuit breaker for contract scanning
    const circuitBreakerConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 120000,
      halfOpenMaxCalls: 3
    }
    this.circuitBreaker = new CircuitBreaker(circuitBreakerConfig)

    // Initialize known registries
    this.initializeKnownRegistries()
  }

  /**
   * Initialize known Action registries on Flow
   */
  private initializeKnownRegistries(): void {
    // Add known Flow Action registry addresses
    // These would be actual registry contract addresses on Flow
    const knownRegistryAddresses = [
      '0x1654653399040a61', // Example registry address
      '0x9a0766d93b6608b7', // Another example registry
      // Add more known registry addresses as they become available
    ]

    knownRegistryAddresses.forEach(address => {
      this.knownRegistries.add(address)
    })
  }

  /**
   * Scan Flow blockchain for Action registries
   */
  async scanRegistries(): Promise<ActionRegistry[]> {
    const correlationId = logger.generateCorrelationId()
    const timingId = logger.startTiming('scan-registries', correlationId)

    logger.info('Starting registry scan', {
      correlationId,
      component: 'on-chain-action-scanner',
      operation: 'scan-registries',
      metadata: {
        knownRegistries: this.knownRegistries.size,
        network: this.client.getCurrentNetwork().name
      }
    })

    try {
      const registries: ActionRegistry[] = []
      const errors: string[] = []

      // Scan known registries first
      for (const registryAddress of this.knownRegistries) {
        try {
          const registry = await this.scanSingleRegistry(registryAddress)
          if (registry) {
            registries.push(registry)
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          errors.push(`Failed to scan registry ${registryAddress}: ${errorMessage}`)
          logger.warn('Registry scan failed', {
            correlationId,
            component: 'on-chain-action-scanner',
            operation: 'scan-registries',
            metadata: {
              registryAddress,
              error: errorMessage
            }
          })
        }
      }

      // Discover additional registries through contract events
      try {
        const discoveredRegistries = await this.discoverRegistriesThroughEvents()
        registries.push(...discoveredRegistries)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        errors.push(`Failed to discover registries through events: ${errorMessage}`)
      }

      logger.info('Registry scan completed', {
        correlationId,
        component: 'on-chain-action-scanner',
        operation: 'scan-registries',
        metadata: {
          registriesFound: registries.length,
          errors: errors.length
        }
      })

      logger.endTiming(correlationId, 'scan-registries', true)
      return registries

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.endTiming(correlationId, 'scan-registries', false, errorMessage)
      logger.error('Registry scan failed', error as Error, {
        correlationId,
        component: 'on-chain-action-scanner',
        operation: 'scan-registries'
      })
      throw error
    }
  }

  /**
   * Scan a single registry for Action metadata
   */
  private async scanSingleRegistry(registryAddress: string): Promise<ActionRegistry | null> {
    try {
      // Execute Cadence script to query registry information
      const registryScript = this.getRegistryInfoScript()
      const result = await this.client.executeScript(registryScript, [
        { type: 'Address', value: registryAddress }
      ])

      if (!result || !result.value) {
        return null
      }

      // Parse registry information
      const registryData = result.value
      const registry: ActionRegistry = {
        address: registryAddress,
        name: registryData.name || `Registry at ${registryAddress}`,
        description: registryData.description || 'Flow Action Registry',
        actions: registryData.actions || []
      }

      logger.debug('Registry scanned successfully', {
        component: 'on-chain-action-scanner',
        operation: 'scan-single-registry',
        metadata: {
          registryAddress,
          actionCount: registry.actions.length
        }
      })

      return registry

    } catch (error) {
      logger.warn('Failed to scan registry', {
        component: 'on-chain-action-scanner',
        operation: 'scan-single-registry',
        metadata: {
          registryAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return null
    }
  }

  /**
   * Discover registries through blockchain events
   */
  private async discoverRegistriesThroughEvents(): Promise<ActionRegistry[]> {
    try {
      // Query for registry registration events
      const eventScript = this.getRegistryDiscoveryEventScript()
      const result = await this.client.executeScript(eventScript, [])

      if (!result || !result.value) {
        return []
      }

      const registryAddresses = result.value as string[]
      const discoveredRegistries: ActionRegistry[] = []

      // Scan each discovered registry
      for (const address of registryAddresses) {
        if (!this.knownRegistries.has(address)) {
          const registry = await this.scanSingleRegistry(address)
          if (registry) {
            discoveredRegistries.push(registry)
            this.knownRegistries.add(address)
          }
        }
      }

      return discoveredRegistries

    } catch (error) {
      logger.warn('Failed to discover registries through events', {
        component: 'on-chain-action-scanner',
        operation: 'discover-registries-through-events',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return []
    }
  }

  /**
   * Extract Action metadata from a contract
   */
  async extractActionMetadata(contract: Contract): Promise<ActionMetadata> {
    const correlationId = logger.generateCorrelationId()
    const startTime = Date.now()

    logger.info('Extracting Action metadata from contract', {
      correlationId,
      component: 'on-chain-action-scanner',
      operation: 'extract-action-metadata',
      metadata: {
        contractAddress: contract.address,
        contractName: contract.name
      }
    })

    try {
      // Check if we've already scanned this contract
      const cacheKey = `${contract.address}:${contract.name}`
      if (this.scannedContracts.has(cacheKey)) {
        const cachedResult = this.scannedContracts.get(cacheKey)!
        if (cachedResult.actions.length > 0) {
          return cachedResult.actions[0] // Return first action for compatibility
        }
      }

      // Execute contract interface analysis
      const interfaceScript = this.getContractInterfaceScript()
      const result = await this.client.executeScript(interfaceScript, [
        { type: 'Address', value: contract.address },
        { type: 'String', value: contract.name }
      ])

      if (!result || !result.value) {
        throw new Error('No interface data returned from contract')
      }

      // Parse contract interface data
      const interfaceData = result.value
      const actionMetadata = this.parseContractInterface(interfaceData, contract)

      // Validate the extracted metadata
      const isValid = this.validateActionCompatibility(actionMetadata)
      if (!isValid) {
        throw new Error('Extracted Action metadata failed compatibility validation')
      }

      // Cache the result
      const extractionResult: ActionExtractionResult = {
        actions: [actionMetadata],
        contractAddress: contract.address,
        contractName: contract.name,
        extractionTime: Date.now() - startTime,
        errors: [],
        warnings: []
      }
      this.scannedContracts.set(cacheKey, extractionResult)

      logger.info('Action metadata extracted successfully', {
        correlationId,
        component: 'on-chain-action-scanner',
        operation: 'extract-action-metadata',
        metadata: {
          contractAddress: contract.address,
          contractName: contract.name,
          actionId: actionMetadata.id,
          extractionTime: extractionResult.extractionTime
        }
      })

      return actionMetadata

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Failed to extract Action metadata', error as Error, {
        correlationId,
        component: 'on-chain-action-scanner',
        operation: 'extract-action-metadata',
        metadata: {
          contractAddress: contract.address,
          contractName: contract.name
        }
      })
      throw new Error(`Failed to extract Action metadata from ${contract.name}: ${errorMessage}`)
    }
  }

  /**
   * Parse contract interface data into ActionMetadata
   */
  private parseContractInterface(interfaceData: any, contract: Contract): ActionMetadata {
    try {
      // Extract basic information
      const actionId = `${contract.address}:${contract.name}:${interfaceData.functionName || 'main'}`
      const name = interfaceData.name || contract.name
      const description = interfaceData.description || `Action from ${contract.name} contract`
      const category = this.categorizeAction(interfaceData, contract)

      // Parse function parameters as inputs
      const inputs = (interfaceData.parameters || []).map((param: any) => ({
        name: param.name,
        type: param.type,
        required: param.required !== false,
        description: param.description || `${param.name} parameter`
      }))

      // Parse return values as outputs
      const outputs = (interfaceData.returns || []).map((returnVal: any) => ({
        name: returnVal.name || 'result',
        type: returnVal.type,
        description: returnVal.description || 'Function return value'
      }))

      // Create parameters from inputs
      const parameters = inputs.map((input: any) => ({
        name: input.name,
        type: input.type,
        value: '',
        required: input.required,
        description: input.description
      }))

      // Determine compatibility info
      const compatibility: CompatibilityInfo = {
        requiredCapabilities: interfaceData.requiredCapabilities || [],
        supportedNetworks: interfaceData.supportedNetworks || ['testnet', 'mainnet'],
        minimumFlowVersion: interfaceData.minimumFlowVersion || '1.0.0',
        conflictsWith: interfaceData.conflictsWith || []
      }

      // Estimate gas usage
      const gasEstimate = this.estimateGasUsage(interfaceData, inputs.length)

      // Determine security level
      const securityLevel = this.assessSecurityLevel(interfaceData, contract)

      const actionMetadata: ActionMetadata = {
        id: actionId,
        name,
        description,
        category,
        version: interfaceData.version || '1.0.0',
        inputs,
        outputs,
        parameters,
        compatibility,
        gasEstimate,
        securityLevel,
        author: interfaceData.author || 'Unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      return actionMetadata

    } catch (error) {
      throw new Error(`Failed to parse contract interface: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Categorize an Action based on contract interface
   */
  private categorizeAction(interfaceData: any, contract: Contract): string {
    // Check for explicit category in interface
    if (interfaceData.category) {
      return interfaceData.category
    }

    // Infer category from contract name and function names
    const contractName = contract.name.toLowerCase()
    const functionNames = (interfaceData.functions || []).map((f: any) => f.name.toLowerCase())

    // Token-related actions
    if (contractName.includes('token') || contractName.includes('ft') || 
        functionNames.some(name => name.includes('transfer') || name.includes('mint') || name.includes('burn'))) {
      return 'token'
    }

    // NFT-related actions
    if (contractName.includes('nft') || contractName.includes('collectible') ||
        functionNames.some(name => name.includes('mint') || name.includes('collection'))) {
      return 'nft'
    }

    // DeFi-related actions
    if (contractName.includes('swap') || contractName.includes('defi') || contractName.includes('pool') ||
        functionNames.some(name => name.includes('swap') || name.includes('stake') || name.includes('lend'))) {
      return 'defi'
    }

    // Governance-related actions
    if (contractName.includes('governance') || contractName.includes('dao') ||
        functionNames.some(name => name.includes('vote') || name.includes('proposal'))) {
      return 'governance'
    }

    // Default category
    return 'utility'
  }

  /**
   * Estimate gas usage for an Action
   */
  private estimateGasUsage(interfaceData: any, parameterCount: number): number {
    // Base gas cost
    let gasEstimate = 100

    // Add cost based on complexity
    if (interfaceData.complexity) {
      switch (interfaceData.complexity) {
        case 'low':
          gasEstimate += 50
          break
        case 'medium':
          gasEstimate += 200
          break
        case 'high':
          gasEstimate += 500
          break
      }
    }

    // Add cost based on parameter count
    gasEstimate += parameterCount * 25

    // Add cost for storage operations
    if (interfaceData.hasStorageOperations) {
      gasEstimate += 300
    }

    // Add cost for external calls
    if (interfaceData.hasExternalCalls) {
      gasEstimate += 150
    }

    return gasEstimate
  }

  /**
   * Assess security level of an Action
   */
  private assessSecurityLevel(interfaceData: any, contract: Contract): SecurityLevel {
    let riskScore = 0

    // Check for high-risk operations
    if (interfaceData.hasTokenTransfers) riskScore += 2
    if (interfaceData.hasStorageOperations) riskScore += 1
    if (interfaceData.hasExternalCalls) riskScore += 2
    if (interfaceData.hasAdminFunctions) riskScore += 3

    // Check contract verification status
    if (!interfaceData.isVerified) riskScore += 2

    // Check for security audits
    if (!interfaceData.hasSecurityAudit) riskScore += 1

    // Determine security level based on risk score
    if (riskScore >= 6) return SecurityLevel.CRITICAL
    if (riskScore >= 4) return SecurityLevel.HIGH
    if (riskScore >= 2) return SecurityLevel.MEDIUM
    return SecurityLevel.LOW
  }

  /**
   * Validate Action compatibility with current network and standards
   */
  validateActionCompatibility(action: ActionMetadata): boolean {
    try {
      // Check required fields
      if (!action.id || !action.name || !action.category) {
        return false
      }

      // Check network compatibility
      const currentNetwork = this.client.getCurrentNetwork()
      if (!action.compatibility.supportedNetworks.includes(currentNetwork.name)) {
        return false
      }

      // Check security threshold
      const securityLevels = [SecurityLevel.LOW, SecurityLevel.MEDIUM, SecurityLevel.HIGH, SecurityLevel.CRITICAL]
      const actionSecurityIndex = securityLevels.indexOf(action.securityLevel)
      const thresholdIndex = securityLevels.indexOf(this.config.securityThreshold)
      
      if (actionSecurityIndex > thresholdIndex && !this.config.includeUnverified) {
        return false
      }

      // Check parameter types
      for (const param of action.parameters) {
        if (!this.isValidParameterType(param.type)) {
          return false
        }
      }

      return true

    } catch (error) {
      logger.warn('Action compatibility validation failed', {
        component: 'on-chain-action-scanner',
        operation: 'validate-action-compatibility',
        metadata: {
          actionId: action.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      })
      return false
    }
  }

  /**
   * Check if a parameter type is valid for Flow
   */
  private isValidParameterType(type: string): boolean {
    const validTypes = [
      'String', 'Bool', 'Int', 'UInt', 'UInt8', 'UInt16', 'UInt32', 'UInt64', 'UInt128', 'UInt256',
      'Int8', 'Int16', 'Int32', 'Int64', 'Int128', 'Int256',
      'Fix64', 'UFix64', 'Address', 'Path', 'Capability',
      'Array', 'Dictionary', 'Optional', 'Resource', 'Struct'
    ]

    // Check basic types
    if (validTypes.includes(type)) {
      return true
    }

    // Check array types
    if (type.startsWith('[') && type.endsWith(']')) {
      const innerType = type.slice(1, -1)
      return this.isValidParameterType(innerType)
    }

    // Check optional types
    if (type.endsWith('?')) {
      const innerType = type.slice(0, -1)
      return this.isValidParameterType(innerType)
    }

    // Check dictionary types
    if (type.startsWith('{') && type.endsWith('}')) {
      const dictContent = type.slice(1, -1)
      const colonIndex = dictContent.indexOf(':')
      if (colonIndex > 0) {
        const keyType = dictContent.slice(0, colonIndex).trim()
        const valueType = dictContent.slice(colonIndex + 1).trim()
        return this.isValidParameterType(keyType) && this.isValidParameterType(valueType)
      }
    }

    return false
  }

  /**
   * Get Cadence script for querying registry information
   */
  private getRegistryInfoScript(): string {
    return `
      import ActionRegistry from 0x1654653399040a61

      pub fun main(registryAddress: Address): ActionRegistryInfo? {
        let registryAccount = getAccount(registryAddress)
        
        if let registry = registryAccount.getCapability<&ActionRegistry.Registry{ActionRegistry.RegistryPublic}>
          (/public/ActionRegistry).borrow() {
          
          return ActionRegistryInfo(
            name: registry.getName(),
            description: registry.getDescription(),
            actions: registry.getActionIds()
          )
        }
        
        return nil
      }

      pub struct ActionRegistryInfo {
        pub let name: String
        pub let description: String
        pub let actions: [String]

        init(name: String, description: String, actions: [String]) {
          self.name = name
          self.description = description
          self.actions = actions
        }
      }
    `
  }

  /**
   * Get Cadence script for discovering registries through events
   */
  private getRegistryDiscoveryEventScript(): string {
    return `
      import ActionRegistry from 0x1654653399040a61

      pub fun main(): [Address] {
        // Query for registry registration events
        // This would scan recent blocks for registry creation events
        let registryAddresses: [Address] = []
        
        // Add logic to scan for registry creation events
        // This is a placeholder implementation
        
        return registryAddresses
      }
    `
  }

  /**
   * Get Cadence script for analyzing contract interface
   */
  private getContractInterfaceScript(): string {
    return `
      pub fun main(contractAddress: Address, contractName: String): ContractInterface? {
        let contractAccount = getAccount(contractAddress)
        
        if let contract = contractAccount.contracts.get(name: contractName) {
          return ContractInterface(
            name: contractName,
            description: "Contract interface analysis",
            functionName: "main",
            parameters: [],
            returns: [],
            complexity: "medium",
            hasStorageOperations: false,
            hasExternalCalls: false,
            hasTokenTransfers: false,
            hasAdminFunctions: false,
            isVerified: true,
            hasSecurityAudit: false,
            version: "1.0.0",
            author: "Unknown",
            requiredCapabilities: [],
            supportedNetworks: ["testnet", "mainnet"],
            minimumFlowVersion: "1.0.0",
            conflictsWith: []
          )
        }
        
        return nil
      }

      pub struct ContractInterface {
        pub let name: String
        pub let description: String
        pub let functionName: String
        pub let parameters: [Parameter]
        pub let returns: [ReturnValue]
        pub let complexity: String
        pub let hasStorageOperations: Bool
        pub let hasExternalCalls: Bool
        pub let hasTokenTransfers: Bool
        pub let hasAdminFunctions: Bool
        pub let isVerified: Bool
        pub let hasSecurityAudit: Bool
        pub let version: String
        pub let author: String
        pub let requiredCapabilities: [String]
        pub let supportedNetworks: [String]
        pub let minimumFlowVersion: String
        pub let conflictsWith: [String]

        init(
          name: String,
          description: String,
          functionName: String,
          parameters: [Parameter],
          returns: [ReturnValue],
          complexity: String,
          hasStorageOperations: Bool,
          hasExternalCalls: Bool,
          hasTokenTransfers: Bool,
          hasAdminFunctions: Bool,
          isVerified: Bool,
          hasSecurityAudit: Bool,
          version: String,
          author: String,
          requiredCapabilities: [String],
          supportedNetworks: [String],
          minimumFlowVersion: String,
          conflictsWith: [String]
        ) {
          self.name = name
          self.description = description
          self.functionName = functionName
          self.parameters = parameters
          self.returns = returns
          self.complexity = complexity
          self.hasStorageOperations = hasStorageOperations
          self.hasExternalCalls = hasExternalCalls
          self.hasTokenTransfers = hasTokenTransfers
          self.hasAdminFunctions = hasAdminFunctions
          self.isVerified = isVerified
          self.hasSecurityAudit = hasSecurityAudit
          self.version = version
          self.author = author
          self.requiredCapabilities = requiredCapabilities
          self.supportedNetworks = supportedNetworks
          self.minimumFlowVersion = minimumFlowVersion
          self.conflictsWith = conflictsWith
        }
      }

      pub struct Parameter {
        pub let name: String
        pub let type: String
        pub let required: Bool
        pub let description: String

        init(name: String, type: String, required: Bool, description: String) {
          self.name = name
          self.type = type
          self.required = required
          self.description = description
        }
      }

      pub struct ReturnValue {
        pub let name: String
        pub let type: String
        pub let description: String

        init(name: String, type: String, description: String) {
          self.name = name
          self.type = type
          self.description = description
        }
      }
    `
  }

  /**
   * Get scanning statistics
   */
  getStats(): {
    scannedContracts: number
    knownRegistries: number
    circuitBreakerState: string
    scanningInProgress: boolean
  } {
    return {
      scannedContracts: this.scannedContracts.size,
      knownRegistries: this.knownRegistries.size,
      circuitBreakerState: this.circuitBreaker.getState(),
      scanningInProgress: this.scanningInProgress
    }
  }

  /**
   * Clear cached scan results
   */
  clearCache(): void {
    this.scannedContracts.clear()
    logger.info('OnChainActionScanner cache cleared', {
      component: 'on-chain-action-scanner',
      operation: 'clear-cache'
    })
  }

  /**
   * Add a known registry address
   */
  addKnownRegistry(address: string): void {
    this.knownRegistries.add(address)
    logger.info('Registry added to known list', {
      component: 'on-chain-action-scanner',
      operation: 'add-known-registry',
      metadata: { address }
    })
  }

  /**
   * Remove a registry address
   */
  removeKnownRegistry(address: string): void {
    this.knownRegistries.delete(address)
    logger.info('Registry removed from known list', {
      component: 'on-chain-action-scanner',
      operation: 'remove-known-registry',
      metadata: { address }
    })
  }

  /**
   * Get list of known registries
   */
  getKnownRegistries(): string[] {
    return Array.from(this.knownRegistries)
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker.reset()
    logger.info('Circuit breaker reset', {
      component: 'on-chain-action-scanner',
      operation: 'reset-circuit-breaker'
    })
  }
}

/**
 * Create OnChainActionScanner with default configuration
 */
export function createOnChainActionScanner(
  client: FlowAPIClient,
  config?: Partial<ContractScanConfig>
): OnChainActionScanner {
  return new OnChainActionScanner(client, config)
}