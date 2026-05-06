-- AlterTable
ALTER TABLE "chatbots" ADD COLUMN "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
