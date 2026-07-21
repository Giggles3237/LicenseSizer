ALTER TABLE "dealer_profiles" ALTER COLUMN "back_mode" SET DEFAULT 'optional';
UPDATE "dealer_profiles" SET "back_mode" = 'optional' WHERE "back_mode" = 'required';
