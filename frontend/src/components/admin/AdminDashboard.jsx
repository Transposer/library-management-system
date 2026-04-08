import React from 'react'

const AdminDashboard = ({ user, stats, books, currentPage, setCurrentPage }) => {
  const renderDashboard = () => (
    <div className="content">
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Welcome, {user.name}!</h2>
          <p>Today is {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <div className="banner-icon">📚</div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📖</div>
          <div className="stat-content">
            <h3>{stats.totalBooks}</h3>
            <p>Total Books</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-content">
            <h3>{stats.availableBooks}</h3>
            <p>Available</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">👥</div>
          <div className="stat-content">
            <h3>100</h3>
            <p>Total Users</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">📋</div>
          <div className="stat-content">
            <h3>25</h3>
            <p>Active Loans</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button className="quick-action-btn blue" onClick={() => setCurrentPage('books')}>🔍 Search Books</button>
          <button className="quick-action-btn green" onClick={() => setCurrentPage('users')}>👥 User Management</button>
          <button className="quick-action-btn orange" onClick={() => setCurrentPage('manage')}>⚙️ Book Management</button>
          <button className="quick-action-btn gray" onClick={() => setCurrentPage('settings')}>⚙️ System Settings</button>
        </div>
      </div>

      <div className="table-section">
        <h3>Recently Added Books</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>ISBN</th>
              <th>Genre</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {books.slice(0, 5).map((book) => (
              <tr key={book.id}>
                <td>{book.title}</td>
                <td>{book.author}</td>
                <td>{book.isbn}</td>
                <td>{book.genre}</td>
                <td>
                  <span className={`status-badge ${book.available ? 'success' : 'danger'}`}>
                    {book.available ? 'Available' : 'Borrowed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {books.length === 0 && <div className="no-data">No data available</div>}
      </div>
    </div>
  )

  const renderBooks = () => (
    <div className="content">
      <div className="page-header">
        <h2>📖 Books</h2>
      </div>
      <div className="books-grid">
        {books.map((book) => (
          <div key={book.id} className="book-card">
            <div className="book-cover">📚</div>
            <div className="book-info">
              <h3>{book.title}</h3>
              <p className="book-author">{book.author}</p>
              <p className="book-detail">ISBN: {book.isbn}</p>
              <p className="book-detail">Genre: {book.genre} | Language: {book.language}</p>
              <div className="book-status">
                <span className={`status-badge ${book.available ? 'success' : 'danger'}`}>
                  {book.available ? 'Available' : 'Borrowed'}
                </span>
              </div>
              {book.available && <button className="borrow-btn">Borrow Now</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderUserManagement = () => (
    <div className="content">
      <div className="page-header">
        <h2>👥 User Management</h2>
      </div>
      <div className="management-section">
        <div className="action-buttons">
          <button className="btn-primary">Add New User</button>
          <button className="btn-secondary">Import Users</button>
        </div>
        <div className="table-section">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Student ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Admin User</td>
                <td>admin@library.com</td>
                <td>Admin</td>
                <td>-</td>
                <td>
                  <button className="btn-sm">Edit</button>
                  <button className="btn-sm danger">Delete</button>
                </td>
              </tr>
              <tr>
                <td>Librarian User</td>
                <td>librarian@library.com</td>
                <td>Librarian</td>
                <td>-</td>
                <td>
                  <button className="btn-sm">Edit</button>
                  <button className="btn-sm danger">Delete</button>
                </td>
              </tr>
              <tr>
                <td>Student One</td>
                <td>student1@library.com</td>
                <td>Student</td>
                <td>S10001</td>
                <td>
                  <button className="btn-sm">Edit</button>
                  <button className="btn-sm danger">Delete</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderSystemSettings = () => (
    <div className="content">
      <div className="page-header">
        <h2>⚙️ System Settings</h2>
      </div>
      <div className="settings-section">
        <div className="settings-card">
          <h3>Library Settings</h3>
          <div className="setting-item">
            <label>Library Name</label>
            <input type="text" defaultValue="University Library" />
          </div>
          <div className="setting-item">
            <label>Loan Period (days)</label>
            <input type="number" defaultValue="14" />
          </div>
          <div className="setting-item">
            <label>Max Loans per User</label>
            <input type="number" defaultValue="5" />
          </div>
          <button className="btn-primary">Save Settings</button>
        </div>
      </div>
    </div>
  )

  switch (currentPage) {
    case 'dashboard':
      return renderDashboard()
    case 'books':
      return renderBooks()
    case 'users':
      return renderUserManagement()
    case 'settings':
      return renderSystemSettings()
    default:
      return <div className="content"><div className="page-header"><h2>Under development...</h2></div></div>
  }
}

export default AdminDashboard