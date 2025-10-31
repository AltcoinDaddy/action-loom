import type { Node, Edge } from "@xyflow/react"

export interface Workflow {
  nodes: Node[]
  edges: Edge[]
}

// Enhanced Action types for Forte integration
export interface Action {
  id: string
  name: string
  description: string
  category: string
  inputs: ActionInput[]
  outputs: ActionOutput[]
}

// Enhanced Forte Action with additional metadata
export interface ForteAction extends Action {
  version: string
  contractAddress: string
  metadata: ActionMetadata
  compatibility: CompatibilityInfo
  gasEstimate: number
  securityAudit: SecurityAudit
  dependencies: string[]
  tags: string[]
}

export interface ActionMetadata {
  id: string
  name: string
  description: string
  category: string
  version: string
  inputs: ActionInput[]
  outputs: ActionOutput[]
  parameters: ActionParameter[]
  compatibility: CompatibilityInfo
  gasEstimate: number
  securityLevel: SecurityLevel
  author: string
  createdAt: string
  updatedAt: string
}

// Enhanced ActionMetadata with validation rules
export interface EnhancedActionMetadata extends ActionMetadata {
  parameters: EnhancedActionParameter[]
  validationRules?: ActionValidationRules
  parameterDependencies?: ParameterDependency[]
}

export interface ActionValidationRules {
  requiredParameterGroups?: string[][]  // Groups of parameters where at least one is required
  mutuallyExclusive?: string[][]        // Groups of parameters that cannot be used together
  conditionalRequirements?: ConditionalRequirement[]
  customValidation?: (parameters: Record<string, any>, context: ValidationContext) => ValidationResult
}

export interface ConditionalRequirement {
  condition: (parameters: Record<string, any>) => boolean
  requiredParameters: string[]
  message: string
}

// Validation result types
export interface ParameterValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  suggestions?: string[]
}

export interface ActionValidationResult {
  actionId: string
  isValid: boolean
  missingParameters: string[]
  invalidParameters: Record<string, ParameterValidationResult>
  warnings: string[]
}

export interface WorkflowValidationResult {
  isValid: boolean
  actionResults: Record<string, ActionValidationResult>
  dataFlowResult: DataFlowValidationResult
  globalErrors: ValidationError[]
}

export interface DataFlowValidationResult {
  isValid: boolean
  circularDependencies: string[]
  unresolvedReferences: UnresolvedReference[]
  typeCompatibilityIssues: TypeCompatibilityIssue[]
}

export interface UnresolvedReference {
  actionId: string
  parameterName: string
  referencedAction: string
  referencedOutput: string
}

export interface TypeCompatibilityIssue {
  sourceAction: string
  sourceOutput: string
  targetAction: string
  targetParameter: string
  sourceType: string
  targetType: string
  canConvert: boolean
}

export interface CompatibilityInfo {
  requiredCapabilities: string[]
  supportedNetworks: string[]
  minimumFlowVersion: string
  conflictsWith: string[]
}

export interface SecurityAudit {
  status: 'pending' | 'passed' | 'failed' | 'warning'
  auditedAt?: string
  auditor?: string
  findings: SecurityFinding[]
  score: number
}

export interface SecurityFinding {
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  description: string
  recommendation: string
}

export enum SecurityLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ActionInput {
  name: string
  type: string
  required: boolean
  description?: string
  validation?: ValidationRule[]
}

export interface ActionOutput {
  name: string
  type: string
  description?: string
}

export interface ValidationRule {
  type: 'range' | 'pattern' | 'custom'
  value: any
  message: string
}

// Enhanced Workflow types for Forte integration
export interface ParsedWorkflow {
  actions: ParsedAction[]
  executionOrder: string[]
  rootActions: string[]
  metadata: WorkflowMetadata
}

export interface EnhancedWorkflow extends ParsedWorkflow {
  nlpSource?: string // Original natural language input
  validationResults: ValidationResult
  simulationResults?: SimulationResult
  agentConfig?: AgentConfiguration
  securityLevel: SecurityLevel
  estimatedGas: number
  requiredBalance: TokenBalance[]
}

export interface WorkflowMetadata {
  totalActions: number
  totalConnections: number
  createdAt: string
  name?: string
  savedAt?: string
  version?: string
  author?: string
  tags?: string[]
}

export interface ParsedAction {
  id: string
  actionType: string
  name: string
  parameters: ActionParameter[]
  nextActions: string[]
  position: { x: number; y: number }
}

export interface ActionParameter {
  name: string
  type: string
  value: string
  required: boolean
  description?: string
  options?: string[]  // For dropdown/select parameters
}

// Configuration status types
export type ConfigurationStatus = 'unconfigured' | 'partial' | 'complete' | 'error'

export interface ActionConfigurationState {
  nodeId: string
  actionId: string
  status: ConfigurationStatus
  parameterValues: Record<string, any>
  validationErrors: ValidationError[]
  lastModified: Date
  configurationProgress: number // 0-100
  missingParameterCount: number
  requiredParameterCount: number
}

