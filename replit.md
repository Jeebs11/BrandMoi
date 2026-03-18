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
- Bottom navigation (Home, Capture, Library)
- Auth guards: unauthenticated → /login, not onboarded → /onboarding

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
│           │   └── BottomNav.tsx   # Bottom navigation (Home/Capture/Library)
│           ├── pages/
│           │   ├── Login.tsx
│           │   ├── Signup.tsx
│           │   ├── Onboarding.tsx  # 5-step brand voice onboarding
│           │   ├── Dashboard.tsx   # Home: CTA + suggestions + recent work
│           │   ├── Capture.tsx     # 6-step content creation workflow
│           │   ├── Library.tsx     # Draft list with filters + management
│           │   └── Settings.tsx    # Preferences + brand voice + logout
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
| POST | /api/drafts | Yes | Create draft |
| GET | /api/drafts/:id | Yes | Get single draft |
| PATCH | /api/drafts/:id | Yes | Update draft |
| DELETE | /api/drafts/:id | Yes | Delete draft |

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
