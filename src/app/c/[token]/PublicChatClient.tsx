'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Source {
  chunkId: string
  content: string
  similarity: number
  documentTitle: string
  dataSourceName: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isStreaming?: boolean
}

interface ChatbotConfig {
  id: string
  name: string
  description: string | null
  welcomeMessage: string | null
  primaryColor: string | null
  secondaryColor: string | null
  showBranding: boolean
  suggestedPrompts: string[]
  chatIconType: string | null
  chatIconPreset: string | null
  chatIconImage: string | null
}

// Convert hex to HSL components
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) / 255
  const g = parseInt(hex.substring(2, 4), 16) / 255
  const b = parseInt(hex.substring(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s, l }
}

const PRESET_ICONS: Record<string, string> = {
  headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'message-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
}

export default function PublicChatClient({ chatbot }: { chatbot: ChatbotConfig }) {
  const primary = chatbot.primaryColor || '#3B82F6'
  const secondary = chatbot.secondaryColor || '#6366f1'
  const hsl = hexToHSL(primary)
  const hsl2 = hexToHSL(secondary)

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: chatbot.welcomeMessage || 'Hello! How can I help you?',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `pub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [hasInteracted, setHasInteracted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setHasInteracted(true)
    setInput('')
    setLoading(true)

    const assistantMsgId = `assistant-${Date.now()}`

    setMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: text.trim() },
    ])

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId: chatbot.id, sessionId, message: text.trim() }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      setMessages(prev => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
      ])

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: { sources?: Source[] } | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === assistantMsgId
                    ? { ...msg, isStreaming: false, sources: metadata?.sources }
                    : msg
                )
              )
              continue
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'metadata') {
                metadata = parsed
              } else if (parsed.content) {
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + parsed.content }
                      : msg
                  )
                )
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch (err) {
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== assistantMsgId)
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Something went wrong. ${err instanceof Error ? err.message : 'Please try again.'}`,
          },
        ]
      })
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }, [loading, chatbot.id, sessionId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const renderIcon = () => {
    if (chatbot.chatIconType === 'custom' && chatbot.chatIconImage) {
      return (
        <img
          src={chatbot.chatIconImage}
          alt={chatbot.name}
          className="w-full h-full object-cover rounded-full"
        />
      )
    }
    if (chatbot.chatIconType === 'preset' && chatbot.chatIconPreset && PRESET_ICONS[chatbot.chatIconPreset]) {
      return (
        <div
          className="w-5 h-5 text-white"
          dangerouslySetInnerHTML={{ __html: PRESET_ICONS[chatbot.chatIconPreset] }}
        />
      )
    }
    return (
      <span className="text-sm font-semibold text-white" style={{ fontFamily: 'var(--font-body)' }}>
        {chatbot.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  // Simple markdown: bold, italic, code, links, line breaks
  const renderMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|\n)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="px-1.5 py-0.5 rounded-md bg-black/5 text-[13px] font-mono">
            {part.slice(1, -1)}
          </code>
        )
      }
      const linkMatch = part.match(/^\[(.*?)\]\((.*?)\)$/)
      if (linkMatch) {
        return (
          <a key={i} href={linkMatch[2]} target="_blank" rel="noopener noreferrer"
            className="underline underline-offset-2 decoration-1 hover:opacity-70 transition-opacity"
            style={{ color: primary }}>
            {linkMatch[1]}
          </a>
        )
      }
      if (part === '\n') return <br key={i} />
      return part
    })
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Animated gradient background ── */}
      <div className="fixed inset-0 -z-10">
        {/* Base layer */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(135deg,
            hsl(${hsl.h}, ${Math.round(hsl.s * 20)}%, 97%) 0%,
            hsl(${hsl2.h}, ${Math.round(hsl2.s * 15)}%, 95%) 50%,
            hsl(${hsl.h + 30}, 15%, 96%) 100%)`
        }} />
        {/* Floating orbs */}
        <div className="absolute top-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full opacity-[0.07]"
          style={{
            background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`,
            animation: 'float-orb 25s ease-in-out infinite',
          }}
        />
        <div className="absolute bottom-[-15%] left-[-10%] w-[50vw] h-[50vw] rounded-full opacity-[0.05]"
          style={{
            background: `radial-gradient(circle, ${secondary} 0%, transparent 70%)`,
            animation: 'float-orb 30s ease-in-out infinite reverse',
          }}
        />
        {/* Grain overlay */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10">
        <div className="max-w-3xl mx-auto px-5 py-5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ring-1 ring-white/20 flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${secondary})`,
              }}
            >
              {renderIcon()}
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-slate-900 truncate leading-tight">
                {chatbot.name}
              </h1>
              {chatbot.description && (
                <p className="text-xs text-slate-500 truncate mt-0.5">{chatbot.description}</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: primary }} />
                <span className="relative inline-flex rounded-full h-2 w-2"
                  style={{ backgroundColor: primary }} />
              </span>
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: `${primary}30 transparent`,
        }}
      >
        <div className="max-w-3xl mx-auto space-y-5">
          {messages.map((message, idx) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              style={{
                animation: idx > 0 ? 'message-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards' : undefined,
                opacity: idx > 0 ? 0 : 1,
              }}
            >
              {/* Assistant avatar */}
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-xl flex items-center justify-center mr-2.5 mt-1 flex-shrink-0 shadow-sm ring-1 ring-white/30"
                  style={{
                    background: `linear-gradient(135deg, ${primary}, ${secondary})`,
                  }}
                >
                  <div className="w-3.5 h-3.5 text-white" dangerouslySetInnerHTML={{
                    __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm0 2a2 2 0 0 1 2 2v2h-4V6a2 2 0 0 1 2-2z"/></svg>'
                  }} />
                </div>
              )}

              <div className={`max-w-[78%] ${message.role === 'user' ? '' : ''}`}>
                <div
                  className={`px-4 py-3 text-[14.5px] leading-[1.65] ${
                    message.role === 'user'
                      ? 'text-white rounded-[20px] rounded-br-md shadow-md'
                      : 'text-slate-800 bg-white/70 backdrop-blur-xl rounded-[20px] rounded-bl-md shadow-sm ring-1 ring-slate-900/[0.04]'
                  }`}
                  style={
                    message.role === 'user'
                      ? { background: `linear-gradient(135deg, ${primary}, ${secondary})` }
                      : undefined
                  }
                >
                  <span className="whitespace-pre-wrap">
                    {renderMarkdown(message.content)}
                    {message.isStreaming && (
                      <span className="inline-block w-[2px] h-[18px] ml-0.5 align-text-bottom rounded-full animate-pulse"
                        style={{ backgroundColor: primary }}
                      />
                    )}
                  </span>
                </div>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.sources.map((source, sIdx) => (
                      <div key={sIdx}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/60 backdrop-blur-sm ring-1 ring-slate-900/[0.04] text-[11px] text-slate-500"
                      >
                        <svg className="w-3 h-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                        <span className="font-medium text-slate-600 truncate max-w-[140px]">{source.documentTitle}</span>
                        <span className="opacity-50">{Math.round(source.similarity * 100)}%</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && !messages.some(m => m.isStreaming) && (
            <div className="flex items-start" style={{ animation: 'message-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards', opacity: 0 }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center mr-2.5 mt-1 flex-shrink-0 shadow-sm ring-1 ring-white/30"
                style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
              >
                <div className="w-3.5 h-3.5 text-white" dangerouslySetInnerHTML={{
                  __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm0 2a2 2 0 0 1 2 2v2h-4V6a2 2 0 0 1 2-2z"/></svg>'
                }} />
              </div>
              <div className="bg-white/70 backdrop-blur-xl rounded-[20px] rounded-bl-md px-5 py-3.5 shadow-sm ring-1 ring-slate-900/[0.04]">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-[6px] h-[6px] rounded-full"
                      style={{
                        backgroundColor: `${primary}80`,
                        animation: `typing-dot 1.4s ease-in-out ${i * 0.16}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Suggested prompts */}
          {!hasInteracted && chatbot.suggestedPrompts.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2" style={{ animation: 'message-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards', opacity: 0 }}>
              {chatbot.suggestedPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt)}
                  disabled={loading}
                  className="group px-4 py-2 rounded-full bg-white/60 backdrop-blur-sm text-[13px] font-medium text-slate-600 ring-1 ring-slate-900/[0.06] hover:ring-2 hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    animationDelay: `${0.4 + i * 0.08}s`,
                  }}
                  onMouseEnter={e => {
                    (e.target as HTMLButtonElement).style.borderColor = primary
                    ;(e.target as HTMLButtonElement).style.color = primary
                  }}
                  onMouseLeave={e => {
                    (e.target as HTMLButtonElement).style.borderColor = ''
                    ;(e.target as HTMLButtonElement).style.color = ''
                  }}
                >
                  <span className="mr-1.5 opacity-40 group-hover:opacity-70 transition-opacity">&#8594;</span>
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input ── */}
      <div className="relative z-10">
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200/60 to-transparent" />
        <div className="px-4 py-4 bg-white/40 backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2.5 bg-white/80 backdrop-blur-sm rounded-2xl ring-1 ring-slate-900/[0.06] shadow-sm px-4 transition-all duration-200 focus-within:ring-2 focus-within:shadow-md"
              style={{ '--tw-ring-color': `${primary}40` } as React.CSSProperties}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type your message..."
                disabled={loading}
                className="flex-1 py-3.5 bg-transparent text-[14.5px] text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50"
                style={{ fontFamily: 'var(--font-body)' }}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all duration-200 disabled:opacity-30 disabled:scale-95 hover:scale-105 active:scale-95 shadow-sm"
                style={{
                  background: input.trim() && !loading
                    ? `linear-gradient(135deg, ${primary}, ${secondary})`
                    : `linear-gradient(135deg, ${primary}60, ${secondary}60)`,
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Branding */}
        {chatbot.showBranding && (
          <div className="text-center pb-3 pt-0.5 bg-white/40 backdrop-blur-xl">
            <a
              href="https://chataziendale.it"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-slate-400 hover:text-slate-500 transition-colors"
            >
              Powered by <span className="font-semibold">ChatAziendale</span>
            </a>
          </div>
        )}
      </div>

      {/* ── Animations ── */}
      <style jsx>{`
        @keyframes float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes message-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
