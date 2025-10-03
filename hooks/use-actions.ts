import { useState, useEffect, useCallback } from 'react'
import { ActionMetadata, DiscoveryResult } from '@/lib/types'

interface UseActionsOptions {
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseActionsReturn {
  actions: ActionMetadata[]
  categories: string[]
  loading: boolean
  error: string | null
  searchActions: (query: string) => Promise<ActionMetadata[]>
  getActionsByCategory: (category: string) => ActionMetadata[]
  refreshActions: () => Promise<void>
  getActionById: (id: string) => ActionMetadata | undefined
}

export function useActions(options: UseActionsOptions = {}): UseActionsReturn {
  const { autoRefresh = true, refreshInterval = 30000 } = options
  
  const [actions, setActions] = useState<ActionMetadata[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchActions = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)
      setError(null)
      
      const params = new URLSearchParams()
      if (forceRefresh) {
        params.set('refresh', 'true')
      }
      
      const response = await fetch(`/api/actions?${params}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch actions')
      }
      
      setActions(data.actions || [])
      
      // Extract unique categories
      const uniqueCategories = Array.from(
        new Set(data.actions?.map((action: ActionMetadata) => action.category) || [])
      ).sort()
      setCategories(uniqueCategories)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(errorMessage)
      console.error('Failed to fetch actions:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const searchActions = useCallback(async (query: string): Promise<ActionMetadata[]> => {
    if (!query.trim()) {
      return actions
    }
    
    try {
      const response = await fetch(`/api/actions?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.error || 'Search failed')
      }
      
      return data.actions || []
    } catch (err) {
      console.error('Search failed:', err)
      // Fallback to client-side filtering
      return actions.filter(action => 
        action.name.toLowerCase().includes(query.toLowerCase()) ||
        action.description.toLowerCase().includes(query.toLowerCase()) ||
        action.category.toLowerCase().includes(query.toLowerCase())
      )
    }
  }, [actions])

  const getActionsByCategory = useCallback((category: string): ActionMetadata[] => {
    return actions.filter(action => 
      action.category.toLowerCase() === category.toLowerCase()
    )
  }, [actions])

  const refreshActions = useCallback(() => fetchActions(true), [fetchActions])

  const getActionById = useCallback((id: string): ActionMetadata | undefined => {
    return actions.find(action => action.id === id)
  }, [actions])

  // Initial load
  useEffect(() => {
    fetchActions()
  }, [fetchActions])

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      fetchActions()
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, fetchActions])

  return {
    actions,
    categories,
    loading,
    error,
    searchActions,
    getActionsByCategory,
    refreshActions,
    getActionById
  }
}