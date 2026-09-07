ALTER TABLE "preferences" ADD COLUMN "last_seen_update_id" text;
UPDATE "preferences" SET "last_seen_update_id" = 'welcome-tour' WHERE "onboarded" = true;
