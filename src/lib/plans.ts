import { prisma } from '@/lib/db'

export type PlanId = 'free' | 'pro' | 'business'

export interface PlanLimits {
  monthlyMessages: number
  maxChatbots: number
  monthlyTokenLimit: number
  dailyMessageLimit: number
  monthlyCostLimit: number
  whatsappEnabled: boolean
  toolsEnabled: boolean        // hosted tools (web search) — bot answers via Responses API
  mcpServersEnabled: boolean   // attach remote MCP servers to a bot
  maxMcpServers: number        // cap on MCP servers per bot
}

export interface PlanInfo {
  id: PlanId
  name: string
  price: number // USD per month
  limits: PlanLimits
  features: string[]
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: 'free',
    name: 'Free',
    price: 0,
    limits: {
      monthlyMessages: 50,
      maxChatbots: 1,
      monthlyTokenLimit: 50_000,
      dailyMessageLimit: 20,
      monthlyCostLimit: 1.0,
      whatsappEnabled: false,
      toolsEnabled: false,
      mcpServersEnabled: false,
      maxMcpServers: 0,
    },
    features: [
      '50 messages per month',
      '1 chatbot',
      '20 messages per day',
      'Basic analytics',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price: 29,
    limits: {
      monthlyMessages: 2_000,
      maxChatbots: 5,
      monthlyTokenLimit: 2_000_000,
      dailyMessageLimit: 500,
      monthlyCostLimit: 100.0,
      whatsappEnabled: true,
      toolsEnabled: true,
      mcpServersEnabled: false,
      maxMcpServers: 0,
    },
    features: [
      '2,000 messages per month',
      '5 chatbots',
      '500 messages per day',
      'Full analytics',
      'Priority support',
      'WhatsApp integration',
      'Web search tool',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price: 149,
    limits: {
      monthlyMessages: 10_000,
      maxChatbots: Infinity,
      monthlyTokenLimit: 10_000_000,
      dailyMessageLimit: 5_000,
      monthlyCostLimit: 1000.0,
      whatsappEnabled: true,
      toolsEnabled: true,
      mcpServersEnabled: true,
      maxMcpServers: 5,
    },
    features: [
      '10,000 messages per month',
      'Unlimited chatbots',
      '5,000 messages per day',
      'Full analytics',
      'Priority support',
      'Custom branding',
      'WhatsApp integration',
      'Web search tool',
      'Remote MCP servers',
    ],
  },
}

export function getPlanLimits(plan: PlanId): PlanLimits {
  return PLANS[plan]?.limits ?? PLANS.free.limits
}

export async function applyPlanLimits(tenantId: string, plan: PlanId) {
  const limits = getPlanLimits(plan)

  // Single transaction so the tenant.plan field can never diverge from the
  // usage limits row (e.g. crash between the two writes would leave them out
  // of sync, granting old limits with a new plan name or vice versa).
  await prisma.$transaction([
    prisma.usageLimit.upsert({
      where: { tenantId },
      update: {
        monthlyTokenLimit: limits.monthlyTokenLimit,
        dailyMessageLimit: limits.dailyMessageLimit,
        monthlyCostLimit: limits.monthlyCostLimit,
      },
      create: {
        tenantId,
        monthlyTokenLimit: limits.monthlyTokenLimit,
        dailyMessageLimit: limits.dailyMessageLimit,
        monthlyCostLimit: limits.monthlyCostLimit,
      },
    }),
    prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    }),
  ])
}
