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
  messageId?: string
  reaction?: 'up' | 'down'
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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseMarkdown(text: string, primaryColor: string): string {
  let html = escapeHtml(text)

  // Code blocks (``` ... ```)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
  )

  // Inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')

  // Bold (**text** or __text__)
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="font-weight:700;color:${primaryColor}">$1</strong>`)
  html = html.replace(/__([^_]+)__/g, `<strong style="font-weight:700;color:${primaryColor}">$1</strong>`)

  // Italic (*text* or _text_)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g, '<em>$1</em>')

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>')

  // Unordered lists (- item or * item)
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>')

  // Ordered lists (1. item)
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')
  html = html.replace(/(<li class="md-oli">.*<\/li>\n?)+/g, '<ol class="md-ol">$&</ol>')

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer" style="color:${primaryColor};text-decoration:underline;text-underline-offset:2px">$1</a>`
  )

  // Double newline = paragraph break
  html = html.replace(/\n\n/g, '</p><p class="md-p">')
  html = '<p class="md-p">' + html + '</p>'

  // Clean up empty paragraphs and fix block elements inside paragraphs
  html = html.replace(/<p class="md-p"><\/p>/g, '')
  html = html.replace(/<p class="md-p">(<(?:ul|ol|pre|h[2-4])[^>]*>)/g, '$1')
  html = html.replace(/(<\/(?:ul|ol|pre|h[2-4])>)<\/p>/g, '$1')

  // Single line breaks
  html = html.replace(/\n/g, '<br>')

  return html
}

