# ChatAziendale Deep Site Audit

**Date:** 2026-05-06
**Scope:** Full repo at `/mnt/c/Dev/chatbotweb` + live probe of `https://chataziendale.it`
**Method:** 4 parallel specialist passes (code-reviewer, security-reviewer, UI auditor, SEO/AEO/perf/a11y) + `tsc --noEmit` baseline.
**TS health:** ✅ `tsc --noEmit` exits 0 — no type errors.

---

## TL;DR — Top 10 fixes ranked by leverage × severity

| # | Finding | Severity | Owner |
|---|---------|----------|-------|
| 1 | **`robots.ts` blocks GPTBot, Google-Extended, CCBot** — actively contradicts the Niuexa AEO thesis | P0 | SEO |
| 2 | **WhatsApp webhook signature verification is conditional on `META_APP_SECRET` being set** — silent skip = forge-and-spam any tenant | P0 | Security |
| 3 | **`/api/chat*` and `/api/widget/[id]` have no domain allow-list** — any chatbot's UUID = free quota burn for attackers | P0 | Security |
| 4 | **No `Chatbot.allowedDomains` field exists** — root cause of #3, requires schema migration | P0 | Security |
| 5 | **Usage counter check-then-write is racy** — same tenant can overshoot plan limits under concurrency | P0 | Code |
| 6 | **WhatsApp webhook is synchronous + 20s Meta deadline** — guaranteed duplicate replies on slow inference | P0 | Code |
| 7 | **Cancelled-but-not-expired subscriptions never downgrade** — paid users keep Pro forever after cancel | P1 | Billing |
| 8 | **`enhance-instructions` & `data-sources/upload` not plan-gated** — free users can grind real OpenAI dollars | P1 | Security/Billing |
| 9 | **No `loading.tsx` / `error.tsx` in any dashboard segment** — every nav shows a blank screen | P1 | UI |
| 10 | **No shared `<Button>`/`<Input>`/`<Card>` components + 4× native `confirm()` calls** | P1 | UI |

---

## P0 — Critical (production breaks, data loss, active vulnerability)

### Security

**S-P0-1 · WhatsApp webhook silently accepts unsigned POSTs**
`src/app/api/webhooks/whatsapp/route.ts:67-74`
Signature verification is wrapped in `if (appSecret) {...}`. If `META_APP_SECRET` is unset, the route processes forged payloads. An attacker can forge messages referencing any tenant's `phoneNumberId`, drain their token quota, and exfiltrate RAG answers to attacker-owned phone numbers.
*Fix:* `if (!appSecret) return new Response('misconfigured', { status: 500 })`. Always require valid signature.

**S-P0-2 · `/api/chat` and `/api/chat/stream` accept any chatbot UUID with no origin enforcement**
`src/app/api/chat/route.ts:22-65`, `src/app/api/chat/stream/route.ts:23-32`, `src/lib/cors.ts:11-26`
CORS is set on the response but never validated server-side. Non-browser clients (curl, scripts) ignore CORS. Every embed UUID is exposed via `data-chatbot-id` on customer sites — anyone can hit `/api/chat?chatbotId=<victim>` and burn the victim's monthly token cap (free = 50K tokens, exhaustible in seconds with rotating IPs).
*Fix:* Add `Chatbot.allowedDomains String[]` field, enforce server-side via `Origin`/`Referer` against allow-list, return 403 on mismatch.

**S-P0-3 · `GET /api/widget/[id]` exposes any chatbot's branding to anyone**
`src/app/api/widget/[id]/route.ts:14-50`, `src/middleware.ts:28`
Same root cause as S-P0-2 — public endpoint with no domain check. Combined with S-P0-2, an attacker can clone any chatbot onto their own domain and exhaust the real tenant's quota.
*Fix:* Same allow-list as S-P0-2.

**S-P0-4 · `/api/chat/reaction` lacks auth, rate limit, AND origin check**
`src/app/api/chat/reaction/route.ts:18-64`
No rate limiting, no origin enforcement. Combined with predictable `messageId` exposure via SSE `messageId` event, an attacker can flip reactions on any conversation they observed.
*Fix:* Add `rateLimit(ip)` + Origin allow-list match.

### Code Quality

