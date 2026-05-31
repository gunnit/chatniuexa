'use client'

import { useState, useRef, useEffect, useCallback, useMemo, CSSProperties } from 'react'

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
  welcomeEyebrow: string | null
  welcomeHeadline: string | null
  welcomeMessage: string | null
  primaryColor: string | null
  secondaryColor: string | null
  showBranding: boolean
  showSources: boolean
  suggestedPrompts: string[]
  chatIconType: string | null
  chatIconPreset: string | null
  chatIconImage: string | null
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Renders a single line of "accent markdown" — *word* wraps the word in the accent color.
// Used for the configurable welcome headline.
function renderAccentMarkdown(text: string, accent: string): string {
  return escapeHtml(text).replace(
    /\*([^*\n]+)\*/g,
    `<span style="color:${accent}">$1</span>`
  )
}

function parseMarkdown(text: string, accent: string): string {
  let html = escapeHtml(text)

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
  )
  html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, `<strong style="font-weight:700;color:${accent}">$1</strong>`)
  html = html.replace(/__([^_]+)__/g, `<strong style="font-weight:700;color:${accent}">$1</strong>`)
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  html = html.replace(/(?<![a-zA-Z])_([^_]+)_(?![a-zA-Z])/g, '<em>$1</em>')
  html = html.replace(/^### (.+)$/gm, '<h4 class="md-h4">$1</h4>')
  html = html.replace(/^## (.+)$/gm, '<h3 class="md-h3">$1</h3>')
  html = html.replace(/^# (.+)$/gm, '<h2 class="md-h2">$1</h2>')
  html = html.replace(/^[\-\*] (.+)$/gm, '<li class="md-li">$1</li>')
  html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, '<ul class="md-ul">$&</ul>')
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>')
  html = html.replace(/(<li class="md-oli">.*<\/li>\n?)+/g, '<ol class="md-ol">$&</ol>')
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" target="_blank" rel="noopener noreferrer" style="color:${accent};text-decoration:underline;text-underline-offset:2px">$1</a>`
  )
  html = html.replace(/\n\n/g, '</p><p class="md-p">')
  html = '<p class="md-p">' + html + '</p>'
  html = html.replace(/<p class="md-p"><\/p>/g, '')
  html = html.replace(/<p class="md-p">(<(?:ul|ol|pre|h[2-4])[^>]*>)/g, '$1')
  html = html.replace(/(<\/(?:ul|ol|pre|h[2-4])>)<\/p>/g, '$1')
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
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z"/><path d="M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9z"/></svg>',
  lightbulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.7.5 1 1.4 1 2.3h6c0-.9.3-1.8 1-2.3A7 7 0 0 0 12 2z"/></svg>',
  smile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  'shopping-bag': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="9" y1="22" x2="9" y2="18"/><line x1="15" y1="22" x2="15" y2="18"/><line x1="9" y1="6" x2="9.01" y2="6"/><line x1="15" y1="6" x2="15.01" y2="6"/><line x1="9" y1="10" x2="9.01" y2="10"/><line x1="15" y1="10" x2="15.01" y2="10"/><line x1="9" y1="14" x2="9.01" y2="14"/><line x1="15" y1="14" x2="15.01" y2="14"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
}

function getInitials(name: string): string {
  const stripped = name.replace(/^ask\s+/i, '').trim()
  const parts = stripped.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return stripped.slice(0, 2).toUpperCase()
}

function displayBotName(name: string): string {
  return name.replace(/^ask\s+/i, '').trim() || name
}

const FONT_STACK = "var(--font-inter), 'Inter', var(--font-body), -apple-system, BlinkMacSystemFont, sans-serif"