const STORAGE_TTL = 24 * 60 * 60 * 1000

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
  const storageKey = `chataziendale-pub-${chatbot.id}`

  const defaultMessages: Message[] = [
    { id: 'welcome', role: 'assistant', content: chatbot.welcomeMessage || 'Hello! How can I help you?' },
  ]

  const [messages, setMessages] = useState<Message[]>(defaultMessages)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(() => `pub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [reactionFeedback, setReactionFeedback] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.timestamp && Date.now() - data.timestamp < STORAGE_TTL) {
          if (data.messages?.length > 0) {
            setMessages(data.messages)
            setHasInteracted(true)
          }
          if (data.sessionId) {
            setSessionId(data.sessionId)
          }
        }
      }
    } catch { /* ignore */ }
  }, [storageKey])

  // Persist to localStorage on message changes
  useEffect(() => {
    try {
      const toSave = messages.filter(m => !m.isStreaming)
      if (toSave.length > 0) {
        localStorage.setItem(storageKey, JSON.stringify({
          messages: toSave,
          sessionId,
          timestamp: Date.now(),
        }))
      }
    } catch { /* ignore */ }
  }, [messages, sessionId, storageKey])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const clearChat = useCallback(() => {
    setMessages(defaultMessages)
    setHasInteracted(false)
    setShowClearConfirm(false)
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }, [storageKey, chatbot.welcomeMessage])

  const handleReaction = useCallback(async (msgId: string, dbMessageId: string | undefined, reaction: 'up' | 'down') => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, reaction } : m))
    setReactionFeedback(msgId)
    setTimeout(() => setReactionFeedback(prev => prev === msgId ? null : prev), 3000)

    if (dbMessageId) {
      try {
        await fetch('/api/chat/reaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageId: dbMessageId, reaction, sessionId }),
        })
      } catch { /* ignore */ }
    }
  }, [sessionId])

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
        // Fallback to non-streaming endpoint
        const fallbackRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatbotId: chatbot.id, sessionId, message: text.trim() }),
        })

        if (!fallbackRes.ok) {
          const data = await fallbackRes.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to send message')
        }

        const data = await fallbackRes.json()
        setMessages(prev => [
          ...prev,
          {
            id: assistantMsgId,
            role: 'assistant',
            content: data.message.content,
            sources: data.message.sources,
            messageId: data.message.id,
          },
        ])
        return
      }

      setMessages(prev => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
      ])

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: { sources?: Source[]; messageId?: string } | null = null

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
                    ? { ...msg, isStreaming: false, sources: metadata?.sources, messageId: metadata?.messageId }
                    : msg
                )
              )
              continue
            }
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'metadata') {
                metadata = parsed
              } else if (parsed.messageId) {
                metadata = metadata || {}
                metadata.messageId = parsed.messageId
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

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" style={{ fontFamily: 'var(--font-body)' }}>
      {/* ── Animated gradient background ── */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0" style={{
          background: `linear-gradient(135deg,
            hsl(${hsl.h}, ${Math.round(hsl.s * 20)}%, 97%) 0%,
            hsl(${hsl2.h}, ${Math.round(hsl2.s * 15)}%, 95%) 50%,
            hsl(${hsl.h + 30}, 15%, 96%) 100%)`
        }} />
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
              style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
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
            <div className="ml-auto flex items-center gap-3">
              {/* Clear chat button */}
              {hasInteracted && (
                <div className="relative">
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/50 transition-all"
                    title="Clear chat"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                  {showClearConfirm && (
                    <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-lg ring-1 ring-slate-900/10 p-3 z-50 w-48">
                      <p className="text-xs text-slate-600 mb-2">Clear all messages?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={clearChat}
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => setShowClearConfirm(false)}
                          className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Online indicator */}
              <div className="flex items-center gap-1.5">
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
                  style={{ background: `linear-gradient(135deg, ${primary}, ${secondary})` }}
                >
                  <div className="w-3.5 h-3.5 text-white" dangerouslySetInnerHTML={{
                    __html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4zm0 2a2 2 0 0 1 2 2v2h-4V6a2 2 0 0 1 2-2z"/></svg>'
                  }} />
                </div>
              )}

              <div className={`max-w-[78%]`}>
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
                  {message.role === 'user' ? (
                    <span className="whitespace-pre-wrap">{message.content}</span>
                  ) : (
                    <>
                      <div
                        className="md-content"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content, primary) }}
                      />
                      {message.isStreaming && (
                        <span className="inline-block w-[2px] h-[18px] ml-0.5 align-text-bottom rounded-full animate-pulse"
                          style={{ backgroundColor: primary }}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Reactions */}
                {message.role === 'assistant' && !message.isStreaming && message.id !== 'welcome' && (
                  <div className="flex items-center gap-1 mt-1.5 ml-1">
                    <button
                      onClick={() => handleReaction(message.id, message.messageId, 'up')}
                      className={`p-1 rounded-md transition-all ${
                        message.reaction === 'up'
                          ? 'text-emerald-600 bg-emerald-50'
                          : 'text-slate-300 hover:text-slate-500 hover:bg-white/50'
                      }`}
                      title="Helpful"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleReaction(message.id, message.messageId, 'down')}
                      className={`p-1 rounded-md transition-all ${
                        message.reaction === 'down'
                          ? 'text-red-500 bg-red-50'
                          : 'text-slate-300 hover:text-slate-500 hover:bg-white/50'
                      }`}
                      title="Not helpful"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
                      </svg>
                    </button>
                    {reactionFeedback === message.id && (
                      <span className="text-[11px] text-slate-400 ml-1" style={{ animation: 'message-in 0.3s ease forwards' }}>
                        {message.reaction === 'up' ? 'Thanks!' : 'Thanks for the feedback'}
                      </span>
                    )}
                  </div>
                )}

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
                  style={{ animationDelay: `${0.4 + i * 0.08}s` }}
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

      {/* ── Styles ── */}
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
      <style jsx global>{`
        .md-content .md-p { margin: 0 0 12px 0; }
        .md-content .md-p:last-child { margin-bottom: 0; }
        .md-content .md-h2, .md-content .md-h3, .md-content .md-h4 {
          margin: 14px 0 6px 0;
          font-weight: 600;
          line-height: 1.3;
        }
        .md-content .md-h2 { font-size: 16px; }
        .md-content .md-h3 { font-size: 15px; }
        .md-content .md-h4 { font-size: 14px; }
        .md-content .md-code-block {
          background: #1e293b;
          color: #e2e8f0;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
          margin: 8px 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .md-content .md-inline-code {
          background: rgba(0,0,0,0.05);
          color: #be185d;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 13px;
        }
        .md-content .md-ul, .md-content .md-ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .md-content .md-ul { list-style-type: disc; }
        .md-content .md-ol { list-style-type: decimal; }
        .md-content .md-li, .md-content .md-oli {
          margin: 4px 0;
          line-height: 1.5;
        }
      `}</style>
    </div>
  )
}
