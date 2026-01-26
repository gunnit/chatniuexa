# Stack Research

**Domain:** Embeddable AI Chatbot SaaS Platform with RAG
**Project:** niuexa.ai
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

This stack recommendation prioritizes OpenAI's newest APIs (Responses API with built-in file_search), a unified database approach (Supabase with pgvector), and a modern Next.js 15 frontend. The key insight: OpenAI's Responses API with built-in vector stores eliminates the need for separate RAG orchestration frameworks like LangChain for most use cases, dramatically simplifying architecture.

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Next.js** | 15.x | Full-stack React framework | Server components, API routes, App Router, excellent DX, SSR for marketing pages, CSR for dashboard. Vercel's AI SDK integrates seamlessly. | HIGH |
| **TypeScript** | 5.x | Type safety | Essential for large codebases. Catches errors at compile time. Industry standard for modern web dev. | HIGH |
| **Supabase** | Latest | Database + Auth + Vector | PostgreSQL with pgvector, built-in auth, realtime, and row-level security. Reduces vendor count. Handles 99% of SaaS needs up to 50M vectors. | HIGH |
| **OpenAI Responses API** | Latest | LLM + Built-in RAG | New API (2025) that combines Chat Completions simplicity with built-in file_search/vector stores. Assistants API deprecated Aug 2026. Simpler than DIY RAG. | HIGH |
| **Firecrawl** | v2 | Web crawling | LLM-ready markdown output (67% fewer tokens than HTML). Handles anti-bot, JS rendering, proxies. Integrates with LlamaIndex/LangChain. | HIGH |

### AI & RAG Stack

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **OpenAI text-embedding-3-large** | Latest | Embeddings | Best multilingual performance (MIRACL 54.9%), supports dimension reduction (256-3072), $0.13/M tokens. Perfect for Italian/English bilingual. | HIGH |
| **OpenAI gpt-4o** | Latest | Chat completions | Fastest, cheapest GPT-4 class model. Use for general chat when Responses API file_search isn't needed. | HIGH |
| **OpenAI Vector Stores** | Built-in | RAG storage | Part of Responses API. 10K files per store. Auto chunks, embeds, stores. Eliminates need for Pinecone/Qdrant for most cases. | HIGH |
| **LlamaIndex.TS** | Latest | Backup RAG framework | Only needed for custom RAG pipelines beyond OpenAI's built-in capabilities. TypeScript-first, serverless-friendly. | MEDIUM |

### Frontend Stack

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **React** | 19.x | UI library | Server Components, automatic compiler optimization, reduced re-renders. Integrated with Next.js 15. | HIGH |
| **Tailwind CSS** | 4.x | Styling | 5x faster builds (Oxide engine), CSS-first config, zero config setup. One-line import. | HIGH |
| **shadcn/ui** | Latest | Component library | Copy-paste components you own. 25+ AI-specific components. Integrates with Vercel AI SDK. Customizable. | HIGH |
| **Vercel AI SDK** | 6.x | AI streaming | Unified streaming across providers. Token-by-token updates. useChat hook for chat UIs. | HIGH |

### Backend & Database

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Supabase (PostgreSQL)** | Latest | Primary database | Relational data + pgvector + realtime + auth. One platform vs many. Sub-50ms queries on 100K+ docs with indexing. | HIGH |
| **pgvector** | 0.7+ | Vector search | Native PostgreSQL extension. Combined with pgvectorscale (DiskANN) handles 50M+ vectors. SQL-native hybrid search. | HIGH |
| **Prisma** | 6.x | ORM | Schema-first, excellent DX, split schemas support. Better for teams. Auto-migrations. | MEDIUM |
| **Drizzle** | Latest | Alternative ORM | Consider if serverless-first (7kb bundle). SQL-transparent. Better cold starts. | MEDIUM |

### Authentication & Payments

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Clerk** | Latest | Authentication | 5-minute setup, pre-built components, SOC 2/HIPAA/GDPR compliant. New Clerk Billing integrates Stripe. $0.02/MAU after 10K free. | HIGH |
| **Stripe** | Latest | Payments | Industry standard. Subscription management, usage-based billing, billing portal. Webhooks for entitlements. | HIGH |

### Embeddable Widget Stack

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Vanilla JS + Shadow DOM** | ES2022 | Widget isolation | CSS isolation prevents host site conflicts. No framework dependencies. ~15kb bundle possible. | HIGH |
| **iframe fallback** | HTML5 | Security isolation | Required for private bots (HMAC signatures). Better CSP compatibility. frame-ancestors control. | HIGH |
| **postMessage API** | Standard | Parent-iframe comms | Secure cross-origin messaging with strict origin validation. | HIGH |

