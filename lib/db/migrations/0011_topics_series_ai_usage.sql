-- Topics table
CREATE TABLE IF NOT EXISTS "topics" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "color" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Series table
CREATE TABLE IF NOT EXISTS "series" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "theme" text NOT NULL,
  "topic_id" integer REFERENCES "topics"("id") ON DELETE set null,
  "target_audience" text,
  "format" text NOT NULL DEFAULT 'standard',
  "planned_parts" integer,
  "status" text NOT NULL DEFAULT 'planning',
  "hook" text,
  "planned_angles" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- AI usage table
CREATE TABLE IF NOT EXISTS "ai_usage" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "date" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  CONSTRAINT "ai_usage_user_kind_date" UNIQUE ("user_id", "kind", "date")
);

-- New columns on drafts
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "topic_id" integer REFERENCES "topics"("id") ON DELETE set null;
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "series_id" integer REFERENCES "series"("id") ON DELETE set null;
ALTER TABLE "drafts" ADD COLUMN IF NOT EXISTS "series_part" integer;
