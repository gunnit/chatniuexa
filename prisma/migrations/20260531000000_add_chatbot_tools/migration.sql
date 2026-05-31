-- AlterTable: web search tool flag on chatbots
ALTER TABLE "chatbots" ADD COLUMN "webSearchEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: remote MCP servers attached to a chatbot
CREATE TABLE "chatbot_mcp_servers" (
    "id" TEXT NOT NULL,
    "chatbotId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "serverUrl" TEXT NOT NULL,
    "description" TEXT,
    "authToken" TEXT,
    "allowedTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chatbot_mcp_servers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chatbot_mcp_servers_chatbotId_idx" ON "chatbot_mcp_servers"("chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "chatbot_mcp_servers_chatbotId_label_key" ON "chatbot_mcp_servers"("chatbotId", "label");

-- AddForeignKey
ALTER TABLE "chatbot_mcp_servers" ADD CONSTRAINT "chatbot_mcp_servers_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "chatbots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
