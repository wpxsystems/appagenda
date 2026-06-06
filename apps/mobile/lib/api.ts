export const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3000/api/v1'

let _getToken: (() => string | null) | null = null
let _refreshHandler: (() => Promise<boolean>) | null = null
let _refreshPromise: Promise<boolean> | null = null

export function setTokenGetter(fn: () => string | null) {
  _getToken = fn
}

export function setRefreshHandler(fn: () => Promise<boolean>) {
  _refreshHandler = fn
}

// Direct fetch for /auth/refresh — bypasses the auto-refresh logic to avoid recursion
export async function apiRefreshToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    if (!res.ok) return null
    return res.json() as Promise<{ accessToken: string; refreshToken: string }>
  } catch {
    return null
  }
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = _getToken?.()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  // Auto-refresh on 401 — skip for auth routes to avoid infinite loops
  if (res.status === 401 && _refreshHandler && !path.startsWith('/auth/')) {
    // Deduplicate: multiple concurrent 401s share one refresh attempt
    if (!_refreshPromise) {
      _refreshPromise = _refreshHandler().finally(() => {
        _refreshPromise = null
      })
    }
    const refreshed = await _refreshPromise
    if (refreshed) {
      const newToken = _getToken?.()
      const retryHeaders = { ...headers }
      if (newToken) retryHeaders['Authorization'] = `Bearer ${newToken}`
      return fetch(`${BASE_URL}${path}`, { ...options, headers: retryHeaders })
    }
  }

  return res
}

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text()
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  if (!res.ok) {
    const message =
      typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`
    throw Object.assign(new Error(message), { status: res.status, body })
  }
  return body as T
}

export async function apiGet<T>(path: string): Promise<T> {
  return parseResponse<T>(await apiFetch(path))
}

export async function apiPost<T>(path: string, data?: unknown): Promise<T> {
  return parseResponse<T>(await apiFetch(path, { method: 'POST', body: JSON.stringify(data) }))
}

export async function apiPatch<T>(path: string, data?: unknown): Promise<T> {
  return parseResponse<T>(await apiFetch(path, { method: 'PATCH', body: JSON.stringify(data) }))
}

export async function apiDelete<T>(path: string, data?: unknown): Promise<T> {
  return parseResponse<T>(await apiFetch(path, { method: 'DELETE', body: JSON.stringify(data) }))
}
