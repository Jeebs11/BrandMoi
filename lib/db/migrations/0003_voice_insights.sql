-- Migration: Voice insights + post diagnosis
-- Task #28 - Brand voice insight suggestions + post diagnosis
-- Run: cd lib/db && pnpm run push-force  (Drizzle push-based project)

-- voice_suggestions table
CREATE TABLE IF NOT EXISTS "voice_suggestions" (
  "id"                  serial PRIMARY KEY,
  "user_id"             integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "field"               text NOT NULL,
  "current_value"       text NOT NULL DEFAULT '',
  "suggested_value"     text NOT NULL,
  "rationale"           text NOT NULL,
  "evidence_draft_ids"  jsonb NOT NULL DEFAULT '[]',
  "evidence_snippets"   jsonb NOT NULL DEFAULT '[]',
  "status"              text NOT NULL DEFAULT 'pending',
  "created_at"          timestamptz NOT NULL DEFAULT now()
);

-- drafts: add diagnosis JSONB column
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "diagnosis" jsonb;
