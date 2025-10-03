"use client"

import { ActionLibrary } from "@/components/action-library"

export default function ActionLibraryDemo() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Action Library Demo</h1>
          <p className="text-muted-foreground">
            This demo shows the updated Action Library component with dynamic action discovery,
            real-time search, and enhanced metadata display.
          </p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Action Library */}
          <div className="border border-border rounded-lg bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="text-xl font-semibold">Dynamic Action Library</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Actions are now discovered dynamically from Flow blockchain with enhanced metadata
              </p>
            </div>
            <div className="h-[600px]">
              <ActionLibrary />
            </div>
          </div>
          
          {/* Features */}
          <div className="space-y-6">
            <div className="border border-border rounded-lg bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">New Features</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium">Dynamic Action Discovery</h4>
                    <p className="text-sm text-muted-foreground">
                      Actions are automatically discovered from Flow's on-chain registries
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium">Real-time Search</h4>
                    <p className="text-sm text-muted-foreground">
                      Search actions by name, description, or category with debounced API calls
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium">Enhanced Metadata</h4>
                    <p className="text-sm text-muted-foreground">
                      Display gas estimates, security levels, version info, and compatibility warnings
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium">Compatibility Information</h4>
                    <p className="text-sm text-muted-foreground">
                      Shows required capabilities and conflicts with other actions
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <div>
                    <h4 className="font-medium">Auto-refresh</h4>
                    <p className="text-sm text-muted-foreground">
                      Actions are automatically refreshed to stay up-to-date with blockchain changes
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border border-border rounded-lg bg-card p-6">
              <h3 className="text-lg font-semibold mb-4">Technical Implementation</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Hook:</span> <code className="bg-muted px-1 rounded">useActions</code> - Manages action state and API calls
                </div>
                <div>
                  <span className="font-medium">API:</span> <code className="bg-muted px-1 rounded">/api/actions</code> - Provides search and discovery endpoints
                </div>
                <div>
                  <span className="font-medium">Service:</span> <code className="bg-muted px-1 rounded">ActionDiscoveryService</code> - Handles blockchain integration
                </div>
                <div>
                  <span className="font-medium">Cache:</span> Redis-based caching with TTL and background refresh
                </div>
                <div>
                  <span className="font-medium">Search:</span> Semantic search with fuzzy matching and vector embeddings
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}