**C-P0-1 · Usage counter is read-then-check-then-write outside a serializable transaction**
`src/lib/usage.ts:39-118`
Two concurrent requests both read pre-increment value, both pass the `currentMonthTokens + tokens <= monthlyTokenLimit` check, both increment. Plan limits unenforceable under concurrency.
*Fix:* `prisma.$transaction([...], { isolationLevel: 'Serializable' })` or atomic conditional `UPDATE ... WHERE`.

**C-P0-2 · WhatsApp webhook processes synchronously → Meta retries → duplicate replies**
`src/app/api/webhooks/whatsapp/route.ts:63-107`
Meta deadline is 20s. RAG inference + cold start can exceed it. In-memory dedup `Set` is populated *before* processing completes, but Meta retry races with the original. Returns 200 only after all messages processed — guaranteed timeouts and duplicates under load.
*Fix:* Return 200 immediately, then `void processInBackground(...)`. Use DB `Message` row (not in-memory Set) for dedup.

**C-P0-3 · `decryptToken` Buffer/string concat corrupts non-ASCII tokens**
`src/lib/whatsapp.ts:39`
`decipher.update(encrypted) + decipher.final('utf8')` — first call returns a `Buffer`, implicit `.toString()` uses default encoding, splice across UTF-8 boundary corrupts multibyte chars.
*Fix:* `decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')`.

**C-P0-4 · `verifyWebhookSignature` throws on malformed signature instead of returning false**
`src/lib/whatsapp.ts:57-60`
`Buffer.from(invalidHex, 'hex')` produces a short buffer; `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMINGSAFEEQUAL_LENGTH`. Result: 500 instead of 401.
*Fix:* try/catch returning false, or pre-validate `provided` is 64-char hex.

**C-P0-5 · File upload runs synchronously inside the request → 30s Render timeout → orphaned PROCESSING records**
`src/app/api/data-sources/upload/route.ts:77-87`
`processFile()` awaited inline. Large PDF chunking + embedding takes minutes. Render kills the request, leaves `DataSource` stuck in `PROCESSING` forever.
*Fix:* Return 202 immediately, kick off processing async (already a pattern for URL sources via `/process`).

### SEO / AEO

**A-P0-1 · `robots.ts` actively blocks GPTBot, Google-Extended, CCBot, anthropic-ai, Applebot-Extended, Bytespider**
`src/app/robots.ts:20-33`
This is the highest-leverage finding given the user runs Niuexa (an AEO platform). Niuexa's thesis is that brands *want* to be cited by AI assistants. The current config:
- Blocks **GPTBot** → blocks ChatGPT training (separate from search retrieval, which is correctly allowed via `OAI-SearchBot`).
- Blocks **Google-Extended** → reduces inclusion in Gemini + AI Overviews grounding.
- Blocks **CCBot** → removes site from Common Crawl, used by virtually every open-source model + Brave Search.
- Looks copy-pasted from a "block-all-AI" template and contradicts the user's business model.
*Fix:* Drop `GPTBot`, `Google-Extended`, `CCBot` from `BLOCK_BOTS` at minimum. Re-evaluate the rest against business intent.

**A-P0-2 · Blog post `og:image` URL is locale-prefixed (`/en/blog/...`) but EN routes are not prefixed sitewide**
`src/app/[locale]/blog/[slug]/page.tsx`
Live HTML emits `og:image = https://chataziendale.it/en/blog/.../opengraph-image?...`. Site uses `as-needed` locale prefix → EN has no `/en` prefix anywhere else. Likely 404s, breaking every social share preview for EN articles.
*Fix:* Verify the URL responds 200; if not, set `openGraph.images` explicitly in `generateMetadata` rather than relying on Next's file convention.

---

## P1 — High (bugs, exploits with constraints, significant tech debt)

### Security

**S-P1-1 · Cancelled-but-not-expired subscriptions never downgrade** (= revenue leak)
`src/app/api/billing/webhook/route.ts:75-94`
On `BILLING.SUBSCRIPTION.CANCELLED` with `currentPeriodEnd > now`, the code logs but never schedules the eventual downgrade. No cron, no `EXPIRED` handler. Users get Pro/Business benefits indefinitely after cancelling. This finding overlaps **C-P1-5** below — same root cause.
*Fix:* Daily cron OR check inside `getPlanLimits` that flips to free when `status === 'CANCELLED' && currentPeriodEnd <= now`.

