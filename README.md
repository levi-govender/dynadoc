# Dynadoc

Multi-tenant dynamic document / PDF factory. This repo is the Next.js App Router app.

## Setup

```bash
make install
make dev
```

Open [http://localhost:3000](http://localhost:3000). Health check: `make health` while the server is running (`{ "ok": true }`).

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

Auth, Postgres, and the document resolver are later tickets. Placeholder folders: `src/lib/db`, `src/lib/auth`, `src/lib/resolver`, `src/types`.
