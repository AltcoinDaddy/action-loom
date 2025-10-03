import { HfInference } from '@huggingface/inference'
import { WordTokenizer } from 'natural'
import nlp from 'compromise'
import {
  NLPResult,
  ParsedStep,
  Entity,
  Ambiguity,
  IntentClassification,
  WorkflowIntent,
  NLPConfig,
  TextPreprocessingResult
} from './types'

/**
 * NLP Service for processing natural language workflow descriptions
 * Integrates with Hugging Face transformers for advanced NLP capabilities
 */
export class NLPService {
  private hf: HfInference | null = null
  private tokenizer: WordTokenizer
  private config: NLPConfig

  constructor(config: Partial<NLPConfig> = {}) {
    this.config = {
      timeout: 10000,
      maxTokens: 512,
      temperature: 0.3,
      confidenceThreshold: 0.7,
      ...config
    }

    // Initialize Hugging Face client if API key is provided
    if (this.config.apiKey) {
      this.hf = new HfInference(this.config.apiKey)
    }

    // Initialize Natural Language Processing tools
    this.tokenizer = new WordTokenizer()
  }

  /**
   * Main entry point for processing natural language workflow descriptions
   */
  async parseWorkflow(input: string): Promise<NLPResult> {
    const startTime = Date.now()
    
    try {
      // Step 1: Preprocess the input text
      const preprocessed = await this.preprocessText(input)
      
      // Step 2: Extract entities and basic structure
      const actionEntities = await this.extractEntities(preprocessed.cleanedText)
      const entities = [...preprocessed.entities, ...actionEntities]
      
      // Step 3: Classify intent (will be implemented in task 3.2)
      const intent = await this.classifyIntent(preprocessed.cleanedText, entities)
      
      // Step 4: Parse into workflow steps (will be enhanced in task 3.3)
      const steps = await this.parseSteps(preprocessed.cleanedText, entities, intent)
      
      // Step 5: Detect ambiguities and generate suggestions
      const ambiguities = this.detectAmbiguities(input, entities, steps)
      const suggestions = this.generateSuggestions(input, ambiguities)
      
      const processingTime = Date.now() - startTime
      
      return {
        confidence: this.calculateOverallConfidence(steps, ambiguities),
        steps,
        ambiguities,
        suggestions,
        processingTime
      }
    } catch (error) {
      throw new NLPError(
        'Failed to parse workflow',
        'PARSING_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Preprocess text for better NLP analysis
   */
  async preprocessText(text: string): Promise<TextPreprocessingResult> {
    try {
      // Clean and normalize the text
      const cleanedText = text
        .toLowerCase()
        .replace(/[!]+/g, '') // Remove exclamation marks
        .replace(/[^\w\s.,?-]/g, '') // Remove special characters except basic punctuation
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim()

      // Tokenize the text
      const tokens = this.tokenizer.tokenize(cleanedText) || []

      // Extract basic entities using compromise.js and regex patterns
      const entities: Entity[] = []

      // Extract numbers (potential amounts)
      const numberPattern = /\b\d+(?:\.\d+)?\b/g
      let numberMatch
      while ((numberMatch = numberPattern.exec(cleanedText)) !== null) {
        entities.push({
          type: 'amount',
          value: numberMatch[0],
          confidence: 0.9,
          position: [numberMatch.index, numberMatch.index + numberMatch[0].length],
          metadata: { 
            normalized: parseFloat(numberMatch[0]),
            original: numberMatch[0]
          }
        })
      }

      // Extract potential token names (3-5 uppercase letters)
      const tokenPattern = /\b[A-Z]{3,5}\b/g
      let tokenMatch
      while ((tokenMatch = tokenPattern.exec(text)) !== null) { // Use original text to preserve case
        entities.push({
          type: 'token',
          value: tokenMatch[0],
          confidence: 0.8,
          position: [tokenMatch.index, tokenMatch.index + tokenMatch[0].length],
          metadata: { 
            original: tokenMatch[0],
            normalized: tokenMatch[0].toUpperCase()
          }
        })
      }

      // Extract potential addresses (hex-like strings)
      const addressPattern = /0x[a-fA-F0-9]{16,}/g
      let addressMatch
      while ((addressMatch = addressPattern.exec(text)) !== null) { // Use original text to preserve case
        entities.push({
          type: 'address',
          value: addressMatch[0],
          confidence: 0.95,
          position: [addressMatch.index, addressMatch.index + addressMatch[0].length],
          metadata: {
            format: 'hex',
            length: addressMatch[0].length
          }
        })
      }

      return {
        originalText: text,
        cleanedText,
        tokens,
        entities,
        metadata: {
          wordCount: tokens.length,
          characterCount: cleanedText.length,
          language: 'en' // Could be enhanced with language detection
        }
      }
    } catch (error) {
      throw new NLPError(
        'Text preprocessing failed',
        'PREPROCESSING_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Enhanced entity extraction with improved confidence scoring and ambiguity detection
   */
  async extractEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = []

    try {
      // 1. Extract action entities with context analysis
      const actionEntities = await this.extractActionEntities(text)
      entities.push(...actionEntities)

      // 2. Extract financial entities (amounts, tokens, addresses)
      const financialEntities = await this.extractFinancialEntities(text)
      entities.push(...financialEntities)

      // 3. Extract parameter entities
      const parameterEntities = await this.extractParameterEntities(text)
      entities.push(...parameterEntities)

      // 4. Use Hugging Face for advanced NER if available
      if (this.hf) {
        try {
          const hfEntities = await this.extractHuggingFaceEntities(text)
          entities.push(...hfEntities)
        } catch (hfError) {
          console.warn('Hugging Face entity extraction failed, falling back to basic extraction:', hfError)
        }
      }

      // 5. Post-process entities: merge overlapping, resolve conflicts, calculate final confidence
      const processedEntities = this.postProcessEntities(entities, text)

      return processedEntities
    } catch (error) {
      throw new NLPError(
        'Entity extraction failed',
        'ENTITY_EXTRACTION_ERROR',
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * Extract action entities with context analysis
   */
  private async extractActionEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = []
    const doc = nlp(text)

    // Enhanced action verb patterns with context
    const actionPatterns = {
      swap: {
        patterns: [/\bswap\b/gi, /\bexchange\b/gi, /\btrade\b/gi, /\bconvert\b/gi],
        contextBoost: ['to', 'for', 'into', 'from'],
        confidence: 0.95
      },
      stake: {
        patterns: [/\bstake\b/gi, /\bdelegate\b/gi, /\block\b/gi],
        contextBoost: ['validator', 'pool', 'rewards'],
        confidence: 0.9
      },
      unstake: {
        patterns: [/\bunstake\b/gi, /\bundelegate\b/gi, /\bunlock\b/gi, /\bwithdraw\b/gi],
        contextBoost: ['rewards', 'earnings', 'claim'],
        confidence: 0.9
      },
      mint: {
        patterns: [/\bmint\b/gi, /\bcreate\b/gi, /\bgenerate\b/gi],
        contextBoost: ['nft', 'token', 'collection'],
        confidence: 0.85
      },
      transfer: {
        patterns: [/\btransfer\b/gi, /\bsend\b/gi, /\bmove\b/gi, /\bpay\b/gi],
        contextBoost: ['to', 'recipient', 'address'],
        confidence: 0.9
      },
      bridge: {
        patterns: [/\bbridge\b/gi, /\bcross-chain\b/gi],
        contextBoost: ['chain', 'network', 'ethereum'],
        confidence: 0.85
      },
      lend: {
        patterns: [/\blend\b/gi, /\bsupply\b/gi, /\bprovide\b/gi],
        contextBoost: ['liquidity', 'pool', 'interest'],
        confidence: 0.8
      },
      borrow: {
        patterns: [/\bborrow\b/gi, /\bloan\b/gi],
        contextBoost: ['collateral', 'interest', 'repay'],
        confidence: 0.8
      },
      compound: {
        patterns: [/\bcompound\b/gi, /\breinvest\b/gi, /\bauto-compound\b/gi],
        contextBoost: ['rewards', 'automatic', 'recurring'],
        confidence: 0.8
      }
    }

    for (const [action, config] of Object.entries(actionPatterns)) {
      for (const pattern of config.patterns) {
        let match
        while ((match = pattern.exec(text)) !== null) {
          let confidence = config.confidence

          // Boost confidence if context words are present
          const contextWords = config.contextBoost.filter(word => 
            text.toLowerCase().includes(word.toLowerCase())
          )
          confidence += contextWords.length * 0.02 // Small boost per context word

          // Reduce confidence if the word appears in a different context
          const wordContext = text.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20)
          if (this.isNegativeContext(wordContext, action)) {
            confidence -= 0.2
          }

          entities.push({
            type: 'action',
            value: action,
            confidence: Math.min(confidence, 1),
            position: [match.index, match.index + match[0].length],
            metadata: {
              verb: true,
              intent: action,
              contextWords,
              originalMatch: match[0],
              contextSnippet: wordContext
            }
          })
        }
      }
    }

    return entities
  }

  /**
   * Extract financial entities (amounts, tokens, addresses)
   */
  private async extractFinancialEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = []

    // Enhanced amount extraction with various formats
    const amountPatterns = [
      /\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/g, // 1,000.50
      /\b(\d+\.?\d*)\s*(?:k|thousand)\b/gi,   // 100k, 50 thousand
      /\b(\d+\.?\d*)\s*(?:m|million)\b/gi,    // 1.5m, 2 million
      /\b(\d+\.?\d*)\s*(?:b|billion)\b/gi     // 1b, 1.2 billion
    ]

    amountPatterns.forEach((pattern, patternIndex) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        let value = match[1]
        let normalizedValue = parseFloat(value.replace(/,/g, ''))

        // Handle k, m, b suffixes
        if (patternIndex === 1) normalizedValue *= 1000
        else if (patternIndex === 2) normalizedValue *= 1000000
        else if (patternIndex === 3) normalizedValue *= 1000000000

        const confidence = this.calculateAmountConfidence(match[0], text, match.index)

        entities.push({
          type: 'amount',
          value: match[0], // Use the full match to preserve formatting
          confidence,
          position: [match.index, match.index + match[0].length],
          metadata: {
            normalized: normalizedValue,
            original: match[0],
            format: this.detectAmountFormat(match[0]),
            extractedValue: value
          }
        })
      }
    })

    // Enhanced token extraction with known tokens and patterns
    const tokenPatterns = [
      /\b(FLOW|USDC|USDT|FUSD|BTC|ETH|WETH|DAI|LINK|UNI)\b/g, // Known tokens
      /\b([A-Z]{3,5})\b/g, // Generic 3-5 letter uppercase tokens
      /\$([A-Z]{3,5})\b/g  // Tokens with $ prefix
    ]

    tokenPatterns.forEach((pattern, patternIndex) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const token = match[1]
        const confidence = this.calculateTokenConfidence(token, patternIndex, text, match.index)

        entities.push({
          type: 'token',
          value: token,
          confidence,
          position: [match.index, match.index + match[0].length],
          metadata: {
            original: match[0],
            isKnownToken: patternIndex === 0,
            hasPrefix: patternIndex === 2
          }
        })
      }
    })

    // Enhanced address extraction
    const addressPatterns = [
      /\b(0x[a-fA-F0-9]{40})\b/g,  // Ethereum-style addresses
      /\b(0x[a-fA-F0-9]{16})\b/g,  // Flow addresses
      /\b([13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g // Bitcoin addresses
    ]

    addressPatterns.forEach((pattern, patternIndex) => {
      let match
      while ((match = pattern.exec(text)) !== null) {
        const address = match[1]
        const confidence = this.calculateAddressConfidence(address, patternIndex)

        entities.push({
          type: 'address',
          value: address,
          confidence,
          position: [match.index, match.index + match[0].length],
          metadata: {
            format: patternIndex === 0 ? 'ethereum' : patternIndex === 1 ? 'flow' : 'bitcoin',
            length: address.length
          }
        })
      }
    })

    return entities
  }

  /**
   * Extract parameter entities (general parameters and values)
   */
  private async extractParameterEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = []

    // Extract common DeFi parameters - use more flexible patterns
    const parameterPatterns = {
      slippage: [
        /\b(\d+\.?\d*)\s*%\s*slippage\b/gi,
        /\bslippage\s*(?:of\s*)?(\d+\.?\d*)\s*%?\b/gi,
        /\bwith\s+(\d+\.?\d*)\s*%\s*slippage\b/gi
      ],
      deadline: [
        /\b(\d+)\s*(?:minutes?|mins?|hours?|hrs?)\s*deadline\b/gi,
        /\bdeadline\s*(?:of\s*)?(\d+)\s*(?:minutes?|mins?|hours?|hrs?)\b/gi,
        /\band\s+(\d+)\s*(?:minutes?|mins?|hours?|hrs?)\s*deadline\b/gi
      ],
      gasLimit: [
        /\b(\d+)\s*gas\s*limit\b/gi,
        /\bgas\s*limit\s*(?:of\s*)?(\d+)\b/gi
      ],
      gasPrice: [
        /\b(\d+\.?\d*)\s*gwei\b/gi,
        /\bgas\s*price\s*(?:of\s*)?(\d+\.?\d*)\s*gwei\b/gi
      ],
      poolFee: [
        /\b(\d+\.?\d*)\s*%?\s*(?:fee|commission)\b/gi,
        /\b(?:fee|commission)\s*(?:of\s*)?(\d+\.?\d*)\s*%?\b/gi
      ]
    }

    for (const [paramType, patterns] of Object.entries(parameterPatterns)) {
      for (const pattern of patterns) {
        let match
        while ((match = pattern.exec(text)) !== null) {
          entities.push({
            type: 'parameter',
            value: match[1],
            confidence: 0.8,
            position: [match.index, match.index + match[0].length],
            metadata: {
              parameterType: paramType,
              original: match[0],
              unit: this.extractUnit(match[0])
            }
          })
        }
      }
    }

    return entities
  }

  /**
   * Extract entities using Hugging Face NER
   */
  private async extractHuggingFaceEntities(text: string): Promise<Entity[]> {
    const entities: Entity[] = []

    if (!this.hf) return entities

    try {
      const nerResult = await this.hf.tokenClassification({
        model: 'dbmdz/bert-large-cased-finetuned-conll03-english',
        inputs: text,
        parameters: {
          aggregation_strategy: 'simple'
        }
      })

      if (Array.isArray(nerResult)) {
        nerResult.forEach(result => {
          if (result.score > this.config.confidenceThreshold * 0.8) { // Slightly lower threshold for HF
            const entityType = this.mapHFEntityType(String(result.entity_group || result.label))
            
            entities.push({
              type: entityType,
              value: String(result.word),
              confidence: Number(result.score),
              position: [Number(result.start || 0), Number(result.end || String(result.word).length)],
              metadata: {
                source: 'huggingface',
                model: 'bert-large-cased-finetuned-conll03-english',
                originalLabel: String(result.entity_group || result.label)
              }
            })
          }
        })
      }
    } catch (error) {
      console.warn('Hugging Face NER failed:', error)
    }

    return entities
  }

  /**
   * Post-process entities to resolve conflicts and improve accuracy
   */
  private postProcessEntities(entities: Entity[], text: string): Entity[] {
    // 1. Remove duplicates and merge overlapping entities
    let processed = this.mergeOverlappingEntities(entities)

    // 2. Resolve type conflicts (e.g., if same text is detected as both token and parameter)
    processed = this.resolveEntityConflicts(processed)

    // 3. Validate entities against context
    processed = this.validateEntitiesInContext(processed, text)

    // 4. Calculate final confidence scores
    processed = processed.map(entity => ({
      ...entity,
      confidence: this.calculateFinalConfidence(entity, processed, text)
    }))

    // 5. Filter out low-confidence entities
    processed = processed.filter(entity => entity.confidence >= this.config.confidenceThreshold * 0.5)

    return processed
  }

  /**
   * Enhanced intent classification with pattern matching and confidence scoring
   */
  private async classifyIntent(text: string, entities: Entity[]): Promise<IntentClassification> {
    const intentScores: Record<WorkflowIntent, number> = {
      [WorkflowIntent.SWAP]: 0,
      [WorkflowIntent.STAKE]: 0,
      [WorkflowIntent.UNSTAKE]: 0,
      [WorkflowIntent.MINT]: 0,
      [WorkflowIntent.TRANSFER]: 0,
      [WorkflowIntent.BRIDGE]: 0,
      [WorkflowIntent.LEND]: 0,
      [WorkflowIntent.BORROW]: 0,
      [WorkflowIntent.COMPOUND]: 0,
      [WorkflowIntent.CUSTOM]: 0
    }

    // Enhanced intent patterns with regex and context
    const intentPatterns = {
      [WorkflowIntent.SWAP]: {
        keywords: ['swap', 'exchange', 'trade', 'convert', 'change'],
        patterns: [
          /swap\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i,
          /exchange\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i,
          /trade\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|for|into)\s+(\w+)/i,
          /convert\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|into)\s+(\w+)/i
        ],
        contextWords: ['from', 'to', 'into', 'for', 'pair', 'market'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.STAKE]: {
        keywords: ['stake', 'delegate', 'lock', 'deposit'],
        patterns: [
          /stake\s+(\d+\.?\d*)\s+(\w+)/i,
          /delegate\s+(\d+\.?\d*)\s+(\w+)/i,
          /lock\s+(\d+\.?\d*)\s+(\w+)/i
        ],
        contextWords: ['validator', 'pool', 'rewards', 'earn', 'yield'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.UNSTAKE]: {
        keywords: ['unstake', 'undelegate', 'unlock', 'withdraw', 'claim'],
        patterns: [
          /unstake\s+(\d+\.?\d*)\s+(\w+)/i,
          /withdraw\s+(\d+\.?\d*)\s+(\w+)/i,
          /claim\s+(\d+\.?\d*)\s+(\w+)/i
        ],
        contextWords: ['rewards', 'earnings', 'unbond', 'cooldown'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.MINT]: {
        keywords: ['mint', 'create', 'generate', 'issue'],
        patterns: [
          /mint\s+(\d+\.?\d*)\s+(\w+)/i,
          /create\s+(\d+\.?\d*)\s+(\w+)/i,
          /mint\s+(?:an?\s+)?(\w+)/i
        ],
        contextWords: ['nft', 'token', 'collection', 'artwork', 'metadata'],
        requiredEntities: ['token']
      },
      [WorkflowIntent.TRANSFER]: {
        keywords: ['transfer', 'send', 'move', 'pay'],
        patterns: [
          /(?:transfer|send)\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]+)/i,
          /pay\s+(\d+\.?\d*)\s+(\w+)\s+to\s+(0x[a-fA-F0-9]+)/i,
          /send\s+(\d+\.?\d*)\s+(\w+)/i
        ],
        contextWords: ['recipient', 'wallet', 'address', 'payment'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.BRIDGE]: {
        keywords: ['bridge', 'cross-chain', 'move between', 'transfer across'],
        patterns: [
          /bridge\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|from)\s+(\w+)/i,
          /move\s+(\d+\.?\d*)\s+(\w+)\s+(?:to|from)\s+(\w+)/i
        ],
        contextWords: ['chain', 'network', 'ethereum', 'polygon', 'bsc'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.LEND]: {
        keywords: ['lend', 'supply', 'provide', 'deposit'],
        patterns: [
          /(?:lend|supply)\s+(\d+\.?\d*)\s+(\w+)/i,
          /provide\s+(\d+\.?\d*)\s+(\w+)/i
        ],
        contextWords: ['liquidity', 'pool', 'interest', 'apy', 'yield'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.BORROW]: {
        keywords: ['borrow', 'loan', 'take'],
        patterns: [
          /borrow\s+(\d+\.?\d*)\s+(\w+)/i,
          /take\s+(?:a\s+)?loan\s+(?:of\s+)?(\d+\.?\d*)\s+(\w+)/i
        ],
        contextWords: ['collateral', 'interest', 'repay', 'liquidation'],
        requiredEntities: ['amount', 'token']
      },
      [WorkflowIntent.COMPOUND]: {
        keywords: ['compound', 'reinvest', 'auto-compound', 'auto-stake'],
        patterns: [
          /compound\s+(\w+)/i,
          /reinvest\s+(\w+)/i,
          /auto-compound/i
        ],
        contextWords: ['rewards', 'earnings', 'automatic', 'recurring'],
        requiredEntities: ['token']
      }
    }

    // Score each intent based on multiple factors
    for (const [intent, config] of Object.entries(intentPatterns)) {
      let score = 0
      const intentKey = intent as WorkflowIntent

      // 1. Keyword matching (30% weight)
      const keywordMatches = config.keywords.filter(keyword => 
        text.toLowerCase().includes(keyword.toLowerCase())
      ).length
      const keywordScore = (keywordMatches / config.keywords.length) * 0.3

      // 2. Pattern matching (40% weight)
      const patternMatches = config.patterns.filter(pattern => 
        pattern.test(text)
      ).length
      const patternScore = patternMatches > 0 ? 0.4 : 0

      // 3. Context word presence (20% weight)
      const contextMatches = config.contextWords.filter(word => 
        text.toLowerCase().includes(word.toLowerCase())
      ).length
      const contextScore = Math.min(contextMatches / config.contextWords.length, 1) * 0.2

      // 4. Required entity presence (10% weight)
      const requiredEntityTypes = new Set(config.requiredEntities)
      const presentEntityTypes = new Set(entities.map(e => e.type))
      const entityMatches = [...requiredEntityTypes].filter(type => 
        presentEntityTypes.has(type as Entity['type'])
      ).length
      const entityScore = (entityMatches / requiredEntityTypes.size) * 0.1

      score = keywordScore + patternScore + contextScore + entityScore
      intentScores[intentKey] = score
    }

    // Find the best intent
    let bestIntent = WorkflowIntent.CUSTOM
    let bestScore = 0

    for (const [intent, score] of Object.entries(intentScores)) {
      if (score > bestScore && score > this.config.confidenceThreshold * 0.5) {
        bestScore = score
        bestIntent = intent as WorkflowIntent
      }
    }

    // If no clear intent found, try to infer from action entities
    if (bestIntent === WorkflowIntent.CUSTOM) {
      const actionEntities = entities.filter(e => e.type === 'action')
      if (actionEntities.length > 0) {
        const actionValue = actionEntities[0].value.toLowerCase()
        for (const [intent, config] of Object.entries(intentPatterns)) {
          if (config.keywords.includes(actionValue)) {
            bestIntent = intent as WorkflowIntent
            bestScore = actionEntities[0].confidence * 0.8 // Slightly lower confidence
            break
          }
        }
      }
    }

    return {
      intent: bestIntent,
      confidence: bestScore,
      entities,
      parameters: this.extractParameters(text, entities),
      metadata: {
        allScores: intentScores,
        detectedPatterns: this.getMatchedPatterns(text, intentPatterns),
        ambiguityScore: this.calculateIntentAmbiguity(intentScores)
      }
    }
  }

  /**
   * Parse workflow steps from text using Action mapping and parameter validation
   */
  private async parseSteps(text: string, entities: Entity[], intent: IntentClassification): Promise<ParsedStep[]> {
    const steps: ParsedStep[] = []

    try {
      // Import Action mapping service dynamically to avoid circular dependencies
      const { ActionMappingService } = await import('./action-mapping-service')
      const mappingService = new ActionMappingService()

      // Map intent to discovered Actions
      const actionMappings = await mappingService.mapIntentToActions(intent, entities, 3)

      if (actionMappings.length > 0) {
        // Use the best matching Action
        const bestMatch = actionMappings[0]
        const action = bestMatch.action

        // Extract parameters from entities and text
        const extractedParams = this.extractParametersForAction(text, null, entities)
        
        // Add suggested parameter mappings
        Object.assign(extractedParams, bestMatch.parameterMapping)

        // Validate parameters against Action schema
        const validation = await mappingService.validateActionParameters(action, extractedParams)

        steps.push({
          actionId: action.id,
          actionName: action.name,
          parameters: validation.isValid ? validation.validatedParams : extractedParams,
          confidence: bestMatch.confidence,
          position: 0,
          metadata: {
            originalAction: action,
            matchScore: bestMatch.matchScore,
            matchReasons: bestMatch.reasons,
            validationResult: validation,
            alternativeActions: actionMappings.slice(1).map(m => ({
              action: m.action,
              score: m.matchScore,
              reasons: m.reasons
            }))
          }
        })
      } else {
        // Fallback to basic step parsing if no Actions found
        const actionEntities = entities.filter(e => e.type === 'action')
        
        if (actionEntities.length === 0) {
          // If no explicit actions found, infer from intent
          if (intent.intent !== WorkflowIntent.CUSTOM) {
            steps.push({
              actionId: `${intent.intent}_action`,
              actionName: intent.intent,
              parameters: intent.parameters,
              confidence: intent.confidence,
              position: 0,
              metadata: {
                fallbackReason: 'No matching Actions found, using intent-based fallback'
              }
            })
          }
        } else {
          actionEntities.forEach((actionEntity, index) => {
            steps.push({
              actionId: `${actionEntity.value}_${index}`,
              actionName: actionEntity.value,
              parameters: this.extractParametersForAction(text, actionEntity, entities),
              confidence: actionEntity.confidence,
              position: index,
              metadata: {
                fallbackReason: 'No matching Actions found, using entity-based fallback'
              }
            })
          })
        }
      }
    } catch (error) {
      console.warn('Action mapping failed, falling back to basic parsing:', error)
      
      // Fallback to original basic parsing
      const actionEntities = entities.filter(e => e.type === 'action')
      
      if (actionEntities.length === 0) {
        if (intent.intent !== WorkflowIntent.CUSTOM) {
          steps.push({
            actionId: `${intent.intent}_action`,
            actionName: intent.intent,
            parameters: intent.parameters,
            confidence: intent.confidence,
            position: 0,
            metadata: {
              fallbackReason: 'Action mapping service error, using intent-based fallback',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        }
      } else {
        actionEntities.forEach((actionEntity, index) => {
          steps.push({
            actionId: `${actionEntity.value}_${index}`,
            actionName: actionEntity.value,
            parameters: this.extractParametersForAction(text, actionEntity, entities),
            confidence: actionEntity.confidence,
            position: index,
            metadata: {
              fallbackReason: 'Action mapping service error, using entity-based fallback',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          })
        })
      }
    }

    return steps
  }

  /**
   * Extract parameters from text for a specific action
   */
  private extractParametersForAction(text: string, actionEntity: Entity, allEntities: Entity[]): Record<string, any> {
    const parameters: Record<string, any> = {}

    // Find entities near this action
    const actionPosition = actionEntity.position[0]
    const nearbyEntities = allEntities.filter(entity => {
      const distance = Math.abs(entity.position[0] - actionPosition)
      return distance < 100 && entity !== actionEntity // Within 100 characters
    })

    // Map entities to parameters based on type and action context
    const amounts = nearbyEntities.filter(e => e.type === 'amount')
    const tokens = nearbyEntities.filter(e => e.type === 'token')
    const addresses = nearbyEntities.filter(e => e.type === 'address')

    // Extract amount (usually the first number found)
    if (amounts.length > 0) {
      parameters.amount = amounts[0].value
    }

    // Extract tokens based on action type
    if (actionEntity.value === 'swap' && tokens.length >= 2) {
      // For swap, first token is from, second is to
      parameters.fromToken = tokens[0].value
      parameters.toToken = tokens[1].value
    } else if (tokens.length > 0) {
      // For other actions, use the first token
      parameters.fromToken = tokens[0].value
    }

    // Extract address if present
    if (addresses.length > 0) {
      parameters.address = addresses[0].value
    }

    return parameters
  }

  /**
   * Extract general parameters from text and entities
   */
  private extractParameters(text: string, entities: Entity[]): Record<string, any> {
    const parameters: Record<string, any> = {}

    const amounts = entities.filter(e => e.type === 'amount')
    const tokens = entities.filter(e => e.type === 'token')
    const addresses = entities.filter(e => e.type === 'address')

    // Extract amount (first one found)
    if (amounts.length > 0) {
      parameters.amount = amounts[0].value
    }

    // Extract tokens
    if (tokens.length === 1) {
      parameters.fromToken = tokens[0].value
    } else if (tokens.length >= 2) {
      parameters.fromToken = tokens[0].value
      parameters.toToken = tokens[1].value
    }

    // Extract address
    if (addresses.length > 0) {
      parameters.address = addresses[0].value
    }

    return parameters
  }

  /**
   * Detect ambiguities in the parsed workflow
   */
  private detectAmbiguities(originalText: string, entities: Entity[], steps: ParsedStep[]): Ambiguity[] {
    const ambiguities: Ambiguity[] = []

    // Check for missing required parameters
    steps.forEach(step => {
      if (step.actionName === 'swap' && (!step.parameters.fromToken || !step.parameters.toToken)) {
        ambiguities.push({
          type: 'parameter',
          message: 'Swap action requires both source and destination tokens',
          suggestions: ['Specify both tokens to swap (e.g., "swap USDC to FLOW")', 'Add token symbols in your description'],
          position: step.position ? [step.position, step.position + step.actionName.length] : undefined
        })
      }

      if (step.actionName === 'transfer' && !step.parameters.address) {
        ambiguities.push({
          type: 'parameter',
          message: 'Transfer action requires a destination address',
          suggestions: ['Add recipient address (e.g., "transfer to 0x123...")', 'Specify the destination wallet'],
          position: step.position ? [step.position, step.position + step.actionName.length] : undefined
        })
      }
    })

    // Check for low confidence entities
    entities.forEach(entity => {
      if (entity.confidence < this.config.confidenceThreshold) {
        ambiguities.push({
          type: 'value',
          message: `Uncertain about "${entity.value}" (confidence: ${Math.round(entity.confidence * 100)}%)`,
          suggestions: ['Please clarify this value', 'Use more specific terminology'],
          position: entity.position
        })
      }
    })

    return ambiguities
  }

  /**
   * Generate helpful suggestions for improving the input
   */
  private generateSuggestions(originalText: string, ambiguities: Ambiguity[]): string[] {
    const suggestions: string[] = []

    if (ambiguities.length > 0) {
      suggestions.push('Try to be more specific with token names and amounts')
      suggestions.push('Include all required parameters for each action')
    }

    if (originalText.length < 10) {
      suggestions.push('Provide more details about what you want to accomplish')
    }

    if (!originalText.match(/\d/)) {
      suggestions.push('Consider including specific amounts or quantities')
    }

    return suggestions
  }

  /**
   * Calculate overall confidence score for the parsing result
   */
  private calculateOverallConfidence(steps: ParsedStep[], ambiguities: Ambiguity[]): number {
    if (steps.length === 0) return 0

    const stepConfidence = steps.reduce((acc, step) => acc + step.confidence, 0) / steps.length
    const ambiguityPenalty = Math.min(ambiguities.length * 0.1, 0.5) // Max 50% penalty
    
    return Math.max(0, stepConfidence - ambiguityPenalty)
  }

  /**
   * Map Hugging Face entity types to our entity types
   */
  private mapHFEntityType(hfType: string): Entity['type'] {
    const mapping: Record<string, Entity['type']> = {
      'PER': 'parameter',
      'PERSON': 'parameter',
      'ORG': 'token',
      'ORGANIZATION': 'token',
      'MISC': 'parameter',
      'LOC': 'address',
      'LOCATION': 'address'
    }

    return mapping[hfType] || 'parameter'
  }

  /**
   * Get patterns that matched the input text
   */
  private getMatchedPatterns(text: string, intentPatterns: any): string[] {
    const matchedPatterns: string[] = []
    
    for (const [intent, config] of Object.entries(intentPatterns)) {
      for (const pattern of config.patterns) {
        if (pattern.test(text)) {
          matchedPatterns.push(`${intent}: ${pattern.source}`)
        }
      }
    }
    
    return matchedPatterns
  }

  /**
   * Calculate ambiguity score based on intent scores
   */
  private calculateIntentAmbiguity(intentScores: Record<WorkflowIntent, number>): number {
    const scores = Object.values(intentScores).sort((a, b) => b - a)
    
    if (scores.length < 2 || scores[0] === 0) return 0
    
    // If top two scores are very close, it's ambiguous
    const topScore = scores[0]
    const secondScore = scores[1]
    
    return secondScore / topScore // Higher ratio = more ambiguous
  }

  /**
   * Check if a word appears in a negative context
   */
  private isNegativeContext(context: string, action: string): boolean {
    const negativeWords = ['not', 'don\'t', 'won\'t', 'can\'t', 'never', 'avoid', 'prevent']
    const lowerContext = context.toLowerCase()
    
    return negativeWords.some(word => lowerContext.includes(word))
  }

  /**
   * Calculate confidence for amount entities
   */
  private calculateAmountConfidence(match: string, text: string, position: number): number {
    let confidence = 0.8

    // Boost confidence if near financial keywords
    const context = text.slice(Math.max(0, position - 20), position + match.length + 20).toLowerCase()
    const financialKeywords = ['swap', 'transfer', 'stake', 'lend', 'borrow', 'pay', 'send']
    
    if (financialKeywords.some(keyword => context.includes(keyword))) {
      confidence += 0.1
    }

    // Boost confidence for well-formatted numbers
    if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(match)) {
      confidence += 0.05
    }

    // Reduce confidence for very large or very small numbers without context
    const numValue = parseFloat(match.replace(/,/g, ''))
    if ((numValue > 1000000 || numValue < 0.001) && !context.includes('million') && !context.includes('billion')) {
      confidence -= 0.1
    }

    return Math.min(confidence, 1)
  }

  /**
   * Calculate confidence for token entities
   */
  private calculateTokenConfidence(token: string, patternIndex: number, text: string, position: number): number {
    let confidence = 0.6

    // Known tokens get higher confidence
    if (patternIndex === 0) {
      confidence = 0.95
    }

    // Boost confidence if near financial keywords
    const context = text.slice(Math.max(0, position - 20), position + token.length + 20).toLowerCase()
    const financialKeywords = ['swap', 'transfer', 'stake', 'token', 'coin', 'currency']
    
    if (financialKeywords.some(keyword => context.includes(keyword))) {
      confidence += 0.2 // Increased boost
    }

    // Boost confidence for tokens with $ prefix
    if (patternIndex === 2) {
      confidence += 0.1
    }

    // Reduce confidence for common English words that might be false positives
    const commonWords = ['THE', 'AND', 'FOR', 'ARE', 'BUT', 'NOT', 'YOU', 'ALL', 'CAN', 'HER', 'WAS', 'ONE', 'OUR', 'HAD', 'BUT', 'HIS', 'HAS', 'HAD']
    if (commonWords.includes(token.toUpperCase())) {
      confidence -= 0.4
    }

    return Math.max(0.1, Math.min(confidence, 1))
  }

  /**
   * Calculate confidence for address entities
   */
  private calculateAddressConfidence(address: string, patternIndex: number): number {
    let confidence = 0.9

    // Ethereum addresses (40 hex chars) are most reliable
    if (patternIndex === 0 && address.length === 42) {
      confidence = 0.95
    }
    // Flow addresses (16 hex chars)
    else if (patternIndex === 1 && address.length === 18) {
      confidence = 0.9
    }
    // Bitcoin addresses are more variable
    else if (patternIndex === 2) {
      confidence = 0.85
    }

    return confidence
  }

  /**
   * Detect amount format
   */
  private detectAmountFormat(amount: string): string {
    if (/\d{1,3}(,\d{3})+/.test(amount)) return 'comma-separated'
    if (/\d+\.?\d*[kmb]/i.test(amount)) return 'abbreviated'
    if (/^\d+\.\d+$/.test(amount)) return 'decimal'
    if (/^\d+$/.test(amount)) return 'integer'
    return 'unknown'
  }

  /**
   * Extract unit from parameter text
   */
  private extractUnit(text: string): string | undefined {
    const unitPatterns = [
      /%/,
      /gwei/i,
      /minutes?|mins?/i,
      /hours?|hrs?/i,
      /seconds?|secs?/i
    ]

    for (const pattern of unitPatterns) {
      const match = text.match(pattern)
      if (match) return match[0].toLowerCase()
    }

    return undefined
  }

  /**
   * Merge overlapping entities (enhanced version)
   */
  private mergeOverlappingEntities(entities: Entity[]): Entity[] {
    if (entities.length <= 1) return entities
    
    const sorted = [...entities].sort((a, b) => a.position[0] - b.position[0])
    const merged: Entity[] = []
    
    let current = sorted[0]
    
    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      
      // Check if entities overlap
      if (current.position[1] >= next.position[0]) {
        // Merge entities - prefer higher confidence and more specific types
        const typePreference = { 'action': 4, 'token': 3, 'amount': 3, 'address': 2, 'parameter': 1 }
        const currentPref = typePreference[current.type] || 0
        const nextPref = typePreference[next.type] || 0
        
        if (next.confidence > current.confidence || (next.confidence === current.confidence && nextPref > currentPref)) {
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
   * Resolve conflicts between entity types
   */
  private resolveEntityConflicts(entities: Entity[]): Entity[] {
    // Group entities by position overlap
    const groups: Entity[][] = []
    
    for (const entity of entities) {
      let addedToGroup = false
      
      for (const group of groups) {
        if (group.some(e => this.entitiesOverlap(e, entity))) {
          group.push(entity)
          addedToGroup = true
          break
        }
      }
      
      if (!addedToGroup) {
        groups.push([entity])
      }
    }
    
    // Resolve conflicts within each group
    return groups.map(group => {
      if (group.length === 1) return group[0]
      
      // Choose the entity with highest confidence, with type preference as tiebreaker
      const typePreference = { 'action': 4, 'address': 3, 'token': 3, 'amount': 2, 'parameter': 1 }
      
      return group.reduce((best, current) => {
        const bestScore = best.confidence + (typePreference[best.type] || 0) * 0.1
        const currentScore = current.confidence + (typePreference[current.type] || 0) * 0.1
        
        return currentScore > bestScore ? current : best
      })
    })
  }

  /**
   * Check if two entities overlap
   */
  private entitiesOverlap(a: Entity, b: Entity): boolean {
    return !(a.position[1] <= b.position[0] || b.position[1] <= a.position[0])
  }

  /**
   * Validate entities against context
   */
  private validateEntitiesInContext(entities: Entity[], text: string): Entity[] {
    return entities.filter(entity => {
      const context = text.slice(
        Math.max(0, entity.position[0] - 30),
        Math.min(text.length, entity.position[1] + 30)
      ).toLowerCase()

      // Validate tokens appear in financial context
      if (entity.type === 'token') {
        const financialContext = ['swap', 'transfer', 'stake', 'lend', 'borrow', 'pay', 'send', 'token', 'coin', 'currency']
        return financialContext.some(word => context.includes(word))
      }

      // Validate amounts appear near actions or tokens
      if (entity.type === 'amount') {
        const relevantContext = ['swap', 'transfer', 'stake', 'lend', 'borrow', 'pay', 'send', 'usdc', 'flow', 'eth', 'btc']
        return relevantContext.some(word => context.includes(word))
      }

      // Validate addresses appear in transfer context
      if (entity.type === 'address') {
        const addressContext = ['transfer', 'send', 'to', 'from', 'address', 'wallet', 'recipient']
        return addressContext.some(word => context.includes(word))
      }

      return true // Keep other entity types
    })
  }

  /**
   * Calculate final confidence score for an entity
   */
  private calculateFinalConfidence(entity: Entity, allEntities: Entity[], text: string): number {
    let confidence = entity.confidence

    // Boost confidence if entity is part of a complete pattern
    if (entity.type === 'action') {
      const hasAmount = allEntities.some(e => e.type === 'amount')
      const hasToken = allEntities.some(e => e.type === 'token')
      
      if (hasAmount && hasToken) confidence += 0.1
    }

    // Boost confidence for entities that appear multiple times
    const sameValueEntities = allEntities.filter(e => e.value === entity.value && e.type === entity.type)
    if (sameValueEntities.length > 1) {
      confidence += 0.05
    }

    // Reduce confidence for very short entities in long text
    if (entity.value.length <= 2 && text.length > 50) {
      confidence -= 0.1
    }

    return Math.max(0.1, Math.min(confidence, 1))
  }

  /**
   * Validate extracted parameters against expected schemas (placeholder for task 3.3)
   */
  async validateParameters(step: ParsedStep, actionSchema?: any): Promise<{ isValid: boolean; errors: string[] }> {
    // Basic validation - will be enhanced in task 3.3
    const errors: string[] = []

    if (!step.parameters || Object.keys(step.parameters).length === 0) {
      errors.push('No parameters found for action')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get suggestions for incomplete or ambiguous inputs (placeholder for task 3.4)
   */
  async suggestCorrections(input: string, errors: string[]): Promise<string[]> {
    const suggestions: string[] = []

    if (errors.includes('No parameters found for action')) {
      suggestions.push('Try adding specific amounts, token names, or addresses')
      suggestions.push('Example: "Swap 100 USDC to FLOW"')
    }

    return suggestions
  }
}

/**
 * Custom error class for NLP-related errors
 */
export class NLPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: string
  ) {
    super(message)
    this.name = 'NLPError'
  }
}

/**
 * Factory function to create NLP service with default configuration
 */
export function createNLPService(config?: Partial<NLPConfig>): NLPService {
  return new NLPService(config)
}

/**
 * Utility function to check if Hugging Face integration is available
 */
export function isHuggingFaceAvailable(): boolean {
  return !!(process.env.HUGGINGFACE_API_KEY || process.env.HF_TOKEN)
}

export default NLPService