'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { saveTokens, clearTokens } from './api'

interface User { id: string; name: string; email: string; role: string }
interface AuthCtx {
  user: User | null
  isLoading: boolean
  login: (tokens: { accessToken: string; refreshToken: string }, user: User) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem('racket_user')
    if (stored) setUser(JSON.parse(stored))
    setIsLoading(false)
  }, [])

  function login(tokens: { accessToken: string; refreshToken: string }, u: User) {
    saveTokens(tokens.accessToken, tokens.refreshToken)
    localStorage.setItem('racket_user', JSON.stringify(u))
    setUser(u)
  }

  function logout() {
    clearTokens()
    localStorage.removeItem('racket_user')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, isLoading, login, logout }}>{children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
