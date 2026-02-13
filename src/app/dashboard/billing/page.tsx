'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface BillingStatus {
  plan: string
  planName: string
  price: number
  subscription: {
    id: string
    status: string
    currentPeriodEnd: string
    planId: string
  } | null
}

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: [
      '50 messages per month',
      '1 chatbot',
      '20 messages per day',
      'Basic analytics',
    ],
    color: 'from-slate-500 to-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    features: [
      '2,000 messages per month',
      '5 chatbots',
      '500 messages per day',
      'Full analytics',
      'Priority support',
    ],
    color: 'from-indigo-500 to-purple-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
    popular: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 149,
    features: [
      '10,000 messages per month',
      'Unlimited chatbots',
      '5,000 messages per day',
      'Full analytics',
      'Priority support',
      'Custom branding',
    ],
    color: 'from-amber-500 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
]

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/billing/status')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch billing status')
        return res.json()
      })
      .then(setStatus)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleSubscribe = async (plan: string) => {
    if (plan === 'free') return
    setSubscribing(plan)
    setError(null)

    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create subscription')
      }

      const { approveUrl } = await res.json()
      window.location.href = approveUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSubscribing(null)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will keep access until the end of your billing period.')) {
      return
    }

    setCancelling(true)
    setError(null)

    try {
      const res = await fetch('/api/billing/cancel', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      // Refresh status
      const statusRes = await fetch('/api/billing/status')
      if (statusRes.ok) setStatus(await statusRes.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="h-8 bg-slate-200 rounded w-48 animate-pulse mb-2" />
          <div className="h-4 bg-slate-100 rounded w-64 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-6 animate-pulse h-80" />
          ))}
        </div>
      </div>
    )
  }

  const currentPlan = status?.plan || 'free'

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Billing & Plans</h1>
          <p className="text-slate-500 mt-1">Manage your subscription and billing</p>
        </div>
        <Image
          src="/images/illustration-upgrade.png"
          alt="Upgrade your plan"
          width={120}
          height={120}
          className="hidden sm:block"
        />
      </div>

      {/* Current Plan Banner */}
      <div className="mb-8 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className={`px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-gradient-to-r ${
              currentPlan === 'business' ? 'from-amber-500 to-orange-500' :
              currentPlan === 'pro' ? 'from-indigo-500 to-purple-500' :
              'from-slate-500 to-slate-600'
            }`}>
              {status?.planName || 'Free'} Plan
            </div>
            <div>
              <p className="text-sm text-slate-600">
                {currentPlan === 'free'
                  ? 'Upgrade to unlock more features'
                  : `$${status?.price}/month`}
              </p>
            </div>
          </div>
          {status?.subscription?.status === 'ACTIVE' && (
            <div className="flex items-center gap-4">
              <p className="text-sm text-slate-500">
                Next billing: {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Cancelling...' : 'Cancel Plan'}
              </button>
            </div>
          )}
          {status?.subscription?.status === 'CANCELLED' && (
            <p className="text-sm text-amber-600">
              Cancelled - access until {new Date(status.subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => {
          const isCurrent = currentPlan === plan.id
          const isDowngrade = (currentPlan === 'business' && plan.id !== 'business') ||
                              (currentPlan === 'pro' && plan.id === 'free')

          return (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl border-2 shadow-sm p-6 transition-all hover:shadow-lg ${
                isCurrent ? plan.borderColor : 'border-slate-200/60'
              } ${plan.popular ? 'ring-2 ring-indigo-500/20' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="px-3 py-1 text-xs font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className={`text-4xl font-bold bg-gradient-to-r ${plan.color} bg-clip-text text-transparent`}>
                    {plan.price === 0 ? 'Free' : `$${plan.price}`}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-sm text-slate-500">/month</span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className={`w-5 h-5 flex-shrink-0 ${isCurrent ? 'text-emerald-500' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-slate-500 bg-slate-100 cursor-default"
                >
                  Current Plan
                </button>
              ) : isDowngrade ? (
                <button
                  disabled
                  className="w-full py-3 px-4 rounded-xl text-sm font-medium text-slate-400 bg-slate-50 cursor-not-allowed"
                >
                  {plan.id === 'free' ? 'Cancel to downgrade' : 'Downgrade not available'}
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing !== null}
                  className={`w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r ${plan.color} hover:opacity-90 transition-opacity disabled:opacity-50 shadow-sm`}
                >
                  {subscribing === plan.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Redirecting to PayPal...
                    </span>
                  ) : (
                    `Upgrade to ${plan.name}`
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
