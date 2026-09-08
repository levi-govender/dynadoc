# Dynadoc

Multi-tenant dynamic document / PDF factory. This repo is the Next.js App Router app.

## Setup

```bash
make install
printf 'DATABASE_URL=postgres://dynadoc:dynadoc@localhost:5432/dynadoc\nS3_BUCKET=dynadoc\nS3_REGION=us-east-1\nS3_ENDPOINT=http://127.0.0.1:9000\nS3_ACCESS_KEY_ID=dynadoc\nS3_SECRET_ACCESS_KEY=dynadocsecret\nS3_FORCE_PATH_STYLE=true\n' > .env.local
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
| `make test` | Unit tests |
| `make check` | Lint + tests + production build |
| `make health` | `GET /api/health` (server already running) |
| `make db-up` | Start local Postgres 16 and MinIO (Docker) |
| `make db-down` | Stop local Docker services |
| `make db-generate` | Generate a Drizzle migration from `schema.ts` |
| `make db-migrate` | Apply migrations |
| `make db-studio` | Open Drizzle Studio |
| `make db-smoke` | `SELECT` from `health_checks` |
| `make storage-smoke` | Upload a PNG to MinIO and download it via a signed URL |

Create `.env.local` locally with `DATABASE_URL` and the `S3_*` values as above. Never commit `.env` files, including examples. Do not use `drizzle-kit push` in production; generate + migrate only.

Local object storage is MinIO (S3-compatible) so the same client works with Cloudflare R2 or AWS S3 by changing `S3_ENDPOINT` (and `S3_FORCE_PATH_STYLE=false` on AWS if needed). Helpers return object **keys** only; bytes stay in the bucket.

Auth and the document resolver are later tickets. Placeholder folders: `src/lib/auth`, `src/lib/resolver`, `src/types`. The database has a smoke table only (`health_checks`) until the schema ticket.
