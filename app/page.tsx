import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Blocks,
  Code2,
  Zap,
  Workflow,
  Sparkles,
  GitBranch,
  Lightbulb,
  Users,
  Bot,
  FileCode,
} from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-background dark">
      {/* Navigation */}
      <nav className="border-b border-border/50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-purple flex items-center justify-center">
              <Workflow className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">ActionLoom</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              How it Works
            </Link>
            <Link href="/builder">
              <Button size="sm" className="bg-white text-black hover:bg-white/90">
                Start Building
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-24 pb-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Visual Blockchain Automation</span>
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-6 text-balance leading-tight">
            Build blockchain workflows{" "}
            <span className="bg-gradient-purple bg-clip-text text-transparent">visually</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto text-pretty leading-relaxed">
            Create powerful Flow blockchain automations without writing code. Drag, connect, and deploy smart contract
            workflows in minutes.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/builder">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 text-base px-8">
                Start Building
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="text-base px-8 bg-transparent">
              View Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-t border-border/50">
        <div className="container mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">50+</div>
              <div className="text-sm text-muted-foreground">Pre-built Actions</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">Zero</div>
              <div className="text-sm text-muted-foreground">Code Required</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">Instant</div>
              <div className="text-sm text-muted-foreground">Cadence Generation</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-foreground mb-2">AI</div>
              <div className="text-sm text-muted-foreground">Agent Compatible</div>
            </div>
          </div>
        </div>
      </section>

      {/* Why ActionLoom Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span className="text-sm text-primary font-medium">The Inspiration</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">Why ActionLoom?</h2>
          </div>

          <div className="space-y-8 text-lg text-muted-foreground leading-relaxed">
            <p>
              Blockchain development is powerful but complex. Writing smart contracts requires deep technical knowledge,
              understanding of Cadence syntax, and careful attention to security. This creates a barrier for many who
              want to leverage blockchain technology.
            </p>

            <p>
              <span className="text-foreground font-semibold">ActionLoom was born from a simple idea:</span> What if
              anyone could compose blockchain operations as easily as connecting building blocks? Inspired by visual
              workflow tools like Zapier and Node-RED, we created a platform specifically for the Flow blockchain.
            </p>

            <div className="grid md:grid-cols-3 gap-6 my-12">
              <div className="p-6 rounded-xl bg-card border border-border/50">
                <Users className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-foreground font-bold mb-2">For Everyone</h3>
                <p className="text-sm text-muted-foreground">
                  Developers prototype faster. Non-technical users build without code. Everyone benefits.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border/50">
                <Bot className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-foreground font-bold mb-2">AI-First Design</h3>
                <p className="text-sm text-muted-foreground">
                  Built for the age of AI agents that need to compose blockchain transactions programmatically.
                </p>
              </div>

              <div className="p-6 rounded-xl bg-card border border-border/50">
                <FileCode className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-foreground font-bold mb-2">Learn by Doing</h3>
                <p className="text-sm text-muted-foreground">
                  See generated Cadence code in real-time. Understand how blockchain operations work.
                </p>
              </div>
            </div>

            <p>
              Whether you're a developer looking to prototype faster, a business user wanting to automate blockchain
              operations, or an AI agent composing transactions, ActionLoom makes it possible.{" "}
              <span className="text-foreground font-semibold">No wallet required to start building</span> — explore,
              learn, and create workflows freely. Connect your wallet only when you're ready to execute on-chain.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="border-t border-border/50">
        <div className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Everything you need to automate</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Powerful features designed for developers, AI agents, and non-technical users alike.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Blocks className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Visual Workflow Builder</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Drag and drop blockchain actions to create complex workflows. No coding experience required.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Intuitive canvas with zoom and pan controls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Connect actions with visual flow lines</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Undo/redo support for easy editing</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Code2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Auto-Generate Cadence</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Instantly convert your visual workflows into production-ready Cadence smart contract code.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Real-time code generation as you build</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Syntax-highlighted code preview</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Copy or download generated code</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">One-Click Execution</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Deploy and execute your workflows on Flow blockchain with a single click. Fast and reliable.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Connect Flow wallet when ready to execute</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Testnet and mainnet support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Transaction status tracking</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <GitBranch className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Composable Actions</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Mix and match pre-built actions or create custom ones. Build exactly what you need.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>50+ pre-built blockchain actions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Token transfers, NFT minting, contract calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Custom action support coming soon</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">AI Agent Ready</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Perfect for AI agents to compose and execute blockchain operations programmatically.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>RESTful API for workflow creation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Natural language workflow parsing</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Webhook support for automation</span>
                </li>
              </ul>
            </div>

            <div className="p-8 rounded-xl bg-card border border-border/50 hover:border-primary/50 transition-colors">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-6">
                <Workflow className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-3">Workflow Management</h3>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Save, organize, and reuse your workflows. Build a library of blockchain automations.
              </p>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Save workflows to your account</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Template library with common patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Share workflows with your team</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="border-t border-border/50">
        <div className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">How it works</h2>
            <p className="text-lg text-muted-foreground">From idea to execution in five simple steps</p>
          </div>

          <div className="max-w-4xl mx-auto space-y-12">
            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center text-xl font-bold text-white">
                1
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground mb-3">Choose Your Actions</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Browse our library of 50+ pre-built blockchain actions. From token transfers to NFT minting, smart
                  contract deployment to DeFi operations — find the building blocks you need.
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">Transfer Tokens</span>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">Mint NFT</span>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">Deploy Contract</span>
                  <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">Swap Tokens</span>
                </div>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center text-xl font-bold text-white">
                2
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground mb-3">Build Your Workflow</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Drag actions onto the canvas and connect them in sequence. Create simple linear flows or complex
                  branching logic. The visual interface makes it easy to see exactly what your workflow will do.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center text-xl font-bold text-white">
                3
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground mb-3">Configure Parameters</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Set the details for each action — amounts, addresses, token IDs, and more. The interface guides you
                  through required fields and validates your inputs.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center text-xl font-bold text-white">
                4
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground mb-3">Preview Generated Code</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Watch as ActionLoom automatically generates Cadence code in real-time. See exactly what will execute
                  on-chain. Copy the code to use elsewhere or continue to execution.
                </p>
                <div className="p-4 rounded-lg bg-card border border-border/50 font-mono text-sm text-muted-foreground">
                  <div className="text-primary">transaction(amount: UFix64, to: Address) {"{"}</div>
                  <div className="ml-4">prepare(signer: AuthAccount) {"{"}</div>
                  <div className="ml-8">// Generated Cadence code...</div>
                  <div className="ml-4">{"}"}</div>
                  <div>{"}"}</div>
                </div>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-purple flex items-center justify-center text-xl font-bold text-white">
                5
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-foreground mb-3">Connect Wallet & Execute</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  <span className="text-foreground font-semibold">No wallet needed until this step!</span> When you're
                  ready to execute your workflow on-chain, connect your Flow wallet (Blocto, Lilico, or Dapper). Review
                  the transaction details and execute with one click.
                </p>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-foreground">
                    💡 <span className="font-semibold">Pro tip:</span> You can build and experiment with workflows
                    completely free without connecting a wallet. Perfect for learning and prototyping!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-border/50">
        <div className="container mx-auto px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6 text-balance">
              Ready to build your first workflow?
            </h2>
            <p className="text-lg text-muted-foreground mb-10">
              Start creating blockchain automations in minutes. No credit card required.
            </p>
            <Link href="/builder">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 text-base px-8">
                Start Building Now
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-purple flex items-center justify-center">
                <Workflow className="w-4 h-4 text-white" />
              </div>
              <span className="text-sm text-muted-foreground">ActionLoom</span>
            </div>
            <p className="text-sm text-muted-foreground">Built for the Flow blockchain ecosystem</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
