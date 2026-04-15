-- Migration: Add media_format to drafts for LinkedIn shareMediaCategory mapping
-- Task #31 - Analytics depth expansion

-- drafts: add media_format to track LinkedIn shareMediaCategory (NONE, IMAGE, VIDEO, DOCUMENT, ARTICLE)
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "media_format" text;
