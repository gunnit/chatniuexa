-- Realtime voice (Business) — chatbot config
ALTER TABLE "chatbots" ADD COLUMN "voiceEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chatbots" ADD COLUMN "voiceName" TEXT NOT NULL DEFAULT 'marin';

-- Voice metering on usage limits
ALTER TABLE "usage_limits" ADD COLUMN "monthlyVoiceMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usage_limits" ADD COLUMN "currentMonthVoiceSeconds" INTEGER NOT NULL DEFAULT 0;

-- Voice session ledger
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "secondsUsed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "voice_sessions_chatbotId_idx" ON "voice_sessions"("chatbotId");
CREATE INDEX "voice_sessions_createdAt_idx" ON "voice_sessions"("createdAt");
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_chatbotId_fkey"
    FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Leads
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "voiceSessionId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "note" TEXT,
    "source" TEXT NOT NULL DEFAULT 'voice',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "leads_chatbotId_idx" ON "leads"("chatbotId");
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt");
ALTER TABLE "leads" ADD CONSTRAINT "leads_chatbotId_fkey"
    FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leads" ADD CONSTRAINT "leads_voiceSessionId_fkey"
    FOREIGN KEY ("voiceSessionId") REFERENCES "voice_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
