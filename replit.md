# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod, `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Auth**: bcryptjs + JWT in httpOnly cookies (cookie name: `brandos_token`)
- **AI**: Anthropic Claude (claude-sonnet-4-6 model)
- **Frontend framework**: React + Vite + TailwindCSS + shadcn/ui

## Project: Brand OS

A mobile-first web app (max-width 430px) for AI-powered LinkedIn content creation.

### Phases Completed

**Phase 1: Core 6-Step Capture Workflow** ✅
- 6-step flow: Capture → Context → Structure → Create → Refine → Save
- Claude AI structured idea breakdown + content generation (post, carousel, visual)
- 30-second AI timeout, skeleton loaders, hook selection required

**Phase 2: Auth, Onboarding, Dashboard & Library** ✅
- Email/password auth (bcrypt + JWT httpOnly cookies)
- Login, Signup pages with show/hide password toggle
- 5-screen onboarding (Objective → Persona → Tone → Brand Voice → Confirm)
- Dashboard with Capture CTA, Smart Suggestions, Recent Work
- Library with filter chips (objective + status), draft cards with "..." dropdown (Edit/Status/Delete)
- Settings page (preferences + brand voice + logout)
- Bottom navigation (Home, Capture, Vault, Library) — 4 items
- Auth guards: unauthenticated → /login, not onboarded → /onboarding

