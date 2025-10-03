"use client"

import { useState } from "react"

interface Contract {
  id: string
  name: string
  address: string
  type: "deployed" | "template"
  description: string
}

const sampleContracts: Contract[] = [
  {
    id: "1",
    name: "FlowToken",
    address: "0x1654653399040a61",
    type: "deployed",
    description: "Native FLOW token contract",
  },
  {
    id: "2",
    name: "FungibleToken",
    address: "0xf233dcee88fe0abe",
    type: "deployed",
    description: "Fungible token standard",
  },
  {
    id: "3",
    name: "NFT Marketplace",
    address: "0x...",
    type: "template",
    description: "Deploy your own NFT marketplace",
  },
]

export function ContractsPanel() {
  const [contracts] = useState<Contract[]>(sampleContracts)
  const [searchQuery, setSearchQuery] = useState("")

  const filteredContracts = contracts.filter(
    (contract) =>
      contract.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contract.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border p-4">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search contracts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {filteredContracts.map((contract) => (
            <div
              key={contract.id}
              className="group cursor-pointer rounded-lg border border-border bg-background p-4 transition-all hover:border-primary hover:bg-primary/5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm">{contract.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        contract.type === "deployed" ? "bg-secondary/20 text-secondary" : "bg-primary/20 text-primary"
                      }`}
                    >
                      {contract.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground font-mono">{contract.address}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{contract.description}</p>
                </div>
                <button className="rounded-lg border border-border bg-card p-2 opacity-0 transition-all group-hover:opacity-100 hover:border-primary hover:bg-primary/10">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>

        <button className="mt-4 w-full rounded-lg border-2 border-dashed border-border bg-muted/30 py-8 text-sm font-medium text-muted-foreground transition-all hover:border-primary hover:bg-primary/5 hover:text-primary">
          <div className="flex flex-col items-center gap-2">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Deploy New Contract
          </div>
        </button>
      </div>
    </div>
  )
}
