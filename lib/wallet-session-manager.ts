import { WalletType, FlowNetworkConfig, FlowUser } from '@/lib/types'
import { WalletErrorHandler, WalletErrorType } from '@/lib/wallet-error-handler'

export interface WalletSession {
  address: string
  walletType: WalletType
  networkChainId: string
  timestamp: number
  expiresAt: number
  metadata: SessionMetadata
}

export interface SessionMetadata {
  userAgent: string
  ipAddress?: string
  deviceId: string
  lastActivity: number
  connectionCount: number
  features: string[]
}

export interface SessionConfig {
  maxAge: number // Maximum session age in milliseconds
  inactivityTimeout: number // Inactivity timeout in milliseconds
  maxSessions: number // Maximum number of concurrent sessions
  persistAcrossReloads: boolean
  encryptionEnabled: boolean
}

export interface SessionValidationResult {
  isValid: boolean
  reason?: string
  shouldRestore: boolean
  requiresReauth: boolean
}

export class WalletSessionManager {
  private sessionKey = 'actionloom_wallet_session'
  private sessionsKey = 'actionloom_wallet_sessions'
  private config: SessionConfig
  private errorHandler: WalletErrorHandler
  private currentSession: WalletSession | null = null
  private sessionCheckInterval: NodeJS.Timeout | null = null

  constructor(config?: Partial<SessionConfig>, errorHandler?: WalletErrorHandler) {
    this.config = {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
      maxSessions: 5,
      persistAcrossReloads: true,
      encryptionEnabled: false,
      ...config
    }

    this.errorHandler = errorHandler || new WalletErrorHandler()
    this.startSessionMonitoring()
  }

  async createSession(
    user: FlowUser,
    walletType: WalletType,
    network: FlowNetworkConfig
  ): Promise<WalletSession> {
    try {
      if (!user.addr) {
        throw new Error('User address is required to create session')
      }

      const now = Date.now()
      const deviceId = this.getOrCreateDeviceId()

      const session: WalletSession = {
        address: user.addr,
        walletType,
        networkChainId: network.chainId,
        timestamp: now,
        expiresAt: now + this.config.maxAge,
        metadata: {
          userAgent: navigator.userAgent,
          deviceId,
          lastActivity: now,
          connectionCount: 1,
          features: this.extractUserFeatures(user)
        }
      }

      // Validate session before storing
      const validation = await this.validateSession(session, network)
      if (!validation.isValid) {
        throw new Error(`Invalid session: ${validation.reason}`)
      }

      // Store session
      await this.storeSession(session)
      this.currentSession = session

      console.log('Wallet session created:', {
        address: session.address,
        walletType: session.walletType,
        network: network.name,
        expiresAt: new Date(session.expiresAt).toISOString()
      })

      return session
    } catch (error) {
      const walletError = this.errorHandler.parseError(error, 'createSession')
      console.error('Failed to create session:', walletError)
      throw walletError
    }
  }

  async restoreSession(network: FlowNetworkConfig): Promise<WalletSession | null> {
    return this.errorHandler.handleError(
      async () => {
        const sessionData = this.getStoredSession()
        if (!sessionData) {
          return null
        }

        const validation = await this.validateSession(sessionData, network)
        if (!validation.isValid) {
          console.log(`Session validation failed: ${validation.reason}`)
          await this.clearSession()
          return null
        }

        if (!validation.shouldRestore) {
          console.log('Session should not be restored')
          await this.clearSession()
          return null
        }

        // Update last activity
        sessionData.metadata.lastActivity = Date.now()
        await this.storeSession(sessionData)
        this.currentSession = sessionData

        console.log('Wallet session restored:', {
          address: sessionData.address,
          walletType: sessionData.walletType,
          network: network.name
        })

        return sessionData
      },
      'restoreSession',
      { maxAttempts: 2 }
    )
  }

  async updateSession(updates: Partial<WalletSession>): Promise<void> {
    if (!this.currentSession) {
      throw this.errorHandler.createError(
        WalletErrorType.SESSION_INVALID,
        'No active session to update'
      )
    }

    try {
      const updatedSession = {
        ...this.currentSession,
        ...updates,
        metadata: {
          ...this.currentSession.metadata,
          ...updates.metadata,
          lastActivity: Date.now()
        }
      }

      await this.storeSession(updatedSession)
      this.currentSession = updatedSession

      console.log('Session updated:', updates)
    } catch (error) {
      const walletError = this.errorHandler.parseError(error, 'updateSession')
      console.error('Failed to update session:', walletError)
      throw walletError
    }
  }

  async clearSession(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(this.sessionKey)
      }
      
