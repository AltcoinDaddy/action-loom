import { ActionMetadata, SecurityLevel } from './types'

/**
 * Real Flow blockchain actions that actually exist and can be executed
 * These are based on actual Flow smart contracts and capabilities
 */
export function getRealFlowActions(): ActionMetadata[] {
  return [
    {
      id: 'transfer-flow',
      name: 'Transfer FLOW',
      description: 'Transfer FLOW tokens to another address using the FlowToken contract',
      category: 'token',
      version: '1.0.0',
      inputs: [
        { name: 'recipient', type: 'Address', description: 'Recipient Flow address', required: true },
        { name: 'amount', type: 'UFix64', description: 'Amount of FLOW to transfer', required: true }
      ],
      outputs: [
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [
        { 
          name: 'recipient', 
          type: 'Address', 
          value: '', 
          required: true,
          description: 'The Flow address to send FLOW tokens to (0x followed by 16 hex characters)',
          options: undefined
        },
        { 
          name: 'amount', 
          type: 'UFix64', 
          value: '', 
          required: true,
          description: 'The amount of FLOW tokens to transfer - positive decimal number with up to 8 decimal places',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: ['FlowToken.Vault'],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 25000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'create-account',
      name: 'Create Account',
      description: 'Create a new Flow account with provided public keys',
      category: 'account',
      version: '1.0.0',
      inputs: [
        { name: 'publicKeys', type: 'Array', description: 'Array of public keys for the new account', required: true }
      ],
      outputs: [
        { name: 'address', type: 'Address', description: 'Address of the created account' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [
        { 
          name: 'publicKeys', 
          type: 'Array', 
          value: [], 
          required: true,
          description: 'Public keys for the new account (hex-encoded)',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 100000,
      securityLevel: SecurityLevel.MEDIUM,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'deploy-contract',
      name: 'Deploy Contract',
      description: 'Deploy a Cadence smart contract to an account',
      category: 'contract',
      version: '1.0.0',
      inputs: [
        { name: 'contractName', type: 'String', description: 'Name of the contract', required: true },
        { name: 'contractCode', type: 'String', description: 'Cadence contract code', required: true }
      ],
      outputs: [
        { name: 'contractAddress', type: 'Address', description: 'Address where contract was deployed' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [
        { 
          name: 'contractName', 
          type: 'String', 
          value: '', 
          required: true,
          description: 'The name of the contract to deploy',
          options: undefined
        },
        { 
          name: 'contractCode', 
          type: 'String', 
          value: '', 
          required: true,
          description: 'The Cadence smart contract source code',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: ['DeployContract'],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 500000,
      securityLevel: SecurityLevel.HIGH,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'setup-fusd-vault',
      name: 'Setup FUSD Vault',
      description: 'Setup FUSD token vault capability for an account',
      category: 'token',
      version: '1.0.0',
      inputs: [],
      outputs: [
        { name: 'vaultPath', type: 'String', description: 'Storage path of the created vault' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 75000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'transfer-fusd',
      name: 'Transfer FUSD',
      description: 'Transfer FUSD stablecoin tokens to another address',
      category: 'token',
      version: '1.0.0',
      inputs: [
        { name: 'recipient', type: 'Address', description: 'Recipient Flow address', required: true },
        { name: 'amount', type: 'UFix64', description: 'Amount of FUSD to transfer', required: true }
      ],
      outputs: [
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [
        { 
          name: 'recipient', 
          type: 'Address', 
          value: '', 
          required: true,
          description: 'The Flow address to send FUSD tokens to',
          options: undefined
        },
        { 
          name: 'amount', 
          type: 'UFix64', 
          value: '', 
          required: true,
          description: 'The amount of FUSD tokens to transfer',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: ['FUSD.Vault'],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 30000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'mint-nft-basic',
      name: 'Mint Basic NFT',
      description: 'Mint a basic NFT using the NonFungibleToken standard',
      category: 'nft',
      version: '1.0.0',
      inputs: [
        { name: 'recipient', type: 'Address', description: 'NFT recipient address', required: true },
        { name: 'metadata', type: 'String', description: 'NFT metadata (JSON string)', required: true }
      ],
      outputs: [
        { name: 'tokenId', type: 'UInt64', description: 'Minted token ID' },
        { name: 'transactionId', type: 'String', description: 'Transaction ID' }
      ],
      parameters: [
        { 
          name: 'recipient', 
          type: 'Address', 
          value: '', 
          required: true,
          description: 'The Flow address to receive the NFT',
          options: undefined
        },
        { 
          name: 'metadata', 
          type: 'String', 
          value: '', 
          required: true,
          description: 'NFT metadata as JSON string',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: ['NonFungibleToken.Collection'],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 150000,
      securityLevel: SecurityLevel.MEDIUM,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'get-account-balance',
      name: 'Get Account Balance',
      description: 'Query the FLOW token balance of an account',
      category: 'query',
      version: '1.0.0',
      inputs: [
        { name: 'address', type: 'Address', description: 'Account address to query', required: true }
      ],
      outputs: [
        { name: 'balance', type: 'UFix64', description: 'Account FLOW balance' }
      ],
      parameters: [
        { 
          name: 'address', 
          type: 'Address', 
          value: '', 
          required: true,
          description: 'The Flow address to query balance for',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 1000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    },
    {
      id: 'execute-script',
      name: 'Execute Script',
      description: 'Execute a read-only Cadence script on the Flow blockchain',
      category: 'script',
      version: '1.0.0',
      inputs: [
        { name: 'script', type: 'String', description: 'Cadence script code', required: true },
        { name: 'arguments', type: 'Array', description: 'Script arguments', required: false }
      ],
      outputs: [
        { name: 'result', type: 'String', description: 'Script execution result' }
      ],
      parameters: [
        { 
          name: 'script', 
          type: 'String', 
          value: '', 
          required: true,
          description: 'The Cadence script code to execute',
          options: undefined
        },
        { 
          name: 'arguments', 
          type: 'Array', 
          value: [], 
          required: false,
          description: 'Arguments to pass to the script',
          options: undefined
        }
      ],
      compatibility: {
        requiredCapabilities: [],
        supportedNetworks: ['testnet', 'mainnet'],
        minimumFlowVersion: '1.0.0',
        conflictsWith: []
      },
      gasEstimate: 5000,
      securityLevel: SecurityLevel.LOW,
      author: 'Flow Foundation',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  ]
}