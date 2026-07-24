'use client'

import { useEffect, useState } from 'react'
import { useI18n } from '@/contexts/I18nContext'
import { useUser } from '@/contexts/UserContext'
import {
  Receipt, Plus, Minus, Search, Loader2, Download, Scale,
  Trash2, AlertTriangle, CheckCircle, Calendar, RefreshCw,
  ChevronLeft, ChevronRight
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
  giver: string
  receiver: string
  date: string
  note: string | null
  created_at: string
  users: {
    first_name: string | null
    last_name: string | null
    email: string
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
    note: ''
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
    fetchUsers()
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
          note: txFormData.note
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
                    note: ''
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
                    note: ''
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
                          <tr key={tx.id} className="border-b border-gray-100 hover:bg-gray-50/50">
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
                            <td className="px-6 py-4 font-semibold text-gray-900">
                              {tx.type === 'INPUT' ? '+' : '-'}{formatCurrencyMXN(tx.amount)}
                            </td>
                            <td className="px-6 py-4 text-gray-700">{tx.giver}</td>
                            <td className="px-6 py-4 text-gray-700">{tx.receiver}</td>
                            <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={tx.note || ''}>
                              {tx.note || '-'}
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                              {tx.users ? `${tx.users.first_name || ''} ${tx.users.last_name || ''}`.trim() : 'Sistema'}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <PermissionGuard section="caja_chica" action="delete">
                                <button
                                  onClick={() => handleDeleteTransaction(tx.id)}
                                  className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </PermissionGuard>
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
      </div>
    </AppShell>
  )
}
