import { ActionMetadata } from './types'
import { FORTE_CONSTANTS } from './flow-config'

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
  action: ActionMetadata
  score: number
  matchedFields: string[]
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'category'
}

/**
 * Search options for customizing search behavior
 */
export interface SearchOptions {
  limit?: number
  minScore?: number
  includeCategories?: string[]
  excludeCategories?: string[]
  fuzzyThreshold?: number
  boostExactMatches?: boolean
  boostRecentActions?: boolean
}

/**
 * Vector embedding interface for semantic search
 */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
  similarity(embedding1: number[], embedding2: number[]): number
}

/**
 * Simple mock embedding provider for development
 */
class MockEmbeddingProvider implements EmbeddingProvider {
  async embed(text: string): Promise<number[]> {
    // Simple hash-based embedding for testing
    const words = text.toLowerCase().split(/\s+/)
    const embedding = new Array(100).fill(0)
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word)
      embedding[hash % 100] += 1 / (index + 1)
    })
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0)
  }

  similarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0
    
    let dotProduct = 0
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
    }
    
    return Math.max(0, dotProduct) // Cosine similarity (already normalized)
  }

  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

/**
 * Semantic search engine for Action discovery with fuzzy matching and vector embeddings
 */
export class SemanticSearchEngine {
  private embeddingProvider: EmbeddingProvider
  private actionEmbeddings: Map<string, number[]> = new Map()
  private searchIndex: Map<string, Set<string>> = new Map()
  private lastIndexTime: number = 0

  constructor(embeddingProvider?: EmbeddingProvider) {
    this.embeddingProvider = embeddingProvider || new MockEmbeddingProvider()
  }

  /**
   * Index Actions for search with embeddings and keyword indexing
   */
  async indexActions(actions: ActionMetadata[]): Promise<void> {
    console.log(`Indexing ${actions.length} actions for search...`)
    const startTime = Date.now()

    // Clear existing indexes
    this.actionEmbeddings.clear()
    this.searchIndex.clear()

    // Process actions in batches to avoid overwhelming the embedding provider
    const batchSize = 10
    for (let i = 0; i < actions.length; i += batchSize) {
      const batch = actions.slice(i, i + batchSize)
      
      await Promise.all(batch.map(async (action) => {
        try {
          // Create searchable text
          const searchableText = this.createSearchableText(action)
          
          // Generate embedding
          const embedding = await this.embeddingProvider.embed(searchableText)
          this.actionEmbeddings.set(action.id, embedding)
          
          // Build keyword index
          this.indexKeywords(action, searchableText)
        } catch (error) {
          console.error(`Failed to index action ${action.id}:`, error)
        }
      }))
      
      // Small delay between batches
      if (i + batchSize < actions.length) {
        await this.delay(50)
      }
    }

    this.lastIndexTime = Date.now()
    const indexTime = Date.now() - startTime
    console.log(`Indexing completed in ${indexTime}ms. Indexed ${this.actionEmbeddings.size} actions.`)
  }

  /**
   * Search Actions with multiple strategies
   */
  async searchActions(
    query: string, 
    actions: ActionMetadata[], 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      limit = FORTE_CONSTANTS.MAX_SEARCH_RESULTS,
      minScore = 0.1,
      includeCategories,
      excludeCategories,
      fuzzyThreshold = 0.7,
      boostExactMatches = true,
      boostRecentActions = false
    } = options

    if (!query.trim()) {
      return []
    }

    // Ensure actions are indexed
    if (this.actionEmbeddings.size === 0 || this.shouldReindex(actions)) {
      await this.indexActions(actions)
    }

    const results: SearchResult[] = []
    const queryLower = query.toLowerCase()
    const queryEmbedding = await this.embeddingProvider.embed(query)

    for (const action of actions) {
      // Apply category filters
      if (includeCategories && !includeCategories.includes(action.category)) {
        continue
      }
      if (excludeCategories && excludeCategories.includes(action.category)) {
        continue
      }

      const searchResult = await this.scoreAction(
        action, 
        query, 
        queryLower, 
        queryEmbedding, 
        { fuzzyThreshold, boostExactMatches, boostRecentActions }
      )

      if (searchResult.score >= minScore) {
        results.push(searchResult)
      }
    }

    // Sort by score and apply limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(partialQuery: string, actions: ActionMetadata[], limit: number = 5): Promise<string[]> {
    if (partialQuery.length < 2) {
      return []
    }

    const suggestions = new Set<string>()
    const queryLower = partialQuery.toLowerCase()

