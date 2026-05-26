const BASE_URL = process.env['EXPO_PUBLIC_API_URL'] ?? 'http://localhost:3001'

let _getToken: (() => string | null) | null = null

export function setTokenGetter(fn: () => string | null) {
  _getToken = fn
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = _getToken?.()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  return fetch(`${BASE_URL}${path}`, { ...options, headers })
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
