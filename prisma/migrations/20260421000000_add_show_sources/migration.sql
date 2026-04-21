-- Add showSources flag to Chatbot
ALTER TABLE "chatbots" ADD COLUMN "showSources" BOOLEAN NOT NULL DEFAULT true;