export default function PublicChatClient({ chatbot }: { chatbot: ChatbotConfig }) {
  const accent = chatbot.primaryColor || '#E43A3A'
  const botName = chatbot.name
  const welcome = chatbot.welcomeMessage || chatbot.description || `Ask me anything about ${botName}.`
  const prompts = chatbot.suggestedPrompts || []
  const initials = getInitials(botName)
  const displayName = displayBotName(botName)
  const storageKey = `chataziendale-pub-${chatbot.id}`

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(
    () => `pub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  )
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lang, setLang] = useState('EN')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey)
      if (stored) {
        const data = JSON.parse(stored)
        if (data.timestamp && Date.now() - data.timestamp < STORAGE_TTL) {
          if (data.messages?.length > 0) setMessages(data.messages)
          if (data.sessionId) setSessionId(data.sessionId)
        }
      }
    } catch {
      /* ignore */
    }
  }, [storageKey])

  useEffect(() => {
    try {
      const toSave = messages.filter((m) => !m.isStreaming)
      if (toSave.length > 0) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ messages: toSave, sessionId, timestamp: Date.now() })
        )
      }
    } catch {
      /* ignore */
    }
  }, [messages, sessionId, storageKey])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  useEffect(() => {
    inputRef.current?.focus()
    if (typeof navigator !== 'undefined') {
      const code = (navigator.language || 'en').slice(0, 2).toLowerCase()
      setLang(code === 'it' ? 'IT' : 'EN')
    }
  }, [])

  const clearChat = useCallback(() => {
    setMessages([])
    setShowClearConfirm(false)
    try {
      localStorage.removeItem(storageKey)
    } catch {
      /* ignore */
    }
  }, [storageKey])

  const handleReaction = useCallback(
    async (msgId: string, dbMessageId: string | undefined, reaction: 'up' | 'down') => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reaction: m.reaction === reaction ? undefined : reaction } : m))
      )
      if (dbMessageId) {
        try {
          await fetch('/api/chat/reaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: dbMessageId, reaction, sessionId }),
          })
        } catch {
          /* ignore */
        }
      }
    },
    [sessionId]
  )

  const handleCopy = useCallback(async (msgId: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(msgId)
      setTimeout(() => setCopiedId((p) => (p === msgId ? null : p)), 1800)
    } catch {
      /* ignore */
    }
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return
      setInput('')
      setLoading(true)
      const assistantMsgId = `assistant-${Date.now()}`
      setMessages((prev) => [
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
          setMessages((prev) => [
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

        setMessages((prev) => [
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
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (data === '[DONE]') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        isStreaming: false,
                        sources: metadata?.sources,
                        messageId: metadata?.messageId,
                      }
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
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId ? { ...msg, content: msg.content + parsed.content } : msg
                  )
                )
              }
            } catch {
              /* ignore parse errors */
            }
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId)
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
    },
    [loading, chatbot.id, sessionId]
  )

  const handleSubmit = () => {
    const v = input.trim()
    if (!v) return
    sendMessage(v)
  }

  const isEmpty = messages.length === 0

  const bgTint = `${accent}14`
  const bgTint2 = `${accent}08`

  const avatarInner = (size: number): React.ReactNode => {
    if (chatbot.chatIconType === 'custom' && chatbot.chatIconImage) {
      return (
        <img
          src={chatbot.chatIconImage}
          alt={botName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: size * 0.32 }}
        />
      )
    }
    if (
      chatbot.chatIconType === 'preset' &&
      chatbot.chatIconPreset &&
      PRESET_ICONS[chatbot.chatIconPreset]
    ) {
      return (
        <span
          style={{
            width: size * 0.5,
            height: size * 0.5,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          dangerouslySetInnerHTML={{ __html: PRESET_ICONS[chatbot.chatIconPreset] }}
        />
      )
    }
    return (
      <span style={{ fontSize: size * 0.38, fontWeight: 700, letterSpacing: -0.3, color: '#fff' }}>
        {initials}
      </span>
    )
  }

  const breathingAvatar = (size: number) => (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          inset: -4,
          borderRadius: size * 0.4,
          background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
          filter: 'blur(6px)',
          animation: 'v2breathe 4s infinite ease-in-out',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: size * 0.32,
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          boxShadow: `0 4px 16px ${accent}40, inset 0 1px 0 rgba(255,255,255,0.25)`,
        }}
      >
        {avatarInner(size)}
      </div>
    </div>
  )

  const noiseSvg = useMemo(
    () =>
      `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.4 0 0 0 0 0.3 0 0 0 0 0.25 0 0 0 0.1 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
    []
  )

  return (
    <div
      style={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: FONT_STACK,
        color: '#1a1410',
        background: '#fbf8f5',
      }}
    >
      {/* Atmospheric gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse 700px 460px at 18% 14%, ${bgTint} 0%, transparent 62%),
            radial-gradient(ellipse 800px 560px at 86% 88%, ${bgTint2} 0%, transparent 58%),
            radial-gradient(ellipse 420px 320px at 52% 52%, ${accent}05 0%, transparent 70%)
          `,
          pointerEvents: 'none',
        }}
      />
      {/* Noise */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.4,
          mixBlendMode: 'multiply',
          backgroundImage: noiseSvg,
          pointerEvents: 'none',
        }}
      />

      {/* Top bar */}
      <div
        style={{
          position: 'relative',
          height: 58,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {breathingAvatar(30)}
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                letterSpacing: -0.2,
                color: '#1a1410',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {botName}
            </div>
            {chatbot.description && (
              <div
                style={{
                  fontSize: 11.5,
                  color: 'rgba(26,20,16,0.55)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 1,
                }}
              >
                {chatbot.description}
              </div>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginLeft: 6,
              padding: '3px 10px',
              background: `${accent}14`,
              borderRadius: 999,
              fontSize: 10.5,
              color: accent,
              fontWeight: 700,
              letterSpacing: 0.4,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                background: accent,
                animation: 'v2pulse 2s infinite ease-in-out',
              }}
            />
            ONLINE
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div
            style={{
              fontSize: 11.5,
              color: 'rgba(26,20,16,0.65)',
              padding: '4px 10px',
              borderRadius: 999,
              border: '1px solid rgba(0,0,0,0.08)',
              fontWeight: 500,
              letterSpacing: 0.3,
            }}
          >
            {lang}
          </div>
          {messages.length > 0 && (
            <div style={{ position: 'relative' }}>
              <TopIconBtn
                title="New conversation"
                onClick={() => setShowClearConfirm((v) => !v)}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M2.5 13.5L4 10l8-8 2 2-8 8-3.5 1.5z" />
                  <path d="M10 3.5L12.5 6" />
                </svg>
              </TopIconBtn>
              {showClearConfirm && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    background: '#fff',
                    borderRadius: 12,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)',
                    padding: 12,
                    width: 200,
                    zIndex: 20,
                  }}
                >
                  <p
                    style={{
                      fontSize: 12.5,
                      color: 'rgba(26,20,16,0.7)',
                      margin: '0 0 10px 0',
                    }}
                  >
                    Start a new conversation?
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={clearChat}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: accent,
                        color: '#fff',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      New
                    </button>
                    <button
                      onClick={() => setShowClearConfirm(false)}
                      style={{
                        flex: 1,
                        fontSize: 12,
                        padding: '7px 10px',
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.04)',
                        color: 'rgba(26,20,16,0.7)',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Centered conversation */}
      <div
        style={{
          position: 'absolute',
          top: 58,
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '24px 24px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 720,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isEmpty && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '20px 0 36px',
              }}
            >
              {breathingAvatar(68)}
              {chatbot.welcomeEyebrow ? (
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: 1.4,
                    textTransform: 'uppercase',
                    color: 'rgba(26,20,16,0.55)',
                    margin: '20px 0 0',
                  }}
                >
                  {chatbot.welcomeEyebrow}
                </div>
              ) : null}
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  letterSpacing: -1.2,
                  lineHeight: 1.12,
                  margin: chatbot.welcomeEyebrow ? '10px 0 10px' : '26px 0 10px',
                  color: '#1a1410',
                  maxWidth: 480,
                  textWrap: 'balance' as CSSProperties['textWrap'],
                }}
                dangerouslySetInnerHTML={{
                  __html: chatbot.welcomeHeadline
                    ? renderAccentMarkdown(chatbot.welcomeHeadline, accent)
                    : `Hi — I&apos;m <span style="color:${accent}">${escapeHtml(displayName)}</span>${displayName.endsWith('s') ? "'" : "'s"} assistant.`,
                }}
              />
              <p
                style={{
                  fontSize: 15.5,
                  lineHeight: 1.55,
                  color: 'rgba(26,20,16,0.65)',
                  margin: 0,
                  maxWidth: 460,
                  textWrap: 'pretty' as CSSProperties['textWrap'],
                }}
              >
                {welcome}
              </p>
            </div>
          )}

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              paddingBottom: 12,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(0,0,0,0.08) transparent',
            }}
          >
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <UserRow key={m.id} accent={accent}>
                  {m.content}
                </UserRow>
              ) : (
                <BotRow
                  key={m.id}
                  accent={accent}
                  initials={initials}
                  source={chatbot.showSources && m.sources && m.sources.length > 0 ? m.sources[0].documentTitle : undefined}
                  extraSources={chatbot.showSources && m.sources && m.sources.length > 1 ? m.sources.length - 1 : 0}
                  showActions={i === messages.length - 1 && !m.isStreaming && !loading && m.id !== 'welcome'}
                  onReact={(r) => handleReaction(m.id, m.messageId, r)}
                  reaction={m.reaction}
                  copied={copiedId === m.id}
                  onCopy={() => handleCopy(m.id, m.content)}
                >
                  {m.isStreaming && !m.content ? (
                    <Typing accent={accent} />
                  ) : (
                    <>
                      <div
                        className="md-content"
                        dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content, accent) }}
                      />
                      {m.isStreaming && (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 2,
                            height: 16,
                            marginLeft: 2,
                            verticalAlign: 'text-bottom',
                            borderRadius: 2,
                            background: accent,
                            animation: 'v2caret 1s infinite steps(2)',
                          }}
                        />
                      )}
                    </>
                  )}
                </BotRow>
              )
            )}
            {loading && !messages.some((m) => m.isStreaming) && (
              <BotRow accent={accent} initials={initials}>
                <Typing accent={accent} />
              </BotRow>
            )}
          </div>

          <div style={{ paddingBottom: 22 }}>
            {isEmpty && prompts.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  justifyContent: 'center',
                  marginBottom: 14,
                }}
              >
                {prompts.map((p, i) => (
                  <PromptChip key={i} accent={accent} onClick={() => sendMessage(p)} disabled={loading}>
                    {p}
                  </PromptChip>
                ))}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fff',
                borderRadius: 18,
                padding: '6px 6px 6px 18px',
                boxShadow:
                  '0 2px 4px rgba(0,0,0,0.04), 0 10px 28px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask a question…"
                value={input}
                disabled={loading}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSubmit()
                }}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 15,
                  color: '#1a1410',
                  fontFamily: 'inherit',
                  padding: '10px 0',
                }}
              />
              <button
                onClick={handleSubmit}
                disabled={!input.trim() || loading}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                  background: input.trim() && !loading ? accent : 'rgba(0,0,0,0.06)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow:
                    input.trim() && !loading
                      ? `0 4px 14px ${accent}50, inset 0 1px 0 rgba(255,255,255,0.2)`
                      : 'none',
                  transition: 'all 0.15s',
                }}
                aria-label="Send"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M8 13V3M3 8l5-5 5 5" />
                </svg>
              </button>
            </div>

            {chatbot.showBranding && (
              <div
                style={{
                  textAlign: 'center',
                  marginTop: 10,
                  fontSize: 11,
                  color: 'rgba(26,20,16,0.42)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                }}
              >
                Powered by{' '}
                <a
                  href="https://chataziendale.it"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontWeight: 600,
                    color: 'rgba(26,20,16,0.65)',
                    textDecoration: 'none',
                  }}
                >
                  ChatAziendale
                </a>
                <span style={{ opacity: 0.4 }}>·</span>
                Answers may be inaccurate
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes v2pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes v2breathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.045); }
        }
        @keyframes v2msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes v2dot {
          0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
          40% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes v2caret {
          50% { opacity: 0; }
        }
        .md-content .md-p { margin: 0 0 10px 0; }
        .md-content .md-p:last-child { margin-bottom: 0; }
        .md-content .md-h2,
        .md-content .md-h3,
        .md-content .md-h4 {
          margin: 12px 0 6px 0;
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
        .md-content .md-ul,
        .md-content .md-ol {
          margin: 8px 0;
          padding-left: 20px;
        }
        .md-content .md-ul { list-style-type: disc; }
        .md-content .md-ol { list-style-type: decimal; }
        .md-content .md-li,
        .md-content .md-oli {
          margin: 4px 0;
          line-height: 1.55;
        }
        .v2-scroll::-webkit-scrollbar { width: 6px; }
        .v2-scroll::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.12);
          border-radius: 3px;
        }
      `}</style>
    </div>
  )
}

function UserRow({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        animation: 'v2msgIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          background: accent,
          color: '#fff',
          borderRadius: '18px 6px 18px 18px',
          padding: '11px 16px',
          fontSize: 14.5,
          lineHeight: 1.5,
          maxWidth: 460,
          boxShadow: `0 2px 10px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.15)`,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface BotRowProps {
  accent: string
  initials: string
  source?: string
  extraSources?: number
  showActions?: boolean
  onReact?: (r: 'up' | 'down') => void
  reaction?: 'up' | 'down'
  copied?: boolean
  onCopy?: () => void
  children: React.ReactNode
}

function BotRow({
  accent,
  initials,
  source,
  extraSources = 0,
  showActions,
  onReact,
  reaction,
  copied,
  onCopy,
  children,
}: BotRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'flex-start',
        animation: 'v2msgIn 0.3s ease-out',
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${accent}, ${accent}cc)`,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: -0.2,
          flexShrink: 0,
          boxShadow: `0 2px 6px ${accent}30`,
        }}
      >
        {initials}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flex: 1,
          minWidth: 0,
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,0,0,0.04)',
            borderRadius: '6px 18px 18px 18px',
            padding: '12px 16px',
            fontSize: 14.5,
            lineHeight: 1.55,
            color: '#1a1410',
            maxWidth: 560,
            alignSelf: 'flex-start',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            wordBreak: 'break-word',
          }}
        >
          {children}
          {source && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 10,
                borderTop: '1px dashed rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                color: 'rgba(26,20,16,0.65)',
                flexWrap: 'wrap',
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke={accent} strokeWidth="1.8">
                <path d="M7 1H3a1 1 0 00-1 1v8a1 1 0 001 1h6a1 1 0 001-1V4L7 1z" />
                <path d="M7 1v3h3" />
              </svg>
              <span style={{ color: accent, fontWeight: 600 }}>Source:</span>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 280,
                }}
              >
                {source}
              </span>
              {extraSources > 0 && (
                <span style={{ opacity: 0.6 }}>+ {extraSources} more</span>
              )}
            </div>
          )}
        </div>
        {showActions && (
          <div style={{ display: 'flex', gap: 2, paddingLeft: 4 }}>
            <ActionBtn
              title="Helpful"
              active={reaction === 'up'}
              activeColor="#059669"
              onClick={() => onReact?.('up')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 6.5v5H2.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5H4zM4 6.5L6.5 2a1.5 1.5 0 011.5 1v3h3a1 1 0 011 1l-1 4a1 1 0 01-1 .5H4" />
              </svg>
            </ActionBtn>
            <ActionBtn
              title="Not helpful"
              active={reaction === 'down'}
              activeColor="#dc2626"
              onClick={() => onReact?.('down')}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: 'rotate(180deg)' }}
              >
                <path d="M4 6.5v5H2.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5H4zM4 6.5L6.5 2a1.5 1.5 0 011.5 1v3h3a1 1 0 011 1l-1 4a1 1 0 01-1 .5H4" />
              </svg>
            </ActionBtn>
            <ActionBtn title={copied ? 'Copied!' : 'Copy'} onClick={onCopy}>
              {copied ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 7l3 3 5-6" />
                </svg>
              ) : (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="4" y="4" width="8" height="8" rx="1.5" />
                  <path d="M2 10V3a1 1 0 011-1h7" />
                </svg>
              )}
            </ActionBtn>
          </div>
        )}
      </div>
    </div>
  )
}

