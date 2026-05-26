'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Bot, User, TrendingUp, BarChart2, CornerDownLeft, RefreshCw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AiChatAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de ventas de Arthromed. Puedo darte las ventas totales de un mes, comparar periodos de ventas o darte listados y rankings de clientes. \n\n*Ejemplo: "¿Cuánto se vendió en Enero de 2026?" o "Compara Enero 2026 contra Enero 2025"*'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickPrompts = [
    { label: 'Ventas Enero 2026', prompt: 'Dame las ventas totales del mes de Enero de 2026.' },
    { label: 'Comparar Ene 26 vs Ene 25', prompt: 'Dame una comparación del mes de enero de 2026 contra enero de 2025.' },
    { label: 'Ranking Clientes 2026', prompt: '¿Cuál es el ranking de clientes por ventas en el año 2026?' }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100)
    }
  }, [messages, isOpen])

  const handleSend = async (textToSend: string) => {
    const text = textToSend.trim()
    if (!text) return

    setInput('')
    setIsLoading(true)

    const userMessage: Message = { role: 'user', content: text }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: updatedMessages
        })
      })

      if (!response.ok) {
        throw new Error('Error al conectar con el servidor')
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.text || 'No pude obtener una respuesta.' }])
    } catch (err: any) {
      console.error('Error in chat:', err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Lo siento, ocurrió un error: ${err.message || 'Error de conexión'}.` }
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend(input)
    }
  }

  // --- Beautiful Custom Markdown Parser ---
  const parseInlineMarkdown = (text: string) => {
    const regex = /\*\*(.*?)\*\*/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      parts.push(<strong key={match.index} className="font-semibold text-slate-900">{match[1]}</strong>)
      lastIndex = regex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? <>{parts}</> : text
  }

  const renderTable = (rows: string[][], key: string | number) => {
    if (rows.length === 0) return null
    const headers = rows[0]
    const dataRows = rows.slice(1)

    return (
      <div key={`table-${key}`} className="my-3 overflow-x-auto rounded-xl border border-slate-100 shadow-sm max-w-full">
        <table className="min-w-full divide-y divide-slate-100 text-xs">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((header, idx) => (
                <th key={idx} className="px-3 py-2 text-left font-semibold text-slate-600 uppercase tracking-wider">
                  {parseInlineMarkdown(header)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-50">
            {dataRows.map((row, rowIdx) => (
              <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors">
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx} className="px-3 py-2 text-slate-700 font-medium whitespace-nowrap">
                    {parseInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderMarkdown = (text: string) => {
    if (text.includes('|')) {
      const lines = text.split('\n')
      const tableRows: string[][] = []
      let isInsideTable = false
      const finalElements: React.ReactNode[] = []
      let currentParagraph: string[] = []

      const flushParagraph = (key: string | number) => {
        if (currentParagraph.length > 0) {
          finalElements.push(
            <p key={`p-${key}`} className="mb-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
              {parseInlineMarkdown(currentParagraph.join('\n'))}
            </p>
          )
          currentParagraph = []
        }
      }

      lines.forEach((line, index) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          isInsideTable = true
          flushParagraph(index)
          const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
          if (cells.every(cell => cell.match(/^-+$/))) {
            return
          }
          tableRows.push(cells)
        } else {
          if (isInsideTable) {
            if (tableRows.length > 0) {
              finalElements.push(renderTable(tableRows, index))
              tableRows.length = 0
            }
            isInsideTable = false
          }
          currentParagraph.push(line)
        }
      })

      flushParagraph('final')
      if (isInsideTable && tableRows.length > 0) {
        finalElements.push(renderTable(tableRows, 'final-table'))
      }

      return <div>{finalElements}</div>
    }

    return (
      <div className="space-y-2 text-sm leading-relaxed text-slate-700 whitespace-pre-line">
        {text.split('\n\n').map((paragraph, pIdx) => {
          if (paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ')) {
            return (
              <ul key={pIdx} className="list-disc pl-5 mb-2 space-y-1">
                {paragraph.split('\n').map((item, iIdx) => (
                  <li key={iIdx}>
                    {parseInlineMarkdown(item.replace(/^[-*]\s+/, ''))}
                  </li>
                ))}
              </ul>
            )
          }
          return (
            <p key={pIdx}>
              {parseInlineMarkdown(paragraph)}
            </p>
          )
        })}
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-tr from-[#0763a9] via-[#0763a9] to-[#3d8bbf] text-white shadow-lg hover:shadow-[#0763a9]/30 border border-[#0763a9]/30 flex items-center justify-center cursor-pointer transition-shadow"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Asistente AI"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <X size={24} />
            </motion.div>
          ) : (
            <motion.div
              key="sparkles"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1"
            >
              <Sparkles size={22} className="animate-pulse" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Window Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-24 right-6 w-96 max-w-[calc(100vw-2rem)] h-[580px] max-h-[calc(100vh-8rem)] z-50 flex flex-col bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[#0763a9] to-[#054d85] text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Sparkles size={16} className="text-[#c5d9ee]" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">Asistente AI Arthromed</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-[#c5d9ee] font-medium">Conectado a Ventas</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMessages([
                  {
                    role: 'assistant',
                    content: '¡Hola! Soy tu asistente de ventas de Arthromed. Puedo darte las ventas totales de un mes, comparar periodos de ventas o darte listados y rankings de clientes. \n\n*Ejemplo: "¿Cuánto se vendió en Enero de 2026?" o "Compara Enero 2026 contra Enero 2025"*'
                  }
                ])}
                title="Reiniciar chat"
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#c5d9ee]/85 hover:text-white transition-colors cursor-pointer"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Chat History & Prompt Suggestions */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-[#e8f1f9] text-[#0763a9] flex items-center justify-center shrink-0 shadow-sm border border-[#c5d9ee]/20">
                      <Bot size={14} />
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      msg.role === 'user'
                        ? 'bg-[#0763a9] text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      renderMarkdown(msg.content)
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-sm">
                      <User size={14} />
                    </div>
                  )}
                </div>
              ))}

              {/* Thinking Loader */}
              {isLoading && (
                <div className="flex gap-2.5 justify-start">
                  <div className="w-7 h-7 rounded-lg bg-[#e8f1f9] text-[#0763a9] flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white border border-slate-150 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium animate-pulse">Consultando base de datos</span>
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0763a9] animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0763a9] animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0763a9] animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions Quick pills */}
            <div className="px-4 py-2 bg-slate-50/30 border-t border-slate-100 flex flex-wrap gap-1.5 shrink-0">
              {quickPrompts.map((p, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(p.prompt)}
                  disabled={isLoading}
                  className="px-2.5 py-1 text-xs bg-white text-[#0763a9] border border-[#c5d9ee] rounded-full hover:bg-[#e8f1f9] hover:border-[#9bbfdf] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all cursor-pointer shadow-sm flex items-center gap-1 font-medium"
                >
                  {i === 1 ? <TrendingUp size={11} /> : i === 2 ? <BarChart2 size={11} /> : <Sparkles size={11} />}
                  {p.label}
                </button>
              ))}
            </div>

            {/* Input Form */}
            <div className="p-3 bg-white border-t border-slate-200/80 shrink-0 flex items-center gap-2">
              <div className="flex-1 relative flex items-center bg-slate-50 border border-slate-200 hover:border-slate-350 focus-within:border-[#0763a9] focus-within:ring-2 focus-within:ring-[#e8f1f9] rounded-xl transition-all">
                <input
                  type="text"
                  placeholder="Pregúntame algo sobre ventas..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  className="w-full pl-3 pr-9 py-2.5 bg-transparent border-0 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50"
                />
                <div className="absolute right-2.5 text-slate-400 flex items-center pointer-events-none gap-0.5">
                  <CornerDownLeft size={12} className="hidden sm:inline" />
                </div>
              </div>
              <button
                onClick={() => handleSend(input)}
                disabled={isLoading || !input.trim()}
                className="p-2.5 rounded-xl bg-[#0763a9] hover:bg-[#054d85] text-white shadow-sm hover:shadow active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:scale-100 disabled:shadow-none transition-all cursor-pointer flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
