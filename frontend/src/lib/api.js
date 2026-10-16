export const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '')
export const API = `${API_BASE}/api`
export async function apiRequest(path, { token, ...options } = {}) {
 const response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
 const data = response.status === 204 ? null : await response.json().catch(() => ({}))
 if (!response.ok) throw new Error(data?.message || `Request failed (${response.status})`)
 return data
}
