import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../services/adminApi'

export function useAcquisitions() {
  const [query, setQuery] = useState({
    page: 1,
    size: 10,
    status: '',
    keyword: ''
  })
  const [data, setData] = useState({ total: 0, page: 1, size: 10, list: [] })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = { page: query.page, size: query.size }
      if (query.status) params.status = query.status
      if (query.keyword.trim()) params.keyword = query.keyword.trim()
      const result = await adminApi.listAcquisitionRequests(params)
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = (status) => {
    setQuery((prev) => ({ ...prev, status, page: 1 }))
  }

  const setKeyword = (keyword) => {
    setQuery((prev) => ({ ...prev, keyword, page: 1 }))
  }

  const setPage = (page) => {
    setQuery((prev) => ({ ...prev, page }))
  }

  const setSize = (size) => {
    setQuery((prev) => ({ ...prev, size, page: 1 }))
  }

  return {
    query,
    data,
    loading,
    setStatus,
    setKeyword,
    setPage,
    setSize,
    reload: load
  }
}
