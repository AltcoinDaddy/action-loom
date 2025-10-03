import { Entity, WorkflowIntent } from './types'
import { TOKEN_ALIASES, ADDRESS_PATTERNS, AMOUNT_PATTERNS } from './nlp-config'

/**
 * Utility functions for NLP processing
 */

/**
 * Normalize token names using aliases
 */
export function normalizeTokenName(token: string): string {
  const upperToken = token.toUpperCase()
  
  for (const [canonical, aliases] of Object.entries(TOKEN_ALIASES)) {
    if (aliases.includes(token.toLowerCase()) || canonical === upperToken) {
      return canonical
    }
  }
  
  return upperToken
}

/**
 * Validate and normalize addresses
 */
export function validateAddress(address: string): { isValid: boolean; type?: string; normalized?: string } {
  for (const [type, pattern] of Object.entries(ADDRESS_PATTERNS)) {
    if (pattern.test(address)) {
      return {
        isValid: true,
        type,
        normalized: address.toLowerCase()
      }
    }
  }
  
  return { isValid: false }
}

/**
 * Parse and normalize amounts
 */
export function parseAmount(amountStr: string): { value: number; isValid: boolean; original: string } {
  const cleaned = amountStr.replace(/,/g, '') // Remove commas
  
  // Check different amount patterns
  for (const pattern of Object.values(AMOUNT_PATTERNS)) {
    if (pattern.test(cleaned)) {
      const value = parseFloat(cleaned)
      if (!isNaN(value) && value >= 0) {
        return {
          value,
          isValid: true,
          original: amountStr
        }
      }
    }
  }
  
  return {
    value: 0,
    isValid: false,
    original: amountStr
  }
}

/**
 * Extract numeric values from text
 */
export function extractNumbers(text: string): Array<{ value: number; position: [number, number]; text: string }> {
  const numbers: Array<{ value: number; position: [number, number]; text: string }> = []
  const numberRegex = /\b\d+(?:\.\d+)?\b/g
  
  let match
  while ((match = numberRegex.exec(text)) !== null) {
    const value = parseFloat(match[0])
    if (!isNaN(value)) {
      numbers.push({
        value,
        position: [match.index, match.index + match[0].length],
        text: match[0]
      })
    }
  }
  
  return numbers
}

/**
 * Find potential token mentions in text
 */
export function findTokenMentions(text: string): Array<{ token: string; position: [number, number]; confidence: number }> {
  const mentions: Array<{ token: string; position: [number, number]; confidence: number }> = []
  
  // Look for known token aliases
  for (const [canonical, aliases] of Object.entries(TOKEN_ALIASES)) {
    // Check canonical name
    const canonicalRegex = new RegExp(`\\b${canonical}\\b`, 'gi')
    let match
    while ((match = canonicalRegex.exec(text)) !== null) {
      mentions.push({
        token: canonical,
        position: [match.index, match.index + match[0].length],
        confidence: 0.95
      })
    }
    
    // Check aliases
    aliases.forEach(alias => {
      const aliasRegex = new RegExp(`\\b${alias}\\b`, 'gi')
      let aliasMatch
      while ((aliasMatch = aliasRegex.exec(text)) !== null) {
        mentions.push({
          token: canonical,
          position: [aliasMatch.index, aliasMatch.index + aliasMatch[0].length],
          confidence: 0.8
        })
      }
    })
  }
  
  // Look for potential new tokens (3-5 character uppercase sequences)
  const tokenRegex = /\b[A-Z]{3,5}\b/g
  let tokenMatch
  while ((tokenMatch = tokenRegex.exec(text)) !== null) {
    // Skip if already found as a known token
    const isKnown = mentions.some(m => 
      m.position[0] <= tokenMatch!.index && 
      m.position[1] >= tokenMatch!.index + tokenMatch![0].length
    )
    
    if (!isKnown) {
      mentions.push({
        token: tokenMatch[0],
        position: [tokenMatch.index, tokenMatch.index + tokenMatch[0].length],
        confidence: 0.6
      })
    }
  }
  
  return mentions
}

