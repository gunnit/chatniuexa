---
name: db-migrate
description: Create and validate Prisma database migrations for ChatAziendale
disable-model-invocation: true
---

# Database Migration

Create, validate, and deploy Prisma migrations for the ChatAziendale PostgreSQL database.

## Arguments
- `name` (required): Migration name in snake_case (e.g., `add_user_preferences`)

## Workflow

1. **Validate schema changes**:
   - Read `prisma/schema.prisma` to understand current schema
   - Run `npx prisma validate` to check schema syntax
   - Run `npx prisma format` to auto-format the schema

2. **Create migration**:
   - Run `npx prisma migrate dev --name <name>` to generate migration SQL
   - Read the generated SQL in `prisma/migrations/` to verify it's correct

3. **Safety checks**:
   - Warn if migration contains `DROP TABLE` or `DROP COLUMN`
   - Warn if migration modifies columns with existing data (potential data loss)
   - Verify migration is compatible with the build pipeline (`prisma migrate deploy` runs in production)

4. **Generate client**:
   - Run `npx prisma generate` to update the Prisma client types

## Build Pipeline Reminder
The Render build runs these steps in order:
1. `prisma generate`
2. `node scripts/pre-migrate.js`
3. `prisma migrate deploy`
4. `node scripts/setup-database.js`
5. `next build`

Ensure any new migration works with this pipeline. If the migration needs seed data, update `scripts/setup-database.js`.

## Important
- Never run `prisma migrate reset` without explicit user confirmation — it drops all data
- The production database is on Render PostgreSQL
- Always commit migration files to git so they deploy with the next push