    // Get suggestions from action names and categories
    for (const action of actions) {
      // Name suggestions
      if (action.name.toLowerCase().includes(queryLower)) {
        suggestions.add(action.name)
      }
      
      // Category suggestions
      if (action.category.toLowerCase().includes(queryLower)) {
        suggestions.add(action.category)
      }
      
      // Input/output name suggestions
      action.inputs.forEach(input => {
        if (input.name.toLowerCase().includes(queryLower)) {
          suggestions.add(input.name)
        }
      })
      
      action.outputs.forEach(output => {
        if (output.name.toLowerCase().includes(queryLower)) {
          suggestions.add(output.name)
        }
      })

      if (suggestions.size >= limit * 2) break // Get more than needed for filtering
    }

    // Score and filter suggestions
    const scoredSuggestions = Array.from(suggestions).map(suggestion => ({
      text: suggestion,
      score: this.scoreSuggestion(suggestion, partialQuery)
    }))

    return scoredSuggestions
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.text)
  }

  /**
   * Find similar Actions based on an existing Action
   */
  async findSimilarActions(
    targetAction: ActionMetadata, 
    actions: ActionMetadata[], 
    limit: number = 10
  ): Promise<SearchResult[]> {
    const targetEmbedding = this.actionEmbeddings.get(targetAction.id)
    if (!targetEmbedding) {
      // Generate embedding if not cached
      const searchableText = this.createSearchableText(targetAction)
      const embedding = await this.embeddingProvider.embed(searchableText)
      this.actionEmbeddings.set(targetAction.id, embedding)
      return this.findSimilarActions(targetAction, actions, limit)
    }

    const similarities: SearchResult[] = []

    for (const action of actions) {
      if (action.id === targetAction.id) continue // Skip self

      const actionEmbedding = this.actionEmbeddings.get(action.id)
      if (!actionEmbedding) continue

      const similarity = this.embeddingProvider.similarity(targetEmbedding, actionEmbedding)
      
      if (similarity > 0.1) { // Minimum similarity threshold
        similarities.push({
          action,
          score: similarity,
          matchedFields: ['semantic'],
          matchType: 'semantic'
        })
      }
    }

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Score an Action against a search query
   */
  private async scoreAction(
    action: ActionMetadata,
    originalQuery: string,
    queryLower: string,
    queryEmbedding: number[],
    options: { fuzzyThreshold: number, boostExactMatches: boolean, boostRecentActions: boolean }
  ): Promise<SearchResult> {
    let score = 0
    const matchedFields: string[] = []
    let matchType: SearchResult['matchType'] = 'fuzzy'

    // 1. Exact matches (highest priority)
    if (options.boostExactMatches) {
      if (action.name.toLowerCase() === queryLower) {
        score += 1000
        matchedFields.push('name')
        matchType = 'exact'
      }
      if (action.category.toLowerCase() === queryLower) {
        score += 500
        matchedFields.push('category')
        matchType = 'exact'
      }
    }

    // 2. Partial exact matches
    if (action.name.toLowerCase().includes(queryLower)) {
      score += 200
      matchedFields.push('name')
    }
    if (action.description.toLowerCase().includes(queryLower)) {
      score += 100
      matchedFields.push('description')
    }
    if (action.category.toLowerCase().includes(queryLower)) {
      score += 150
      matchedFields.push('category')
      matchType = 'category'
    }

    // 3. Input/Output matches
    action.inputs.forEach(input => {
      if (input.name.toLowerCase().includes(queryLower)) {
        score += 50
        matchedFields.push('inputs')
      }
    })
    action.outputs.forEach(output => {
      if (output.name.toLowerCase().includes(queryLower)) {
        score += 50
        matchedFields.push('outputs')
      }
    })

    // 4. Fuzzy matching
    const fuzzyScore = this.calculateFuzzyScore(action, queryLower, options.fuzzyThreshold)
    if (fuzzyScore > 0) {
      score += fuzzyScore
      if (matchType === 'fuzzy') {
        matchedFields.push('fuzzy')
      }
    }

    // 5. Semantic similarity using embeddings
    const actionEmbedding = this.actionEmbeddings.get(action.id)
    if (actionEmbedding) {
      const semanticScore = this.embeddingProvider.similarity(queryEmbedding, actionEmbedding)
      if (semanticScore > 0.3) { // Threshold for semantic relevance
        score += semanticScore * 300 // Scale semantic score
        matchedFields.push('semantic')
        if (matchType === 'fuzzy') {
          matchType = 'semantic'
        }
      }
    }

    // 6. Boost recent actions if requested
    if (options.boostRecentActions) {
      const actionAge = Date.now() - new Date(action.updatedAt).getTime()
      const daysSinceUpdate = actionAge / (1000 * 60 * 60 * 24)
      if (daysSinceUpdate < 30) { // Actions updated in last 30 days
        score += (30 - daysSinceUpdate) * 2
      }
    }

    // 7. Quality boost based on security level and gas estimate
    if (action.securityLevel === 'high') {
      score += 10
    }
    if (action.gasEstimate < 1000) { // Low gas actions get slight boost
      score += 5
    }

    return {
      action,
      score,
      matchedFields: [...new Set(matchedFields)], // Remove duplicates
      matchType
    }
  }

  /**
   * Calculate fuzzy matching score
   */
  private calculateFuzzyScore(action: ActionMetadata, queryLower: string, threshold: number): number {
    let maxScore = 0

    // Check fuzzy match against various fields
    const fields = [
      { text: action.name.toLowerCase(), weight: 3 },
      { text: action.description.toLowerCase(), weight: 1 },
      { text: action.category.toLowerCase(), weight: 2 }
    ]

    for (const field of fields) {
      const similarity = this.calculateStringSimilarity(queryLower, field.text)
      if (similarity >= threshold) {
        maxScore = Math.max(maxScore, similarity * field.weight * 50)
      }
    }

    return maxScore
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const matrix = []
    const len1 = str1.length
    const len2 = str2.length

    if (len1 === 0) return len2 === 0 ? 1 : 0
    if (len2 === 0) return 0

    // Initialize matrix
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j
    }

    // Fill matrix
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    const distance = matrix[len2][len1]
    const maxLen = Math.max(len1, len2)
    return 1 - (distance / maxLen)
  }

  /**
   * Score suggestion relevance
   */
  private scoreSuggestion(suggestion: string, partialQuery: string): number {
    const suggestionLower = suggestion.toLowerCase()
    const queryLower = partialQuery.toLowerCase()

    // Exact prefix match gets highest score
    if (suggestionLower.startsWith(queryLower)) {
      return 100
    }

    // Contains query gets medium score
    if (suggestionLower.includes(queryLower)) {
      return 50
    }

    // Fuzzy match gets lower score
    const similarity = this.calculateStringSimilarity(queryLower, suggestionLower)
    return similarity * 25
  }

  /**
   * Create searchable text from Action metadata
   */
  private createSearchableText(action: ActionMetadata): string {
    const parts = [
      action.name,
      action.description,
      action.category,
      action.author,
      ...action.inputs.map(input => `${input.name} ${input.type}`),
      ...action.outputs.map(output => `${output.name} ${output.type}`),
      ...action.parameters.map(param => `${param.name} ${param.type}`),
      ...action.compatibility.requiredCapabilities,
      ...action.compatibility.supportedNetworks
    ]

    return parts.filter(Boolean).join(' ')
  }

  /**
   * Index keywords for fast lookup
   */
  private indexKeywords(action: ActionMetadata, searchableText: string): void {
    const words = searchableText.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2) // Skip very short words

    words.forEach(word => {
      if (!this.searchIndex.has(word)) {
        this.searchIndex.set(word, new Set())
      }
      this.searchIndex.get(word)!.add(action.id)
    })
  }

  /**
   * Check if reindexing is needed
   */
  private shouldReindex(actions: ActionMetadata[]): boolean {
    // Reindex if we have different number of actions or it's been more than 1 hour
    const hoursSinceIndex = (Date.now() - this.lastIndexTime) / (1000 * 60 * 60)
    return this.actionEmbeddings.size !== actions.length || hoursSinceIndex > 1
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get search engine statistics
   */
  getStats(): {
    indexedActions: number
    keywordEntries: number
    lastIndexTime: string | null
  } {
    return {
      indexedActions: this.actionEmbeddings.size,
      keywordEntries: this.searchIndex.size,
      lastIndexTime: this.lastIndexTime > 0 ? new Date(this.lastIndexTime).toISOString() : null
    }
  }

  /**
   * Clear search indexes
   */
  clearIndex(): void {
    this.actionEmbeddings.clear()
    this.searchIndex.clear()
    this.lastIndexTime = 0
    console.log('Search indexes cleared')
  }
}

/**
 * Default semantic search engine instance
 */
export const defaultSearchEngine = new SemanticSearchEngine()

/**
 * Create a semantic search engine with custom embedding provider
 */
export function createSemanticSearchEngine(embeddingProvider?: EmbeddingProvider): SemanticSearchEngine {
  return new SemanticSearchEngine(embeddingProvider)
}