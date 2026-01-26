# Project Research Summary

**Project:** niuexa.ai
**Domain:** Embeddable AI Chatbot SaaS Platform with RAG
**Researched:** 2026-01-26
**Confidence:** HIGH

## Executive Summary

Niuexa.ai is an embeddable AI chatbot platform that allows businesses to train chatbots on their own documents and deploy them via website widgets. This is a well-established product category with clear best practices and known pitfalls. The research reveals that experts build this type of platform using a modern full-stack framework (Next.js 15), PostgreSQL with pgvector for unified database needs, and OpenAI's new Responses API which dramatically simplifies RAG implementation by providing built-in vector stores and file_search capabilities.

The recommended approach prioritizes simplicity and speed to market: leverage OpenAI's managed RAG infrastructure (Responses API with built-in vector stores) instead of building custom RAG orchestration with frameworks like LangChain. This reduces complexity by 60-70% while maintaining quality. Use Supabase for PostgreSQL + auth + vector storage, eliminating the need for multiple vendors. The embeddable widget should be built with vanilla JavaScript and Shadow DOM for CSS isolation, keeping bundle size under 20KB. This stack enables a rapid MVP while remaining production-ready for scale.

The key risks are multi-tenant data isolation failures (catastrophic for SaaS), RAG hallucination and false citations (trust-breaking for users), and prompt injection attacks (security vulnerability). These are prevented through defense-in-depth: database-level Row-Level Security combined with application-layer tenant filtering, citation verification systems with confidence scoring, and strict input/output sanitization. Cost explosion from uncapped LLM API usage is also a concern, requiring per-tenant quotas and spending limits from day one. The research shows these are architectural decisions that must be correct from the foundation phase—retrofitting is 10x more expensive.

## Key Findings

### Recommended Stack

The stack research reveals a major architectural simplification opportunity: OpenAI's Responses API (2025 release) combines chat completions with built-in file_search and vector stores, eliminating the need for separate RAG orchestration frameworks like LangChain for most use cases. This is significant—most competitor platforms were built before this API existed and carry unnecessary complexity.

**Core technologies:**

- **Next.js 15 + React 19**: Full-stack framework with Server Components, API routes, and App Router. Excellent DX, SSR for marketing pages, CSR for dashboard. Vercel AI SDK integration is seamless.
- **TypeScript 5.x**: Essential for catching errors at compile time in a complex multi-tenant SaaS application.
- **Supabase (PostgreSQL + pgvector)**: Unified platform for database, authentication, realtime, and vector storage. Reduces vendor count and handles 99% of SaaS needs up to 50M vectors. Row-Level Security is critical for tenant isolation.
- **OpenAI Responses API**: New API combining Chat Completions simplicity with built-in file_search and vector stores. Assistants API (predecessor) is deprecated August 2026. This is the modern approach.
- **OpenAI text-embedding-3-large**: Best multilingual performance (MIRACL 54.9%), critical for Italian/English bilingual support. Supports dimension reduction (256-3072).
- **Firecrawl v2**: Web crawling with LLM-ready markdown output (67% fewer tokens than HTML). Handles anti-bot measures, JavaScript rendering, and proxies.
- **Vanilla JS + Shadow DOM**: For embeddable widget. CSS isolation prevents conflicts with host sites. Framework-free keeps bundle ~15KB vs 200KB+ with React.
- **Clerk**: Authentication with 5-minute setup, pre-built components, SOC 2/HIPAA/GDPR compliance. $0.02/MAU after 10K free.
- **Stripe**: Industry standard for subscription and usage-based billing.
- **Tailwind CSS 4.x**: 5x faster builds with Oxide engine. CSS-first config.
- **shadcn/ui**: Copy-paste component library you own. 25+ AI-specific components.

**Critical version requirements:**
- Next.js 15.x requires React 19.x (paired release)
- Use OpenAI Responses API, NOT Assistants API (deprecated Aug 2026)
- Tailwind 4.x for performance (5x faster than 3.x)
- text-embedding-3-large, NOT ada-002 (superseded, 30%+ worse)

