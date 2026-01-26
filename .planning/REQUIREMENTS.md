# Requirements: niuexa.ai

**Defined:** 2026-01-26
**Core Value:** Businesses can deploy a knowledgeable, data-aware chatbot on their website in minutes, with answers that cite their actual sources.

## v1 Requirements

### Authentication

- [ ] **AUTH-01**: User can sign up with email and password
- [ ] **AUTH-02**: User can log in with email and password
- [ ] **AUTH-03**: User session persists across browser refresh

### Data Ingestion

- [ ] **DATA-01**: User can upload files (PDF, DOC, TXT) as knowledge sources
- [ ] **DATA-02**: User can add URLs to crawl and index as knowledge sources
- [ ] **DATA-03**: User can view list of all data sources
- [ ] **DATA-04**: User can remove a data source
- [ ] **DATA-05**: User can re-sync/re-crawl a URL source
- [ ] **DATA-06**: User can see processing status of each data source

### Chatbot Configuration

- [ ] **CONF-01**: User can create a chatbot with quick setup (name + data sources only)
- [ ] **CONF-02**: User can configure chatbot in advanced mode (tone, instructions, personality)
- [ ] **CONF-03**: User can customize widget appearance (colors, button style)
- [ ] **CONF-04**: User can upload custom logo for widget
- [ ] **CONF-05**: User can enable/disable "Powered by niuexa.ai" branding

### Chat Experience

- [ ] **CHAT-01**: Chatbot responds based on ingested knowledge sources
- [ ] **CHAT-02**: Chatbot responses include clickable source citations
- [ ] **CHAT-03**: Chatbot can respond in Italian
- [ ] **CHAT-04**: Chatbot can respond in English
- [ ] **CHAT-05**: Chatbot detects user language and responds accordingly
- [ ] **CHAT-06**: End user sees conversation history within session
- [ ] **CHAT-07**: Chatbot shows confidence indicator for responses

### Deployment

- [ ] **DEPLOY-01**: User can get embed script (single script tag)
- [ ] **DEPLOY-02**: Embed script works on any website
- [ ] **DEPLOY-03**: User can preview/test chatbot in dashboard before deploying
- [ ] **DEPLOY-04**: Widget is mobile-responsive

### Dashboard

- [ ] **DASH-01**: User can view conversation logs from their chatbot
- [ ] **DASH-02**: User can see basic analytics (chat volume, message count)
- [ ] **DASH-03**: User can see usage tracking (API calls, limits)
- [ ] **DASH-04**: Dashboard available in Italian
- [ ] **DASH-05**: Dashboard available in English
- [ ] **DASH-06**: User can switch dashboard language

### Infrastructure

- [ ] **INFRA-01**: Multi-tenant data isolation (users cannot access other users' data)
- [ ] **INFRA-02**: Document processing pipeline (chunking, embeddings, vector storage)
- [ ] **INFRA-03**: Rate limiting per account
- [ ] **INFRA-04**: Spending limits to prevent API cost overrun

## v2 Requirements

### Authentication Enhancements

- **AUTH-04**: User receives email verification after signup
- **AUTH-05**: User can reset password via email link
- **AUTH-06**: User can log in with magic link
- **AUTH-07**: User can log in with Google OAuth

### Advanced Features

- **ADV-01**: User can create multiple chatbots per account
- **ADV-02**: Chatbot can hand off to human agent
- **ADV-03**: Chatbot can collect lead information (email, name)
- **ADV-04**: User can restrict widget to specific domains (whitelisting)

### Analytics & Insights

- **ANLYT-01**: User can see common questions/topics
- **ANLYT-02**: User can export conversation data
- **ANLYT-03**: User can see response quality metrics

### Integrations

- **INTG-01**: Connect to Shopify product catalog
- **INTG-02**: Connect to CRM systems
- **INTG-03**: API access for developers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Team accounts / multi-user | Complexity for v1; single-user covers initial use cases |
| Mobile app | Web-first; mobile browser works |
| Voice/phone channels | High complexity; text chat is core value |
| Real-time data sync | Files/URLs sufficient; live sync is v2+ |
| AI actions (book appointments, etc.) | Informational chatbot first; actions add liability |
| SOC 2 compliance | Pursue when enterprise customers require |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| DATA-06 | Phase 2 | Pending |
| CONF-01 | Phase 5 | Pending |
| CONF-02 | Phase 5 | Pending |
| CONF-03 | Phase 5 | Pending |
| CONF-04 | Phase 5 | Pending |
| CONF-05 | Phase 5 | Pending |
| CHAT-01 | Phase 3 | Pending |
| CHAT-02 | Phase 3 | Pending |
| CHAT-03 | Phase 7 | Pending |
| CHAT-04 | Phase 7 | Pending |
| CHAT-05 | Phase 7 | Pending |
| CHAT-06 | Phase 3 | Pending |
| CHAT-07 | Phase 8 | Pending |
| DEPLOY-01 | Phase 6 | Pending |
| DEPLOY-02 | Phase 6 | Pending |
| DEPLOY-03 | Phase 4 | Pending |
| DEPLOY-04 | Phase 6 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 9 | Pending |
| DASH-03 | Phase 9 | Pending |
| DASH-04 | Phase 7 | Pending |
| DASH-05 | Phase 7 | Pending |
| DASH-06 | Phase 7 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 2 | Pending |
| INFRA-03 | Phase 9 | Pending |
| INFRA-04 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 34 total
- Mapped to phases: 34
- Unmapped: 0

---
*Requirements defined: 2026-01-26*
*Last updated: 2026-01-26 after roadmap creation*
