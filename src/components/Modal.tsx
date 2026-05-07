'use client'
import { ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  maxWidth?: string
}

export default function Modal({ open, onClose, title, children, maxWidth = '500px' }: ModalProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/25 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full rounded-2xl bg-white animate-fade-in"
        style={{
          maxWidth,
          border: '1px solid #d4e0ec',
          boxShadow: '0 20px 60px rgba(7,99,169,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-blue-100">
            <h2 className="text-base font-semibold" style={{ color: '#37383a' }}>{title}</h2>
            <button onClick={onClose} className="btn-ghost p-1.5"><X size={16} /></button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}
