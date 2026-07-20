ALTER TYPE "PayoutMethod" ADD VALUE IF NOT EXISTS 'stripe';
ALTER TABLE "Influencer" ADD COLUMN "stripeAccountId" TEXT;