**What NOT to use:**
- LangChain for simple RAG (unnecessary complexity vs Responses API)
- MongoDB for vectors (not optimized for similarity search)
- Express.js (3x slower than alternatives, use Next.js API routes)
- Create React App (deprecated)
- Firebase (vendor lock-in, no native vector support)

### Expected Features

The feature research reveals a clear hierarchy of must-have vs nice-to-have features based on comprehensive competitor analysis (Chatbase, CustomGPT, Botpress, Tidio).

**Must have (table stakes):**

Users expect these features to exist—missing them makes the product feel incomplete or unusable:
- Knowledge base training (PDF, URL, text upload) - core value proposition
- Embeddable widget (floating popup, script tag injection) - primary deployment method
- Dashboard/admin panel (create/edit chatbots, manage sources) - essential for management
- Conversation history (view chat logs) - debugging and improvement
- Basic analytics (message count, active users, popular questions) - 80% of platforms include this
- Multiple LLM support (at minimum GPT-4 and GPT-4o-mini) - users want choice and cost control
- Widget customization (colors, logo, welcome message, position) - non-negotiable for business use
- Auto-sync/retrain (scheduled knowledge base updates) - keep chatbot current
- Human handoff option (80% of users only use chatbots if human fallback exists) - critical for adoption
- Mobile responsiveness (widget works on all devices) - not optional
- HTTPS/secure embedding - security requirement

**Should have (competitive differentiators):**

Features that set the product apart and drive competitive advantage:
- **Source citations** (shows where answers come from) - builds trust, required for legal/research industries. CustomGPT highlights this as core feature. **Already planned for niuexa.ai - major differentiator for SMB market.**
- **Bilingual/multilingual native support** (Italian/English) - 75% more likely to buy in native language, 60% never buy from English-only sites. **Already planned - rare for competitors, valuable for embassy/Italian business use cases.**
- **White-label branding** (remove "Powered by", custom domains) - agencies/resellers need this. Competitors charge $39-300/year extra. **Already planned.**
- **Quick mode + advanced mode** (wizard for beginners, full config for power users) - reduces barrier to entry. **Already planned.**
- Lead generation/form capture (progressive data during conversation) - 3x better conversion than static forms
- Real-time RAG (live API data + vector search) - reduces hallucination significantly
- Sentiment analysis (detect frustration, proactive human routing) - better UX than waiting for user request
- API access for developers (embed in their own apps) - enables SaaS embedding use cases

**Defer (v2+):**

Features that add complexity without proportional early value:
- Voice/phone integration (complex, different UX paradigm)
- AI actions (schedule meetings, process orders) - high complexity, narrow initial use cases
- Multi-agent collaboration (multiple specialized chatbots) - enterprise feature
- SOC 2 certification (expensive, pursue when enterprise deals require it)
- Reseller/partner program (build after proving direct sales model)

**Anti-features (deliberately avoid):**

Research shows these are commonly requested but problematic:
- Unlimited everything (messages, storage) - unsustainable business model, abuse potential
- Complex flow builders (visual no-code) - steep learning curve, users rarely use full power, maintenance burden
- Custom scripted dialogs - defeats purpose of AI, rigid and brittle
- Training on competitor data - legal liability, ethical issues
- "AI that never gets it wrong" - overpromising leads to lost trust (hallucination is inherent to LLMs)
- Instant deployment without review - see Air Canada and NYC chatbot failures

### Architecture Approach

The architecture research reveals a standard multi-tenant SaaS pattern with some domain-specific considerations. The recommended approach is a monolithic Next.js application with service-layer separation, suitable for 0-1K tenants without architectural changes. Key insight: use PostgreSQL Row-Level Security (RLS) for tenant isolation at the database level as a safety net, combined with application-layer tenant filtering for defense-in-depth.

**Major components:**

1. **Admin Dashboard** (Next.js + React) - tenant management, chatbot configuration, analytics, document upload
2. **Embeddable Widget** (Vanilla JS + Shadow DOM) - lightweight chat interface injected via script tag, CSS-isolated
3. **REST API** (Next.js API routes) - CRUD operations, authentication, configuration management
4. **WebSocket Server** (Socket.io or native WebSocket) - real-time bidirectional chat, streaming LLM responses
5. **Auth Service** (Clerk) - multi-tenant authentication, API key management, RBAC
6. **Chat Service** (RAG orchestration) - conversation management, context handling, retrieval coordination
7. **Ingestion Service** (async workers) - document parsing, chunking, embedding generation, indexing
8. **Knowledge Service** (vector operations) - semantic search, retrieval, reranking
9. **PostgreSQL + pgvector** (Supabase) - primary database for users, tenants, configs, chat history, and vector embeddings
10. **Object Storage** (S3/Supabase Storage) - raw document storage, media files

