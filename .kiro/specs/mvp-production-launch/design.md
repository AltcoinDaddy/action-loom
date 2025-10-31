# Design Document

## Overview

The MVP Production Launch design focuses on creating a minimal but complete production-ready version of ActionLoom that enables users to authenticate, create, save, and execute blockchain workflows on Flow. The architecture prioritizes simplicity, reliability, and user experience while establishing a foundation for future features.

## Architecture

### System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (Next.js)     │◄──►│   (Next.js API) │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Flow Wallet   │    │   Flow Network  │    │   File Storage  │
│   (FCL)         │    │   (Testnet/Main)│    │   (Local/Cloud) │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack
- **Frontend**: Next.js 15 with React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with server-side rendering
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Flow wallet integration via FCL
- **Blockchain**: Flow testnet and mainnet via FCL
- **Deployment**: Docker containers on cloud platform (Vercel/Railway)
- **Monitoring**: Basic logging and error tracking

## Components and Interfaces

### 1. Authentication System

#### Wallet Connection Component
```typescript
interface WalletConnection {
  isConnected: boolean
  address: string | null
  network: 'testnet' | 'mainnet'
  connect(): Promise<void>
  disconnect(): void
  signMessage(message: string): Promise<string>
}
```

#### User Session Management
```typescript
interface UserSession {
  walletAddress: string
  isAuthenticated: boolean
  createdAt: Date
  lastActivity: Date
}
```

### 2. Workflow Management System

#### Workflow Data Model
```typescript
interface SavedWorkflow {
  id: string
  name: string
  description: string
  walletAddress: string
  workflowData: {
    nodes: Node[]
    edges: Edge[]
    parameters: Record<string, any>
  }
  createdAt: Date
  updatedAt: Date
  executionCount: number
}
```

#### Workflow Repository
```typescript
interface WorkflowRepository {
  save(workflow: SavedWorkflow): Promise<string>
  findByWallet(walletAddress: string): Promise<SavedWorkflow[]>
  findById(id: string): Promise<SavedWorkflow | null>
  update(id: string, updates: Partial<SavedWorkflow>): Promise<void>
  delete(id: string): Promise<void>
}
```

### 3. Database Schema

#### Users Table
```sql
CREATE TABLE users (
  wallet_address VARCHAR(42) PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP DEFAULT NOW(),
  total_workflows INTEGER DEFAULT 0,
  total_executions INTEGER DEFAULT 0
);
```

#### Workflows Table
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  wallet_address VARCHAR(42) REFERENCES users(wallet_address),
  workflow_data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  execution_count INTEGER DEFAULT 0
);
```

#### Executions Table
```sql
CREATE TABLE executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  wallet_address VARCHAR(42) REFERENCES users(wallet_address),
  transaction_id VARCHAR(64),
  status VARCHAR(20) NOT NULL, -- 'pending', 'success', 'failed'
  error_message TEXT,
  gas_used INTEGER,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Flow Blockchain Integration

#### Transaction Service
```typescript
interface TransactionService {
  executeWorkflow(
    workflow: ParsedWorkflow,
    walletAddress: string
  ): Promise<ExecutionResult>
  
  simulateTransaction(
    cadenceCode: string,
    parameters: any[]
  ): Promise<SimulationResult>
  
  getTransactionStatus(
    transactionId: string
  ): Promise<TransactionStatus>
}
```

#### Cadence Code Generator
```typescript
interface CadenceGenerator {
  generateTransaction(workflow: ParsedWorkflow): string
  validateSyntax(cadenceCode: string): ValidationResult
  estimateGas(cadenceCode: string): Promise<number>
}
```

### 5. User Dashboard

#### Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│ Header: Logo | User Address | Network | Disconnect      │
├─────────────────────────────────────────────────────────┤
│ Stats: Total Workflows | Executions | Success Rate      │
├─────────────────────────────────────────────────────────┤
│ Actions: [New Workflow] [Import] [Export All]           │
├─────────────────────────────────────────────────────────┤
│ Workflow List:                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Workflow Name        Created    Modified    Actions │ │
│ │ Token Transfer       2 days ago 1 day ago   [Edit] │ │
│ │ NFT Minting         1 week ago  3 days ago  [Edit] │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### Workflow Card Component
```typescript
interface WorkflowCard {
  workflow: SavedWorkflow
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onExecute: (id: string) => void
}
```

