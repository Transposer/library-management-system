import { useEffect, useMemo, useState } from 'react'
import AdminMessageBar from './components/AdminMessageBar'
import { ADMIN_PAGES } from './constants'
import AdminOverview from './pages/AdminOverview'
import UserManagement from './pages/UserManagement'

const PAGE_NAME = {
  [ADMIN_PAGES.OVERVIEW]: 'Overview',
  [ADMIN_PAGES.USER_MANAGE]: 'User Manage'
}

const AdminDashboard = ({ user, handleLogout, getRoleName }) => {
  const [currentPage, setCurrentPage] = useState(ADMIN_PAGES.OVERVIEW)
  const [message, setMessage] = useState({ type: '', text: '' })

  const currentUserId = useMemo(() => user.id || user.userId, [user.id, user.userId])

  useEffect(() => {
    if (!message.text) return
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000)
    return () => clearTimeout(timer)
  }, [message])

  const notify = (type, text) => setMessage({ type, text })

  const renderPage = () => {
    switch (currentPage) {
      case ADMIN_PAGES.USER_MANAGE:
        return <UserManagement currentUserId={currentUserId} onNotify={notify} />
      case ADMIN_PAGES.OVERVIEW:
      default:
        return <AdminOverview user={user} onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="dashboard-container">
      <aside className="sidebar">
        <nav className="sidebar-menu">
          <div className="menu-item-header">📚 Library Admin</div>
          <div className={`menu-item ${currentPage === ADMIN_PAGES.OVERVIEW ? 'active' : ''}`} onClick={() => setCurrentPage(ADMIN_PAGES.OVERVIEW)}>
            <span className="icon">🏠</span>
            <span>Overview</span>
          </div>
          <div className={`menu-item ${currentPage === ADMIN_PAGES.USER_MANAGE ? 'active' : ''}`} onClick={() => setCurrentPage(ADMIN_PAGES.USER_MANAGE)}>
            <span className="icon">🧩</span>
            <span>User Manage</span>
          </div>
        </nav>
        <div className="user-info">
          <div className="user-avatar">{user.name?.[0]?.toUpperCase() || 'A'}</div>
          <div className="user-details">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{getRoleName(user.role)}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>Logout</button>
      </aside>

      <main className="main-content">
        <header className="top-nav">
          <span className="breadcrumb">Admin / {PAGE_NAME[currentPage]}</span>
          <div className="top-user">
            <span className="top-user-name">{user.name}</span>
            <span className="role-badge">{getRoleName(user.role)}</span>
          </div>
        </header>

        <div style={{ padding: '0 28px' }}>
          <AdminMessageBar message={message} />
        </div>
        {renderPage()}
      </main>
    </div>
  )
}

export default AdminDashboard
