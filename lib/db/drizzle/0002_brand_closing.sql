ALTER TABLE "preferences"
ADD COLUMN IF NOT EXISTS "brand_closing_mode" text NOT NULL DEFAULT 'never';

ALTER TABLE "preferences"
ADD COLUMN IF NOT EXISTS "brand_closing_style" text NOT NULL DEFAULT 'expert';

ALTER TABLE "preferences"
ADD COLUMN IF NOT EXISTS "brand_closing_text" text NOT NULL DEFAULT '';