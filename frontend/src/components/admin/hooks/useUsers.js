import { useCallback, useEffect, useState } from 'react'
import { PAGE_SIZE } from '../constants'
import { adminApi } from '../services/adminApi'

export function useUsers() {
  const [query, setQuery] = useState({ page: 1, size: PAGE_SIZE, role: '', keyword: '' })
  const [data, setData] = useState({ total: 0, page: 1, size: PAGE_SIZE, list: [] })
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await adminApi.listUsers(query)
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  const setRole = (role) => {
    setQuery((prev) => ({ ...prev, role, page: 1 }))
  }

  const setKeyword = (keyword) => {
    setQuery((prev) => ({ ...prev, keyword, page: 1 }))
  }

  const setPage = (page) => {
    setQuery((prev) => ({ ...prev, page }))
  }

  const updateRole = async (id, role) => {
    await adminApi.updateUserRole(id, role)
    await load()
  }

  const deleteUser = async (id) => {
    await adminApi.deleteUser(id)
    if (data.list.length === 1 && query.page > 1) {
      setQuery((prev) => ({ ...prev, page: prev.page - 1 }))
      return
    }
    await load()
  }

  const resetPassword = async (id, newPassword) => {
    return adminApi.resetUserPassword(id, newPassword)
  }

  return {
    query,
    data,
    loading,
    setRole,
    setKeyword,
    setPage,
    updateRole,
    deleteUser,
    resetPassword,
    reload: load
  }
}
