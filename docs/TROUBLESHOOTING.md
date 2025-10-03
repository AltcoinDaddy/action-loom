# ActionLoom Troubleshooting Guide

This guide helps you diagnose and resolve common issues with ActionLoom.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Development Server Issues](#development-server-issues)
4. [Workflow Building Issues](#workflow-building-issues)
5. [Parameter Validation Issues](#parameter-validation-issues)
6. [Code Generation Issues](#code-generation-issues)
7. [Execution Issues](#execution-issues)
8. [WebSocket/NLP Issues](#websocketnlp-issues)
9. [Performance Issues](#performance-issues)
10. [Database Issues](#database-issues)
11. [Deployment Issues](#deployment-issues)
12. [Browser Compatibility](#browser-compatibility)
13. [Flow Blockchain Issues](#flow-blockchain-issues)
14. [Getting Help](#getting-help)

## Quick Diagnostics

### Health Check Commands

Run these commands to quickly identify issues:

```bash
# Check Node.js version
node --version  # Should be 18+

# Check pnpm version
pnpm --version  # Should be latest

# Check if ports are available
netstat -tulpn | grep :3000  # Next.js
netstat -tulpn | grep :8080  # WebSocket

# Test environment variables
node -e "console.log('NODE_ENV:', process.env.NODE_ENV)"

# Check TypeScript compilation
npx tsc --noEmit

# Run health check (if server is running)
curl -f http://localhost:3000/api/health
```

### System Requirements Check

```bash
# Check system resources
free -h          # Memory usage
df -h           # Disk space
top             # CPU usage

# Check network connectivity
ping google.com
curl -I https://rest-testnet.onflow.org

# Check browser compatibility
# Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
```

## Installation Issues

### Node.js Version Issues

**Problem**: "Node.js version not supported"
```bash
# Check current version
node --version

# Install Node.js 18+ using nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
nvm alias default 18
```

**Problem**: "pnpm command not found"
```bash
# Install pnpm globally
npm install -g pnpm

# Or using corepack (Node.js 16.10+)
corepack enable
corepack prepare pnpm@latest --activate
```

### Dependency Installation Issues

**Problem**: "EACCES: permission denied"
```bash
# Fix npm permissions (macOS/Linux)
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules

# Or use nvm to avoid permission issues
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
```

**Problem**: "Package not found" or version conflicts
```bash
# Clear package manager cache
pnpm store prune
rm -rf node_modules
rm pnpm-lock.yaml

# Reinstall dependencies
pnpm install

# Force resolution of conflicting packages
pnpm install --force
```

**Problem**: "Peer dependency warnings"
```bash
# Install peer dependencies manually
pnpm install react@19 react-dom@19 typescript@5

# Or ignore peer dependency warnings
pnpm install --ignore-peer-deps
```

### Git Clone Issues

**Problem**: "Repository not found" or access denied
```bash
# Check SSH key setup
ssh -T git@github.com

# Use HTTPS instead of SSH
git clone https://github.com/your-org/actionloom.git

# Check repository permissions
# Ensure you have read access to the repository
```

## Development Server Issues

### Port Already in Use

**Problem**: "Port 3000 is already in use"
```bash
# Find process using port 3000
lsof -ti:3000
netstat -tulpn | grep :3000

# Kill process using port
kill -9 $(lsof -ti:3000)

# Or use different port
PORT=3001 pnpm dev
```

**Problem**: "WebSocket port 8080 in use"
```bash
# Find and kill WebSocket process
lsof -ti:8080
kill -9 $(lsof -ti:8080)

# Use different WebSocket port
WEBSOCKET_PORT=8081 pnpm run dev:ws
```

### Environment Variable Issues

**Problem**: "Environment variables not loaded"
```bash
# Check if .env.local exists
ls -la .env*

# Verify environment variables
node -e "console.log(process.env.NEXT_PUBLIC_FLOW_NETWORK)"

# Create .env.local from example
cp .env.example .env.local
# Edit .env.local with your values
```

**Problem**: "Invalid Flow network configuration"
```bash
# Verify Flow network setting
echo $NEXT_PUBLIC_FLOW_NETWORK  # Should be 'testnet' or 'mainnet'

# Test Flow API connectivity
curl -I https://rest-testnet.onflow.org
curl -I https://rest-mainnet.onflow.org
```

### Build Issues

**Problem**: "TypeScript compilation errors"
```bash
# Check TypeScript configuration
cat tsconfig.json

# Run type checking
npx tsc --noEmit

# Common fixes:
# 1. Update @types packages
pnpm add -D @types/node@latest @types/react@latest

# 2. Clear Next.js cache
rm -rf .next

# 3. Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P -> "TypeScript: Restart TS Server"
```

**Problem**: "Module not found" errors
```bash
# Check import paths
# Use absolute imports with @/ prefix
import { Component } from '@/components/component'

# Verify tsconfig.json paths configuration
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}

# Clear module cache
rm -rf node_modules/.cache
rm -rf .next
pnpm install
```

## Workflow Building Issues

### Canvas Not Loading

**Problem**: "Workflow canvas is blank or not responding"

**Diagnosis**:
```bash
# Check browser console for errors
# Open DevTools (F12) -> Console tab

# Check if ReactFlow is loaded
# In browser console:
window.ReactFlow !== undefined
```

**Solutions**:
```bash
# 1. Clear browser cache
# Ctrl+Shift+R (hard refresh)

# 2. Check ReactFlow version compatibility
pnpm list @xyflow/react

# 3. Reinstall ReactFlow
pnpm remove @xyflow/react
pnpm add @xyflow/react@latest

# 4. Check for CSS conflicts
# Ensure no global CSS is overriding ReactFlow styles
```

### Drag and Drop Not Working

**Problem**: "Cannot drag actions from library to canvas"

**Diagnosis**:
```javascript
// Check in browser console
document.addEventListener('dragstart', (e) => {
  console.log('Drag started:', e.target)
})

document.addEventListener('drop', (e) => {
  console.log('Drop event:', e.target)
})
```

**Solutions**:
1. **Check browser compatibility**: Ensure HTML5 drag and drop is supported
2. **Disable browser extensions**: Some extensions block drag and drop
3. **Check event handlers**: Verify drag event listeners are attached
4. **Clear browser data**: Reset browser to default state

### Actions Not Connecting

**Problem**: "Cannot connect action nodes with edges"

**Diagnosis**:
```javascript
// Check ReactFlow connection handlers
// In browser DevTools -> Elements -> Event Listeners
// Look for onConnect handlers on ReactFlow component
```

**Solutions**:
```typescript
// Verify onConnect handler is properly set
<ReactFlow
  nodes={nodes}
  edges={edges}
  onConnect={onConnect}  // This should be defined
  // ...
>
```

## Parameter Validation Issues

### Validation Errors Not Showing

**Problem**: "Parameter validation errors not displayed"

**Diagnosis**:
```bash
# Check validation service
node -e "
const { ParameterValidator } = require('./lib/parameter-validator');
const validator = new ParameterValidator();
console.log('Validator loaded:', !!validator);
"
```

**Solutions**:
1. **Check validation state**: Ensure validation errors are in component state
2. **Verify error display**: Check if error UI components are rendered
3. **Debug validation logic**: Add console.logs to validation functions

### False Validation Errors

**Problem**: "Valid parameters showing as invalid"

**Common Causes**:
- **Type mismatches**: String vs Number validation
- **Format issues**: Address format, decimal places
- **Async validation**: Validation running before data is loaded

**Solutions**:
```typescript
// Debug parameter validation
const debugValidation = (parameter: ActionParameter, value: any) => {
  console.log('Validating:', { parameter: parameter.name, value, type: typeof value })
  
  // Check parameter requirements
  console.log('Required:', parameter.required)
  console.log('Type expected:', parameter.type)
  console.log('Validation rules:', parameter.validation)
}
```

### Address Validation Issues

**Problem**: "Valid Flow addresses rejected"

**Flow Address Format**:
- Must start with `0x`
- Followed by exactly 16 hexadecimal characters
- Example: `0x1234567890abcdef`

**Common Issues**:
```typescript
// Incorrect formats
"1234567890abcdef"     // Missing 0x prefix
"0x1234567890abcde"    // Too short (15 chars)
"0x1234567890abcdefg"  // Too long (17 chars)
"0x1234567890ABCDEF"   // Uppercase (should work but check validation)

// Correct format
"0x1234567890abcdef"   // Exactly 16 hex chars after 0x
```

**Fix Address Validation**:
```typescript
const isValidFlowAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{16}$/.test(address)
}
```

## Code Generation Issues

### No Code Generated

**Problem**: "Code preview panel is empty"

**Diagnosis**:
```bash
# Check workflow parsing
node -e "
const { WorkflowParser } = require('./lib/workflow-parser');
const workflow = { nodes: [], edges: [] };
const parsed = WorkflowParser.parse(workflow.nodes, workflow.edges);
console.log('Parsed workflow:', parsed);
"
```

**Solutions**:
1. **Add actions to workflow**: Code is only generated when actions are present
2. **Check workflow structure**: Ensure nodes and edges are properly formatted
3. **Verify parser logic**: Check WorkflowParser.parse() function

### Invalid Cadence Code

**Problem**: "Generated Cadence code has syntax errors"

**Diagnosis**:
```bash
# Test Cadence syntax (if Flow CLI is installed)
flow cadence parse --code "transaction() { prepare(signer: AuthAccount) {} }"

# Check code generation templates
cat lib/cadence-templates/*.cdc
```

**Solutions**:
1. **Update Cadence templates**: Ensure templates match current Cadence syntax
2. **Check parameter injection**: Verify parameters are properly escaped
3. **Test with Flow CLI**: Validate generated code with Flow tools

### Missing Imports

**Problem**: "Generated code missing required imports"

**Common Missing Imports**:
```cadence
import FungibleToken from 0xf233dcee88fe0abe
import FlowToken from 0x1654653399040a61
import NonFungibleToken from 0x1d7e57aa55817448
```

**Solutions**:
```typescript
// Ensure import generation includes all required contracts
const generateImports = (actions: ParsedAction[]): string[] => {
  const imports = new Set<string>()
  
  actions.forEach(action => {
    // Add required imports based on action type
    if (action.actionType.includes('token')) {
      imports.add('import FungibleToken from 0xf233dcee88fe0abe')
      imports.add('import FlowToken from 0x1654653399040a61')
    }
    // Add other imports as needed
  })
  
  return Array.from(imports)
}
```

## Execution Issues

### Wallet Connection Issues

**Problem**: "Cannot connect Flow wallet"

**Supported Wallets**:
- Blocto (Web/Mobile)
- Lilico (Browser Extension)
- Dapper (Gaming)
- Flow Wallet (Official)

**Diagnosis**:
```javascript
// Check FCL configuration in browser console
console.log('FCL Config:', window.fcl?.config())

// Check wallet discovery
window.fcl?.discovery?.authn?.subscribe(console.log)
```

**Solutions**:
1. **Install wallet extension**: Ensure wallet is installed and enabled
2. **Check network**: Verify wallet is on correct network (testnet/mainnet)
3. **Clear wallet cache**: Reset wallet connection state
4. **Try different wallet**: Test with alternative wallet

### Transaction Failures

**Problem**: "Transaction fails during execution"

**Common Error Messages**:

#### "Insufficient Balance"
```bash
# Check account balance
flow accounts get 0xYourAddress --network testnet

# Get testnet FLOW tokens
# Visit: https://testnet-faucet.onflow.org/
```

#### "Gas Limit Exceeded"
```typescript
// Increase gas limit in transaction
const transaction = `
transaction(amount: UFix64, to: Address) {
  prepare(signer: AuthAccount) {
    // Your transaction logic
  }
}
`

// Execute with higher gas limit
fcl.mutate({
  cadence: transaction,
  args: [...],
  limit: 1000  // Increase from default
})
```

#### "Authorization Failed"
```typescript
// Check account authorization
fcl.currentUser().subscribe(user => {
  console.log('Current user:', user)
  if (!user.loggedIn) {
    console.log('User not logged in')
  }
})
```

### Network Issues

**Problem**: "Cannot connect to Flow network"

**Diagnosis**:
```bash
# Test Flow API endpoints
curl -I https://rest-testnet.onflow.org
curl -I https://rest-mainnet.onflow.org

# Check network status
curl https://rest-testnet.onflow.org/v1/network/parameters
```

**Solutions**:
1. **Check network configuration**: Verify FLOW_NETWORK environment variable
2. **Try different endpoint**: Use alternative Flow Access API endpoint
3. **Check firewall**: Ensure network access is not blocked
4. **Wait for network**: Flow network might be experiencing issues

## WebSocket/NLP Issues

### WebSocket Connection Failed

**Problem**: "Cannot connect to WebSocket server for NLP features"

**Diagnosis**:
```bash
# Check if WebSocket server is running
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: test" \
  -H "Sec-WebSocket-Version: 13" \
  http://localhost:8080/

# Check WebSocket server logs
pnpm run dev:ws
```

**Solutions**:
1. **Start WebSocket server**: Run `pnpm run dev:ws`
2. **Check port availability**: Ensure port 8080 is not in use
3. **Verify WebSocket URL**: Check NEXT_PUBLIC_WEBSOCKET_URL environment variable
4. **Check firewall**: Ensure WebSocket port is not blocked

### NLP Not Working

**Problem**: "Natural language processing not responding"

**Diagnosis**:
```javascript
// Check WebSocket connection in browser console
const ws = new WebSocket('ws://localhost:8080')
ws.onopen = () => console.log('WebSocket connected')
ws.onerror = (error) => console.log('WebSocket error:', error)
```

**Solutions**:
1. **Check API keys**: Verify HUGGINGFACE_API_KEY is set
2. **Test NLP service**: Send test message to WebSocket server
3. **Check rate limits**: Ensure API rate limits are not exceeded
4. **Fallback to manual**: Use visual workflow builder instead

### Entity Highlighting Issues

**Problem**: "Text entities not highlighted in NLP input"

**Solutions**:
1. **Check CSS styles**: Ensure entity highlight styles are loaded
2. **Verify entity detection**: Check if entities are detected in WebSocket response
3. **Browser compatibility**: Test in different browser
4. **Clear cache**: Hard refresh browser cache

## Performance Issues

### Slow Loading

**Problem**: "Application loads slowly"

**Diagnosis**:
```bash
# Check bundle size
pnpm run build
pnpm run analyze  # If bundle analyzer is configured

# Check network requests in DevTools
# Network tab -> Reload page -> Check large requests
```

**Solutions**:
1. **Enable compression**: Ensure gzip/brotli compression is enabled
2. **Optimize images**: Use WebP format and proper sizing
3. **Code splitting**: Implement dynamic imports for large components
4. **CDN usage**: Serve static assets from CDN

### High Memory Usage

**Problem**: "Browser tab uses excessive memory"

**Diagnosis**:
```javascript
// Check memory usage in browser console
console.log('Memory:', performance.memory)

// Monitor memory over time
setInterval(() => {
  console.log('Memory:', performance.memory.usedJSHeapSize)
}, 5000)
```

**Solutions**:
1. **Check memory leaks**: Use Chrome DevTools Memory tab
2. **Cleanup event listeners**: Ensure proper cleanup in useEffect
3. **Optimize state**: Avoid storing large objects in React state
4. **Limit workflow size**: Restrict number of actions in workflow

### Slow Workflow Execution

**Problem**: "Workflow execution takes too long"

**Causes**:
- Complex workflow with many actions
- Network congestion
- Inefficient Cadence code

**Solutions**:
1. **Simplify workflow**: Break complex workflows into smaller parts
2. **Optimize Cadence**: Review generated code for efficiency
3. **Batch operations**: Combine multiple operations when possible
4. **Increase gas limit**: Allow more computation time

## Database Issues

### Connection Errors

**Problem**: "Cannot connect to database"

**Diagnosis**:
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
echo $DATABASE_URL
# Should be: postgresql://user:password@host:port/database
```

**Solutions**:
1. **Verify credentials**: Check username, password, host, port
2. **Check database exists**: Ensure database is created
3. **Network access**: Verify database server is accessible
4. **Connection limits**: Check if connection pool is exhausted

### Migration Issues

**Problem**: "Database migrations fail"

**Diagnosis**:
```bash
# Check migration status
pnpm run db:status

# View migration files
ls -la migrations/

# Check database schema
psql $DATABASE_URL -c "\dt"
```

**Solutions**:
1. **Run migrations manually**: Execute SQL files directly
2. **Check permissions**: Ensure database user has required permissions
3. **Rollback and retry**: Rollback failed migration and retry
4. **Fresh database**: Drop and recreate database if needed

## Deployment Issues

### Build Failures

**Problem**: "Production build fails"

**Common Causes**:
- TypeScript errors
- Missing environment variables
- Dependency issues
- Memory limits

**Solutions**:
```bash
# Local build test
pnpm run build

# Check build logs
pnpm run build 2>&1 | tee build.log

# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" pnpm run build
```

### Environment Variable Issues

**Problem**: "Environment variables not available in production"

**Vercel**:
```bash
# Set environment variables
vercel env add NEXT_PUBLIC_FLOW_NETWORK production
vercel env add DATABASE_URL production

# List environment variables
vercel env ls
```

**Other Platforms**:
- Ensure environment variables are set in deployment platform
- Check variable names match exactly (case-sensitive)
- Verify NEXT_PUBLIC_ prefix for client-side variables

### SSL Certificate Issues

**Problem**: "SSL certificate errors"

**Solutions**:
1. **Check certificate validity**: Use SSL checker tools
2. **Verify domain configuration**: Ensure DNS points to correct server
3. **Renew certificate**: Update expired certificates
4. **Check certificate chain**: Ensure full certificate chain is installed

## Browser Compatibility

### Supported Browsers

- **Chrome**: 90+
- **Firefox**: 88+
- **Safari**: 14+
- **Edge**: 90+

### Common Issues

#### "Drag and Drop Not Working"
- **IE/Old Edge**: Not supported, upgrade browser
- **Mobile browsers**: Limited drag and drop support

#### "WebSocket Connection Failed"
- **Corporate firewalls**: May block WebSocket connections
- **Proxy servers**: May not support WebSocket upgrade

#### "Wallet Connection Issues"
- **Browser extensions**: May conflict with wallet extensions
- **Private browsing**: Some wallets don't work in private mode

### Feature Detection

```javascript
// Check browser capabilities
const checkBrowserSupport = () => {
  const support = {
    dragAndDrop: 'draggable' in document.createElement('div'),
    webSocket: 'WebSocket' in window,
    localStorage: 'localStorage' in window,
    es6: (() => { try { eval('const x = 1'); return true } catch { return false } })()
  }
  
  console.log('Browser support:', support)
  return support
}
```

## Flow Blockchain Issues

### Network Status

**Check Flow Network Status**:
- **Testnet**: https://status.onflow.org/
- **Mainnet**: https://status.onflow.org/

### Common Flow Issues

#### "Account Not Found"
```bash
# Check if account exists
flow accounts get 0xYourAddress --network testnet

# Create account if needed (testnet)
# Use Flow Faucet: https://testnet-faucet.onflow.org/
```

#### "Contract Not Found"
```bash
# Check contract deployment
flow accounts get 0xContractAddress --network testnet

# Verify contract name and address
# Check Flow documentation for correct addresses
```

#### "Transaction Sealed but Failed"
```bash
# Get transaction details
flow transactions get TransactionID --network testnet

# Check transaction events and error messages
# Review Cadence code for logic errors
```

### Flow CLI Debugging

```bash
# Install Flow CLI
sh -ci "$(curl -fsSL https://storage.googleapis.com/flow-cli/install.sh)"

# Test Cadence code
flow cadence parse --code "$(cat your-transaction.cdc)"

# Execute transaction locally
flow transactions send your-transaction.cdc --network testnet
```

## Getting Help

### Self-Service Resources

1. **Documentation**:
   - [User Guide](./USER_GUIDE.md)
   - [Developer Guide](./DEVELOPER_GUIDE.md)
   - [API Documentation](./README.md)

2. **Debugging Tools**:
   - Browser DevTools (F12)
   - React Developer Tools
   - Flow CLI
   - Network monitoring tools

3. **Log Files**:
   ```bash
   # Application logs
   tail -f logs/combined.log
   
   # Next.js logs
   pnpm dev 2>&1 | tee nextjs.log
   
   # WebSocket logs
   pnpm run dev:ws 2>&1 | tee websocket.log
   ```

### Community Support

1. **Discord Community**: [Join our Discord](https://discord.gg/actionloom)
   - Real-time chat with users and developers
   - Share screenshots and code snippets
   - Get quick answers to common questions

2. **GitHub Discussions**: [GitHub Discussions](https://github.com/actionloom/actionloom/discussions)
   - Detailed technical discussions
   - Feature requests and feedback
   - Community-driven solutions

3. **Stack Overflow**: Tag questions with `actionloom`
   - Detailed technical questions
   - Code examples and solutions
   - Community voting on best answers

### Direct Support

1. **GitHub Issues**: [Report Bugs](https://github.com/actionloom/actionloom/issues)
   - Bug reports with reproduction steps
   - Feature requests
   - Security vulnerability reports

2. **Email Support**: support@actionloom.com
   - Complex technical issues
   - Account-related problems
   - Enterprise support requests

### When Reporting Issues

Include the following information:

1. **Environment Details**:
   ```bash
   # System information
   node --version
   pnpm --version
   npm list @xyflow/react
   
   # Browser information
   # Include browser name and version
   
   # Operating system
   uname -a  # Linux/macOS
   # Or Windows version
   ```

2. **Error Messages**:
   - Full error message and stack trace
   - Browser console errors
   - Server logs if applicable

3. **Reproduction Steps**:
   - Step-by-step instructions to reproduce
   - Expected vs actual behavior
   - Screenshots or screen recordings

4. **Configuration**:
   - Environment variables (redact sensitive values)
   - Relevant configuration files
   - Network setup if applicable

### Emergency Contacts

For critical production issues:

- **Enterprise Support**: enterprise@actionloom.com
- **Security Issues**: security@actionloom.com
- **Discord**: @ActionLoomSupport

---

## Quick Reference

### Common Commands

```bash
# Restart everything
pnpm run dev:full

# Clear all caches
rm -rf .next node_modules/.cache
pnpm install

# Check health
curl -f http://localhost:3000/api/health

# View logs
tail -f logs/combined.log

# Test database
psql $DATABASE_URL -c "SELECT 1"
```

### Emergency Recovery

```bash
# Nuclear option - reset everything
git stash
git checkout main
git pull origin main
rm -rf node_modules .next
pnpm install
pnpm run dev:full
```

Remember: When in doubt, check the logs, restart the services, and don't hesitate to ask for help! 🚀