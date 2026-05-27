import React, { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { setTokenGetter } from './api'

const ACCESS_KEY = 'racket_access_token'
const REFRESH_KEY = 'racket_refresh_token'
const USER_KEY = 'racket_user'

// Storage abstraction: SecureStore on native, localStorage on web
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
      return
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.setItemAsync(key, value)
  },
  async del(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key)
      return
    }
    const SecureStore = await import('expo-secure-store')
    return SecureStore.deleteItemAsync(key)
  },
}

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthTokens {
  accessToken: string
  refreshToken: string
}

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (tokens: AuthTokens, user: AuthUser) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setTokenGetter(() => accessToken)
  }, [accessToken])

  useEffect(() => {
    async function restore() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          storage.get(ACCESS_KEY),
          storage.get(USER_KEY),
        ])
        if (storedToken && storedUser) {
          setAccessToken(storedToken)
          setUser(JSON.parse(storedUser) as AuthUser)
        }
      } finally {
        setIsLoading(false)
      }
    }
    restore()
  }, [])

  async function login(tokens: AuthTokens, authUser: AuthUser) {
    await Promise.all([
      storage.set(ACCESS_KEY, tokens.accessToken),
      storage.set(REFRESH_KEY, tokens.refreshToken),
      storage.set(USER_KEY, JSON.stringify(authUser)),
    ])
    setAccessToken(tokens.accessToken)
    setUser(authUser)
  }

  async function logout() {
    await Promise.all([
      storage.del(ACCESS_KEY),
      storage.del(REFRESH_KEY),
      storage.del(USER_KEY),
    ])
    setAccessToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isAuthenticated: !!accessToken, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
