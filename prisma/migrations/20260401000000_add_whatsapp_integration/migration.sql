-- AlterTable: Add channel to conversations
ALTER TABLE "conversations" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'web';

-- CreateTable: WhatsApp integration configs
CREATE TABLE "whatsapp_configs" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "whatsappBusinessAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "webhookVerifyToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_configs_chatbotId_key" ON "whatsapp_configs"("chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_configs_phoneNumberId_key" ON "whatsapp_configs"("phoneNumberId");

-- CreateIndex
CREATE INDEX "whatsapp_configs_phoneNumberId_idx" ON "whatsapp_configs"("phoneNumberId");

-- AddForeignKey
ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
