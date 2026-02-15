import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOpenAI } from '@/lib/openai'
import { logUsage } from '@/lib/usage'
import { rateLimit } from '@/lib/rate-limit'
import { z } from 'zod'

const requestSchema = z.object({
  currentInstructions: z.string().optional(),
  template: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit by tenant
  const rl = rateLimit(session.user.tenantId)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  const { id } = await params

  // Verify ownership
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { currentInstructions, template } = requestSchema.parse(body)

    // Check usage (~2000 tokens for the enhancement call)
    const usage = await logUsage({
      tenantId: session.user.tenantId,
      chatbotId: id,
      type: 'chat',
      tokens: 2000,
      model: 'gpt-5-mini',
    })

    if (!usage.allowed) {
      return NextResponse.json(
        { error: usage.reason || 'Usage limit exceeded' },
        { status: 429 }
      )
    }

    // Sample RAG data - get tenant's complete data sources
    const dataSources = await prisma.dataSource.findMany({
      where: {
        tenantId: session.user.tenantId,
        status: 'COMPLETE',
      },
      take: 10,
      select: {
        id: true,
        name: true,
        type: true,
        _count: { select: { documents: true } },
      },
    })

    // For each data source, sample chunks via its documents
    const chunksPerSource = dataSources.length <= 3 ? 5 : 3
    const maxTotalChunks = 15
    const sampledChunks: { sourceName: string; content: string }[] = []

    for (const ds of dataSources) {
      if (sampledChunks.length >= maxTotalChunks) break

      // Get document IDs for this data source
      const documents = await prisma.document.findMany({
        where: { dataSourceId: ds.id },
        select: { id: true },
      })

      if (documents.length === 0) continue

      const docIds = documents.map((d) => d.id)

      // Count total chunks across all documents of this source
      const totalChunks = await prisma.chunk.count({
        where: { documentId: { in: docIds } },
      })

      if (totalChunks === 0) continue

      // Stratified sampling: first, middle, last chunks
      const positions = [0]
      if (totalChunks > 1) positions.push(Math.floor(totalChunks / 2))
      if (totalChunks > 2) positions.push(totalChunks - 1)

      // Add extra positions if we can take more per source
      if (chunksPerSource > 3 && totalChunks > 4) {
        positions.push(Math.floor(totalChunks / 4))
        if (chunksPerSource >= 5) positions.push(Math.floor((totalChunks * 3) / 4))
      }

      // Deduplicate and sort positions
      const uniquePositions = [...new Set(positions)].sort((a, b) => a - b)

      for (const pos of uniquePositions) {
        if (sampledChunks.length >= maxTotalChunks) break

        const chunk = await prisma.chunk.findFirst({
          where: { documentId: { in: docIds } },
          orderBy: { chunkIndex: 'asc' },
          skip: pos,
          take: 1,
          select: { content: true },
        })

        if (chunk) {
          sampledChunks.push({
            sourceName: ds.name,
            content: chunk.content.slice(0, 1600),
          })
        }
      }
    }

    // Build the meta-prompt
    const ragSection =
      sampledChunks.length > 0
        ? `\n## Knowledge Base Content (sampled from ${dataSources.length} data source${dataSources.length !== 1 ? 's' : ''}):\n${sampledChunks
            .map((c, i) => `### Source: ${c.sourceName}\n${c.content}`)
            .join('\n\n')}`
        : ''

    const currentSection = currentInstructions
      ? `\n## Current Instructions to Improve:\n${currentInstructions}`
      : ''

    const templateSection = template && template !== 'custom'
      ? `\nThe user selected the "${template}" template as a starting point.`
      : ''

    const metaPrompt = `You are an expert at writing system prompts for AI chatbots. Your task is to generate excellent, tailored instructions for a chatbot.

## Chatbot Context:
- Name: ${chatbot.name}
- Description: ${chatbot.description || 'No description provided'}${templateSection}
${ragSection}
${currentSection}

## Your Task:
Generate a comprehensive system prompt for this chatbot. The instructions should:

1. **Define a clear persona** that matches the chatbot's purpose
2. **Use domain-specific language** drawn from the knowledge base content (if available)
3. **Set an appropriate tone** (professional, friendly, technical, etc.)
4. **Define scope boundaries** - what topics to cover and what to redirect
5. **Handle unknowns** - what to say when the bot doesn't know an answer
6. **Specify response format** - how to structure answers (concise, step-by-step, etc.)
7. **Include escalation paths** - when to suggest contacting a human
8. **Cover key topics** identified from the knowledge base content

${sampledChunks.length > 0 ? 'IMPORTANT: Reference specific topics, terminology, and domains from the knowledge base content above. The instructions should feel tailored to this specific business/domain, not generic.' : 'Since no knowledge base content is available, generate instructions based on the chatbot name and description. Keep them practical and well-structured.'}

${currentInstructions ? 'Improve and enhance the current instructions while preserving their intent. Add domain-specific details and improve structure.' : 'Generate instructions from scratch.'}

Output ONLY the system prompt text. Do not include any preamble, explanation, or markdown code fences.`

    const openai = getOpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      messages: [{ role: 'user', content: metaPrompt }],
      temperature: 0.7,
      max_tokens: 1000,
    })

    const enhancedInstructions = completion.choices[0]?.message?.content?.trim()

    if (!enhancedInstructions) {
      return NextResponse.json(
        { error: 'Failed to generate enhanced instructions' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      enhancedInstructions,
      dataSummary: {
        dataSourceCount: dataSources.length,
        chunksSampled: sampledChunks.length,
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Error enhancing instructions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
