-- Brand & personality knobs for realtime voice (preset-driven, compiled into instructions at mint)
ALTER TABLE "chatbots" ADD COLUMN "voiceGreeting" TEXT;
ALTER TABLE "chatbots" ADD COLUMN "voiceSpeakGreeting" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chatbots" ADD COLUMN "voiceTone" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "chatbots" ADD COLUMN "voiceLanguage" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "chatbots" ADD COLUMN "voiceSpeed" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
