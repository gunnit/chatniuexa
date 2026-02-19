'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'

interface Chatbot {
  id: string
  name: string
  description: string | null
  systemPrompt: string | null
  temperature: number
  model: string
  primaryColor: string | null
  secondaryColor: string | null
  welcomeMessage: string | null
  showBranding: boolean
  suggestedPrompts: string[]
  chatIconType: string | null
  chatIconPreset: string | null
  chatIconImage: string | null
}

const PRESET_ICONS: Record<string, { label: string; svg: string }> = {
  headset: {
    label: 'Headset',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>',
  },
  robot: {
    label: 'Robot',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>',
  },
  help: {
    label: 'Help',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  },
  star: {
    label: 'Star',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  },
  bolt: {
    label: 'Bolt',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  },
  heart: {
    label: 'Heart',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  },
  'message-circle': {
    label: 'Message',
    svg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  },
}

// Instruction templates for common chatbot use cases
const INSTRUCTION_TEMPLATES = [
  {
    id: 'custom',
    name: 'Custom',
    description: 'Write your own instructions from scratch',
    prompt: '',
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Empathetic, solution-focused support agent',
    prompt: `You are a friendly and helpful customer support agent. Your goal is to assist customers with their questions and issues.

Guidelines:
- Be empathetic and patient with customers
- Apologize for any inconvenience when appropriate
- Provide clear, step-by-step solutions
- If you don't know the answer, admit it honestly and offer to escalate
- Always maintain a professional yet warm tone
- Ask clarifying questions if the issue is unclear

When handling complaints, acknowledge the customer's frustration before offering solutions.`,
  },
  {
    id: 'sales-assistant',
    name: 'Sales Assistant',
    description: 'Helpful guide for product questions and purchases',
    prompt: `You are a knowledgeable sales assistant. Your goal is to help customers find the right products and answer their questions.

Guidelines:
- Be enthusiastic but not pushy
- Focus on understanding customer needs before making recommendations
- Highlight relevant features and benefits
- Be honest about limitations or when a product might not be the best fit
- Offer comparisons when helpful
- Guide customers toward making informed decisions

Never pressure customers or make false claims about products.`,
  },
  {
    id: 'faq-bot',
    name: 'FAQ Bot',
    description: 'Direct, accurate answers with source citations',
    prompt: `You are a helpful FAQ assistant. Your role is to provide accurate, concise answers to frequently asked questions.

Guidelines:
- Give direct answers without unnecessary preamble
- Keep responses concise and to the point
- When information comes from specific sources, mention them
- If a question falls outside your knowledge, say so clearly
- For complex topics, break down the answer into digestible parts
- Suggest related questions the user might find helpful

Prioritize accuracy over comprehensiveness.`,
  },
  {
    id: 'technical-support',
    name: 'Technical Support',
    description: 'Patient, step-by-step troubleshooting guide',
    prompt: `You are a patient technical support specialist. Your goal is to help users troubleshoot and resolve technical issues.

Guidelines:
- Start with the simplest solutions first
- Provide clear, numbered step-by-step instructions
- Explain technical concepts in plain language
- Ask diagnostic questions to narrow down the issue
- Verify each step before moving to the next
- Offer preventive tips when relevant

Never assume the user's technical skill level. Adapt your explanations based on their responses.`,
  },
  {
    id: 'lead-qualifier',
    name: 'Lead Qualifier',
    description: 'Gathers information to qualify potential customers',
    prompt: `You are a friendly assistant helping to understand visitor needs. Your goal is to gather information to connect them with the right solutions.

Guidelines:
- Start with open-ended questions about their needs
- Gather key information: company size, industry, timeline, budget range
- Be conversational, not interrogative
- Explain why you're asking certain questions
- Summarize what you've learned before offering next steps
- Offer to connect them with a human representative when appropriate

Focus on being helpful rather than sales-focused.`,
  },
] as const

