const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'lab_access_token'

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

function token() {
  return localStorage.getItem(TOKEN_KEY)
}

function normalizeError(detail, status) {
  if (Array.isArray(detail)) return detail.map(item => item.msg || 'Validation error').join(', ')
  if (typeof detail === 'string') return detail
  return status === 401 ? 'Your session has expired. Please log in again.' : 'The server returned an unexpected error.'
}

export async function request(path, options = {}) {
  if (!API_BASE_URL) throw new ApiError('VITE_API_BASE_URL is not configured.')
  const headers = { Accept: 'application/json', ...options.headers }
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  const accessToken = token()
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Unable to connect to the server.')
  }
  const text = await response.text()
  let payload = null
  if (text) {
    try { payload = JSON.parse(text) } catch { payload = text }
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY)
    window.dispatchEvent(new Event('auth-expired'))
    throw new ApiError('Your session has expired. Please log in again.', 401, payload?.detail)
  }
  if (!response.ok) throw new ApiError(normalizeError(payload?.detail ?? payload, response.status), response.status, payload?.detail)
  return payload
}

const query = params => {
  const search = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => { if (value !== undefined && value !== null && value !== '') search.set(key, value) })
  const result = search.toString()
  return result ? `?${result}` : ''
}
const list = payload => Array.isArray(payload) ? payload : payload?.items || payload?.data || []

export const api = {
  tokenKey: TOKEN_KEY,
  login: credentials => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  dashboard: () => request('/admin/dashboard'),
  settings: () => request('/admin/settings'),
  updateInactiveDays: value => request('/admin/settings/inactive-days', { method: 'PUT', body: JSON.stringify({ value: String(value) }) }),
  customers: params => request(`/customers${query({ page: 1, page_size: 100, ...params })}`),
  inactiveCustomers: params => request(`/customers/inactive${query({ page: 1, page_size: 100, ...params })}`),
  customer: id => request(`/customers/${id}`),
  visits: id => request(`/customers/${id}/visits${query({ page: 1, page_size: 100 })}`),
  campaigns: params => request(`/campaigns${query({ page: 1, page_size: 100, ...params })}`),
  campaign: id => request(`/campaigns/${id}`),
  createCampaign: body => request('/campaigns', { method: 'POST', body: JSON.stringify(body) }),
  populateCampaign: id => request(`/campaigns/${id}/populate`, { method: 'POST' }),
  templates: params => request(`/templates${query({ page: 1, page_size: 100, ...params })}`),
  template: id => request(`/templates/${id}`),
  createTemplate: body => request('/templates', { method: 'POST', body: JSON.stringify(body) }),
  updateTemplate: (id, body) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  messages: params => request(`/messages${query({ page: 1, page_size: 100, ...params })}`),
  message: id => request(`/messages/${id}`),
}

export { list }