function ActionBtn({
  children,
  title,
  onClick,
  active,
  activeColor,
}: {
  children: React.ReactNode
  title?: string
  onClick?: () => void
  active?: boolean
  activeColor?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 24,
        height: 24,
        borderRadius: 6,
        border: 'none',
        background: active ? 'rgba(0,0,0,0.04)' : 'transparent',
        color: active ? activeColor ?? '#1a1410' : 'rgba(26,20,16,0.42)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.12s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.7)'
          e.currentTarget.style.color = '#1a1410'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'rgba(26,20,16,0.42)'
        }
      }}
    >
      {children}
    </button>
  )
}

function TopIconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        border: 'none',
        background: 'transparent',
        color: 'rgba(26,20,16,0.65)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.12s',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.7)'
        e.currentTarget.style.color = '#1a1410'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'rgba(26,20,16,0.65)'
      }}
    >
      {children}
    </button>
  )
}

function PromptChip({
  accent,
  onClick,
  disabled,
  children,
}: {
  accent: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '10px 15px',
        borderRadius: 999,
        border: '1px solid rgba(0,0,0,0.08)',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(6px)',
        fontSize: 13,
        color: '#1a1410',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        letterSpacing: -0.1,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        transition: 'all 0.15s',
      }}
      onMouseEnter={(e) => {
        if (disabled) return
        e.currentTarget.style.borderColor = accent
        e.currentTarget.style.color = accent
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'
        e.currentTarget.style.color = '#1a1410'
      }}
    >
      {children}
    </button>
  )
}

function Typing({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, padding: '4px 2px' }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: 4,
            background: accent,
            animation: `v2dot 1.3s ${i * 0.18}s infinite ease-in-out`,
          }}
        />
      ))}
    </div>
  )
}
