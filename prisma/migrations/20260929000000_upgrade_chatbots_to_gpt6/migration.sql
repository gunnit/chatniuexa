-- New chatbots default to GPT-6 Luna.
ALTER TABLE "chatbots" ALTER COLUMN "model" SET DEFAULT 'gpt-6-luna';

-- Move existing bots with it: bots on a previous platform default (gpt-4o-mini,
-- gpt-5-mini, gpt-5.4-mini) and bots on models OpenAI shuts down on 2026-12-11
-- (gpt-5-mini, gpt-5-nano), which would otherwise stop answering. Bots a tenant
-- pointed at a still-supported model (gpt-5.4, gpt-5.4-nano, gpt-5.2) keep it.
UPDATE "chatbots" SET "model" = 'gpt-6-luna'
WHERE "model" IN ('gpt-4o-mini', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5.4-mini');
