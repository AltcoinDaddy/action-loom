import { FlowIntegrationProvider } from '@/lib/flow-integration-provider'
import { FlowIntegrationDemo } from '@/components/flow-integration-demo'

export default function FlowDemoPage() {
  return (
    <FlowIntegrationProvider defaultNetwork="testnet">
      <div className="container mx-auto py-8">
        <FlowIntegrationDemo />
      </div>
    </FlowIntegrationProvider>
  )
}