**S-P1-2 · `enhance-instructions` not plan-gated**
`src/app/api/chatbots/[id]/enhance-instructions/route.ts:14-228`
Burns OpenAI dollars per call (`gpt-5.4-mini` + 15 chunk fetches). Free users at 20/min rate limit can grind real costs.
*Fix:* Add `tenant.plan !== 'free'` check, or downgrade free tier to `gpt-5.4-nano` with reduced chunk count.

**S-P1-3 · `/api/data-sources/upload` not plan-gated, no embedding usage logged**
`src/app/api/data-sources/upload/route.ts:12-99`
Free users can upload unlimited 10MB PDFs → embeddings cost real money but `logUsage` is only called for `type === 'chat'`.
*Fix:* Plan-gate uploads (free = 0 or 1 file), call `logUsage({ type: 'embedding', tokens: estimated })` before processing, enforce `monthlyCostLimit` against all types.

**S-P1-4 · SSRF in URL data-source ingestion fallback**
`src/lib/documents/crawler.ts:62-87`, `src/app/api/data-sources/crawl/import/route.ts:36-46`
When `FIRECRAWL_API_KEY` is unset, raw `fetch(url)` accepts internal Render hostnames, link-local, RFC1918. Any logged-in user can harvest internal services into their RAG.
*Fix:* Validate URL scheme is `http`/`https`, resolve hostname, reject loopback/private/link-local ranges before crawl.

**S-P1-5 · `enhance-instructions` leaks raw OpenAI error messages**
`src/app/api/chatbots/[id]/enhance-instructions/route.ts:186-192,205-209`
Errors include model SKU, org IDs, `finish_reason`, `refusal` text (which may quote system-prompt fragments).
*Fix:* Log full error server-side, return generic `{error: 'AI generation failed'}` to client.

**S-P1-6 · Forgot-password has no rate limit**
`src/app/[locale]/(auth)/forgot-password/actions.ts:18-63`
Token is fine (128-bit UUID), but no per-IP/per-email throttle = inbox flooding + sender reputation damage.
*Fix:* `rateLimit(ip, 3/hour)` + per-email throttle.

**S-P1-7 · Account deletion does not invalidate JWTs**
`src/app/api/account/delete/route.ts:6-53`
NextAuth uses JWT strategy; deleting `Session` rows is a no-op. Stolen/cached cookies still validate after deletion.
*Fix:* Soft-delete with `deletedAt` flag, check user existence inside `session` callback in `auth.ts`.

**S-P1-8 · JWT `tenantId` set once at login, never re-validated**
`src/lib/auth.ts:107-122`
If admin moves a user between tenants or deletes the tenant, JWT keeps stale `tenantId`. Combined with S-P1-7, stale-JWT users still act under old tenant scope.
*Fix:* In `session` callback, refetch `profile.tenantId` from DB.

### Code Quality

**C-P1-1 · TOCTOU race in chatbot creation count check**
`src/app/api/chatbots/route.ts:51-63`
`count` then `create` is two operations. Two simultaneous POSTs can create one extra chatbot above plan limit.
*Fix:* Wrap in `prisma.$transaction` or DB-level CHECK constraint.

**C-P1-2 · `logUsage` called before LLM call completes — failed inferences still bill the tenant**
`src/app/api/chat/route.ts:52-65`, `src/app/api/chat/stream/route.ts:45-48`
OpenAI outage = quota drained without service delivered.
*Fix:* Move `logUsage` to after successful response.

**C-P1-3 · Streaming `flush` callback save errors silently destroy assistant messages**
`src/app/api/chat/stream/route.ts:132-148`
DB write failure inside `flush` calls `controller.error()` on a stream that already delivered all content. User got the answer; history is lost; reactions break.
*Fix:* try/catch + log only — don't error the stream.

**C-P1-4 · N+1 in `enhance-instructions`**
`src/app/api/chatbots/[id]/enhance-instructions/route.ts:117-134`
Up to `maxPositions × dataSources` separate `findFirst` queries with `skip` offsets (each = table scan).
*Fix:* One `findMany` per data source, sample in JS.

