ALTER TABLE "drafts" ADD COLUMN "is_voice_sample" boolean NOT NULL DEFAULT false;
ALTER TABLE "preferences" ADD COLUMN "writing_samples" jsonb;
