import React from 'react'

const LibrarianDashboard = ({ user, stats, books, currentPage, setCurrentPage }) => {
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
          <div className="stat-icon orange">📋</div>
          <div className="stat-content">
            <h3>{stats.myLoans}</h3>
            <p>Active Loans</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">⏳</div>
          <div className="stat-content">
            <h3>{stats.pendingHolds}</h3>
            <p>Pending Holds</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button className="quick-action-btn blue" onClick={() => setCurrentPage('books')}>🔍 Search Books</button>
          <button className="quick-action-btn green" onClick={() => setCurrentPage('loans')}>📋 Manage Loans</button>
          <button className="quick-action-btn orange" onClick={() => setCurrentPage('manage')}>⚙️ Book Management</button>
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

  const renderManageBooks = () => (
    <div className="content">
      <div className="page-header">
        <h2>⚙️ Book Management</h2>
      </div>
      <div className="management-section">
        <div className="action-buttons">
          <button className="btn-primary">Add New Book</button>
          <button className="btn-secondary">Import Books</button>
        </div>
        <div className="table-section">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>ISBN</th>
                <th>Available</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.id}>
                  <td>{book.title}</td>
                  <td>{book.author}</td>
                  <td>{book.isbn}</td>
                  <td>
                    <span className={`status-badge ${book.available ? 'success' : 'danger'}`}>
                      {book.available ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td>
                    <button className="btn-sm">Edit</button>
                    <button className="btn-sm danger">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderLoanManagement = () => (
    <div className="content">
      <div className="page-header">
        <h2>🔄 Loan Management</h2>
      </div>
      <div className="table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th>Book Title</th>
              <th>User</th>
              <th>Checkout Date</th>
              <th>Due Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan="6" className="no-data">No loan records</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )

  switch (currentPage) {
    case 'dashboard':
      return renderDashboard()
    case 'books':
      return renderBooks()
    case 'manage':
      return renderManageBooks()
    case 'loans-manage':
      return renderLoanManagement()
    default:
      return <div className="content"><div className="page-header"><h2>Under development...</h2></div></div>
  }
}

export default LibrarianDashboard