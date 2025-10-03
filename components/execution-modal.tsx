"use client"

import type { ExecutionResult } from "@/lib/types"

interface ExecutionModalProps {
  isExecuting: boolean
  result: ExecutionResult | null
  onClose: () => void
}

export function ExecutionModal({ isExecuting, result, onClose }: ExecutionModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Workflow Execution</h2>
          {!isExecuting && (
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {isExecuting ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-border border-t-primary" />
            <p className="text-sm text-muted-foreground">Executing workflow on Flow blockchain...</p>
          </div>
        ) : result ? (
          <div className="space-y-4">
            {result.success ? (
              <>
                <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-green-500">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">Execution Successful</span>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-background p-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <span className="font-mono">{result.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium capitalize">{result.status}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Execution Time:</span>
                    <span>{result.executionTime}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gas Used:</span>
                    <span>{result.gasUsed}</span>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Close
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-destructive">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="font-medium">Execution Failed</span>
                </div>

                <div className="rounded-md border border-border bg-background p-4 text-sm">
                  <p className="mb-2 font-medium">Error:</p>
                  <p className="text-muted-foreground">{result.error}</p>
                  {result.details && result.details.length > 0 && (
                    <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
                      {result.details.map((detail, i) => (
                        <li key={i}>{detail}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  onClick={onClose}
                  className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
                >
                  Close
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