**Critical patterns:**

- **Multi-tenant data isolation via RLS**: Use PostgreSQL policies that automatically filter by tenant_id. Set tenant context before queries to prevent cross-tenant data leaks.
- **RAG pipeline with streaming**: Embed query → similarity search → build contextual prompt → stream LLM response → persist conversation.
- **Embeddable widget via script tag**: Shadow DOM for style isolation, postMessage for secure communication, separate build pipeline for minimal bundle size.
- **Async document processing**: Accept upload immediately, process via job queue (BullMQ/Redis), notify on completion. Never block HTTP requests.

**Scaling considerations:**

- 0-1K tenants: Monolith is fine (single Next.js app, PostgreSQL with pgvector, Redis for sessions)
- 1K-100K tenants: Separate ingestion workers, dedicated WebSocket server, read replicas
- 100K+ tenants: Microservices split, dedicated vector DB cluster, Kafka for async processing

First bottleneck will be ingestion pipeline (CPU-intensive document parsing). Second will be WebSocket connections (each active chat holds a connection). Third will be vector search latency as knowledge bases grow.

### Critical Pitfalls

The pitfall research identifies five catastrophic mistakes that cause rewrites, security breaches, or major business impact. These are verified across multiple 2026 sources and real-world failures.

1. **Multi-tenant data isolation failure ("data bleed")** - Customer A's chatbot retrieves Customer B's documents. Catastrophic for SaaS—destroys trust, triggers legal liability. Happens due to connection pool contamination in async environments, over-reliance on RLS alone, async context leaks with global variables, shared caching without tenant isolation. **Prevention:** Defense-in-depth with namespace-per-tenant in vector DB + tenant_id metadata filtering + application-layer validation + tenant-specific encryption. Must be correct from foundation phase—retrofitting is 10x more expensive.

2. **RAG hallucination and false citation** - Chatbot confidently cites sources that don't support its claims or invents information. Legal RAG systems hallucinate 17-33% of time even with RAG. Citation hallucination is distinct—model attributes claims to sources that don't contain that information. **Prevention:** Multi-stage verification with cross-encoder reranking, post-generation citation verification, confidence scoring with low-confidence escalation, explicit knowledge boundaries ("I don't have information about this"), source highlighting showing exact text chunks, regular hallucination detection in CI/CD.

3. **Prompt injection attacks** - Attackers inject malicious instructions that override system prompts, causing chatbot to leak system prompts/training data, generate harmful content, agree to unauthorized actions (see "$1 Tahoe" incident), or bypass access controls. LLMs cannot distinguish between trusted system instructions and untrusted user input—fundamental architectural vulnerability. **Prevention:** Defense-in-depth (no single solution works), input/output filtering, privilege separation (chatbot has minimal permissions, never direct database write), content isolation (treat retrieved documents as untrusted), conversation history validation (cryptographic signatures), output guardrails, behavioral monitoring.

4. **Embedded widget security vulnerabilities** - Widget introduces XSS, CORS misconfigurations, or becomes attack vector for host websites. One in three breaches in 2024 were third-party related. **Prevention:** Sandboxed iframes with minimal permissions, domain whitelisting (only approved domains), strict origin validation for postMessage, CSP headers with frame-ancestors directive, HTTPS-only embedding, API key scoping to specific operations and domains, backend-mediated communication (not direct client-to-AI).

5. **LLM API cost explosion** - Bug, misconfiguration, or abuse causes runaway API calls. Teams have spent thousands of dollars in a single day. Happens due to no spending limits at application layer, using expensive models (GPT-4) for all queries when cheaper suffice for 60%+, no per-tenant quotas, retry logic without exponential backoff, long context windows used unnecessarily. **Prevention:** Hard spending limits (daily/monthly caps that auto-block), model routing (GPT-4o-mini for simple, GPT-4 for complex), per-tenant quotas, context optimization (summarization or sliding window, not full history), response caching (tenant-isolated), real-time monitoring with anomaly alerts, cost attribution per customer/chatbot.