**C-P1-5 · Billing cancel logic is inverted from its comment** (overlaps S-P1-1)
`src/app/api/billing/webhook/route.ts:76-94`
Comment says "downgrade only after period end". Code checks `<=` which fires immediately when `currentPeriodEnd` was set to `new Date()` fallback at activation time.
*Fix:* Same as S-P1-1.

**C-P1-6 · `applyPlanLimits` two writes outside a transaction**
`src/lib/plans.ts:91-113`
`UsageLimit.upsert` then `Tenant.update` — crash between them = divergent state.
*Fix:* Wrap in `prisma.$transaction`.

**C-P1-7 · WhatsApp config GET masks ciphertext, not plaintext**
`src/app/api/chatbots/[id]/whatsapp/route.ts:51`
`accessTokenMasked` returns last 8 chars of AES ciphertext — meaningless to user, misleading UI.
*Fix:* Decrypt then mask, or return literal `'[configured]'`.

**C-P1-8 · `processFile`/`processUrl` leave orphaned chunks on partial failure**
`src/lib/documents/processor.ts:58-84,142-166`
Embedding UPDATE fails on chunk N → DataSource marked FAILED, chunks 0..N-1 remain searchable.
*Fix:* Wrap chunk loop in transaction, OR delete existing chunks at entry.

**C-P1-9 · Hardcoded `chataziendale.onrender.com` in transactional emails**
`src/lib/email.ts:29,92`
Public domain is `chataziendale.it` (Render hostname is `chatniuexa.onrender.com`, not the one hardcoded). Welcome + billing emails ship wrong URL.
*Fix:* `${process.env.NEXT_PUBLIC_APP_URL || 'https://chataziendale.it'}/dashboard`.

**C-P1-10 · `rag.ts` OpenAI calls missing `max_completion_tokens`**
`src/lib/chat/rag.ts:180-183,388-392`
Violates explicit project rule (CLAUDE.md). Allows full context-window output → expensive + slow + breaks o-series models.
*Fix:* Add `max_completion_tokens: 2048` to both completions.

### UI / UX (visual & functional polish)

**U-P1-1 · Zero `loading.tsx` / `error.tsx` files in any segment**
`src/app/[locale]/dashboard/**`, blog, billing, analytics
Every async server component nav = blank screen. Every thrown error = generic Next fallback.
*Fix:* Add per-segment skeletons + `'use client'` error boundaries with retry.

**U-P1-2 · No shared component library**
Every primitive re-implemented inline. ~3 different "primary buttons" (`page.tsx:160` 13 classes, `chatbots/page.tsx:142` 9 classes with gradient, `page.tsx:465` solid teal). Inputs duplicated. Cards duplicated. **4× native `confirm()` calls** in `chatbots/page.tsx:77`, `billing/page.tsx:115`, `chatbots/[id]/page.tsx:1082`, `data-sources/page.tsx:135` — unstyled, unbrandable, on iOS Safari shows the URL.
*Fix:* `src/components/ui/` with `Button`, `Input`, `Textarea`, `Card`, `ConfirmDialog`. Migrate.

**U-P1-3 · Design tokens defined but unused** (root cause of color chaos)
`src/app/globals.css:9-67`
`--primary-*`, `--accent-*`, `--gradient-primary` declared but never wired into Tailwind via `@theme inline`. Result: 250+ occurrences of hardcoded `[#18181B]`, `[#52525B]`, `[#0F766E]`, `[#E4E4E7]`, `[#FAFAF7]` (Zinc) on landing/auth, vs. `slate-*` utilities on dashboard. Two greyscales, two products, one brand.
*Fix:* Expand `@theme inline` to map `--color-primary-*: var(--primary-*)`. Pick Zinc OR Slate. Migrate.

**U-P1-4 · 13+ hardcoded English strings in i18n-wrapped pages**
`chatbots/[id]/page.tsx:573,666,670,702,981-985`; `(auth)/login/page.tsx:62-64`
Italian users see English mid-page. Breaks the i18n contract.
*Fix:* Extract to `messages/{en,it}.json` under appropriate namespaces.

