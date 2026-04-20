# ChatAziendale Project

## WSL Development Rules (CRITICAL — READ FIRST)
This project runs on WSL with code on `/mnt/c/`. The Windows ↔ Linux filesystem bridge is **extremely unreliable**. Follow these rules strictly to avoid wasting time:

### Verification Strategy
1. **Use `npx tsc --noEmit`** to verify code changes — this is fast and reliable
2. **Do NOT repeatedly try `npm run dev`** — if it fails once due to WSL I/O, STOP. Do not retry more than once.
3. **Never spend more than 2 attempts** starting a dev server. If it doesn't work, tell the user to run it from their Windows/PowerShell terminal instead

### Local Testing Policy
- **Skip local dev server testing by default.** Code verification via TypeScript is sufficient.
- If the user explicitly asks to test locally, try ONCE. If WSL I/O errors occur (`EIO`, `MODULE_NOT_FOUND`, `Input/output error`), stop immediately and say: *"WSL filesystem is unstable — please run `npm run dev` from your Windows terminal, or we can deploy to Render to test."*
- **Never run Playwright against pages with Spline/WebGL** — it causes timeouts and browser crashes

### File Operations
- Prefer `Edit` tool over `Write` tool for existing files (more reliable on WSL)
- For new files: write to `/tmp` first, then `cp` to project directory
- If a file operation gets an I/O error, wait 5 seconds and retry ONCE

### Deployment is the Real Test
- Auto-deploy is enabled on master branch push
- Push to GitHub → Render builds and deploys automatically
- Use the Render dashboard/logs for real verification, not local dev server

## Render Deployment
- **Service Name**: chataziendale
- **Service ID**: srv-d5t62ishg0os73a32fm0
- **Dashboard**: https://dashboard.render.com/web/srv-d5t62ishg0os73a32fm0
- **Environment Variables**: https://dashboard.render.com/web/srv-d5t62ishg0os73a32fm0/env
- **Live URL**: https://chataziendale.onrender.com
- **Region**: Frankfurt
- **Runtime**: Node.js (Next.js 16.1.4)
- **Auto-deploy**: Enabled on master branch

## Tech Stack
- Next.js with App Router
- Firecrawl for web page crawling
- NextAuth for authentication

## PayPal Sandbox Test Credentials
- **Email**: `sb-vambe47513762@personal.example.com`
- **Password**: `7pa7^P+z`

## WhatsApp Business Integration
- **Channel**: WhatsApp Cloud API via Meta Graph API v23.0
- **Webhook**: `/api/webhooks/whatsapp` (POST for messages, GET for Meta verification)
- **Config API**: `/api/chatbots/[id]/whatsapp` (GET/POST/DELETE)
- **Client library**: `src/lib/whatsapp.ts` (encrypt/decrypt tokens, send messages, verify signatures, parse webhooks)
- **Plan gating**: Pro & Business only (`whatsappEnabled` in `src/lib/plans.ts`)
- **Dashboard UI**: Channels tab in chatbot configure page
- **Token encryption**: AES-256-GCM using `WHATSAPP_ENCRYPTION_KEY` env var
- **Deduplication**: In-memory Set with 60s TTL (single-instance on Render)
- **Meta App**: ChatAziendale (App ID: `4002982473334995`)
- **System User**: ChatAziendale Bot (ID: `61575462517277`, Admin, never-expiring token)
- **Business Portfolio**: Superhero 3D (ID: `168156420927238`)
- **WABA ID**: `1228439879318553`
- **Test Phone Number ID**: `1081999561663965` (Meta sandbox: +1 555 151 3149)
- **App Mode**: Development (5 test recipients max). Going Live requires: business verification, app review, real phone number, privacy policy, payment method

### Env vars (set on Render):
- `META_APP_SECRET` — webhook signature verification
- `WHATSAPP_ENCRYPTION_KEY` — 64-char hex for AES-256-GCM token encryption
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — env-level fallback for initial Meta webhook setup

## OpenAI API Rules
- **ALWAYS** use `max_completion_tokens` instead of `max_tokens` — the latter is deprecated and fails on newer models (gpt-5-mini, o-series, etc.)
- Use Context7 (`/websites/platform_openai`) to verify API parameters before writing OpenAI calls
