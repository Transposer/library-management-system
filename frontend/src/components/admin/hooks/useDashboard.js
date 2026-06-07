// frontend/src/components/admin/hooks/useDashboard.js

/**
 * @typedef {Object} OverviewStats
 * @property {number} totalUsers
 * @property {number} totalBooks
 * @property {number} availableBooks
 * @property {number} borrowedBooks
 * @property {number} activeLoans
 * @property {number} overdueLoans
 * @property {number} todayCheckouts
 * @property {number} todayReturns
 * @property {number} pendingHolds
 * @property {number} readyHolds
 * @property {number} totalFinesUnpaid
 * @property {number} monthRevenue
 * @property {Object} usersByRole
 * @property {number} usersByRole.students
 * @property {number} usersByRole.librarians
 * @property {number} usersByRole.admins
 */

/**
 * @typedef {Object} LoanTrends
 * @property {Array<{date: string, checkouts: number, returns: number}>} daily
 */

/**
 * @typedef {Object} PopularBooks
 * @property {Array<{rank: number, bookId: string, title: string, author: string, isbn: string, loanCount: number}>} list
 */

/**
 * @typedef {Object} RecentActivities
 * @property {Array<{id: string, operator: string, action: string, entity: string, entityId: string, createdAt: string}>} list
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi } from '../services/adminApi'

/**
 * 获取管理员仪表盘数据（含自动刷新）
 * @param {number} autoRefreshSeconds - 自动刷新间隔（秒），默认 30，设为 0 则禁用
 * @returns {{
 *   overview: OverviewStats | null,
 *   loanTrends: LoanTrends | null,
 *   popularBooks: PopularBooks | null,
 *   recentActivities: RecentActivities | null,
 *   loading: boolean,
 *   error: string | null,
 *   lastUpdated: Date | null,
 *   refresh: () => void
 * }}
 */
export function useDashboard(autoRefreshSeconds = 30) {
  const [overview, setOverview] = useState(null)
  const [loanTrends, setLoanTrends] = useState(null)
  const [popularBooks, setPopularBooks] = useState(null)
  const [recentActivities, setRecentActivities] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const intervalIdRef = useRef(null)
  const fetchingRef = useRef(false)

  const fetchAll = useCallback(async () => {
    if (fetchingRef.current) return
    fetchingRef.current = true

    try {
      setError(null)
      const [overviewData, trendsData, popularData, activitiesData] = await Promise.all([
        adminApi.getDashboardOverview(),
        adminApi.getLoanTrends('30d'),
        adminApi.getPopularBooks(10),
        adminApi.getRecentActivities(20)
      ])
      setOverview(overviewData)
      setLoanTrends(trendsData)
      setPopularBooks(popularData)
      setRecentActivities(activitiesData)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data')
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, [])

  const refresh = useCallback(() => {
    if (!loading && !fetchingRef.current) {
      setLoading(true)
      void fetchAll()
    }
  }, [fetchAll, loading])

  useEffect(() => {
    void fetchAll()

    if (autoRefreshSeconds > 0) {
      intervalIdRef.current = setInterval(() => {
        if (!fetchingRef.current) {
          void fetchAll()
        }
      }, autoRefreshSeconds * 1000)
    }

    return () => {
      if (intervalIdRef.current) {
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
      }
    }
  }, [fetchAll, autoRefreshSeconds])

  return {
    overview,
    loanTrends,
    popularBooks,
    recentActivities,
    loading,
    error,
    lastUpdated,
    refresh
  }
}