### Infrastructure & Deployment

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Vercel** | Latest | Frontend hosting | Native Next.js support, edge functions, excellent DX, preview deployments. | HIGH |
| **Render** | Latest | Backend services | Per user's existing setup. Good for webhook endpoints (Twilio etc). | MEDIUM |
| **Supabase Cloud** | Latest | Managed database | Integrated with vector, auth, realtime. Free tier generous. | HIGH |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Faster, disk-efficient. Monorepo-ready. |
| **Biome** | Linting + formatting | Faster than ESLint + Prettier combined. |
| **Vitest** | Testing | Vite-native, fast, compatible with Jest APIs. |
| **Playwright** | E2E testing | Cross-browser, reliable, great DX. |

---

## Installation

```bash
# Initialize project
pnpm create next-app@latest niuexa --typescript --tailwind --eslint --app --src-dir

# Core dependencies
pnpm add @supabase/supabase-js @supabase/ssr openai ai @clerk/nextjs stripe

# UI
pnpm add tailwindcss@next class-variance-authority clsx tailwind-merge lucide-react

# RAG (if extending beyond OpenAI built-in)
pnpm add @llamaindex/core @llamaindex/openai

# Web crawling
pnpm add @mendable/firecrawl-js

# Database
pnpm add prisma @prisma/client

# Dev dependencies
pnpm add -D @types/node @types/react typescript vitest @playwright/test
```

---

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative |
|----------|-------------|-------------|-------------------------|
| **Vector DB** | Supabase pgvector | Pinecone | >50M vectors, need managed scale-to-zero, multi-region |
| **Vector DB** | Supabase pgvector | Qdrant | Need advanced filtering, self-hosted control, open-source requirement |
| **RAG Framework** | OpenAI Responses API | LangChain | Complex multi-step agents, custom tool orchestration, non-OpenAI models |
| **RAG Framework** | OpenAI Responses API | LlamaIndex | Custom retrieval pipelines, knowledge graphs, multi-source federation |
| **Auth** | Clerk | Auth0 | Enterprise SSO (SAML/SCIM), existing Okta ecosystem |
| **Auth** | Clerk | NextAuth/Auth.js | Budget constraints, full data ownership, custom flows |
| **ORM** | Prisma | Drizzle | Serverless-first, need minimal cold starts, SQL transparency |
| **Framework** | Next.js | Remix | Prefer nested routing, progressive enhancement focus |
| **Embeddings** | text-embedding-3-large | Voyage AI | Domain-specific embeddings (legal, code), cost optimization |
| **Chat Model** | gpt-4o | Claude 3.5 Sonnet | Longer context (200K), better reasoning for some tasks |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **OpenAI Assistants API** | Deprecated August 2026. Responses API is the successor with same features. | OpenAI Responses API |
| **text-embedding-ada-002** | Superseded. text-embedding-3 models are 30%+ better on benchmarks. | text-embedding-3-small/large |
| **LangChain for simple RAG** | Unnecessary complexity if using OpenAI's built-in file_search. 2.4x more tokens than LlamaIndex. | OpenAI Responses API or LlamaIndex.TS |
| **Express.js** | Slow (3x slower than Hono), heavy. Legacy choice. | Next.js API routes or Hono (if separate backend needed) |
| **Create React App** | Deprecated. No SSR, poor DX compared to Next.js. | Next.js |
| **Tailwind CSS 3.x** | 4.x is 5x faster, simpler setup, modern CSS features. | Tailwind CSS 4.x |
| **MongoDB for vectors** | Limited vector support. Not optimized for similarity search. | PostgreSQL + pgvector |
| **Firebase** | Vendor lock-in, no native vector support, weaker for this use case. | Supabase |
| **Self-hosted vector DB** | Operational overhead. Supabase/Pinecone handle scaling. | Managed solution (Supabase or Pinecone) |

---

## Stack Patterns by Variant

### If prioritizing simplicity (recommended for MVP):
- Use OpenAI Responses API with built-in file_search
- Store documents in OpenAI Vector Stores
- Supabase for user data, auth metadata
- No LangChain/LlamaIndex needed initially

### If prioritizing cost optimization at scale:
- Use OpenAI text-embedding-3-small (10x cheaper than large)
- Store embeddings in Supabase pgvector
- Build custom RAG with LlamaIndex.TS
- Consider open-source models for embeddings later

### If prioritizing data sovereignty:
- Self-host embedding generation (local models)
- Supabase self-hosted or dedicated PostgreSQL
- Store all vectors in your infrastructure
- Use OpenAI only for chat completions

