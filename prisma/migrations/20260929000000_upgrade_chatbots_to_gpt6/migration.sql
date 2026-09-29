-- New chatbots default to GPT-6 Luna.
ALTER TABLE "chatbots" ALTER COLUMN "model" SET DEFAULT 'gpt-6-luna';

-- Move every existing bot to GPT-6, keeping its tier: bots on a previous
-- flagship (gpt-5.4, gpt-5.2, gpt-4o) move to GPT-6 Sol; every other bot
-- (previous defaults, mini/nano models, and gpt-5-mini/gpt-5-nano, which
-- OpenAI shuts down on 2026-12-11) moves to GPT-6 Luna.
UPDATE "chatbots" SET "model" = 'gpt-6-sol'
WHERE "model" IN ('gpt-5.4', 'gpt-5.2', 'gpt-4o');

UPDATE "chatbots" SET "model" = 'gpt-6-luna'
WHERE "model" NOT IN ('gpt-6-luna', 'gpt-6-sol');
