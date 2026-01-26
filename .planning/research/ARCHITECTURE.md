# Architecture Research

**Domain:** Embeddable AI Chatbot SaaS Platform with RAG
**Researched:** 2026-01-26
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
+-----------------------------------------------------------------------------------+
|                              CLIENT LAYER                                          |
|  +------------------+     +-------------------+     +------------------+           |
|  | Admin Dashboard  |     | Embedded Widget   |     | Public Website   |           |
|  | (React/Next.js)  |     | (JS SDK/iframe)   |     | Landing/Docs     |           |
|  +--------+---------+     +---------+---------+     +--------+---------+           |
|           |                         |                        |                     |
+-----------+-------------------------+------------------------+---------------------+
            |                         |                        |
            v                         v                        v
+-----------------------------------------------------------------------------------+
|                              API GATEWAY LAYER                                     |
|  +------------------+     +-------------------+     +------------------+           |
|  | REST API         |     | WebSocket Server  |     | Widget Embed     |           |
|  | (Auth, CRUD)     |     | (Real-time Chat)  |     | Endpoint         |           |
|  +--------+---------+     +---------+---------+     +--------+---------+           |
|           |                         |                        |                     |
+-----------+-------------------------+------------------------+---------------------+
            |                         |                        |
            v                         v                        v
+-----------------------------------------------------------------------------------+
|                              SERVICE LAYER                                         |
|  +-------------+  +-------------+  +-------------+  +-------------+               |
|  | Auth        |  | Chat        |  | Ingestion   |  | Knowledge   |               |
|  | Service     |  | Service     |  | Service     |  | Service     |               |
|  +------+------+  +------+------+  +------+------+  +------+------+               |
|         |                |                |                |                       |
+---------+----------------+----------------+----------------+-----------------------+
          |                |                |                |
          v                v                v                v
+-----------------------------------------------------------------------------------+
|                              EXTERNAL INTEGRATION LAYER                            |
|  +-------------+  +-------------+  +-------------+  +-------------+               |
|  | OpenAI API  |  | Embedding   |  | Web Scraper |  | Doc Parser  |               |
|  | (LLM)       |  | (OpenAI)    |  | (Firecrawl) |  | (Unstructured)|             |
|  +-------------+  +-------------+  +-------------+  +-------------+               |
|                                                                                    |
+-----------------------------------------------------------------------------------+
                                       |
                                       v
+-----------------------------------------------------------------------------------+
|                              DATA LAYER                                            |
|  +------------------+     +-------------------+     +------------------+           |
|  | PostgreSQL       |     | Vector Store      |     | Object Storage   |           |
|  | (Primary DB)     |     | (pgvector/Qdrant) |     | (S3/MinIO)       |           |
|  | - Users/Tenants  |     | - Embeddings      |     | - Raw Documents  |           |
|  | - Conversations  |     | - Chunks          |     | - Media Files    |           |
|  | - Configs        |     | - Metadata        |     | - Backups        |           |
|  +------------------+     +-------------------+     +------------------+           |
|                                                                                    |
+-----------------------------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Admin Dashboard** | Tenant management, chatbot config, analytics, document upload | Next.js + React + TailwindCSS |
| **Embedded Widget** | Lightweight chat interface injected into customer websites | Vanilla JS or Preact, loaded via script tag |
| **REST API** | CRUD operations, authentication, configuration management | Node.js/Express or Next.js API routes |
| **WebSocket Server** | Real-time bidirectional chat, streaming LLM responses | Socket.io or native WebSocket |
| **Auth Service** | Multi-tenant authentication, API key management, RBAC | NextAuth.js / Clerk / Custom JWT |
| **Chat Service** | Conversation orchestration, context management, RAG retrieval | LangChain / Custom orchestration |
| **Ingestion Service** | Document parsing, chunking, embedding generation, indexing | LangChain + Unstructured + Firecrawl |
| **Knowledge Service** | Vector search, semantic retrieval, reranking | pgvector / Qdrant + OpenAI embeddings |
| **PostgreSQL** | Primary data store for users, tenants, configs, chat history | Supabase / Neon / Self-hosted |
| **Vector Store** | High-dimensional embedding storage and similarity search | pgvector (integrated) or Qdrant (dedicated) |
| **Object Storage** | Raw document storage, media files | S3, MinIO, or Supabase Storage |

