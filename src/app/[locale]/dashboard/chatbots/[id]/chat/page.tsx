'use client'

import { useEffect, useMemo, useRef, useState, use } from 'react'
import { Link } from '@/i18n/navigation'
import { useTranslations } from 'next-intl'

interface Source {
  chunkId: string
  content: string
  similarity: number
  documentTitle: string
  dataSourceName: string
  sourceUrl?: string
}

type Confidence = 'high' | 'medium' | 'low'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: Confidence
  isStreaming?: boolean
  messageId?: string
  reaction?: 'up' | 'down'
  feedbackHint?: string
}

interface Chatbot {
  id: string
  name: string
  description?: string | null
  welcomeEyebrow?: string | null
  welcomeHeadline?: string | null
  welcomeMessage?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  showBranding?: boolean
  showSources?: boolean
  suggestedPrompts?: string[]
  chatIconType?: 'default' | 'preset' | 'custom' | null
  chatIconPreset?: string | null
  chatIconImage?: string | null
}

// ── Icons ──────────────────────────────────────────────────────────────
const PRESET_ICONS: Record<string, string> = {
  headset:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  robot:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
  help:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  star:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  bolt:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  heart:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  'message-circle':
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="100%" height="100%"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
}

const DEFAULT_AVATAR_SVG =
  '<svg viewBox="0 0 20 20" fill="none" width="100%" height="100%"><path d="M10 3 C 7 6, 6 9, 7 12 C 8 14, 10 15, 10 17 C 10 15, 12 14, 13 12 C 14 9, 13 6, 10 3 Z" fill="white" fill-opacity="0.95"/><circle cx="10" cy="11.5" r="1.4" fill="rgba(0,0,0,0.18)"/></svg>'

// ── Color helpers ──────────────────────────────────────────────────────
function hexToRgb(hex: string) {
  const h = (hex || '#3B82F6').replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(n, 16) || 0
  return { r: (num >> 16) & 0xff, g: (num >> 8) & 0xff, b: num & 0xff }
}

function rgba(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex)
  return `rgba(${r},${g},${b},${a})`
}

function shade(hex: string, pct: number) {
  const { r, g, b } = hexToRgb(hex)
  const f = (c: number) =>
    Math.max(0, Math.min(255, Math.round(c + (pct / 100) * (pct > 0 ? 255 - c : c))))
  return '#' + [f(r), f(g), f(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

// ── Markdown ───────────────────────────────────────────────────────────
// Mirrors the widget's block-level parser. Escapes first, then inline transforms.
function escapeHtml(text: string) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function parseMarkdown(text: string): string {
  const escaped = escapeHtml(text)

  const codeBlocks: string[] = []
  const stashed = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, _lang, code) => {
    const i =
      codeBlocks.push(
        `<pre class="md-code-block"><code>${code.trim()}</code></pre>`
      ) - 1
    return ` CB${i} `
  })

  function inline(s: string) {
    s = s.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>')
    s = s.replace(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g, '<em>$1</em>')
    s = s.replace(/(?<![_\w])_([^_\n]+)_(?![_\w])/g, '<em>$1</em>')
    s = s.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener" class="md-link">$1</a>'
    )
    return s
  }

  const blocks = stashed.split(/\n{2,}/)
  const out: string[] = []
  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, '')
    if (!block) continue

    const codeMatch = block.match(/^ CB(\d+) $/)
    if (codeMatch) {
      out.push(codeBlocks[+codeMatch[1]])
      continue
    }

    const h = block.match(/^(#{1,3}) (.+)$/)
    if (h) {
      const level = h[1].length + 1
      out.push(
        `<h${level} class="md-h${level}">${inline(h[2])}</h${level}>`
      )
      continue
    }

    if (block.split('\n').every((l) => /^[-*] /.test(l))) {
      const items = block
        .split('\n')
        .map((l) => `<li class="md-li">${inline(l.replace(/^[-*] /, ''))}</li>`)
        .join('')
      out.push(`<ul class="md-ul">${items}</ul>`)
      continue
    }

    if (block.split('\n').every((l) => /^\d+\. /.test(l))) {
      const items = block
        .split('\n')
        .map((l) => `<li class="md-oli">${inline(l.replace(/^\d+\. /, ''))}</li>`)
        .join('')
      out.push(`<ol class="md-ol">${items}</ol>`)
      continue
    }

    out.push(`<p class="md-p">${inline(block).replace(/\n/g, '<br>')}</p>`)
  }
  return out.join('')
}

