/**
 * Minimal HTTP client for the Django REST API.
 * Uses cookie-based sessions; unsafe requests carry the CSRF token from the `csrftoken` cookie.
 */

export class ApiError extends Error {
  status: number
  errors: Record<string, string[]>

  constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }

  /** First message for a field (supports nested keys like `blocks[0].props.href`). */
  field(name: string) {
    return this.errors[name]?.[0]
  }
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

let csrfReady: Promise<void> | null = null
export function ensureCsrf(force = false) {
  if (force || !csrfReady || !readCookie('csrftoken')) {
    csrfReady = fetch(`${API_BASE}/api/auth/csrf/`, { credentials: 'include' }).then(() => undefined)
  }
  return csrfReady
}

type Query = Record<string, string | number | boolean | undefined | null>

export function buildQuery(params?: Query) {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

async function parseError(res: Response): Promise<ApiError> {
  let data: { detail?: string; errors?: Record<string, string[]> } = {}
  try {
    data = await res.json()
  } catch {
    /* non-JSON error body */
  }
  const fallback =
    res.status === 403
      ? 'You do not have permission to do this.'
      : res.status === 404
        ? 'Not found.'
        : res.status >= 500
          ? 'The server encountered an error. Please try again.'
          : 'Request failed.'
  return new ApiError(res.status, data.detail ?? fallback, data.errors ?? {})
}

export async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(method)
  if (unsafe) await ensureCsrf()
  const headers: Record<string, string> = { Accept: 'application/json' }
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'
  if (unsafe) headers['X-CSRFToken'] = readCookie('csrftoken') ?? ''
  let res: Response
  try {
    res = await fetch(`${API_BASE}${path}${buildQuery(query)}`, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check that the backend is running.')
  }
  if (!res.ok) throw await parseError(res)
  if (res.status === 204) return undefined as T
  const type = res.headers.get('content-type') ?? ''
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>
}

export const http = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T = void>(path: string) => request<T>('DELETE', path),
}
