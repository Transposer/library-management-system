import { useState } from 'react'
import { useAcquisitions } from '../hooks/useAcquisitions'
import { adminApi } from '../services/adminApi'

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' }
]

const STATUS_LABELS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected'
}

const STATUS_BADGE = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'danger'
}

const RejectModal = ({ open, loading, onClose, onConfirm }) => {
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(reason)
    setReason('')
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Rejection Reason</h3>
          <button className="modal-close" onClick={onClose}>x</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Reason (optional)</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this request was rejected..."
                rows={3}
                style={{ resize: 'vertical', minHeight: 80 }}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={loading}>
              {loading ? 'Rejecting...' : 'Confirm Reject'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const AcquisitionManagement = ({ currentUserId, onNotify }) => {
  const { query, data, loading, setStatus, setKeyword, setPage, setSize, reload } = useAcquisitions()
  const [submitting, setSubmitting] = useState(false)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [keywordInput, setKeywordInput] = useState(query.keyword || '')

  const totalPages = Math.max(1, Math.ceil(data.total / data.size))

  const handleSearch = (e) => {
    e.preventDefault()
    setKeyword(keywordInput.trim())
  }

  const handleApprove = async (id) => {
    try {
      setSubmitting(true)
      await adminApi.approveAcquisitionRequest(id)
      onNotify('success', 'Request approved successfully')
      await reload()
    } catch (err) {
      onNotify('error', err.message || 'Failed to approve')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (reason) => {
    if (!rejectTarget) return
    try {
      setSubmitting(true)
      await adminApi.rejectAcquisitionRequest(rejectTarget.id, reason)
      onNotify('success', 'Request rejected successfully')
      setRejectTarget(null)
      await reload()
    } catch (err) {
      onNotify('error', err.message || 'Failed to reject')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="content">
      <div className="page-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 20 }}>
        <h2>Acquisition Management</h2>
        <p className="config-subtitle" style={{ color: '#5b6882' }}>
          Review and manage book acquisition requests submitted by users.
        </p>
      </div>

      <div className="search-section">
        <form className="search-form" onSubmit={handleSearch}>
          <select
            className="search-select"
            value={query.status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            className="search-input"
            placeholder="Search by title, author, or ISBN"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
          <button className="search-btn" type="submit">Apply Filters</button>
          <button className="btn-secondary" type="button" onClick={() => { setStatus(''); setKeyword(''); setKeywordInput('') }}>
            Reset
          </button>
        </form>
      </div>

      <div className="table-section">
        <h3>Acquisition Requests</h3>
        {loading ? (
          <div className="loading">Loading requests...</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Author</th>
                  <th>ISBN</th>
                  <th>Requester</th>
                  <th>Status</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600, color: '#1a202c' }}>{item.title}</td>
                    <td style={{ color: '#718096' }}>{item.author}</td>
                    <td><code style={{ fontSize: '12px' }}>{item.isbn || '-'}</code></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{item.user?.name || 'Unknown'}</span>
                        <span style={{ fontSize: '12px', color: '#718096' }}>{item.user?.email || ''}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${STATUS_BADGE[item.status] || 'info'}`}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </td>
                    <td style={{ color: '#718096', fontSize: '13px' }}>{item.createdAt}</td>
                    <td>
                      {item.status === 'PENDING' ? (
                        <div className="action-buttons-cell" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn-sm"
                            style={{ background: '#48bb78' }}
                            disabled={submitting}
                            onClick={() => handleApprove(item.id)}
                          >
                            Approve
                          </button>
                          <button
                            className="btn-sm btn-delete"
                            disabled={submitting}
                            onClick={() => setRejectTarget(item)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#a0aec0', fontSize: '13px' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {data.list.length === 0 && <div className="no-data">No acquisition requests found.</div>}

            <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: 18 }}>
              <span style={{ color: '#718096', fontSize: 13 }}>
                Total {data.total} records · Page {data.page}/{totalPages}
                <select
                  value={data.size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="search-select"
                  style={{ marginLeft: 10, minWidth: 'auto', width: 'auto', padding: '6px 10px', fontSize: 13 }}
                >
                  {[5, 10, 20, 50].map((s) => <option key={s} value={s}>{s} / page</option>)}
                </select>
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-secondary"
                  onClick={() => setPage(query.page - 1)}
                  disabled={query.page <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setPage(query.page + 1)}
                  disabled={query.page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <RejectModal
        open={!!rejectTarget}
        loading={submitting}
        onClose={() => setRejectTarget(null)}
        onConfirm={handleReject}
      />
    </div>
  )
}

export default AcquisitionManagement
