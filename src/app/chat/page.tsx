'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Bot, User, TrendingUp, BarChart2, CornerDownLeft, RefreshCw, Mic, MicOff, Volume2, VolumeX, Settings } from 'lucide-react'
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

  // --- Voice & Speech State ---
  const [isListening, setIsListening] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [currentlySpeakingId, setCurrentlySpeakingId] = useState<number | null>(null)
  
  // Conversation Mode State
  const [isConversationMode, setIsConversationMode] = useState(false)
  const [voiceState, setVoiceState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle')

  const recognitionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // State synchronization refs to prevent stale state in closures
  const isConversationModeRef = useRef(isConversationMode)
  const autoSpeakRef = useRef(autoSpeak)
  const voiceStateRef = useRef(voiceState)

  useEffect(() => {
    isConversationModeRef.current = isConversationMode
  }, [isConversationMode])

  useEffect(() => {
    autoSpeakRef.current = autoSpeak
  }, [autoSpeak])

  useEffect(() => {
    voiceStateRef.current = voiceState
  }, [voiceState])

  const handleSendRef = useRef<any>(null)

  // Speech Recognition Initialization
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.continuous = false
        rec.interimResults = false
        rec.lang = 'es-MX'

        rec.onstart = () => {
          setIsListening(true)
          if (isConversationModeRef.current) {
            setVoiceState('listening')
          }
        }

        rec.onend = () => {
          setIsListening(false)
          if (isConversationModeRef.current) {
            setVoiceState(current => {
              if (current === 'listening') return 'idle'
              return current
            })
          }
        }

        rec.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript
          if (transcript) {
            if (isConversationModeRef.current) {
              if (handleSendRef.current) {
                handleSendRef.current(transcript)
              }
            } else {
              setInput(prev => prev ? `${prev} ${transcript}` : transcript)
            }
          }
        }

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error)
          setIsListening(false)
          if (isConversationModeRef.current) {
            setVoiceState('idle')
          }
        }

        recognitionRef.current = rec
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
      }
    }
  }, [])

  const startListeningForConversation = () => {
    if (!recognitionRef.current) return
    setVoiceState('listening')
    try {
      recognitionRef.current.start()
    } catch (err) {
      console.error('Failed to start conversation listening:', err)
      setVoiceState('idle')
    }
  }

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert('Tu navegador no soporta el reconocimiento de voz en la web.')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setCurrentlySpeakingId(null)
      try {
        recognitionRef.current.start()
      } catch (err) {
        console.error('Failed to start speech recognition:', err)
      }
    }
  }

  const speakText = async (text: string, messageId: number) => {
    if (currentlySpeakingId === messageId) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setCurrentlySpeakingId(null)
      if (isConversationModeRef.current) {
        setVoiceState('idle')
      }
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }

    setCurrentlySpeakingId(messageId)
    if (isConversationModeRef.current) {
      setVoiceState('speaking')
    }

    try {
      // 1. Strip markdown tables and replace with spoken transition
      let processedText = text
      if (processedText.includes('|')) {
        const lines = processedText.split('\n')
        let hasTable = false
        const filteredLines: string[] = []
        
        for (const line of lines) {
          const trimmed = line.trim()
          const isTableRow = trimmed.startsWith('|') || (trimmed.match(/\|/g) || []).length > 1
          if (isTableRow) {
            hasTable = true
            continue
          }
          filteredLines.push(line)
        }
        
        processedText = filteredLines.join('\n').trim()
        if (hasTable) {
          processedText += '\nAquí puedes ver el desglose en la tabla.'
        }
      }

      // 2. Clean text of markdown formatters for cleaner reading
      const cleanText = processedText
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#/g, '')
        .replace(/[-*]\s+/g, '')
        .replace(/\|/g, ' ')
        .replace(/\n+/g, ' ')
        .trim()

      // 3. Directly assign URL to HTML Audio for real-time sub-200ms chunked streaming!
      const audioUrl = `/api/ai/tts?text=${encodeURIComponent(cleanText)}`
      const audio = new Audio(audioUrl)
      audioRef.current = audio

      audio.onended = () => {
        setCurrentlySpeakingId(null)
        audioRef.current = null
        if (isConversationModeRef.current) {
          setVoiceState('idle')
          setTimeout(() => {
            if (isConversationModeRef.current) {
              startListeningForConversation()
            }
          }, 300)
        }
      }

      audio.onerror = (e) => {
        console.error('Audio playback error:', e)
        setCurrentlySpeakingId(null)
        audioRef.current = null
        if (isConversationModeRef.current) {
          setVoiceState('idle')
          setTimeout(() => {
            if (isConversationModeRef.current) {
              startListeningForConversation()
            }
          }, 300)
        }
      }

      await audio.play()
    } catch (err) {
      console.error('Error playing TTS:', err)
      setCurrentlySpeakingId(null)
      if (isConversationModeRef.current) {
        setVoiceState('idle')
      }
    }
  }

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
    if (!text) {
      if (isConversationModeRef.current) {
        startListeningForConversation()
      }
      return
    }

    setInput('')
    setIsLoading(true)
    if (isConversationModeRef.current) {
      setVoiceState('thinking')
    }

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

      const replyContent = data.text || 'No pude obtener una respuesta.'
      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }])
      
      if (isConversationModeRef.current || autoSpeak) {
        speakText(replyContent, updatedMessages.length)
      } else {
        if (isConversationModeRef.current) {
          setVoiceState('idle')
        }
      }
    } catch (err: any) {
      console.error('Error in chat:', err)
      setMessages(prev => [
        ...prev,
        { role: 'assistant' as const, content: `Lo siento, ocurrió un error: ${err.message || 'Error de conexión'}.` }
      ])
      if (isConversationModeRef.current) {
        setVoiceState('idle')
        setTimeout(() => {
          if (isConversationModeRef.current) {
            startListeningForConversation()
          }
        }, 1500)
      }
    } finally {
      setIsLoading(false)
    }
  }

  // Sync handleSendRef to point to the latest handleSend function
  handleSendRef.current = handleSend

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
        <div className="p-4 bg-gradient-to-r from-[#0763a9] to-[#054d85] text-white flex items-center justify-between shrink-0 shadow-sm relative z-20">
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
          <div className="flex items-center gap-2">
            {/* Conversation Mode Toggle */}
            <button
              onClick={() => {
                const newVal = !isConversationMode
                setIsConversationMode(newVal)
                if (newVal) {
                  if (audioRef.current) {
                    audioRef.current.pause()
                    audioRef.current = null
                  }
                  setCurrentlySpeakingId(null)
                  setTimeout(() => {
                    startListeningForConversation()
                  }, 300)
                } else {
                  if (audioRef.current) {
                    audioRef.current.pause()
                    audioRef.current = null
                  }
                  if (recognitionRef.current) {
                    recognitionRef.current.stop()
                  }
                  setVoiceState('idle')
                }
              }}
              className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                isConversationMode
                  ? 'bg-indigo-600 text-white shadow-indigo-500/20 shadow border border-indigo-500 animate-pulse'
                  : 'text-[#c5d9ee]/80 hover:bg-white/10 hover:text-white border border-[#c5d9ee]/25'
              }`}
              title={isConversationMode ? "Desactivar Modo Conversación" : "Activar Modo Conversación (Manos libres)"}
            >
              <Mic size={15} />
              <span className="hidden sm:inline">Modo Conversación</span>
            </button>

            {/* One-Click Autoplay Toggle */}
            <button
              onClick={() => {
                const newValue = !autoSpeak
                setAutoSpeak(newValue)
                if (!newValue && audioRef.current) {
                  audioRef.current.pause()
                  setCurrentlySpeakingId(null)
                }
              }}
              className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center ${
                autoSpeak
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-[#c5d9ee]/80 hover:bg-white/10 hover:text-white border border-transparent'
              }`}
              title={autoSpeak ? "Desactivar lectura automática" : "Activar lectura automática"}
            >
              {autoSpeak ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause()
                  audioRef.current = null
                }
                setCurrentlySpeakingId(null)
                setMessages([
                  {
                    role: 'assistant',
                    content: '¡Hola! Soy tu asistente de ventas de Arthromed. Puedo darte las ventas totales de un mes, comparar periodos de ventas, darte rankings de clientes o detallar qué productos se han vendido más, sus volúmenes y precios. \n\n*Ejemplo: "¿Cuál es el producto que más vendemos?" o "¿Cuánto se vendió en Enero de 2026?"*'
                  }
                ])
              }}
              title="Reiniciar chat"
              className="p-2 rounded-xl hover:bg-white/10 text-[#c5d9ee]/85 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw size={16} />
              <span className="text-xs font-medium hidden sm:inline">Reiniciar</span>
            </button>
          </div>
        </div>

        {/* Chat History & Prompt Suggestions / Conversation Mode Overlay */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 relative flex flex-col min-h-0">
          {isConversationMode ? (
            <div className="flex-1 w-full bg-slate-950 flex flex-col items-center justify-between p-6 text-white transition-all duration-300">
              <div className="flex-1 flex flex-col items-center justify-center gap-8 max-w-md text-center">
                {/* State Animated Sphere */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                  {/* Listening State: Pulse Rings */}
                  {voiceState === 'listening' && (
                    <>
                      <div className="absolute w-44 h-44 rounded-full bg-emerald-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                      <div className="absolute w-36 h-36 rounded-full bg-emerald-500/20 animate-pulse" />
                      <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
                        <Mic size={40} className="text-white" />
                      </div>
                    </>
                  )}

                  {/* Thinking State: Rotating Gradients */}
                  {voiceState === 'thinking' && (
                    <>
                      <div className="absolute w-40 h-40 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 border-r-cyan-400 animate-spin" style={{ animationDuration: '1.5s' }} />
                      <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-indigo-500 to-cyan-500 shadow-lg shadow-indigo-500/30 flex items-center justify-center animate-pulse" />
                    </>
                  )}

                  {/* Speaking State: Siri Wave Effect */}
                  {voiceState === 'speaking' && (
                    <>
                      <div className="absolute w-44 h-44 rounded-full bg-purple-500/15 animate-ping" style={{ animationDuration: '1.5s' }} />
                      <div className="absolute w-36 h-36 rounded-full bg-pink-500/10 animate-pulse" style={{ animationDuration: '2s' }} />
                      <div className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 shadow-lg shadow-purple-500/30 flex items-center justify-center">
                        <Volume2 size={40} className="text-white animate-bounce" style={{ animationDuration: '1.2s' }} />
                      </div>
                      {/* Sub-wave indicator bars */}
                      <div className="absolute -bottom-4 flex items-center gap-1">
                        <span className="w-1 h-6 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '0.6s' }} />
                        <span className="w-1 h-10 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '150ms', animationDuration: '0.8s' }} />
                        <span className="w-1 h-8 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms', animationDuration: '0.7s' }} />
                        <span className="w-1 h-12 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: '450ms', animationDuration: '0.9s' }} />
                        <span className="w-1 h-5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '600ms', animationDuration: '0.5s' }} />
                      </div>
                    </>
                  )}

                  {/* Idle State: Calm Breather */}
                  {voiceState === 'idle' && (
                    <div 
                      onClick={startListeningForConversation}
                      className="absolute w-28 h-28 rounded-full bg-gradient-to-tr from-slate-700 to-slate-800 shadow-lg cursor-pointer flex items-center justify-center hover:from-slate-650 hover:to-slate-750 transition-all border border-slate-600 hover:border-slate-500 hover:scale-105 active:scale-95 group"
                    >
                      <Mic size={36} className="text-slate-400 group-hover:text-white transition-colors" />
                      <span className="absolute -bottom-6 text-[10px] text-slate-500 font-semibold tracking-wider uppercase group-hover:text-slate-400">Toca para hablar</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 mt-4 select-none">
                  <h2 className="text-xl font-bold tracking-tight text-slate-100">
                    {voiceState === 'listening' && "Te escucho..."}
                    {voiceState === 'thinking' && "Pensando..."}
                    {voiceState === 'speaking' && "Hablando..."}
                    {voiceState === 'idle' && "Modo Conversación"}
                  </h2>
                  <p className="text-sm text-slate-400 max-w-xs leading-relaxed font-semibold">
                    {voiceState === 'listening' && "Pregúntame sobre tus ventas de forma natural."}
                    {voiceState === 'thinking' && "Consultando base de datos del ERP."}
                    {voiceState === 'speaking' && "Escucha la respuesta de tu asistente de voz."}
                    {voiceState === 'idle' && "Toca el micrófono para iniciar la conversación."}
                  </p>
                </div>
              </div>

              {/* Exit Button */}
              <div className="pb-8 shrink-0">
                <button
                  onClick={() => {
                    setIsConversationMode(false)
                    if (audioRef.current) {
                      audioRef.current.pause()
                      audioRef.current = null
                    }
                    if (recognitionRef.current) {
                      recognitionRef.current.stop()
                    }
                    setVoiceState('idle')
                  }}
                  className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-sm font-semibold tracking-tight transition-all active:scale-95 cursor-pointer shadow-md flex items-center gap-2"
                >
                  Salir del modo conversación
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col justify-between min-h-0">
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex gap-3 max-w-3xl mx-auto ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="flex flex-col gap-1.5 items-center shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-[#e8f1f9] text-[#0763a9] flex items-center justify-center shadow-sm border border-[#c5d9ee]/20 mt-1">
                          <Bot size={16} />
                        </div>
                        <button
                          onClick={() => speakText(msg.content, idx)}
                          title={currentlySpeakingId === idx ? "Detener voz" : "Escuchar respuesta"}
                          className={`p-1 rounded-lg border transition-all cursor-pointer ${
                            currentlySpeakingId === idx
                              ? 'bg-rose-50 border-rose-200 text-rose-600 scale-105 animate-pulse'
                              : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-[#0763a9] hover:bg-[#e8f1f9]/40 hover:border-[#c5d9ee]/40'
                          }`}
                        >
                          {currentlySpeakingId === idx ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>
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
            </div>
          )}
        </div>

        {/* Suggestions Quick pills */}
        {!isConversationMode && (
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
        )}

        {/* Input Form */}
        {!isConversationMode && (
          <div className="p-4 md:p-6 bg-white border-t border-slate-200/80 shrink-0 relative">
            {/* Voice Wave Visualizer */}
            {isListening && (
              <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 border border-rose-100 rounded-full text-rose-600 text-xs font-semibold animate-pulse absolute -top-8 left-1/2 -translate-x-1/2 shadow-sm z-10">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                Escuchando...
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="w-0.5 h-2 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-0.5 h-3 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-0.5 h-1.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="w-0.5 h-3.5 bg-rose-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
                </div>
              </div>
            )}

            <div className="max-w-3xl mx-auto flex items-center gap-3">
              {/* Microphone Button */}
              <button
                onClick={toggleListening}
                type="button"
                disabled={isLoading}
                className={`p-3 md:p-3.5 rounded-xl border transition-all cursor-pointer flex-shrink-0 flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-500 border-rose-500 text-white animate-pulse shadow-rose-200 shadow-md scale-105'
                    : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-350 active:scale-95 disabled:opacity-50 disabled:scale-100'
                }`}
                title={isListening ? 'Detener grabación' : 'Hablar en español'}
              >
                {isListening ? <MicOff size={20} className="animate-bounce" /> : <Mic size={20} />}
              </button>

              <div className="flex-1 relative flex items-center bg-slate-50 border border-slate-200 hover:border-slate-350 focus-within:border-[#0763a9] focus-within:ring-2 focus-within:ring-[#e8f1f9] rounded-xl transition-all">
                <input
                  type="text"
                  placeholder={isListening ? "Habla ahora..." : "Pregúntame algo sobre ventas..."}
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
        )}
      </div>
    </AppShell>
  )
}
