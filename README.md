# Dynadoc

Multi-tenant dynamic document / PDF factory. This repo is the Next.js App Router app.

## Setup

```bash
make install
printf 'DATABASE_URL=postgres://dynadoc_app:dynadoc@localhost:5432/dynadoc\nDATABASE_MIGRATE_URL=postgres://dynadoc:dynadoc@localhost:5432/dynadoc\nS3_BUCKET=dynadoc\nS3_REGION=us-east-1\nS3_ENDPOINT=http://127.0.0.1:9000\nS3_ACCESS_KEY_ID=dynadoc\nS3_SECRET_ACCESS_KEY=dynadocsecret\nS3_FORCE_PATH_STYLE=true\nBETTER_AUTH_SECRET=dev-only-insecure-secret-change-me-32ch\nBETTER_AUTH_URL=http://localhost:3000\n' > .env.local
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
| `make test` | Unit tests (RLS integration tests skip if Postgres is down) |
| `make check` | Lint + tests + production build |
| `make health` | `GET /api/health` (server already running) |
| `make db-up` | Start local Postgres 16 and MinIO (Docker) |
| `make db-down` | Stop local Docker services |
| `make db-generate` | Generate a Drizzle migration from `schema.ts` |
| `make db-migrate` | Apply migrations |
| `make db-studio` | Open Drizzle Studio |
| `make db-smoke` | `SELECT` from `health_checks` |
| `make storage-smoke` | Upload a PNG to MinIO and download it via a signed URL |

Create `.env.local` locally with those values. Never commit `.env` files, including examples. Do not use `drizzle-kit push` in production; generate + migrate only.

Auth is **Better Auth** (email/password) persisted in our Postgres via Drizzle, not Clerk. On first sign-up we insert `organizations` (`external_id` = `user:<better-auth-user-id>`) and a membership with role `org_admin`. Org admins invite by email and role (`POST /api/org/invites`); Dynadoc emails a magic link when `SMTP_URL` is set (`EMAIL_FROM` is the From header). Without SMTP in local dev the link is logged and shown in `/org`. The invitee signs up or signs in at `/invite/:token` and joins that org. Duplicate pending invites refresh the token. Operators cannot invite. Extra members later default to `operator`. Use `requireMembership(organizationId, userId)` and `assertRole(membership, …)` on APIs; never trust a client-sent role. Authors and org admins can hit `GET /api/document-types/:id/draft` and open Author Studio; operators get **403**. Operators fill published types at `/fill` (control panel + live print preview) and `POST /api/document-types/:id/instances`. Hidden groups unmount and are omitted from answers. Generate stays disabled until visible required fields and cross-field rules pass. Issued PDFs include wet-sign signature and initials lines (party names from answers; optional signature image). Draft-only types 404. Set a real `BETTER_AUTH_SECRET` outside local dev.

Tenant isolation: every business table gets `organization_id`. App queries go through `withOrganization(orgId, …)` (`SET LOCAL app.organization_id`) plus an `eq` on `organization_id`. Postgres RLS (`tenantIsolationSql` in `src/lib/db/rls.ts`) is defence in depth — `FORCE ROW LEVEL SECURITY` plus `app_current_organization_id()` so a missing org GUC raises instead of returning every row. The Docker `dynadoc` user is a superuser and would still bypass RLS, so the app session role is `dynadoc_app` (`DATABASE_APP_ROLE`, default) while migrations use `DATABASE_MIGRATE_URL` as the owner. Apply that SQL in the same migration that creates a new tenant table. Product tables include `document_families`, `document_types`, `document_type_versions`, `instances`, `assets`, plus stub `notifications` and `ingest_jobs`. JSONB holds schema/template/answers. Unique `(organization_id, slug)` on types. Instance rows cannot point at a missing version. Issued instances freeze answers, resolved AST, version id, actor, and timestamp; `issued_pdf_key` is set once. A query with no org context throws; it must not return all rows.

Local object storage is MinIO (S3-compatible) so the same client works with Cloudflare R2 or AWS S3 by changing `S3_ENDPOINT` (and `S3_FORCE_PATH_STYLE=false` on AWS if needed). Helpers return object **keys** only; bytes stay in the bucket.

Form, template, and style JSON is validated with Zod in `src/types/document-type.ts` (`schemaVersion`, expression AST with `eq`/`in`/`and`/`or`/`not`/`exists` only — no JavaScript). Import can use `documentTypeVersionJsonSchema()`. Authors `PUT /api/document-types/:id/draft` and `POST .../publish` (transaction: insert `document_type_versions`, set `current_published_version_id`, `published_at`, `published_by`). Later draft edits do not change the published row. Operators `POST .../instances` from that frozen snapshot. `PATCH .../versions/:versionId` returns **409**.

`evaluate(expr, answers)` in `src/lib/expr/evaluate.ts` is a pure boolean walk of `eq` / `in` / `exists` / `not` / `and` / `or`. `resolveDocument` in `src/lib/resolver/resolve.ts` activates groups, interpolates bindings, and drops `includeWhen` blocks. Authors `GET /api/document-types/:id/export?source=draft|published` and `POST /api/document-types/import` (single type or `kind: "family"` bundle; always drafts, new ids). Operators `POST /api/document-types/:id/instances` then download `GET /api/instances/:id/pdf` (`@react-pdf/renderer`, S3 key on the instance when storage is up). Authors upload a type logo (`POST /api/assets/logo`); org admins upload an org default. Missing logos still produce a PDF. Create seeds a draft snapshot (one Details group, heading + paragraph, A4 Times theme) and opens `/studio/:id`, where authors edit field groups, option `activatesGroupIds`, `visibleWhen` rules, and a block canvas (heading, paragraph, list, table, page break, signature, initials) on a debounced draft save. Bindings use field ids (`{{field}}` picker); variant maps are per-select wording. Sample answers interpolate the paper preview and a live structure tree from the same resolver (warnings listed; no PDF). Groups, fields, and blocks share a rule builder for `eq` / `in` / `exists` / `not` / nested `and` / `or`. Blocks with `includeWhen` drop out of that preview when the sample answers fail the rule. Authors can toggle a themed HTML print preview (`style_theme` page size, margins, fonts, logo, signature slots) that uses the same resolved AST. Sample answers stay put across the toggle. Lists are org-scoped.
