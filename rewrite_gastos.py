import re

with open('src/app/gastos/page.tsx', 'r') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    "import { Receipt, Plus, Edit2, Trash2, Calendar, DollarSign, MessageSquare, Tag, LayoutGrid, List, Filter } from 'lucide-react'",
    "import { Receipt, Plus, Edit2, Trash2, Calendar, DollarSign, MessageSquare, Tag, LayoutGrid, List, Filter, Download, Sparkles, PlusCircle, MinusCircle, Check } from 'lucide-react'\nimport * as XLSX from 'xlsx'"
)

# 2. State variables
state_vars = """
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [isSavingImport, setIsSavingImport] = useState(false)
"""
content = content.replace(
    "  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')\n  const [startDate, setStartDate] = useState('')\n  const [endDate, setEndDate] = useState('')",
    state_vars
)

# 3. Handle Functions
functions = """
  const handleExportExcel = () => {
    if (gastos.length === 0) return
    const dataToExport = gastos.map(g => ({
      Fecha: g.expense_date ? new Date(g.expense_date).toLocaleDateString() : new Date(g.created_at).toLocaleDateString(),
      Descripción: g.description,
      Nombre: g.name,
      Categoría: g.category?.name || 'Sin Categoría',
      Congreso: g.congreso?.name || '-',
      Monto: g.amount,
      IVA: g.iva,
      Total: g.total,
      'Facturable': g.is_billable ? 'Sí' : 'No',
      'Facturado': g.is_billed ? 'Sí' : 'No'
    }))
    
    const worksheet = XLSX.utils.json_to_sheet(dataToExport)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Gastos')
    XLSX.writeFile(workbook, 'Reporte_Gastos.xlsx')
  }

  const handleAnalyzeText = async () => {
    if (!importText.trim()) return
    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/gastos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: importText })
      })
      if (!res.ok) throw new Error('Failed to analyze text')
      const { spendings } = await res.json()
      setImportPreview(spendings || [])
    } catch (err: any) {
      console.error(err)
      alert('Error analyzing text: ' + err.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveImport = async () => {
    if (importPreview.length === 0) return
    setIsSavingImport(true)
    try {
      const res = await fetch('/api/gastos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(importPreview)
      })
      if (!res.ok) throw new Error('Failed to save imported spendings')
      
      setIsImportModalOpen(false)
      setImportText('')
      setImportPreview([])
      fetchGastos()
    } catch (err: any) {
      console.error(err)
      alert('Error saving spendings: ' + err.message)
    } finally {
      setIsSavingImport(false)
    }
  }

  const handleDeletePreviewRow = (index: number) => {
    setImportPreview(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddPreviewRow = () => {
    setImportPreview(prev => [...prev, { expense_date: new Date().toISOString(), description: '', name: '', amount: 0, total: 0 }])
  }

  const updatePreviewRow = (index: number, field: string, value: any) => {
    setImportPreview(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value }
        if (field === 'amount') {
          updated.total = value
        }
        return updated
      }
      return item
    }))
  }

  const formatCurrency = (amount: number) => {
"""
content = content.replace("  const formatCurrency = (amount: number) => {", functions)

# 4. Header buttons
header_buttons = """
            <PermissionGuard section="gastos" action="create">
              <button onClick={handleExportExcel} className="btn-secondary whitespace-nowrap">
                <Download size={18} /> Exportar
              </button>
              <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary whitespace-nowrap !bg-purple-50 !text-purple-600 !border-purple-200 hover:!bg-purple-100">
                <Sparkles size={18} /> Importar AI
              </button>
              <Link href="/gastos/new" className="btn-primary whitespace-nowrap">
                <Plus size={18} /> {t('newGasto')}
              </Link>
            </PermissionGuard>
"""
content = content.replace(
    """            <PermissionGuard section="gastos" action="create">
              <Link href="/gastos/new" className="btn-primary whitespace-nowrap">
                <Plus size={18} /> {t('newGasto')}
              </Link>
            </PermissionGuard>""",
    header_buttons
)

# 5. Swap Name and Description in Grid view
content = content.replace(
    '<h3 className="text-lg font-bold text-gray-900 mb-1 truncate">{gasto.name}</h3>\n                  <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">{gasto.description}</p>',
    '<h3 className="text-lg font-bold text-gray-900 mb-1 line-clamp-2">{gasto.description || gasto.name}</h3>\n                  <p className="text-sm text-gray-500 truncate">{gasto.description ? gasto.name : \'\'}</p>'
)

