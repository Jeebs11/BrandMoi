CREATE TABLE IF NOT EXISTS "stress_test_scores" (
  "id" serial PRIMARY KEY NOT NULL,
  "draft_id" integer REFERENCES "drafts"("id") ON DELETE CASCADE,
  "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  "overall_score" integer NOT NULL,
  "factor_scores" jsonb NOT NULL,
  "fixes_applied" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
