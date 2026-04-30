# Bing Webmaster Tools — One-time Setup

Bing's index feeds **both ChatGPT Search and Microsoft Copilot**, making it the
highest-leverage / lowest-effort discoverability surface in 2026. This is a
one-time setup that takes ~15 minutes.

## 1. Verify the domain

1. Go to https://www.bing.com/webmasters and sign in with a Microsoft account.
2. Add `https://chataziendale.it`.
3. Choose **DNS verification** (most reliable for Render-hosted domains).
4. Bing gives you a TXT record value like `verify.bing.com=AAAA…`.
5. Add the TXT record at your DNS provider (Cloudflare, OVH, etc.) on the apex.
6. Click **Verify** in Bing — propagation usually takes 5-10 minutes.

The verification token can also be set as an env var if you ever need to redo
this without DNS changes — but DNS is cleaner.

## 2. Submit the sitemap

In Bing Webmaster → **Sitemaps** → **Submit sitemap**:

    https://chataziendale.it/sitemap.xml

Bing should accept it within a few minutes and start crawling.

## 3. Enable IndexNow

Already wired up in the codebase:

- The verification endpoint is served at `/indexnow-verification` and reads
  the key from `process.env.INDEXNOW_KEY`.
- Generate a key (any 8–128 character hex string):

      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

- Set `INDEXNOW_KEY` in Render env vars:
  https://dashboard.render.com/web/srv-d5t62ishg0os73a32fm0/env
- After deploy, verify it's served:

      curl https://chataziendale.it/indexnow-verification

  Should return the key as plain text.

- Run a manual ping after the first deploy with articles:

      INDEXNOW_KEY=… npm run aeo:ping

  Expected output: `[indexnow] OK (HTTP 200)` (or HTTP 202).

## 4. Enable AI Performance Report (public preview, Feb 2026)

Once verified, Bing's AI Performance Report shows up under **Reports & Data**.
This is the first first-party AI citation tracking from a major vendor — it
shows which of your URLs are being cited in **Bing Copilot** and **ChatGPT
Search** answers, with query-level breakdowns.

- It takes Bing 7–14 days to populate the report after verification.
- Check it weekly for the first month, then monthly.

## 5. Crawler-control settings

Under **Configure My Site → Crawl Control**, leave Bing on the default
schedule. Bingbot is allow-listed in our `robots.txt` already.

## 6. Watching the data

After 30 days, expect to see:

- Sitemap status: **Indexed** for the homepage, `/blog`, both seed articles
  in EN + IT, and `/about/gregor-maric`.
- Some **search performance** rows for branded queries (low volume but
  trustworthy).
- AI Performance: a handful of impressions if ChatGPT Search or Copilot has
  surfaced any URL. If zero after 60 days, audit the article for citation
  patterns (statistics, quotations, source citations) — those are the
  Princeton GEO winners and they're load-bearing for AI surfaces.

## 7. Things to NOT do

- **Do not block Bingbot in robots.txt.** Doing so removes you from ChatGPT
  Search and Copilot simultaneously.
- **Do not submit the IndexNow key in URL form** to a non-Bing endpoint —
  it's a public string but it's tied to this domain.
- **Do not submit malformed sitemaps.** The build step generates a valid one;
  manual edits to `src/app/sitemap.ts` should be tested with a fetch of
  `https://chataziendale.it/sitemap.xml` after deploy.