// Enhanced parameter types for validation
export interface EnhancedActionParameter extends ActionParameter {
  validation: ParameterValidationRules
  suggestions?: ParameterSuggestion[]
  dependencies?: ParameterDependency[]
  defaultValue?: any
}

// Parameter validation result with suggestions
export interface ParameterValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  suggestions?: string[]
}

export interface ParameterValidationRules {
  required: boolean
  type: ParameterType
  constraints?: ParameterConstraints
  customValidator?: (value: any, context: ValidationContext) => ParameterValidationResult
}

export interface ParameterConstraints {
  min?: number
  max?: number
  pattern?: RegExp
  enum?: string[]
  decimals?: number
  minLength?: number
  maxLength?: number
}

export interface ParameterSuggestion {
  value: any
  label: string
  description?: string
  category?: string
}

export interface ParameterDependency {
  sourceActionId: string
  sourceOutputName: string
  transformFunction?: (value: any) => any
}

export enum ParameterType {
  ADDRESS = 'Address',
  UFIX64 = 'UFix64',
  STRING = 'String',
  BOOL = 'Bool',
  INT = 'Int',
  UINT64 = 'UInt64',
  ARRAY = 'Array',
  DICTIONARY = 'Dictionary',
  OPTIONAL = 'Optional'
}

export interface ValidationContext {
  workflow: ParsedWorkflow
  currentAction: ParsedAction
  availableOutputs: Record<string, ActionOutput>
}

export interface ExecutionResult {
  success: boolean
  transactionId?: string
  status?: string
  cadenceCode?: string
  executionTime?: number
  gasUsed?: number
  error?: string
  details?: string[]
}

// Re-export Forte integration for convenience
export * from './forte-integration'

// Agent-related types for Forte integration
export interface Agent {
  id: string
  name: string
  description: string
  workflowId: string
  schedule: Schedule
  triggers: EventTrigger[]
  status: AgentStatus
  createdAt: string
  updatedAt: string
  owner: string
}

export interface AgentConfiguration {
  schedule: Schedule
  eventTriggers: EventTrigger[]
  retryPolicy: RetryPolicy
  notifications: NotificationConfig
  permissions: Permission[]
}

export interface Schedule {
  type: 'recurring' | 'event-driven' | 'one-time'
  interval?: number // seconds for recurring
  cronExpression?: string
  eventTriggers?: EventTrigger[]
  startTime?: Date
  endTime?: Date
}

export interface EventTrigger {
  type: 'price' | 'time' | 'balance' | 'custom'
  condition: TriggerCondition
  oracleAction?: string // Action ID for oracle data
  parameters: Record<string, any>
}

export interface TriggerCondition {
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
  value: any
  tolerance?: number
}

export interface RetryPolicy {
  maxRetries: number
  backoffMultiplier: number
  initialDelay: number
  maxDelay?: number
}

export interface NotificationConfig {
  onSuccess: boolean
  onFailure: boolean
  channels: string[]
  email?: string
  webhook?: string
  discord?: string
  slack?: string
}

export interface Permission {
  resource: string
  action: string
  conditions?: Record<string, any>
}

export enum AgentStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  STOPPED = 'stopped',
  ERROR = 'error'
}

// Validation and Simulation types
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: string[]
  compatibilityIssues: CompatibilityIssue[]
}

export interface ValidationError {
  type: ValidationErrorType | string
  message: string
  actionId?: string
  field?: string
  severity: 'error' | 'warning'
}

export enum ValidationErrorType {
  MISSING_REQUIRED = 'MISSING_REQUIRED',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_FORMAT = 'INVALID_FORMAT',
  OUT_OF_RANGE = 'OUT_OF_RANGE',
  PATTERN_MISMATCH = 'PATTERN_MISMATCH',
  ENUM_VIOLATION = 'ENUM_VIOLATION',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  UNRESOLVED_REFERENCE = 'UNRESOLVED_REFERENCE',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  CUSTOM_VALIDATION = 'CUSTOM_VALIDATION'
}

export interface CompatibilityIssue {
  sourceActionId: string
  targetActionId: string
  issue: string
  suggestion: string
}

export interface SimulationResult {
  success: boolean
  gasUsed: number
  balanceChanges: BalanceChange[]
  events: Event[]
  errors: SimulationError[]
  warnings: string[]
  executionTime: number
}

export interface BalanceChange {
  address: string
  token: string
  before: string
  after: string
  amount: number
}

export interface SimulationError {
  type: string
  message: string
  actionId?: string
  stackTrace?: string
}

export interface Event {
  type: string
  data: any
  timestamp?: number
  blockHeight?: number
}

export interface TokenBalance {
  token: string
  amount: string
  decimals: number
}

// Flow Access API types
export interface FlowNetwork {
  name: string
  endpoint: string
  chainId: string
}

export interface FlowAPIConfig {
  network: FlowNetwork
  apiKey?: string
  timeout: number
  retryAttempts: number
}

