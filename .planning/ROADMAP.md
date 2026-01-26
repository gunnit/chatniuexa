# Roadmap: niuexa.ai

## Overview

This roadmap delivers an embeddable AI chatbot platform where businesses train chatbots on their own documents and deploy them via website widgets. The journey moves from authentication and multi-tenant foundation, through document ingestion and RAG core, to dashboard and widget deployment, then completes with bilingual support and production-ready analytics. Each phase delivers a coherent capability, building on the previous to reach a production-ready SaaS platform.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation & Authentication** - Multi-tenant base with user accounts and data isolation
- [ ] **Phase 2: Document Ingestion** - Upload, crawl, and process documents into vector embeddings
- [ ] **Phase 3: RAG Core** - Chatbot responses from ingested knowledge with source citations
- [ ] **Phase 4: Dashboard Foundation** - Management interface for conversations and chatbot testing
- [ ] **Phase 5: Chatbot Configuration** - Quick and advanced setup modes with widget customization
- [ ] **Phase 6: Widget Deployment** - Embeddable chat widget that works on any website
- [ ] **Phase 7: Bilingual Support** - Italian and English for chatbot responses and dashboard UI
- [ ] **Phase 8: Chat Enhancements** - Confidence indicators and response quality signals
- [ ] **Phase 9: Analytics & Usage Control** - Usage tracking, rate limiting, and spending limits

## Phase Details

### Phase 1: Foundation & Authentication
**Goal**: Users can create accounts and access a secure, tenant-isolated platform
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, INFRA-01
**Success Criteria** (what must be TRUE):
  1. User can sign up with email and password and receive confirmation
  2. User can log in and access their dashboard
  3. User session persists across browser refresh without re-login
  4. User cannot see or access another user's data (tenant isolation verified)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

**Research flag**: LOW - standard multi-tenant SaaS patterns

---

### Phase 2: Document Ingestion
**Goal**: Users can upload documents and URLs that get processed into searchable knowledge
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, INFRA-02
**Success Criteria** (what must be TRUE):
  1. User can upload PDF, DOC, or TXT files and see them in their data sources list
  2. User can add a URL and system crawls and indexes the content
  3. User can see processing status (pending, processing, complete, failed) for each source
  4. User can remove a data source and it disappears from the list
  5. User can re-sync a URL source to update with latest content
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

**Research flag**: MEDIUM - parser fallback strategies and chunk optimization

---

### Phase 3: RAG Core
**Goal**: Chatbot responds accurately based on ingested knowledge with source citations
**Depends on**: Phase 2
**Requirements**: CHAT-01, CHAT-02, CHAT-06
**Success Criteria** (what must be TRUE):
  1. Chatbot responds with information from ingested documents (not generic responses)
  2. Chatbot responses include clickable citations linking to original sources
  3. User sees conversation history within their chat session
  4. Chatbot admits when it does not have information rather than hallucinating
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

**Research flag**: HIGH - citation verification, confidence scoring, hallucination detection

---

### Phase 4: Dashboard Foundation
**Goal**: Users can manage their chatbot and view conversation logs through a dashboard
**Depends on**: Phase 3
**Requirements**: DEPLOY-03, DASH-01
**Success Criteria** (what must be TRUE):
  1. User can preview and test their chatbot directly in the dashboard
  2. User can view conversation logs from their deployed chatbot
  3. Dashboard provides clear navigation between chatbot, data sources, and settings
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

**Research flag**: LOW - standard CRUD dashboard patterns

---

### Phase 5: Chatbot Configuration
**Goal**: Users can configure their chatbot with quick setup or advanced customization
**Depends on**: Phase 4
**Requirements**: CONF-01, CONF-02, CONF-03, CONF-04, CONF-05
**Success Criteria** (what must be TRUE):
  1. User can create a chatbot with quick setup (just name and data sources)
  2. User can configure advanced settings (tone, instructions, personality)
  3. User can customize widget appearance (colors, button style)
  4. User can upload custom logo for their widget
  5. User can enable or disable "Powered by niuexa.ai" branding
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

**Research flag**: LOW - configuration patterns are standard

---

### Phase 6: Widget Deployment
**Goal**: Users can deploy their chatbot on any website with a simple embed script
**Depends on**: Phase 5
**Requirements**: DEPLOY-01, DEPLOY-02, DEPLOY-04
**Success Criteria** (what must be TRUE):
  1. User can copy a single script tag embed code from their dashboard
  2. Pasting the script tag on any website displays the chat widget
  3. Widget is mobile-responsive and works on phones and tablets
  4. Widget loads quickly and does not break host website styling
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

**Research flag**: MEDIUM - widget security, CSP compatibility, Shadow DOM patterns

---

### Phase 7: Bilingual Support
**Goal**: Platform supports Italian and English for both chatbot responses and dashboard UI
**Depends on**: Phase 6
**Requirements**: CHAT-03, CHAT-04, CHAT-05, DASH-04, DASH-05, DASH-06
**Success Criteria** (what must be TRUE):
  1. Chatbot responds in Italian when user messages in Italian
  2. Chatbot responds in English when user messages in English
  3. Chatbot automatically detects user language and responds accordingly
  4. Dashboard UI is available in Italian
  5. Dashboard UI is available in English
  6. User can switch dashboard language via settings
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

**Research flag**: LOW - i18n patterns are well-documented

---

### Phase 8: Chat Enhancements
**Goal**: Chatbot provides confidence signals to help users assess response reliability
**Depends on**: Phase 7
**Requirements**: CHAT-07
**Success Criteria** (what must be TRUE):
  1. Chatbot shows confidence indicator for each response
  2. Low-confidence responses are visually distinguished from high-confidence ones
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

**Research flag**: MEDIUM - confidence scoring implementation

---

### Phase 9: Analytics & Usage Control
**Goal**: Users can track usage and platform enforces limits to control costs
**Depends on**: Phase 8
**Requirements**: DASH-02, DASH-03, INFRA-03, INFRA-04
**Success Criteria** (what must be TRUE):
  1. User can see basic analytics (chat volume, message count) in dashboard
  2. User can see usage tracking (API calls, remaining limits)
  3. System enforces rate limiting per account
  4. System enforces spending limits to prevent API cost overrun
  5. User receives notification when approaching usage limits
**Plans**: TBD

Plans:
- [ ] 09-01: TBD

**Research flag**: MEDIUM - cost attribution and anomaly detection

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Authentication | 0/? | Not started | - |
| 2. Document Ingestion | 0/? | Not started | - |
| 3. RAG Core | 0/? | Not started | - |
| 4. Dashboard Foundation | 0/? | Not started | - |
| 5. Chatbot Configuration | 0/? | Not started | - |
| 6. Widget Deployment | 0/? | Not started | - |
| 7. Bilingual Support | 0/? | Not started | - |
| 8. Chat Enhancements | 0/? | Not started | - |
| 9. Analytics & Usage Control | 0/? | Not started | - |

---
*Roadmap created: 2026-01-26*
*Total v1 requirements: 34*
*Coverage: 34/34 (100%)*
