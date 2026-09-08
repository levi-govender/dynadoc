# Dynadoc

Multi-tenant dynamic document / PDF factory. This repo is the Next.js App Router app.

## Setup

```bash
make install
printf 'DATABASE_URL=postgres://dynadoc:dynadoc@localhost:5432/dynadoc\n' > .env.local
make db-up
make db-migrate
make dev
```

Open [http://localhost:3000](http://localhost:3000). Health check: `make health` while the server is running (`{ "ok": true, "db": "ok" }` when Postgres is up).

Prefer **Make** over raw npm as the app grows (`make help` lists targets). npm scripts remain the implementation.

## Commands

| Command | What it does |
| --- | --- |
| `make install` | `npm install` |
| `make dev` | Dev server |
| `make build` | Production build |
| `make start` | Serve the production build |
| `make lint` | ESLint |
| `make format` | Prettier write |
| `make check` | Lint + production build |
| `make health` | `GET /api/health` (server already running) |
| `make db-up` | Start local Postgres 16 (Docker) |
| `make db-down` | Stop local Postgres |
| `make db-generate` | Generate a Drizzle migration from `schema.ts` |
| `make db-migrate` | Apply migrations |
| `make db-studio` | Open Drizzle Studio |
| `make db-smoke` | `SELECT` from `health_checks` |

Create `.env.local` locally with `DATABASE_URL` as above. Never commit `.env` files, including examples. Do not use `drizzle-kit push` in production; generate + migrate only.

Auth and the document resolver are later tickets. Placeholder folders: `src/lib/auth`, `src/lib/resolver`, `src/types`. The database has a smoke table only (`health_checks`) until the schema ticket.
