const API_BASE = '/api/admin'

const getToken = () => localStorage.getItem('token')

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  })

  const payload = await res.json().catch(() => ({}))
  const isSuccess = res.ok && (payload.code === undefined || payload.code === 200)

  if (!isSuccess) {
    const error = new Error(payload.message || 'Request failed')
    error.status = res.status
    throw error
  }

  return payload.data
}

const qs = (params = {}) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const q = query.toString()
  return q ? `?${q}` : ''
}

export const adminApi = {
  listLibrarians: (params) => request(`/librarians${qs(params)}`),
  createLibrarian: (body) => request('/librarians', { method: 'POST', body: JSON.stringify(body) }),
  updateLibrarian: (id, body) => request(`/librarians/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteLibrarian: (id) => request(`/librarians/${id}`, { method: 'DELETE' }),

  listUsers: (params) => request(`/users${qs(params)}`),
  deleteUser: (id) => request(`/users/${id}`, { method: 'DELETE' }),
  updateUserRole: (id, role) => request(`/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  }),
  resetUserPassword: (id, newPassword) => request(`/users/${id}/reset-password`, {
    method: 'POST',
    body: JSON.stringify(newPassword ? { newPassword } : {})
  })
}