// Renders single-line "accent markdown" — *word* wraps the word in the accent color.
function renderAccentHeadline(text: string, accent: string) {
  const escaped = escapeHtml(text)
  const html = escaped.replace(
    /\*([^*\n]+)\*/g,
    `<span style="color:${accent}">$1</span>`
  )
  return { __html: html }
}

function dedupSources(sources: Source[]): Source[] {
  const seen = new Set<string>()
  return sources.filter((s) => {
    if (!s || !s.documentTitle) return false
    if (seen.has(s.documentTitle)) return false
    seen.add(s.documentTitle)
    return true
  })
}

function getAvatarHTML(chatbot: Chatbot | null): string {
  if (
    chatbot?.chatIconType === 'preset' &&
    chatbot?.chatIconPreset &&
    PRESET_ICONS[chatbot.chatIconPreset]
  ) {
    return PRESET_ICONS[chatbot.chatIconPreset]
  }
  if (chatbot?.chatIconType === 'custom' && chatbot?.chatIconImage) {
    const safe = chatbot.chatIconImage.replace(/"/g, '&quot;')
    return `<img src="${safe}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
  }
  return DEFAULT_AVATAR_SVG
}

// ── Component ──────────────────────────────────────────────────────────
export default function ChatbotTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: chatbotId } = use(params)
  const t = useTranslations('chatbotDetail')
  const tc = useTranslations('common')

  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState(
    () => `test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  )
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load chatbot')
        return res.json()
      })
      .then((data) => {
        if (data.chatbot) setChatbot(data.chatbot as Chatbot)
      })
      .catch((err) => {
        setMessages([
          {
            id: 'error',
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Failed to load chatbot'}`,
          },
        ])
      })
  }, [chatbotId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const accent = chatbot?.primaryColor || '#3B82F6'
  const accent2 = chatbot?.secondaryColor || accent

  // CSS vars applied to the chat surface so user bubble / send btn / links pick them up.
  const themeStyle = useMemo(
    () =>
      ({
        ['--accent' as string]: accent,
        ['--accent-shade' as string]: shade(accent, -12),
        ['--accent-soft' as string]: rgba(accent, 0.1),
        ['--accent-faint' as string]: rgba(accent, 0.08),
        ['--accent-line' as string]: rgba(accent, 0.4),
        ['--accent2' as string]: accent2,
      }) as React.CSSProperties,
    [accent, accent2]
  )

  const submitInput = () => {
    const v = input.trim()
    if (!v) return
    sendMessage(v)
    setInput('')
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submitInput()
    }
  }

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  const resetConversation = () => {
    if (messages.length === 0 || confirm('Start a new conversation?')) {
      setMessages([])
      setSessionId(`test-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`)
    }
  }

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim() || loading) return
    setLoading(true)

    const userMsgId = `user-${Date.now()}`
    const assistantMsgId = `assistant-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: userMessage },
    ])

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatbotId, sessionId, message: userMessage }),
      })

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to send message')
      }

      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
      ])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: {
        sources?: Source[]
        confidence?: Confidence
        messageId?: string
      } | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') continue

          try {
            const parsed = JSON.parse(payload)
            if (parsed.type === 'metadata') {
              metadata = {
                sources: parsed.sources,
                confidence: parsed.confidence,
              }
            } else if (parsed.messageId) {
              metadata = metadata || {}
              metadata.messageId = parsed.messageId
            } else if (parsed.content) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: msg.content + parsed.content }
                    : msg
                )
              )
            }
          } catch {
            // ignore
          }
        }
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                isStreaming: false,
                sources: metadata?.sources,
                confidence: metadata?.confidence,
                messageId: metadata?.messageId,
              }
            : msg
        )
      )
    } catch (err) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== assistantMsgId)
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          },
        ]
      })
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  const handleReaction = async (
    messageLocalId: string,
    reaction: 'up' | 'down' | 'copy'
  ) => {
    const msg = messages.find((m) => m.id === messageLocalId)
    if (!msg) return

    if (reaction === 'copy') {
      try {
        await navigator.clipboard.writeText(msg.content)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageLocalId ? { ...m, feedbackHint: 'Copied' } : m
          )
        )
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageLocalId ? { ...m, feedbackHint: undefined } : m
            )
          )
        }, 1800)
      } catch {
        // ignore
      }
      return
    }

    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageLocalId
          ? {
              ...m,
              reaction,
              feedbackHint: reaction === 'up' ? 'Thanks!' : 'Thanks for the feedback',
            }
          : m
      )
    )
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageLocalId ? { ...m, feedbackHint: undefined } : m
        )
      )
    }, 2400)

    if (!msg.messageId) return
    try {
      await fetch('/api/chat/reaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: msg.messageId,
          reaction,
          sessionId,
        }),
      })
    } catch (err) {
      console.error('Failed to save reaction:', err)
    }
  }

  if (!chatbot) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          {tc('loading')}
        </div>
      </div>
    )
  }

  const isEmpty = messages.length === 0
  const eyebrow =
    (chatbot.welcomeEyebrow ?? '').trim() || 'Knowledge assistant'
  const headline =
    (chatbot.welcomeHeadline ?? '').trim() || 'Hi — what would you like to *know*?'
  const welcome =
    (chatbot.welcomeMessage ?? '').trim() ||
    (chatbot.name ? `Ask me anything about ${chatbot.name}.` : 'Ask me anything.')
  const suggestedPrompts = (chatbot.suggestedPrompts || []).filter(Boolean)
  const avatarBg = `linear-gradient(135deg, ${shade(accent, 8)}, ${shade(accent, -10)})`

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50" style={themeStyle}>
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-md overflow-hidden"
            style={{ background: avatarBg }}
          >
            <span
              className="block w-[62%] h-[62%]"
              dangerouslySetInnerHTML={{ __html: getAvatarHTML(chatbot) }}
            />
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">{chatbot.name}</h1>
            <p className="text-sm text-slate-500">{t('testMode')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={resetConversation}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="New conversation"
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8a5 5 0 019-3M13 8a5 5 0 01-9 3M11 5h2V3M5 11H3v2" />
            </svg>
            New
          </button>
          <Link
            href={`/dashboard/chatbots/${chatbotId}`}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {tc('configure')}
          </Link>
          <Link
            href="/dashboard/chatbots"
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('close')}
          </Link>
        </div>
      </div>

      {/* Messages / Empty state */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {isEmpty && (
            <div className="pt-4 pb-2 space-y-6">
              <div className="space-y-2">
                {eyebrow && (
                  <div
                    className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase font-mono"
                    style={{ color: accent }}
                  >
                    <span className="block w-3.5 h-px opacity-60" style={{ background: accent }} />
                    {eyebrow}
                  </div>
                )}
                <h2
                  className="text-2xl font-semibold tracking-tight text-slate-900 leading-snug"
                  dangerouslySetInnerHTML={renderAccentHeadline(headline, accent)}
                />
                <p className="text-slate-600 leading-relaxed">{welcome}</p>
              </div>

              {suggestedPrompts.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold tracking-[0.13em] uppercase text-slate-400 font-mono">
                    Try asking
                  </div>
                  <div className="space-y-1.5">
                    {suggestedPrompts.map((p, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => sendMessage(p)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left text-[14px] text-slate-800 bg-white border border-slate-200 rounded-xl hover:-translate-y-px transition-all"
                        style={{ borderColor: 'var(--accent-line)' as string, borderImage: 'none' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = accent
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = ''
                        }}
                      >
                        <span className="flex-1">{p}</span>
                        <span style={{ color: accent }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7h8M7 3l4 4-4 4" />
                          </svg>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((message) => {
            if (message.role === 'user') {
              return (
                <div key={message.id} className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl px-5 py-3 text-white shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${accent}, ${shade(accent, -12)})` }}
                  >
                    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                </div>
              )
            }

            const uniqueSources =
              chatbot.showSources !== false && message.sources
                ? dedupSources(message.sources)
                : []

            return (
              <div key={message.id} className="flex justify-start gap-2.5">
                <div
                  className="w-7 h-7 mt-1 rounded-lg flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0"
                  style={{ background: avatarBg }}
                >
                  <span
                    className="block w-[62%] h-[62%]"
                    dangerouslySetInnerHTML={{ __html: getAvatarHTML(chatbot) }}
                  />
                </div>
                <div className="flex flex-col gap-2 min-w-0 max-w-[80%]">
                  <div className="rounded-2xl rounded-tl-sm px-5 py-3.5 bg-white border border-slate-200/60 text-slate-900 shadow-sm">
                    <div
                      className="cb-md text-[15px] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: parseMarkdown(message.content) }}
                    />
                    {message.isStreaming && (
                      <span className="inline-block w-0.5 h-5 ml-0.5 align-text-bottom bg-slate-400 animate-pulse" />
                    )}

                    {uniqueSources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-dashed border-slate-200 space-y-2">
                        <div className="text-[10px] font-bold tracking-[0.11em] uppercase text-slate-400 font-mono">
                          {tc('sources')} · {uniqueSources.length}
                        </div>
                        <div className="space-y-1">
                          {uniqueSources.map((s, idx) => {
                            const NodeTag = (s.sourceUrl ? 'a' : 'div') as 'a' | 'div'
                            return (
                              <NodeTag
                                key={idx}
                                {...(s.sourceUrl
                                  ? { href: s.sourceUrl, target: '_blank', rel: 'noopener noreferrer' }
                                  : {})}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50 text-xs text-slate-600 hover:bg-[var(--accent-soft)] transition-colors"
                              >
                                <span
                                  className="w-[18px] h-[18px] rounded-md bg-white border border-slate-200 inline-flex items-center justify-center text-[9.5px] font-bold font-mono shrink-0"
                                  style={{ color: accent }}
                                >
                                  {idx + 1}
                                </span>
                                <span className="text-slate-700 font-medium truncate">
                                  {s.documentTitle}
                                </span>
                                <span className="ml-auto text-slate-400 text-[10px] font-mono shrink-0">
                                  {Math.round(s.similarity * 100)}%
                                </span>
                              </NodeTag>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confidence + Actions row */}
                  {!message.isStreaming && message.content && (
                    <div className="flex items-center gap-1.5 pl-1 flex-wrap">
                      {message.confidence && (
                        <span
                          className={`inline-flex items-center text-[9.5px] font-bold tracking-wider uppercase font-mono px-2 py-0.5 rounded ${
                            message.confidence === 'high'
                              ? 'bg-green-100 text-green-700'
                              : message.confidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {message.confidence === 'high'
                            ? 'High confidence'
                            : message.confidence === 'medium'
                              ? 'Medium confidence'
                              : 'Low confidence'}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleReaction(message.id, 'up')}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          message.reaction === 'up'
                            ? 'bg-[var(--accent-soft)]'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                        style={message.reaction === 'up' ? { color: accent } : undefined}
                        title="Helpful"
                        aria-label="Helpful"
                      >
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 6.5v5H2.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5H4zM4 6.5L6.5 2a1.5 1.5 0 011.5 1v3h3a1 1 0 011 1l-1 4a1 1 0 01-1 .5H4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReaction(message.id, 'down')}
                        className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                          message.reaction === 'down'
                            ? 'bg-[var(--accent-soft)]'
                            : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                        }`}
                        style={message.reaction === 'down' ? { color: accent } : undefined}
                        title="Not helpful"
                        aria-label="Not helpful"
                      >
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'rotate(180deg)' }}>
                          <path d="M4 6.5v5H2.5a.5.5 0 01-.5-.5v-4a.5.5 0 01.5-.5H4zM4 6.5L6.5 2a1.5 1.5 0 011.5 1v3h3a1 1 0 011 1l-1 4a1 1 0 01-1 .5H4" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReaction(message.id, 'copy')}
                        className="w-6 h-6 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center transition-colors"
                        title="Copy"
                        aria-label="Copy"
                      >
                        <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="4" y="4" width="8" height="8" rx="1.5" />
                          <path d="M2 10V3a1 1 0 011-1h7" />
                        </svg>
                      </button>
                      {message.feedbackHint && (
                        <span className="text-[10.5px] text-slate-500 ml-1">
                          {message.feedbackHint}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {loading && !messages.some((m) => m.isStreaming) && (
            <div className="flex justify-start gap-2.5">
              <div
                className="w-7 h-7 mt-1 rounded-lg flex items-center justify-center text-white shadow-sm overflow-hidden shrink-0"
                style={{ background: avatarBg }}
              >
                <span
                  className="block w-[62%] h-[62%]"
                  dangerouslySetInnerHTML={{ __html: getAvatarHTML(chatbot) }}
                />
              </div>
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 bg-white border border-slate-200/60 shadow-sm">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono">
                  <svg className="animate-spin" width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" style={{ color: accent }}>
                    <path d="M6 1v2M6 9v2M1 6h2M9 6h2M2.5 2.5l1.4 1.4M8.1 8.1l1.4 1.4M2.5 9.5l1.4-1.4M8.1 3.9l1.4-1.4" />
                  </svg>
                  Searching knowledge base
                  <span className="flex gap-1 ml-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: accent, animation: 'cb-dot 1.2s infinite ease-in-out' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: accent, animation: 'cb-dot 1.2s infinite ease-in-out 0.15s' }}
                    />
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block"
                      style={{ background: accent, animation: 'cb-dot 1.2s infinite ease-in-out 0.3s' }}
                    />
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="px-4 py-4 bg-white border-t border-slate-200/60">
        <div className="max-w-3xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 flex flex-col bg-slate-50 border border-slate-200 rounded-xl focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-faint)] transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={autoGrow}
                onKeyDown={handleKeyDown}
                placeholder={t('typeMessage')}
                disabled={loading}
                rows={1}
                className="w-full resize-none bg-transparent text-slate-900 placeholder-slate-400 px-4 py-3 outline-none disabled:opacity-60"
                style={{ maxHeight: '160px' }}
              />
            </div>
            <button
              type="button"
              onClick={submitInput}
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${accent}, ${shade(accent, -12)})`,
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          {chatbot.showBranding !== false && (
            <div className="mt-3 text-center text-[10.5px] text-slate-400 font-mono">
              Powered by{' '}
              <a href="https://chataziendale.it" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700 font-semibold">
                ChatAziendale
              </a>{' '}
              · AI may make mistakes
            </div>
          )}
        </div>
      </div>

      {/* Local styles for markdown + thinking dots */}
      <style jsx global>{`
        @keyframes cb-dot {
          0%, 80%, 100% { opacity: 0.3; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-3px); }
        }
        .cb-md .md-p { margin: 0 0 10px 0; }
        .cb-md .md-p:last-child { margin-bottom: 0; }
        .cb-md .md-h2, .cb-md .md-h3, .cb-md .md-h4 {
          margin: 12px 0 4px 0; font-weight: 600; line-height: 1.3;
        }
        .cb-md .md-h2 { font-size: 16px; }
        .cb-md .md-h3 { font-size: 15px; }
        .cb-md .md-h4 { font-size: 14px; }
        .cb-md .md-code-block {
          background: rgba(15, 23, 42, 0.05);
          color: #0f172a;
          padding: 10px 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace;
          font-size: 12.5px;
          margin: 8px 0;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .cb-md .md-inline-code {
          background: rgba(15, 23, 42, 0.06);
          color: var(--accent);
          padding: 1px 6px;
          border-radius: 4px;
          font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace;
          font-size: 12.5px;
        }
        .cb-md .md-ul, .cb-md .md-ol { margin: 6px 0; padding-left: 22px; }
        .cb-md .md-li, .cb-md .md-oli { margin: 3px 0; line-height: 1.55; }
        .cb-md .md-link { color: var(--accent); text-decoration: none; font-weight: 500; }
        .cb-md .md-link:hover { text-decoration: underline; }
        .cb-md strong { color: var(--accent); font-weight: 600; }
      `}</style>
    </div>
  )
}