## Recommended Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth-related pages (login, register)
│   ├── (dashboard)/              # Admin dashboard pages
│   │   ├── chatbots/             # Chatbot management
│   │   ├── knowledge/            # Knowledge base management
│   │   ├── conversations/        # Conversation history
│   │   ├── analytics/            # Usage analytics
│   │   └── settings/             # Account settings
│   ├── api/                      # API routes
│   │   ├── auth/                 # Authentication endpoints
│   │   ├── chatbots/             # Chatbot CRUD
│   │   ├── chat/                 # Chat endpoints (REST + WebSocket)
│   │   ├── knowledge/            # Knowledge base endpoints
│   │   ├── ingest/               # Document ingestion
│   │   └── embed/                # Widget embed endpoint
│   └── widget/                   # Widget preview page
├── components/
│   ├── dashboard/                # Dashboard UI components
│   ├── chat/                     # Chat interface components
│   └── ui/                       # Shared UI components (shadcn/ui)
├── lib/
│   ├── db/                       # Database client and schemas
│   │   ├── schema.ts             # Drizzle/Prisma schema
│   │   └── client.ts             # DB client initialization
│   ├── ai/                       # AI/LLM integration
│   │   ├── openai.ts             # OpenAI client
│   │   ├── embeddings.ts         # Embedding generation
│   │   └── rag.ts                # RAG orchestration
│   ├── ingestion/                # Document processing
│   │   ├── parser.ts             # Document parsing
│   │   ├── chunker.ts            # Text chunking
│   │   └── scraper.ts            # Web scraping
│   ├── vector/                   # Vector store operations
│   │   └── store.ts              # Vector CRUD operations
│   └── auth/                     # Authentication utilities
├── services/                     # Business logic layer
│   ├── chat.service.ts           # Chat orchestration
│   ├── knowledge.service.ts      # Knowledge base management
│   └── tenant.service.ts         # Multi-tenant operations
├── types/                        # TypeScript types
└── widget/                       # Embeddable widget source
    ├── src/
    │   ├── index.ts              # Widget entry point
    │   ├── chat.ts               # Chat logic
    │   └── ui.ts                 # Widget UI
    └── build/                    # Compiled widget bundle
```

### Structure Rationale

- **app/**: Next.js App Router for server components, API routes, and pages
- **lib/**: Core utilities that don't depend on Next.js (reusable across widget)
- **services/**: Business logic layer between API routes and data/external services
- **widget/**: Separate build pipeline for the embeddable JS widget (needs to be tiny)

## Architectural Patterns

### Pattern 1: Multi-Tenant Data Isolation via Row-Level Security

**What:** Use PostgreSQL Row-Level Security (RLS) policies to automatically filter data by tenant_id
**When to use:** All data access - ensures tenant isolation at the database level
**Trade-offs:** Slight query overhead, but eliminates risk of cross-tenant data leaks

**Example:**
```sql
-- Enable RLS on knowledge_chunks table
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Policy ensures users only see their tenant's data
CREATE POLICY tenant_isolation ON knowledge_chunks
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

