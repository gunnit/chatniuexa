---
name: deploy
description: Type-check, commit, push to master, and monitor Render deployment for ChatAziendale
disable-model-invocation: true
---

# Deploy to Render

Deploys the ChatAziendale app by pushing to master (auto-deploy is enabled on Render).

## Workflow

1. **Pre-flight checks**:
   - Run `npx tsc --noEmit` to verify no TypeScript errors
   - Run `git status` to check for uncommitted changes
   - If there are uncommitted changes, ask the user for a commit message

2. **Commit & Push**:
   - Stage and commit any pending changes
   - Push to `master` branch on `origin`

3. **Monitor Deployment**:
   - Use the Render MCP to check deploy status for service `srv-d5t62ishg0os73a32fm0`
   - If Render MCP is not available, provide the dashboard link: https://dashboard.render.com/web/srv-d5t62ishg0os73a32fm0
   - Report deploy status (building / live / failed)

4. **On failure**:
   - Fetch Render deploy logs
   - Diagnose the build error
   - Suggest or apply a fix

## Important Notes
- Do NOT run `npm run dev` locally — WSL filesystem is unreliable
- The build command on Render is: `prisma generate && node scripts/pre-migrate.js && prisma migrate deploy && node scripts/setup-database.js && next build`
- Live URL: https://chataziendale.onrender.com
