import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../services/adminApi'

const TABS = {
  borrowing: {
    key: 'borrowing',
    fetch: (month) => adminApi.getMonthlyBorrowingReport(month),
    exportUrl: (month) => adminApi.getBorrowingExportUrl(month)
  },
  overdue: {
    key: 'overdue',
    fetch: (month) => adminApi.getOverdueStatsReport(month),
    exportUrl: (month) => adminApi.getOverdueExportUrl(month)
  },
  usage: {
    key: 'usage',
    fetch: (month) => adminApi.getUsageSummaryReport(month),
    exportUrl: (month) => adminApi.getUsageExportUrl(month)
  }
}

const defaultMonth = () => {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  return `${now.getFullYear()}-${mm}`
}

export function useReports(activeTab) {
  const [month, setMonth] = useState(defaultMonth)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReport = useCallback(async () => {
    const tab = TABS[activeTab]
    if (!tab) return

    try {
      setLoading(true)
      setError(null)
      setData(null)
      const result = await tab.fetch(month)
      setData(result)
    } catch (err) {
      setError(err.message || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }, [activeTab, month])

  useEffect(() => {
    void fetchReport()
  }, [fetchReport])

  const navigateMonth = (direction) => {
    setMonth((prev) => {
      const [y, m] = prev.split('-').map(Number)
      const d = new Date(y, m - 1 + direction, 1)
      const yy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      return `${yy}-${mm}`
    })
  }

  const isCurrentMonth = month >= defaultMonth()

  const exportUrl = TABS[activeTab] ? TABS[activeTab].exportUrl(month) : null

  return {
    month,
    data,
    loading,
    error,
    exportUrl,
    navigateMonth,
    isCurrentMonth,
    refresh: fetchReport
  }
}

export { TABS }
