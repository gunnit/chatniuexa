'use client'

import { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'

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

interface Chatbot {
  id: string
  name: string
  welcomeMessage: string
  primaryColor: string
}

export default function ChatbotTestPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: chatbotId } = use(params)
  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId] = useState(() => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load chatbot')
        return res.json()
      })
      .then((data) => {
        if (data.chatbot) {
          setChatbot(data.chatbot)
          setMessages([
            {
              id: 'welcome',
              role: 'assistant',
              content: data.chatbot.welcomeMessage || 'Hello! How can I help you?',
            },
          ])
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setLoading(true)

    const assistantMsgId = `assistant-${Date.now()}`

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', content: userMessage },
    ])

    try {
      const res = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatbotId,
          sessionId,
          message: userMessage,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send message')
      }

      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true },
      ])

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''
      let metadata: { sources?: Source[]; confidence?: string } | null = null

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
              setMessages((prev) =>
                prev.map((msg) =>
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
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, content: msg.content + parsed.content }
                      : msg
                  )
                )
              }
            } catch {
              // Ignore parse errors
            }
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
            content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`,
          },
        ]
      })
    } finally {
      setLoading(false)
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
          Loading chatbot...
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="px-6 py-4 bg-white border-b border-slate-200/60 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-md"
            style={{ backgroundColor: chatbot.primaryColor || '#6366f1' }}
          >
            {chatbot.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">{chatbot.name}</h1>
            <p className="text-sm text-slate-500">Test Mode</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/dashboard/chatbots/${chatbotId}`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure
          </Link>
          <Link
            href="/dashboard/chatbots"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Close
          </Link>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-5 py-3.5 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white'
                    : 'bg-white border border-slate-200/60 text-slate-900'
                }`}
              >
                <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
                  {message.content}
                  {message.isStreaming && (
                    <span className="inline-block w-0.5 h-5 ml-1 bg-current animate-pulse" />
                  )}
                </p>

                {/* Sources */}
                {message.sources && message.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200/60">
                    <p className="text-xs font-medium text-slate-500 mb-2">Sources:</p>
                    <div className="space-y-1.5">
                      {message.sources.map((source, idx) => (
                        <div
                          key={idx}
                          className="text-xs p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                        >
                          <span className="font-medium text-slate-700">{source.documentTitle}</span>
                          <span className="text-slate-600 ml-2">
                            ({Math.round(source.similarity * 100)}% match)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && !messages.some((m) => m.isStreaming) && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200/60 rounded-2xl px-5 py-4 shadow-sm">
                <div className="flex space-x-1.5">
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="px-4 py-4 bg-white border-t border-slate-200/60">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              disabled={loading}
              className="flex-1 px-5 py-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3.5 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