// Action Discovery types
export interface ActionRegistry {
  address: string
  name: string
  description: string
  actions: string[]
}

export interface DiscoveryResult {
  actions: ActionMetadata[]
  registries: ActionRegistry[]
  lastUpdated: string
  totalFound: number
  executionTime?: number
  errors?: string[]
}

// NLP Service types
export interface NLPResult {
  confidence: number
  steps: ParsedStep[]
  ambiguities: Ambiguity[]
  suggestions: string[]
  processingTime: number
}

export interface ParsedStep {
  actionId: string
  actionName: string
  parameters: Record<string, any>
  confidence: number
  position?: number
  metadata?: {
    originalAction?: ActionMetadata
    matchScore?: number
    matchReasons?: string[]
    validationResult?: any // ParameterValidationResult from action-mapping-service
    alternativeActions?: Array<{
      action: ActionMetadata
      score: number
      reasons: string[]
    }>
    fallbackReason?: string
    error?: string
  }
}

export interface Entity {
  type: 'token' | 'amount' | 'address' | 'action' | 'parameter'
  value: string
  confidence: number
  position: [number, number]
  metadata?: Record<string, any>
}

export interface Ambiguity {
  type: 'parameter' | 'action' | 'value'
  message: string
  suggestions: string[]
  position?: [number, number]
}

export interface IntentClassification {
  intent: WorkflowIntent
  confidence: number
  entities: Entity[]
  parameters: Record<string, any>
  metadata?: {
    allScores?: Record<WorkflowIntent, number>
    detectedPatterns?: string[]
    ambiguityScore?: number
  }
}

export enum WorkflowIntent {
  SWAP = 'swap',
  STAKE = 'stake',
  UNSTAKE = 'unstake',
  MINT = 'mint',
  TRANSFER = 'transfer',
  BRIDGE = 'bridge',
  LEND = 'lend',
  BORROW = 'borrow',
  COMPOUND = 'compound',
  CUSTOM = 'custom'
}

export interface NLPConfig {
  modelEndpoint?: string
  apiKey?: string
  timeout: number
  maxTokens: number
  temperature: number
  confidenceThreshold: number
}

export interface TextPreprocessingResult {
  originalText: string
  cleanedText: string
  tokens: string[]
  entities: Entity[]
  metadata: {
    wordCount: number
    characterCount: number
    language?: string
  }
}

// Flow Client Library (FCL) Integration Types
export interface FlowNetworkConfig {
  name: string
  chainId: string
  accessNode: string
  discoveryWallet: string
  walletDiscovery: string
  fclConfig: FCLConfig
}

export interface FCLConfig {
  'accessNode.api': string
  'discovery.wallet': string
  'discovery.authn': string
  'app.detail.title': string
  'app.detail.icon': string
}

export interface FlowAccount {
  address: string
  balance: string
  code: string
  keys: AccountKey[]
  contracts: Record<string, Contract>
}

export interface AccountKey {
  index: number
  publicKey: string
  signAlgo: number
  hashAlgo: number
  weight: number
  sequenceNumber: number
  revoked: boolean
}

export interface Contract {
  name: string
  code: string
  address: string
}

export interface FlowUser {
  addr: string | null
  cid: string | null
  expiresAt: number | null
  f_type: string
  f_vsn: string
  loggedIn: boolean
  services: FlowService[]
}

export interface FlowService {
  f_type: string
  f_vsn: string
  type: string
  method: string
  endpoint: string
  uid: string
  id: string
  identity: {
    address: string
    keyId: number
  }
  provider: {
    address: string
    name: string
    icon: string
    description: string
  }
}

export enum WalletType {
  BLOCTO = 'blocto',
  LILICO = 'lilico',
  DAPPER = 'dapper',
  FLOW_WALLET = 'flow-wallet'
}

export interface WalletConnection {
  address: string
  walletType: WalletType
  isAuthenticated: boolean
  capabilities: string[]
}

export interface FlowIntegrationContextType {
  // Network management
  currentNetwork: FlowNetworkConfig
  switchNetwork: (network: FlowNetworkConfig) => Promise<void>
  
  // Connection state
  isConnected: boolean
  currentUser: FlowUser | null
  
  // Wallet management
  connect: (walletType?: WalletType) => Promise<WalletConnection>
  disconnect: () => Promise<void>
  
  // Account data
  getAccount: () => Promise<FlowAccount>
  getBalance: (tokenType?: string) => Promise<TokenBalance>
  getMultipleBalances: (tokenTypes: string[]) => Promise<TokenBalance[]>
  
  // Real-time data
  subscribeToAccountChanges: (callback: (account: FlowAccount) => void) => () => void
  subscribeToBalanceChanges: (tokenType: string, callback: (balance: TokenBalance) => void) => () => void
  
  // Network configurations
  networks: {
    testnet: FlowNetworkConfig
    mainnet: FlowNetworkConfig
  }
  
  // Loading states
  isConnecting: boolean
  isLoading: boolean
  
  // Error handling
  error: string | null
  clearError: () => void
}
