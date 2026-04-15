import { useEffect, useState } from 'react'
import { ADMIN_PAGES } from '../constants'
import { adminApi } from '../services/adminApi'

const AdminOverview = ({ user, onNavigate }) => {
  const [summary, setSummary] = useState({ librarians: 0, users: 0, admins: 0, students: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    const loadSummary = async () => {
      setLoading(true)
      try {
        const [librarians, users, admins, students] = await Promise.all([
          adminApi.listLibrarians({ page: 1, size: 1 }),
          adminApi.listUsers({ page: 1, size: 1 }),
          adminApi.listUsers({ page: 1, size: 1, role: 'ADMIN' }),
          adminApi.listUsers({ page: 1, size: 1, role: 'STUDENT' })
        ])

        if (!active) return
        setSummary({
          librarians: librarians.total || 0,
          users: users.total || 0,
          admins: admins.total || 0,
          students: students.total || 0
        })
      } catch {
        if (!active) return
        setSummary({ librarians: 0, users: 0, admins: 0, students: 0 })
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSummary()

    return () => {
      active = false
    }
  }, [])

  return (
    <div className="content">
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Welcome, {user.name}!</h2>
          <p>Today is {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <div className="banner-icon">🛡️</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">👥</div>
          <div className="stat-content">
            <h3>{loading ? '-' : summary.users}</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">📚</div>
          <div className="stat-content">
            <h3>{loading ? '-' : summary.librarians}</h3>
            <p>Librarians</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">🎓</div>
          <div className="stat-content">
            <h3>{loading ? '-' : summary.students}</h3>
            <p>Students</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">🔐</div>
          <div className="stat-content">
            <h3>{loading ? '-' : summary.admins}</h3>
            <p>Admins</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button className="quick-action-btn green" onClick={() => onNavigate(ADMIN_PAGES.USER_MANAGE)}>🧩 Users Manage</button>
          <button className="quick-action-btn gray" onClick={() => onNavigate(ADMIN_PAGES.OVERVIEW)}>🏠 Back to Overview</button>
        </div>
      </div>
    </div>
  )
}

export default AdminOverview
