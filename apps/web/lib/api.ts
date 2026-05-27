const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('racket_access_token')
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem('racket_access_token', access)
  localStorage.setItem('racket_refresh_token', refresh)
}

export function clearTokens() {
  localStorage.removeItem('racket_access_token')
  localStorage.removeItem('racket_refresh_token')
}

export function isLoggedIn(): boolean {
  return !!getToken()
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return fetch(`${BASE}${path}`, { ...options, headers })
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path)
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

export async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (data !== undefined) headers['Content-Type'] = 'application/json'
  const res = await apiFetch(path, {
    method: 'POST',
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.error ?? 'Request failed'), { status: res.status, data: json })
  return json
}

export async function apiPatch<T>(path: string, data?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (data !== undefined) headers['Content-Type'] = 'application/json'
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.error ?? 'Request failed'), { status: res.status, data: json })
  return json
}

export async function apiPut<T>(path: string, data?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  if (data !== undefined) headers['Content-Type'] = 'application/json'
  const res = await apiFetch(path, {
    method: 'PUT',
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  })
  const json = await res.json()
  if (!res.ok) throw Object.assign(new Error(json.error ?? 'Request failed'), { status: res.status, data: json })
  return json
}
