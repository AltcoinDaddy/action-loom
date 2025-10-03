import { NLPDemo } from "@/components/nlp-demo"

export default function NLPDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Real-time NLP Feedback Demo</h1>
          <p className="text-muted-foreground">
            Experience live natural language processing with entity highlighting and suggestions
          </p>
        </div>
        
        <NLPDemo />
        
        <div className="mt-8 p-4 bg-card border border-border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">How it works</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Type natural language descriptions of blockchain workflows</li>
            <li>• See real-time entity detection with color-coded highlighting</li>
            <li>• Get contextual suggestions as you type</li>
            <li>• View validation feedback for input completeness</li>
            <li>• Experience live parsing results with confidence scores</li>
          </ul>
        </div>
        
        <div className="mt-4 p-4 bg-card border border-border rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Try these examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-muted rounded">
              <code>Swap 100 USDC to FLOW</code>
            </div>
            <div className="p-2 bg-muted rounded">
              <code>Stake 50 FLOW for rewards</code>
            </div>
            <div className="p-2 bg-muted rounded">
              <code>Transfer 25 FLOW to 0x1234567890abcdef</code>
            </div>
            <div className="p-2 bg-muted rounded">
              <code>Mint NFT from collection</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}