## Data Models

### Core Data Flow
1. **User Authentication**: Wallet connects → User record created/updated
2. **Workflow Creation**: Builder → Validation → Save to database
3. **Workflow Execution**: Load workflow → Generate Cadence → Execute on Flow
4. **Result Tracking**: Transaction submitted → Status monitoring → Result storage

### State Management
```typescript
// Global App State
interface AppState {
  user: {
    walletAddress: string | null
    isConnected: boolean
    network: 'testnet' | 'mainnet'
  }
  workflows: {
    list: SavedWorkflow[]
    current: SavedWorkflow | null
    loading: boolean
  }
  execution: {
    isExecuting: boolean
    result: ExecutionResult | null
  }
}
```

## Error Handling

### Error Categories
1. **Authentication Errors**: Wallet connection failures, network issues
2. **Validation Errors**: Invalid workflow parameters, missing required fields
3. **Execution Errors**: Transaction failures, insufficient funds, network errors
4. **Database Errors**: Connection issues, query failures, constraint violations

### Error Response Format
```typescript
interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: any
    userMessage: string
  }
}
```

### Error Handling Strategy
- **User-Friendly Messages**: Convert technical errors to understandable language
- **Retry Mechanisms**: Automatic retry for transient failures
- **Fallback Options**: Alternative actions when primary operations fail
- **Error Logging**: Comprehensive logging for debugging and monitoring

## Testing Strategy

### Unit Testing
- **Components**: React component rendering and interactions
- **Services**: Database operations, blockchain interactions
- **Utilities**: Validation functions, data transformations
- **API Routes**: Request/response handling, error cases

### Integration Testing
- **Wallet Integration**: FCL connection and transaction signing
- **Database Operations**: CRUD operations with real database
- **Flow Network**: Transaction execution on testnet
- **End-to-End Workflows**: Complete user journeys

### Performance Testing
- **Load Testing**: Multiple concurrent users
- **Database Performance**: Query optimization and indexing
- **Frontend Performance**: Bundle size and loading times
- **Blockchain Performance**: Transaction throughput and gas optimization

## Security Considerations

### Authentication Security
- **Wallet Verification**: Cryptographic signature verification
- **Session Management**: Secure session tokens with expiration
- **Network Security**: HTTPS enforcement, secure headers

### Data Security
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: Parameterized queries via Prisma
- **XSS Prevention**: Input sanitization and CSP headers

### Transaction Security
- **Parameter Validation**: Strict validation before execution
- **Gas Estimation**: Prevent excessive gas usage
- **Transaction Simulation**: Pre-execution validation
- **User Confirmation**: Clear transaction details before signing

## Performance Optimization

### Frontend Optimization
- **Code Splitting**: Lazy loading of components
- **Image Optimization**: Next.js image optimization
- **Caching**: Browser caching for static assets
- **Bundle Optimization**: Tree shaking and minification

### Backend Optimization
- **Database Indexing**: Proper indexes on frequently queried columns
- **Connection Pooling**: Efficient database connection management
- **API Caching**: Cache frequently accessed data
- **Query Optimization**: Efficient database queries

### Blockchain Optimization
- **Transaction Batching**: Combine multiple operations when possible
- **Gas Optimization**: Efficient Cadence code generation
- **Network Selection**: Appropriate network for user needs
- **Retry Logic**: Smart retry mechanisms for failed transactions

## Deployment Architecture

### Production Environment
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   App Instances │    │   Database      │
│   (Cloud LB)    │◄──►│   (Docker)      │◄──►│   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   CDN           │    │   Monitoring    │    │   Backup        │
│   (Static)      │    │   (Logs/Alerts) │    │   (Automated)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Deployment Pipeline
1. **Code Commit** → GitHub repository
2. **Build Process** → Docker image creation
3. **Testing** → Automated test suite
4. **Deployment** → Zero-downtime deployment
5. **Monitoring** → Health checks and alerts

### Environment Configuration
- **Development**: Local database, Flow testnet
- **Staging**: Cloud database, Flow testnet
- **Production**: Production database, Flow mainnet option

This design provides a solid foundation for launching ActionLoom as a production-ready platform while maintaining simplicity and focusing on core user needs.