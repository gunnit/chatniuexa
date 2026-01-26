# niuexa.ai

## What This Is

A platform where businesses create AI chatbots trained on their own data (documents, websites), then embed them on their websites with a simple script. Clients log in, upload their files or add URLs, configure their chatbot, and deploy — no technical expertise required.

## Core Value

Businesses can deploy a knowledgeable, data-aware chatbot on their website in minutes, with answers that cite their actual sources.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can sign up and log in to the platform
- [ ] User can create a chatbot
- [ ] User can upload files (PDFs, documents) as data sources
- [ ] User can add URLs to crawl as data sources
- [ ] System processes uploaded data (extraction, chunking, embeddings)
- [ ] User can manage data sources (add, remove, re-sync)
- [ ] User can configure chatbot in quick mode (minimal options, fast setup)
- [ ] User can configure chatbot in advanced mode (tone, instructions, branding)
- [ ] User can preview/test chatbot in dashboard before deploying
- [ ] User can get embed script for their website
- [ ] Embedded chat widget works on client websites
- [ ] Chatbot responds based on ingested data
- [ ] Chatbot responses include source citations with links
- [ ] Chatbot can respond in Italian and English
- [ ] Platform dashboard available in Italian and English
- [ ] Widget shows "Powered by niuexa.ai" (optional/configurable)
- [ ] White-label option (no niuexa branding on widget)
- [ ] Usage tracking per account (API calls, messages)

### Out of Scope

- Team accounts / multi-user per account — v2
- Analytics dashboard (chat volume, common questions) — v2
- Direct integrations (Shopify, CRM, etc.) — v2, files/URLs sufficient for v1
- Real-time data sync with live systems — v2
- Mobile app — web only for v1

## Context

- Clients are already asking for this — validated demand from embassy (policy/FAQ chatbot) and e-commerce (product catalog chatbot) use cases
- Different clients have different needs, so the platform must be flexible (quick setup vs advanced config)
- Using OpenAI's latest solutions for the AI backbone — research needed on current best practices (Assistants API, GPT-4o, embeddings, vector storage)
- Citations/source links are important for trust, especially for official information

## Constraints

- **Tech stack**: Research OpenAI's 2025 best practices for RAG/chatbot applications
- **Languages**: Must support Italian and English from day one (UI and chatbot responses)
- **Deployment**: Embed script must be simple — single script tag that works on any website
- **Cost awareness**: Track usage per client since OpenAI API costs scale with usage

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two config modes (quick/advanced) | Serve both non-technical clients who want speed and technical clients who want control | — Pending |
| Files + URLs only for v1 | Direct integrations add complexity; most clients can export to files or have public URLs | — Pending |
| No team accounts for v1 | Simplify auth and permissions; single-user accounts cover initial use cases | — Pending |
| Bilingual from start | Target market requires Italian; English for broader reach | — Pending |

---
*Last updated: 2026-01-26 after initialization*
