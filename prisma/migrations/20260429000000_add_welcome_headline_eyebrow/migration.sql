-- Add configurable hero text (eyebrow + headline) to widget greeting
ALTER TABLE "chatbots"
  ADD COLUMN "welcomeEyebrow" TEXT DEFAULT 'Knowledge assistant',
  ADD COLUMN "welcomeHeadline" TEXT DEFAULT 'Hi — what would you like to *know*?';