**U-P1-5 · Pricing card has duplicated translation key**
`src/app/[locale]/page.tsx:447,450`
Pro card renders `{t("pricingMostPopular")}` twice — as badge AND as description. Other tiers correctly use `pricingForever`/`pricingEnterprise`.
*Fix:* Add `pricingProDesc` key to both locale JSONs, replace line 450.

**U-P1-6 · Settings page is fully unresponsive**
`src/app/[locale]/dashboard/settings/page.tsx`
Zero `sm:`/`md:`/`lg:` classes. Danger Zone touches screen edges on phones.
*Fix:* Wrap with standard `px-4 sm:px-6 lg:px-8` container.

**U-P1-7 · WCAG AA contrast failures on landing**
`src/app/[locale]/page.tsx`
- `text-[#A1A1AA]` on white (lines 162, 260) ≈ 2.7:1 — FAILS body text 4.5:1.
- `text-[#71717A]` on white/cream (lines 215, 223, 231, 332, 342, 352, 393, 422) ≈ 4.1-4.3:1 — borderline FAIL.
*Fix:* Bump body grays to `#52525B` (~7.4:1, already used elsewhere in the same file).

**U-P1-8 · Mobile menu button missing `aria-expanded` / `aria-controls`**
`src/components/landing/Navbar.tsx:84,103`
Has `aria-label="Menu"` only. Screen readers can't announce open/closed.
*Fix:* `aria-expanded={mobileOpen} aria-controls="mobile-nav"` + `id="mobile-nav"` on dropdown.

### SEO / AEO / Performance

**A-P1-1 · Articles ship `BlogPosting` but no `HowTo` or `FAQPage` schema**
`src/components/seo/ArticleSchema.tsx`
Front-matter already declares `type: "how-to"` (e.g. `whatsapp-business-ai-chatbot-italy-2026.mdx:7`). Highest-leverage AEO upside on existing content — these are the schemas Google AI Overviews / Perplexity / ChatGPT specifically extract.
*Fix:* Branch on `post.type` in `ArticleSchema.tsx`, emit `HowTo` JSON-LD parsing `## Step N` H2s; emit `FAQPage` for posts with FAQ section.

**A-P1-2 · `metadataBase`/canonical drift between root and `[locale]` layouts**
`src/app/layout.tsx:37-43` vs `src/app/[locale]/page.tsx:20-27`
Root declares `alternates.canonical: "/"` and `languages` without `x-default`. Inner pages without their own `generateMetadata` inherit stale config.
*Fix:* Remove `alternates` from root, trust per-page overrides; OR add `x-default`.

**A-P1-3 · Spline 3D scene = ~2-4 MB WebGL on every homepage visit**
`src/components/landing/SplineScene.tsx`
Already lazy-loaded (good), but unconditional. Single biggest LCP hit.
*Fix:* Gate behind `prefers-reduced-motion` AND `navigator.connection.effectiveType === '4g'`. Static teal robot PNG fallback also helps OG previews and image-aware LLMs.

**A-P1-4 · Chat widget loads `afterInteractive` on every page**
`src/app/[locale]/page.tsx:580-584`
56 KB script + cross-origin DNS lookup to `chatniuexa.onrender.com` blocks interaction.
*Fix:* `strategy="lazyOnload"` OR open-on-click pattern.

**A-P1-5 · No `llms.txt`**
Emerging Anthropic-led AEO convention; trivial to ship.
*Fix:* `src/app/llms.txt/route.ts` returning markdown index of key URLs + descriptions.

---

## P2 — Medium / hardening / polish

### Security

