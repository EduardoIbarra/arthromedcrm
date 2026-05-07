'use client'
import { useState, useCallback } from 'react'
import AppShell from '@/components/AppShell'
import { useI18n } from '@/contexts/I18nContext'
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import Papa from 'papaparse'
import { ClientInsert } from '@/types/database'

function mapCsvRow(row: Record<string, string>): ClientInsert {
  const parseDate = (s: string) => {
    if (!s) return null
    const parts = s.split(' ')[0].split('/')
    if (parts.length === 3) {
      const [d, m, y] = parts
      return new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`).toISOString()
    }
    return null
  }
  const splitList = (s: string) => s ? s.split(/[,;|]/).map(v => v.trim()).filter(Boolean) : []
  return {
    registered_at: parseDate(row['comerker'] || ''),
    name: row['Nombre / Razón social'] || row['name'] || '',
    rfc: row['RFC'] || null,
    email_primary: row['Dirección de correo electrónico'] || null,
    zip_code: row['Código postal'] || null,
    fiscal_address: row['Dirección fiscal'] || null,
    email_billing: row['Correo electrónico para facturación'] || null,
    email_contact: row['Correo electrónico de contacto'] || null,
    phone: row['Teléfono contacto principal'] || null,
    states: splitList(row['¿En qué estado(s) de la República Mexicana trabaja actualmente? '] || ''),
    hospitals: splitList(row['Seleccione los hospitales o cadena hospitalaria en los que actualmente distribuye nuestros productos. (Puede elegir más de una opción)'] || ''),
    specialties: splitList(row['¿En qué especialidades tiene mayor actividad actualmente? '] || ''),
    tax_regime: row['Régime fiscal'] || null,
    status: (row['Estado'] === 'Prospecto' ? 'Nuevo Prospecto' : 
             ['Activo','Inactivo','Nuevo Prospecto','Contactado','Calificado','Negociación','Perdido'].includes(row['Estado']) 
             ? row['Estado'] 
             : 'Activo') as any,
    source: row['source'] || 'Importación CSV',
  }
}

const CARD = { background: '#ffffff', border: '1px solid #d4e0ec' }

export default function ImportPage() {
  const { t } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ClientInsert[]>([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ inserted: number; errors?: string[] } | null>(null)

  const parseFile = (f: File) => {
    setFile(f); setResult(null)
    Papa.parse<Record<string, string>>(f, {
      header: true, skipEmptyLines: true,
      complete: (res) => {
        setPreview(res.data.map(mapCsvRow).filter(r => r.name))
      },
    })
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && f.name.endsWith('.csv')) parseFile(f)
  }, [])

  const handleImport = async () => {
    if (!preview.length) return
    setImporting(true)
    try {
      const res = await fetch('/api/clients/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clients: preview }) })
      setResult(await res.json())
    } finally { setImporting(false) }
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <Link href="/clients" className="btn-ghost text-sm"><ChevronLeft size={16} /> {t('back')}</Link>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#37383a' }}>{t('importTitle')}</h1>
            <p className="text-sm" style={{ color: '#5a5b5d' }}>Carga masiva desde Google Forms / Excel</p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onClick={() => document.getElementById('csv-input')?.click()}
          className="relative flex flex-col items-center justify-center gap-3 py-14 rounded-2xl border-2 border-dashed cursor-pointer transition-all"
          style={{
            background: dragging ? '#e8f1f9' : '#f8fafd',
            borderColor: dragging ? '#0763a9' : '#c5d9ee',
          }}
        >
          <Upload size={36} style={{ color: dragging ? '#0763a9' : '#9bbfdf' }} />
          <p className="font-medium" style={{ color: '#37383a' }}>{t('importDesc')}</p>
          <p className="text-xs" style={{ color: '#8a8b8d' }}>Solo archivos .CSV</p>
          <input id="csv-input" type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
        </div>

        {/* Result banner */}
        {result && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm"
            style={result.errors?.length
              ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }
              : { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
            }>
            {result.errors?.length ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span>{result.inserted} {t('importSuccess')}{result.errors?.length ? ` — ${result.errors.length} error(es)` : ''}</span>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="rounded-2xl overflow-hidden bg-white" style={CARD}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #e8f1f9' }}>
              <div className="flex items-center gap-2">
                <FileText size={16} style={{ color: '#0763a9' }} />
                <h2 className="text-sm font-semibold" style={{ color: '#37383a' }}>{t('importPreview')}</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#e8f1f9', color: '#0763a9' }}>{preview.length} registros</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setFile(null); setPreview([]); setResult(null) }} className="btn-ghost text-sm"><X size={14} /></button>
                <button onClick={handleImport} disabled={importing || !!result?.inserted} className="btn-primary text-sm">
                  {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} {t('importConfirm')}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid #e8f1f9' }}>
                    {['Nombre','RFC','Teléfono','Estado(s)','Especialidad','Estatus'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold uppercase px-4 py-2.5" style={{ color: '#8a8b8d' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((c, i) => (
                    <tr key={i} className="hover:bg-blue-50/30" style={{ borderBottom: '1px solid #f0f5fa' }}>
                      <td className="px-4 py-2.5 font-medium max-w-[200px] truncate" style={{ color: '#37383a' }}>{c.name}</td>
                      <td className="px-4 py-2.5 font-mono text-xs" style={{ color: '#5a5b5d' }}>{c.rfc || '—'}</td>
                      <td className="px-4 py-2.5" style={{ color: '#5a5b5d' }}>{c.phone || '—'}</td>
                      <td className="px-4 py-2.5 max-w-[140px] truncate" style={{ color: '#5a5b5d' }}>{c.states?.slice(0,2).join(', ') || '—'}</td>
                      <td className="px-4 py-2.5 max-w-[120px] truncate" style={{ color: '#5a5b5d' }}>{c.specialties?.slice(0,1).join(', ') || '—'}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={
                          c.status === 'Activo' ? { background: '#dcfce7', color: '#15803d' }
                          : c.status === 'Inactivo' ? { background: '#fee2e2', color: '#b91c1c' }
                          : { background: '#fef3c7', color: '#b45309' }
                        }>{c.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.length > 10 && <p className="text-xs px-4 py-2.5" style={{ color: '#8a8b8d' }}>… y {preview.length - 10} más</p>}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  )
}
