// frontend/src/components/admin/components/StatCard.jsx
export default function StatCard({ title, value, icon, loading, trend, variant = 'blue' }) {
  const variantColors = {
    blue: 'stat-icon blue',
    green: 'stat-icon green',
    orange: 'stat-icon orange',
    red: 'stat-icon red'
  }

  return (
    <div className="stat-card">
      <div className={variantColors[variant] || 'stat-icon blue'}>
        {icon}
      </div>
      <div className="stat-content">
        <h3>{loading ? '-' : value?.toLocaleString?.() ?? value ?? 0}</h3>
        <p>{title}</p>
        {trend && <small className="trend">{trend}</small>}
      </div>
    </div>
  )
}
