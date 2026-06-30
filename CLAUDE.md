# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Dev server (Express + Vite HMR on a single port)
pnpm build        # Vite frontend build + esbuild server bundle → dist/
pnpm start        # Run production build
pnpm check        # TypeScript type check (no emit)
pnpm test         # Run all tests (vitest)
pnpm test -- --reporter=verbose server/some.test.ts  # Run a single test file
pnpm db:push      # Generate + apply Drizzle migrations (requires DATABASE_URL)
pnpm format       # Prettier
```

Tests live alongside source files in `server/**/*.test.ts` and run in a Node environment (no DOM). Tests require a live DB — do not mock the database layer.

## Architecture

**Monorepo with a single Express server serving both the API and the Vite-built frontend.**

```
client/src/   → React 19 SPA (Vite, Tailwind 4, shadcn/ui, wouter routing)
server/       → Express + tRPC + OCPP WebSocket CSMS
shared/       → Types and constants shared between client and server
drizzle/      → Drizzle ORM schema (schema.ts) and generated migrations
```

Path aliases: `@` → `client/src/`, `@shared` → `shared/`

### Server entry point

`server/_core/index.ts` boots Express, mounts:
- tRPC middleware at `/api/trpc`
- Auth0 OIDC routes at `/api/auth/*`
- Wompi webhook at `/api/wompi/webhook`
- OCPP WebSocket server (dual CSMS: 1.6J + 2.0.1)
- Background cron jobs (billing, reconciliation, balance monitor, AI proactive notifications)

### Key large files

| File | Purpose |
|------|---------|
| `server/db.ts` | ~6 000 lines — all DB access functions, organized by domain |
| `server/routers.ts` | ~4 750 lines — all tRPC endpoints organized by domain |
| `drizzle/schema.ts` | ~2 268 lines — Drizzle table definitions for MySQL |

### tRPC procedure types (`server/_core/trpc.ts`)

- `publicProcedure` — unauthenticated
- `protectedProcedure` — requires authenticated user
- `adminProcedure` — requires `user.role === 'admin'`

The router file also defines `staffProcedure`, `technicianProcedure`, and `investorProcedure` for role-gating.

### Authentication

Auth0 OIDC (web and mobile). Session is a JWT stored in the `app_session_id` cookie (see `shared/const.ts`). On mobile (Capacitor), the token arrives via deep link and is written directly to the cookie. The `sdk.authenticateRequest()` call in `server/_core/context.ts` verifies the cookie on every request.

Public landing routes (`/`, `/landing`, `/partners`, etc.) must never trigger an automatic login redirect — see the `NO_REDIRECT_PATHS` guard in `client/src/main.tsx`.

### Frontend routing

`client/src/App.tsx` uses **wouter** with role-based route segments:
- `/user/*` — end users (map, wallet, charging, AI assistant)
- `/investor/*` — investor dashboard
- `/technician/*` — technician tools
- `/engineer/*` — lead technician
- `/staff/*` / `/admin/*` — operations staff and admins
- `/` — public landing page (no auth required)

55+ page components are lazy-loaded via `React.lazy`.

### Database conventions

- Table columns use `snake_case`; application code uses `camelCase`. Drizzle handles the mapping automatically.
- In raw SQL, use the real column names: `crowdfunding_status`, `payment_status`, `payment_reference`.
- Pagination pattern: `{ data: T[], total: number, page: number, limit: number }` with `limit`/`offset` SQL clauses.

### Payment gateway

**Wompi only** (Colombian gateway). Stripe has been fully removed; legacy fields were renamed to `paymentReference`. The Wompi integration lives in `server/wompi/` (config, router, webhook, auto-charge, recurring billing, reconciliation cron).

### OCPP

`server/ocpp/csms-dual.ts` runs a dual CSMS supporting both OCPP 1.6J and 2.0.1 over WebSocket. Connection lifecycle is managed in `server/ocpp/connection-manager.ts`.

### Mobile (Capacitor)

`capacitor.config.ts` targets `dist/public` (same output as the Vite build). iOS uses the custom URL scheme `evgreen://` for Auth0 deep-link callbacks. Android uses `https`. Build the web app first (`pnpm build`), then `npx cap sync`.

### Deployment

Deployed to **Railway** via Docker (`railway.json` + `Dockerfile`). `VITE_*` env vars must be declared as Docker build `ARG`s so Vite can inline them at build time. The health check endpoint is `/api/health`.

### AI providers

`server/ai/` wraps multiple LLM providers (Manus, OpenAI, Anthropic, Google) behind a common interface in `ai-service.ts`. Context for the LLM is assembled by `context-service.ts` from live DB state.

## Environment variables

All server env vars are accessed through `server/_core/env.ts` (`ENV` object). Required at runtime:
`DATABASE_URL`, `JWT_SECRET`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`.

`VITE_*` variables are baked in at build time (Vite replaces them inline). **Never** load `vite-plugin-manus-runtime` in production builds — it injects a duplicate React bundle and causes a blank screen.
