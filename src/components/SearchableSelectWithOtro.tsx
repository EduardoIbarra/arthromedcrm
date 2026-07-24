'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown, User, UserPlus } from 'lucide-react'

export interface PersonOption {
  id: string
  name: string
  position?: string
  email?: string
}

interface SearchableSelectWithOtroProps {
  options: PersonOption[]
  selectedId: string
  customName: string
  onChange: (data: { selectedId: string; customName: string; selectedName: string; position?: string }) => void
  placeholder?: string
  label?: string
  customNamePlaceholder?: string
  disabled?: boolean
  className?: string
}

export default function SearchableSelectWithOtro({
  options,
  selectedId,
  customName,
  onChange,
  placeholder = 'Seleccionar persona...',
  label,
  customNamePlaceholder = 'Escriba el nombre completo...',
  disabled = false,
  className = ''
}: SearchableSelectWithOtroProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const normalizeText = (str: string) =>
    str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : ''

  const filteredOptions = options.filter(o =>
    normalizeText(o.name).includes(normalizeText(search)) ||
    (o.email && normalizeText(o.email).includes(normalizeText(search))) ||
    (o.position && normalizeText(o.position).includes(normalizeText(search)))
  )

  const selectedPerson = options.find(o => o.id === selectedId)

  const getDisplayLabel = () => {
    if (selectedId === 'otro') {
      return customName ? `Otro: ${customName}` : 'Otro (Especificar...)'
    }
    if (selectedPerson) {
      return selectedPerson.name
    }
    return placeholder
  }

  const handleSelectOption = (optId: string) => {
    if (optId === 'otro') {
      onChange({
        selectedId: 'otro',
        customName: customName || '',
        selectedName: customName || '',
        position: ''
      })
    } else {
      const found = options.find(o => o.id === optId)
      onChange({
        selectedId: optId,
        customName: '',
        selectedName: found ? found.name : '',
        position: found?.position || ''
      })
    }
    setIsOpen(false)
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">{label}</label>}
      <div className="relative" ref={containerRef}>
        <button
          type="button"
          disabled={disabled}
          className={`w-full text-left bg-white border rounded-lg px-3 py-2 text-sm shadow-sm transition-colors flex items-center justify-between ${
            disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : 'hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 border-gray-300'
          }`}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen)
              if (!isOpen) setSearch('')
            }
          }}
        >
          <div className="flex items-center gap-2 truncate pr-2">
            {selectedId === 'otro' ? (
              <UserPlus size={16} className="text-amber-500 shrink-0" />
            ) : selectedPerson ? (
              <User size={16} className="text-blue-600 shrink-0" />
            ) : (
              <User size={16} className="text-gray-400 shrink-0" />
            )}
            <span className={selectedId ? 'text-gray-900 font-medium truncate' : 'text-gray-400'}>
              {getDisplayLabel()}
            </span>
          </div>
          <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-hidden flex flex-col">
            <div className="p-2 border-b border-gray-100 bg-gray-50 shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white border border-gray-200 rounded-md pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Buscar persona..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="overflow-y-auto flex-1 p-1 divide-y divide-gray-50">
              {filteredOptions.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center justify-between ${
                    opt.id === selectedId
                      ? 'bg-blue-50 text-blue-700 font-semibold'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => handleSelectOption(opt.id)}
                >
                  <div className="truncate">
                    <div className="font-medium text-gray-900">{opt.name}</div>
                    {opt.position && <div className="text-xs text-gray-500">{opt.position}</div>}
                  </div>
                </button>
              ))}

              {filteredOptions.length === 0 && (
                <p className="p-2 text-xs text-center text-gray-500">Sin coincidencias.</p>
              )}

              {/* OTRO Option */}
              <button
                type="button"
                className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex items-center gap-2 ${
                  selectedId === 'otro'
                    ? 'bg-amber-50 text-amber-800 font-semibold'
                    : 'text-amber-700 hover:bg-amber-50 font-medium'
                }`}
                onClick={() => handleSelectOption('otro')}
              >
                <UserPlus size={16} className="shrink-0" />
                <span>Otro (Especificar manualmente)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedId === 'otro' && (
        <div className="mt-2 animate-fadeIn">
          <input
            type="text"
            disabled={disabled}
            placeholder={customNamePlaceholder}
            value={customName}
            onChange={e =>
              onChange({
                selectedId: 'otro',
                customName: e.target.value,
                selectedName: e.target.value,
                position: ''
              })
            }
            className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 shadow-sm"
          />
        </div>
      )}
    </div>
  )
}
