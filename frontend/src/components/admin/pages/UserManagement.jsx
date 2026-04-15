import { useMemo, useState } from 'react'
import ConfirmDeleteModal from '../components/ConfirmDeleteModal'
import LibrarianFormModal from '../components/LibrarianFormModal'
import ResetPasswordModal from '../components/ResetPasswordModal'
import UserDeleteModal from '../components/UserDeleteModal'
import { ROLE_LABELS, ROLE_OPTIONS } from '../constants'
import { useUsers } from '../hooks/useUsers'
import { adminApi } from '../services/adminApi'

const totalPages = (total, size) => Math.max(1, Math.ceil(total / size))
const USER_DELETE_ROLES = ['STUDENT', 'ADMIN']

const UserManagement = ({ currentUserId, onNotify }) => {
  const {
    query,
    data,
    loading,
    setRole,
    setKeyword,
    setPage,
    updateRole,
    deleteUser,
    resetPassword,
    reload
  } = useUsers()

  const [keywordInput, setKeywordInput] = useState('')
  const [draftRoles, setDraftRoles] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const [resetOpen, setResetOpen] = useState(false)
  const [targetUser, setTargetUser] = useState(null)
  const [resetResult, setResetResult] = useState(null)

  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [targetLibrarian, setTargetLibrarian] = useState(null)

  const [deleteLibrarianOpen, setDeleteLibrarianOpen] = useState(false)
  const [deleteUserOpen, setDeleteUserOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const pageTotal = useMemo(() => totalPages(data.total, data.size), [data.total, data.size])

  const handleSearch = (e) => {
    e.preventDefault()
    setKeyword(keywordInput.trim())
  }

  const openCreateLibrarian = () => {
    setFormMode('create')
    setTargetLibrarian(null)
    setFormOpen(true)
  }

  const openEditLibrarian = (user) => {
    setFormMode('edit')
    setTargetLibrarian({
      id: user.id,
      name: user.name,
      email: user.email,
      staffId: user.staffId || ''
    })
    setFormOpen(true)
  }

  const openReset = (user) => {
    setTargetUser(user)
    setResetResult(null)
    setResetOpen(true)
  }

  const openDelete = (user) => {
    setDeleteTarget(user)
    if (user.role === 'LIBRARIAN') {
      setDeleteLibrarianOpen(true)
      return
    }
    setDeleteUserOpen(true)
  }

  const handleUpdateRole = async (user) => {
    const nextRole = draftRoles[user.id] || user.role
    if (nextRole === user.role) return

    try {
      setSubmitting(true)
      await updateRole(user.id, nextRole)
      onNotify('success', 'Role updated successfully')
    } catch (error) {
      onNotify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitLibrarian = async (payload) => {
    try {
      setSubmitting(true)
      if (formMode === 'create') {
        await adminApi.createLibrarian(payload)
        onNotify('success', 'Librarian created successfully')
      } else {
        await adminApi.updateLibrarian(targetLibrarian.id, payload)
        onNotify('success', 'Librarian updated successfully')
      }
      setFormOpen(false)
      setTargetLibrarian(null)
      await reload()
    } catch (error) {
      onNotify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteLibrarian = async () => {
    if (!deleteTarget) return
    try {
      setSubmitting(true)
      await adminApi.deleteLibrarian(deleteTarget.id)
      setDeleteLibrarianOpen(false)
      setDeleteTarget(null)
      onNotify('success', 'Librarian deleted successfully')
      await reload()
    } catch (error) {
      onNotify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    try {
      setSubmitting(true)
      await deleteUser(deleteTarget.id)
      setDeleteUserOpen(false)
      setDeleteTarget(null)
      onNotify('success', 'User deleted successfully')
    } catch (error) {
      onNotify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async (newPassword) => {
    if (!targetUser) return
    try {
      setSubmitting(true)
      const result = await resetPassword(targetUser.id, newPassword || undefined)
      setResetResult(result)
      onNotify('success', 'Password reset successfully')
    } catch (error) {
      onNotify('error', error.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="content">
      <div className="page-header">
        <h2>🧩 User Manage</h2>
      </div>

      <div className="search-section">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            className="search-input"
            placeholder="Search by name / email / student ID / staff ID"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
          />
          <select className="search-select" value={query.role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
          <button className="search-btn" type="submit">Search</button>
          <button className="btn-primary" type="button" onClick={openCreateLibrarian}>+ New Librarian</button>
        </form>
      </div>

      <div className="table-section">
        <h3>Unified User List</h3>
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>ID</th>
                  <th>Created At</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((item) => {
                  const currentRole = draftRoles[item.id] || item.role
                  const isSelf = item.id === currentUserId
                  const isLibrarian = item.role === 'LIBRARIAN'
                  const canDeleteByUserApi = USER_DELETE_ROLES.includes(item.role)
                  const canDeleteLibrarian = isLibrarian
                  return (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{item.email}</td>
                      <td>
                        <select
                          className="search-select"
                          style={{ minWidth: 140 }}
                          value={currentRole}
                          disabled={isSelf || submitting}
                          onChange={(e) => setDraftRoles((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        >
                          {ROLE_OPTIONS.map((role) => (
                            <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                          ))}
                        </select>
                      </td>
                      <td>{item.staffId || item.studentId || '-'}</td>
                      <td>{item.createdAt}</td>
                      <td>
                        <div className="user-manage-actions">
                          {isLibrarian ? (
                            <button className="btn-sm user-manage-action-edit" disabled={submitting} onClick={() => openEditLibrarian(item)}>
                              Edit
                            </button>
                          ) : (
                            <span className="user-manage-action-placeholder" aria-hidden="true" />
                          )}
                          <button
                            className="btn-sm"
                            disabled={isSelf || submitting || currentRole === item.role}
                            onClick={() => handleUpdateRole(item)}
                          >
                            Save Role
                          </button>
                          <button className="btn-sm danger" disabled={submitting} onClick={() => openReset(item)}>
                            Reset Password
                          </button>
                          <button
                            className="btn-sm danger"
                            disabled={isSelf || submitting || (!canDeleteByUserApi && !canDeleteLibrarian)}
                            onClick={() => openDelete(item)}
                            title="Delete user"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {data.list.length === 0 && <div className="no-data">No user data</div>}

            <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: 18 }}>
              <span style={{ color: '#718096', fontSize: 13 }}>Total {data.total} records · Page {data.page}/{pageTotal}</span>
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
                  disabled={query.page >= pageTotal}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <LibrarianFormModal
        key={`${formMode}-${targetLibrarian?.id || 'new'}-${formOpen ? 'open' : 'closed'}`}
        open={formOpen}
        mode={formMode}
        librarian={targetLibrarian}
        loading={submitting}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmitLibrarian}
      />

      <ConfirmDeleteModal
        open={deleteLibrarianOpen}
        librarian={deleteTarget}
        loading={submitting}
        onClose={() => setDeleteLibrarianOpen(false)}
        onConfirm={handleDeleteLibrarian}
      />

      <UserDeleteModal
        open={deleteUserOpen}
        user={deleteTarget}
        loading={submitting}
        onClose={() => setDeleteUserOpen(false)}
        onConfirm={handleDeleteUser}
      />

      <ResetPasswordModal
        key={`${targetUser?.id || 'none'}-${resetOpen ? 'open' : 'closed'}`}
        open={resetOpen}
        user={targetUser}
        loading={submitting}
        result={resetResult}
        onClose={() => setResetOpen(false)}
        onSubmit={handleResetPassword}
      />
    </div>
  )
}

export default UserManagement