### If prioritizing enterprise features:
- Auth0 instead of Clerk (SAML/SCIM)
- Pinecone instead of pgvector (compliance certifications)
- Add audit logging layer
- Multi-tenant database architecture

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| Next.js 15.x | React 19.x | Required pairing. Server Actions stable. |
| Next.js 15.x | Tailwind 4.x | Native support via Vite plugin or PostCSS. |
| Supabase JS v2 | Next.js 15 | Use @supabase/ssr for server components. |
| Clerk | Next.js 15 | @clerk/nextjs 5.x for App Router. |
| Prisma 6.x | Next.js 15 | Edge-compatible with Prisma Accelerate. |
| Vercel AI SDK 6.x | Next.js 15 | Uses convertToModelMessages() (renamed in v6). |
| OpenAI SDK 4.x | Responses API | Full Responses API support. |

---

## Bilingual (Italian/English) Considerations

| Concern | Solution | Notes |
|---------|----------|-------|
| **Embeddings** | text-embedding-3-large | Excellent multilingual (MIRACL benchmark). No separate models needed. |
| **UI i18n** | next-intl or next-i18next | App Router compatible. SSR-friendly. |
| **Content** | Store both languages per document | Or use AI translation at query time. |
| **Search** | pgvector handles multilingual | Same embedding model works for both languages. |

---

## Widget Embedding Architecture

### Recommended Approach: Hybrid
```
1. Public widgets: Shadow DOM script injection
   - Async loading, doesn't block host page
   - CSS isolated, no conflicts
   - ~15-20kb bundle

2. Private/authenticated widgets: iframe
   - HMAC signature validation
   - Complete isolation
   - frame-ancestors CSP control

3. Communication: postMessage API
   - Strict origin validation
   - Resize notifications
   - Event passing (chat opened, message sent)
```

### Embed Code Pattern
```html
<!-- Public widget -->
<script async src="https://niuexa.ai/widget.js" data-chatbot-id="xxx"></script>

<!-- Private widget with signature -->
<script async src="https://niuexa.ai/widget.js"
  data-chatbot-id="xxx"
  data-signature="hmac_sha256_hash"
  data-expires="timestamp"></script>
```

---

## Cost Estimates (MVP Scale)

| Service | Free Tier | Paid Estimate (1K users) |
|---------|-----------|--------------------------|
| Supabase | 500MB DB, 2GB storage | ~$25/month (Pro) |
| OpenAI text-embedding-3-large | Pay per use | ~$13/month (100M tokens) |
| OpenAI gpt-4o | Pay per use | ~$50-200/month (varies by usage) |
| OpenAI Vector Stores | Included | $0.10/GB/day storage |
| Clerk | 10K MAU free | $0.02/MAU after |
| Stripe | 2.9% + $0.30/txn | Transaction-based |
| Vercel | Hobby free | ~$20/month (Pro) |
| Firecrawl | 500 pages/month free | ~$19/month (Starter) |

---

## Sources

### Official Documentation (HIGH confidence)
- [OpenAI Models Documentation](https://platform.openai.com/docs/models/) - Model versions, capabilities
- [OpenAI File Search Guide](https://platform.openai.com/docs/guides/tools-file-search) - Built-in RAG tool
- [OpenAI Cookbook: File Search with Responses API](https://cookbook.openai.com/examples/file_search_responses) - RAG implementation
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) - Performance benchmarks
- [Firecrawl Documentation](https://docs.firecrawl.dev/introduction) - Web crawling capabilities
- [Supabase pgvector Guide](https://supabase.com/docs/guides/database/extensions/pgvector) - Vector search setup

### Verified Comparisons (MEDIUM-HIGH confidence)
- [Firecrawl: Best Vector Databases 2025](https://www.firecrawl.dev/blog/best-vector-databases-2025) - Vector DB comparison
- [AIMultiple: RAG Frameworks 2026](https://research.aimultiple.com/rag-frameworks/) - LangChain vs LlamaIndex
- [Clerk: Next.js Authentication Guide](https://clerk.com/articles/user-authentication-for-nextjs-top-tools-and-recommendations-for-2025) - Auth comparison
- [Better Stack: Drizzle vs Prisma](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/) - ORM comparison
- [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6) - Streaming AI SDK updates

### Community/Industry Sources (MEDIUM confidence)
- [OpenAI Developer Forum: Assistants API Deprecation](https://community.openai.com/t/is-there-a-future-for-the-assistants-api/1119941) - Migration timeline
- [VentureBeat: Data Predictions 2026](https://venturebeat.com/data/six-data-shifts-that-will-shape-enterprise-ai-in-2026) - RAG evolution trends
- [Qrvey: Iframe Security 2026](https://qrvey.com/blog/iframe-security/) - Widget security best practices

---

*Stack research for: Embeddable AI Chatbot SaaS Platform with RAG (niuexa.ai)*
*Researched: 2026-01-26*
