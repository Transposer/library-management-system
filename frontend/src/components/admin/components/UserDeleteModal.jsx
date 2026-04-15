 const ROLE_TEXT = {
  STUDENT: 'Reader',
  ADMIN: 'Admin'
}

const UserDeleteModal = ({ open, user, loading, onClose, onConfirm }) => {
  if (!open || !user) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Delete User</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to delete <strong>{user.name}</strong> ({ROLE_TEXT[user.role] || user.role})?
          </p>
          <p className="warning-text">This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default UserDeleteModal