**Additional critical patterns:**

- Single vector collection for all tenants: Never acceptable for production SaaS—creates data isolation hell, can't scale past 5K tenants, noisy neighbor issues.
- Synchronous document processing: Never for documents > 10 pages—blocks users, causes timeouts, poor UX.
- API keys in client-side embed code: Never—security vulnerability, abuse vector. Use session tokens.
- No rate limiting on chat endpoints: Runaway costs, denial of service, abuse potential.

## Implications for Roadmap

Based on research findings, the roadmap should be structured to build the architectural foundation correctly before adding features. Dependencies and pitfall avoidance drive the phase ordering.

### Recommended Phase Structure

The architecture research reveals clear build-order dependencies, and the pitfall research shows what must be correct from day one. Suggested 6-7 phases:

### Phase 1: Foundation & Multi-Tenant Architecture

**Rationale:** Everything depends on database schema and tenant isolation. Getting multi-tenant architecture wrong is the #1 catastrophic pitfall—retrofitting is 10x more expensive. Must be correct from day one.

**Delivers:**
- PostgreSQL database with pgvector extension
- Multi-tenant schema with Row-Level Security policies
- Authentication system (Clerk integration)
- Tenant context management (AsyncLocalStorage for Node.js)
- Basic API structure with tenant validation on every request
- Spending limits and per-tenant quotas (cost explosion prevention)

**Addresses features:**
- Authentication (table stakes)
- Multi-tenant isolation (security requirement)

**Avoids pitfalls:**
- Multi-tenant data bleed (critical)
- Cost explosion (critical)

**Tech from STACK.md:**
- Next.js 15 + TypeScript project structure
- Supabase (PostgreSQL + pgvector + auth)
- Clerk for authentication
- Prisma or Drizzle ORM with RLS setup

**Research flag:** LOW - this is well-documented, standard patterns for multi-tenant SaaS.

---

### Phase 2: Document Ingestion & Knowledge Processing

**Rationale:** Must process documents before building RAG. Ingestion is CPU-intensive and causes first scaling bottleneck, so async processing must be built in from start (not retrofitted).

**Delivers:**
- Document upload (PDF, TXT, URL)
- Async job queue (BullMQ + Redis)
- Document parsing (Firecrawl for URLs, unstructured for PDFs)
- Text chunking with overlap (500 tokens default)
- Embedding generation (OpenAI text-embedding-3-large)
- Storage in object storage (S3/Supabase Storage)
- Progress notifications to dashboard

**Addresses features:**
- Knowledge base training (table stakes)
- Auto-sync/retrain (table stakes)
- File/URL upload (table stakes)

**Avoids pitfalls:**
- Synchronous processing causing timeouts
- One-size-fits-all parsing (need fallback chain)

**Tech from STACK.md:**
- Firecrawl for web scraping
- OpenAI text-embedding-3-large (multilingual)
- BullMQ for job queue
- Supabase Storage or S3 for documents

**Research flag:** MEDIUM - Need to research parser fallback strategies and chunk optimization for different document types during phase planning. Standard approaches exist but may need customization.

---

### Phase 3: RAG Core & Chat Service

**Rationale:** Core value proposition. Depends on ingestion (Phase 2) and foundation (Phase 1). This is where hallucination and citation accuracy must be addressed.

**Delivers:**
- OpenAI Responses API integration with file_search
- Vector store operations (similarity search)
- RAG pipeline: query → embed → retrieve → build prompt → generate
- Streaming LLM responses
- Source citation extraction and verification
- Confidence scoring for responses
- Conversation persistence
- Basic conversation history UI

**Addresses features:**
- RAG-based responses (table stakes)
- Source citations (differentiator, already planned)
- Conversation history (table stakes)

**Avoids pitfalls:**
- RAG hallucination (critical)
- False citations (critical)

