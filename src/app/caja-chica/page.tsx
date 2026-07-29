'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import {
  Receipt, Plus, Minus, Search, Loader2, Download, Scale,
  Trash2, AlertTriangle, CheckCircle, Calendar, RefreshCw,
  ChevronLeft, ChevronRight, Eye, RotateCcw, ArrowDownLeft, ArrowUpRight
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import Modal from '@/components/Modal'
import PermissionGuard from '@/components/PermissionGuard'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend
} from 'recharts'

interface Transaction {
  id: string
  type: 'INPUT' | 'OUTPUT'
  amount: number
  original_amount?: number | null
  returned_amount?: number | null
  return_logs?: Array<{
    id: string
    amount: number
    note: string
    date: string
    created_at: string
    created_by: string
    created_by_name: string
  }> | null
  giver: string
  receiver: string
  date: string
  note: string | null
  category_id?: string | null
  category_custom?: string | null
  is_billed?: boolean
  created_at: string
  users: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
  catalog_spending_categories?: {
    id: string
    name: string
  } | null
}

interface Conteo {
  id: string
  date: string
  system_amount: number
  real_amount: number
  discrepancy: number
  note: string | null
  created_at: string
  users: {
    first_name: string | null
    last_name: string | null
    email: string
  } | null
}

const getLocalDatetimeString = (dateObj: Date = new Date()) => {
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  const hours = String(dateObj.getHours()).padStart(2, '0')
  const minutes = String(dateObj.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

export default function CajaChicaPage() {
  const { t } = useI18n()
  const { profile, hasPermission } = useUser()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'transacciones' | 'conteos'>('transacciones')

  // Data
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [conteos, setConteos] = useState<Conteo[]>([])
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([])
  const [kpis, setKpis] = useState({
    currentBalance: 0,
    totalInputs: 0,
    totalOutputs: 0,
    lastConteo: null as Conteo | null
  })

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Pagination
  const [page, setPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(15)

  // Modals
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [txModalType, setTxModalType] = useState<'INPUT' | 'OUTPUT'>('INPUT')
  const [isConteoModalOpen, setIsConteoModalOpen] = useState(false)

  // Detail Modal & Money Return Modal
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)
  const [selectedTxForDetail, setSelectedTxForDetail] = useState<Transaction | null>(null)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false)
  const [returnFormData, setReturnFormData] = useState({
    amount: '',
    note: '',
    date: getLocalDatetimeString()
  })
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false)

  const handleOpenDetailModal = (tx: Transaction) => {
    setSelectedTxForDetail(tx)
    setIsDetailModalOpen(true)
  }

  const handleSaveReturn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTxForDetail) return
    try {
      setIsSubmittingReturn(true)
      const res = await fetch(`/api/caja-chica/${selectedTxForDetail.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(returnFormData)
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error al registrar devolución')

      setSelectedTxForDetail(result.data)
      setIsReturnModalOpen(false)
      setReturnFormData({ amount: '', note: '', date: getLocalDatetimeString() })
      await fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Error al guardar devolución')
    } finally {
      setIsSubmittingReturn(false)
    }
  }

  // Form States
  const [systemUsers, setSystemUsers] = useState<any[]>([])
  const [giverSelection, setGiverSelection] = useState('')
  const [giverOtherText, setGiverOtherText] = useState('')
  const [receiverSelection, setReceiverSelection] = useState('')
  const [receiverOtherText, setReceiverOtherText] = useState('')

  const [txFormData, setTxFormData] = useState({
    amount: '',
    giver: '',
    receiver: '',
    date: getLocalDatetimeString(),
    note: '',
    category_id: '',
    category_custom: '',
    is_billed: false
  })

  const [conteoFormData, setConteoFormData] = useState({
    system_amount: 0,
    real_amount: '',
    date: getLocalDatetimeString(),
    note: ''
  })

  const [isSaving, setIsSaving] = useState(false)

  // Fetch Data
  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Query transactions & KPIs
      const q = new URLSearchParams()
      if (startDate) q.append('startDate', startDate)
      if (endDate) q.append('endDate', endDate)
      if (typeFilter) q.append('type', typeFilter)
      if (searchTerm) q.append('search', searchTerm)

      const txRes = await fetch(`/api/caja-chica?${q.toString()}`)
      if (!txRes.ok) throw new Error('Error al cargar transacciones')
      const { data } = await txRes.json()

      setTransactions(data.transactions)
      setKpis({
        currentBalance: data.currentBalance,
        totalInputs: data.totalInputs,
        totalOutputs: data.totalOutputs,
        lastConteo: data.lastConteo
      })

      // Query counts (conteos)
      const conteosRes = await fetch('/api/caja-chica/conteos')
      if (!conteosRes.ok) throw new Error('Error al cargar conteos')
      const conteosData = await conteosRes.json()
      setConteos(conteosData.data)

    } catch (err: any) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [startDate, endDate, typeFilter])

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/cirugias/usuarios')
        if (res.ok) {
          const { data } = await res.json()
          setSystemUsers(data || [])
        }
      } catch (err) {
        console.error('Error fetching system users:', err)
      }
    }

    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/gastos/categories')
        if (res.ok) {
          const { data } = await res.json()
          setCategories(data || [])
        }
      } catch (err) {
        console.error('Error fetching categories:', err)
      }
    }

    fetchUsers()
    fetchCategories()
  }, [])

  // Trigger search on debounce or enter
  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchData()
    }
  }

  // Save Transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!txFormData.amount || parseFloat(txFormData.amount) <= 0 || !txFormData.giver || !txFormData.receiver || !txFormData.date) {
      alert('Por favor complete todos los campos obligatorios.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/caja-chica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txModalType,
          amount: parseFloat(txFormData.amount),
          giver: txFormData.giver,
          receiver: txFormData.receiver,
          date: new Date(txFormData.date).toISOString(),
          note: txFormData.note,
          category_id: txModalType === 'OUTPUT' ? txFormData.category_id || null : null,
          category_custom: txModalType === 'OUTPUT' ? txFormData.category_custom || null : null,
          is_billed: txModalType === 'OUTPUT' ? txFormData.is_billed : false
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al guardar transacción')
      }

      setIsTxModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Save Conteo
  const handleSaveConteo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (conteoFormData.real_amount === '' || !conteoFormData.date) {
      alert('Por favor complete los campos obligatorios.')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch('/api/caja-chica/conteos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_amount: conteoFormData.system_amount,
          real_amount: parseFloat(conteoFormData.real_amount),
          date: new Date(conteoFormData.date).toISOString(),
          note: conteoFormData.note
        })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Error al registrar conteo')
      }

      setIsConteoModalOpen(false)
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Transaction
  const handleDeleteTransaction = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este movimiento de caja chica?')) return

    try {
      const res = await fetch(`/api/caja-chica/${id}`, {
        method: 'DELETE'
      })
      if (!res.ok) throw new Error('Error al eliminar transacción')
      fetchData()
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    }
  }

  const handleExport = (format: 'pdf' | 'excel') => {
    const q = new URLSearchParams()
    q.append('format', format)
    if (startDate) q.append('startDate', startDate)
    if (endDate) q.append('endDate', endDate)
    window.open(`/api/caja-chica/export?${q.toString()}`, '_blank')
  }

  // Prepare chart data (Daily trend)
  const chartData = [...transactions]
    .reverse()
    .reduce((acc: any[], curr) => {
      const dateStr = new Date(curr.date).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
      const amount = curr.amount
      const existing = acc.find(item => item.date === dateStr)

      let input = curr.type === 'INPUT' ? amount : 0
      let output = curr.type === 'OUTPUT' ? amount : 0

      if (existing) {
        existing.input += input
        existing.output += output
      } else {
        acc.push({ date: dateStr, input, output, balance: 0 })
      }
      return acc
    }, [])

  // Calculate rolling balance for chart aligning with the current balance
  const totalChartInputs = chartData.reduce((sum, item) => sum + item.input, 0)
  const totalChartOutputs = chartData.reduce((sum, item) => sum + item.output, 0)
  let runningBal = kpis.currentBalance - totalChartInputs + totalChartOutputs

  chartData.forEach(item => {
    runningBal += (item.input - item.output)
    item.balance = runningBal
  })

  const formatCurrencyMXN = (val: number) => {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val)
  }

  const formatDateString = (str: string) => {
    return new Date(str).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <AppShell>
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <Receipt className="text-[#0763a9]" size={28} />
              Caja Chica
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Control de fondos menores, ingresos, egresos y auditorías físicas frecuentes
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <PermissionGuard section="caja_chica" action="create">
              <button
                onClick={() => {
                  const loggedInName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : ''
                  setTxModalType('INPUT')
                  setTxFormData({
                    amount: '',
                    giver: '',
                    receiver: loggedInName,
                    date: getLocalDatetimeString(),
                    note: '',
                    category_id: '',
                    category_custom: '',
                    is_billed: false
                  })
                  setGiverSelection('')
                  setGiverOtherText('')
                  setReceiverSelection(loggedInName)
                  setReceiverOtherText('')
                  setIsTxModalOpen(true)
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
              >
                <Plus size={16} /> Ingresar
              </button>

              <button
                onClick={() => {
                  const loggedInName = profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email : ''
                  setTxModalType('OUTPUT')
                  setTxFormData({
                    amount: '',
                    giver: loggedInName,
                    receiver: '',
                    date: getLocalDatetimeString(),
                    note: '',
                    category_id: '',
                    category_custom: '',
                    is_billed: false
                  })
                  setGiverSelection(loggedInName)
                  setGiverOtherText('')
                  setReceiverSelection('')
                  setReceiverOtherText('')
                  setIsTxModalOpen(true)
                }}
                className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition flex items-center gap-2"
              >
                <Minus size={16} /> Retirar
              </button>

              <button
                onClick={() => {
                  setConteoFormData({
                    system_amount: kpis.currentBalance,
                    real_amount: '',
                    date: getLocalDatetimeString(),
                    note: ''
                  })
                  setIsConteoModalOpen(true)
                }}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
              >
                <Scale size={16} /> Realizar Conteo
              </button>
            </PermissionGuard>

            <div className="flex gap-1 border border-gray-300 rounded-lg overflow-hidden bg-white">
              <button
                onClick={() => handleExport('excel')}
                className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5 border-r border-gray-200"
              >
                <Download size={14} /> Excel
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <Download size={14} /> PDF
              </button>
            </div>

            <button
              onClick={fetchData}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white transition"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </header>

        {/* KPI Panel */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div
            className="p-5 rounded-2xl text-white shadow-md flex flex-col justify-between"
            style={{ background: 'linear-gradient(135deg, #0763a9 0%, #008be5 100%)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wider opacity-80">Saldo actual en caja</span>
            <div className="mt-2 text-3xl font-extrabold">{formatCurrencyMXN(kpis.currentBalance)}</div>
            <span className="text-[10px] opacity-70 mt-1">Suma acumulada del sistema</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total ingresos</span>
            <div className="mt-2 text-2xl font-bold text-gray-900">{formatCurrencyMXN(kpis.totalInputs)}</div>
            <span className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">📥 Dinero ingresado</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between border-l-4 border-l-amber-500">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total egresos</span>
            <div className="mt-2 text-2xl font-bold text-gray-900">{formatCurrencyMXN(kpis.totalOutputs)}</div>
            <span className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">📤 Retiros y gastos menores</span>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col justify-between border-l-4 border-l-slate-700">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Último conteo físico</span>
            {kpis.lastConteo ? (
              <div className="mt-2">
                <div className="text-lg font-bold text-gray-900">
                  {formatCurrencyMXN(kpis.lastConteo.real_amount)}
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {kpis.lastConteo.discrepancy === 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle size={10} /> Cuadrado
                    </span>
                  ) : kpis.lastConteo.discrepancy < 0 ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold flex items-center gap-0.5">
                      <AlertTriangle size={10} /> Faltante: {formatCurrencyMXN(Math.abs(kpis.lastConteo.discrepancy))}
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold flex items-center gap-0.5">
                      <CheckCircle size={10} /> Sobrante: {formatCurrencyMXN(kpis.lastConteo.discrepancy)}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-gray-500 italic">No se han realizado conteos</div>
            )}
            <span className="text-[10px] text-gray-400 mt-1">
              {kpis.lastConteo ? `Hecho: ${new Date(kpis.lastConteo.date).toLocaleDateString('es-MX')}` : 'Sin auditoría'}
            </span>
          </div>
        </div>

        {/* Charts Panel */}
        {chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Historial de Saldo</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0763a9" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0763a9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => [formatCurrencyMXN(Number(value)), 'Saldo']} />
                    <Area type="monotone" dataKey="balance" stroke="#0763a9" strokeWidth={2} fillOpacity={1} fill="url(#colorBalance)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Ingresos vs Egresos por día</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => formatCurrencyMXN(Number(value))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="input" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="output" name="Egresos" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Tab Selection */}
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('transacciones')}
            className={`py-2.5 px-5 font-semibold text-sm border-b-2 transition ${activeTab === 'transacciones'
                ? 'border-[#0763a9] text-[#0763a9]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Transacciones
          </button>
          <button
            onClick={() => setActiveTab('conteos')}
            className={`py-2.5 px-5 font-semibold text-sm border-b-2 transition ${activeTab === 'conteos'
                ? 'border-[#0763a9] text-[#0763a9]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            Conteos Físicos ({conteos.length})
          </button>
        </div>

        {/* Transaction / Conteo list */}
        {activeTab === 'transacciones' ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4">
            {/* Search and Filters */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar por concepto, entregador o receptor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Todos los tipos</option>
                <option value="INPUT">Ingresos (+)</option>
                <option value="OUTPUT">Egresos (-)</option>
              </select>

              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <span className="text-gray-400 text-xs">al</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                />
              </div>

              <button
                onClick={fetchData}
                className="btn-primary text-xs px-4 py-2 rounded-lg bg-[#0763a9] hover:bg-[#06508a] text-white transition font-medium"
              >
                Filtrar
              </button>
            </div>

            {(() => {
              const totalItems = transactions.length
              const totalPages = Math.ceil(totalItems / itemsPerPage) || 1
              const paginatedTransactions = transactions.slice((page - 1) * itemsPerPage, page * itemsPerPage)

              if (loading) {
                return (
                  <div className="p-12 flex justify-center">
                    <Loader2 className="w-8 h-8 text-[#0763a9] animate-spin" />
                  </div>
                )
              }
              if (error) {
                return <div className="p-8 text-center text-red-500 font-medium">{error}</div>
              }
              if (transactions.length === 0) {
                return <div className="p-12 text-center text-gray-500">No se encontraron movimientos registrados.</div>
              }

              return (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-6 py-4">Fecha y Hora</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Categoría</th>
                          <th className="px-6 py-4">Facturado</th>
                          <th className="px-6 py-4">Monto</th>
                          <th className="px-6 py-4">Entregó</th>
                          <th className="px-6 py-4">Recibió</th>
                          <th className="px-6 py-4">Nota / Concepto</th>
                          <th className="px-6 py-4">Por</th>
                          <th className="px-6 py-4 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedTransactions.map((tx) => (
                          <tr 
                            key={tx.id} 
                            onClick={() => handleOpenDetailModal(tx)}
                            className="border-b border-gray-100 hover:bg-blue-50/40 transition cursor-pointer"
                          >
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {formatDateString(tx.date)}
                            </td>
                            <td className="px-6 py-4">
                              {tx.type === 'INPUT' ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                  Ingreso
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                                  Egreso
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {tx.type === 'OUTPUT' ? (
                                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
                                  {tx.catalog_spending_categories?.name || tx.category_custom || 'Sin categoría'}
                                  {tx.catalog_spending_categories?.name === 'Otros' && tx.category_custom && (
                                    <span className="ml-1 text-blue-900 font-semibold">({tx.category_custom})</span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {tx.type === 'OUTPUT' ? (
                                tx.is_billed ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                                    <CheckCircle size={12} /> Facturado
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                    No
                                  </span>
                                )
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 font-semibold text-gray-900">
                              <div>
                                <span>{tx.type === 'INPUT' ? '+' : '-'}{formatCurrencyMXN(tx.amount)}</span>
                                {Boolean(tx.returned_amount && tx.returned_amount > 0) && (
                                  <div className="text-[10px] font-normal text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 mt-1 inline-block">
                                    Devuelto: {formatCurrencyMXN(tx.returned_amount || 0)} (Orig: {formatCurrencyMXN(tx.original_amount || (tx.amount + (tx.returned_amount || 0)))})
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-gray-700">{tx.giver}</td>
                            <td className="px-6 py-4 text-gray-700">{tx.receiver}</td>
                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={tx.note || ''}>
                              {tx.note || '-'}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                              {tx.users ? `${tx.users.first_name || ''} ${tx.users.last_name || ''}`.trim() : 'Sistema'}
                            </td>
                            <td className="px-6 py-4 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(tx); }}
                                  className="text-blue-600 hover:text-blue-800 p-1.5 rounded-md hover:bg-blue-50 transition"
                                  title="Ver detalle del registro"
                                >
                                  <Eye size={16} />
                                </button>
                                <PermissionGuard section="caja_chica" action="delete">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }}
                                    className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition"
                                    title="Eliminar registro"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </PermissionGuard>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Controls */}
                  <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 font-medium">
                        Mostrando <strong className="text-gray-900">{Math.min((page - 1) * itemsPerPage + 1, totalItems)}</strong>–<strong className="text-gray-900">{Math.min(page * itemsPerPage, totalItems)}</strong> de <strong className="text-gray-900">{totalItems}</strong> transacciones
                      </span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => {
                          setItemsPerPage(Number(e.target.value))
                          setPage(1)
                        }}
                        className="px-2 py-1 border border-gray-300 rounded text-xs bg-white text-gray-700 font-medium focus:ring-1 focus:ring-[#0763a9]"
                      >
                        <option value={10}>10 por pág.</option>
                        <option value={15}>15 por pág.</option>
                        <option value={25}>25 por pág.</option>
                        <option value={50}>50 por pág.</option>
                        <option value={100}>100 por pág.</option>
                      </select>
                    </div>
                    {totalPages > 1 && (
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPage((p) => Math.max(p - 1, 1))}
                          disabled={page === 1}
                          className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          aria-label="Página anterior"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <span className="text-xs text-gray-600 px-2 font-semibold">
                          Pág. {page} de {totalPages}
                        </span>
                        <button
                          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                          disabled={page === totalPages}
                          className="p-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          aria-label="Página siguiente"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          /* Conteos Audit Tab */
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 text-[#0763a9] animate-spin" />
              </div>
            ) : error ? (
              <div className="p-8 text-center text-red-500 font-medium">{error}</div>
            ) : conteos.length === 0 ? (
              <div className="p-12 text-center text-gray-500">No se han registrado conteos físicos de auditoría.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4">Fecha Auditoría</th>
                      <th className="px-6 py-4">Auditor</th>
                      <th className="px-6 py-4">Saldo Sistema</th>
                      <th className="px-6 py-4">Saldo Físico</th>
                      <th className="px-6 py-4">Diferencia</th>
                      <th className="px-6 py-4">Observaciones / Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conteos.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                          {formatDateString(c.date)}
                        </td>
                        <td className="px-6 py-4 text-gray-700">
                          {c.users ? `${c.users.first_name || ''} ${c.users.last_name || ''}`.trim() : 'Sistema'}
                        </td>
                        <td className="px-6 py-4 text-gray-900">{formatCurrencyMXN(c.system_amount)}</td>
                        <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrencyMXN(c.real_amount)}</td>
                        <td className="px-6 py-4">
                          {c.discrepancy === 0 ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                              Cuadrado
                            </span>
                          ) : c.discrepancy < 0 ? (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700">
                              Faltante ({formatCurrencyMXN(c.discrepancy)})
                            </span>
                          ) : (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                              Sobrante (+{formatCurrencyMXN(c.discrepancy)})
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-600 max-w-sm truncate" title={c.note || ''}>
                          {c.note || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Transaction Modal */}
        <Modal
          open={isTxModalOpen}
          onClose={() => setIsTxModalOpen(false)}
          title={txModalType === 'INPUT' ? 'Registrar Ingreso de Dinero' : 'Registrar Egreso / Retiro'}
          maxWidth="550px"
        >
          <form onSubmit={handleSaveTransaction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Monto (MXN) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.01"
                placeholder="0.00"
                value={txFormData.amount}
                onChange={(e) => setTxFormData({ ...txFormData, amount: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Quién Entregó *
                </label>
                <select
                  value={giverSelection}
                  onChange={(e) => {
                    const val = e.target.value
                    setGiverSelection(val)
                    if (val === 'Otro') {
                      setTxFormData(prev => ({ ...prev, giver: giverOtherText }))
                    } else {
                      setTxFormData(prev => ({ ...prev, giver: val }))
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
                >
                  <option value="">-- Seleccionar --</option>
                  <option value="Caja Chica">Caja Chica</option>
                  {systemUsers.map(u => {
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
                    return (
                      <option key={u.id} value={name}>
                        {name} ({u.email})
                      </option>
                    )
                  })}
                  <option value="Otro">Otro (Especificar)</option>
                </select>

                {giverSelection === 'Otro' && (
                  <input
                    type="text"
                    required
                    placeholder="Especifique quién entregó"
                    value={giverOtherText}
                    onChange={(e) => {
                      setGiverOtherText(e.target.value)
                      setTxFormData(prev => ({ ...prev, giver: e.target.value }))
                    }}
                    className="w-full mt-2 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Quién Recibió *
                </label>
                <select
                  value={receiverSelection}
                  onChange={(e) => {
                    const val = e.target.value
                    setReceiverSelection(val)
                    if (val === 'Otro') {
                      setTxFormData(prev => ({ ...prev, receiver: receiverOtherText }))
                    } else {
                      setTxFormData(prev => ({ ...prev, receiver: val }))
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
                >
                  <option value="">-- Seleccionar --</option>
                  <option value="Caja Chica">Caja Chica</option>
                  {systemUsers.map(u => {
                    const name = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
                    return (
                      <option key={u.id} value={name}>
                        {name} ({u.email})
                      </option>
                    )
                  })}
                  <option value="Otro">Otro (Especificar)</option>
                </select>

                {receiverSelection === 'Otro' && (
                  <input
                    type="text"
                    required
                    placeholder="Especifique quién recibió"
                    value={receiverOtherText}
                    onChange={(e) => {
                      setReceiverOtherText(e.target.value)
                      setTxFormData(prev => ({ ...prev, receiver: e.target.value }))
                    }}
                    className="w-full mt-2 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
                  />
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Fecha y Hora *
              </label>
              <input
                type="datetime-local"
                required
                value={txFormData.date}
                onChange={(e) => setTxFormData({ ...txFormData, date: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
              />
            </div>

            {txModalType === 'OUTPUT' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                    Categoría de Gasto *
                  </label>
                  <select
                    value={txFormData.category_id}
                    onChange={(e) => {
                      const val = e.target.value
                      setTxFormData(prev => ({ ...prev, category_id: val }))
                    }}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
                  >
                    <option value="">-- Seleccionar Categoría --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {categories.find(c => c.id === txFormData.category_id)?.name === 'Otros' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                      Categoría Personalizada / Detalle
                    </label>
                    <input
                      type="text"
                      placeholder="Escriba la categoría (ej: Oficina, Dirección, Taller...)"
                      value={txFormData.category_custom}
                      onChange={(e) => setTxFormData(prev => ({ ...prev, category_custom: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
                    />
                  </div>
                )}

                <div className="pt-1">
                  <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-700 select-none">
                    <input
                      type="checkbox"
                      checked={txFormData.is_billed}
                      onChange={(e) => setTxFormData(prev => ({ ...prev, is_billed: e.target.checked }))}
                      className="w-4.5 h-4.5 text-[#0763a9] border-gray-300 rounded focus:ring-[#0763a9]"
                    />
                    <span>Facturado (Gasto con factura)</span>
                  </label>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Nota / Concepto
              </label>
              <textarea
                rows={3}
                placeholder="Describa el motivo del movimiento..."
                value={txFormData.note}
                onChange={(e) => setTxFormData({ ...txFormData, note: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsTxModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#0763a9] rounded-lg hover:bg-[#06508a] transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar Movimiento
              </button>
            </div>
          </form>
        </Modal>

        {/* Conteo Modal */}
        <Modal
          open={isConteoModalOpen}
          onClose={() => setIsConteoModalOpen(false)}
          title="Registrar Conteo de Auditoría Físico"
          maxWidth="550px"
        >
          <form onSubmit={handleSaveConteo} className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <span className="text-xs text-blue-600 uppercase font-semibold">Saldo de Sistema Esperado</span>
              <div className="text-2xl font-bold text-blue-900 mt-1">{formatCurrencyMXN(conteoFormData.system_amount)}</div>
              <p className="text-[10px] text-blue-500 mt-1">
                Este es el saldo que el sistema calcula en base a todas las transacciones ingresadas y egresadas.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Saldo Físico Contado (Monto Real) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0.00"
                placeholder="Ingrese el monto físico que hay en caja"
                value={conteoFormData.real_amount}
                onChange={(e) => setConteoFormData({ ...conteoFormData, real_amount: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none font-semibold text-lg"
              />
            </div>

            {conteoFormData.real_amount !== '' && (
              <div className={`p-3.5 rounded-xl border flex items-center justify-between text-sm font-semibold ${parseFloat(conteoFormData.real_amount) - conteoFormData.system_amount === 0
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : parseFloat(conteoFormData.real_amount) - conteoFormData.system_amount < 0
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-blue-50 border-blue-200 text-blue-700'
                }`}>
                <span>Diferencia calculada:</span>
                <span>
                  {formatCurrencyMXN(parseFloat(conteoFormData.real_amount) - conteoFormData.system_amount)}
                </span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Fecha y Hora de Conteo *
              </label>
              <input
                type="datetime-local"
                required
                value={conteoFormData.date}
                onChange={(e) => setConteoFormData({ ...conteoFormData, date: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                Notas de Auditoría / Observaciones
              </label>
              <textarea
                rows={3}
                placeholder="Describa si hubo faltantes, sobrantes o detalles observados..."
                value={conteoFormData.note}
                onChange={(e) => setConteoFormData({ ...conteoFormData, note: e.target.value })}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-200 focus:border-[#0763a9] outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsConteoModalOpen(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                Registrar Auditoría
              </button>
            </div>
          </form>
        </Modal>

        {/* Detail Modal */}
        <Modal
          open={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title="Detalle de Movimiento de Caja Chica"
          maxWidth="650px"
        >
          {selectedTxForDetail && (
            <div className="space-y-6">
              {/* Status Header */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                <div>
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Tipo de Movimiento</span>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedTxForDetail.type === 'INPUT' ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        <ArrowDownLeft size={14} /> Ingreso
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-amber-100 text-amber-800">
                        <ArrowUpRight size={14} /> Egreso (Retiro)
                      </span>
                    )}
                    {selectedTxForDetail.is_billed && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle size={12} /> Facturado
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">Monto Actual (Neto)</span>
                  <div className="text-2xl font-black text-gray-900 mt-0.5">
                    {selectedTxForDetail.type === 'INPUT' ? '+' : '-'}{formatCurrencyMXN(selectedTxForDetail.amount)}
                  </div>
                </div>
              </div>

              {/* Withdrawal Return Financial Cards */}
              {selectedTxForDetail.type === 'OUTPUT' && (
                <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80">
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Monto Inicial</span>
                    <div className="text-base font-extrabold text-gray-900 mt-0.5">
                      {formatCurrencyMXN(selectedTxForDetail.original_amount ?? selectedTxForDetail.amount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Dinero Devuelto</span>
                    <div className="text-base font-extrabold text-amber-700 mt-0.5">
                      {formatCurrencyMXN(selectedTxForDetail.returned_amount ?? 0)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#0763a9] uppercase tracking-tight">Retiro Neto</span>
                    <div className="text-base font-extrabold text-[#0763a9] mt-0.5">
                      {formatCurrencyMXN(selectedTxForDetail.amount)}
                    </div>
                  </div>
                </div>
              )}

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 block mb-0.5">Entregó:</span>
                  <span className="font-bold text-gray-800">{selectedTxForDetail.giver || '-'}</span>
                </div>
                <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 block mb-0.5">Recibió:</span>
                  <span className="font-bold text-gray-800">{selectedTxForDetail.receiver || '-'}</span>
                </div>
                <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 block mb-0.5">Fecha y Hora:</span>
                  <span className="font-bold text-gray-800">{formatDateString(selectedTxForDetail.date)}</span>
                </div>
                <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100">
                  <span className="text-[11px] font-bold text-gray-400 block mb-0.5">Categoría:</span>
                  <span className="font-bold text-gray-800">
                    {selectedTxForDetail.catalog_spending_categories?.name || selectedTxForDetail.category_custom || 'Sin categoría'}
                  </span>
                </div>
                <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100 col-span-2">
                  <span className="text-[11px] font-bold text-gray-400 block mb-0.5">Registrado en Sistema Por:</span>
                  <span className="font-bold text-gray-800">
                    {selectedTxForDetail.users ? `${selectedTxForDetail.users.first_name || ''} ${selectedTxForDetail.users.last_name || ''}`.trim() : 'Sistema'}
                  </span>
                </div>
                {selectedTxForDetail.note && (
                  <div className="p-3.5 bg-gray-50/80 rounded-xl border border-gray-100 col-span-2">
                    <span className="text-[11px] font-bold text-gray-400 block mb-0.5">Nota / Motivo original:</span>
                    <p className="text-gray-700 whitespace-pre-wrap font-medium">{selectedTxForDetail.note}</p>
                  </div>
                )}
              </div>

              {/* Return Action & History */}
              {selectedTxForDetail.type === 'OUTPUT' && (
                <div className="space-y-4 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-gray-900 text-xs sm:text-sm flex items-center gap-2">
                      <RotateCcw size={16} className="text-amber-600" />
                      Historial de Devoluciones de Dinero
                    </h4>
                    {((selectedTxForDetail.original_amount ?? selectedTxForDetail.amount) - (selectedTxForDetail.returned_amount ?? 0)) > 0 && (
                      <button
                        onClick={() => {
                          setReturnFormData({
                            amount: '',
                            note: '',
                            date: getLocalDatetimeString()
                          })
                          setIsReturnModalOpen(true)
                        }}
                        className="btn-primary text-xs !py-1.5 !px-3 bg-amber-600 hover:bg-amber-700 border-amber-600 text-white font-semibold flex items-center gap-1.5 rounded-lg shadow-sm"
                      >
                        <RotateCcw size={14} /> Registrar Devolución
                      </button>
                    )}
                  </div>

                  {Array.isArray(selectedTxForDetail.return_logs) && selectedTxForDetail.return_logs.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {selectedTxForDetail.return_logs.map((log: any, idx: number) => (
                        <div key={log.id || idx} className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-100 flex items-start justify-between gap-3 text-xs">
                          <div>
                            <div className="font-bold text-amber-900 flex items-center gap-2 text-sm">
                              <span>Devolución: {formatCurrencyMXN(log.amount)}</span>
                              <span className="text-gray-400 font-normal text-xs">• {formatDateString(log.date)}</span>
                            </div>
                            {log.note && <p className="text-gray-700 mt-1 italic text-xs">&quot;{log.note}&quot;</p>}
                            <span className="text-[10px] text-gray-400 mt-1 block font-medium">Registrado por: {log.created_by_name || 'Usuario'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic bg-gray-50/80 p-3.5 rounded-xl border border-gray-100 text-center">
                      No se han registrado devoluciones de dinero para este retiro.
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  onClick={() => setIsDetailModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </Modal>

        {/* Money Return Sub-Modal */}
        <Modal
          open={isReturnModalOpen}
          onClose={() => !isSubmittingReturn && setIsReturnModalOpen(false)}
          title="Registrar Devolución de Dinero"
          maxWidth="500px"
        >
          {selectedTxForDetail && (
            <form onSubmit={handleSaveReturn} className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-[11px] text-amber-800 uppercase font-bold tracking-wider">Saldo Pendiente de Devolución</span>
                <div className="text-2xl font-black text-amber-950 mt-0.5">
                  {formatCurrencyMXN((selectedTxForDetail.original_amount ?? selectedTxForDetail.amount) - (selectedTxForDetail.returned_amount ?? 0))}
                </div>
                <p className="text-xs text-amber-800 mt-1 font-medium">
                  Original: {formatCurrencyMXN(selectedTxForDetail.original_amount ?? selectedTxForDetail.amount)} | Devuelto antes: {formatCurrencyMXN(selectedTxForDetail.returned_amount ?? 0)}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Monto Devuelto ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={(selectedTxForDetail.original_amount ?? selectedTxForDetail.amount) - (selectedTxForDetail.returned_amount ?? 0)}
                  placeholder="Ej. 30.00"
                  value={returnFormData.amount}
                  onChange={(e) => setReturnFormData({ ...returnFormData, amount: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none font-bold text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Fecha y Hora de Devolución *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={returnFormData.date}
                  onChange={(e) => setReturnFormData({ ...returnFormData, date: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">
                  Motivo / Notas de la Devolución
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej. Cambio devuelto de compra de papelería..."
                  value={returnFormData.note}
                  onChange={(e) => setReturnFormData({ ...returnFormData, note: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-200 focus:border-amber-600 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
                <button
                  type="button"
                  disabled={isSubmittingReturn}
                  onClick={() => setIsReturnModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReturn}
                  className="px-4 py-2 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmittingReturn && <Loader2 className="w-4 h-4 animate-spin" />}
                  Guardar Devolución
                </button>
              </div>
            </form>
          )}
        </Modal>
      </div>
    </AppShell>
  )
}
