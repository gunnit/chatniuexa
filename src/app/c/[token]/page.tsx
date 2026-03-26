import { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { notFound } from 'next/navigation'
import PublicChatClient from './PublicChatClient'

type Props = { params: Promise<{ token: string }> }

const chatbotSelect = {
  id: true,
  name: true,
  description: true,
  welcomeMessage: true,
  primaryColor: true,
  secondaryColor: true,
  showBranding: true,
  suggestedPrompts: true,
  chatIconType: true,
  chatIconPreset: true,
  chatIconImage: true,
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const chatbot = await prisma.chatbot.findUnique({
    where: { shareToken: token },
    select: { name: true, description: true },
  })
  if (!chatbot) return { title: 'Chat Not Found' }
  const desc = chatbot.description || `Chat with ${chatbot.name}`
  return {
    title: `${chatbot.name} — ChatAziendale`,
    description: desc,
    openGraph: { title: chatbot.name, description: desc },
  }
}

export default async function PublicChatPage({ params }: Props) {
  const { token } = await params
  const chatbot = await prisma.chatbot.findUnique({
    where: { shareToken: token },
    select: chatbotSelect,
  })
  if (!chatbot) notFound()
  return <PublicChatClient chatbot={chatbot} />
}