**Tech from STACK.md:**
- OpenAI Responses API (NOT Assistants API)
- OpenAI text-embedding-3-large
- pgvector for similarity search
- Vercel AI SDK for streaming

**Research flag:** HIGH - This phase needs `/gsd:research-phase` for:
- Citation verification techniques
- Confidence scoring implementation
- Hallucination detection methods
- Query evaluation frameworks

---

### Phase 4: Admin Dashboard & Management

**Rationale:** Requires stable APIs from Phases 1-3. Users need UI to create chatbots, manage knowledge, and view conversations before widget deployment.

**Delivers:**
- Chatbot CRUD interface
- Knowledge source management UI
- Document upload UI with progress indicators
- Conversation history viewer
- Basic analytics (message count, active conversations)
- Widget customization UI (colors, logo, position, welcome message)
- Settings and configuration management
- Quick setup wizard (differentiator, already planned)

**Addresses features:**
- Dashboard/admin panel (table stakes)
- Widget customization (table stakes)
- Basic analytics (table stakes)
- Quick mode (differentiator, already planned)

**Avoids pitfalls:**
- No loading states causing user confusion
- No feedback mechanism

**Tech from STACK.md:**
- Next.js 15 App Router
- React 19 + Server Components
- Tailwind CSS 4.x
- shadcn/ui components
- React Query for API state

**Research flag:** LOW - standard CRUD dashboard patterns, well-documented.

---

### Phase 5: Embeddable Widget & Security

**Rationale:** Requires stable chat API (Phase 3) and configuration UI (Phase 4). Widget security must be built in from start—retrofitting is expensive and requires customer coordination to update embed codes.

**Delivers:**
- Vanilla JS widget with Shadow DOM
- Floating popup chat interface
- WebSocket connection for real-time chat
- Mobile-responsive design
- Script tag embed code generation
- Domain whitelisting
- API key scoping per domain
- Origin validation for postMessage
- CSP headers and sandboxed iframe fallback
- Widget preview in dashboard
- HTTPS-only embedding enforcement

**Addresses features:**
- Embeddable widget (table stakes)
- Mobile responsiveness (table stakes)
- HTTPS/secure embedding (table stakes)

**Avoids pitfalls:**
- Widget security vulnerabilities (critical)
- Prompt injection via widget (critical)
- XSS and CORS misconfigurations

**Tech from STACK.md:**
- Vanilla JS (NOT React) for minimal bundle
- Shadow DOM for CSS isolation
- iframe fallback for security isolation
- postMessage API for communication

**Research flag:** MEDIUM - Widget security patterns need research. Consider `/gsd:research-phase` for:
- CSP compatibility testing approaches
- Domain whitelisting implementation
- Secure embed code patterns

---

### Phase 6: Bilingual Support & Citation UI

**Rationale:** Differentiator already planned. Depends on stable RAG (Phase 3) and widget (Phase 5). Can be built in parallel with other enhancements.

**Delivers:**
- Italian/English UI localization
- Language-aware document processing
- Bilingual response generation
- Enhanced citation display (show exact passages, not just links)
- Source highlighting in responses
- Confidence indicators visible to users

**Addresses features:**
- Bilingual support (differentiator, already planned)
- Better citation UX (enhances Phase 3 work)

**Avoids pitfalls:**
- Generic "I don't know" responses (UX pitfall)
- Showing raw chunk text as citations (UX pitfall)

**Tech from STACK.md:**
- next-intl or next-i18next for i18n
- text-embedding-3-large handles multilingual without separate models

**Research flag:** LOW - i18n is well-documented, multilingual embedding models are standard.

---

### Phase 7: Production Hardening & Scale Prep

**Rationale:** Before launch to public/marketing, must address remaining security concerns and prepare for scale.

**Delivers:**
- Input/output filtering for prompt injection defense
- Rate limiting on all public endpoints
- Human handoff workflow (notification + escalation)
- Advanced analytics (sentiment, popular questions, resolution rate)
- Billing integration (Stripe subscriptions and usage-based metering)
- White-label branding option
- API access for developers (REST API for programmatic chatbot control)
- Load testing at 10x expected capacity
- Security audit/pentest
- Monitoring and alerting (cost anomalies, error rates)

