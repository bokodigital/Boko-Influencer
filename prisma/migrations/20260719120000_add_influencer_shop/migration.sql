ALTER TABLE "Influencer" ADD COLUMN "shop" TEXT;
UPDATE "Influencer" SET "shop" = 'boko-reco-test-store.myshopify.com' WHERE "referralCode" = 'TEST10';
UPDATE "Influencer" SET "shop" = 'boko-development.myshopify.com' WHERE "referralCode" = 'BOKOTESTING12';
UPDATE "Influencer" SET "shop" = 'boko-reco-test-store.myshopify.com' WHERE "referralCode" = 'BOKO';
UPDATE "Influencer" SET "shop" = 'boko-development.myshopify.com' WHERE "referralCode" = 'RONAK10';
