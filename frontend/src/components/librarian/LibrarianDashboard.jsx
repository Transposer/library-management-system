import React, { useEffect, useState } from 'react'

const API_BASE = '/api/librarian'
const DEFAULT_STATS = { totalBooks: 0, availableBooks: 0, myLoans: 0, pendingHolds: 0 }
const DEFAULT_FINE_DASHBOARD = {
  totalBooks: 0,
  booksInLibrary: 0,
  checkedOutBooks: 0,
  overdueBooks: 0,
  unpaidFineTotal: 0,
  paidFineTotal: 0,
  paidThisWeek: 0,
  paidThisYear: 0,
  fineDueToday: 0,
  fineItemCount: 0,
  fineItems: [],
  paidFineItemCount: 0,
  paidFineItems: [],
  generatedAt: ''
}
const GENRES = ['Technology', 'Fiction', 'Science', 'History', 'Management']
const LANGUAGES = ['Chinese', 'English', 'Others']
const HOLD_STATUSES = ['WAITING', 'READY', 'CANCELLED']

const formatDateLabel = (value) => {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`

const CODE39_PATTERNS = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn'
}

const normalizeCode39Value = (value) =>
  String(value || '')
    .toUpperCase()
    .split('')
    .filter((char) => CODE39_PATTERNS[char])
    .join('')

const buildCode39Bars = (value) => {
  const narrow = 2
  const wide = 5
  const gap = narrow
  const quietZone = 10
  const encoded = `*${normalizeCode39Value(value)}*`
  const bars = []
  let x = quietZone

  encoded.split('').forEach((char) => {
    const pattern = CODE39_PATTERNS[char]
    if (!pattern) return

    pattern.split('').forEach((widthCode, index) => {
      const width = widthCode === 'w' ? wide : narrow
      if (index % 2 === 0) {
        bars.push({ x, width })
      }
      x += width
    })
    x += gap
  })

  return { bars, width: x + quietZone }
}

const CopyBarcode = ({ value }) => {
  const { bars, width } = buildCode39Bars(value)

  return (
    <svg
      className="copy-barcode-svg"
      viewBox={`0 0 ${width} 92`}
      role="img"
      aria-label={`Barcode ${value}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={width} height="92" fill="#ffffff" />
      {bars.map((bar, index) => (
        <rect key={`${bar.x}-${index}`} x={bar.x} y="8" width={bar.width} height="58" fill="#111827" />
      ))}
      <text x={width / 2} y="82" textAnchor="middle">
        {value}
      </text>
    </svg>
  )
}

const getBookDisplayStatus = (book) => {
  if (book?.displayStatus) return book.displayStatus
  if (book?.available && Number(book?.availableCopies || 0) > 0) return 'AVAILABLE'
  if (Number(book?.borrowedCopies || 0) > 0) return 'BORROWED'
  return 'UNAVAILABLE'
}

const getBookStatusLabel = (book) => {
  const status = getBookDisplayStatus(book)
  if (status === 'BORROWED') return 'Borrowed'
  if (status === 'AVAILABLE') return 'Available'
  return 'Unavailable'
}

const getBookStatusBadgeClass = (book) => {
  const status = getBookDisplayStatus(book)
  if (status === 'BORROWED') return 'warning'
  if (status === 'AVAILABLE') return 'success'
  return 'danger'
}

