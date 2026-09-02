import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const preferencesTable = pgTable("preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique().references(() => usersTable.id, { onDelete: "cascade" }),
  objective: text("objective").notNull().default("Authority"),
  persona: text("persona").notNull().default("Founder"),
  tone: text("tone").notNull().default("Direct"),
  brandRole: text("brand_role").notNull().default(""),
  brandAudience: text("brand_audience").notNull().default(""),
  brandBelief: text("brand_belief").notNull().default(""),
  aboutMe: text("about_me").default(""),
  onboarded: boolean("onboarded").notNull().default(false),
  brandVoiceSummary: text("brand_voice_summary"),
  voiceSummaryDraftCount: integer("voice_summary_draft_count").notNull().default(0),
  brandBgColor: text("brand_bg_color").notNull().default("#0f172a"),
  brandAccentColor: text("brand_accent_color").notNull().default("#6366f1"),
  brandTextColor: text("brand_text_color").notNull().default("#ffffff"),
  backgroundTheme: text("background_theme").default("none"),
  bgCustomImageUrl: text("bg_custom_image_url"),
  bgSpeed: text("bg_speed").default("normal"),
  bgDensity: text("bg_density").default("normal"),
  bgPanelOpacity: text("bg_panel_opacity").default("solid"),
  siteTheme: text("site_theme").default("indigo"),
  bgPalette: text("bg_palette").default("ocean"),
  contentPillars: jsonb("content_pillars").$type<string[]>(),
  writingSamples: jsonb("writing_samples").$type<string[]>(),
  // Quantified career achievements (number + context + outcome) extracted
  // from imported documents — injected into generation as specificity anchors.
  proofPoints: jsonb("proof_points").$type<string[]>(),
  // Posts (anyone's) whose STYLE the user wants to lean toward — rhythm and
  // language patterns only, never topics or claims.
  aspirationalSamples: jsonb("aspirational_samples").$type<string[]>(),
  // A deterministic, user-controlled closing appended to the main LinkedIn
  // post before hashtags. Existing users default to never until they opt in.
  brandClosingMode: text("brand_closing_mode").notNull().default("never"),
  brandClosingStyle: text("brand_closing_style").notNull().default("expert"),
  brandClosingText: text("brand_closing_text").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPreferencesSchema = createInsertSchema(preferencesTable).omit({
  id: true,
  updatedAt: true,
});

export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type Preferences = typeof preferencesTable.$inferSelect;
