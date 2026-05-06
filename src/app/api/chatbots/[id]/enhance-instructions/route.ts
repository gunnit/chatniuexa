import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getOpenAI } from '@/lib/openai'
import { logUsage } from '@/lib/usage'
import { rateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
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

  // Verify ownership and load plan in one query
  const chatbot = await prisma.chatbot.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: { tenant: { select: { plan: true } } },
  })

  if (!chatbot) {
    return NextResponse.json({ error: 'Chatbot not found' }, { status: 404 })
  }

  // Plan gate — AI prompt enhancement burns real OpenAI dollars per call.
  if (chatbot.tenant.plan === 'free') {
    return NextResponse.json(
      { error: 'PLAN_UPGRADE_REQUIRED' },
      { status: 403 }
    )
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
      model: 'gpt-5.4-mini',
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

      // Single batched fetch per data source — the previous implementation
      // issued one findFirst+skip query per sampling position, producing up to
      // maxPositions × dataSources sequential round-trips with table scans.
      const allChunks = await prisma.chunk.findMany({
        where: { document: { dataSourceId: ds.id } },
        orderBy: { chunkIndex: 'asc' },
        select: { content: true },
      })

      if (allChunks.length === 0) continue
      const totalChunks = allChunks.length

      const positions = [0]
      if (totalChunks > 1) positions.push(Math.floor(totalChunks / 2))
      if (totalChunks > 2) positions.push(totalChunks - 1)

      if (chunksPerSource > 3 && totalChunks > 4) {
        positions.push(Math.floor(totalChunks / 4))
        if (chunksPerSource >= 5) positions.push(Math.floor((totalChunks * 3) / 4))
      }

      const uniquePositions = [...new Set(positions)].sort((a, b) => a - b)

      for (const pos of uniquePositions) {
        if (sampledChunks.length >= maxTotalChunks) break
        const chunk = allChunks[pos]
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
    let completion
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-5.4-mini',
        messages: [{ role: 'user', content: metaPrompt }],
        max_completion_tokens: 2048,
      })
    } catch (openaiError: unknown) {
      const msg = openaiError instanceof Error ? openaiError.message : String(openaiError)
      // Log full detail server-side; return generic message to client so we
      // don't leak model SKUs, org IDs, or refusal text.
      logger.error('OpenAI API error in enhance-instructions', { error: msg })
      return NextResponse.json(
        { error: 'AI generation failed' },
        { status: 502 }
      )
    }

    const choice = completion.choices[0]
    const enhancedInstructions = choice?.message?.content?.trim()

    if (!enhancedInstructions) {
      logger.error('OpenAI returned empty content', {
        finish_reason: choice?.finish_reason,
        refusal: choice?.message?.refusal,
        model: completion.model,
        usage: completion.usage,
      })
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
    logger.error('Error enhancing instructions', { error: String(error) })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