/**
 * Calculate text similarity using simple Jaccard similarity
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))
  
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])
  
  return intersection.size / union.size
}

/**
 * Extract context around a position in text
 */
export function extractContext(text: string, position: [number, number], contextSize: number = 20): string {
  const start = Math.max(0, position[0] - contextSize)
  const end = Math.min(text.length, position[1] + contextSize)
  
  return text.slice(start, end).trim()
}

/**
 * Merge overlapping entities
 */
export function mergeOverlappingEntities(entities: Entity[]): Entity[] {
  if (entities.length <= 1) return entities
  
  // Sort entities by position
  const sorted = [...entities].sort((a, b) => a.position[0] - b.position[0])
  const merged: Entity[] = []
  
  let current = sorted[0]
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    
    // Check if entities overlap
    if (current.position[1] >= next.position[0]) {
      // Merge entities - keep the one with higher confidence
      if (next.confidence > current.confidence) {
        current = {
          ...next,
          position: [current.position[0], Math.max(current.position[1], next.position[1])]
        }
      } else {
        current = {
          ...current,
          position: [current.position[0], Math.max(current.position[1], next.position[1])]
        }
      }
    } else {
      merged.push(current)
      current = next
    }
  }
  
  merged.push(current)
  return merged
}

/**
 * Score intent match based on keywords and patterns
 */
export function scoreIntentMatch(text: string, intent: WorkflowIntent, keywords: string[], patterns: RegExp[]): number {
  let score = 0
  const lowerText = text.toLowerCase()
  
  // Keyword matching (40% of score)
  const keywordMatches = keywords.filter(keyword => lowerText.includes(keyword)).length
  const keywordScore = (keywordMatches / keywords.length) * 0.4
  
  // Pattern matching (60% of score)
  const patternMatches = patterns.filter(pattern => pattern.test(text)).length
  const patternScore = patternMatches > 0 ? 0.6 : 0
  
  return keywordScore + patternScore
}

/**
 * Clean and normalize text for processing
 */
export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except basic punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}

/**
 * Split text into sentences
 */
export function splitIntoSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 0)
}

/**
 * Check if a word is a stop word
 */
export function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
    'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
    'to', 'was', 'will', 'with', 'i', 'me', 'my', 'we', 'our', 'you',
    'your', 'they', 'them', 'their', 'this', 'these', 'those'
  ])
  
  return stopWords.has(word.toLowerCase())
}

/**
 * Remove stop words from text
 */
export function removeStopWords(words: string[]): string[] {
  return words.filter(word => !isStopWord(word))
}

/**
 * Generate n-grams from text
 */
export function generateNGrams(words: string[], n: number): string[] {
  if (words.length < n) return []
  
  const ngrams: string[] = []
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(' '))
  }
  
  return ngrams
}

/**
 * Calculate confidence score based on multiple factors
 */
export function calculateConfidence(factors: {
  patternMatch?: number
  keywordMatch?: number
  entityCount?: number
  ambiguityCount?: number
  textLength?: number
}): number {
  const {
    patternMatch = 0,
    keywordMatch = 0,
    entityCount = 0,
    ambiguityCount = 0,
    textLength = 0
  } = factors
  
  let confidence = 0
  
  // Pattern matching contributes 40%
  confidence += patternMatch * 0.4
  
  // Keyword matching contributes 30%
  confidence += keywordMatch * 0.3
  
  // Entity extraction contributes 20%
  confidence += Math.min(entityCount / 3, 1) * 0.2
  
  // Text length contributes 10% (longer text generally more reliable)
  confidence += Math.min(textLength / 50, 1) * 0.1
  
  // Penalize for ambiguities
  confidence -= Math.min(ambiguityCount * 0.1, 0.3)
  
  return Math.max(0, Math.min(1, confidence))
}