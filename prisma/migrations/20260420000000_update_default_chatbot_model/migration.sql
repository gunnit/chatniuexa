-- Update default chatbot model to latest recommended (gpt-5.4-mini)
ALTER TABLE "Chatbot" ALTER COLUMN "model" SET DEFAULT 'gpt-5.4-mini';
