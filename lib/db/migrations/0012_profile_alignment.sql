CREATE TABLE IF NOT EXISTS "profile_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"cv_facts" jsonb,
	"linkedin_facts" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profile_snapshots_user_id_unique" UNIQUE("user_id")
);
ALTER TABLE "profile_snapshots" ADD CONSTRAINT "profile_snapshots_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;

CREATE TABLE IF NOT EXISTS "profile_analyses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"snapshot_id" integer NOT NULL,
	"comparison_table" jsonb NOT NULL,
	"recommendations" jsonb NOT NULL,
	"target_audience" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
ALTER TABLE "profile_analyses" ADD CONSTRAINT "profile_analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
ALTER TABLE "profile_analyses" ADD CONSTRAINT "profile_analyses_snapshot_id_profile_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "profile_snapshots"("id") ON DELETE cascade;
