# ActionLoom

<div align="center">
  <img src="https://via.placeholder.com/200x200/6366f1/ffffff?text=AL" alt="ActionLoom Logo" width="120" height="120">
  
  **Visual Blockchain Workflow Builder for Flow**
  
  Create powerful Flow blockchain automations without writing code. Drag, connect, and deploy smart contract workflows in minutes.

  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
  [![Flow](https://img.shields.io/badge/Flow-00EF8B?logo=flow&logoColor=white)](https://flow.com/)
</div>

## 🌟 Features

- **🎨 Visual Workflow Builder** - Drag-and-drop interface for creating blockchain workflows
- **🔗 50+ Pre-built Actions** - Token transfers, NFT minting, DeFi operations, and more
- **⚡ Real-time Code Generation** - Instantly convert workflows to Cadence smart contracts
- **🤖 AI Agent Compatible** - RESTful API for programmatic workflow composition
- **💬 Natural Language Processing** - Create workflows from plain English descriptions
- **🔒 Wallet-optional Development** - Build and test without connecting a wallet
- **📊 Parameter Validation** - Comprehensive validation with real-time feedback
- **🎯 One-click Execution** - Deploy to Flow testnet or mainnet instantly

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- Flow CLI (optional, for advanced features)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/actionloom.git
cd actionloom

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000) to start building workflows!

### Your First Workflow

1. **Open the Builder** - Click "Start Building" or navigate to `/builder`
2. **Drag Actions** - From the left sidebar, drag "Transfer Tokens" to the canvas
3. **Configure Parameters** - Click the action node to set recipient address and amount
4. **Preview Code** - See the generated Cadence code in the right panel
5. **Execute** - Connect your Flow wallet and click "Execute Workflow"

## 📖 Documentation

- **[User Guide](./docs/USER_GUIDE.md)** - Step-by-step tutorials for building workflows
- **[Developer Guide](./docs/DEVELOPER_GUIDE.md)** - Component architecture and contributing
- **[API Documentation](./docs/README.md)** - Complete API reference for AI agents
- **[Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)** - Production deployment instructions
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions

## 🏗️ Architecture

ActionLoom is built with modern web technologies:

### Frontend Stack
- **Framework**: Next.js 15.2.4 with App Router
- **Runtime**: React 19 with TypeScript 5
- **Styling**: Tailwind CSS 4.1.9 with CSS variables
- **UI Components**: Radix UI primitives with shadcn/ui
- **Canvas**: ReactFlow for visual workflow builder

### Blockchain Integration
- **Flow SDK**: @onflow/fcl for blockchain interactions
- **Smart Contracts**: Cadence code generation and execution
- **Networks**: Flow testnet and mainnet support

### Key Components

```
├── app/                    # Next.js App Router pages
│   ├── builder/           # Main workflow builder interface
│   └── api/               # API routes for workflow operations
├── components/            # React components
│   ├── ui/               # Reusable UI components (shadcn/ui)
│   ├── workflow-builder.tsx  # Main builder component
│   ├── workflow-canvas.tsx   # Visual canvas with ReactFlow
│   └── action-library.tsx    # Action library sidebar
├── lib/                   # Core business logic
│   ├── types.ts          # TypeScript type definitions
│   ├── workflow-parser.ts # Workflow parsing and validation
│   ├── parameter-validator.ts # Parameter validation system
│   └── forte-integration/ # Flow blockchain integration
└── docs/                  # Documentation
```

## 🎯 Use Cases

### DeFi Automation
```
Swap USDC → FLOW → Stake in Pool → Compound Rewards
```

### NFT Operations
```
Mint NFT Collection → Set Metadata → List on Marketplace
```

### Portfolio Management
```
Monitor Balance → Rebalance Portfolio → Send Notifications
```

### AI Trading Bots
```
Price Alert → Execute Trade → Update Stop Loss
```

## 🤖 AI Agent API

ActionLoom provides a RESTful API for AI agents to compose and execute workflows:

```bash
# Discover available actions
curl "https://api.actionloom.com/v1/actions?q=swap&limit=5" \
  -H "Authorization: Bearer al_your_api_key"

# Compose workflow from natural language
curl -X POST https://api.actionloom.com/v1/compose \
  -H "Authorization: Bearer al_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "naturalLanguage": "Swap 100 USDC to FLOW and stake in PoolX"
  }'
```

## 🛠️ Development

### Available Scripts

```bash
pnpm dev          # Start development server
pnpm dev:ws       # Start WebSocket server for NLP features
pnpm dev:full     # Start both dev server and WebSocket server
pnpm build        # Build for production
pnmp start        # Start production server
pnpm test         # Run test suite
pnpm lint         # Run ESLint
```

### Environment Variables

Create a `.env.local` file:

```env
# Flow Network Configuration
NEXT_PUBLIC_FLOW_NETWORK=testnet
NEXT_PUBLIC_FLOW_ACCESS_API=https://rest-testnet.onflow.org

# API Configuration (optional)
ACTIONLOOM_API_KEY=your_api_key_here
HUGGINGFACE_API_KEY=your_hf_key_here

# Database (optional, for saving workflows)
DATABASE_URL=your_database_url
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

See [DEVELOPER_GUIDE.md](./docs/DEVELOPER_GUIDE.md) for detailed contribution guidelines.

## 🔒 Security

- **Input Validation**: All parameters are validated before execution
- **Wallet Security**: Private keys never leave your browser
- **Code Auditing**: Generated Cadence code is validated for security
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse

## 📊 Roadmap

### Current (v1.0)
- ✅ Visual workflow builder
- ✅ 50+ pre-built actions
- ✅ Real-time code generation
- ✅ Parameter validation
- ✅ Flow blockchain integration

### Next (v1.1)
- 🔄 Advanced agent scheduling
- 🔄 Workflow templates marketplace
- 🔄 Multi-signature support
- 🔄 Advanced analytics dashboard

### Future (v2.0)
- 📋 Cross-chain support
- 📋 Custom action creation
- 📋 Team collaboration features
- 📋 Enterprise deployment options

## 🆘 Support

### Community
- **Discord**: [Join our community](https://discord.gg/actionloom)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/actionloom/actionloom/discussions)
- **Twitter**: [@ActionLoom](https://twitter.com/actionloom)

### Documentation
- **User Guide**: Step-by-step tutorials
- **API Reference**: Complete API documentation
- **Video Tutorials**: [YouTube Channel](https://youtube.com/@actionloom)

### Enterprise Support
- **Email**: enterprise@actionloom.com
- **Custom Integrations**: Available for enterprise customers
- **SLA Support**: 24/7 support with guaranteed response times

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Flow Foundation** - For the amazing Flow blockchain platform
- **Radix UI** - For the excellent component primitives
- **ReactFlow** - For the powerful visual workflow canvas
- **Vercel** - For seamless deployment and hosting

---

<div align="center">
  <strong>Ready to automate your blockchain workflows?</strong><br>
  <a href="https://actionloom.com">Get Started</a> • 
  <a href="./docs/USER_GUIDE.md">Documentation</a> • 
  <a href="https://discord.gg/actionloom">Community</a>
</div>