ALTER TABLE "ShopSettings" ALTER COLUMN "isReview" SET DEFAULT true;
UPDATE "ShopSettings" SET "isReview" = true;