const LibrarianDashboard = ({
  user,
  stats: initialStats = DEFAULT_STATS,
  books: initialBooks = [],
  currentPage,
  setCurrentPage
}) => {
  const [books, setBooks] = useState(initialBooks)
  const [stats, setStats] = useState({
    ...DEFAULT_STATS,
    ...initialStats,
    totalBooks: initialBooks.length || initialStats.totalBooks || 0,
    availableBooks: initialBooks.length
      ? initialBooks.filter(book => book.available).length
      : initialStats.availableBooks || 0
  })
  const [loading, setLoading] = useState(false)
  const [loanLoading, setLoanLoading] = useState(false)
  const [holdLoading, setHoldLoading] = useState(false)
  const [fineDashboardLoading, setFineDashboardLoading] = useState(false)
  const [fineDashboard, setFineDashboard] = useState(DEFAULT_FINE_DASHBOARD)
  const [fineDashboardView, setFineDashboardView] = useState('unpaid')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [payingFineId, setPayingFineId] = useState('')
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false)
  const [barcodeBook, setBarcodeBook] = useState(null)
  const [returningLoanId, setReturningLoanId] = useState('')
  const [holdActionLoadingId, setHoldActionLoadingId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchType, setSearchType] = useState('all')
  const [activeSearchTerm, setActiveSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [filterGenre, setFilterGenre] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [loanRecords, setLoanRecords] = useState([])
  const [holdRecords, setHoldRecords] = useState([])
  const [holdStatusFilter, setHoldStatusFilter] = useState('')
  const [holdKeyword, setHoldKeyword] = useState('')
  const [checkoutForm, setCheckoutForm] = useState({ userId: '', bookIdentifier: '' })
  const [checkoutErrors, setCheckoutErrors] = useState({})
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [alipayTarget, setAlipayTarget] = useState(null)
  const [alipayResult, setAlipayResult] = useState(null)
  const [returnTarget, setReturnTarget] = useState(null)
  const [readyTarget, setReadyTarget] = useState(null)
  const [cancelHoldTarget, setCancelHoldTarget] = useState(null)
  const [copyBarcodeTarget, setCopyBarcodeTarget] = useState(null)
  const [copyBarcodeLoadingId, setCopyBarcodeLoadingId] = useState('')
  const [expandedHoldId, setExpandedHoldId] = useState('')
  const [selectedBook, setSelectedBook] = useState(null)
  const [addForm, setAddForm] = useState({
    title: '',
    author: '',
    isbn: '',
    genre: 'Technology',
    language: 'English',
    shelfLocation: '',
    availableCopies: 1,
    description: '',
    cover: '',
    localError: ''
  })
  const [lookupLoading, setLookupLoading] = useState(false)
  const [scanInput, setScanInput] = useState('')
  const [scanResult, setScanResult] = useState(null)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanError, setScanError] = useState('')
  const [editForm, setEditForm] = useState({
    title: '',
    author: '',
    isbn: '',
    genre: '',
    language: '',
    shelfLocation: '',
    availableCopies: 1,
    description: '',
    cover: ''
  })

  const getToken = () => localStorage.getItem('token')

  const notify = (type, message) => {
    if (type === 'error') {
      setSuccess('')
      setError(message)
      return
    }

    setError('')
    setSuccess(message)
  }

  const applyBookStats = (list, total) => {
    setStats(prev => ({
      ...prev,
      totalBooks: total ?? list.length,
      availableBooks: list.filter(book => getBookDisplayStatus(book) === 'AVAILABLE').length
    }))
  }

  const fetchBooks = async (page = 1, size = 50, options = {}) => {
    const { silent = false } = options

    if (!silent) {
      setLoading(true)
    }

    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/books?page=${page}&size=${size}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        const list = result.data.list || []
        setBooks(list)
        applyBookStats(list, result.data.total || 0)
      } else {
        notify('error', result.message || 'Failed to fetch books')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  const fetchLoanRecords = async (options = {}) => {
    const { silent = false } = options

    if (!silent) {
      setLoanLoading(true)
    }

    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/loans?page=1&size=100`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        const list = result.data.list || []
        setLoanRecords(list)
        setStats(prev => ({
          ...prev,
          myLoans: result.data.total || list.length
        }))
      } else {
        notify('error', result.message || 'Failed to fetch loan records')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      if (!silent) {
        setLoanLoading(false)
      }
    }
  }

  const refreshLoanManagement = async (options = {}) => {
    await Promise.all([
      fetchBooks(1, 50, options),
      fetchLoanRecords(options),
      fetchFineDashboard(options)
    ])
  }

  const fetchFineDashboard = async (options = {}) => {
    const { silent = false } = options

    if (!silent) {
      setFineDashboardLoading(true)
    }

    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/fine-dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        setFineDashboard({
          ...DEFAULT_FINE_DASHBOARD,
          ...result.data,
          fineItems: result.data?.fineItems || [],
          paidFineItems: result.data?.paidFineItems || []
        })
        setStats(prev => ({
          ...prev,
          availableBooks: result.data?.booksInLibrary ?? prev.availableBooks,
          myLoans: result.data?.checkedOutBooks ?? prev.myLoans
        }))
      } else {
        notify('error', result.message || 'Failed to fetch fine dashboard')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      if (!silent) {
        setFineDashboardLoading(false)
      }
    }
  }

  const fetchHoldRecords = async (options = {}) => {
    const { silent = false } = options

    if (!silent) {
      setHoldLoading(true)
    }

    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/holds?page=1&size=200`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        const list = result.data.list || []
        setHoldRecords(list)
        setStats(prev => ({
          ...prev,
          pendingHolds: list.filter(hold => hold.status === 'WAITING').length
        }))
      } else {
        notify('error', result.message || 'Failed to fetch reservation records')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      if (!silent) {
        setHoldLoading(false)
      }
    }
  }

  const refreshHoldManagement = async (options = {}) => {
    await Promise.all([
      fetchBooks(1, 50, options),
      fetchHoldRecords(options)
    ])
  }

  const handleSearch = async (e) => {
    e?.preventDefault()

    if (!searchKeyword.trim()) {
      setSearchResults([])
      setActiveSearchTerm('')
      return
    }

    setIsSearching(true)
    try {
      const token = getToken()
      const params = new URLSearchParams({ keyword: searchKeyword.trim() })
      if (searchType !== 'all') {
        params.set('type', searchType)
      }

      const res = await fetch(`${API_BASE}/books?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        setSearchResults(result.data.list || [])
        setActiveSearchTerm(searchKeyword.trim())
      } else {
        notify('error', result.message || 'Search failed')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (initialBooks.length > 0) {
      setBooks(initialBooks)
      applyBookStats(initialBooks, initialStats.totalBooks || initialBooks.length)
    }
  }, [initialBooks, initialStats.totalBooks])

  useEffect(() => {
    const loadPageData = async () => {
      if (currentPage === 'dashboard') {
        await Promise.all([
          fetchBooks(1, 50),
          fetchLoanRecords({ silent: true }),
          fetchFineDashboard()
        ])
        return
      }

      if (currentPage === 'loans-manage') {
        await refreshLoanManagement()
        return
      }

      if (currentPage === 'holds-manage') {
        await refreshHoldManagement()
        return
      }

      await fetchBooks()
    }

    loadPageData()
  }, [currentPage])

  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 3500)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const handleLookupIsbn = async (isbn) => {
    if (!isbn || isbn.trim().length < 10) {
      setAddForm(prev => ({ ...prev, localError: 'Please enter a valid ISBN (at least 10 characters)' }))
      return
    }
    setAddForm(prev => ({ ...prev, localError: '' }))
    setLookupLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/books/lookup?isbn=${encodeURIComponent(isbn)}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.code === 200 && result.data) {
        const book = result.data
        setAddForm(prev => ({
          ...prev,
          title: book.title || prev.title,
          author: book.authors?.[0] || prev.author,
          cover: book.cover || prev.cover,
          description: book.description || prev.description,
          localError: ''
        }))
        notify('success', 'Book info found! Please verify and fill in remaining fields.')
      } else {
        notify('error', result.message || 'Book not found. Please fill in manually.')
      }
    } catch (err) {
      notify('error', 'Failed to lookup ISBN. Please fill in manually.')
    } finally {
      setLookupLoading(false)
    }
  }

  const handleScanBook = async (isbn) => {
    if (!isbn || isbn.trim().length < 1) {
      setScanError('Please enter ISBN or barcode');
      return;
    }
    setScanError('');
    setScanResult(null);
    setScanLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/books/scan?isbn=${encodeURIComponent(isbn.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.code === 200 && result.data) {
        setScanResult(result.data);
        notify('success', 'Book found!');
      } else {
        setScanError(result.message || 'Book not found');
      }
    } catch (err) {
      setScanError('Failed to scan book');
    } finally {
      setScanLoading(false);
    }
  };

  const handleAddBook = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(addForm)
      })
      const result = await res.json()
      if (result.code === 200) {
        notify('success', 'Book added successfully!')
        setShowAddModal(false)
        resetAddForm()
        await fetchBooks()
      } else {
        notify('error', result.message || 'Failed to add book')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleEditBook = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/books/${selectedBook.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      })
      const result = await res.json()
      if (result.code === 200) {
        notify('success', 'Book updated successfully!')
        setShowEditModal(false)
        setSelectedBook(null)
        await fetchBooks()
      } else {
        notify('error', result.message || 'Failed to update book')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBook = async () => {
    setLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/books/${selectedBook.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()
      if (result.code === 200) {
        notify('success', 'Book deleted successfully!')
        setShowDeleteConfirm(false)
        setSelectedBook(null)
        await fetchBooks()
      } else {
        notify('error', result.message || 'Failed to delete book')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const openCopyBarcodeModal = async (book) => {
    setCopyBarcodeLoadingId(book.id)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/books/${book.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        setCopyBarcodeTarget(result.data)
      } else {
        notify('error', result.message || 'Failed to load book copies')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setCopyBarcodeLoadingId('')
    }
  }

  const resetAddForm = () => {
    setAddForm({
      title: '',
      author: '',
      isbn: '',
      genre: 'Technology',
      language: 'English',
      shelfLocation: '',
      availableCopies: 1,
      description: '',
      cover: ''
    })
  }

  const validateCheckoutForm = () => {
    const nextErrors = {}

    if (!checkoutForm.userId.trim()) {
      nextErrors.userId = 'User ID is required'
    }

    if (!checkoutForm.bookIdentifier.trim()) {
      nextErrors.bookIdentifier = 'Book ID or ISBN is required'
    }

    setCheckoutErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault()

    if (!validateCheckoutForm()) {
      return
    }

    setCheckoutLoading(true)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/loans/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: checkoutForm.userId.trim(),
          bookIdOrIsbn: checkoutForm.bookIdentifier.trim()
        })
      })
      const result = await res.json()

      if (result.code === 200) {
        notify(
          'success',
          `Checkout completed. ${result.data?.bookTitle || 'Book'} is due on ${formatDateLabel(result.data?.dueDate)}. Remaining copies: ${result.data?.availableCopies ?? 0}.`
        )
        setCheckoutForm({ userId: '', bookIdentifier: '' })
        setCheckoutErrors({})
        setBarcodeBook(null)
        await refreshLoanManagement({ silent: true })
      } else {
        notify('error', result.message || 'Checkout failed')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const handleBarcodeLookup = async () => {
    const barcode = checkoutForm.bookIdentifier.trim()

    if (!barcode) {
      setCheckoutErrors(prev => ({ ...prev, bookIdentifier: 'Barcode or ISBN is required' }))
      setBarcodeBook(null)
      return
    }

    setBarcodeLookupLoading(true)
    setCheckoutErrors(prev => ({ ...prev, bookIdentifier: '' }))
    try {
      const token = getToken()
      const params = new URLSearchParams({ isbn: barcode })
      const res = await fetch(`${API_BASE}/books/scan?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()

      if (result.code === 200) {
        setBarcodeBook(result.data)
        notify('success', `Scan matched: ${result.data.title}`)
      } else {
        setBarcodeBook(null)
        notify('error', result.message || 'No book matched this barcode or ISBN')
      }
    } catch (err) {
      setBarcodeBook(null)
      notify('error', 'Network error: ' + err.message)
    } finally {
      setBarcodeLookupLoading(false)
    }
  }

  const openAlipayModal = (item) => {
    setAlipayTarget(item)
    setAlipayResult(null)
  }

  const closeAlipayModal = () => {
    if (payingFineId) {
      return
    }

    setAlipayTarget(null)
    setAlipayResult(null)
  }

  const handleAlipayFine = async (e) => {
    e.preventDefault()

    if (!alipayTarget) {
      return
    }

    setPayingFineId(alipayTarget.loanId)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/loans/${alipayTarget.loanId}/pay-fine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: alipayTarget.fineAmount,
          method: 'ALIPAY'
        })
      })
      const result = await res.json()

      if (result.code === 200) {
        setAlipayResult(result.data)
        notify('success', `Alipay payment received for ${alipayTarget.userName}: ${formatMoney(alipayTarget.fineAmount)}.`)
        await Promise.all([
          fetchFineDashboard({ silent: true }),
          fetchLoanRecords({ silent: true })
        ])
      } else {
        notify('error', result.message || 'Alipay payment failed')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setPayingFineId('')
    }
  }

  const handleConfirmReturn = async () => {
    if (!returnTarget) {
      return
    }

    setReturningLoanId(returnTarget.id)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/loans/return`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          loanId: returnTarget.id
        })
      })
      const result = await res.json()

      if (result.code === 200) {
        const fineAmount = Number(result.data?.fineAmount || 0)
        const fineText = fineAmount > 0 ? ` Overdue fine: ${formatMoney(fineAmount)}.` : ' No overdue fine.'

        notify(
          'success',
          `Return completed for ${result.data?.bookTitle || 'the selected book'}.${fineText}`
        )
        setReturnTarget(null)
        await refreshLoanManagement({ silent: true })
      } else {
        notify('error', result.message || 'Return failed')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setReturningLoanId('')
    }
  }

  const handleConfirmHoldReady = async () => {
    if (!readyTarget) {
      return
    }

    setHoldActionLoadingId(readyTarget.id)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/holds/${readyTarget.id}/ready`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const result = await res.json()

      if (result.code === 200) {
        notify(
          'success',
          `${result.data?.bookTitle || 'Reservation'} is now READY. ${result.data?.notification?.message || 'The user has been notified.'}`
        )
        setReadyTarget(null)
        await refreshHoldManagement({ silent: true })
      } else {
        notify('error', result.message || 'Failed to mark reservation as ready')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setHoldActionLoadingId('')
    }
  }

  const handleConfirmHoldCancel = async () => {
    if (!cancelHoldTarget) {
      return
    }

    setHoldActionLoadingId(cancelHoldTarget.id)
    try {
      const token = getToken()
      const res = await fetch(`${API_BASE}/holds/${cancelHoldTarget.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const result = await res.json()

      if (result.code === 200) {
        const inventoryText = result.data?.inventoryReleased
          ? ' Reserved inventory has been released.'
          : ''

        notify(
          'success',
          `${result.data?.bookTitle || 'Reservation'} has been cancelled.${inventoryText}`
        )
        setCancelHoldTarget(null)
        await refreshHoldManagement({ silent: true })
      } else {
        notify('error', result.message || 'Failed to cancel reservation')
      }
    } catch (err) {
      notify('error', 'Network error: ' + err.message)
    } finally {
      setHoldActionLoadingId('')
    }
  }

  const openEditModal = (book) => {
    setSelectedBook(book)
    setEditForm({
      title: book.title,
      author: book.author,
      isbn: book.isbn,
      genre: book.genre,
      language: book.language,
      shelfLocation: book.shelfLocation || '',
      availableCopies: book.availableCopies,
      description: book.description || '',
      cover: book.cover || ''
    })
    setShowEditModal(true)
  }

  // Open delete confirmation
  const openDeleteConfirm = (book) => {
    setSelectedBook(book)
    setShowDeleteConfirm(true)
  }

  // Sort functionality
  const handleSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
  }

  // Get sorted and filtered books
  const getProcessedBooks = () => {
    let processed = [...books]

    // Apply filters
    if (filterGenre) {
      processed = processed.filter(book => book.genre === filterGenre)
    }
    if (filterStatus) {
      processed = processed.filter(book => getBookDisplayStatus(book).toLowerCase() === filterStatus)
    }

    // Apply sorting
    if (sortConfig.key) {
      processed.sort((a, b) => {
        let aVal = a[sortConfig.key]
        let bVal = b[sortConfig.key]

        // Handle string comparison
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return processed
  }

  // Get sort icon
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return ' ↕'
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
  }

  const getHoldStatusBadgeClass = (status) => {
    if (status === 'READY') return 'success'
    if (status === 'CANCELLED') return 'danger'
    return 'warning'
  }

  const getVisibleHoldRecords = () => {
    const normalizedKeyword = holdKeyword.trim().toLowerCase()

    return holdRecords.filter((hold) => {
      const matchesStatus = !holdStatusFilter || hold.status === holdStatusFilter

      if (!matchesStatus) {
        return false
      }

      if (!normalizedKeyword) {
        return true
      }

      return [
        hold.id,
        hold.bookTitle,
        hold.isbn,
        hold.userName,
        hold.userId,
        hold.userEmail,
        hold.studentId
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(normalizedKeyword))
    })
  }

  const getHoldStats = () => ({
    waiting: holdRecords.filter(hold => hold.status === 'WAITING').length,
    ready: holdRecords.filter(hold => hold.status === 'READY').length,
    cancelled: holdRecords.filter(hold => hold.status === 'CANCELLED').length,
    total: holdRecords.length
  })

  const renderMessages = () => (
    <>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </>
  )

  const getVisiblePaidFineItems = () => fineDashboard.paidFineItems.filter((item) => {
    if (fineDashboardView === 'week') {
      const paidAt = new Date(item.paidAt)
      const today = new Date()
      const start = new Date(today)
      start.setHours(0, 0, 0, 0)
      const day = start.getDay()
      start.setDate(start.getDate() + (day === 0 ? -6 : 1 - day))
      return paidAt >= start
    }
    if (fineDashboardView === 'year') {
      return new Date(item.paidAt).getFullYear() === new Date().getFullYear()
    }
    return true
  })

  const renderFineDashboardPanel = () => (
    <div className="fine-dashboard-panel">
      <div className="fine-dashboard-header">
        <div>
          <h3>Fine Dashboard</h3>
          <p>Track unpaid fines, paid collections, and the borrowers behind each payment.</p>
        </div>
        <button
          type="button"
          className="btn-secondary"
          disabled={fineDashboardLoading}
          onClick={() => fetchFineDashboard()}
        >
          {fineDashboardLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="fine-summary-grid">
        <button
          type="button"
          className={`fine-summary-tile ${fineDashboardView === 'unpaid' ? 'active' : ''}`}
          onClick={() => setFineDashboardView('unpaid')}
        >
          <span>Unpaid Fines</span>
          <strong>{formatMoney(fineDashboard.unpaidFineTotal ?? fineDashboard.fineDueToday)}</strong>
          <small>{fineDashboard.fineItemCount} borrowers need follow-up</small>
        </button>
        <button
          type="button"
          className={`fine-summary-tile ${fineDashboardView === 'paid' ? 'active' : ''}`}
          onClick={() => setFineDashboardView('paid')}
        >
          <span>Paid Fines</span>
          <strong>{formatMoney(fineDashboard.paidFineTotal)}</strong>
          <small>{fineDashboard.paidFineItemCount} collected payments</small>
        </button>
        <button
          type="button"
          className={`fine-summary-tile ${fineDashboardView === 'week' ? 'active' : ''}`}
          onClick={() => setFineDashboardView('week')}
        >
          <span>This Week</span>
          <strong>{formatMoney(fineDashboard.paidThisWeek)}</strong>
          <small>Fine income collected this week</small>
        </button>
        <button
          type="button"
          className={`fine-summary-tile ${fineDashboardView === 'year' ? 'active' : ''}`}
          onClick={() => setFineDashboardView('year')}
        >
          <span>This Year</span>
          <strong>{formatMoney(fineDashboard.paidThisYear)}</strong>
          <small>Fine income collected this year</small>
        </button>
      </div>

      <div className="fine-collection-table">
        <div className="fine-table-title">
          <h4>{fineDashboardView === 'unpaid' ? 'Who Has Not Paid' : 'Who Paid Fines'}</h4>
          <span>
            {fineDashboardView === 'unpaid'
              ? `${fineDashboard.fineItemCount} unpaid`
              : `${fineDashboard.paidFineItemCount} paid`}
          </span>
        </div>

        {fineDashboardLoading ? (
          <div className="fine-empty-state">Loading fine dashboard...</div>
        ) : fineDashboardView === 'unpaid' && fineDashboard.fineItems.length > 0 ? (
          <div className="loan-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th>Book</th>
                  <th>ISBN</th>
                  <th>Due Date</th>
                  <th>Returned</th>
                  <th>Fine</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {fineDashboard.fineItems.map((item) => (
                  <tr key={item.loanId}>
                    <td>
                      <div className="loan-record-title">{item.userName}</div>
                      <div className="loan-record-meta">{item.userEmail}</div>
                    </td>
                    <td>{item.bookTitle}</td>
                    <td>{item.isbn}</td>
                    <td>{formatDateLabel(item.dueDate)}</td>
                    <td>{formatDateLabel(item.returnDate)}</td>
                    <td className="fine-amount-cell">{formatMoney(item.fineAmount)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-sm btn-alipay"
                        disabled={payingFineId === item.loanId}
                        onClick={() => openAlipayModal(item)}
                      >
                        Alipay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : fineDashboardView !== 'unpaid' && getVisiblePaidFineItems().length > 0 ? (
          <div className="loan-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Borrower</th>
                  <th>Book</th>
                  <th>Paid Amount</th>
                  <th>Paid At</th>
                  <th>Method</th>
                  <th>Collector</th>
                </tr>
              </thead>
              <tbody>
                {getVisiblePaidFineItems().map((item) => (
                    <tr key={item.paymentId}>
                      <td>
                        <div className="loan-record-title">{item.userName}</div>
                        <div className="loan-record-meta">{item.userEmail}</div>
                      </td>
                      <td>
                        <div className="loan-record-title">{item.bookTitle}</div>
                        <div className="loan-record-meta">ISBN: {item.isbn}</div>
                      </td>
                      <td className="fine-paid-cell">{formatMoney(item.paidAmount)}</td>
                      <td>{formatDateLabel(item.paidAt)}</td>
                      <td>{item.method}</td>
                      <td>
                        <div className="loan-record-title">{item.collectorName}</div>
                        <div className="loan-record-meta">{item.collectorEmail}</div>
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fine-empty-state">
            {fineDashboardView === 'unpaid'
              ? 'No unpaid fines to collect today.'
              : 'No paid fine records for this view.'}
          </div>
        )}
      </div>
    </div>
  )

  const renderAlipayModal = () => (
    <div className="modal-overlay" onClick={closeAlipayModal}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Alipay Fine Payment</h3>
          <button className="modal-close" onClick={closeAlipayModal}>×</button>
        </div>
        <form onSubmit={handleAlipayFine} noValidate>
          <div className="modal-body">
            <div className="alipay-ticket">
              <span>Amount</span>
              <strong>{formatMoney(alipayTarget?.fineAmount)}</strong>
              <p>Order: FINE-{alipayTarget?.loanId}</p>
            </div>

            <p className="book-title-highlight">{alipayTarget?.bookTitle}</p>
            <div className="return-confirm-detail">Borrower: {alipayTarget?.userName}</div>
            <div className="return-confirm-detail">ISBN: {alipayTarget?.isbn}</div>
            <div className="return-confirm-detail">Due Date: {formatDateLabel(alipayTarget?.dueDate)}</div>

            {!alipayResult ? (
              <div className="alipay-qr-payment">
                <p>Scan the QR code with Alipay, complete the payment, then click I Have Paid.</p>
                <img src="/alipay-qr.png" alt="Alipay QR Code" />
              </div>
            ) : (
              <div className="alipay-success-box">
                <strong>Payment successful</strong>
                <p>Alipay Trade No: {alipayResult.alipayTradeNo}</p>
                <p>Out Trade No: {alipayResult.outTradeNo}</p>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={closeAlipayModal}>
              {alipayResult ? 'Close' : 'Cancel'}
            </button>
            {!alipayResult && (
              <button className="btn-alipay btn-sm" type="submit" disabled={payingFineId === alipayTarget?.loanId}>
                {payingFineId === alipayTarget?.loanId ? 'Confirming...' : 'I Have Paid'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )

  const renderDashboard = () => (
    <div className="content">
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Welcome, {user.name}!</h2>
          <p>Today is {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
        </div>
        <div className="banner-icon">📚</div>
      </div>

      {renderMessages()}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📖</div>
          <div className="stat-content">
            <h3>{fineDashboard.totalBooks}</h3>
            <p>Total Books</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div className="stat-content">
            <h3>{fineDashboard.booksInLibrary}</h3>
            <p>Books in Library</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon orange">📋</div>
          <div className="stat-content">
            <h3>{fineDashboard.checkedOutBooks}</h3>
            <p>Checked Out</p>
          </div>
        </div>
        <button type="button" className="stat-card stat-card-button" onClick={() => setFineDashboardView('unpaid')}>
          <div className="stat-icon red">🕒</div>
          <div className="stat-content">
            <h3>{formatMoney(fineDashboard.unpaidFineTotal ?? fineDashboard.fineDueToday)}</h3>
            <p>Unpaid Fines</p>
          </div>
        </button>
        <button type="button" className="stat-card stat-card-button" onClick={() => setFineDashboardView('paid')}>
          <div className="stat-icon blue">💳</div>
          <div className="stat-content">
            <h3>{formatMoney(fineDashboard.paidFineTotal)}</h3>
            <p>Paid Fines</p>
          </div>
        </button>
        <div className="stat-card">
          <div className="stat-icon red">🕒</div>
          <div className="stat-content">
            <h3>{fineDashboard.overdueBooks}</h3>
            <p>Overdue Books</p>
          </div>
        </div>
      </div>

      {renderFineDashboardPanel()}
      {alipayTarget && renderAlipayModal()}

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button className="quick-action-btn blue" onClick={() => setCurrentPage('books')}>🔍 Search Books</button>
          <button className="quick-action-btn green" onClick={() => setCurrentPage('loans-manage')}>📋 Manage Loans</button>
          <button className="quick-action-btn orange" onClick={() => setCurrentPage('manage')}>⚙️ Book Management</button>
          <button className="quick-action-btn gray" onClick={() => setCurrentPage('holds-manage')}>🗂️ Manage Holds</button>
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
                  <span className={`status-badge ${getBookStatusBadgeClass(book)}`}>
                    {getBookStatusLabel(book)}
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

  // Render Books view with search
  const renderBooks = () => {
    const isSearchMode = Boolean(activeSearchTerm)
    const displayBooks = isSearchMode ? searchResults : books

    return (
      <div className="content">
        <div className="page-header">
          <h2>📖 Books</h2>
        </div>

        {/* Search Box */}
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <select
              className="search-select"
              value={searchType}
              onChange={(e) => setSearchType(e.target.value)}
              aria-label="Search type"
            >
              <option value="all">All Fields</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
              <option value="isbn">ISBN</option>
            </select>
            <input
              type="text"
              className="search-input"
              placeholder={searchType === 'isbn' ? 'Enter ISBN...' : 'Search by title, author, or ISBN...'}
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
            />
            <button type="submit" className="search-btn" disabled={isSearching}>
              {isSearching ? 'Searching...' : '🔍 Search'}
            </button>
            {searchKeyword && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearchKeyword('')
                  setActiveSearchTerm('')
                  setSearchResults([])
                }}
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {loading && <div className="loading">Loading...</div>}
        {renderMessages()}

        <div className="books-grid">
          {displayBooks.map((book) => (
            <div key={book.id} className="book-card">
              <div className="book-cover">📚</div>
              <div className="book-info">
                <h3>{book.title}</h3>
                <p className="book-author">{book.author}</p>
                <p className="book-detail">ISBN: {book.isbn}</p>
                <p className="book-detail">Genre: {book.genre} | Language: {book.language}</p>
                <p className="book-detail">Location: {book.shelfLocation || 'N/A'}</p>
                <p className="book-detail">Copies: {book.availableCopies}</p>
                <div className="book-status">
                  <span className={`status-badge ${getBookStatusBadgeClass(book)}`}>
                    {getBookStatusLabel(book)}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-sm btn-secondary book-copy-barcode-btn"
                  onClick={() => openCopyBarcodeModal(book)}
                  disabled={copyBarcodeLoadingId === book.id}
                >
                  {copyBarcodeLoadingId === book.id ? 'Loading...' : 'Copies / Barcode'}
                </button>
              </div>
            </div>
          ))}
        </div>
        {displayBooks.length === 0 && !loading && (
          <div className="no-data">
            {isSearchMode ? `No books found for "${activeSearchTerm}"` : 'No books found'}
          </div>
        )}
        {copyBarcodeTarget && renderCopyBarcodeModal()}
      </div>
    )
  }

  // Render Manage Books view
  const renderManageBooks = () => {
    const processedBooks = getProcessedBooks()

    return (
      <div className="content">
        <div className="page-header">
          <h2>⚙️ Book Management</h2>
        </div>
        {loading && <div className="loading">Loading...</div>}
        {renderMessages()}
        <div className="management-section">
          <div className="action-buttons">
            <button className="btn-primary" onClick={() => setShowAddModal(true)}>+ Add New Book</button>
            <button className="btn-secondary" onClick={() => fetchBooks()}>🔄 Refresh</button>
          </div>

          {/* Filters */}
          <div className="filter-section">
            <div className="filter-group">
              <label>Genre:</label>
              <select value={filterGenre} onChange={(e) => setFilterGenre(e.target.value)}>
                <option value="">All Genres</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="filter-group">
              <label>Status:</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Status</option>
                <option value="available">Available</option>
                <option value="borrowed">Borrowed</option>
                <option value="unavailable">Unavailable</option>
              </select>
            </div>
          </div>

          <div className="table-section">
            <table className="data-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('title')} style={{ cursor: 'pointer' }}>
                    Title{getSortIcon('title')}
                  </th>
                  <th onClick={() => handleSort('author')} style={{ cursor: 'pointer' }}>
                    Author{getSortIcon('author')}
                  </th>
                  <th onClick={() => handleSort('isbn')} style={{ cursor: 'pointer' }}>
                    ISBN{getSortIcon('isbn')}
                  </th>
                  <th onClick={() => handleSort('genre')} style={{ cursor: 'pointer' }}>
                    Genre{getSortIcon('genre')}
                  </th>
                  <th onClick={() => handleSort('displayStatus')} style={{ cursor: 'pointer' }}>
                    Status{getSortIcon('displayStatus')}
                  </th>
                  <th onClick={() => handleSort('availableCopies')} style={{ cursor: 'pointer' }}>
                    Copies{getSortIcon('availableCopies')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {processedBooks.map((book) => (
                  <tr key={book.id}>
                    <td>{book.title}</td>
                    <td>{book.author}</td>
                    <td>{book.isbn}</td>
                    <td>{book.genre}</td>
                    <td>
                      <span className={`status-badge ${getBookStatusBadgeClass(book)}`}>
                        {getBookStatusLabel(book)}
                      </span>
                    </td>
                    <td>{book.availableCopies}</td>
                    <td className="action-buttons-cell">
                      <button
                        className="btn-sm btn-secondary"
                        onClick={() => openCopyBarcodeModal(book)}
                        disabled={copyBarcodeLoadingId === book.id}
                      >
                        {copyBarcodeLoadingId === book.id ? 'Loading...' : 'Copies / Barcode'}
                      </button>
                      <button className="btn-sm btn-edit" onClick={() => openEditModal(book)}>Edit</button>
                      <button className="btn-sm btn-delete" onClick={() => openDeleteConfirm(book)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {processedBooks.length === 0 && !loading && <div className="no-data">No books found</div>}
          </div>
        </div>

        {/* Modals */}
        {showAddModal && renderAddModal()}
        {showEditModal && renderEditModal()}
        {showDeleteConfirm && renderDeleteConfirm()}
        {copyBarcodeTarget && renderCopyBarcodeModal()}
      </div>
    )
  }

  const renderLoanManagement = () => (
    <div className="content">
      <div className="page-header">
        <h2>🔄 Loan Management</h2>
      </div>

      {renderMessages()}

      <div className="loan-management-grid">
        <div className="loan-form-card">
          <div className="loan-card-header">
            <h3>Manual Checkout</h3>
            <p>Enter the borrower and the target book to create a loan immediately.</p>
          </div>

          <form onSubmit={handleCheckoutSubmit} noValidate>
            <div className="form-group">
              <label>User ID *</label>
              <input
                type="text"
                value={checkoutForm.userId}
                onChange={(e) => {
                  setCheckoutForm(prev => ({ ...prev, userId: e.target.value }))
                  setCheckoutErrors(prev => ({ ...prev, userId: '' }))
                }}
                placeholder="Enter user ID"
              />
              {checkoutErrors.userId && <div className="field-error">{checkoutErrors.userId}</div>}
            </div>

            <div className="form-group">
              <label>Barcode / ISBN *</label>
              <div className="barcode-input-row">
                <input
                  type="text"
                  value={checkoutForm.bookIdentifier}
                  onChange={(e) => {
                    setCheckoutForm(prev => ({ ...prev, bookIdentifier: e.target.value }))
                    setCheckoutErrors(prev => ({ ...prev, bookIdentifier: '' }))
                    setBarcodeBook(null)
                  }}
                  placeholder="Scan barcode or enter ISBN"
                />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={barcodeLookupLoading || checkoutLoading}
                  onClick={handleBarcodeLookup}
                >
                  {barcodeLookupLoading ? 'Looking up...' : 'Lookup'}
                </button>
              </div>
              {checkoutErrors.bookIdentifier && (
                <div className="field-error">{checkoutErrors.bookIdentifier}</div>
              )}
            </div>

            {barcodeBook && (
              <div className={`barcode-result ${getBookDisplayStatus(barcodeBook) === 'AVAILABLE' ? 'available' : 'unavailable'}`}>
                <div>
                  <span className="barcode-result-label">Matched Book</span>
                  <strong>{barcodeBook.title}</strong>
                  <p>{barcodeBook.author} · ISBN: {barcodeBook.isbn}</p>
                  <p>Location: {barcodeBook.shelfLocation || 'N/A'} · Copies: {barcodeBook.availableCopies}</p>
                </div>
                <span className={`status-badge ${getBookStatusBadgeClass(barcodeBook)}`}>
                  {getBookStatusLabel(barcodeBook)}
                </span>
              </div>
            )}

            <p className="loan-form-hint">
              Scan with a hardware barcode scanner or type the ISBN, then look it up before checkout.
            </p>

            <div className="loan-actions-row">
              <button type="submit" className="btn-primary" disabled={checkoutLoading}>
                {checkoutLoading ? 'Checking out...' : 'Create Loan'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                disabled={checkoutLoading}
                onClick={() => {
                  setCheckoutForm({ userId: '', bookIdentifier: '' })
                  setCheckoutErrors({})
                  setBarcodeBook(null)
                }}
              >
                Reset
              </button>
            </div>
          </form>
        </div>

        <div className="loan-summary-card">
          <div className="loan-card-header">
            <h3>Live Status</h3>
            <p>Inventory and active-loan totals refresh automatically after each operation.</p>
          </div>

          <div className="loan-metric-grid">
            <div className="loan-metric-item">
              <span>Available Books</span>
              <strong>{stats.availableBooks}</strong>
            </div>
            <div className="loan-metric-item">
              <span>Active Loans</span>
              <strong>{stats.myLoans}</strong>
            </div>
            <div className="loan-metric-item">
              <span>Overdue</span>
              <strong>{loanRecords.filter(loan => loan.status === 'Overdue').length}</strong>
            </div>
            <div className="loan-metric-item">
              <span>Total Books</span>
              <strong>{stats.totalBooks}</strong>
            </div>
          </div>

          <button
            className="btn-secondary loan-refresh-btn"
            onClick={() => refreshLoanManagement()}
            disabled={loanLoading || checkoutLoading || !!returningLoanId}
          >
            {loanLoading ? 'Refreshing...' : 'Refresh Status'}
          </button>
        </div>
      </div>

      <div className="table-section loan-records-section">
        <div className="loan-records-header">
          <h3>Active Loan Records</h3>
          <p>Return a book here and the system will calculate any overdue fine automatically.</p>
        </div>

        {loanLoading ? (
          <div className="loading">Loading loan records...</div>
        ) : loanRecords.length === 0 ? (
          <div className="no-data">No active loan records</div>
        ) : (
          <div className="loan-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Book</th>
                  <th>Borrower</th>
                  <th>Checkout Date</th>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loanRecords.map((loan) => (
                  <tr key={loan.id}>
                    <td>
                      <div className="loan-record-title">{loan.bookTitle}</div>
                      <div className="loan-record-meta">ISBN: {loan.isbn}</div>
                    </td>
                    <td>
                      <div className="loan-record-title">{loan.userName}</div>
                      <div className="loan-record-meta">{loan.userId}</div>
                    </td>
                    <td>{formatDateLabel(loan.checkoutDate)}</td>
                    <td>{formatDateLabel(loan.dueDate)}</td>
                    <td>
                      <span className={`status-badge ${
                        loan.status === 'Overdue'
                          ? 'warning'
                          : loan.status === 'Returned'
                            ? 'info'
                            : 'success'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="action-buttons-cell">
                      <button
                        className="btn-sm btn-edit"
                        disabled={returningLoanId === loan.id}
                        onClick={() => setReturnTarget(loan)}
                      >
                        {returningLoanId === loan.id ? 'Returning...' : 'Return'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {returnTarget && renderReturnConfirm()}
    </div>
  )

  const renderScanner = () => {
    return (
      <div className="content">
        <div className="page-header">
          <h2>📷 Book Scanner</h2>
        </div>
        {renderMessages()}
        <div className="scanner-section">
          <div className="scanner-card">
            <div className="scanner-input-area">
              <label>Enter ISBN or Barcode:</label>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleScanBook(scanInput);
                    }
                  }}
                  placeholder="Enter ISBN or scan barcode"
                  style={{ flex: 1, padding: '10px', fontSize: '16px' }}
                />
                <button
                  onClick={() => handleScanBook(scanInput)}
                  disabled={scanLoading || !scanInput.trim()}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: scanLoading ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: scanLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px'
                  }}
                >
                  {scanLoading ? 'Scanning...' : 'Scan'}
                </button>
              </div>
              {scanError && <div className="error-message" style={{ marginTop: '10px' }}>{scanError}</div>}
            </div>

            {scanResult && (
              <div className="scanner-result" style={{ marginTop: '30px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px' }}>📚 Book Found</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div><strong>Title:</strong></div>
                  <div>{scanResult.title}</div>
                  <div><strong>Author:</strong></div>
                  <div>{scanResult.author}</div>
                  <div><strong>ISBN:</strong></div>
                  <div>{scanResult.isbn}</div>
                  <div><strong>Genre:</strong></div>
                  <div>{scanResult.genre}</div>
                  <div><strong>Language:</strong></div>
                  <div>{scanResult.language}</div>
                  <div><strong>Shelf Location:</strong></div>
                  <div>{scanResult.shelfLocation || 'N/A'}</div>
                  <div><strong>Available:</strong></div>
                  <div>{scanResult.availableCopies} / {scanResult.totalCopies || scanResult.availableCopies}</div>
                </div>
                <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => {
                      setScanInput('');
                      setScanResult(null);
                      setScanError('');
                    }}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderHoldManagement = () => {
    const holdStats = getHoldStats()
    const visibleHoldRecords = getVisibleHoldRecords()

    return (
      <div className="content">
        <div className="page-header">
          <h2>🗂️ Hold Management</h2>
        </div>

        {renderMessages()}

        <div className="hold-stats-grid">
          <div className="stat-card">
            <div className="stat-icon orange">⏳</div>
            <div className="stat-content">
              <h3>{holdStats.waiting}</h3>
              <p>WAITING</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green">✅</div>
            <div className="stat-content">
              <h3>{holdStats.ready}</h3>
              <p>READY</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">✖</div>
            <div className="stat-content">
              <h3>{holdStats.cancelled}</h3>
              <p>CANCELLED</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">📚</div>
            <div className="stat-content">
              <h3>{holdStats.total}</h3>
              <p>Total Holds</p>
            </div>
          </div>
        </div>

        <div className="hold-management-panel">
          <div className="hold-toolbar">
            <div className="hold-filter-group">
              <label>Status</label>
              <select value={holdStatusFilter} onChange={(e) => setHoldStatusFilter(e.target.value)}>
                <option value="">All Status</option>
                {HOLD_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="hold-search-group">
              <label>Search</label>
              <input
                type="text"
                value={holdKeyword}
                onChange={(e) => setHoldKeyword(e.target.value)}
                placeholder="Search hold ID, book, ISBN, user..."
              />
            </div>

            <button
              className="btn-secondary hold-refresh-btn"
              onClick={() => refreshHoldManagement()}
              disabled={holdLoading || !!holdActionLoadingId}
            >
              {holdLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          <div className="hold-toolbar-note">
            Librarians can mark a WAITING reservation as READY when stock is available, or cancel WAITING and READY reservations.
          </div>

          {holdLoading ? (
            <div className="loading">Loading reservation records...</div>
          ) : visibleHoldRecords.length === 0 ? (
            <div className="no-data">No reservation records found for the selected filters</div>
          ) : (
            <div className="hold-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Reservation ID</th>
                    <th>Book</th>
                    <th>User</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleHoldRecords.map((hold) => {
                    const isExpanded = expandedHoldId === hold.id

                    return (
                      <React.Fragment key={hold.id}>
                        <tr
                          className={`hold-row ${isExpanded ? 'expanded' : ''}`}
                          onClick={() => setExpandedHoldId(isExpanded ? '' : hold.id)}
                        >
                          <td>
                            <div className="loan-record-title">{hold.id}</div>
                            <div className="loan-record-meta">Updated: {formatDateLabel(hold.updatedAt)}</div>
                          </td>
                          <td>
                            <div className="loan-record-title">{hold.bookTitle}</div>
                            <div className="loan-record-meta">ISBN: {hold.isbn}</div>
                          </td>
                          <td>
                            <div className="loan-record-title">{hold.userName}</div>
                            <div className="loan-record-meta">{hold.userId}</div>
                          </td>
                          <td>
                            <span className={`status-badge ${getHoldStatusBadgeClass(hold.status)}`}>
                              {hold.status}
                            </span>
                          </td>
                          <td>{formatDateLabel(hold.createdAt)}</td>
                          <td className="action-buttons-cell" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn-sm btn-secondary-action"
                              onClick={() => setExpandedHoldId(isExpanded ? '' : hold.id)}
                            >
                              {isExpanded ? 'Hide' : 'Details'}
                            </button>
                            {hold.status === 'WAITING' && (
                              <button
                                className="btn-sm btn-edit"
                                disabled={holdActionLoadingId === hold.id}
                                onClick={() => setReadyTarget(hold)}
                              >
                                {holdActionLoadingId === hold.id ? 'Processing...' : 'Ready'}
                              </button>
                            )}
                            {['WAITING', 'READY'].includes(hold.status) && (
                              <button
                                className="btn-sm btn-delete"
                                disabled={holdActionLoadingId === hold.id}
                                onClick={() => setCancelHoldTarget(hold)}
                              >
                                {holdActionLoadingId === hold.id ? 'Processing...' : 'Cancel'}
                              </button>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="hold-detail-row">
                            <td colSpan="6">
                              <div className="hold-detail-grid">
                                <div className="hold-detail-card">
                                  <h4>User Details</h4>
                                  <p><strong>Name:</strong> {hold.userName}</p>
                                  <p><strong>User ID:</strong> {hold.userId}</p>
                                  <p><strong>Email:</strong> {hold.userEmail || '-'}</p>
                                  <p><strong>Student ID:</strong> {hold.studentId || '-'}</p>
                                </div>
                                <div className="hold-detail-card">
                                  <h4>Book Details</h4>
                                  <p><strong>Title:</strong> {hold.bookTitle}</p>
                                  <p><strong>Author:</strong> {hold.bookAuthor}</p>
                                  <p><strong>ISBN:</strong> {hold.isbn}</p>
                                  <p><strong>Genre:</strong> {hold.genre}</p>
                                  <p><strong>Language:</strong> {hold.language}</p>
                                  <p><strong>Shelf:</strong> {hold.shelfLocation}</p>
                                  <p><strong>Available Copies:</strong> {hold.availableCopies}</p>
                                </div>
                                <div className="hold-detail-card">
                                  <h4>Status Timeline</h4>
                                  <p><strong>Reserved At:</strong> {formatDateLabel(hold.createdAt)}</p>
                                  <p><strong>Ready At:</strong> {formatDateLabel(hold.readyAt)}</p>
                                  <p><strong>Last Updated:</strong> {formatDateLabel(hold.updatedAt)}</p>
                                  <p><strong>Current Status:</strong> {hold.status}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {readyTarget && renderHoldReadyConfirm()}
        {cancelHoldTarget && renderHoldCancelConfirm()}
      </div>
    )
  }

  // Add Book Modal
  const renderAddModal = () => (
    <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
      <div className="modal-content add-book-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add New Book</h3>
          <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
        </div>
        <form onSubmit={handleAddBook} className="modal-body">
          {addForm.localError && <div className="error-message" style={{ marginBottom: '15px' }}>{addForm.localError}</div>}
          <div className="form-group">
            <label>ISBN *</label>
            <div className="isbn-lookup-row">
              <input
                type="text"
                required
                value={addForm.isbn}
                onChange={(e) => setAddForm({ ...addForm, isbn: e.target.value })}
                placeholder="Enter ISBN"
              />
              <button
                type="button"
                onClick={() => handleLookupIsbn(addForm.isbn)}
                disabled={lookupLoading || !addForm.isbn}
                className="isbn-lookup-btn"
              >
                {lookupLoading ? 'Searching...' : 'Lookup'}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label>Title *</label>
            <input
              type="text"
              required
              value={addForm.title}
              onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
              placeholder="Enter book title"
            />
          </div>
          <div className="form-group">
            <label>Author *</label>
            <input
              type="text"
              required
              value={addForm.author}
              onChange={(e) => setAddForm({ ...addForm, author: e.target.value })}
              placeholder="Enter author name"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Genre *</label>
              <select
                required
                value={addForm.genre}
                onChange={(e) => setAddForm({ ...addForm, genre: e.target.value })}
              >
                <option value="">Select Genre</option>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Language *</label>
              <select
                required
                value={addForm.language}
                onChange={(e) => setAddForm({ ...addForm, language: e.target.value })}
              >
                <option value="">Select Language</option>
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Shelf Location</label>
              <input
                type="text"
                value={addForm.shelfLocation}
                onChange={(e) => setAddForm({ ...addForm, shelfLocation: e.target.value })}
                placeholder="e.g., TECH-001"
              />
            </div>
            <div className="form-group">
              <label>Available Copies</label>
              <input
                type="number"
                min="0"
                value={addForm.availableCopies}
                onChange={(e) => setAddForm({ ...addForm, availableCopies: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={addForm.description}
              onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
              placeholder="Book description"
              rows="3"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : 'Add Book'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  // Edit Book Modal
  const renderEditModal = () => (
    <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Book</h3>
          <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
        </div>
        <form onSubmit={handleEditBook}>
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Author</label>
            <input
              type="text"
              value={editForm.author}
              onChange={(e) => setEditForm({ ...editForm, author: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>ISBN</label>
            <input
              type="text"
              value={editForm.isbn}
              onChange={(e) => setEditForm({ ...editForm, isbn: e.target.value })}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Genre</label>
              <select
                value={editForm.genre}
                onChange={(e) => setEditForm({ ...editForm, genre: e.target.value })}
              >
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Language</label>
              <select
                value={editForm.language}
                onChange={(e) => setEditForm({ ...editForm, language: e.target.value })}
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Shelf Location</label>
              <input
                type="text"
                value={editForm.shelfLocation}
                onChange={(e) => setEditForm({ ...editForm, shelfLocation: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Available Copies</label>
              <input
                type="number"
                min="0"
                value={editForm.availableCopies}
                onChange={(e) => setEditForm({ ...editForm, availableCopies: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows="3"
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )

  const renderCopyBarcodeModal = () => (
    <div className="modal-overlay" onClick={() => setCopyBarcodeTarget(null)}>
      <div className="modal-content copy-barcode-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Copy Barcodes</h3>
          <button className="modal-close" onClick={() => setCopyBarcodeTarget(null)}>×</button>
        </div>
        <div className="modal-body">
          <p className="book-title-highlight">{copyBarcodeTarget?.title}</p>
          <div className="return-confirm-detail">ISBN: {copyBarcodeTarget?.isbn}</div>
          <div className="return-confirm-detail">Shelf: {copyBarcodeTarget?.shelfLocation || 'N/A'}</div>

          {copyBarcodeTarget?.copies?.length > 0 ? (
            <div className="copy-barcode-grid">
              {copyBarcodeTarget.copies.map((copy, index) => (
                <div className="copy-barcode-card" key={copy.id}>
                  <CopyBarcode value={copy.barcode} />
                  <div className="copy-barcode-meta">
                    <strong>Copy {index + 1}</strong>
                    <span>{copy.barcode}</span>
                    <em className={copy.available ? 'copy-available' : 'copy-borrowed'}>
                      {copy.available ? 'Available' : 'Borrowed'}
                    </em>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="fine-empty-state">No physical copies found for this book.</div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setCopyBarcodeTarget(null)}>Close</button>
        </div>
      </div>
    </div>
  )

  // Delete Confirmation Modal
  const renderDeleteConfirm = () => (
    <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirm Delete</h3>
          <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>×</button>
        </div>
        <div className="modal-body">
          <p>Are you sure you want to delete this book?</p>
          <p className="book-title-highlight">{selectedBook?.title}</p>
          <p className="warning-text">This action cannot be undone.</p>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
          <button className="btn-danger" onClick={handleDeleteBook} disabled={loading}>
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderReturnConfirm = () => (
    <div className="modal-overlay" onClick={() => setReturnTarget(null)}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Confirm Return</h3>
          <button className="modal-close" onClick={() => setReturnTarget(null)}>×</button>
        </div>
        <div className="modal-body">
          <p>Confirm returning this book?</p>
          <p className="book-title-highlight">{returnTarget?.bookTitle}</p>
          <div className="return-confirm-detail">Borrower: {returnTarget?.userName}</div>
          <div className="return-confirm-detail">User ID: {returnTarget?.userId}</div>
          <div className="return-confirm-detail">Due Date: {formatDateLabel(returnTarget?.dueDate)}</div>
          {returnTarget?.status === 'Overdue' && (
            <p className="warning-text">This loan is overdue. The system will calculate the fine automatically.</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setReturnTarget(null)}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirmReturn} disabled={returningLoanId === returnTarget?.id}>
            {returningLoanId === returnTarget?.id ? 'Returning...' : 'Confirm Return'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderHoldReadyConfirm = () => (
    <div className="modal-overlay" onClick={() => setReadyTarget(null)}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Mark Reservation Ready</h3>
          <button className="modal-close" onClick={() => setReadyTarget(null)}>×</button>
        </div>
        <div className="modal-body">
          <p>Confirm that this reserved book is ready for pickup?</p>
          <p className="book-title-highlight">{readyTarget?.bookTitle}</p>
          <div className="return-confirm-detail">Reservation ID: {readyTarget?.id}</div>
          <div className="return-confirm-detail">Borrower: {readyTarget?.userName}</div>
          <div className="return-confirm-detail">Available Copies: {readyTarget?.availableCopies}</div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setReadyTarget(null)}>Cancel</button>
          <button className="btn-primary" onClick={handleConfirmHoldReady} disabled={holdActionLoadingId === readyTarget?.id}>
            {holdActionLoadingId === readyTarget?.id ? 'Saving...' : 'Confirm Ready'}
          </button>
        </div>
      </div>
    </div>
  )

  const renderHoldCancelConfirm = () => (
    <div className="modal-overlay" onClick={() => setCancelHoldTarget(null)}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Cancel Reservation</h3>
          <button className="modal-close" onClick={() => setCancelHoldTarget(null)}>×</button>
        </div>
        <div className="modal-body">
          <p>Confirm cancelling this reservation?</p>
          <p className="book-title-highlight">{cancelHoldTarget?.bookTitle}</p>
          <div className="return-confirm-detail">Reservation ID: {cancelHoldTarget?.id}</div>
          <div className="return-confirm-detail">Borrower: {cancelHoldTarget?.userName}</div>
          <div className="return-confirm-detail">Current Status: {cancelHoldTarget?.status}</div>
          {cancelHoldTarget?.status === 'READY' && (
            <p className="warning-text">Cancelling a READY reservation will restore one copy back to inventory.</p>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={() => setCancelHoldTarget(null)}>Keep Reservation</button>
          <button className="btn-danger" onClick={handleConfirmHoldCancel} disabled={holdActionLoadingId === cancelHoldTarget?.id}>
            {holdActionLoadingId === cancelHoldTarget?.id ? 'Cancelling...' : 'Confirm Cancel'}
          </button>
        </div>
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
    case 'holds-manage':
      return renderHoldManagement()
    case 'scanner':
      return renderScanner()
    default:
      return <div className="content"><div className="page-header"><h2>Under development...</h2></div></div>
  }
}

export default LibrarianDashboard