# 6. Swap Name and Description in List view
content = content.replace(
    '<div className="font-medium text-gray-900 truncate max-w-xs">{gasto.name}</div>\n                        <div className="text-xs text-gray-500 truncate max-w-xs">{gasto.description}</div>',
    '<div className="font-medium text-gray-900 truncate max-w-xs">{gasto.description || gasto.name}</div>\n                        <div className="text-xs text-gray-500 truncate max-w-xs">{gasto.description ? gasto.name : \'\'}</div>'
)
content = content.replace(
    '<th className="p-4">{t(\'name\')}</th>',
    '<th className="p-4">Descripción / Nombre</th>'
)

# 7. Add Import Modal at the bottom
import_modal = """
        {/* Delete Confirmation Modal */}
        <Modal 
          open={isDeleteModalOpen} 
          onClose={() => !isDeleting && setIsDeleteModalOpen(false)}
          title={t('delete') as string}
        >
          <div className="space-y-4">
            <p className="text-gray-600">
              {t('deleteGastoDesc')}
              <br/><br/>
              <strong>{selectedGasto?.description || selectedGasto?.name}</strong>
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setIsDeleteModalOpen(false)} 
                className="btn-secondary"
                disabled={isDeleting}
              >
                {t('cancel')}
              </button>
              <button 
                onClick={handleDelete} 
                className="btn-primary bg-red-600 border-red-600 hover:bg-red-700 hover:border-red-700 text-white"
                disabled={isDeleting}
              >
                {isDeleting ? t('loading') : t('delete')}
              </button>
            </div>
          </div>
        </Modal>

        {/* Import AI Modal */}
        <Modal 
          open={isImportModalOpen} 
          onClose={() => !isAnalyzing && !isSavingImport && setIsImportModalOpen(false)}
          title="Importar Gastos con Inteligencia Artificial"
          maxWidth="max-w-4xl"
        >
          <div className="space-y-6">
            {!importPreview.length ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Pega aquí los mensajes de WhatsApp o el texto con los gastos. La IA se encargará de extraer la fecha, descripción, nombre y monto.</p>
                <textarea 
                  className="erp-input min-h-[200px]" 
                  placeholder="05/05/2026, 9:42 a. m. - Ricardo Puente: 3850 Hotel Safi 2 noches Tarjeta 8841..."
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                />
                <div className="flex justify-end gap-3">
                  <button onClick={() => setIsImportModalOpen(false)} className="btn-secondary">Cancelar</button>
                  <button 
                    onClick={handleAnalyzeText} 
                    className="btn-primary !bg-purple-600 hover:!bg-purple-700 !border-purple-600"
                    disabled={isAnalyzing || !importText.trim()}
                  >
                    {isAnalyzing ? 'Analizando...' : 'Analizar con IA'} <Sparkles size={16} className="ml-1"/>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">Vista previa de gastos extraídos</h3>
                  <button onClick={handleAddPreviewRow} className="text-blue-600 text-sm flex items-center hover:underline">
                    <PlusCircle size={16} className="mr-1" /> Añadir fila
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto border border-gray-200 rounded-lg">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-sm font-semibold text-gray-600">
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Descripción (Principal)</th>
                        <th className="p-3">Nombre (Corto)</th>
                        <th className="p-3">Monto / Total</th>
                        <th className="p-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {importPreview.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="p-2 w-32">
                            <input 
                              type="date" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.expense_date?.split('T')[0] || ''}
                              onChange={e => updatePreviewRow(index, 'expense_date', e.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <input 
                              type="text" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.description || ''}
                              onChange={e => updatePreviewRow(index, 'description', e.target.value)}
                            />
                          </td>
                          <td className="p-2 w-48">
                            <input 
                              type="text" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.name || ''}
                              onChange={e => updatePreviewRow(index, 'name', e.target.value)}
                            />
                          </td>
                          <td className="p-2 w-32">
                            <input 
                              type="number" 
                              className="erp-input !py-1 !px-2 text-sm w-full" 
                              value={item.amount || 0}
                              onChange={e => updatePreviewRow(index, 'amount', Number(e.target.value))}
                            />
                          </td>
                          <td className="p-2 w-10 text-center">
                            <button onClick={() => handleDeletePreviewRow(index)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                              <MinusCircle size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between items-center mt-4">
                  <button onClick={() => { setImportPreview([]); setImportText(''); }} className="btn-secondary text-red-600 hover:bg-red-50">
                    Descartar y volver
                  </button>
                  <button 
                    onClick={handleSaveImport} 
                    className="btn-primary bg-green-600 hover:bg-green-700 border-green-600"
                    disabled={isSavingImport}
                  >
                    {isSavingImport ? 'Guardando...' : `Guardar ${importPreview.length} gastos`} <Check size={16} className="ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
"""
content = re.sub(
    r'\{\/\* Delete Confirmation Modal \*\/.*?<\/Modal>', 
    import_modal.replace('\\', '\\\\'), 
    content, 
    flags=re.DOTALL
)

with open('src/app/gastos/page.tsx', 'w') as f:
    f.write(content)
