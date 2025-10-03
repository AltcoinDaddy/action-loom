/**
 * Forte Integration Module
 * 
 * This module provides the foundation for integrating ActionLoom with Flow's Forte upgrade,
 * including enhanced type definitions, Flow Access API client, and Action discovery interfaces.
 */

// Core types
export * from './types'

// Flow API client
export { FlowAPIClient, createFlowAPIClient, defaultFlowClient } from './flow-api-client'

// Action discovery interfaces and implementations
export type {
  IActionDiscoveryService,
  IActionMetadataHandler,
  IActionCache,
  IActionSearchEngine
} from './action-discovery'

export {
  BaseActionDiscoveryService,
  BaseActionMetadataHandler,
  createActionDiscoveryService
} from './action-discovery'

// Flow configuration and constants
export {
  FLOW_NETWORKS,
  DEFAULT_FLOW_CONFIG,
  FORTE_CONSTANTS,
  FlowErrorCode,
  getFlowNetwork,
  validateNetworkConfig,
  checkNetworkHealth
} from './flow-config'

// Error handling
export {
  FlowError,
  FlowNetworkError,
  FlowAuthenticationError,
  FlowScriptError,
  FlowTransactionError,
  ActionDiscoveryError,
  FlowErrorHandler,
  retryFlowOperation
} from './flow-errors'

// Utility functions
export {
  createForteIntegration,
  validateForteAction,
  parseForteMetadata
} from './forte-utils'