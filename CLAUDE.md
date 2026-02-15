# ChatNiuexa Project

## Render Deployment
- **Service Name**: chatniuexa
- **Service ID**: srv-d5t62ishg0os73a32fm0
- **Dashboard**: https://dashboard.render.com/web/srv-d5t62ishg0os73a32fm0
- **Environment Variables**: https://dashboard.render.com/web/srv-d5t62ishg0os73a32fm0/env
- **Live URL**: https://chatniuexa.onrender.com
- **Region**: Frankfurt
- **Runtime**: Node.js (Next.js 16.1.4)
- **Auto-deploy**: Enabled on master branch

## Tech Stack
- Next.js with App Router
- Firecrawl for web page crawling
- NextAuth for authentication

## OpenAI API Rules
- **ALWAYS** use `max_completion_tokens` instead of `max_tokens` — the latter is deprecated and fails on newer models (gpt-5-mini, o-series, etc.)
- Use Context7 (`/websites/platform_openai`) to verify API parameters before writing OpenAI calls
