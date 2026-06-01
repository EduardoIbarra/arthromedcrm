'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Bot, User, TrendingUp, BarChart2, CornerDownLeft, RefreshCw } from 'lucide-react'
import AppShell from '@/components/AppShell'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: '¡Hola! Soy tu asistente de ventas de Arthromed. Puedo darte las ventas totales de un mes, comparar periodos de ventas, darte rankings de clientes o detallar qué productos se han vendido más, sus volúmenes y precios. \n\n*Ejemplo: "¿Cuál es el producto que más vendemos?" o "¿Cuánto se vendió en Enero de 2026?"*'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const quickPrompts = [
    { label: 'Ventas Enero 2026', prompt: 'Dame las ventas totales del mes de Enero de 2026.' },
    { label: 'Ranking Clientes 26', prompt: '¿Cuál es el ranking de clientes por ventas en el año 2026?' },
    { label: 'Producto Más Vendido', prompt: '¿Cuál es el producto que más vendemos?' }
  ]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
    <AppShell>
      <div className="h-[calc(100vh-5.5rem)] lg:h-[calc(100vh-4.5rem)] w-full flex flex-col bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#0763a9] to-[#054d85] text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <Sparkles size={20} className="text-[#c5d9ee]" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">Asistente AI Arthromed</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-[#c5d9ee] font-medium">Conectado a Ventas</span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setMessages([
              {
                role: 'assistant',
                content: '¡Hola! Soy tu asistente de ventas de Arthromed. Puedo darte las ventas totales de un mes, comparar periodos de ventas, darte rankings de clientes o detallar qué productos se han vendido más, sus volúmenes y precios. \n\n*Ejemplo: "¿Cuál es el producto que más vendemos?" o "¿Cuánto se vendió en Enero de 2026?"*'
              }
            ])}
            title="Reiniciar chat"
            className="p-2 rounded-xl hover:bg-white/10 text-[#c5d9ee]/85 hover:text-white transition-colors cursor-pointer flex items-center gap-2"
          >
            <RefreshCw size={16} />
            <span className="text-xs font-medium hidden sm:inline">Reiniciar</span>
          </button>
        </div>

        {/* Chat History & Prompt Suggestions */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-[#e8f1f9] text-[#0763a9] flex items-center justify-center shrink-0 shadow-sm border border-[#c5d9ee]/20 mt-1">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
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
                <div className="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center shrink-0 shadow-sm mt-1">
                  <User size={16} />
                </div>
              )}
            </div>
          ))}

          {/* Thinking Loader */}
          {isLoading && (
            <div className="flex gap-3 justify-start max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-xl bg-[#e8f1f9] text-[#0763a9] flex items-center justify-center shrink-0 mt-1">
                <Bot size={16} />
              </div>
              <div className="bg-white border border-slate-150 rounded-2xl rounded-tl-none px-5 py-4 shadow-sm flex items-center gap-3">
                <span className="text-sm text-slate-400 font-medium animate-pulse">Consultando base de datos</span>
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0763a9] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#0763a9] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[#0763a9] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestions Quick pills */}
        <div className="px-4 md:px-6 py-3 bg-slate-50/30 border-t border-slate-100 flex flex-wrap gap-2 shrink-0 justify-center">
          {quickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSend(p.prompt)}
              disabled={isLoading}
              className="px-3.5 py-1.5 text-xs bg-white text-[#0763a9] border border-[#c5d9ee] rounded-full hover:bg-[#e8f1f9] hover:border-[#9bbfdf] active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all cursor-pointer shadow-sm flex items-center gap-1.5 font-medium"
            >
              {i === 1 ? <TrendingUp size={14} /> : i === 2 ? <BarChart2 size={14} /> : <Sparkles size={14} />}
              {p.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <div className="p-4 md:p-6 bg-white border-t border-slate-200/80 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <div className="flex-1 relative flex items-center bg-slate-50 border border-slate-200 hover:border-slate-350 focus-within:border-[#0763a9] focus-within:ring-2 focus-within:ring-[#e8f1f9] rounded-xl transition-all">
              <input
                type="text"
                placeholder="Pregúntame algo sobre ventas..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="w-full pl-4 pr-10 py-3.5 bg-transparent border-0 text-sm md:text-base text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 disabled:opacity-50"
              />
              <div className="absolute right-3 text-slate-400 flex items-center pointer-events-none gap-1">
                <CornerDownLeft size={16} className="hidden sm:inline text-slate-300" />
              </div>
            </div>
            <button
              onClick={() => handleSend(input)}
              disabled={isLoading || !input.trim()}
              className="p-3 md:p-3.5 rounded-xl bg-[#0763a9] hover:bg-[#054d85] text-white shadow-sm hover:shadow active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 disabled:scale-100 disabled:shadow-none transition-all cursor-pointer flex-shrink-0"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
