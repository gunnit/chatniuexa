# ChatAziendale — AEO Foundation + Content Implementation

**Date:** 2026-04-29
**Site:** chataziendale.it
**Scope:** "Polished" approach — technical foundation + 2 bilingual seed articles + measurement loop

## Goal
Implement the technical and content foundations needed to be cited by AI search engines (ChatGPT, Perplexity, Google AI Overviews/AI Mode, Claude, Bing Copilot) for queries about Italian B2B chatbots, while preserving existing SEO and bilingual (EN/IT) parity.

## Out of scope (explicit YAGNI)
- DB-driven CMS / admin authoring UI
- Programmatic per-vertical/per-city SEO pages
- Brand mention campaigns (Reddit, LinkedIn posts)
- Niuexa-style brand visibility SaaS layer
- Translation of existing homepage (already bilingual)
- llms.txt (research showed no consumption-side adoption)

## Architecture

### URL structure
- Blog index: `/blog` (EN) and `/it/blog` (IT)
- Articles: `/blog/<slug>` and `/it/blog/<slug>` — language-specific slugs
- Hreflang via frontmatter `hreflangSlug` field, not URL parallelism

### File layout
```
content/
  posts/
    en/<slug>.mdx
    it/<slug>.mdx
  authors/
    gregor-maric.json
src/
  components/
    seo/
      JsonLd.tsx              (existing)
      ArticleSchema.tsx       (new)
      BreadcrumbSchema.tsx    (new)
      PersonSchema.tsx        (new)
    blog/
      ArticleLayout.tsx       (new)
      ArticleHeader.tsx       (new)
      TableOfContents.tsx     (new)
      LastUpdated.tsx         (new)
      mdx/
        Stat.tsx
        Quote.tsx
        SourceCite.tsx
        Definition.tsx
        ProsCons.tsx
        index.tsx             (mdx components map)
  lib/
    posts.ts                  (MDX loader, Zod validation)
  app/
    [locale]/
      blog/
        page.tsx              (blog index)
        [slug]/
          page.tsx            (article)
          opengraph-image.tsx (per-article OG)
      about/
        gregor-maric/
          page.tsx            (author page)
    robots.ts                 (rewrite per-bot)
    sitemap.ts                (rewrite dynamic)
scripts/
  lint-articles.ts            (build-time content lint)
  indexnow-ping.ts            (post-deploy URL submission)
  analyze-crawler-logs.ts     (AI bot baseline)
docs/
  aeo-baselines/              (server-log snapshots)
  bing-webmaster-setup.md     (manual setup doc)
```

### MDX frontmatter contract (Zod-validated)
```yaml
title: string
description: string  (140-160 chars)
slug: string
locale: "en" | "it"
hreflangSlug: string
type: "listicle" | "how-to" | "comparison" | "qa"
publishedAt: ISO date
updatedAt: ISO date
author: string  (references content/authors/<id>.json)
tags: string[]
heroImage: string | null
```

### Build-time content lint (`scripts/lint-articles.ts`)
Runs before `next build`. Fails build if:
- Description not 140-160 chars
- Article missing ≥1 `<Stat>`, ≥1 `<Quote source="">`, ≥3 `<SourceCite>`
- First paragraph >60 words
- No H2 within first 300 words
- `hreflangSlug` doesn't resolve to a real file

## Schema strategy
- **Homepage**: keep Org/WebSite/SoftwareApplication/FAQ; **remove HowTo** (deprecated 2025)
- **Blog index**: `CollectionPage` + `BreadcrumbList`
- **Article**: `BlogPosting` + `BreadcrumbList` + `Person` (author) + nested `Organization` (publisher); `ItemList` for listicles; nested `FAQPage` if Q&A section present
- **Author page**: `Person` with sameAs links

## Per-bot robots.ts
Allow citation crawlers (drive AI search citations):
- OAI-SearchBot, ChatGPT-User
- PerplexityBot, Perplexity-User
- ClaudeBot, Claude-SearchBot, Claude-User
- Bingbot, Googlebot, Applebot

Block training crawlers (no SEO loss):
- GPTBot, Google-Extended, Applebot-Extended
- CCBot, Bytespider, Meta-ExternalAgent, Amazonbot

All bots disallow: `/dashboard`, `/admin`, `/api`, `/c/*`, `/privacy`, `/terms`

## Dynamic sitemap.ts
- Reads MDX files at `content/posts/<locale>/*.mdx`
- Extracts real `updatedAt` from frontmatter
- Pairs locales via `hreflangSlug` for `alternates.languages`
- Includes blog index entries
- Priorities: home 1.0, blog index 0.9, articles 0.8, docs 0.7, privacy/terms 0.3

## IndexNow integration
- `scripts/indexnow-ping.ts` runs as Render post-deploy hook
- POST sitemap URLs to `https://api.indexnow.org/indexnow`
- Key file served at `/<key>.txt`
- Env: `INDEXNOW_KEY`

## Bing Webmaster Tools
- Manual one-time setup, documented in `docs/bing-webmaster-setup.md`
- DNS TXT verification via Render
- Submit sitemap, enable AI Performance Report (Feb 2026 preview)

## Per-article OG images
- `app/[locale]/blog/[slug]/opengraph-image.tsx` using `next/og` `ImageResponse`
- 1200×630, brand colors, article title + author + logo
- `revalidate = 3600`

## Server-log AI crawler observability
- `scripts/analyze-crawler-logs.ts` — local CLI script
- Pulls Render logs via `render` CLI (REST API fallback if MCP unavailable)
- Tallies: GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot, Googlebot, Bingbot, Google-Extended, Applebot-Extended, Bytespider
- Output: markdown report in `docs/aeo-baselines/YYYY-MM-DD.md`

## Custom MDX components (citation magnets, Princeton GEO winners)
- `<Stat value source href>` — big-number callout (Statistics +33%)
- `<Quote author source href>` — semantic blockquote (Quotation +41%)
- `<SourceCite href>` — inline citation marker (Citing Sources +28%)
- `<Definition term>` — extractable definition block
- `<ProsCons pros cons>` — comparison sections
- `<LastUpdated date>` — date badge
- `<TableOfContents>` — auto from H2/H3

## Seed article 1: Listicle (commercial intent)
- EN: `/blog/best-italian-chatbot-platforms-2026`
- IT: `/it/blog/migliori-chatbot-ai-pmi-italiane-2026`
- 6-8 platforms ranked, comparison table, buying-criteria FAQ
- 2,500-3,500 words

## Seed article 2: How-to (educational)
- EN: `/blog/how-to-train-ai-chatbot-business-data`
- IT: `/it/blog/come-addestrare-chatbot-ai-dati-aziendali`
- 5 steps, common failure modes, tools mentioned
- 2,000-2,800 words

## Verification
- Build: `npx tsc --noEmit`, article lint passes, sitemap renders all URLs
- Post-deploy: per-bot robots.txt visible, sitemap accepted by Bing, Rich Results Test passes on each article URL, first crawler-log baseline captured

## Risk / open items
- Render MCP tools disconnected this session — server-log analyzer falls back to `render` CLI or curl REST API
- "just build" mode: skipping writing-plans skill per user instruction
