# Overview

Brand OS is a mobile-first web application designed to empower users with AI-powered LinkedIn content creation. It provides a comprehensive platform for generating, refining, and managing professional content, along with advanced analytics and an agentic intelligence layer for personalized assistance.

The project aims to simplify LinkedIn content creation, enhance user engagement through data-driven insights, and offer a highly personalized experience. Key capabilities include a 6-step content capture workflow, smart document import for brand voice extraction, AI image generation, and a "Momentum Engine" for tracking content performance and providing strategic suggestions. The application is built as a pnpm workspace monorepo using TypeScript, React, Express, PostgreSQL, and Drizzle ORM.

# User Preferences

I want iterative development. I prefer detailed explanations. Ask before making major changes.

# System Architecture

## Core Technologies & Design Patterns
The project utilizes a pnpm workspace monorepo structure with TypeScript 5.9. The backend is an Express 5 API server, while the frontend is built with React, Vite, TailwindCSS, and shadcn/ui, specifically targeting a mobile-first design (max-width 430px). Data persistence is managed by PostgreSQL with Drizzle ORM. Zod is used for validation, and Orval handles API codegen from an OpenAPI specification. Authentication is implemented using bcryptjs for password hashing and JWTs stored in httpOnly cookies.

## Key Features & Implementations

### Content Creation Workflow
A core 6-step workflow (Capture → Context → Structure → Create → Refine → Save) guides users through AI-assisted content generation. Anthropic Claude (claude-sonnet-4-6) is used for structured idea breakdown and content generation.

### User Management & Onboarding
Features email/password authentication, a 5-screen onboarding process (Objective, Persona, Tone, Brand Voice, Confirm), and a user dashboard.

### Content Management & Library
Users can manage drafts with filtering capabilities. A "Log Performance" feature allows tracking content engagement (Impressions, Reactions, Comments) to calculate a Resonance Score.

### AI-Powered Enhancements
- **Smart Document Import**: A reusable component (`SmartImportButton`) allows users to upload PDF/DOCX/TXT files for backend extraction of brand voice parameters using Claude.
- **AI Image Generation**: Integration with DALL-E 3 for generating images based on visual brief descriptions, with inline previews and save options.
- **Agentic Intelligence Layer**:
    - **Brand Voice DNA**: Extracts voice signals from drafts via Claude to personalize future AI prompts.
    - **Angle Freshness Guard**: Checks for topic/angle overlap with past drafts and suggests alternatives.
    - **Thought Vault**: A system for capturing and developing raw ideas.
    - **Voice Evolution Timeline**: Generates a Claude-based voice profile from accumulated signals.

### Analytics & Performance Tracking
- **Momentum Engine**: Calculates a "Momentum Score" based on recency, variety, volume, and resonance, displayed on the dashboard.
- **Cadence Intelligence**: Provides alerts for inactivity or lack of content for specific objectives.
- **Analytics Page**: Displays various metrics including:
  - Total published posts, average resonance, trends by tone, content source, visual type, and top-performing posts
  - **30/60/90-day time window toggle** — all metrics respect the selected window
  - **KPI trend arrows** (↑ ↓ →) comparing current vs prior equivalent period for Published, Avg Resonance, and Engagement Rate
  - **Best time to post** — ranks days of week and time-of-day blocks (Morning/Midday/Afternoon/Evening) by average resonance with a highlighted recommendation callout
  - **Posting consistency** — avg days between consecutive published posts with a trend indicator
  - **Hashtag performance** — top 10 hashtags from `postOutput` ranked by average resonance with usage counts
  - **LinkedIn content format breakdown** — groups posts by `mediaFormat` (NONE/IMAGE/VIDEO/DOCUMENT/ARTICLE) from LinkedIn's `shareMediaCategory`
  - **Engagement rate** — shown as reactions+comments÷impressions where impressions > 0, with trend direction
- **LinkedIn Sync**: During import, maps `shareMediaCategory` to the `mediaFormat` field on the draft for richer format analytics

### UI/UX
The frontend is mobile-first, utilizing TailwindCSS and shadcn/ui for a consistent design. Bottom navigation (Home, Capture, Vault, Library) and a dashboard provide intuitive access to features. Export options include Carousel PDF export (using `html-to-image` + `jspdf`) and Visual card PNG downloads.

### System Robustness
Includes rate limiting on AI endpoints, React `ErrorBoundary` for app-wide error handling, and dedicated 404/error pages.

# Deployment Architecture

## Single-Process Model
The production deployment uses a single Express process (api-server) that serves **both** the React frontend (as static files) and the API. This is required for Replit Autoscale (`router = "application"`) which bundles ONE container from the primary artifact.

- **api-server** is the primary artifact at `"/"` (`kind = "api"`) — Replit bundles it as a server container with a run command
- **brand-os** is a dev-only artifact at `"/brand-os"` — runs the Vite dev server for local development

## Dev vs Production Routing
| Mode | `/` requests | `/api/*` requests |
|------|-------------|------------------|
| **Dev** | Proxied from api-server Express → brand-os Vite at `:18565` | Handled by Express |
| **Production** | Express serves static files from `artifacts/brand-os/dist/public` | Handled by Express |

## Production Build Command
```
sh -c "pnpm --filter @workspace/brand-os run build && pnpm --filter @workspace/api-server run build"
```
Brand-os builds first (outputs to `artifacts/brand-os/dist/public`), then api-server bundles both into `dist/index.cjs`.

## Production Run Command
```
node artifacts/api-server/dist/index.cjs
```

# External Dependencies

- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **AI Models**:
    - Anthropic Claude (claude-sonnet-4-6) for content generation and voice analysis
    - OpenAI DALL-E 3 for image generation
- **Authentication**: bcryptjs (for password hashing), JWT (for tokens)
- **Validation**: Zod, `drizzle-zod`
- **API Codegen**: Orval
- **PDF/DOCX Parsing**: `pdf-parse`, `mammoth` (backend for document import)
- **Image Manipulation**: `html-to-image`, `jspdf` (frontend for carousel PDF export)
- **OpenAI API Client**: `openai` (Node.js library for DALL-E 3 integration)