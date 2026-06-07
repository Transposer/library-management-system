import { useState, useEffect } from 'react'

const API_BASE = '/api'

const ReaderDashboard = ({ user, stats, books, loans, currentPage, setCurrentPage, onRefreshStats }) => {
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchExecuted, setSearchExecuted] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedBook, setSelectedBook] = useState(null)
  const [bookDetail, setBookDetail] = useState(null)
  const [borrowLoading, setBorrowLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  // 图书列表分页状态
  const [allBooks, setAllBooks] = useState([])
  const [allBooksLoading, setAllBooksLoading] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, size: 10, total: 0 })

  // 历史借阅记录状态
  const [loanHistory, setLoanHistory] = useState([])
  const [loanHistoryLoading, setLoanHistoryLoading] = useState(false)
  const [loanHistoryPagination, setLoanHistoryPagination] = useState({ page: 1, size: 10, total: 0 })

  // 预约状态
  const [holds, setHolds] = useState([])
  const [holdsLoading, setHoldsLoading] = useState(false)
  const [holdStatusFilter, setHoldStatusFilter] = useState('')

  // 心愿单状态
  const [wishlist, setWishlist] = useState([])
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [wishlistPagination, setWishlistPagination] = useState({ page: 1, size: 10, total: 0 })

  // 罚款状态
  const [fines, setFines] = useState([])
  const [finesLoading, setFinesLoading] = useState(false)

  // 续借状态
  const [renewLoading, setRenewLoading] = useState(false)
  const [returnLoading, setReturnLoading] = useState(false)

  // 预约状态
  const [holdLoading, setHoldLoading] = useState(false)

  // 心愿单状态
  const [wishlistAddLoading, setWishlistAddLoading] = useState(false)

  // 评分状态
  const [ratingLoading, setRatingLoading] = useState(false)
  const [userRating, setUserRating] = useState(null)

  // 罚款支付状态
  const [payFineLoading, setPayFineLoading] = useState(false)
  const [selectedFine, setSelectedFine] = useState(null)

  // 还书状态
  const [returnBarcode, setReturnBarcode] = useState('')
  const [returnBarcodeLoading, setReturnBarcodeLoading] = useState(false)
  const [returnResult, setReturnResult] = useState(null)

  // 个人中心状态
  const [profile, setProfile] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', studentId: '' })
  const [profileLoading, setProfileLoading] = useState(false)


  // 个人仪表盘状态与请求逻辑
  const [dashData, setDashData] = useState({
    expiringSoon: 0,
    overdue: 0,
    holds: 0
  });
  const [dashLoading, setDashLoading] = useState(false);

  useEffect(() => {
    if (currentPage === 'dashboard') {
      const fetchDash = async () => {
        setDashLoading(true);
        try {
          const token = localStorage.getItem('token');
          const res = await fetch(`${API_BASE}/dashboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.code === 200) {
            const now = new Date();
            const sevenDaysLater = new Date();
            sevenDaysLater.setDate(now.getDate() + 7);

            let expiring = 0;
            let overdue = 0;

            (data.data?.currentLoans || []).forEach(loan => {
              const dueDate = new Date(loan.dueDate);
              if (dueDate < now) {
                overdue++;
              } else if (dueDate <= sevenDaysLater) {
                expiring++;
              }
            });

            setDashData({
              expiringSoon: expiring,
              overdue: overdue,
              holds: data.data?.holdsCount || 0
            });
          }
        } catch (err) {
          console.error("Dashboard fetch error:", err);
        }
        setDashLoading(false);
      };
      fetchDash();
    }
  }, [currentPage]);

  // 公告与新书状态 (3.1 & 3.3)
  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null); // 用于公告详情页

  const [newBooks, setNewBooks] = useState([]);
  const [newBooksLoading, setNewBooksLoading] = useState(false);

  // 获取公告列表
  const fetchAnnouncements = async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/announcements`);
      const data = await res.json();
      if (data.code === 200) {
        setAnnouncements(data.data.list || []);
      }
    } catch (err) {
      console.error("Fetch announcements error:", err);
    }
    setAnnouncementsLoading(false);
  };

  // 获取新书通报 (1个月内上架)
  const fetchNewBooks = async () => {
    setNewBooksLoading(true);
    try {
      const res = await fetch(`${API_BASE}/books/new`);
      const data = await res.json();
      if (data.code === 200) {
        setNewBooks(data.data.list || []);
      }
    } catch (err) {
      console.error("Fetch new books error:", err);
    }
    setNewBooksLoading(false);
  };

  // 监听页面切换，自动加载数据
  useEffect(() => {
    if (currentPage === 'announcements') fetchAnnouncements();
    if (currentPage === 'new-books') fetchNewBooks();
  }, [currentPage]);

  // 搜索筛选状态
  const [genreFilter, setGenreFilter] = useState('')
  const [languageFilter, setLanguageFilter] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  // 获取所有图书列表（分页）
  const fetchAllBooks = async (page = 1, size = 10) => {
    setAllBooksLoading(true)
    try {
      const res = await fetch(`${API_BASE}/books?page=${page}&size=${size}`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      if (data.code === 200) {
        setAllBooks(data.data?.list || [])
        setPagination({
          page: data.data?.page || page,
          size: data.data?.size || size,
          total: data.data?.total || 0
        })
      } else {
        showMessage('error', data.message || 'Failed to fetch book list')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setAllBooksLoading(false)
  }

  // 当进入图书页面时自动加载
  useEffect(() => {
    if (currentPage === 'books') {
      fetchAllBooks(pagination.page, pagination.size)
    }
  }, [currentPage])


  // 资源荐购申请 (US 3.2)
  const [acquisitions, setAcquisitions] = useState([]);
  const [acquisitionsLoading, setAcquisitionsLoading] = useState(false);
  const [acqForm, setAcqForm] = useState({ title: '', author: '', isbn: '', reason: '' });
  const [acqSubmitLoading, setAcqSubmitLoading] = useState(false);
  const [acqLookupLoading, setAcqLookupLoading] = useState(false);
  const [acqStatusFilter, setAcqStatusFilter] = useState('');

  // 获取荐购记录
  const fetchAcquisitions = async (status = '') => {
    setAcquisitionsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = status ? `${API_BASE}/acquisition-requests?status=${status}` : `${API_BASE}/acquisition-requests`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (data.code === 200) {
        setAcquisitions(data.data?.list || []);
      }
    } catch (err) {
      console.error("Fetch acquisitions error:", err);
    }
    setAcquisitionsLoading(false);
  };

  const handleAcqLookupIsbn = async (isbn) => {
    const normalizedIsbn = isbn.trim();
    if (!normalizedIsbn || normalizedIsbn.length < 10) {
      showMessage('error', 'Please enter a valid ISBN (at least 10 characters)');
      return null;
    }

    setAcqLookupLoading(true);
    try {
      const res = await fetch(`${API_BASE}/books/scrape?isbn=${encodeURIComponent(normalizedIsbn)}`);
      const data = await res.json();

      if (res.ok && data.code === 200 && data.data?.title) {
        const bookInfo = {
          title: data.data.title || '',
          author: data.data.author || ''
        };
        setAcqForm((prev) => ({
          ...prev,
          isbn: normalizedIsbn,
          title: bookInfo.title,
          author: bookInfo.author
        }));
        showMessage('success', 'Book information has been auto-filled');
        return bookInfo;
      }

      showMessage('error', data.message || 'Unable to find book information for this ISBN');
      return null;
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message);
      return null;
    } finally {
      setAcqLookupLoading(false);
    }
  };

  // 提交荐购申请
  const handleAcqSubmit = async (e) => {
    e.preventDefault();
    if (!acqForm.isbn.trim()) {
      showMessage('error', 'ISBN is required');
      return;
    }

    let title = acqForm.title.trim();
    let author = acqForm.author.trim();
    if (!title) {
      const bookInfo = await handleAcqLookupIsbn(acqForm.isbn);
      if (!bookInfo?.title) {
        return;
      }

      title = bookInfo.title.trim();
      author = bookInfo.author.trim();
    }

    if (!title) {
      showMessage('error', 'Unable to submit without a valid ISBN lookup result');
      return;
    }

    setAcqSubmitLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/acquisition-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...acqForm,
          title,
          author
        })
      });
      const data = await res.json();
      if (res.ok && data.code === 200) {
        showMessage('success', 'Recommendation submitted successfully!');
        setAcqForm({ title: '', author: '', isbn: '', reason: '' }); // 清空表单
        fetchAcquisitions(acqStatusFilter); // 刷新列表
      } else {
        showMessage('error', data.message || 'Failed to submit recommendation');
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message);
    }
    setAcqSubmitLoading(false);
  };

  // 监听页面切换自动加载数据
  useEffect(() => {
    if (currentPage === 'recommend') fetchAcquisitions(acqStatusFilter);
  }, [currentPage]);

  //  借阅排行榜 (3.5)
  const [rankings, setRankings] = useState([]);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [rankingPeriod, setRankingPeriod] = useState('month'); // 默认本月

  // 获取排行榜数据
  const fetchRankings = async (period = 'month') => {
    setRankingsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // 强行对齐产品需求，传递 month, 3months, year
      const res = await fetch(`${API_BASE}/books/ranking?period=${period}&limit=10`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code === 200) {
        setRankings(data.data?.list || []);
      }
    } catch (err) {
      console.error("Fetch rankings error:", err);
    }
    setRankingsLoading(false);
  };

  // 监听页面切换自动加载数据
  useEffect(() => {
    if (currentPage === 'ranking') fetchRankings(rankingPeriod);
  }, [currentPage]);

  useEffect(() => {
    if (currentPage === 'fines') fetchFines();
  }, [currentPage]);

  // Show message
  const showMessage = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  // Search books (1.3, 1.4, 2.3)
  const handleSearch = async (e) => {
    e.preventDefault()

    setSearchLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', '1')
      params.append('size', '10')
      if (searchKeyword.trim()) {
        params.append('keyword', searchKeyword.trim())
      }
      if (genreFilter) {
        params.append('genre', genreFilter)
      }
      if (languageFilter) {
        params.append('language', languageFilter)
      }
      if (availabilityFilter) {
        params.append('available', availabilityFilter)
      }
      if (sortBy) {
        params.append('sortBy', sortBy)
      }
      if (sortOrder) {
        params.append('sortOrder', sortOrder)
      }

      const res = await fetch(`${API_BASE}/books/filter?${params}`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      if (data.code === 200) {
        setSearchResults(data.data?.list || [])
        setSearchExecuted(true)
      } else {
        showMessage('error', data.message || 'Search failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setSearchLoading(false)
  }

  // 分页控制
  const handlePageChange = (newPage) => {
    if (newPage < 1) return
    const maxPage = Math.ceil(pagination.total / pagination.size)
    if (newPage > maxPage) return
    fetchAllBooks(newPage, pagination.size)
  }

  // View book detail (1.5)
  const handleViewDetail = async (bookId) => {
    try {
      const res = await fetch(`${API_BASE}/books/${bookId}`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      if (data.code === 200) {
        setBookDetail(data.data)
        setSelectedBook(bookId)
        // Reset user rating for new book
        setUserRating(null)
        // Try to get user's rating for this book
        const token = localStorage.getItem('token')
        if (token) {
          // Assuming we can get user rating from book detail or separate endpoint
          // For now, we'll set it if available in book data
        }
      } else {
        showMessage('error', data.message || 'Failed to get book details')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
  }

  // Borrow book (1.9)
  const handleBorrow = async (bookId) => {
    setBorrowLoading(true)
    const token = localStorage.getItem('token')
    if (!token) {
      showMessage('error', 'Please login first')
      setBorrowLoading(false)
      return
    }

    try {
      const res = await fetch(`${API_BASE}/loans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookId })
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        const errorMessage = data?.message || `HTTP error! status: ${res.status}`
        showMessage('error', errorMessage)
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
        return
      }

      if (data && data.code === 200) {
        showMessage('success', `Borrowed successfully! Due date: ${new Date(data.data.dueDate).toLocaleDateString('en-US')}`)
        onRefreshStats && onRefreshStats()
        // Refresh book detail
        if (bookDetail) handleViewDetail(bookId)
      } else {
        showMessage('error', data?.message || 'Borrow failed')
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    } finally {
      setBorrowLoading(false)
    }
  }

  // Get profile (1.8)
  const fetchProfile = async () => {
    setProfileLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      if (data.code === 200) {
        setProfile(data.data)
        setEditForm({ name: data.data.name, studentId: data.data.studentId || '' })
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err)
    }
    setProfileLoading(false)
  }

  // Fetch loan history
  const fetchLoanHistory = async (page = 1, size = 10) => {
    setLoanHistoryLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/loans/history?page=${page}&size=${size}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      if (data.code === 200) {
        setLoanHistory(data.data?.list || [])
        setLoanHistoryPagination({
          page: data.data?.page || page,
          size: data.data?.size || size,
          total: data.data?.total || 0
        })
      } else {
        showMessage('error', data.message || 'Failed to fetch loan history')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setLoanHistoryLoading(false)
  }

  const refreshLoanStatusViews = (page = loanHistoryPagination.page || 1, size = loanHistoryPagination.size || 10) => {
    fetchLoanHistory(page, size)
    fetchFines()
    onRefreshStats && onRefreshStats()
  }

  // Renew loan
  const handleRenew = async (loanId) => {
    setRenewLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/loans/${loanId}/renew`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', `Renewed successfully! New due date: ${new Date(data.data.dueDate).toLocaleDateString('en-US')}`)
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
      } else {
        showMessage('error', data.message || 'Renew failed')
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setRenewLoading(false)
  }

  // Return loan
  const handleReturn = async (loanId) => {
    setReturnLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/loans/${loanId}/return`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', `Book returned successfully! ${data.data.fineAmount > 0 ? `Fine: $${data.data.fineAmount}` : ''}`)
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
      } else {
        showMessage('error', data.message || 'Return failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setReturnLoading(false)
  }

  // Return book by barcode
  const handleReturnByBarcode = async (e) => {
    e.preventDefault()
    if (!returnBarcode.trim()) {
      showMessage('error', 'Please enter a barcode')
      return
    }
    setReturnBarcodeLoading(true)
    setReturnResult(null)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/loans/return-by-barcode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ barcode: returnBarcode.trim() })
      })
      const data = await res.json()
      if (res.ok) {
        setReturnResult({
          success: true,
          bookTitle: data.data.bookTitle,
          returnDate: data.data.returnDate,
          fineAmount: data.data.fineAmount
        })
        setReturnBarcode('')
        showMessage('success', `Book returned successfully!${data.data.fineAmount > 0 ? ` Fine: $${data.data.fineAmount}` : ''}`)
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
      } else {
        setReturnResult({ success: false, message: data.message || 'Return failed' })
        showMessage('error', data.message || 'Return failed')
      }
    } catch (err) {
      setReturnResult({ success: false, message: 'Network error: ' + err.message })
      showMessage('error', 'Network error: ' + err.message)
    }
    setReturnBarcodeLoading(false)
  }

  // Fetch holds
  const fetchHolds = async (status = '') => {
    setHoldsLoading(true)
    const token = localStorage.getItem('token')
    const url = status ? `${API_BASE}/holds?status=${status}` : `${API_BASE}/holds`
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const data = await res.json()
      if (data.code === 200) {
        setHolds(data.data?.list || [])
      } else {
        showMessage('error', data.message || 'Failed to fetch holds')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setHoldsLoading(false)
  }

  // Cancel hold
  const handleCancelHold = async (holdId) => {
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/holds/${holdId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Hold cancelled successfully')
        fetchHolds(holdStatusFilter)
        onRefreshStats && onRefreshStats()
      } else {
        showMessage('error', data.message || 'Cancel failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
  }

  // Fetch wishlist
  const fetchWishlist = async (page = 1, size = 10) => {
    setWishlistLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/wishlist?page=${page}&size=${size}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        setWishlist(data.data?.list || [])
        setWishlistPagination({
          page: data.data?.page || page,
          size: data.data?.size || size,
          total: data.data?.total || 0
        })
      } else {
        showMessage('error', data.message || 'Failed to fetch wishlist')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setWishlistLoading(false)
  }

  // Add to wishlist
  const handleAddToWishlist = async (bookId) => {
    setWishlistAddLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/wishlist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookId })
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Added to wishlist successfully')
      } else {
        showMessage('error', data.message || 'Add to wishlist failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setWishlistAddLoading(false)
  }

  // Remove from wishlist
  const handleRemoveFromWishlist = async (wishlistId) => {
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/wishlist/${wishlistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Removed from wishlist successfully')
        fetchWishlist(wishlistPagination.page, wishlistPagination.size)
      } else {
        showMessage('error', data.message || 'Remove failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
  }

  // Rate book
  const handleRateBook = async (bookId, stars) => {
    setRatingLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/books/${bookId}/rating`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ stars })
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Rating submitted successfully')
        setUserRating(stars)
        // Refresh book detail
        if (bookDetail) handleViewDetail(bookId)
      } else {
        showMessage('error', data.message || 'Rating failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setRatingLoading(false)
  }

  // Hold book
  const handleHoldBook = async (bookId) => {
    setHoldLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/holds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookId })
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Book held successfully')
        onRefreshStats && onRefreshStats()
        // Refresh book detail
        if (bookDetail) handleViewDetail(bookId)
      } else {
        showMessage('error', data.message || 'Hold failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setHoldLoading(false)
  }

  // Fetch fines
  const fetchFines = async () => {
    setFinesLoading(true)
    const token = localStorage.getItem('token')
    try {
      // Only show unpaid fines after the book has been returned.
      const historyRes = await fetch(`${API_BASE}/loans/history?page=1&size=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const historyData = await historyRes.json()
      if (historyRes.ok) {
        const returnedUnpaidLoans = (historyData.data?.list || []).filter(
          (loan) => loan.status === 'Returned' && Number(loan.fineAmount || 0) > 0 && loan.finePaid === false
        )
        setFines(returnedUnpaidLoans)
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setFinesLoading(false)
  }

  // Pay fine
  const handleOpenFinePayment = (fine) => {
    setSelectedFine(fine)
  }

  const handleCloseFinePayment = () => {
    if (!payFineLoading) {
      setSelectedFine(null)
    }
  }

  const handlePayFine = async (fine) => {
    setPayFineLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/loans/${fine.id}/pay-fine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: Number(fine.fineAmount) })
      })
      const data = await res.json()
      if (res.ok) {
        showMessage('success', 'Fine paid successfully')
        setSelectedFine(null)
        refreshLoanStatusViews(loanHistoryPagination.page, loanHistoryPagination.size)
      } else {
        showMessage('error', data.message || 'Payment failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setPayFineLoading(false)
  }

  // Update profile (1.8)
  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim()) {
      showMessage('error', 'Name is required')
      return
    }

    setProfileLoading(true)
    const token = localStorage.getItem('token')
    try {
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      })
      const data = await res.json()
      if (res.ok) {
        setProfile(data.data)
        setEditMode(false)
        showMessage('success', 'Profile updated successfully')
      } else {
        showMessage('error', data.message || 'Update failed')
      }
    } catch (err) {
      showMessage('error', 'Network error: ' + err.message)
    }
    setProfileLoading(false)
  }

  // Render Dashboard
  const renderDashboard = () => (
      <div className="content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>Welcome back, {user.name}!</h2>
            <p>Here is your account summary.</p>
          </div>
          <div className="banner-icon">📚</div>
        </div>

        {dashLoading ? (
            <div className="loading">Loading dashboard...</div>
        ) : (
            <div className="stats-grid">
              <div className="stat-card" onClick={() => setCurrentPage('loans')} style={{cursor: 'pointer'}}>
                <div className="stat-icon blue">📋</div>
                <div className="stat-content">
                  <h3>{stats.myLoans}</h3>
                  <p>Current Loans</p>
                </div>
              </div>

              <div className="stat-card" onClick={() => setCurrentPage('loans')} style={{cursor: 'pointer'}}>
                <div className="stat-icon orange">⏳</div>
                <div className="stat-content">
                  <h3>{dashData.expiringSoon}</h3>
                  <p>Expiring Soon (7 Days)</p>
                </div>
              </div>

              <div className="stat-card" onClick={() => setCurrentPage('fines')} style={{cursor: 'pointer'}}>
                <div className="stat-icon danger" style={{ backgroundColor: '#fee2e2', color: '#ef4444' }}>⚠️</div>
                <div className="stat-content">
                  <h3>{dashData.overdue}</h3>
                  <p>Overdue Books</p>
                </div>
              </div>

              <div className="stat-card" onClick={() => setCurrentPage('holds')} style={{cursor: 'pointer'}}>
                <div className="stat-icon purple">📌</div>
                <div className="stat-content">
                  <h3>{dashData.holds}</h3>
                  <p>Active Holds</p>
                </div>
              </div>
            </div>
        )}

        <div className="table-section" style={{ marginTop: '30px' }}>
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

  // Render Books Search (1.3, 1.4, 1.5)
  const renderBooks = () => (
    <div className="content">
      <div className="page-header">
        <h2>📖 Books</h2>
      </div>

      {/* Search Form */}
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            placeholder="Enter title or author..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-btn" disabled={searchLoading}>
            {searchLoading ? 'Searching...' : '🔍 Search'}
          </button>
        </form>

        {/* Filters and Sort */}
        <div className="filters-section">
          <div className="filter-group">
            <label>Genre:</label>
            <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)}>
              <option value="">All Genres</option>
              <option value="Technology">Technology</option>
              <option value="Fiction">Fiction</option>
              <option value="Science">Science</option>
              <option value="History">History</option>
              <option value="Management">Management</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Language:</label>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="">All Languages</option>
              <option value="Chinese">Chinese</option>
              <option value="English">English</option>
              <option value="Others">Others</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Availability:</label>
            <select value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value)}>
              <option value="">All</option>
              <option value="true">Available</option>
              <option value="false">Borrowed</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="createdAt">Date Added</option>
              <option value="rating">Rating</option>
              <option value="title">Title</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Order:</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Message */}
      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Book Detail Modal */}
      {bookDetail && selectedBook && (
        <div className="modal-overlay book-detail-modal" onClick={() => { setSelectedBook(null); setBookDetail(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => { setSelectedBook(null); setBookDetail(null); }}>×</button>
            <div className="book-detail">
              <div className="book-detail-info">
                <h3>{bookDetail.title}</h3>
                <p className="book-detail-author">Author: {bookDetail.author}</p>
                <div className="book-detail-grid">
                  <div className="book-detail-item"><strong>ISBN:</strong> {bookDetail.isbn}</div>
                  <div className="book-detail-item"><strong>Genre:</strong> {bookDetail.genre}</div>
                  <div className="book-detail-item"><strong>Language:</strong> {bookDetail.language}</div>
                  <div className="book-detail-item"><strong>Location:</strong> {bookDetail.shelfLocation || 'N/A'}</div>
                  <div className="book-detail-item"><strong>Available Copies:</strong> {bookDetail.availableCopies}</div>
                  <div className="book-detail-item">
                    <strong>Status:</strong>
                    <span className={`status-badge ${bookDetail.available ? 'success' : 'danger'}`}>
                      {bookDetail.available ? 'Available' : 'Borrowed'}
                    </span>
                  </div>
                  {bookDetail.averageRating && (
                    <div className="book-detail-item"><strong>Avg Rating:</strong> ⭐ {bookDetail.averageRating.toFixed(1)}</div>
                  )}
                  {bookDetail.description && (
                    <div className="book-detail-item book-detail-desc"><strong>Description:</strong> {bookDetail.description}</div>
                  )}
                </div>
                <div className="book-actions">
                  {bookDetail.available ? (
                    <button
                      className="borrow-btn"
                      onClick={() => handleBorrow(bookDetail.id)}
                      disabled={borrowLoading}
                    >
                      {borrowLoading ? 'Borrowing...' : '📖 Borrow Now'}
                    </button>
                  ) : (
                    <button
                      className="hold-btn"
                      onClick={() => handleHoldBook(bookDetail.id)}
                      disabled={holdLoading}
                    >
                      {holdLoading ? 'Holding...' : '⏳ Hold Book'}
                    </button>
                  )}
                  <button
                    className="wishlist-btn"
                    onClick={() => handleAddToWishlist(bookDetail.id)}
                    disabled={wishlistAddLoading}
                  >
                    {wishlistAddLoading ? 'Adding...' : '❤️ Add to Wishlist'}
                  </button>
                </div>

                {/* Rating Section */}
                <div className="rating-section">
                  <h4>Rate this book</h4>
                  <div className="rating-stars">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        className={`star-btn ${userRating >= star ? 'active' : ''}`}
                        onClick={() => handleRateBook(bookDetail.id, star)}
                        disabled={ratingLoading}
                      >
                        ⭐
                      </button>
                    ))}
                  </div>
                  {userRating && <p>Your rating: {userRating} stars</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Results or All Books */}
      <div className="books-grid">
        {allBooksLoading || searchLoading ? (
          <div className="no-data">Loading...</div>
        ) : searchExecuted ? (
          searchResults.length > 0 ? (
            // 显示搜索结果
            searchResults.map((book) => (
              <div key={book.id} className="book-card">
                <div className="book-cover" onClick={() => handleViewDetail(book.id)}>📚</div>
                <div className="book-info">
                  <h3 onClick={() => handleViewDetail(book.id)} className="book-title-clickable">{book.title}</h3>
                  <p className="book-author">{book.author}</p>
                  <p className="book-detail">ISBN: {book.isbn}</p>
                  <p className="book-detail">Genre: {book.genre}</p>
                  <div className="book-status">
                    <span className={`status-badge ${book.available ? 'success' : 'danger'}`}>
                      {book.available ? 'Available' : 'Borrowed'}
                    </span>
                    {book.averageRating && <span className="rating">⭐ {book.averageRating.toFixed(1)}</span>}
                  </div>
                  {book.available && (
                    <button
                      className="borrow-btn"
                      onClick={() => handleBorrow(book.id)}
                      disabled={borrowLoading}
                    >
                      {borrowLoading ? 'Borrowing...' : 'Borrow'}
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="no-data">No books found</div>
          )
        ) : allBooks.length > 0 ? (
          // 显示所有书籍（默认）
          allBooks.map((book) => (
            <div key={book.id} className="book-card">
              <div className="book-cover" onClick={() => handleViewDetail(book.id)}>📚</div>
              <div className="book-info">
                <h3 onClick={() => handleViewDetail(book.id)} className="book-title-clickable">{book.title}</h3>
                <p className="book-author">{book.author}</p>
                <p className="book-detail">ISBN: {book.isbn}</p>
                <p className="book-detail">Genre: {book.genre}</p>
                <div className="book-status">
                  <span className={`status-badge ${book.available ? 'success' : 'danger'}`}>
                    {book.available ? 'Available' : 'Borrowed'}
                  </span>
                  {book.averageRating && <span className="rating">⭐ {book.averageRating.toFixed(1)}</span>}
                </div>
                {book.available && (
                  <button
                    className="borrow-btn"
                    onClick={() => handleBorrow(book.id)}
                    disabled={borrowLoading}
                  >
                    {borrowLoading ? 'Borrowing...' : 'Borrow'}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : searchKeyword && !searchLoading ? (
          <div className="no-data">No books found</div>
        ) : (
          <div className="no-data">No books available</div>
        )}
      </div>

      {/* Pagination */}
      {searchResults.length === 0 && allBooks.length > 0 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            ← Previous
          </button>
          <span className="pagination-info">
            Page {pagination.page} of {Math.ceil(pagination.total / pagination.size)}
          </span>
          <button
            className="pagination-btn"
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= Math.ceil(pagination.total / pagination.size)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )

  // Render Loan History (4.3)
  const renderLoans = () => {
    if (!loanHistory.length && !loanHistoryLoading) {
      fetchLoanHistory()
    }

    return (
      <div className="content">
        <div className="page-header">
          <h2>📋 Loan History</h2>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="table-section">
          <table className="data-table reader-loans-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Barcode</th>
                <th>Checkout Date</th>
                <th>Due Date</th>
                <th>Return Date</th>
                <th>Renewals</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loanHistoryLoading ? (
                <tr>
                  <td colSpan="9" className="no-data">Loading...</td>
                </tr>
              ) : loanHistory.length > 0 ? (
                loanHistory.map((loan) => (
                  <tr key={loan.id}>
                    <td>{loan.bookTitle || 'Book unavailable'}</td>
                    <td>{loan.bookAuthor || 'N/A'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{loan.barcode || 'N/A'}</td>
                    <td>{new Date(loan.checkoutDate).toLocaleDateString('en-US')}</td>
                    <td>{new Date(loan.dueDate).toLocaleDateString('en-US')}</td>
                    <td>{loan.returnDate ? new Date(loan.returnDate).toLocaleDateString('en-US') : '-'}</td>
                    <td>{loan.renewalCount || 0}</td>
                    <td>
                      <span className={`status-badge ${
                        loan.status === 'Borrowing' ? 'success' :
                        loan.status === 'Overdue' ? 'danger' : 'info'
                      }`}>
                        {loan.status === 'Borrowing' ? 'Borrowing' :
                         loan.status === 'Overdue' ? 'Overdue' : 'Returned'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <div className="loan-history-actions">
                        {loan.status === 'Borrowing' && (loan.renewalCount || 0) < 1 && (
                          <button
                            className="action-btn renew-btn"
                            onClick={() => handleRenew(loan.id)}
                            disabled={renewLoading}
                          >
                            {renewLoading ? 'Renewing...' : 'Renew'}
                          </button>
                        )}
                        {(loan.status === 'Borrowing' || loan.status === 'Overdue') && (
                          <button
                            className="action-btn return-btn"
                            onClick={() => handleReturn(loan.id)}
                            disabled={returnLoading}
                          >
                            {returnLoading ? 'Returning...' : 'Return'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="no-data">No loan records</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {loanHistory.length > 0 && (
          <div className="pagination reader-pagination">
            <button
              className="pagination-btn"
              onClick={() => fetchLoanHistory(loanHistoryPagination.page - 1, loanHistoryPagination.size)}
              disabled={loanHistoryPagination.page <= 1}
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {loanHistoryPagination.page} of {Math.ceil(loanHistoryPagination.total / loanHistoryPagination.size)}
            </span>
            <button
              className="pagination-btn"
              onClick={() => fetchLoanHistory(loanHistoryPagination.page + 1, loanHistoryPagination.size)}
              disabled={loanHistoryPagination.page >= Math.ceil(loanHistoryPagination.total / loanHistoryPagination.size)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    )
  }

  // Render Holds (5.2)
  const renderHolds = () => {
    if (!holds.length && !holdsLoading) {
      fetchHolds()
    }

    return (
      <div className="content">
        <div className="page-header">
          <h2>⏳ My Holds</h2>
        </div>

        {/* Filter */}
        <div className="filter-section">
          <select
            value={holdStatusFilter}
            onChange={(e) => {
              setHoldStatusFilter(e.target.value)
              fetchHolds(e.target.value)
            }}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="WAITING">Waiting</option>
            <option value="READY">Ready</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="table-section">
          <table className="data-table reader-wishlist-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {holdsLoading ? (
                <tr>
                  <td colSpan="5" className="no-data">Loading...</td>
                </tr>
              ) : holds.length > 0 ? (
                holds.map((hold) => (
                  <tr key={hold.id}>
                    <td>{hold.bookTitle}</td>
                    <td>{hold.bookAuthor}</td>
                    <td>
                      <span className={`status-badge ${
                        hold.status === 'WAITING' ? 'warning' : 
                        hold.status === 'READY' ? 'success' : 
                        hold.status === 'FULFILLED' ? 'info' : 'danger'
                      }`}>
                        {hold.status === 'WAITING' ? 'Waiting' : 
                         hold.status === 'READY' ? 'Ready' : 
                         hold.status === 'FULFILLED' ? 'Fulfilled' : 'Cancelled'}
                      </span>
                    </td>
                    <td>{new Date(hold.createdAt).toLocaleDateString('en-US')}</td>
                    <td>
                      {(hold.status === 'WAITING' || hold.status === 'READY') && (
                        <button
                          className="action-btn cancel-btn"
                          onClick={() => handleCancelHold(hold.id)}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">No holds found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // Render Wishlist (6.2)
  const renderWishlist = () => {
    if (!wishlist.length && !wishlistLoading) {
      fetchWishlist(wishlistPagination.page, wishlistPagination.size)
    }

    return (
      <div className="content">
        <div className="page-header">
          <h2>❤️ My Wishlist</h2>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="table-section">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Status</th>
                <th>Added At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wishlistLoading ? (
                <tr>
                  <td colSpan="5" className="no-data">Loading...</td>
                </tr>
              ) : wishlist.length > 0 ? (
                wishlist.map((item) => (
                  <tr key={item.id}>
                    <td>{item.bookTitle}</td>
                    <td>{item.bookAuthor}</td>
                    <td>
                      <span className={`status-badge ${item.available ? 'success' : 'danger'}`}>
                        {item.available ? 'Available' : 'Borrowed'}
                      </span>
                    </td>
                    <td>{new Date(item.createdAt).toLocaleDateString('en-US')}</td>
                    <td className="actions-cell">
                      <div className="wishlist-actions">
                        {item.available && (
                          <button
                            className="action-btn borrow-btn"
                            onClick={() => handleBorrow(item.bookId)}
                            disabled={borrowLoading}
                          >
                            {borrowLoading ? 'Borrowing...' : 'Borrow'}
                          </button>
                        )}
                        <button
                          className="action-btn remove-btn"
                          onClick={() => handleRemoveFromWishlist(item.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">No items in wishlist</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {wishlist.length > 0 && (
          <div className="pagination reader-pagination">
            <button
              className="pagination-btn"
              onClick={() => fetchWishlist(wishlistPagination.page - 1, wishlistPagination.size)}
              disabled={wishlistPagination.page <= 1}
            >
              ← Previous
            </button>
            <span className="pagination-info">
              Page {wishlistPagination.page} of {Math.ceil(wishlistPagination.total / wishlistPagination.size)}
            </span>
            <button
              className="pagination-btn"
              onClick={() => fetchWishlist(wishlistPagination.page + 1, wishlistPagination.size)}
              disabled={wishlistPagination.page >= Math.ceil(wishlistPagination.total / wishlistPagination.size)}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    )
  }

  // Render Fines (7.1)
  const renderFines = () => {
    return (
      <div className="content">
        <div className="page-header">
          <h2>💰 Outstanding Fines</h2>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        <div className="table-section">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Author</th>
                <th>Due Date</th>
                <th>Fine Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {finesLoading ? (
                <tr>
                  <td colSpan="5" className="no-data">Loading...</td>
                </tr>
              ) : fines.length > 0 ? (
                fines.map((fine) => (
                  <tr key={fine.id}>
                    <td>{fine.bookTitle || 'Book unavailable'}</td>
                    <td>{fine.bookAuthor || 'N/A'}</td>
                    <td>{new Date(fine.dueDate).toLocaleDateString('en-US')}</td>
                    <td>¥{Number(fine.fineAmount || 0).toFixed(2)}</td>
                    <td>
                      <button
                        className="action-btn pay-btn"
                        onClick={() => handleOpenFinePayment(fine)}
                        disabled={payFineLoading}
                      >
                        {payFineLoading ? 'Processing...' : 'Pay with Alipay'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-data">No outstanding fines</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedFine && (
          <div className="modal-overlay" onClick={handleCloseFinePayment}>
            <div className="modal-content fine-payment-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Pay Fine with Alipay</h3>
                <button className="modal-close" onClick={handleCloseFinePayment}>×</button>
              </div>
              <div className="modal-body">
                <div className="book-detail">
                <div className="book-detail-info">
                  <p className="book-detail-author">{selectedFine.bookTitle || 'Book unavailable'}</p>
                  <div className="book-detail-grid">
                    <div className="book-detail-item"><strong>Author:</strong> {selectedFine.bookAuthor || 'N/A'}</div>
                    <div className="book-detail-item"><strong>Due Date:</strong> {new Date(selectedFine.dueDate).toLocaleDateString('en-US')}</div>
                    <div className="book-detail-item"><strong>Amount:</strong> ¥{Number(selectedFine.fineAmount || 0).toFixed(2)}</div>
                    <div className="book-detail-item book-detail-desc">
                      <strong>How to pay:</strong> Scan the QR code with Alipay, complete the payment, then click I Have Paid.
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', margin: '24px 0 20px' }}>
                    <img
                      src="/alipay-qr.png"
                      alt="Alipay QR Code"
                      style={{ width: '240px', maxWidth: '100%', borderRadius: '16px', border: '1px solid #e5e7eb' }}
                    />
                  </div>
                  <div className="form-actions" style={{ justifyContent: 'center' }}>
                    <button
                      className="save-btn"
                      onClick={() => handlePayFine(selectedFine)}
                      disabled={payFineLoading}
                    >
                      {payFineLoading ? 'Confirming...' : 'I Have Paid'}
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={handleCloseFinePayment}
                      disabled={payFineLoading}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render Profile (1.8)
  const renderProfile = () => {
    if (!profile && !profileLoading) {
      fetchProfile()
    }

    return (
      <div className="content">
        <div className="page-header">
          <h2>👤 My Profile</h2>
        </div>

        {message.text && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {profileLoading ? (
          <div className="loading">Loading...</div>
        ) : profile ? (
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-avatar">{profile.name[0].toUpperCase()}</div>
              <div className="profile-title">
                <h3>{profile.name}</h3>
                <p className="profile-role">Student</p>
              </div>
              {!editMode && (
                <button className="edit-btn" onClick={() => setEditMode(true)}>✏️ Edit</button>
              )}
            </div>

            {editMode ? (
              <form onSubmit={handleUpdateProfile} className="profile-form" noValidate>
                <div className="form-group">
                  <label>Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="profile-input"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Student ID</label>
                  <input
                    type="text"
                    value={editForm.studentId || ''}
                    onChange={(e) => setEditForm({ ...editForm, studentId: e.target.value })}
                    className="profile-input"
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="save-btn" disabled={profileLoading}>
                    {profileLoading ? 'Saving...' : '💾 Save'}
                  </button>
                  <button type="button" className="cancel-btn" onClick={() => {
                    setEditMode(false)
                    setEditForm({ name: profile.name, studentId: profile.studentId || '' })
                  }}>
                    ❌ Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-info">
                <div className="info-item">
                  <strong>Name:</strong> {profile.name}
                </div>
                <div className="info-item">
                  <strong>Email:</strong> {profile.email}</div>
                <div className="info-item">
                  <strong>Student ID:</strong> {profile.studentId || 'Not provided'}</div>
                <div className="info-item">
                  <strong>Role:</strong> Student</div>
                <div className="info-item">
                  <strong>Registered:</strong> {new Date(profile.createdAt).toLocaleDateString('en-US')}</div>
              </div>
            )}
          </div>
        ) : (
          <div className="no-data">Unable to fetch profile</div>
        )}
      </div>
    )
  }

  // 渲染系统公告
  const renderAnnouncements = () => (
      <div className="content">
        <div className="page-header">
          <h2>📢 System Announcements</h2>
        </div>

        {selectedAnnouncement ? (
            <div className="profile-card">
              <button className="action-btn" onClick={() => setSelectedAnnouncement(null)} style={{marginBottom: '20px'}}>← Back to List</button>
              <h3 style={{fontSize: '24px', fontWeight: 'bold'}}>{selectedAnnouncement.title}</h3>
              <p style={{color: '#666', fontSize: '14px', marginBottom: '20px'}}>Published: {new Date(selectedAnnouncement.publishedAt).toLocaleString()}</p>
              <div style={{lineHeight: '1.6', whiteSpace: 'pre-wrap'}}>{selectedAnnouncement.content}</div>
            </div>
        ) : (
            <div className="table-section">
              <table className="data-table">
                <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
                </thead>
                <tbody>
                {announcementsLoading ? (
                    <tr><td colSpan="4" className="no-data">Loading...</td></tr>
                ) : announcements.length > 0 ? (
                    announcements.map((ann) => (
                        <tr key={ann.id}>
                          <td style={{fontWeight: '500'}}>{ann.title}</td>
                          <td><span className="status-badge info">{ann.type}</span></td>
                          <td>{new Date(ann.publishedAt).toLocaleDateString()}</td>
                          <td>
                            <button className="action-btn" onClick={() => setSelectedAnnouncement(ann)}>View Detail</button>
                          </td>
                        </tr>
                    ))
                ) : (
                    <tr><td colSpan="4" className="no-data">No announcements found.</td></tr>
                )}
                </tbody>
              </table>
            </div>
        )}
      </div>
  );

  // 渲染新书通报
  const renderNewBooks = () => (
      <div className="content">
        <div className="page-header">
          <h2>✨ New Arrivals</h2>
          <p>Explore the latest books added to our collection this month.</p>
        </div>

        {bookDetail && selectedBook && (
            <div className="modal-overlay book-detail-modal" onClick={() => { setSelectedBook(null); setBookDetail(null); }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={() => { setSelectedBook(null); setBookDetail(null); }}>×</button>
                <div className="book-detail">
                  <div className="book-detail-info">
                    <h3>{bookDetail.title}</h3>
                    <p className="book-detail-author">Author: {bookDetail.author}</p>
                    <div className="book-detail-grid">
                      <div className="book-detail-item"><strong>ISBN:</strong> {bookDetail.isbn}</div>
                      <div className="book-detail-item"><strong>Genre:</strong> {bookDetail.genre}</div>
                      <div className="book-detail-item"><strong>Language:</strong> {bookDetail.language}</div>
                      <div className="book-detail-item"><strong>Location:</strong> {bookDetail.shelfLocation || 'N/A'}</div>
                      <div className="book-detail-item"><strong>Available Copies:</strong> {bookDetail.availableCopies}</div>
                      <div className="book-detail-item">
                        <strong>Status:</strong>
                        <span className={`status-badge ${bookDetail.available ? 'success' : 'danger'}`}>
                      {bookDetail.available ? 'Available' : 'Borrowed'}
                    </span>
                      </div>
                      {bookDetail.averageRating && (
                          <div className="book-detail-item"><strong>Avg Rating:</strong> ⭐ {bookDetail.averageRating.toFixed(1)}</div>
                      )}
                      {bookDetail.description && (
                          <div className="book-detail-item book-detail-desc"><strong>Description:</strong> {bookDetail.description}</div>
                      )}
                    </div>
                    <div className="book-actions">
                      {bookDetail.available ? (
                          <button
                              className="borrow-btn"
                              onClick={() => handleBorrow(bookDetail.id)}
                              disabled={borrowLoading}
                          >
                            {borrowLoading ? 'Borrowing...' : '📖 Borrow Now'}
                          </button>
                      ) : (
                          <button
                              className="hold-btn"
                              onClick={() => handleHoldBook(bookDetail.id)}
                              disabled={holdLoading}
                          >
                            {holdLoading ? 'Holding...' : '⏳ Hold Book'}
                          </button>
                      )}
                      <button
                          className="wishlist-btn"
                          onClick={() => handleAddToWishlist(bookDetail.id)}
                          disabled={wishlistAddLoading}
                      >
                        {wishlistAddLoading ? 'Adding...' : '❤️ Add to Wishlist'}
                      </button>
                    </div>

                    {/* Rating Section */}
                    <div className="rating-section">
                      <h4>Rate this book</h4>
                      <div className="rating-stars">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                className={`star-btn ${userRating >= star ? 'active' : ''}`}
                                onClick={() => handleRateBook(bookDetail.id, star)}
                                disabled={ratingLoading}
                            >
                              ⭐
                            </button>
                        ))}
                      </div>
                      {userRating && <p>Your rating: {userRating} stars</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
        )}
        {/* --- 弹窗代码结束 --- */}

        <div className="books-grid">
          {newBooksLoading ? (
              <div className="no-data">Loading...</div>
          ) : newBooks.length > 0 ? (
              newBooks.map((book) => (
                  <div key={book.id} className="book-card" onClick={() => handleViewDetail(book.id)} style={{cursor: 'pointer'}}>
                    <div className="book-cover">📚</div>
                    <div className="book-info">
                      <h3>{book.title}</h3>
                      <p className="book-author">{book.author}</p>
                      <div className="book-status">
                  <span className={`status-badge ${book.available ? 'success' : 'danger'}`}>
                    {book.available ? 'Available' : 'Borrowed'}
                  </span>
                        <span className="date-badge" style={{fontSize: '12px', color: '#666', marginLeft: '8px'}}>New!</span>
                      </div>
                    </div>
                  </div>
              ))
          ) : (
              <div className="no-data">No new books this month.</div>
          )}
        </div>
      </div>
  );

  // 渲染资源荐购页面 (3.2)
  const renderRecommend = () => (
      <div className="content">
        <div className="page-header">
          <h2>💡 Book Recommendation</h2>
          <p>Suggest new books for the library to purchase.</p>
        </div>

        {message.text && (
            <div className={`message ${message.type}`}>
              {message.text}
            </div>
        )}

        {/* 提交表单区域 */}
        <div className="profile-card" style={{ marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: '600' }}>Submit a Request</h3>
          <form onSubmit={handleAcqSubmit} className="profile-form">
            <div className="form-group">
              <label>ISBN <span style={{color: '#ef4444'}}>*</span></label>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="profile-input"
                  required
                  placeholder="Enter 10 or 13 digit ISBN"
                  value={acqForm.isbn}
                  onChange={(e) => setAcqForm({ ...acqForm, isbn: e.target.value, title: '', author: '' })}
                  onBlur={() => {
                    if (acqForm.isbn.trim()) {
                      handleAcqLookupIsbn(acqForm.isbn);
                    }
                  }}
                />
                <button
                  type="button"
                  className="save-btn"
                  style={{ minWidth: '120px' }}
                  onClick={() => handleAcqLookupIsbn(acqForm.isbn)}
                  disabled={acqLookupLoading || !acqForm.isbn.trim()}
                >
                  {acqLookupLoading ? 'Searching...' : 'Auto Fill'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                className="profile-input"
                placeholder="Auto-filled from ISBN"
                value={acqForm.title}
                readOnly
              />
            </div>
            <div className="form-group">
              <label>Author</label>
              <input
                type="text"
                className="profile-input"
                placeholder="Auto-filled from ISBN"
                value={acqForm.author}
                readOnly
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label>Reason / Note</label>
              <textarea className="profile-input" rows="3" placeholder="Why should we buy this book?"
                        value={acqForm.reason} onChange={(e) => setAcqForm({...acqForm, reason: e.target.value})}></textarea>
            </div>
            <div className="form-actions" style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="save-btn" disabled={acqSubmitLoading}>
                {acqSubmitLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>

        {/* 历史记录区域 */}
        <div className="table-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>My Requests</h3>
            <select className="filter-select" value={acqStatusFilter} onChange={(e) => {
              setAcqStatusFilter(e.target.value);
              fetchAcquisitions(e.target.value);
            }}>
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <table className="data-table">
            <thead>
            <tr>
              <th>Title</th>
              <th>Author</th>
              <th>Status</th>
              <th>Submitted Date</th>
            </tr>
            </thead>
            <tbody>
            {acquisitionsLoading ? (
                <tr><td colSpan="4" className="no-data">Loading...</td></tr>
            ) : acquisitions.length > 0 ? (
                acquisitions.map(req => (
                    <tr key={req.id}>
                      <td style={{fontWeight: '500'}}>{req.title}</td>
                      <td>{req.author || '-'}</td>
                      <td>
                    <span className={`status-badge ${
                        req.status === 'ACCEPTED' ? 'success' :
                            req.status === 'REJECTED' ? 'danger' : 'warning'
                    }`}>
                      {req.status}
                    </span>
                      </td>
                      <td>{new Date(req.createdAt).toLocaleDateString('en-US')}</td>
                    </tr>
                ))
            ) : (
                <tr><td colSpan="4" className="no-data">No recommendation records found.</td></tr>
            )}
            </tbody>
          </table>
        </div>
      </div>
  );

  // 渲染借阅排行榜页面 (3.5)
  const renderRanking = () => (
      <div className="content">
        <div className="page-header">
          <h2>🏆 Borrowing Leaderboard</h2>
          <p>Discover the most popular books in our library.</p>
        </div>

        <div className="table-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3>Top 10 Books</h3>
            {/* 时间范围筛选框，强制对齐 SPM 需求 */}
            <select className="filter-select" value={rankingPeriod} onChange={(e) => {
              setRankingPeriod(e.target.value);
              fetchRankings(e.target.value);
            }}>
              <option value="month">This Month</option>
              <option value="3months">Last 3 Months</option>
              <option value="year">Last Year</option>
            </select>
          </div>

          <table className="data-table">
            <thead>
            <tr>
              <th style={{width: '60px', textAlign: 'center'}}>Rank</th>
              <th style={{width: '60px'}}>Cover</th>
              <th>Title</th>
              <th>Author</th>
              <th style={{width: '100px', textAlign: 'center'}}>Borrows</th>
            </tr>
            </thead>
            <tbody>
            {rankingsLoading ? (
                <tr><td colSpan="5" className="no-data">Loading...</td></tr>
            ) : rankings.length > 0 ? (
                rankings.map((book, index) => (
                    <tr key={book.bookId || index}>
                      <td style={{textAlign: 'center'}}>
                        {/* 给前三名加点“土豪金/白银/青铜”的特效 */}
                        <span className="status-badge" style={{
                          backgroundColor: index === 0 ? '#fef08a' : index === 1 ? '#e2e8f0' : index === 2 ? '#fed7aa' : '#f3f4f6',
                          color: index === 0 ? '#854d0e' : index === 1 ? '#475569' : index === 2 ? '#9a3412' : '#374151',
                          fontWeight: 'bold', fontSize: '14px', width: '28px', display: 'inline-block', textAlign: 'center'
                        }}>
                      {index + 1}
                    </span>
                      </td>
                      <td style={{ fontSize: '24px' }}>📚</td>
                      <td>
                        {/* 书名可点击，触发借阅/详情弹窗 */}
                        <span
                            onClick={() => handleViewDetail(book.bookId)}
                            style={{ fontWeight: '600', color: '#2563eb', cursor: 'pointer' }}
                            className="book-title-clickable hover:underline"
                        >
                      {book.bookTitle}
                    </span>
                      </td>
                      <td>{book.bookAuthor || '-'}</td>
                      <td style={{textAlign: 'center'}}>
                    <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '16px' }}>
                      {book.loanCount}
                    </span>
                      </td>
                    </tr>
                ))
            ) : (
                <tr><td colSpan="5" className="no-data">No ranking data available for this period.</td></tr>
            )}
            </tbody>
          </table>
        </div>
      </div>
  );

  // Render Return Book page
  const renderReturnBook = () => {
    return (
      <div className="content">
        <div className="page-header">
          <h2>Return Book</h2>
          <p>Scan or enter the book copy barcode to return a book</p>
        </div>

        <div className="return-book-container" style={{ maxWidth: '600px', margin: '0 auto' }}>
          <form onSubmit={handleReturnByBarcode} className="search-form">
            <div className="search-input-group">
              <input
                type="text"
                className="search-input"
                placeholder="Enter book copy barcode..."
                value={returnBarcode}
                onChange={(e) => { setReturnBarcode(e.target.value); setReturnResult(null) }}
                autoFocus
              />
              <button
                type="submit"
                className="search-btn"
                disabled={returnBarcodeLoading}
              >
                {returnBarcodeLoading ? 'Processing...' : 'Return'}
              </button>
            </div>
          </form>

          {returnResult && returnResult.success && (
            <div className="result-card success" style={{
              marginTop: '24px',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: '#f0fff4',
              border: '1px solid #c6f6d5'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#22543d', marginBottom: '12px' }}>
                Book Returned Successfully
              </div>
              <div style={{ color: '#276749' }}>
                <p><strong>Title:</strong> {returnResult.bookTitle}</p>
                <p><strong>Return Date:</strong> {returnResult.returnDate}</p>
                {returnResult.fineAmount > 0 && (
                  <p style={{ color: '#c05621', fontWeight: '600' }}>
                    Overdue Fine: ${returnResult.fineAmount}
                  </p>
                )}
                {returnResult.fineAmount === 0 && (
                  <p style={{ color: '#22543d' }}>No overdue fine</p>
                )}
              </div>
            </div>
          )}

          {returnResult && !returnResult.success && (
            <div className="result-card error" style={{
              marginTop: '24px',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: '#fff5f5',
              border: '1px solid #fed7d7'
            }}>
              <div style={{ fontSize: '18px', fontWeight: '600', color: '#9b2c2c', marginBottom: '8px' }}>
                Return Failed
              </div>
              <p style={{ color: '#c53030' }}>{returnResult.message}</p>
            </div>
          )}

          {!returnResult && (
            <div style={{
              marginTop: '24px',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: '#f7fafc',
              border: '1px solid #e2e8f0',
              textAlign: 'center',
              color: '#718096'
            }}>
              <p>Enter the barcode printed on the book copy to return it.</p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                The barcode can be found on the back cover or inside the book.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  switch (currentPage) {
    case 'announcements':
      return renderAnnouncements()
    case 'new-books':
      return renderNewBooks()
    case 'dashboard':
      return renderDashboard()
    case 'books':
      return renderBooks()
    case 'ranking':
      return renderRanking()
    case 'loans':
      return renderLoans()
    case 'holds':
      return renderHolds()
    case 'return':
      return renderReturnBook()
    case 'wishlist':
      return renderWishlist()
    case 'fines':
      return renderFines()
    case 'recommend':
      return renderRecommend()
    case 'profile':
      return renderProfile()
    default:
      return <div className="content"><div className="page-header"><h2>Feature under development...</h2></div></div>
  }
}

export default ReaderDashboard
