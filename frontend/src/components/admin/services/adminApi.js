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
  }),

  getConfig: () => request('/config'),
  updateBorrowRules: (body) => request('/config/borrow-rules', {
    method: 'PUT',
    body: JSON.stringify(body)
  }),
  updateFineRate: (body) => request('/config/fine-rate', {
    method: 'PUT',
    body: JSON.stringify(body)
  }),

  listAuditLogs: (params) => request(`/audit-logs${qs(params)}`),

  // Dashboard
  getDashboardOverview: () => request('/dashboard/overview'),
  getLoanTrends: (period = '30d') => request(`/dashboard/loan-trends?period=${period}`),
  getPopularBooks: (limit = 10) => request(`/dashboard/popular-books?limit=${limit}`),
  getRecentActivities: (limit = 20) => request(`/dashboard/recent-activities?limit=${limit}`),

  // Backup
  createBackup: () => request('/backup', { method: 'POST' }),
  listBackups: (params) => request(`/backup${qs(params)}`),
  deleteBackup: (id) => request(`/backup/${id}`, { method: 'DELETE' }),
  getBackupDownloadUrl: (id) => `${API_BASE}/backup/${id}/download`,

  // Announcement
  listAnnouncements: (params) => request(`/announcements${qs(params)}`),
  createAnnouncement: (body) => request('/announcements', { method: 'POST', body: JSON.stringify(body) }),
  updateAnnouncement: (id, body) => request(`/announcements/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAnnouncement: (id) => request(`/announcements/${id}`, { method: 'DELETE' }),
  publishAnnouncement: (id) => request(`/announcements/${id}/publish`, { method: 'PUT' }),
  unpublishAnnouncement: (id) => request(`/announcements/${id}/unpublish`, { method: 'PUT' }),

  // Reports
  getMonthlyBorrowingReport: (month) => request(`/dashboard/reports/borrowing?month=${encodeURIComponent(month)}`),
  getOverdueStatsReport: (month) => request(`/dashboard/reports/overdue?month=${encodeURIComponent(month)}`),
  getUsageSummaryReport: (month) => request(`/dashboard/reports/usage?month=${encodeURIComponent(month)}`),
  getBorrowingExportUrl: (month) => `${API_BASE}/dashboard/reports/borrowing/export?month=${encodeURIComponent(month)}`,
  getOverdueExportUrl: (month) => `${API_BASE}/dashboard/reports/overdue/export?month=${encodeURIComponent(month)}`,
  getUsageExportUrl: (month) => `${API_BASE}/dashboard/reports/usage/export?month=${encodeURIComponent(month)}`,

  // Acquisition
  listAcquisitionRequests: (params) => request(`/acquisition-requests${qs(params)}`),
  approveAcquisitionRequest: (id) => request(`/acquisition-requests/${id}/approve`, { method: 'PUT' }),
  rejectAcquisitionRequest: (id, reason) => request(`/acquisition-requests/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) }),
}
