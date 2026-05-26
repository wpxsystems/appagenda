import React, { createContext, useContext, useEffect, useState } from 'react'
import * as SecureStore from 'expo-secure-store'
import { setTokenGetter } from './api'

const ACCESS_KEY = 'racket_access_token'
const REFRESH_KEY = 'racket_refresh_token'
const USER_KEY = 'racket_user'

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
          SecureStore.getItemAsync(ACCESS_KEY),
          SecureStore.getItemAsync(USER_KEY),
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
      SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
      SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(authUser)),
    ])
    setAccessToken(tokens.accessToken)
    setUser(authUser)
  }

  async function logout() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_KEY),
      SecureStore.deleteItemAsync(REFRESH_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
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
