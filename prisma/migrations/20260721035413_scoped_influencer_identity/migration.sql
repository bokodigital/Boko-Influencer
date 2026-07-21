DROP INDEX IF EXISTS "Influencer_email_key";
DROP INDEX IF EXISTS "Influencer_referralCode_key";
CREATE UNIQUE INDEX "Influencer_shop_email_key" ON "Influencer"("shop", "email");
CREATE UNIQUE INDEX "Influencer_shop_referralCode_key" ON "Influencer"("shop", "referralCode");
ALTER TABLE "ShopSettings" ADD COLUMN "portalCode" TEXT;
CREATE UNIQUE INDEX "ShopSettings_portalCode_key" ON "ShopSettings"("portalCode");
