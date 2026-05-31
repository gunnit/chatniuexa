import { prisma } from '@/lib/db'
import { getOpenAI, EMBEDDING_MODEL } from '@/lib/openai'
import { getDirectoryChunks, searchChunksByKeywords, searchSimilarChunks } from '@/lib/documents/processor'

interface Source {
  chunkId: string
  content: string
  similarity: number
  documentTitle: string
  dataSourceName: string
  sourceUrl?: string
}

interface ChatResponse {
  content: string
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
}

interface StreamingChatContext {
  sources: Source[]
  confidence: 'high' | 'medium' | 'low'
  confidenceScore: number
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful assistant that ONLY answers questions using the provided context from the knowledge base.

IMPORTANT RULES:
- You must ONLY use information from the provided context to answer questions.
- If the context does not contain information relevant to the user's question, politely decline to answer and suggest the user ask about topics covered by your knowledge base.
- NEVER answer questions using your general training knowledge. Even if you know the answer, do not provide it unless it is supported by the provided context.
- Do not answer off-topic questions such as recipes, trivia, coding help, math problems, or anything unrelated to the context provided.
- You may respond to basic greetings and pleasantries conversationally.

Always be concise and accurate. When you use information from the context, naturally incorporate it into your response.

Format your responses using markdown:
- Use **bold** for key terms, important names, and highlights
- Use bullet points or numbered lists when listing multiple items
- Keep paragraphs short and scannable`

const FORMATTING_ADDENDUM = `\nFormat your responses using markdown: use **bold** for key terms and important information, use bullet points for lists, and keep paragraphs short.`

const PII_GUARDRAIL = `\n\nPRIVACY & PII RULES (MANDATORY):
- NEVER repeat, echo, or store personal information that users share in their messages. This includes names, email addresses, phone numbers, fiscal codes (codice fiscale), ID numbers, home addresses, or any other personally identifiable information about the user themselves or any private individual.
- If a user shares PII in their question, answer the underlying question WITHOUT repeating the PII back.
- If a user asks you to call them, email them, or contact them using personal details they provided, explain that you cannot do so and suggest they contact the organization directly. Do NOT repeat their contact details in your response.
- For staff, CEOs, or associates, only provide publicly available business contact information (company websites, official emails, office phone numbers).
- Public information that appears in your knowledge base (corporate member directories, partner lists, company names with public URLs and public descriptions) is allowed and may be shared in full when relevant. The PII rules above apply to PRIVATE individuals, not to publicly listed organizations.`

const SCOPE_GUARDRAIL = `\n\nIMPORTANT: You must ONLY answer questions based on the provided context above. If no relevant context was provided, or if the user's question is not related to the context, politely let them know you can only help with topics covered by your knowledge base. Never use your general training knowledge to answer questions.`

const DIRECTORY_QUERY_PATTERN = /\b(list|show|all|every|which|what are|find|look(ing)?(\s+(for|at|up))?|search(ing)?|tell\s+me|give\s+me|any|who(\s+are)?|about|in\s+the|chi\s+sono|quali\s+sono|elenca|elencami|tutti|tutte|mostra|mostrami|cerca|cercami|trova|trovami|dimmi|dammi|qualche|c'è|ci\s+sono)\b.{0,80}\b(partners?|members?|companies|companie|firms|aziende|partner|membri|soci|imprese|category|categories|sector|sectors|categoria|settore|settori|categorie|services?|servizi|industry|industries|industria|industrie)\b/i

// Catches bare sector-style queries like "business services", "luxury retail",
// "finance partners?" — short messages whose only signal is a directory noun.
const DIRECTORY_NOUN_PATTERN = /\b(partners?|members?|companies|companie|firms|aziende|partner|membri|soci|imprese|category|categories|sector|sectors|categoria|settore|settori|categorie|services?|servizi|industry|industries|industria|industrie|retail|finance|finanza|financial|finanziaria|finanziario|healthcare|sanità|sanitario|salute|medical|medicale|legal|legali|law|lawyers?|avvocato|avvocati|tax|tasse|fiscale|fiscali|accounting|accountants?|accountant|commercialist[ai]|shipping|spedizioni|spedizioniere|logistics|logistica|freight|forwarding|manufacturing|manifattura|automotive|automobil(?:e|i|istico)|hospitality|ospitalità|tourism|turismo|turistico|construction|costruzioni|infrastructure|infrastrutture|education|istruzione|formazione|energy|energia|energetic[oi]|chemicals|chemical|chimic[ao]|defence|defense|difesa|aerospace|aerospazi(?:o|ale)|trading|consulting|consulenza|consulenze|consultant|consulente|restaurants?|ristoranti|ristorazione|luxury|lusso|furniture|mobili|arredamento|fashion|moda|food|cibo|alimentar[ei]|beverage|bevande|drinks?|pharma|pharmaceuticals?|farmaceutic[ao]|farmacia|technology|tech|tecnologia|informatic[ao]|IT|software|digital|digitale|communications?|comunicaz(?:i|ioni)|pr|public\s+relations|relazioni\s+pubbliche|publishing|editoria|language|languages?|linguistic[ao]|lingue|translation|traduzioni|traduttor[ei]|mechanical|meccanic[ao]|industrial|industriale|engineering|ingegneria|security|sicurezza|fmcg|consumer\s+goods|beni\s+di\s+consumo|sustainability|sostenibilità|renewables?|rinnovabili|circularity|economia\s+circolare|innovation|innovazione|design|gala|events?|eventi|evento|committee|comitato|comitati|council|consiglio|board|board\s+of\s+directors|direttori|isbc|iccs|ifbs|goasia)\b/i

// Catches single-token lookups that are likely company names (not greetings, not
// short pleasantries). When a user types just "Belluzzo" or "Ferrari", we want
// to retrieve a wide net so the right sector chunk is included.
const POTENTIAL_NAME_LOOKUP = /^\s*[A-Z][\w&'\-.]*(?:\s+[A-Z&][\w&'\-.]*){0,4}\??\s*$/

// Words that should NOT trigger a name lookup even if capitalized.
const COMMON_NON_NAME = /^(hello|hi|hey|ciao|salve|buongiorno|buonasera|buonanotte|grazie|thanks|thank|please|prego|ok|si|sì|no|yes|aiuto|help|info|cosa|what|who|where|when|why|how|come|dove|quando|perché|chi)\b/i

/**
 * Detect when the user is asking for a directory-style listing
 * (e.g. "list all partners in finance", "business services", "look for finance members"),
 * a single-word sector lookup ("accounting", "shipping"), or a bare member name
 * ("Belluzzo", "Ferrari", "Belluzzo Partners").
 * For these, retrieve more chunks so multi-chunk sectors and partial-name matches
 * are returned in full.
 */
function isDirectoryQuery(message: string): boolean {
  if (DIRECTORY_QUERY_PATTERN.test(message)) return true

  const trimmed = message.trim()
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length

  // Short queries (<=12 words) that mention a sector/listing noun are
  // almost always directory lookups — e.g. "business services", "accounting".
  if (wordCount > 0 && wordCount <= 12 && DIRECTORY_NOUN_PATTERN.test(trimmed)) {
    return true
  }

  // Very short queries (1-5 words) that look like a proper noun / company name
  // (capitalized, not a greeting) — treat as a directory lookup so we cast a
  // wide net. Embeddings alone often miss single-token proper nouns.
  if (
    wordCount > 0 &&
    wordCount <= 5 &&
    POTENTIAL_NAME_LOOKUP.test(trimmed) &&
    !COMMON_NON_NAME.test(trimmed)
  ) {
    return true
  }

  return false
}

const DIRECTORY_MAX_SOURCES = 60
const KEYWORD_FALLBACK_LIMIT = 30

const STOPWORDS = new Set([
  'list', 'show', 'all', 'every', 'tell', 'about', 'me', 'us', 'the', 'a', 'an',
  'of', 'in', 'on', 'for', 'with', 'and', 'or', 'who', 'are', 'is', 'what',
  'where', 'when', 'why', 'how', 'find', 'search', 'look', 'give', 'i', 'you',
  'dimmi', 'dammi', 'chi', 'cosa', 'sono', 'soci', 'partner', 'partners',
  'members', 'membri', 'azienda', 'aziende', 'company', 'companies', 'firms',
  'firm', 'imprese', 'sector', 'sectors', 'settore', 'settori', 'categoria',
  'categorie', 'mostra', 'mostrami', 'elenca', 'elencami', 'cerca', 'cercami',
  'trova', 'trovami', 'tutti', 'tutte', 'quali', 'industry', 'industries',
  'services', 'servizi',
])

/**
 * Extract substantive tokens from the user message for keyword-fallback retrieval.
 * Lower-cases, drops stopwords, requires length >= 3.
 */
function extractKeywords(message: string): string[] {
  const tokens = message.match(/[\p{L}\p{N}&]+/gu) || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of tokens) {
    const lower = raw.toLowerCase()
    if (lower.length < 3) continue
    if (STOPWORDS.has(lower)) continue
    if (seen.has(lower)) continue
    seen.add(lower)
    out.push(raw)
    if (out.length >= 5) break
  }
  return out
}