- **M-1 · Per-chatbot rate limit absent** — `src/app/api/chat/{route,stream/route,reaction/route}.ts`: only IP-based, in-memory, resets on Render restart. Single attacker with rotating IPs evades.
- **M-2 · `getCorsHeaders` returns empty `Access-Control-Allow-Origin`** instead of omitting → inconsistent browser behavior. `src/lib/cors.ts:11-26`.
- **M-3 · Server logs leak Firecrawl key prefix** — `src/lib/documents/crawler.ts:27`, plus raw `JSON.stringify(error)` dumps in error paths. Use `logger`, not `console`.
- **M-4 · Login server action doesn't check `signIn` result** — `src/app/[locale]/(auth)/login/actions.ts:60-78`. Brittle if v5-beta switches from throwing to returning.
- **M-5 · Widget script not versioned, no SRI** — `public/widget.js`. Customers embed it as a stable URL; build pipeline compromise = supply-chain on every customer site.
- **M-6 · `process-batch` fires unlimited parallel crawls** — `src/app/api/data-sources/process-batch/route.ts:86-88`. Single tenant can DoS the platform. Use `p-limit` with concurrency 3-5.
- **M-7 · NextAuth cookie config not explicit** — `src/lib/auth.ts`, `src/middleware.ts:39-44`. Middleware accepts both `__Secure-` and unprefixed cookie names → if proxy strips HTTPS, insecure cookies are honored.
- **M-8 · WhatsApp env-fallback verify token** — `WHATSAPP_WEBHOOK_VERIFY_TOKEN` should be removed after initial Meta setup.

### Code Quality

- **C-P2-1 · Debug `console.log` in production paths** — `src/app/api/chatbots/[id]/route.ts:80,87`, `src/lib/documents/processor.ts:79`, `src/lib/documents/embeddings.ts:22,31,39`.
- **C-P2-2 · `Infinity` as `maxChatbots`** — `src/lib/plans.ts:69`. Serializes to `null` in JSON; UI displays `"up to null chatbots"`.
- **C-P2-3 · `getOrCreateConversation` race** — `src/app/api/chat/stream/route.ts:217-233`. Two simultaneous first messages = two conversations. Add `@@unique([chatbotId, sessionId])`.
- **C-P2-4 · `resync` route does nothing** — `src/app/api/data-sources/[id]/resync/route.ts:36-53`. Sets PENDING but never triggers crawl. Response message is misleading.

### UI / UX

- **U-P2-1 · Two container widths** — landing uses `max-w-7xl px-6 lg:px-12`, dashboard uses `max-w-7xl px-4 sm:px-6 lg:px-8`. 32px viewport jolt on `lg` between marketing and app.
- **U-P2-2 · Hero grid `grid-cols-[1.1fr_1.1fr]` with `gap-4`** — equal columns + tight gap leaves dead space beside headline. Try `[1.05fr_0.95fr] gap-12`.
- **U-P2-3 · Random feature-card accent colors** — landing `page.tsx:212-232` uses teal/amber/rose borders without semantic meaning. Reserve amber for warnings, rose for destructive.
- **U-P2-4 · Stray non-brand colors** — `#6366f1` indigo (9×), `#A14040` brick (3×). Not in `globals.css` tokens.
- **U-P2-5 · Inline pixel sizes** — `[15px]`, `[17px]`, `[11px]`, `[13px]` 50+ times bypass theme scale.
- **U-P2-6 · Chatbot card actions overflow at <360px** — `chatbots/page.tsx:216-246`. Switch to icon-only at `<sm`.
- **U-P2-7 · No global focus-visible style** — only 34 `focus:` occurrences, only 3 `aria-label`. Default browser ring invisible against teal/slate. Add `*:focus-visible { outline: 2px solid var(--primary-500); outline-offset: 2px; }` to `globals.css`.
- **U-P2-8 · Modal backdrops are `<div onClick=>`** — `SiteCrawlerModal.tsx:134`, `DocumentPreviewModal.tsx:123`. Not keyboard-accessible, no Esc handling.
- **U-P2-9 · Layout shift on chatbots list** — `chatbots/page.tsx`: empty-state vs grid swap on load. Reserve `min-h`.
- **U-P2-10 · Dashboard never uses `font-serif`** — brand display font missing on the authenticated app.

### SEO / AEO / Performance / A11y

- **P-1 · Sitemap `lastModified: new Date()` on static entries** — `src/app/sitemap.ts:19,22`. Bumps on every deploy = trains crawlers to ignore lastmod. Hardcode or use git mtime.
- **P-2 · Missing `og:locale:alternate`** — homepage doesn't declare alternate-locale OG. Add in `[locale]/page.tsx generateMetadata`.
- **P-3 · `og:image:alt` is generic** — same alt text on every blog post. Set `alt = post.title` per article.
- **P-4 · Homepage HTML 150 KB pre-gzip** — heavy but acceptable; monitor.
- **P-5 · No `next.config.ts` `images.formats`** — explicitly set `['image/avif', 'image/webp']`.
- **P-6 · No `preconnect` to `prod.spline.design` or `chatniuexa.onrender.com`** — both on critical path. Add to `[locale]/layout.tsx`.
- **P-7 · Two raw `<img>` tags in dashboard** — `chatbots/[id]/page.tsx:813,871` (auth-walled, cosmetic).
- **P-8 · Spline scene has no accessible name / loading announcement** — `SplineScene.tsx:93-101`.
- **P-9 · `LanguageSwitcher` button title-only hint** — replace `title` with `aria-label`.

