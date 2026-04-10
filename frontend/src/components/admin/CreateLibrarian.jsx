// 创建馆员组件
import { useState } from 'react'

const API_BASE = '/api'

const CreateLibrarian = ({ onBack }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    staffId: ''
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [messageType, setMessageType] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
    setMessage(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch(`${API_BASE}/admin/librarians`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (res.ok) {
        setMessage({ text: 'Librarian created successfully!', type: 'success' })
        setFormData({ name: '', email: '', password: '', staffId: '' })
      } else {
        setMessage({ text: data.message || 'Failed to create librarian', type: 'error' })
      }
    } catch (err) {
      setMessage({ text: 'Error: ' + err.message, type: 'error' })
    }

    setLoading(false)
  }

  return (
    <div className="content">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">👤 Create Librarian</h2>
        {onBack && (
          <button
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            onClick={onBack}
          >
            ← Back
          </button>
        )}
      </div>

      <div className="max-w-md mx-auto bg-white p-6 rounded-lg shadow-md">
        {message && (
          <div className={`p-3 rounded mb-4 ${message.type === 'success' ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-1">Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="Enter librarian name"
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-1">Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="e.g., alice@library.com"
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-1">Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="Enter password "
            />
          </div>

          <div className="mb-4">
            <label className="block font-medium text-gray-700 mb-1">Staff ID *</label>
            <input
              type="text"
              name="staffId"
              value={formData.staffId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="e.g., L10001"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2 px-4 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
            disabled={loading}
          >
            {loading ? 'Creating...' : '✓ Create Librarian'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default CreateLibrarian