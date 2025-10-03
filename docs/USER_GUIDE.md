# ActionLoom User Guide

Welcome to ActionLoom! This guide will walk you through everything you need to know to create powerful blockchain workflows without writing code.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding the Interface](#understanding-the-interface)
3. [Building Your First Workflow](#building-your-first-workflow)
4. [Working with Actions](#working-with-actions)
5. [Parameter Configuration](#parameter-configuration)
6. [Natural Language Processing](#natural-language-processing)
7. [Code Preview and Validation](#code-preview-and-validation)
8. [Executing Workflows](#executing-workflows)
9. [Saving and Managing Workflows](#saving-and-managing-workflows)
10. [Advanced Features](#advanced-features)
11. [Best Practices](#best-practices)
12. [Troubleshooting](#troubleshooting)

## Getting Started

### What is ActionLoom?

ActionLoom is a visual blockchain workflow builder that lets you create complex Flow blockchain automations using a drag-and-drop interface. Think of it as "Zapier for blockchain" - you can connect different blockchain operations together to create powerful automated workflows.

### Key Concepts

- **Actions**: Pre-built blockchain operations (transfer tokens, mint NFTs, etc.)
- **Workflows**: Connected sequences of actions that execute in order
- **Parameters**: Configuration values for each action (amounts, addresses, etc.)
- **Cadence**: The smart contract language that powers Flow blockchain
- **Agents**: Automated systems that can execute workflows on schedules or triggers

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Basic understanding of blockchain concepts (tokens, addresses, transactions)
- A Flow wallet (optional for building, required for execution)

## Understanding the Interface

### Main Layout

The ActionLoom interface consists of four main areas:

```
┌─────────────────┬─────────────────────────────────┬─────────────────┐
│                 │                                 │                 │
│  Action Library │         Workflow Canvas         │  Code Preview   │
│                 │                                 │                 │
│  - Categories   │  - Drag & Drop Actions Here     │  - Generated    │
│  - Search       │  - Connect Actions              │    Cadence      │
│  - 50+ Actions  │  - Configure Parameters         │  - Real-time    │
│                 │                                 │    Updates      │
└─────────────────┴─────────────────────────────────┴─────────────────┘
```

### Action Library (Left Sidebar)

The Action Library contains all available blockchain operations organized by category:

- **🔄 DeFi**: Token swaps, liquidity provision, staking
- **🎨 NFT**: Minting, transfers, marketplace operations
- **💰 Tokens**: Basic token operations and transfers
- **🏛️ Governance**: Voting and proposal management
- **🔧 Utilities**: Helper functions and data operations

### Workflow Canvas (Center)

The main workspace where you build your workflows:

- **Empty State**: Shows helpful instructions when no actions are present
- **Action Nodes**: Visual representations of blockchain operations
- **Connections**: Lines showing the flow between actions
- **Controls**: Zoom, pan, and minimap for navigation

### Code Preview (Right Panel)

Shows the generated Cadence smart contract code:

- **Real-time Updates**: Code changes as you modify your workflow
- **Syntax Highlighting**: Easy-to-read code formatting
- **Copy/Download**: Export generated code for external use

### Header Controls

- **Input Mode Toggle**: Switch between Visual and Natural Language modes
- **Workflow Stats**: Shows action count and connections
- **Save Button**: Save your workflow for later use
- **Execute Button**: Deploy and run your workflow on Flow

## Building Your First Workflow

Let's create a simple token transfer workflow step by step.

### Step 1: Access the Builder

1. Open ActionLoom in your browser
2. Click "Start Building" from the homepage
3. You'll see the empty workflow canvas with instructions

### Step 2: Add Your First Action

1. In the Action Library, find the "Tokens" category
2. Locate "Transfer Tokens" action
3. Drag it onto the canvas
4. The action node appears with a configuration icon

### Step 3: Configure the Action

1. Click on the "Transfer Tokens" node
2. A parameter configuration panel opens
3. Fill in the required fields:
   - **Recipient Address**: `0x1234567890abcdef` (example)
   - **Token Type**: `FLOW`
   - **Amount**: `10.0`
4. Click "Save" to close the configuration panel

### Step 4: Preview the Generated Code

Look at the Code Preview panel on the right. You'll see generated Cadence code like:

```cadence
transaction(amount: UFix64, to: Address) {
    prepare(signer: AuthAccount) {
        let vaultRef = signer.borrow<&FlowToken.Vault>(from: /storage/flowTokenVault)
            ?? panic("Could not borrow reference to the owner's Vault!")
        
        let sentVault <- vaultRef.withdraw(amount: amount)
        
        let recipient = getAccount(to)
        let receiverRef = recipient.getCapability(/public/flowTokenReceiver)
            .borrow<&{FungibleToken.Receiver}>()
            ?? panic("Could not borrow receiver reference to the recipient's Vault")
        
        receiverRef.deposit(from: <-sentVault)
    }
}
```

### Step 5: Execute the Workflow

1. Click "Execute Workflow" in the header
2. Connect your Flow wallet when prompted
3. Review the transaction details
4. Confirm the transaction in your wallet
5. Wait for confirmation on the Flow blockchain

Congratulations! You've created and executed your first ActionLoom workflow.

## Working with Actions

### Action Categories

#### DeFi Actions
- **Swap Tokens**: Exchange one token for another
- **Add Liquidity**: Provide liquidity to trading pools
- **Stake Tokens**: Stake tokens for rewards
- **Compound Rewards**: Automatically reinvest earned rewards

#### NFT Actions
- **Mint NFT**: Create new NFTs
- **Transfer NFT**: Send NFTs to other addresses
- **List NFT**: Put NFTs up for sale on marketplaces
- **Batch Operations**: Perform multiple NFT operations at once

#### Token Actions
- **Transfer Tokens**: Send tokens to other addresses
- **Mint Tokens**: Create new tokens (if you have permission)
- **Burn Tokens**: Permanently destroy tokens
- **Check Balance**: Query token balances

#### Governance Actions
- **Create Proposal**: Submit governance proposals
- **Vote on Proposal**: Cast votes on existing proposals
- **Delegate Voting Power**: Delegate your voting rights

### Action Properties

Each action has several properties:

- **Name**: Human-readable action name
- **Description**: What the action does
- **Category**: Which category it belongs to
- **Parameters**: Required and optional configuration values
- **Outputs**: Data the action produces for use by other actions
- **Gas Estimate**: Approximate transaction cost
- **Security Level**: Risk assessment (Low, Medium, High)

### Connecting Actions

Actions can be connected to create workflows:

1. **Sequential Execution**: Actions run one after another
2. **Data Flow**: Outputs from one action become inputs to the next
3. **Conditional Logic**: Some actions can branch based on conditions
4. **Parallel Execution**: Multiple actions can run simultaneously

### Example: Multi-Step DeFi Workflow

```
[Check Balance] → [Swap 50% USDC to FLOW] → [Stake FLOW] → [Compound Rewards]
```

This workflow:
1. Checks your USDC balance
2. Swaps half of it to FLOW tokens
3. Stakes the FLOW tokens for rewards
4. Sets up automatic reward compounding

## Parameter Configuration

### Parameter Types

ActionLoom supports various parameter types:

#### Address Parameters
- **Format**: `0x` followed by 16 hexadecimal characters
- **Example**: `0x1234567890abcdef`
- **Validation**: Automatically checks format and checksum

#### Amount Parameters (UFix64)
- **Format**: Decimal numbers with up to 8 decimal places
- **Example**: `100.0`, `1.5`, `0.00000001`
- **Validation**: Must be positive, within token supply limits

#### String Parameters
- **Format**: Text values
- **Example**: NFT names, descriptions, metadata URLs
- **Validation**: Length limits, character restrictions

#### Boolean Parameters
- **Format**: True/false values
- **Example**: Enable/disable features, yes/no options
- **Interface**: Toggle switches or checkboxes

#### Integer Parameters
- **Format**: Whole numbers
- **Example**: Token IDs, quantities, time periods
- **Validation**: Range checking, positive/negative constraints

### Parameter Sources

Parameters can come from different sources:

#### Manual Input
- Type values directly into form fields
- Use dropdowns for predefined options
- Toggle switches for boolean values

#### Action Outputs
- Use outputs from previous actions as inputs
- Automatic type checking and validation
- Visual connections show data flow

#### Dynamic Values
- Current timestamp
- User's wallet address
- Token balances
- Market prices (via oracles)

### Validation and Errors

ActionLoom provides real-time parameter validation:

#### Error Types
- **Missing Required**: Red indicator for empty required fields
- **Invalid Format**: Format doesn't match expected pattern
- **Out of Range**: Values outside acceptable limits
- **Type Mismatch**: Wrong data type for parameter

#### Visual Indicators
- ✅ **Green**: Valid parameter
- ⚠️ **Yellow**: Warning or suggestion
- ❌ **Red**: Error that prevents execution
- 🔗 **Blue**: Parameter connected to action output

### Advanced Parameter Features

#### Parameter References
Reference outputs from other actions:

```
Action1.tokenAmount → Action2.swapAmount
Action1.recipientAddress → Action2.stakingAddress
```

#### Default Values
Many parameters have sensible defaults:

- **Slippage**: 0.5% for token swaps
- **Deadline**: 10 minutes for time-sensitive operations
- **Gas Limit**: Estimated based on action complexity

#### Parameter Suggestions
ActionLoom provides intelligent suggestions:

- **Common Addresses**: Popular contract addresses
- **Token Symbols**: Available tokens on Flow
- **Typical Amounts**: Common transaction amounts
- **Best Practices**: Recommended parameter values

## Natural Language Processing

ActionLoom's NLP feature lets you create workflows using plain English descriptions.

### Accessing NLP Mode

1. Click the "Natural Language" tab in the header
2. The interface switches to a text input area
3. Type your workflow description in natural language

### Supported Patterns

#### Simple Operations
```
"Transfer 100 FLOW to 0x1234567890abcdef"
"Swap 50 USDC for FLOW"
"Mint an NFT with name 'My Artwork'"
```

#### Complex Workflows
```
"Swap 100 USDC to FLOW, then stake 80% and keep 20% liquid"
"Check my FLOW balance, if over 1000 then stake half in PoolX"
"Mint 10 NFTs, set metadata, and list them for 5 FLOW each"
```

#### Conditional Logic
```
"If FLOW price is above $2, swap 100 USDC to FLOW"
"When my staking rewards reach 10 FLOW, compound them"
"Transfer tokens only if balance is sufficient"
```

### Real-time Feedback

As you type, ActionLoom provides:

#### Entity Highlighting
- **Actions**: Blue highlighting for detected operations
- **Amounts**: Green highlighting for numbers and quantities
- **Tokens**: Yellow highlighting for token symbols
- **Addresses**: Purple highlighting for blockchain addresses

#### Suggestions
- **Auto-complete**: Finish common phrases
- **Corrections**: Fix typos and grammar
- **Alternatives**: Suggest different ways to express the same idea

#### Validation
- **Completeness**: Ensure all required information is provided
- **Feasibility**: Check if the workflow is technically possible
- **Optimization**: Suggest improvements for efficiency

### Converting to Visual Workflow

1. Type your workflow description
2. Click "Generate Workflow" or press Enter
3. ActionLoom converts text to visual workflow
4. Review and modify the generated actions
5. Configure any missing parameters

### Example NLP Workflow

**Input**: "Swap 100 USDC to FLOW and stake it for rewards"

**Generated Workflow**:
```
[Swap Tokens] → [Stake Tokens]
├─ Token In: USDC
├─ Token Out: FLOW  
├─ Amount: 100
└─ Connected to: Stake Tokens
    ├─ Token: FLOW (from swap output)
    ├─ Amount: (from swap output)
    └─ Pool: Default staking pool
```

## Code Preview and Validation

### Understanding Generated Code

ActionLoom generates Cadence smart contract code that executes your workflow on the Flow blockchain.

#### Transaction Structure
```cadence
// Import statements - bring in required contracts
import FungibleToken from 0xf233dcee88fe0abe
import FlowToken from 0x1654653399040a61

// Transaction function with parameters
transaction(amount: UFix64, to: Address) {
    
    // Prepare phase - set up accounts and resources
    prepare(signer: AuthAccount) {
        // Your workflow logic here
    }
    
    // Execute phase - perform the actual operations
    execute {
        // Additional execution logic if needed
    }
}
```

#### Key Components

**Imports**: Required Flow contracts and interfaces
**Parameters**: Values passed to the transaction
**Prepare Phase**: Account setup and resource borrowing
**Execute Phase**: Main transaction logic
**Error Handling**: Panic statements for safety

### Real-time Validation

The code preview includes several validation features:

#### Syntax Checking
- **Valid Cadence**: Code compiles without errors
- **Type Safety**: All variables have correct types
- **Resource Safety**: Proper resource handling

#### Security Analysis
- **Access Control**: Proper permission checking
- **Resource Management**: No resource leaks
- **Input Validation**: Parameter bounds checking

#### Gas Estimation
- **Transaction Cost**: Estimated gas fees
- **Complexity Score**: Relative execution cost
- **Optimization Suggestions**: Ways to reduce costs

### Code Features

#### Syntax Highlighting
- **Keywords**: Blue for Cadence keywords
- **Types**: Green for type names
- **Strings**: Orange for string literals
- **Comments**: Gray for explanatory text

#### Interactive Elements
- **Copy Button**: Copy code to clipboard
- **Download**: Save code as .cdc file
- **Share**: Generate shareable code links
- **Format**: Auto-format for readability

#### Error Display
When validation fails, errors are shown with:
- **Line Numbers**: Exact location of issues
- **Error Messages**: Clear descriptions of problems
- **Suggestions**: How to fix the errors
- **Documentation Links**: Relevant Cadence docs

### Advanced Code Features

#### Code Optimization
ActionLoom automatically optimizes generated code:

- **Resource Efficiency**: Minimize resource usage
- **Gas Optimization**: Reduce transaction costs
- **Security Hardening**: Add safety checks
- **Best Practices**: Follow Cadence conventions

#### Custom Code Injection
Advanced users can inject custom Cadence code:

- **Pre-hooks**: Code that runs before actions
- **Post-hooks**: Code that runs after actions
- **Custom Logic**: Complex conditional statements
- **External Calls**: Interact with other contracts

## Executing Workflows

### Execution Requirements

Before executing a workflow, ensure:

1. **Valid Workflow**: All actions are properly configured
2. **Parameter Validation**: No validation errors
3. **Flow Wallet**: Connected and funded wallet
4. **Network Selection**: Testnet or mainnet
5. **Gas Fees**: Sufficient FLOW for transaction costs

### Wallet Connection

ActionLoom supports multiple Flow wallets:

#### Supported Wallets
- **Blocto**: Web and mobile wallet
- **Lilico**: Browser extension wallet
- **Dapper**: Gaming-focused wallet
- **Flow Wallet**: Official Flow wallet

#### Connection Process
1. Click "Execute Workflow"
2. Select your preferred wallet
3. Approve the connection request
4. Wallet appears as connected in the interface

### Execution Process

#### Pre-execution Checks
1. **Workflow Validation**: Ensure all parameters are valid
2. **Balance Verification**: Check sufficient token balances
3. **Gas Estimation**: Calculate transaction costs
4. **Security Review**: Highlight any security considerations

#### Transaction Submission
1. **Code Generation**: Final Cadence code compilation
2. **Parameter Injection**: Insert actual parameter values
3. **Transaction Creation**: Build Flow transaction
4. **Wallet Signing**: Request signature from connected wallet

#### Execution Monitoring
1. **Transaction Hash**: Unique identifier for tracking
2. **Status Updates**: Real-time execution progress
3. **Block Confirmation**: Wait for blockchain confirmation
4. **Result Display**: Show success/failure with details

### Execution Results

#### Success Results
- **Transaction ID**: Link to Flow blockchain explorer
- **Gas Used**: Actual transaction cost
- **Execution Time**: How long the transaction took
- **Output Values**: Any data produced by the workflow
- **Balance Changes**: Before/after token balances

#### Error Handling
- **Execution Errors**: Problems during blockchain execution
- **Revert Reasons**: Why the transaction failed
- **Suggested Fixes**: How to resolve the issues
- **Retry Options**: Ability to modify and re-execute

### Network Considerations

#### Testnet vs Mainnet
- **Testnet**: Free testing environment with test tokens
- **Mainnet**: Production environment with real value
- **Switching**: Easy network switching in wallet

#### Transaction Costs
- **Gas Fees**: Paid in FLOW tokens
- **Complexity**: More complex workflows cost more
- **Optimization**: ActionLoom optimizes for lower costs

## Saving and Managing Workflows

### Saving Workflows

#### Local Storage
- **Browser Storage**: Workflows saved locally
- **Automatic Saves**: Periodic saving while building
- **Session Recovery**: Restore workflows after browser restart

#### Cloud Storage (Coming Soon)
- **Account Sync**: Save workflows to your account
- **Cross-device Access**: Access from any device
- **Collaboration**: Share workflows with team members

### Workflow Management

#### Workflow Library
- **My Workflows**: Your saved workflows
- **Templates**: Pre-built workflow templates
- **Community**: Workflows shared by other users
- **Favorites**: Bookmark useful workflows

#### Organization Features
- **Categories**: Organize workflows by type
- **Tags**: Add custom tags for easy searching
- **Search**: Find workflows by name or description
- **Sorting**: Sort by date, name, or usage

### Sharing and Collaboration

#### Export Options
- **JSON Export**: Complete workflow definition
- **Code Export**: Generated Cadence code
- **Image Export**: Visual workflow diagram
- **Link Sharing**: Shareable workflow URLs

#### Import Options
- **JSON Import**: Load exported workflows
- **Template Import**: Use community templates
- **Code Import**: Convert existing Cadence code
- **URL Import**: Load shared workflow links

## Advanced Features

### Agent Automation

Agents are automated systems that can execute workflows based on schedules or triggers.

#### Agent Types
- **Scheduled Agents**: Run workflows at specific times
- **Event-driven Agents**: Triggered by blockchain events
- **Conditional Agents**: Execute based on conditions

#### Creating Agents
1. Build and test your workflow
2. Click "Configure Agent" in the canvas controls
3. Set up schedule or triggers
4. Configure notifications and error handling
5. Deploy the agent

#### Agent Management
- **Status Monitoring**: Track agent health and execution
- **Execution History**: View past agent runs
- **Error Handling**: Automatic retries and notifications
- **Resource Management**: Monitor gas usage and costs

### Workflow Templates

#### Template Categories
- **DeFi Strategies**: Yield farming, arbitrage, rebalancing
- **NFT Operations**: Minting, trading, collection management
- **Token Management**: Distribution, vesting, governance
- **Gaming**: In-game economies, rewards, tournaments

#### Using Templates
1. Browse the template library
2. Select a template that matches your needs
3. Customize parameters for your use case
4. Test and deploy the workflow

#### Creating Templates
1. Build a reusable workflow
2. Add parameter placeholders
3. Write clear documentation
4. Submit to the community library

### Advanced Parameter Features

#### Dynamic Parameters
- **Oracle Data**: Real-time price feeds
- **Blockchain State**: Current block height, timestamp
- **User Context**: Wallet balance, transaction history
- **External APIs**: Weather, sports scores, market data

#### Parameter Validation Rules
- **Custom Validators**: Write your own validation logic
- **Cross-parameter Validation**: Validate parameter combinations
- **Async Validation**: Validate against blockchain state
- **Conditional Requirements**: Parameters required based on others

### Integration Features

#### API Integration
- **REST API**: Programmatic workflow creation and execution
- **Webhooks**: Receive notifications about workflow events
- **SDK Support**: JavaScript, Python, and Go SDKs
- **GraphQL**: Query workflow data and history

#### External Services
- **Price Oracles**: Chainlink, Band Protocol integration
- **Notification Services**: Email, SMS, Discord, Slack
- **Analytics**: Track workflow performance and costs
- **Monitoring**: Uptime and error rate monitoring

## Best Practices

### Workflow Design

#### Keep It Simple
- Start with simple workflows and add complexity gradually
- Use clear, descriptive names for actions and parameters
- Document your workflow's purpose and expected behavior
- Test thoroughly on testnet before mainnet deployment

#### Error Handling
- Always validate inputs before execution
- Handle edge cases and error conditions
- Set appropriate slippage and deadline parameters
- Include fallback options for critical operations

#### Security Considerations
- Never hardcode private keys or sensitive data
- Validate all external inputs and parameters
- Use the minimum required permissions
- Regularly audit and update your workflows

### Parameter Management

#### Use Meaningful Defaults
- Set sensible default values for optional parameters
- Use current market conditions for price-related defaults
- Provide helpful tooltips and descriptions
- Make required parameters clearly obvious

#### Data Flow Design
- Plan your data flow before building the workflow
- Minimize the number of intermediate steps
- Use action outputs efficiently
- Avoid circular dependencies

### Performance Optimization

#### Gas Efficiency
- Combine multiple operations when possible
- Use batch operations for repetitive tasks
- Optimize parameter types and sizes
- Remove unnecessary validation steps

#### Execution Speed
- Minimize the number of blockchain interactions
- Use parallel execution where possible
- Cache frequently used data
- Optimize network calls and API usage

### Testing and Validation

#### Testnet Testing
- Always test new workflows on testnet first
- Use realistic test data and scenarios
- Test edge cases and error conditions
- Verify all parameter validations work correctly

#### Monitoring and Maintenance
- Monitor workflow execution regularly
- Set up alerts for failures or unusual behavior
- Keep workflows updated with latest best practices
- Archive or deprecate unused workflows

## Troubleshooting

### Common Issues

#### Workflow Building Issues

**Problem**: Actions won't connect
- **Cause**: Incompatible action types or missing outputs
- **Solution**: Check action compatibility and ensure previous actions produce required outputs

**Problem**: Parameter validation errors
- **Cause**: Invalid parameter values or formats
- **Solution**: Review parameter requirements and use suggested formats

**Problem**: Generated code has errors
- **Cause**: Invalid workflow structure or missing parameters
- **Solution**: Validate all actions and parameters, check for circular dependencies

#### Execution Issues

**Problem**: Transaction fails with "insufficient balance"
- **Cause**: Not enough tokens to complete the transaction
- **Solution**: Check token balances and reduce transaction amounts

**Problem**: Transaction fails with "gas limit exceeded"
- **Cause**: Workflow is too complex for single transaction
- **Solution**: Simplify workflow or split into multiple transactions

**Problem**: Wallet connection issues
- **Cause**: Wallet not installed or network mismatch
- **Solution**: Install supported wallet and ensure correct network selection

#### Performance Issues

**Problem**: Slow workflow execution
- **Cause**: Network congestion or complex operations
- **Solution**: Increase gas price or simplify workflow

**Problem**: High transaction costs
- **Cause**: Inefficient workflow design or network congestion
- **Solution**: Optimize workflow structure and timing

### Getting Help

#### Self-Service Resources
- **Documentation**: Comprehensive guides and tutorials
- **Video Tutorials**: Step-by-step video instructions
- **FAQ**: Frequently asked questions and answers
- **Community Forum**: User discussions and solutions

#### Support Channels
- **Discord Community**: Real-time chat with users and developers
- **GitHub Issues**: Report bugs and request features
- **Email Support**: Direct support for complex issues
- **Enterprise Support**: Dedicated support for business users

#### Diagnostic Tools
- **Workflow Validator**: Built-in validation and error checking
- **Gas Estimator**: Predict transaction costs before execution
- **Network Status**: Check Flow network health and congestion
- **Debug Mode**: Detailed logging and error information

### Error Reference

#### Common Error Codes
- **INVALID_PARAMETER**: Parameter value doesn't match requirements
- **INSUFFICIENT_BALANCE**: Not enough tokens for transaction
- **NETWORK_ERROR**: Blockchain network connectivity issues
- **VALIDATION_FAILED**: Workflow structure validation failed
- **EXECUTION_TIMEOUT**: Transaction took too long to execute

#### Recovery Procedures
1. **Check Error Details**: Read the full error message and code
2. **Verify Parameters**: Ensure all parameters are correct
3. **Check Balances**: Verify sufficient token balances
4. **Retry Transaction**: Some errors are temporary
5. **Contact Support**: For persistent or unclear errors

---

## Next Steps

Now that you understand how to use ActionLoom, explore these advanced topics:

- **[Developer Guide](./DEVELOPER_GUIDE.md)**: Learn about the technical architecture
- **[API Documentation](./README.md)**: Build applications that use ActionLoom
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)**: Deploy your own ActionLoom instance

Happy building! 🚀