**Phase 5 (Task #5): Carousel PDF, Visual Card & AI Image Generation** ✅
- **Carousel PDF export**: "Download PDF" button in Carousel tab renders each slide (1080×1080, dark branded) off-screen with `html-to-image` + `jspdf`, assembles into a multi-page PDF named `{topic}-carousel.pdf`.
- **Visual card PNG**: "Download card" button in Visual tab renders a 1080×1080 branded indigo gradient card from the visual brief description and saves as a PNG.
- **AI image generation**: "Generate image" button in Visual tab calls `POST /api/ai/generate-image` → DALL-E 3 (1024×1024, b64_json). Image previews inline with a "Save image" overlay button. Returns 503 with clear message if `OPENAI_API_KEY` is not set.
- **Privacy note**: SmartImportButton now shows "Documents are not stored — text is extracted and immediately discarded" beneath the upload button.
- **New dependencies**: `html-to-image`, `jspdf` in brand-os frontend; `openai` in api-server.
- **New secret**: `OPENAI_API_KEY` required for image generation.

**Phase 5: Smart Document Import** ✅
- **SmartImportButton component**: Reusable component (`src/components/SmartImportButton.tsx`) with four states: idle (dashed upload button), loading (spinner + filename), preview (extracted field cards + Apply/Discard), error (message + retry link).
- **Backend extraction route**: `POST /api/user/extract-brand-voice` accepts multipart PDF/DOCX/TXT up to 5MB, extracts text with `pdf-parse`/`mammoth`, calls Claude to return structured `ExtractedBrandVoice` JSON (`brandRole`, `brandAudience`, `brandBelief`, `objective`, `persona`, `tone`, `summary`).
- **Onboarding step 4**: SmartImportButton appears above manual brand voice fields with an "or fill in manually" divider. Applying extracted data pre-fills all six voice fields.
- **Settings Brand Voice section**: Same SmartImportButton above the manual inputs. Applying shows a toast and pre-fills all fields for review before saving.

**Phase 4: Momentum Engine + Commercial Polish** ✅
- **Momentum Score**: Dashboard shows a tappable score card (0-100) with label (Strong/Building/Fading/Silent). Computed server-side from recency (30%), variety of objectives (25%), volume of posts (25%), resonance from performance data (20%). Tap to expand breakdown with per-component bars.
- **Cadence Intelligence**: Amber alert banners on dashboard when user hasn't created a draft in 5+ days or a specific objective has no content in 14+ days. Dismissable with X button.
- **Streak Counter**: Flame badge in dashboard header showing consecutive active days (only shown when streak ≥ 2). Tracked via `daily_activity` table upserted on each draft create.
- **Content Calendar Heatmap**: "Rhythm" toggle in Library header shows a GitHub-contribution-style 14-week grid coloured by draft count per day. `CalendarHeatmap` component.
- **Export**: On Capture step 6 (save confirmation), "Copy post" copies to clipboard and "Export .txt" downloads the post as a plain text file.
- **Production hardening**: Rate limiting on AI endpoints (10 req/min per user via in-memory map), React `ErrorBoundary` wrapping the full app, clean 404/error pages.

**Task #29: Analytics Page** ✅
- **DB schema**: Added `content_source` and `visual_type` columns to `drafts` table (both nullable text)
- **Content source tracking**: Captured at draft save time — "news_reaction", "teach_audience", "story_mode", "brand_voice_idea", or "capture" (inferred from URL params and workflow state)
- **Visual type tracking**: Tracked via `downloadedVisualTypeRef` in Capture — set to "card", "carousel", "infographic", or "art" when user downloads a visual; stored at save time
- **Analytics API**: `GET /api/analytics/overview` (authenticated) aggregates published drafts + performance signals; returns totalPublished, avgResonance, byTone (with resonance), byContentSource, byVisualType, byObjective, topPosts (top 5 by resonance), weeklyTrend (13-week publishing trend)
- **Analytics page**: `/analytics` with AppShell layout; overview stat cards, line chart (weekly trend), bar chart (by tone with resonance bars), horizontal bars (content source, visual format, objective), ranked top-5 list; empty state if no published posts
- **Conditional nav**: "Analytics" item shows in BottomNav and SideNav only when ≥1 published post exists; uses `useListDrafts` to check status

**Phase 3: Agentic Intelligence Layer** ✅
- **Brand Voice DNA**: Automatically extracts voice signals (sentence style, tone markers, vocabulary) from published/ready drafts via Claude. Signals stored in `brand_voice_signals` table and injected into future AI prompts for personalised output.
- **Angle Freshness Guard**: POST `/api/ai/check-angle` computes Jaccard similarity between new topic+angle and last 20 drafts. If >15% overlap, an amber warning banner shows in step 3 with 2 Claude-generated fresh angle alternatives the user can click to apply.
- **Thought Vault**: `/vault` page with quick-capture textarea, raw ideas list, "Develop" → pre-fills Capture, "Done" marks developed. Dashboard shows "Ripe for Developing" section for thoughts 2+ days old. `thoughts` table with `developed` flag.
- **Performance Signal Loop**: "Log Performance" in library dropdown for published drafts. Modal with Impressions/Reactions/Comments inputs + animated Resonance Score gauge. Data stored in `performance_signals` table. POST/GET `/api/drafts/:id/performance`.
- **Voice Evolution Timeline**: GET `/api/user/voice-summary` generates a Claude voice profile from accumulated signals. Cached in `preferences.brandVoiceSummary`, refreshed when 5+ new published posts since last update. Shown in Settings with Refresh button.

### Demo User
- Email: `demo@brandos.app`
- Password: `demo1234`
- Seeded with 2 example drafts, onboarded=true

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── auth.ts     # register/login/me/logout
│   │       │   ├── user.ts     # preferences + suggestions
│   │       │   ├── drafts.ts   # CRUD drafts (user-scoped)
│   │       │   └── ai.ts       # structure/generate/refine (requireAuth)
│   │       ├── middleware/
│   │       │   └── auth.ts     # requireAuth middleware (JWT cookie)
│   │       └── lib/
│   │           ├── jwt.ts      # signToken/verifyToken
│   │           └── seed.ts     # demo user + draft seeding
│   └── brand-os/           # React + Vite frontend
│       └── src/
│           ├── hooks/
│           │   └── use-auth.tsx    # AuthProvider + useAuth context
│           ├── components/
│           │   └── BottomNav.tsx   # Bottom navigation (Home/Capture/Vault/Library)
│           ├── pages/
│           │   ├── Login.tsx
│           │   ├── Signup.tsx
│           │   ├── Onboarding.tsx  # 5-step brand voice onboarding
│           │   ├── Dashboard.tsx   # Home: CTA + ripe thoughts + suggestions + recent work
│           │   ├── Capture.tsx     # 6-step workflow (angle check in step 3, vault pre-fill)
│           │   ├── Library.tsx     # Draft list with filters, management, Log Performance
│           │   ├── Settings.tsx    # Preferences + brand voice + voice DNA + logout
│           │   └── Vault.tsx       # Thought capture + list + develop flow
│           ├── lib/
│           │   └── api.ts          # Direct fetch helpers for Phase 3 endpoints
│           └── App.tsx             # Routing + AuthGuard + OnboardingGuard
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── users.ts        # users table
│           ├── preferences.ts  # preferences table (per-user)
│           └── drafts.ts       # drafts table (userId FK)
├── scripts/
└── pnpm-workspace.yaml
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`. This builds the full dependency graph.
- **`emitDeclarationOnly`** — only `.d.ts` files are emitted during typecheck.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in `references`.
- **After codegen** — run `pnpm --filter @workspace/api-client-react exec tsc -b` to rebuild declaration files.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build`
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Key API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login (sets httpOnly cookie) |
| GET | /api/auth/me | Yes | Current user |
| POST | /api/auth/logout | Yes | Clear cookie |
| GET | /api/user/preferences | Yes | Brand preferences |
| PUT | /api/user/preferences | Yes | Update preferences |
| GET | /api/user/suggestions | Yes | Content suggestions |
| POST | /api/ai/structure | Yes | Structure idea with Claude |
| POST | /api/ai/generate | Yes | Generate content with Claude |
| POST | /api/ai/refine | Yes | Refine content with Claude |
| GET | /api/drafts | Yes | List user's drafts |
| POST | /api/drafts | Yes | Create draft (triggers voice DNA extraction if ready/published) |
| GET | /api/drafts/:id | Yes | Get single draft |
| PATCH | /api/drafts/:id | Yes | Update draft (triggers voice DNA extraction if ready/published) |
| DELETE | /api/drafts/:id | Yes | Delete draft |
| POST | /api/drafts/:id/performance | Yes | Log performance signals (impressions/reactions/comments) |
| GET | /api/drafts/:id/performance | Yes | Get performance signals for a draft |
| POST | /api/ai/check-angle | Yes | Check if topic+angle is similar to past drafts (Jaccard) |
| GET | /api/user/voice-summary | Yes | Get/refresh Claude-generated voice profile |
| GET | /api/thoughts | Yes | List user's thoughts |
| POST | /api/thoughts | Yes | Create a thought |
| PATCH | /api/thoughts/:id | Yes | Update thought (mark developed) |
| DELETE | /api/thoughts/:id | Yes | Delete thought |

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes in `src/routes/`, JWT middleware in `src/middleware/auth.ts`.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — CORS (credentials), cookie-parser, JSON parsing, routes at `/api`
- `pnpm --filter @workspace/api-server run dev` — run the dev server

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Three tables: users, preferences, drafts.

- `src/schema/index.ts` — barrel re-export of all models
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Migrations: `pnpm --filter @workspace/db run push` (or `push-force` to reset)

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and Orval config. Run codegen:
`pnpm --filter @workspace/api-spec run codegen`

After codegen, rebuild declarations:
`pnpm --filter @workspace/api-client-react exec tsc -b`

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks. Key exports: `useGetMe`, `useGetPreferences`, `useGetSuggestions`, `useLogin`, `useRegister`, `useLogout`, `useUpdatePreferences`, `useStructureIdea`, `useGenerateContent`, `useRefineContent`, `useListDrafts`, `useGetDraft`, `useCreateDraft`, `useUpdateDraft`, `useDeleteDraft`.

Includes `credentials: "include"` in all fetch requests for cookie auth.