/**
 * Generate a RAG-based chat response
 */
export async function generateChatResponse(
  tenantId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: {
    systemPrompt?: string
    model?: string
    maxSources?: number
    minSimilarity?: number
  } = {}
): Promise<ChatResponse> {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = 'gpt-5.4-mini',
    minSimilarity = 0.2, // Lowered to 0.2 for multilingual content recall
  } = options
  const openai = getOpenAI()

  // Generate embedding for the user's query
  const embeddingResponse = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: userMessage,
  })
  const queryEmbedding = embeddingResponse.data[0].embedding

  // Search for relevant chunks — directory/category queries get the complete
  // member directory injected so no member can be missed.
  const relevantChunks = await gatherRelevantChunks(
    tenantId,
    queryEmbedding,
    userMessage,
    minSimilarity,
    options.maxSources,
  )

  // Get document/datasource info for citations - batch query to avoid N+1
  const sources: Source[] = []
  const contextParts: string[] = []

  if (relevantChunks.length > 0) {
    const documentIds = [...new Set(relevantChunks.map(chunk => chunk.documentId))]
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      include: {
        dataSource: {
          select: { name: true, sourceUrl: true },
        },
      },
    })
    const documentMap = new Map(documents.map(doc => [doc.id, doc]))

    for (const chunk of relevantChunks) {
      const document = documentMap.get(chunk.documentId)

      if (document) {
        sources.push({
          chunkId: chunk.id,
          content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
          similarity: chunk.similarity,
          documentTitle: document.title || 'Untitled',
          dataSourceName: document.dataSource.name,
          sourceUrl: document.dataSource.sourceUrl || undefined,
        })

        contextParts.push(
          `[Source: ${document.title || document.dataSource.name}]\n${chunk.content}`
        )
      }
    }
  }

  // Deduplicate sources — keep highest similarity per document title
  const deduplicatedSources = deduplicateSources(sources)

  // Build context section
  let context = contextParts.length > 0
    ? `Here is relevant information from the knowledge base:\n\n${contextParts.join('\n\n---\n\n')}`
    : 'No relevant information was found in the knowledge base. You MUST let the user know that their question is not covered by your knowledge base. Do NOT attempt to answer using your own knowledge. Instead, politely suggest they ask about topics that your knowledge base covers.'

  // For directory/category queries, append an explicit must-list roster so no
  // member (incl. cross-sector ones) can be dropped from the answer.
  const rosterDirective = buildDirectoryRosterDirective(relevantChunks, userMessage)
  if (rosterDirective) context += `\n\n${rosterDirective}`

  // Append formatting instructions if custom prompt doesn't already mention markdown/bold
  const promptWithFormatting = systemPrompt === DEFAULT_SYSTEM_PROMPT || /\*\*bold\*\*|markdown/i.test(systemPrompt)
    ? systemPrompt
    : systemPrompt + FORMATTING_ADDENDUM
  const finalPrompt = promptWithFormatting + SCOPE_GUARDRAIL + PII_GUARDRAIL

  // Build messages for the LLM
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${finalPrompt}\n\n${context}`,
    },
  ]

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  })

  // Generate response
  const completion = await openai.chat.completions.create({
    model,
    messages,
    max_completion_tokens: 2048,
  })

  const responseContent = completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response.'

  // Calculate confidence based on source quality
  const confidenceScore = calculateConfidence(deduplicatedSources)
  const confidence = confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.4 ? 'medium' : 'low'

  return {
    content: responseContent,
    sources: deduplicatedSources,
    confidence,
    confidenceScore,
  }
}

/**
 * Deduplicate sources — keep the highest-similarity entry per document title
 */
function deduplicateSources(sources: Source[]): Source[] {
  const bestByTitle = new Map<string, Source>()
  for (const source of sources) {
    const existing = bestByTitle.get(source.documentTitle)
    if (!existing || source.similarity > existing.similarity) {
      bestByTitle.set(source.documentTitle, source)
    }
  }
  return Array.from(bestByTitle.values())
}

/**
 * Merge keyword-fallback chunks into a vector-search result set, deduplicating
 * by chunk id. Vector chunks come first (higher relevance signal).
 */
async function mergeKeywordChunks(
  tenantId: string,
  userMessage: string,
  vectorChunks: Awaited<ReturnType<typeof searchSimilarChunks>>,
): Promise<Awaited<ReturnType<typeof searchSimilarChunks>>> {
  const keywords = extractKeywords(userMessage)
  if (keywords.length === 0) return vectorChunks

  const keywordChunks = await searchChunksByKeywords(
    tenantId,
    keywords,
    KEYWORD_FALLBACK_LIMIT,
  )
  if (keywordChunks.length === 0) return vectorChunks

  const seen = new Set(vectorChunks.map((c) => c.id))
  const merged = [...vectorChunks]
  for (const kc of keywordChunks) {
    if (seen.has(kc.id)) continue
    merged.push(kc)
    seen.add(kc.id)
  }
  return merged
}

/**
 * Assemble the chunk set that becomes the LLM context, with DETERMINISTIC
 * directory recall. Shared by every retrieval path (streaming + non-streaming +
 * WhatsApp) so they behave identically.
 *
 * - Non-directory queries → ordinary vector search (top-K by similarity).
 * - Directory / category / sector / member-name queries → the COMPLETE member
 *   directory (every chunk, in order) unioned with the vector hits (so pages,
 *   events and PDFs still contribute) and the keyword fallback, deduped by chunk
 *   id with the directory first so sectors read top-to-bottom.
 *
 * Injecting the whole directory guarantees every member is present in context
 * for any category query. This closes the recall gap where a member assigned to
 * one sector (e.g. Hawksford under BUSINESS SERVICES) was invisible to a query
 * that mapped to a different sector (e.g. "accounting"). Tenants with no
 * directory-format document fall back to vector + keyword retrieval unchanged.
 */
async function gatherRelevantChunks(
  tenantId: string,
  queryEmbedding: number[],
  userMessage: string | undefined,
  minSimilarity: number,
  maxSourcesOverride?: number,
): Promise<Awaited<ReturnType<typeof searchSimilarChunks>>> {
  const isDirectory = !!userMessage && isDirectoryQuery(userMessage)
  const maxSources = maxSourcesOverride ?? (isDirectory ? DIRECTORY_MAX_SOURCES : 5)

  const vectorChunks = await searchSimilarChunks(tenantId, queryEmbedding, maxSources, minSimilarity)

  if (!isDirectory) return vectorChunks

  const directoryChunks = await getDirectoryChunks(tenantId)

  // No directory document for this tenant → keep the legacy keyword fallback so
  // single-name brand lookups still cast a wide net.
  if (directoryChunks.length === 0) {
    return mergeKeywordChunks(tenantId, userMessage!, vectorChunks)
  }

  // Full directory first (ordered, complete), then vector hits from OTHER
  // documents (events, site pages, PDFs) that aren't already included.
  const seen = new Set(directoryChunks.map((c) => c.id))
  const base = [...directoryChunks]
  for (const c of vectorChunks) {
    if (seen.has(c.id)) continue
    base.push(c)
    seen.add(c.id)
  }

  // Layer the keyword fallback on top of the union (dedupes against `base`).
  return mergeKeywordChunks(tenantId, userMessage!, base)
}

/**
 * For a directory/category query, deterministically compute the COMPLETE roster
 * of members for the sector(s) the query maps to — using the directory's own
 * synonym map and the `[Sector: ...]` / `[Also relevant to: ...]` tags — and
 * return an explicit "you MUST list all of these" directive to inject into the
 * context.
 *
 * Why this exists: the model reliably lists a sector's PRIMARY members but
 * inconsistently DROPS members whose primary sector differs (e.g. it omits
 * Hawksford — a corporate-services firm that also does accounting — from an
 * "accounting firms" query, anchoring it to its Business Services listing).
 * Prompt wording and data structure could not fix this; the model re-decides
 * membership for category nouns. An explicit per-query roster takes that
 * decision away from the model and is obeyed reliably.
 *
 * Returns null when no full directory is present or the query maps to no sector,
 * so non-directory tenants/queries are unaffected. Driven entirely by the
 * directory's own content, so it stays generic across tenants.
 */
function buildDirectoryRosterDirective(
  chunks: Awaited<ReturnType<typeof searchSimilarChunks>>,
  userMessage: string | undefined,
): string | null {
  // Only meaningful when the FULL directory was injected (directory queries);
  // otherwise a roster built from partial chunks would be incomplete.
  if (!userMessage || !isDirectoryQuery(userMessage)) return null
  const text = chunks.map((c) => c.content).join('\n')
  if (!text.includes('[Sector:')) return null

  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Parse the directory's "keyword(s) → **SECTOR**" synonym lines.
  const kwToSector = new Map<string, string>()
  const sectorNames = new Set<string>()
  for (const line of text.split('\n')) {
    const m = line.match(/^-\s*(.+?)\s*→\s*\*\*(.+?)\*\*\s*$/)
    if (!m) continue
    const sector = m[2].trim()
    sectorNames.add(sector)
    for (const kw of m[1].split(',').map((s) => s.trim().toLowerCase()).filter((s) => s.length >= 3)) {
      if (!kwToSector.has(kw)) kwToSector.set(kw, sector)
    }
  }
  if (sectorNames.size === 0) return null

  // Which sector(s) does the user's message map to?
  const msg = userMessage.toLowerCase()
  const targets = new Set<string>()
  for (const [kw, sector] of kwToSector) {
    if (new RegExp(`(?<![\\p{L}])${esc(kw)}(?![\\p{L}])`, 'u').test(msg)) targets.add(sector)
  }
  for (const sector of sectorNames) {
    if (msg.includes(sector.toLowerCase())) targets.add(sector)
  }
  if (targets.size === 0) return null

  // Collect every member tagged with a target sector (primary OR also-relevant).
  const rosters = new Map<string, Set<string>>()
  for (const t of targets) rosters.set(t, new Set())
  const memberRe = /\[Sector:\s*([^\]]+?)\]\s*(?:\[Also relevant to:\s*([^\]]+?)\]\s*)?\*\*\[([^\]]+?)\]/g
  let m: RegExpExecArray | null
  while ((m = memberRe.exec(text)) !== null) {
    const memberSectors = new Set<string>([m[1].trim()])
    if (m[2]) for (const s of m[2].split(';').map((x) => x.trim()).filter(Boolean)) memberSectors.add(s)
    const name = m[3].trim()
    for (const t of targets) if (memberSectors.has(t)) rosters.get(t)!.add(name)
  }

  const parts: string[] = []
  for (const [sector, names] of rosters) {
    if (names.size === 0) continue
    parts.push(`Sector "${sector}" (${names.size} members — list every one): ${[...names].join('; ')}`)
  }
  if (parts.length === 0) return null

  return (
    '### MANDATORY DIRECTORY COMPLETENESS\n' +
    'The question maps to the sector(s) below. Your answer MUST include EVERY member company listed here, each with its markdown link and one-line description taken from the directory above. Do NOT omit, skip, filter, summarise, or recategorise ANY of them — even if a company\'s primary sector is different, if it appears below it is part of this category for the user.\n' +
    parts.join('\n')
  )
}

/**
 * Calculate confidence score based on source relevance
 */
function calculateConfidence(sources: Source[]): number {
  if (sources.length === 0) {
    return 0.15 // Low confidence when no sources found
  }

  // Use the best source's similarity as the primary signal
  const bestSimilarity = Math.max(...sources.map(s => s.similarity))

  // Small bonus for having multiple relevant sources
  const sourceCountBonus = Math.min((sources.length - 1) * 0.03, 0.1)

  return Math.min(bestSimilarity + sourceCountBonus, 1)
}

/**
 * Generate embedding for a user query (can be started early for parallelization)
 */
export async function generateQueryEmbedding(userMessage: string): Promise<number[]> {
  const openai = getOpenAI()
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: userMessage,
  })
  return response.data[0].embedding
}

/**
 * Prepare streaming context using a pre-computed embedding
 */
export async function prepareStreamingContextWithEmbedding(
  tenantId: string,
  queryEmbedding: number[],
  options: {
    maxSources?: number
    minSimilarity?: number
    userMessage?: string
  } = {}
): Promise<{ context: string; streamingContext: StreamingChatContext }> {
  const { minSimilarity = 0.2, userMessage } = options

  // Search for relevant chunks — directory/category queries get the complete
  // member directory injected (full recall) plus a keyword fallback so
  // brand-name lookups (Ferrari, Belluzzo, ...) reliably surface every match.
  const relevantChunks = await gatherRelevantChunks(
    tenantId,
    queryEmbedding,
    userMessage,
    minSimilarity,
    options.maxSources,
  )

  // Get document/datasource info for citations - batch query to avoid N+1
  const sources: Source[] = []
  const contextParts: string[] = []

  if (relevantChunks.length > 0) {
    const documentIds = [...new Set(relevantChunks.map(chunk => chunk.documentId))]
    const documents = await prisma.document.findMany({
      where: { id: { in: documentIds } },
      include: {
        dataSource: {
          select: { name: true, sourceUrl: true },
        },
      },
    })
    const documentMap = new Map(documents.map(doc => [doc.id, doc]))

    for (const chunk of relevantChunks) {
      const document = documentMap.get(chunk.documentId)

      if (document) {
        sources.push({
          chunkId: chunk.id,
          content: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? '...' : ''),
          similarity: chunk.similarity,
          documentTitle: document.title || 'Untitled',
          dataSourceName: document.dataSource.name,
          sourceUrl: document.dataSource.sourceUrl || undefined,
        })

        contextParts.push(
          `[Source: ${document.title || document.dataSource.name}]\n${chunk.content}`
        )
      }
    }
  }

  // Deduplicate sources — keep highest similarity per document title
  const deduplicatedSources = deduplicateSources(sources)

  // Build context section
  let context = contextParts.length > 0
    ? `Here is relevant information from the knowledge base:\n\n${contextParts.join('\n\n---\n\n')}`
    : 'No relevant information was found in the knowledge base. You MUST let the user know that their question is not covered by your knowledge base. Do NOT attempt to answer using your own knowledge. Instead, politely suggest they ask about topics that your knowledge base covers.'

  // For directory/category queries, append an explicit must-list roster so no
  // member (incl. cross-sector ones) can be dropped from the answer.
  const rosterDirective = buildDirectoryRosterDirective(relevantChunks, userMessage)
  if (rosterDirective) context += `\n\n${rosterDirective}`

  // Calculate confidence
  const confidenceScore = calculateConfidence(deduplicatedSources)
  const confidence = confidenceScore >= 0.7 ? 'high' : confidenceScore >= 0.4 ? 'medium' : 'low'

  return {
    context,
    streamingContext: {
      sources: deduplicatedSources,
      confidence,
      confidenceScore,
    },
  }
}

/**
 * Prepare context for streaming chat (convenience wrapper)
 */
export async function prepareStreamingContext(
  tenantId: string,
  userMessage: string,
  options: {
    maxSources?: number
    minSimilarity?: number
  } = {}
): Promise<{ context: string; streamingContext: StreamingChatContext }> {
  const queryEmbedding = await generateQueryEmbedding(userMessage)
  return prepareStreamingContextWithEmbedding(tenantId, queryEmbedding, { ...options, userMessage })
}

/**
 * Generate streaming chat response
 */
export async function generateStreamingChatResponse(
  context: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: {
    systemPrompt?: string
    model?: string
  } = {}
): Promise<ReadableStream<Uint8Array>> {
  const {
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    model = 'gpt-5.4-mini',
  } = options

  const openai = getOpenAI()

  // Append formatting instructions if custom prompt doesn't already mention markdown/bold
  const promptWithFormatting = systemPrompt === DEFAULT_SYSTEM_PROMPT || /\*\*bold\*\*|markdown/i.test(systemPrompt)
    ? systemPrompt
    : systemPrompt + FORMATTING_ADDENDUM
  const finalPrompt = promptWithFormatting + SCOPE_GUARDRAIL + PII_GUARDRAIL

  // Build messages for the LLM
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    {
      role: 'system',
      content: `${finalPrompt}\n\n${context}`,
    },
  ]

  // Add conversation history (last 10 messages)
  const recentHistory = conversationHistory.slice(-10)
  for (const msg of recentHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    })
  }

  // Add current user message
  messages.push({
    role: 'user',
    content: userMessage,
  })

  // Generate streaming response
  const stream = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    max_completion_tokens: 2048,
  })

  // Convert OpenAI stream to web ReadableStream
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content
          if (content) {
            // Send as Server-Sent Event format
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
          }
        }
        // Signal end of stream
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
  })
}