**Addresses features:**
- Human handoff (table stakes)
- Advanced analytics (competitive)
- White-label (differentiator, already planned)
- API access (competitive)

**Avoids pitfalls:**
- Prompt injection (critical)
- No rate limiting (cost/security)
- Skipping security review before launch

**Tech from STACK.md:**
- Stripe for billing
- API rate limiting middleware

**Research flag:** MEDIUM - Security hardening needs attention. Consider security-focused research for:
- Prompt injection defense strategies
- LLM output sanitization techniques
- Anomaly detection for abuse

---

### Phase Ordering Rationale

**Why this order:**

1. **Foundation first** (Phase 1) - Multi-tenant architecture must be correct from day one. Retrofitting is 10x more expensive and risks catastrophic data bleed.

2. **Ingestion before RAG** (Phase 2 → 3) - Can't retrieve documents that haven't been processed. Async processing patterns must be built early, not bolted on.

3. **RAG before Dashboard** (Phase 3 → 4) - Dashboard displays conversation history and manages chatbots, requires stable chat API. Building dashboard first leads to rework.

4. **Dashboard before Widget** (Phase 4 → 5) - Users need UI to configure chatbot (colors, messages, domains) before generating embed code. Widget configuration requires dashboard.

5. **Widget security integrated** (Phase 5) - Security must be built into widget from start. Retrofitting secure embed codes requires coordinating with all customers to update their websites.

6. **Enhancements after core** (Phase 6-7) - Bilingual support and production hardening require stable foundation. These can be built in parallel by different team members if needed.

**Why this grouping:**

- Phases 1-3 are the "technical foundation" - cannot launch without these, no customer-facing value alone
- Phases 4-5 are the "MVP" - first deployable product customers can use
- Phases 6-7 are "competitive differentiation and scale prep" - make product production-ready and market-competitive

**How this avoids pitfalls:**

- Multi-tenant isolation addressed in Phase 1 (prevents catastrophic data bleed)
- RAG hallucination and citation accuracy addressed in Phase 3 (prevents trust loss)
- Widget security addressed in Phase 5 (prevents attack vector)
- Prompt injection and cost controls addressed in Phases 1 and 7 (defense-in-depth)
- All critical pitfalls have explicit prevention phases

### Research Flags

**Phases likely needing deeper research during planning:**

- **Phase 3 (RAG Core):** Complex domain with many implementation choices. Need research on:
  - Citation verification techniques (ensuring citations actually support claims)
  - Confidence scoring implementation (how to measure response reliability)
  - Hallucination detection methods (evaluation frameworks)
  - Query evaluation approaches (measuring RAG accuracy systematically)

- **Phase 5 (Widget Security):** Security-critical domain with evolving best practices. Need research on:
  - CSP compatibility testing strategies
  - Domain whitelisting implementation patterns
  - Secure embed code generation
  - iframe vs Shadow DOM security trade-offs

- **Phase 7 (Production Hardening):** Security and scale concerns. Need research on:
  - Prompt injection defense strategies (latest techniques)
  - LLM output sanitization methods
  - Anomaly detection for abuse patterns
  - Load testing approaches for WebSocket-heavy applications

**Phases with standard patterns (skip dedicated research-phase):**

- **Phase 1 (Foundation):** Multi-tenant SaaS architecture is well-documented. Follow established patterns (RLS + application filtering + context management).

- **Phase 2 (Ingestion):** Document processing and chunking have standard approaches. May need iteration on chunk strategy but doesn't require upfront research phase.

- **Phase 4 (Dashboard):** Standard CRUD dashboard with React. Well-documented patterns.

- **Phase 6 (Bilingual):** Internationalization (i18n) is well-established. text-embedding-3-large handles multilingual without special configuration.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Based on official OpenAI docs, Supabase docs, Next.js docs. Responses API is verified as modern replacement for Assistants API. Stack choices align with 2026 best practices. |
| Features | HIGH | Comprehensive competitor analysis (Chatbase, CustomGPT, Botpress, Tidio) with verified sources. Clear distinction between table stakes and differentiators. Anti-features validated by failure case studies. |
| Architecture | HIGH | Standard multi-tenant SaaS patterns verified across AWS, Nile, and production case studies. Component boundaries and data flows are well-established for this domain. Build order implications match real-world project experiences. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls verified across multiple 2026 sources and real failure cases (Air Canada, NYC chatbot, legal RAG studies). Prevention strategies sourced from security research and production incident reports. Some nuance in implementation details will need validation during development. |

