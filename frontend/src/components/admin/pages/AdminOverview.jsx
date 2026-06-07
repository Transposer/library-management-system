// frontend/src/components/admin/pages/AdminOverview.jsx
import { useDashboard } from '../hooks/useDashboard'
import { ADMIN_PAGES } from '../constants'
import StatCard from '../components/StatCard'
import SimpleBarChart from '../components/SimpleBarChart'

/**
 * Admin Overview Dashboard
 * @param {Object} props
 * @param {Object} props.user - 当前管理员用户
 * @param {Function} props.onNavigate - 页面跳转函数
 */
const AdminOverview = ({ user, onNavigate }) => {
  const {
    overview = {},
    loanTrends = {},
    popularBooks = {},
    recentActivities = {},
    loading,
    error,
    lastUpdated,
    refresh
  } = useDashboard(30)

  const chartData = (loanTrends?.daily || []).map(day => ({
    date: day.date?.slice(5) || '',
    checkouts: day.checkouts || 0,
    returns: day.returns || 0
  }))

  const totalUsers = overview?.totalUsers ?? 0
  const totalBooks = overview?.totalBooks ?? 0
  const activeLoans = overview?.activeLoans ?? 0
  const overdueLoans = overview?.overdueLoans ?? 0

  return (
    <div className="content">
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Welcome, {user.name}!</h2>
          <p>
            Today is{' '}
            {new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long'
            })}
          </p>
        </div>
        <div className="banner-icon">🛡️</div>
      </div>

      {error && (
        <div className="error-banner">
          ⚠️ {error} &nbsp;
          <button onClick={refresh} className="retry-btn">
            Retry
          </button>
        </div>
      )}

      <div className="stats-grid">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon="👥"
          loading={loading}
          variant="blue"
        />
        <StatCard
          title="Total Books"
          value={totalBooks}
          icon="📚"
          loading={loading}
          variant="green"
        />
        <StatCard
          title="Active Loans"
          value={activeLoans}
          icon="📖"
          loading={loading}
          variant="orange"
        />
        <StatCard
          title="Overdue"
          value={overdueLoans}
          icon="⚠️"
          loading={loading}
          variant="red"
        />
      </div>

      <div className="dashboard-two-columns">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>Loan Trends (Last 30 Days)</h3>
            {!loading && (
              <button onClick={refresh} className="refresh-small">
                🔄
              </button>
            )}
          </div>
          <div className="card-content">
            {loading ? (
              <div className="skeleton-chart" />
            ) : (
              <>
                <SimpleBarChart
                  data={chartData}
                  xKey="date"
                  yKey="checkouts"
                  height={180}
                />
                <div className="chart-legend">
                  <span>📘 Checkouts</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="dashboard-card">
          <div className="card-header">
            <h3>🔥 Popular Books</h3>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="skeleton-list" />
            ) : (
              <ol className="popular-list">
                {(popularBooks?.list || []).map((book, idx) => (
                  <li key={book.bookId}>
                    <span className="rank">{idx + 1}.</span>
                    <span className="title">{book.title}</span>
                    <span className="count">{book.loanCount} borrows</span>
                  </li>
                ))}
                {(!popularBooks?.list || popularBooks.list.length === 0) && (
                  <div className="empty-meta">No data yet</div>
                )}
              </ol>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-two-columns">
        <div className="dashboard-card">
          <div className="card-header">
            <h3>📋 Recent Activities</h3>
          </div>
          <div className="card-content">
            {loading ? (
              <div className="skeleton-list" />
            ) : (
              <ul className="activity-list">
                {(recentActivities?.list || []).slice(0, 6).map(act => (
                  <li key={act.id}>
                    <span className="time">
                      {new Date(act.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <span className="action">{act.action}</span>
                    <span className="operator">{act.operator}</span>
                  </li>
                ))}
                {(!recentActivities?.list || recentActivities.list.length === 0) && (
                  <div className="empty-meta">No recent activities</div>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="quick-actions-card">
          <h3>Quick Actions</h3>
          <div className="quick-actions-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <button
              className="quick-action-btn green"
              onClick={() => onNavigate(ADMIN_PAGES.USER_MANAGE)}
              style={{ padding: '24px 20px', fontSize: '15px' }}
            >
              🧩 Users Manage
            </button>
            <button
              className="quick-action-btn blue"
              onClick={() => onNavigate(ADMIN_PAGES.SYSTEM_CONFIG)}
              style={{ padding: '24px 20px', fontSize: '15px' }}
            >
              ⚙️ System Config
            </button>
            <button
              className="quick-action-btn orange"
              onClick={() => onNavigate(ADMIN_PAGES.AUDIT_LOGS)}
              style={{ padding: '24px 20px', fontSize: '15px' }}
            >
              📜 Audit Logs
            </button>
            <button
              className="quick-action-btn purple"
              onClick={() => onNavigate(ADMIN_PAGES.BACKUP_MANAGE)}
              style={{ padding: '24px 20px', fontSize: '15px' }}
            >
              💾 Backup Manage
            </button>
            <button
              className="quick-action-btn blue"
              onClick={() => onNavigate(ADMIN_PAGES.ANNOUNCEMENT_MANAGE)}
              style={{ padding: '24px 20px', fontSize: '15px' }}
            >
              📢 Announcements
            </button>
            <button
              className="quick-action-btn green"
              onClick={() => onNavigate(ADMIN_PAGES.REPORTS)}
              style={{ padding: '24px 20px', fontSize: '15px' }}
            >
              📊 Reports
            </button>
          </div>
        </div>
      </div>

      <div className="refresh-footer">
        <span className="auto-hint">
          {lastUpdated
            ? `Last updated: ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
            : 'Not yet loaded'}
          &nbsp;· Auto-refresh every 30s
        </span>
        <button onClick={refresh} className="refresh-btn" disabled={loading}>
          {loading ? 'Loading...' : '⟳ Refresh All Data'}
        </button>
      </div>

      <style>{`
        .error-banner {
          background: #fee2e2;
          color: #b91c1c;
          padding: 10px 16px;
          border-radius: 12px;
          margin: 20px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .retry-btn {
          background: none;
          border: 1px solid #b91c1c;
          padding: 4px 12px;
          border-radius: 20px;
          cursor: pointer;
        }
        .dashboard-two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        .dashboard-card, .quick-actions-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .refresh-small {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
        }
        .popular-list, .activity-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .popular-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .rank {
          font-weight: bold;
          width: 30px;
        }
        .title {
          flex: 1;
          font-weight: 500;
        }
        .count {
          color: #6b7280;
          font-size: 12px;
        }
        .activity-list li {
          display: flex;
          gap: 16px;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px solid #f5f5f5;
        }
        .time {
          color: #6b7280;
          width: 60px;
        }
        .action {
          flex: 1;
          font-weight: 500;
        }
        .operator {
          color: #4b5563;
        }
        .refresh-footer {
          margin-top: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }
        .refresh-btn {
          background: #4f46e5;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 30px;
          cursor: pointer;
        }
        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auto-hint {
          font-size: 12px;
          color: #9ca3af;
        }
        .skeleton-chart {
          height: 180px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }
        .skeleton-list {
          height: 180px;
          background: #f7f7f7;
          border-radius: 12px;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .empty-meta {
          text-align: center;
          color: #9ca3af;
          padding: 24px 0;
        }
        @media (max-width: 900px) {
          .dashboard-two-columns {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export default AdminOverview