---

## Pillar scores (UI audit)

| Pillar | Score |
|---|---|
| Visual hierarchy & typography | 6.5/10 |
| Spacing, rhythm, alignment | 7/10 |
| Color, contrast, brand coherence | 5/10 |
| Component consistency | 4.5/10 |
| Responsive / mobile | 6.5/10 |
| Microinteractions & polish | 5.5/10 |
| **Overall UI** | **35/60 (≈58%)** |

## What's already strong (do not regress)

- ✅ TypeScript clean (`tsc --noEmit` exits 0).
- ✅ Tenant isolation: every authenticated `[id]` route I sampled correctly filters Prisma queries by `session.user.tenantId`. RAG vector search scoped at SQL level. Admin routes role-gated.
- ✅ PayPal webhook verifies HMAC signature first.
- ✅ Full SSR with RSC-first architecture (`"use client"` only on Navbar, LanguageSwitcher, SplineScene, RevealOnScroll, CookieConsent, TrustedBy).
- ✅ Hreflang + canonical + sitemap correct. EN/IT pairs symmetrical with proper `xhtml:link` alternates.
- ✅ Multi-schema JSON-LD on home (`Organization` + `WebSite` + `SoftwareApplication` w/ Offers + `FAQPage`) and articles (`BlogPosting` + `BreadcrumbList` + `Person` + `ImageObject`).
- ✅ `prefers-reduced-motion` honored in CSS + `RevealOnScroll`.
- ✅ Security headers configured (HSTS, X-Frame-Options, Permissions-Policy, X-DNS-Prefetch-Control).
- ✅ `next/font` with `display: 'swap'` — no FOIT.
- ✅ FAQ uses native `<details>/<summary>` — accessible disclosure free.
- ✅ Real skeleton loader on chatbots list with proper empty state.
- ✅ IndexNow integration (`scripts/indexnow-ping.ts`).
- ✅ Articles cite real external sources via `<SourceCite>` — exactly what LLMs reward.

---

## Suggested execution order

**Week 1 — bleeding** (P0)
1. Drop `GPTBot`/`Google-Extended`/`CCBot` from `BLOCK_BOTS` (1-line change, biggest business impact)
2. Make WhatsApp `appSecret` mandatory (S-P0-1)
3. Add `Chatbot.allowedDomains` schema + enforce on `/api/chat*` and `/api/widget/[id]` (S-P0-2/3)
4. Make WhatsApp webhook async + DB-based dedup (C-P0-2)
5. Fix `decryptToken` UTF-8 corruption + `verifyWebhookSignature` throw (C-P0-3/4)
6. Atomic usage counter (C-P0-1)

**Week 2 — revenue & UX**
7. Cancel-at-period-end downgrade job (S-P1-1)
8. Plan-gate `enhance-instructions` + `data-sources/upload` (S-P1-2/3)
9. SSRF host validation (S-P1-4)
10. Build `<Button>`, `<Input>`, `<Card>`, `<ConfirmDialog>` + migrate (U-P1-2)
11. Add `loading.tsx` + `error.tsx` per dashboard segment (U-P1-1)
12. Wire `globals.css` tokens to Tailwind, pick Zinc or Slate (U-P1-3)

**Week 3 — AEO & content**
13. `HowTo` + `FAQPage` JSON-LD branching (A-P1-1)
14. `llms.txt` (A-P1-5)
15. Verify EN `og:image` URL responds 200 (A-P0-2)
16. Lazy-load Spline behind connection check (A-P1-3)
17. WCAG AA contrast bumps + missing English strings + ARIA (U-P1-4/7/8)

Everything else = P2 hardening, do at convenience.
