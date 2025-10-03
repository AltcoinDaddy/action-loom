# ActionLoom Developer Guide

This guide covers the technical architecture, development setup, and contribution guidelines for ActionLoom.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Development Setup](#development-setup)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [API Design](#api-design)
7. [Testing Strategy](#testing-strategy)
8. [Contributing Guidelines](#contributing-guidelines)
9. [Performance Considerations](#performance-considerations)
10. [Security Guidelines](#security-guidelines)

## Architecture Overview

ActionLoom is built as a modern web application with a focus on modularity, type safety, and performance.

### Technology Stack

#### Frontend
- **Framework**: Next.js 15.2.4 with App Router
- **Runtime**: React 19 with TypeScript 5
- **Styling**: Tailwind CSS 4.1.9 with CSS variables
- **UI Components**: Radix UI primitives with shadcn/ui (New York style)
- **Canvas**: ReactFlow (@xyflow/react) for visual workflow builder
- **State Management**: React hooks with local state patterns

#### Backend Services
- **API Routes**: Next.js API routes for server-side logic
- **WebSocket Server**: Real-time NLP feedback (Node.js + ws)
- **Blockchain Integration**: Flow SDK (@onflow/fcl)
- **Validation**: Zod for runtime type validation

#### Build System
- **Package Manager**: pnpm for fast, efficient dependency management
- **Build Tool**: Next.js built-in bundler with Turbopack
- **TypeScript**: Strict mode enabled for type safety
- **Linting**: ESLint with custom rules

### System Architecture

```mermaid
graph TB
    subgraph "Frontend (Next.js)"
        UI[React Components]
        Canvas[ReactFlow Canvas]
        NLP[NLP Input]
        Preview[Code Preview]
    end
    
    subgraph "Backend Services"
        API[API Routes]
        WS[WebSocket Server]
        Validator[Parameter Validator]
        Parser[Workflow Parser]
    end
    
    subgraph "External Services"
        Flow[Flow Blockchain]
        HF[Hugging Face API]
        Oracles[Price Oracles]
    end
    
    UI --> API
    Canvas --> Validator
    NLP --> WS
    Preview --> Parser
    API --> Flow
    WS --> HF
    Validator --> Oracles
```

## Development Setup

### Prerequisites

- **Node.js**: Version 18 or higher
- **pnpm**: Latest version (recommended over npm/yarn)
- **Git**: For version control
- **VS Code**: Recommended editor with extensions

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/your-org/actionloom.git
cd actionloom

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development servers
pnpm run dev:full  # Starts both Next.js and WebSocket server
```

### Environment Configuration

Create a `.env.local` file with the following variables:

```env
# Flow Network Configuration
NEXT_PUBLIC_FLOW_NETWORK=testnet
NEXT_PUBLIC_FLOW_ACCESS_API=https://rest-testnet.onflow.org
NEXT_PUBLIC_FLOW_DISCOVERY_WALLET=https://fcl-discovery.onflow.org/testnet/authn

# API Keys (optional)
HUGGINGFACE_API_KEY=your_huggingface_key
ACTIONLOOM_API_KEY=your_api_key

# Database (optional, for workflow persistence)
DATABASE_URL=postgresql://user:password@localhost:5432/actionloom

# WebSocket Configuration
WEBSOCKET_PORT=8080
WEBSOCKET_HOST=localhost

# Development Settings
NODE_ENV=development
NEXT_TELEMETRY_DISABLED=1
```

### Development Scripts

```bash
# Development
pnpm dev              # Start Next.js development server
pnpm dev:ws           # Start WebSocket server only
pnpm dev:full         # Start both servers concurrently

# Building
pnpm build            # Build for production
pnpm start            # Start production server
pnpm export           # Export static site

# Testing
pnpm test             # Run test suite
pnpm test:watch       # Run tests in watch mode
pnpm test:coverage    # Generate coverage report

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm type-check       # Run TypeScript compiler
pnpm format           # Format code with Prettier
```

### VS Code Setup

Recommended extensions:

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "unifiedjs.vscode-mdx",
    "ms-vscode.vscode-json"
  ]
}
```

Workspace settings (`.vscode/settings.json`):

```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

## Project Structure

```
actionloom/
├── app/                          # Next.js App Router
│   ├── api/                     # API routes
│   │   ├── workflow/           # Workflow operations
│   │   │   ├── save/          # Save workflow endpoint
│   │   │   └── execute/       # Execute workflow endpoint
│   │   └── auth/              # Authentication endpoints
│   ├── builder/               # Workflow builder page
│   │   └── page.tsx          # Main builder interface
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout component
│   └── page.tsx              # Landing page
├── components/                # React components
│   ├── ui/                   # Base UI components (shadcn/ui)
│   │   ├── button.tsx       # Button component
│   │   ├── input.tsx        # Input component
│   │   └── ...              # Other UI primitives
│   ├── workflow-builder.tsx  # Main workflow builder
│   ├── workflow-canvas.tsx   # ReactFlow canvas
│   ├── action-library.tsx    # Action library sidebar
│   ├── action-node.tsx       # Individual action nodes
│   ├── code-preview.tsx      # Code preview panel
│   ├── nlp-input.tsx         # Natural language input
│   └── parameter-config-panel.tsx # Parameter configuration
├── lib/                      # Core business logic
│   ├── types.ts             # TypeScript type definitions
│   ├── workflow-parser.ts   # Workflow parsing logic
│   ├── parameter-validator.ts # Parameter validation
│   ├── cadence-generator.ts # Cadence code generation
│   ├── flow-api-client.ts   # Flow blockchain client
│   ├── action-discovery.ts  # Action discovery service
│   ├── nlp-service.ts       # Natural language processing
│   └── utils.ts             # Utility functions
├── hooks/                   # Custom React hooks
│   ├── use-workflow.ts      # Workflow state management
│   ├── use-nlp-websocket.ts # WebSocket NLP connection
│   └── use-flow-account.ts  # Flow account management
├── docs/                    # Documentation
│   ├── README.md           # API documentation
│   ├── USER_GUIDE.md       # User guide
│   ├── DEVELOPER_GUIDE.md  # This file
│   └── DEPLOYMENT_GUIDE.md # Deployment instructions
├── public/                  # Static assets
│   ├── icons/              # Icon files
│   └── images/             # Image assets
├── styles/                  # Additional stylesheets
├── __tests__/              # Test files
│   ├── components/         # Component tests
│   ├── lib/               # Library tests
│   └── integration/       # Integration tests
└── config files            # Configuration files
    ├── package.json       # Dependencies and scripts
    ├── tsconfig.json      # TypeScript configuration
    ├── tailwind.config.js # Tailwind CSS configuration
    ├── next.config.js     # Next.js configuration
    └── eslint.config.js   # ESLint configuration
```

## Core Components

### WorkflowBuilder

The main orchestrator component that manages the entire workflow building experience.

```typescript
// components/workflow-builder.tsx
export function WorkflowBuilder() {
  const [workflow, setWorkflow] = useState<Workflow>({ nodes: [], edges: [] })
  const [parsedWorkflow, setParsedWorkflow] = useState<ParsedWorkflow | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, ValidationError[]>>({})
  
  // Handles workflow changes and triggers validation
  const handleWorkflowChange = useCallback((newWorkflow: Workflow) => {
    setWorkflow(newWorkflow)
    const parsed = WorkflowParser.parse(newWorkflow.nodes, newWorkflow.edges)
    setParsedWorkflow(parsed)
    validateWorkflow(parsed)
  }, [])
  
  return (
    <div className="flex h-full w-full">
      <ActionLibrary />
      <WorkflowCanvas 
        workflow={workflow}
        setWorkflow={handleWorkflowChange}
        validationErrors={validationErrors}
      />
      <CodePreview workflow={parsedWorkflow} />
    </div>
  )
}
```

### WorkflowCanvas

ReactFlow-based canvas for visual workflow building.

```typescript
// components/workflow-canvas.tsx
export function WorkflowCanvas({ workflow, setWorkflow, validationErrors }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(workflow.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(workflow.edges)
  
  // Handle drag and drop from action library
  const onDrop = useCallback((event: React.DragEvent) => {
    const actionData = JSON.parse(event.dataTransfer.getData("actionMetadata"))
    const newNode = createActionNode(actionData, dropPosition)
    setNodes(nodes => [...nodes, newNode])
  }, [])
  
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onDrop={onDrop}
      nodeTypes={{ action: ActionNode }}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  )
}
```

### ActionNode

Individual action nodes in the workflow canvas.

```typescript
// components/action-node.tsx
export function ActionNode({ data }: NodeProps) {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const hasErrors = data.hasValidationErrors
  
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 shadow-sm",
      hasErrors && "border-red-500"
    )}>
      <div className="flex items-center gap-2">
        <ActionIcon category={data.category} />
        <span className="font-medium">{data.label}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsConfiguring(true)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
      
      {hasErrors && (
        <div className="mt-2 text-sm text-red-600">
          Configuration required
        </div>
      )}
      
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}
```

### ParameterValidator

Comprehensive parameter validation system.

```typescript
// lib/parameter-validator.ts
export class ParameterValidator {
  validateParameter(
    parameter: ActionParameter,
    value: any,
    context: ValidationContext
  ): ParameterValidationResult {
    const errors: ValidationError[] = []
    
    // Required field validation
    if (parameter.required && this.isEmpty(value)) {
      errors.push({
        type: ValidationErrorType.MISSING_REQUIRED,
        message: `${parameter.name} is required`,
        field: parameter.name,
        severity: 'error'
      })
    }
    
    // Type validation
    if (!this.isEmpty(value)) {
      const typeValidation = this.validateType(parameter, value)
      errors.push(...typeValidation.errors)
    }
    
    return {
      parameterName: parameter.name,
      value,
      isValid: errors.length === 0,
      errors,
      warnings: []
    }
  }
  
  private validateType(parameter: ActionParameter, value: any): ValidationResult {
    switch (parameter.type) {
      case 'Address':
        return this.validateAddress(value)
      case 'UFix64':
        return this.validateUFix64(value)
      case 'String':
        return this.validateString(value)
      default:
        return { isValid: true, errors: [], warnings: [] }
    }
  }
}
```

## Data Flow

### Workflow State Management

ActionLoom uses a unidirectional data flow pattern:

```mermaid
graph LR
    A[User Action] --> B[Component Handler]
    B --> C[State Update]
    C --> D[Validation]
    D --> E[Re-render]
    E --> F[UI Update]
```

### Parameter Validation Flow

```mermaid
graph TB
    A[Parameter Change] --> B[Immediate Validation]
    B --> C{Valid?}
    C -->|Yes| D[Update State]
    C -->|No| E[Show Error]
    D --> F[Trigger Workflow Validation]
    E --> F
    F --> G[Update UI Indicators]
```

### Code Generation Pipeline

```mermaid
graph LR
    A[Workflow Nodes] --> B[Parse Structure]
    B --> C[Validate Parameters]
    C --> D[Generate Cadence]
    D --> E[Syntax Check]
    E --> F[Display Code]
```

## API Design

### REST API Endpoints

ActionLoom provides RESTful APIs for programmatic access:

```typescript
// app/api/workflow/save/route.ts
export async function POST(request: Request) {
  try {
    const { workflow } = await request.json()
    
    // Validate workflow structure
    const validation = WorkflowParser.validate(workflow)
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: 'Invalid workflow', details: validation.errors },
        { status: 400 }
      )
    }
    
    // Save to database
    const workflowId = await saveWorkflow(workflow)
    
    return NextResponse.json({
      success: true,
      workflowId,
      message: 'Workflow saved successfully'
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### WebSocket API

Real-time NLP feedback uses WebSocket communication:

```typescript
// lib/websocket-server.mjs
import { WebSocketServer } from 'ws'

const wss = new WebSocketServer({ port: 8080 })

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const message = JSON.parse(data.toString())
    
    switch (message.type) {
      case 'parse_input':
        const result = await parseNaturalLanguage(message.payload.input)
        ws.send(JSON.stringify({
          type: 'parsing_complete',
          payload: { result, input: message.payload.input }
        }))
        break
        
      case 'validate_input':
        const validation = validateInput(message.payload.input)
        ws.send(JSON.stringify({
          type: 'validation_result',
          payload: { validation, input: message.payload.input }
        }))
        break
    }
  })
})
```

### Type Definitions

Comprehensive TypeScript types ensure type safety:

```typescript
// lib/types.ts
export interface Workflow {
  nodes: Node[]
  edges: Edge[]
}

export interface ParsedWorkflow {
  actions: ParsedAction[]
  executionOrder: string[]
  rootActions: string[]
  metadata: WorkflowMetadata
}

export interface ActionMetadata {
  id: string
  name: string
  description: string
  category: string
  parameters: ActionParameter[]
  outputs: ActionOutput[]
  gasEstimate: number
  securityLevel: SecurityLevel
}

export interface ValidationError {
  type: ValidationErrorType
  message: string
  field?: string
  severity: 'error' | 'warning'
}
```

## Testing Strategy

### Unit Tests

Test individual components and functions:

```typescript
// __tests__/lib/parameter-validator.test.ts
import { ParameterValidator } from '@/lib/parameter-validator'

describe('ParameterValidator', () => {
  const validator = new ParameterValidator()
  
  describe('validateAddress', () => {
    it('should validate correct Flow addresses', () => {
      const result = validator.validateParameter(
        { name: 'recipient', type: 'Address', required: true },
        '0x1234567890abcdef',
        mockContext
      )
      
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
    
    it('should reject invalid addresses', () => {
      const result = validator.validateParameter(
        { name: 'recipient', type: 'Address', required: true },
        'invalid-address',
        mockContext
      )
      
      expect(result.isValid).toBe(false)
      expect(result.errors[0].type).toBe(ValidationErrorType.INVALID_FORMAT)
    })
  })
})
```

### Integration Tests

Test component interactions:

```typescript
// __tests__/components/workflow-builder.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkflowBuilder } from '@/components/workflow-builder'

describe('WorkflowBuilder', () => {
  it('should add action to canvas when dragged from library', async () => {
    render(<WorkflowBuilder />)
    
    const transferAction = screen.getByText('Transfer Tokens')
    const canvas = screen.getByTestId('workflow-canvas')
    
    // Simulate drag and drop
    fireEvent.dragStart(transferAction)
    fireEvent.drop(canvas)
    
    expect(screen.getByText('Transfer Tokens')).toBeInTheDocument()
  })
})
```

### End-to-End Tests

Test complete user workflows:

```typescript
// __tests__/e2e/workflow-execution.test.ts
import { test, expect } from '@playwright/test'

test('complete workflow creation and execution', async ({ page }) => {
  await page.goto('/builder')
  
  // Add transfer action
  await page.dragAndDrop('[data-action="transfer-tokens"]', '[data-testid="canvas"]')
  
  // Configure parameters
  await page.click('[data-testid="configure-action"]')
  await page.fill('[name="recipient"]', '0x1234567890abcdef')
  await page.fill('[name="amount"]', '10.0')
  await page.click('[data-testid="save-parameters"]')
  
  // Verify code generation
  const generatedCode = await page.textContent('[data-testid="code-preview"]')
  expect(generatedCode).toContain('transaction(amount: UFix64, to: Address)')
  
  // Execute workflow (mock)
  await page.click('[data-testid="execute-workflow"]')
  await expect(page.locator('[data-testid="execution-modal"]')).toBeVisible()
})
```

## Contributing Guidelines

### Code Style

We use ESLint and Prettier for consistent code formatting:

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

### Commit Convention

We follow Conventional Commits:

```
feat: add natural language processing for workflow creation
fix: resolve parameter validation edge case
docs: update API documentation
style: format code with prettier
refactor: extract validation logic into separate service
test: add unit tests for parameter validator
chore: update dependencies
```

### Pull Request Process

1. **Fork and Branch**: Create a feature branch from `main`
2. **Develop**: Make your changes with tests
3. **Test**: Ensure all tests pass
4. **Document**: Update documentation if needed
5. **Submit**: Create a pull request with clear description

### Code Review Checklist

- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance impact is considered
- [ ] Security implications are reviewed

### Adding New Actions

To add a new blockchain action:

1. **Define Metadata**: Create action metadata in `lib/actions/`
2. **Add Validation**: Implement parameter validation rules
3. **Generate Code**: Add Cadence code generation logic
4. **Create Tests**: Write comprehensive tests
5. **Update Documentation**: Add to user guide and API docs

Example action metadata:

```typescript
// lib/actions/stake-tokens.ts
export const stakeTokensAction: ActionMetadata = {
  id: 'stake-tokens',
  name: 'Stake Tokens',
  description: 'Stake tokens in a staking pool for rewards',
  category: 'defi',
  parameters: [
    {
      name: 'amount',
      type: 'UFix64',
      required: true,
      description: 'Amount of tokens to stake',
      validation: {
        min: 0.1,
        max: 1000000
      }
    },
    {
      name: 'pool',
      type: 'Address',
      required: true,
      description: 'Staking pool contract address'
    }
  ],
  outputs: [
    {
      name: 'stakingReceipt',
      type: 'Resource',
      description: 'Staking receipt resource'
    }
  ],
  gasEstimate: 150,
  securityLevel: SecurityLevel.MEDIUM
}
```

## Performance Considerations

### Bundle Optimization

- **Code Splitting**: Use dynamic imports for large components
- **Tree Shaking**: Ensure unused code is eliminated
- **Image Optimization**: Use Next.js Image component
- **Font Optimization**: Use system fonts with fallbacks

### Runtime Performance

- **React Optimization**: Use React.memo, useMemo, useCallback appropriately
- **State Management**: Minimize re-renders with proper state structure
- **Virtual Scrolling**: For large lists (action library, workflow history)
- **Debouncing**: For real-time validation and NLP processing

### Network Optimization

- **API Caching**: Cache action metadata and workflow templates
- **Request Batching**: Batch multiple validation requests
- **WebSocket Efficiency**: Minimize message frequency and size
- **CDN Usage**: Serve static assets from CDN

### Memory Management

- **Cleanup**: Properly cleanup event listeners and subscriptions
- **Weak References**: Use WeakMap/WeakSet where appropriate
- **Lazy Loading**: Load components and data on demand
- **Resource Pooling**: Reuse expensive objects

## Security Guidelines

### Input Validation

- **Client-side**: Immediate feedback and UX
- **Server-side**: Authoritative validation
- **Sanitization**: Clean all user inputs
- **Type Safety**: Use TypeScript and runtime validation

### Authentication & Authorization

- **Wallet-based Auth**: Use Flow wallet signatures
- **API Keys**: Secure API key management
- **Rate Limiting**: Prevent abuse and DoS attacks
- **CORS**: Proper cross-origin resource sharing

### Smart Contract Security

- **Code Generation**: Generate secure Cadence code
- **Parameter Validation**: Prevent injection attacks
- **Resource Safety**: Proper resource handling
- **Access Control**: Validate permissions

### Data Protection

- **No Private Keys**: Never store or transmit private keys
- **Encryption**: Encrypt sensitive data at rest
- **HTTPS**: All communication over secure channels
- **Audit Logging**: Log security-relevant events

### Dependency Security

- **Regular Updates**: Keep dependencies updated
- **Vulnerability Scanning**: Use tools like npm audit
- **License Compliance**: Ensure license compatibility
- **Supply Chain**: Verify package integrity

---

## Next Steps

After reading this guide, you should:

1. **Set up your development environment**
2. **Explore the codebase structure**
3. **Run the test suite**
4. **Make a small contribution**
5. **Join the community discussions**

For specific questions or help, reach out through:

- **GitHub Issues**: Technical problems and feature requests
- **Discord**: Real-time community support
- **Email**: Direct developer support

Happy coding! 🚀