**Overall confidence:** HIGH

Research is based on official documentation, verified competitor analysis, and documented production failures. The domain (embeddable AI chatbot SaaS) is established with known patterns. Key insights (Responses API simplification, multi-tenant isolation requirements, widget security) are well-supported.

### Gaps to Address

Areas where research was inconclusive or needs validation during implementation:

- **Citation verification implementation details:** Research shows it's critical but specific implementation techniques vary. Will need experimentation during Phase 3 to find optimal approach for accuracy vs latency trade-off.

- **Chunk strategy per document type:** Research indicates default chunking (500 tokens, overlap) is inadequate for complex documents (tables, code, legal). Will need iterative testing during Phase 2 with real customer documents. Build evaluation framework early.

- **Cost optimization strategy:** Research shows model routing is essential (GPT-4o-mini for 60%+ of queries, reserve GPT-4 for complex). Specific thresholds for routing will need calibration based on actual usage patterns. Start conservative (more GPT-4o-mini), tune based on quality complaints.

- **WebSocket scaling approach:** Research indicates WebSocket connections are second scaling bottleneck. Specific approach (sticky sessions + Redis Pub/Sub vs dedicated WebSocket servers) depends on hosting choice (Vercel has limitations). Validate during Phase 5 implementation.

- **Prompt injection defense effectiveness:** Research shows no single solution works, defense-in-depth required. Specific filtering rules and behavioral monitoring patterns will need continuous refinement based on actual attack attempts. Start with input validation, add layers iteratively.

- **Widget bundle size optimization:** Target <20KB for widget, but specific techniques (tree-shaking, code splitting, compression) need testing with actual implementation. May need to trade features for size.

**Handling strategy:**
- Build evaluation frameworks early (Phase 2 for chunking, Phase 3 for RAG quality)
- Plan for iteration on chunk strategy, citation verification, and model routing
- Start with conservative approaches (more expensive models, stricter security) and optimize based on data
- Budget security review before public launch (Phase 7) to validate prompt injection defenses

## Sources

### Primary Sources (HIGH confidence - Official Documentation)