```typescript
// Set tenant context before queries
await db.execute(sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`);
const chunks = await db.query.knowledgeChunks.findMany();
// Automatically filtered to current tenant
```

### Pattern 2: RAG Pipeline with Streaming Response

**What:** Retrieve relevant context from vector store, then stream LLM response to client
**When to use:** Every chat message that needs knowledge base context
**Trade-offs:** More complex than simple LLM call, but enables source citations

**Example:**
```typescript
async function* handleChatMessage(
  tenantId: string,
  chatbotId: string,
  message: string
): AsyncGenerator<string> {
  // 1. Generate embedding for user query
  const queryEmbedding = await generateEmbedding(message);

  // 2. Retrieve relevant chunks from vector store
  const relevantChunks = await vectorStore.similaritySearch(
    queryEmbedding,
    { tenantId, chatbotId, limit: 5 }
  );

  // 3. Build prompt with context
  const contextualPrompt = buildPromptWithContext(message, relevantChunks);

  // 4. Stream LLM response
  const stream = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: contextualPrompt }],
    stream: true
  });

  // 5. Yield tokens as they arrive
  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content || '';
  }
}
```

### Pattern 3: Embeddable Widget via Script Tag

**What:** Single JS file that creates chat widget on any website
**When to use:** Customer embedding the chatbot on their website
**Trade-offs:** Must be lightweight (<50KB), runs in unknown DOM environment

**Example:**
```html
<!-- Customer adds this to their website -->
<script src="https://niuexa.ai/widget.js" data-chatbot-id="abc123"></script>
```

```typescript
// widget/src/index.ts
(function() {
  const script = document.currentScript;
  const chatbotId = script?.getAttribute('data-chatbot-id');

  // Create shadow DOM for style isolation
  const container = document.createElement('div');
  const shadow = container.attachShadow({ mode: 'closed' });

  // Inject widget HTML/CSS into shadow DOM
  shadow.innerHTML = `
    <style>${widgetStyles}</style>
    <div class="niuexa-widget">
      <button class="niuexa-trigger">Chat</button>
      <div class="niuexa-chat-window" hidden>
        <!-- Chat interface -->
      </div>
    </div>
  `;

  document.body.appendChild(container);

  // Initialize chat connection
  initializeChat(chatbotId, shadow);
})();
```

## Data Flow

### Request Flow: User Sends Chat Message

```
[User types message in widget]
    |
    v
[Widget] --WebSocket--> [API Server]
    |
    v
[Auth Middleware] -- Validate API key, extract tenant_id -->
    |
    v
[Chat Service]
    |
    +---> [Embedding Service] -- Generate query embedding -->
    |         |
    |         v
    +---> [Vector Store] -- Similarity search with tenant filter -->
    |         |
    |         v
    +---> [RAG Orchestrator] -- Build contextual prompt -->
    |         |
    |         v
    +---> [OpenAI API] -- Stream completion -->
              |
              v
[Stream tokens back via WebSocket]
    |
    v
[Widget renders response progressively]
    |
    v
[Save conversation to PostgreSQL]
```

### Document Ingestion Flow

```
[Admin uploads document via Dashboard]
    |
    v
[Upload to Object Storage (S3)]
    |
    v
[Trigger Ingestion Service]
    |
    +---> [Document Parser]
    |         |
    |         +-- PDF: Use unstructured/pypdf
    |         +-- DOCX: Use unstructured
    |         +-- URL: Use Firecrawl
    |         |
    |         v
    +---> [Text Extractor] -- Extract clean text -->
    |         |
    |         v
    +---> [Chunker] -- Split into ~500 token chunks with overlap -->
    |         |
    |         v
    +---> [Embedding Generator] -- OpenAI text-embedding-3-small -->
    |         |
    |         v
    +---> [Vector Store] -- Upsert chunks with metadata -->
              |
              v
[Update document status in PostgreSQL]
    |
    v
