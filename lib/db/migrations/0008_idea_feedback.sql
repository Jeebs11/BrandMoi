CREATE TABLE IF NOT EXISTS "idea_feedback" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "idea_text" text NOT NULL,
  "idea_type" text NOT NULL DEFAULT 'brand',
  "signal" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