**Stack & Technology:**
- [OpenAI Models Documentation](https://platform.openai.com/docs/models/) - Model capabilities, versions, deprecations
- [OpenAI File Search Guide](https://platform.openai.com/docs/guides/tools-file-search) - Responses API built-in RAG
- [OpenAI Cookbook: File Search with Responses API](https://cookbook.openai.com/examples/file_search_responses) - RAG implementation patterns
- [Tailwind CSS v4.0 Release](https://tailwindcss.com/blog/tailwindcss-v4) - Performance benchmarks, new features
- [Firecrawl Documentation](https://docs.firecrawl.dev/introduction) - Web crawling capabilities
- [Supabase pgvector Guide](https://supabase.com/docs/guides/database/extensions/pgvector) - Vector search setup
- [Clerk Next.js Documentation](https://clerk.com/docs/quickstarts/nextjs) - Authentication setup

**Architecture & Patterns:**
- [AWS: Multi-tenant chatbot with RAG using Amazon Bedrock](https://aws.amazon.com/blogs/containers/build-a-multi-tenant-chatbot-with-rag-using-amazon-bedrock-and-amazon-eks/) - Multi-tenant architecture patterns
- [AWS: Multi-tenant vector search with Aurora PostgreSQL](https://aws.amazon.com/blogs/database/multi-tenant-vector-search-with-amazon-aurora-postgresql-and-amazon-bedrock-knowledge-bases/) - RLS and tenant isolation
- [NVIDIA AI Blueprint for RAG](https://github.com/NVIDIA-AI-Blueprints/rag) - RAG pipeline reference implementation

### Secondary Sources (MEDIUM-HIGH confidence - Verified Comparisons)

**Stack Comparisons:**
- [Firecrawl: Best Vector Databases 2025](https://www.firecrawl.dev/blog/best-vector-databases-2025) - Vector DB comparison
- [AIMultiple: RAG Frameworks 2026](https://research.aimultiple.com/rag-frameworks/) - LangChain vs LlamaIndex vs alternatives
- [Better Stack: Drizzle vs Prisma](https://betterstack.com/community/guides/scaling-nodejs/drizzle-vs-prisma/) - ORM comparison
- [Vercel AI SDK 6](https://vercel.com/blog/ai-sdk-6) - Streaming AI capabilities

**Feature Research:**
- [Chatbase Review 2026 - SiteGPT](https://sitegpt.ai/blog/chatbase-review) - Competitor feature analysis
- [CustomGPT AI Review - SiteGPT](https://sitegpt.ai/blog/customgpt-ai-review) - Competitor feature analysis
- [Best AI Chatbot Builders 2026 - Emergent](https://emergent.sh/learn/best-ai-chatbot-builders) - Market landscape
- [Botpress: Chatbot Analytics](https://botpress.com/blog/chatbot-analytics) - Analytics patterns
- [Social Intents: Human Handoff Guide](https://www.socialintents.com/blog/ai-chatbot-with-human-handoff/) - Handoff patterns
- [Crescendo.ai: Multilingual Chatbots](https://www.crescendo.ai/blog/best-multilingual-chatbots) - Multilingual approaches

**Security & Pitfalls:**
- [Pinecone: Vector Database Multi-Tenancy](https://www.pinecone.io/learn/series/vector-databases-in-production-for-busy-engineers/vector-database-multi-tenancy/) - Multi-tenant isolation patterns
- [Nile: Multi-tenant RAG Applications](https://www.thenile.dev/blog/multi-tenant-rag) - Production architecture lessons
- [arXiv: FACTUM - Citation Hallucination Detection](https://arxiv.org/pdf/2601.05866) - Academic research on hallucination
- [Stanford: Legal RAG Hallucinations](https://dho.stanford.edu/wp-content/uploads/Legal_RAG_Hallucinations.pdf) - 17-33% hallucination rate study
- [IEEE S&P 2026: Prompt Injection in Chatbot Plugins](https://arxiv.org/html/2511.05797v1) - Security vulnerability analysis
- [Astra: Prompt Injection Attacks Guide](https://www.getastra.com/blog/ai-security/prompt-injection-attacks/) - Defense strategies
- [Qrvey: 2026 Iframe Security Risks](https://qrvey.com/blog/iframe-security/) - Widget security
- [AIMultiple: Chatbot Failures 2026](https://research.aimultiple.com/chatbot-fail/) - Real-world failure case studies

**Cost & Performance:**
- [Medium: LLM API Cost Optimization](https://medium.com/@ajayverma23/taming-the-beast-cost-optimization-strategies-for-llm-api-calls-in-production-11f16dbe2c39) - Production cost patterns
- [TrueFoundry: LLM Cost Tracking](https://www.truefoundry.com/blog/llm-cost-tracking-solution) - Cost attribution approaches
- [Qdrant: Vector Search Optimization](https://qdrant.tech/articles/vector-search-resource-optimization/) - Performance tuning
- [Weaviate: Scaling Vector Databases](https://weaviate.io/blog/scaling-and-weaviate) - Scaling patterns

### Tertiary Sources (MEDIUM confidence - Community/Industry)

**Market & Trends:**
- [OpenAI Developer Forum: Assistants API Deprecation](https://community.openai.com/t/is-there-a-future-for-the-assistants-api/1119941) - API migration timeline
- [VentureBeat: Data Predictions 2026](https://venturebeat.com/data/six-data-shifts-that-will-shape-enterprise-ai-in-2026) - RAG evolution trends
- [VeryCreatives: Why SaaS AI Features Fail](https://verycreatives.com/blog/why-most-saas-ai-features-fail) - Common mistakes
- [ISACA: Avoiding AI Pitfalls 2026](https://www.isaca.org/resources/news-and-trends/isaca-now-blog/2025/avoiding-ai-pitfalls-in-2026-lessons-learned-from-top-2025-incidents) - Incident analysis

---

*Research completed: 2026-01-26*
*Ready for roadmap: yes*