      this.currentSession = null
      console.log('Wallet session cleared')
    } catch (error) {
      console.error('Failed to clear session:', error)
    }
  }

  async validateSession(session: WalletSession, network: FlowNetworkConfig): Promise<SessionValidationResult> {
    const now = Date.now()

    // Check if session is expired
    if (now > session.expiresAt) {
      return {
        isValid: false,
        reason: 'Session expired',
        shouldRestore: false,
        requiresReauth: true
      }
    }

    // Check network compatibility
    if (session.networkChainId !== network.chainId) {
      return {
        isValid: false,
        reason: 'Network mismatch',
        shouldRestore: false,
        requiresReauth: false
      }
    }

    // Check inactivity timeout
    const inactiveTime = now - session.metadata.lastActivity
    if (inactiveTime > this.config.inactivityTimeout) {
      return {
        isValid: false,
        reason: 'Session inactive too long',
        shouldRestore: false,
        requiresReauth: true
      }
    }

    // Check device consistency (basic security check)
    const currentDeviceId = this.getOrCreateDeviceId()
    if (session.metadata.deviceId !== currentDeviceId) {
      return {
        isValid: false,
        reason: 'Device mismatch',
        shouldRestore: false,
        requiresReauth: true
      }
    }

    // Session is valid
    return {
      isValid: true,
      shouldRestore: true,
      requiresReauth: false
    }
  }

  getCurrentSession(): WalletSession | null {
    return this.currentSession
  }

  isSessionActive(): boolean {
    return this.currentSession !== null
  }

  getSessionInfo(): { address: string; walletType: WalletType; network: string } | null {
    if (!this.currentSession) {
      return null
    }

    return {
      address: this.currentSession.address,
      walletType: this.currentSession.walletType,
      network: this.currentSession.networkChainId
    }
  }

  async refreshSession(): Promise<void> {
    if (!this.currentSession) {
      return
    }

    const now = Date.now()
    await this.updateSession({
      metadata: {
        ...this.currentSession.metadata,
        lastActivity: now
      }
    })
  }

  // Session monitoring and cleanup
  private startSessionMonitoring(): void {
    if (typeof window === 'undefined') {
      return // Skip in server-side rendering
    }

    // Check session validity every minute
    this.sessionCheckInterval = setInterval(() => {
      this.checkSessionValidity()
    }, 60 * 1000)

    // Listen for storage events (session changes in other tabs)
    window.addEventListener('storage', (event) => {
      if (event.key === this.sessionKey) {
        this.handleStorageChange(event)
      }
    })

    // Listen for page visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.currentSession) {
        this.refreshSession()
      }
    })
  }

  private async checkSessionValidity(): Promise<void> {
    if (!this.currentSession) {
      return
    }

    const now = Date.now()
    
    // Check if session expired
    if (now > this.currentSession.expiresAt) {
      console.log('Session expired, clearing...')
      await this.clearSession()
      return
    }

    // Check inactivity
    const inactiveTime = now - this.currentSession.metadata.lastActivity
    if (inactiveTime > this.config.inactivityTimeout) {
      console.log('Session inactive too long, clearing...')
      await this.clearSession()
      return
    }
  }

  private handleStorageChange(event: StorageEvent): void {
    if (event.key === this.sessionKey) {
      if (event.newValue === null) {
        // Session was cleared in another tab
        this.currentSession = null
        console.log('Session cleared in another tab')
      } else {
        // Session was updated in another tab
        try {
          const session = JSON.parse(event.newValue) as WalletSession
          this.currentSession = session
          console.log('Session updated from another tab')
        } catch (error) {
          console.error('Failed to parse session from storage event:', error)
        }
      }
    }
  }

  private getStoredSession(): WalletSession | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null
    }

    try {
      const sessionData = localStorage.getItem(this.sessionKey)
      if (!sessionData) {
        return null
      }

      return JSON.parse(sessionData) as WalletSession
    } catch (error) {
      console.error('Failed to parse stored session:', error)
      return null
    }
  }

  private async storeSession(session: WalletSession): Promise<void> {
    if (typeof window === 'undefined' || !window.localStorage) {
      return
    }

    try {
      const sessionData = JSON.stringify(session)
      localStorage.setItem(this.sessionKey, sessionData)
    } catch (error) {
      console.error('Failed to store session:', error)
      throw new Error('Failed to persist session')
    }
  }

  private getOrCreateDeviceId(): string {
    const deviceIdKey = 'actionloom_device_id'
    
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'server-side-device'
    }

    let deviceId = localStorage.getItem(deviceIdKey)
    if (!deviceId) {
      deviceId = this.generateDeviceId()
      localStorage.setItem(deviceIdKey, deviceId)
    }

    return deviceId
  }

  private generateDeviceId(): string {
    // Generate a simple device ID based on browser characteristics
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx?.fillText('ActionLoom', 10, 10)
    const canvasFingerprint = canvas.toDataURL()

    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvasFingerprint.slice(-50) // Last 50 chars of canvas fingerprint
    ].join('|')

    // Simple hash function
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36)
  }

  private extractUserFeatures(user: FlowUser): string[] {
    const features: string[] = []

    if (user.services) {
      user.services.forEach(service => {
        if (service.type) {
          features.push(service.type)
        }
      })
    }

    return features
  }

  // Cleanup
  destroy(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval)
      this.sessionCheckInterval = null
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.handleStorageChange)
      document.removeEventListener('visibilitychange', this.refreshSession)
    }
  }
}