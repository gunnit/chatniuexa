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

## OpenAI API Rules
- **ALWAYS** use `max_completion_tokens` instead of `max_tokens` — the latter is deprecated and fails on newer models (gpt-5-mini, o-series, etc.)
- Use Context7 (`/websites/platform_openai`) to verify API parameters before writing OpenAI calls