[Notify admin via Dashboard]
```

### Key Data Flows

1. **Authentication Flow:** API key in widget header -> Validate against tenant keys -> Set tenant context -> Allow/deny request
2. **Chat Flow:** Message -> Retrieve context -> Generate response -> Stream back -> Persist
3. **Ingestion Flow:** Upload -> Parse -> Chunk -> Embed -> Store -> Index
4. **Configuration Flow:** Dashboard update -> API -> PostgreSQL -> Cache invalidation -> Widget fetches new config

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k tenants | Monolith is fine: Single Next.js app, PostgreSQL with pgvector, Redis for sessions |
| 1k-100k tenants | Separate ingestion workers (background jobs), dedicated WebSocket server, read replicas for PostgreSQL |
| 100k+ tenants | Microservices split (chat, ingestion, knowledge), dedicated vector database (Qdrant cluster), Kafka for async processing |

### Scaling Priorities

1. **First bottleneck: Ingestion Pipeline**
   - Document parsing is CPU-intensive
   - Solution: Background job queue (BullMQ/Redis), horizontal worker scaling

2. **Second bottleneck: WebSocket Connections**
   - Each active chat holds a connection
   - Solution: Sticky sessions with Redis Pub/Sub for cross-instance messaging

3. **Third bottleneck: Vector Search Latency**
   - As knowledge bases grow, similarity search slows
   - Solution: Partition vectors by tenant, use HNSW indexes, consider dedicated Qdrant

## Anti-Patterns

### Anti-Pattern 1: Storing Embeddings in Primary PostgreSQL without pgvector

**What people do:** Store embeddings as JSON arrays and compute similarity in application code
**Why it's wrong:** O(n) search complexity, doesn't scale past a few thousand vectors
**Do this instead:** Use pgvector extension with HNSW indexes for efficient approximate nearest neighbor search

### Anti-Pattern 2: Single Global Vector Collection

**What people do:** Store all tenants' embeddings in one collection, filter by tenant_id at query time
**Why it's wrong:** Query scans all vectors before filtering, security risk if filter is missed
**Do this instead:** Use pgvector with RLS policies, or Qdrant with tenant-scoped collections/namespaces

### Anti-Pattern 3: Synchronous Document Ingestion

**What people do:** Parse, chunk, embed, and store documents in the HTTP request handler
**Why it's wrong:** Large documents cause request timeouts, blocks user experience
**Do this instead:** Accept upload immediately, process asynchronously via job queue, notify on completion

### Anti-Pattern 4: Bundling Full Framework in Widget

**What people do:** Use React/Next.js for the embeddable widget
**Why it's wrong:** Widget becomes 200KB+, slows down customer websites, causes conflicts
**Do this instead:** Vanilla JS or Preact (<15KB), Shadow DOM for style isolation, separate build pipeline

### Anti-Pattern 5: No Rate Limiting on Chat Endpoints

**What people do:** Allow unlimited chat messages without throttling
**Why it's wrong:** Runaway OpenAI costs, denial of service, abuse
**Do this instead:** Per-tenant rate limits, token counting, usage quotas tied to billing tier

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenAI API | REST + Streaming | Use official SDK, implement retry with exponential backoff |
| Firecrawl | REST API | For web scraping, respects robots.txt, handles JS rendering |
| Unstructured | Python subprocess or hosted API | For complex document parsing (PDFs with tables, etc.) |
| Supabase | SDK | If using for auth/database - provides RLS out of box |
| Stripe | Webhook + API | For subscription billing, metered usage |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Dashboard <-> API | REST + React Query | Standard CRUD operations |
| Widget <-> API | WebSocket + REST fallback | WebSocket for chat, REST for config |
| API <-> Ingestion Worker | Job Queue (Redis/BullMQ) | Async document processing |
| API <-> Vector Store | Direct connection | pgvector via same PG connection, Qdrant via gRPC |
| Ingestion <-> External Parsers | Subprocess or HTTP | Isolated for reliability |

## Build Order Implications

Based on component dependencies, recommended build sequence:

### Phase 1: Foundation (Must Build First)
1. **Database Schema** - All other components depend on this
2. **Auth System** - API and dashboard require authentication
3. **Basic API** - CRUD for tenants and chatbots

### Phase 2: Core Chat (Build After Foundation)
4. **Embedding Generation** - Requires OpenAI integration
5. **Vector Store Setup** - Requires schema, enables search
6. **Chat Service** - Requires auth, embedding, vector store
7. **WebSocket Server** - Requires chat service

### Phase 3: Ingestion (Build After Core Chat)
8. **Document Parser** - Can be built in parallel
9. **Chunking Service** - Requires parser
10. **Ingestion Pipeline** - Requires all above, queue system

### Phase 4: Widget (Build After API Stable)
11. **Widget JavaScript** - Requires stable chat API
12. **Widget Embed Endpoint** - Requires widget build

### Phase 5: Dashboard & Polish
13. **Admin Dashboard** - Requires all APIs
14. **Analytics** - Requires data accumulation
15. **Billing Integration** - After core features work

## Sources

**Multi-tenant RAG Architecture:**
- [AWS: Build a multi-tenant chatbot with RAG using Amazon Bedrock and Amazon EKS](https://aws.amazon.com/blogs/containers/build-a-multi-tenant-chatbot-with-rag-using-amazon-bedrock-and-amazon-eks/)
- [AWS: Multi-tenant vector search with Amazon Aurora PostgreSQL](https://aws.amazon.com/blogs/database/multi-tenant-vector-search-with-amazon-aurora-postgresql-and-amazon-bedrock-knowledge-bases/)
- [DEV.to: Building a Secure, Serverless Multi-Tenant RAG Chatbot](https://dev.to/aws-builders/building-a-secure-serverless-multi-tenant-rag-chatbot-with-amazon-bedrock-and-lambda-3ip1)

**RAG Pipeline Architecture:**
- [NVIDIA AI Blueprint for RAG](https://github.com/NVIDIA-AI-Blueprints/rag)
- [The New Stack: A Practical Guide To Building a RAG-Powered Chatbot](https://thenewstack.io/a-practical-guide-to-building-a-rag-powered-chatbot/)
- [IBM: RAG Data Ingestion](https://www.ibm.com/architectures/papers/rag-cookbook/data-ingestion)
- [Firecrawl: Best Open-Source RAG Frameworks](https://www.firecrawl.dev/blog/best-open-source-rag-frameworks)

**Vector Database Comparison:**
- [DataCamp: The 7 Best Vector Databases in 2026](https://www.datacamp.com/blog/the-top-5-vector-databases)
- [Liveblocks: What's the best vector database for building AI products?](https://liveblocks.io/blog/whats-the-best-vector-database-for-building-ai-products)
- [Instaclustr: pgvector Key Features 2026 Guide](https://www.instaclustr.com/education/vector-database/pgvector-key-features-tutorial-and-pros-and-cons-2026-guide/)

**Embeddable Widget Architecture:**
- [GitHub: Open WebUI Embeddable Widget](https://github.com/taylorwilsdon/open-webui-embeddable-widget)
- [DeadSimpleChat: Embedded Chat Widget](https://deadsimplechat.com/blog/embedded-chat-widget/)

**WebSocket & Real-time Architecture:**
- [Medium: WebSockets as the New Standard for AI Agents](https://hammadulhaq.medium.com/the-demise-of-rest-as-we-know-it-websockets-as-the-new-standard-for-ai-agents-72c505098320)
- [PubNub: Scalable Backend Architectures for Real-Time Customer Support Chats](https://www.pubnub.com/blog/architectures-for-customer-support-chats/)

**White-Label SaaS Patterns:**
- [Botpress: 8 Best White-Label Chatbot Platforms 2026](https://botpress.com/blog/white-label-chatbot-platform)
- [Insighto: Chatbot Customization Guide 2026](https://insighto.ai/blog/chatbot-customization-guide/)

---
*Architecture research for: niuexa.ai - Embeddable AI Chatbot SaaS Platform*
*Researched: 2026-01-26*
