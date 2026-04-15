-- Migration: Add LinkedIn connections support
-- Task #27 - LinkedIn OAuth + post analytics sync
-- Run: cd lib/db && pnpm run push-force  (Drizzle push-based project)

-- linkedin_connections table (timestamptz to match Drizzle withTimezone: true)
CREATE TABLE IF NOT EXISTS "linkedin_connections" (
  "id"              serial PRIMARY KEY,
  "user_id"         integer NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "access_token"    text NOT NULL,
  "token_expiry"    timestamptz,
  "member_urn"      text NOT NULL,
  "display_name"    text,
  "last_synced_at"  timestamptz,
  "created_at"      timestamptz DEFAULT now() NOT NULL
);

-- drafts: add external_id for deduplication of imported LinkedIn posts
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "external_id" text;

-- drafts: add post_type to distinguish LinkedIn posts vs articles
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "post_type" text;

-- Index to speed up deduplication queries during sync
CREATE INDEX IF NOT EXISTS "drafts_external_id_idx" ON "drafts" ("external_id");

-- performance_signals: add reposts for LinkedIn reshare counts
ALTER TABLE "performance_signals" ADD COLUMN IF NOT EXISTS "reposts" integer NOT NULL DEFAULT 0;
