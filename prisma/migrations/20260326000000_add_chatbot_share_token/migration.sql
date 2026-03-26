-- AlterTable
ALTER TABLE "chatbots" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "chatbots_shareToken_key" ON "chatbots"("shareToken");