export default function ChatbotConfigPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: chatbotId } = use(params)
  const [chatbot, setChatbot] = useState<Chatbot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced' | 'widget' | 'embed'>('basic')

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [temperature, setTemperature] = useState(0.7)
  const [model, setModel] = useState('gpt-5-mini')
  const [primaryColor, setPrimaryColor] = useState('#6366f1')
  const [secondaryColor, setSecondaryColor] = useState('#6366f1')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [showBranding, setShowBranding] = useState(true)
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([])
  const [newPrompt, setNewPrompt] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('custom')
  const [chatIconType, setChatIconType] = useState<string>('default')
  const [chatIconPreset, setChatIconPreset] = useState<string | null>(null)
  const [chatIconImage, setChatIconImage] = useState<string | null>(null)
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/chatbots/${chatbotId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load chatbot')
        return res.json()
      })
      .then((data) => {
        if (data.chatbot) {
          const c = data.chatbot
          setChatbot(c)
          setName(c.name)
          setDescription(c.description || '')
          setSystemPrompt(c.systemPrompt || '')
          setTemperature(c.temperature)
          setModel(c.model)
          setPrimaryColor(c.primaryColor || '#6366f1')
          setSecondaryColor(c.secondaryColor || '#6366f1')
          setWelcomeMessage(c.welcomeMessage || 'Hello! How can I help you?')
          setShowBranding(c.showBranding)
          setSuggestedPrompts(c.suggestedPrompts || [])
          setChatIconType(c.chatIconType || 'default')
          setChatIconPreset(c.chatIconPreset || null)
          setChatIconImage(c.chatIconImage || null)
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load chatbot')
      })
      .finally(() => setLoading(false))
  }, [chatbotId])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          systemPrompt: systemPrompt || undefined,
          temperature,
          model,
          primaryColor: primaryColor || undefined,
          secondaryColor: secondaryColor || undefined,
          welcomeMessage: welcomeMessage || undefined,
          showBranding,
          suggestedPrompts,
          chatIconType,
          chatIconPreset: chatIconType === 'preset' ? chatIconPreset : null,
          chatIconImage: chatIconType === 'custom' ? chatIconImage : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save')
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleEnhance = async () => {
    setEnhancing(true)
    setEnhanceError(null)

    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/enhance-instructions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentInstructions: systemPrompt || undefined,
          template: selectedTemplate !== 'custom' ? selectedTemplate : undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to enhance instructions')
      }

      const data = await res.json()
      setSystemPrompt(data.enhancedInstructions)
      setSelectedTemplate('custom')
    } catch (err) {
      setEnhanceError(err instanceof Error ? err.message : 'Failed to enhance instructions')
    } finally {
      setEnhancing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64" />
          <div className="bg-white rounded-2xl p-6 space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-10 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (!chatbot) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/60">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-slate-900 font-medium">Chatbot not found</p>
          <Link href="/dashboard/chatbots" className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chatbots
          </Link>
        </div>
      </div>
    )
  }

  const embedCode = `<script src="${typeof window !== 'undefined' ? window.location.origin : ''}/widget.js" data-chatbot-id="${chatbotId}"></script>`

  const tabs = [
    { id: 'basic', label: 'Basic Settings', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg> },
    { id: 'advanced', label: 'Advanced', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg> },
    { id: 'widget', label: 'Widget Style', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg> },
    { id: 'embed', label: 'Embed Code', icon: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
  ] as const

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Link href="/dashboard/chatbots" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chatbots
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">Configure Chatbot</h1>
          <p className="text-slate-500 mt-1">{chatbot.name}</p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/dashboard/chatbots/${chatbotId}/chat`}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-50 text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Test
          </Link>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 transition-all shadow-md hover:shadow-lg"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Saving...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700 flex-1">{error}</p>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-emerald-700">Changes saved successfully!</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200/60 px-4">
          <nav className="flex gap-1 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Basic Settings */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chatbot Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="A brief description of what this chatbot does"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Welcome Message</label>
                <input
                  type="text"
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="Hello! How can I help you?"
                />
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Model</label>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                >
                  <option value="gpt-5-mini">GPT-5 Mini (Fast & Affordable)</option>
                  <option value="gpt-5.2">GPT-5.2 (Most Capable)</option>
                  <option value="gpt-5-nano">GPT-5 Nano (Budget)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Temperature</label>
                  <span className="text-sm font-mono text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <p className="text-sm text-slate-500 mt-2">Lower = more focused, Higher = more creative</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">System Prompt / Instructions</label>

                {/* Template Selector */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-slate-500 mb-2">Start from a template</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INSTRUCTION_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => {
                          setSelectedTemplate(template.id)
                          if (template.id !== 'custom') {
                            setSystemPrompt(template.prompt)
                          }
                        }}
                        className={`p-3 rounded-xl text-left transition-all border ${
                          selectedTemplate === template.id
                            ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <div className={`text-sm font-medium ${
                          selectedTemplate === template.id ? 'text-indigo-700' : 'text-slate-700'
                        }`}>
                          {template.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                          {template.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Enhance Button */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={enhancing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                  >
                    {enhancing ? (
                      <>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enhancing...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                        AI Enhance
                      </>
                    )}
                  </button>
                  <span className="text-xs text-slate-500">
                    Analyzes your knowledge base to generate tailored instructions
                  </span>
                </div>
                {enhanceError && (
                  <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                    <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm text-red-700 flex-1">{enhanceError}</p>
                    <button onClick={() => setEnhanceError(null)} className="text-red-500 hover:text-red-700">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Textarea */}
                <textarea
                  value={systemPrompt}
                  onChange={(e) => {
                    setSystemPrompt(e.target.value)
                    setSelectedTemplate('custom')
                  }}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm"
                  placeholder="You are a helpful assistant that..."
                />

                {/* Enhanced Tips */}
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-amber-800 mb-2">Tips for Better Instructions</h4>
                      <ul className="text-sm text-amber-700 space-y-1.5">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span><strong>Define persona:</strong> Start with &quot;You are...&quot; to set the bot&apos;s identity</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span><strong>Set the tone:</strong> Specify if responses should be formal, casual, friendly, or professional</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span><strong>Add boundaries:</strong> List topics to avoid or redirect (e.g., &quot;Don&apos;t discuss competitors&quot;)</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span><strong>Handle unknowns:</strong> Define what to say when the bot doesn&apos;t know an answer</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-500 mt-1">•</span>
                          <span><strong>Keep it focused:</strong> Shorter, clearer instructions often work better than long ones</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Widget Style */}
          {activeTab === 'widget' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Primary Color</label>
                  <p className="text-xs text-slate-500 mb-2">Chat button / launcher icon background</p>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm w-32"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Color</label>
                  <p className="text-xs text-slate-500 mb-2">Header, send button &amp; user message bubbles</p>
                  <div className="flex gap-3 items-center">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-12 rounded-xl cursor-pointer border-2 border-slate-200"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono text-sm w-32"
                      placeholder="#6366f1"
                    />
                  </div>
                </div>
              </div>

              {/* Chat Icon */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Chat Button Icon</label>
                <div className="flex gap-2 mb-4">
                  {(['default', 'preset', 'custom'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setChatIconType(type)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                        chatIconType === type
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-700 ring-2 ring-indigo-500/20'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {type === 'default' && 'Default'}
                      {type === 'preset' && 'Preset Icon'}
                      {type === 'custom' && 'Custom Image'}
                    </button>
                  ))}
                </div>

                {chatIconType === 'preset' && (
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                    {Object.entries(PRESET_ICONS).map(([key, { label, svg }]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setChatIconPreset(key)}
                        className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${
                          chatIconPreset === key
                            ? 'border-indigo-300 ring-2 ring-indigo-500/20 bg-indigo-50'
                            : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white"
                          style={{ backgroundColor: primaryColor }}
                          dangerouslySetInnerHTML={{
                            __html: svg.replace(/<svg /, '<svg width="20" height="20" '),
                          }}
                        />
                        <span className="text-xs text-slate-600">{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {chatIconType === 'custom' && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 font-medium hover:bg-indigo-100 transition-colors cursor-pointer text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Upload Image
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            const canvas = document.createElement('canvas')
                            canvas.width = 64
                            canvas.height = 64
                            const ctx = canvas.getContext('2d')
                            if (!ctx) return
                            const img = new Image()
                            img.onload = () => {
                              // Cover-fit: scale to fill 64x64, crop excess
                              const scale = Math.max(64 / img.width, 64 / img.height)
                              const w = img.width * scale
                              const h = img.height * scale
                              ctx.drawImage(img, (64 - w) / 2, (64 - h) / 2, w, h)
                              const dataUrl = canvas.toDataURL('image/png')
                              if (dataUrl.length > 50000) {
                                alert('Image too large after processing. Please use a simpler image.')
                                return
                              }
                              setChatIconImage(dataUrl)
                            }
                            img.src = URL.createObjectURL(file)
                            // Reset file input so same file can be re-selected
                            e.target.value = ''
                          }}
                        />
                      </label>
                      {chatIconImage && (
                        <button
                          type="button"
                          onClick={() => setChatIconImage(null)}
                          className="text-sm text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    {chatIconImage && (
                      <div className="flex items-center gap-3">
                        <div
                          className="w-14 h-14 rounded-full flex items-center justify-center overflow-hidden shadow-md"
                          style={{ backgroundColor: primaryColor }}
                        >
                          <img src={chatIconImage} alt="Custom icon" className="w-8 h-8 object-contain" />
                        </div>
                        <span className="text-sm text-slate-500">64x64px optimized</span>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">PNG, JPG, SVG, or WebP. Auto-resized to 64x64px.</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50">
                <input
                  type="checkbox"
                  id="showBranding"
                  checked={showBranding}
                  onChange={(e) => setShowBranding(e.target.checked)}
                  className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="showBranding" className="text-sm text-slate-700">
                  Show &quot;Powered by ChatAziendale.it&quot; branding
                </label>
              </div>

              {/* Suggested Prompts */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Quick Reply Suggestions</label>
                <p className="text-sm text-slate-500 mb-3">
                  Add up to 4 quick reply buttons that appear when users first open the widget
                </p>
                <div className="space-y-2 mb-3">
                  {suggestedPrompts.map((prompt, index) => (
                    <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl">
                      <span className="flex-1 text-sm text-slate-700">{prompt}</span>
                      <button
                        onClick={() => setSuggestedPrompts(suggestedPrompts.filter((_, i) => i !== index))}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {suggestedPrompts.length < 4 && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newPrompt.trim()) {
                          e.preventDefault()
                          setSuggestedPrompts([...suggestedPrompts, newPrompt.trim()])
                          setNewPrompt('')
                        }
                      }}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      placeholder="e.g., What services do you offer?"
                    />
                    <button
                      onClick={() => {
                        if (newPrompt.trim()) {
                          setSuggestedPrompts([...suggestedPrompts, newPrompt.trim()])
                          setNewPrompt('')
                        }
                      }}
                      disabled={!newPrompt.trim()}
                      className="px-4 py-2.5 rounded-xl bg-indigo-50 text-indigo-600 font-medium hover:bg-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Preview</label>
                <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50">
                  <div className="flex justify-end">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl cursor-pointer shadow-lg hover:scale-105 transition-transform"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {chatIconType === 'preset' && chatIconPreset && PRESET_ICONS[chatIconPreset] ? (
                        <span
                          dangerouslySetInnerHTML={{
                            __html: PRESET_ICONS[chatIconPreset].svg.replace(
                              /<svg /,
                              '<svg width="28" height="28" '
                            ),
                          }}
                        />
                      ) : chatIconType === 'custom' && chatIconImage ? (
                        <img src={chatIconImage} alt="Custom icon" className="w-8 h-8 object-contain" />
                      ) : (
                        <span className="text-2xl">&#x1F4AC;</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Embed Code */}
          {activeTab === 'embed' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Embed Script</label>
                <p className="text-sm text-slate-500 mb-4">
                  Copy this script tag and paste it into your website, just before the closing{' '}
                  <code className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-700">&lt;/body&gt;</code> tag.
                </p>
                <div className="relative">
                  <pre className="p-4 bg-slate-900 text-emerald-400 rounded-xl overflow-x-auto text-sm font-mono">
                    {embedCode}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(embedCode)
                      setSuccess(true)
                      setTimeout(() => setSuccess(false), 2000)
                    }}
                    className="absolute top-3 right-3 flex items-center gap-2 px-3 py-1.5 bg-slate-700 text-white text-sm rounded-lg hover:bg-slate-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </button>
                </div>
              </div>

              <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-xl">
                <h4 className="font-semibold text-indigo-900 mb-3">Installation Instructions</h4>
                <ol className="list-decimal list-inside text-sm text-indigo-800 space-y-2">
                  <li>Copy the embed script above</li>
                  <li>Open your website&apos;s HTML file</li>
                  <li>Paste the script just before the closing <code className="px-1 bg-indigo-100 rounded">&lt;/body&gt;</code> tag</li>
                  <li>Save and publish your website</li>
                  <li>The chat widget will appear in the bottom-right corner</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
