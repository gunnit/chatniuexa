-- Clickable follow-up questions after each answer (off by default; ICCS turns it on via scripts/update-iccs-prompt.ts)
ALTER TABLE "chatbots" ADD COLUMN "followUpSuggestions" BOOLEAN NOT NULL DEFAULT false;
