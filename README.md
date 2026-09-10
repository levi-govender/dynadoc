# Dynadoc

**Issue consistent contracts from one published type.**

Dynadoc is a multi-tenant document factory. Authors design a document type once (fields, branching, layout, and branding). Operators fill answers and generate a frozen PDF and Word file. Each generate is a new issued record—issued files are never overwritten.

Use it when a team repeatedly produces the same family of agreements (engagement letters, NDAs, employment contracts, and similar) and needs one source of truth instead of copy-pasted Word files.

---

## Features

- **Document types** — Field groups, options that reveal extra sections, visibility rules, repeatable rows, and a block canvas (headings, paragraphs, lists, tables, page breaks, signature and initials slots).
- **Author Studio** — Simple mode for most templates; advanced rules when you need them. Live paper preview from sample answers. Import and export types (including families). Optional org or type logo.
- **Fill and issue** — Operators complete a published type, then generate. Hidden sections stay out of the answers. Required fields and cross-field rules must pass before generate.
- **Issued files** — PDF and Word from the same resolved document. History lists every issue. Optional Dropbox Sign request against the issued PDF (status on the instance; the file is not rewritten).
- **Ingest** — Upload a corpus of existing PDFs or Word files. Classify, cluster clauses, review a draft tree, then create **draft** types you still publish in Studio.
- **Organizations** — Email/password auth. First sign-up creates an org and an org admin. Admins invite members (authors vs operators). Data is isolated per organization.

---

## Who uses it

| Role | What they do |
| ---- | ------------ |
| **Org admin** | Invites people, sets org defaults (for example a logo). |
| **Author** | Creates and edits drafts in Studio, runs Ingest, publishes types. |
| **Operator** | Fills published types and downloads or e-signs issued files. Cannot edit drafts or invite. |

Typical workflows:

1. **Design** — Author builds a type in Studio (or starts from Ingest), previews with sample answers, publishes.
2. **Issue** — Operator opens Fill, answers the form, generates PDF/Word, optionally sends for signature.
3. **Learn from paper** — Author uploads existing documents at Ingest, reviews clusters and holdouts in Inbox, then publishes the resulting drafts.

---

## Prerequisites

- [Node.js](https://nodejs.org/) (current LTS)
- [Docker](https://docs.docker.com/get-docker/) (Postgres 16 and MinIO)
- [Make](https://www.gnu.org/software/make/)

---

## Getting started

```bash
make install
```

Create `.env.local` (never commit env files):

```bash
printf 'DATABASE_URL=postgres://dynadoc_app:dynadoc@localhost:5432/dynadoc
DATABASE_MIGRATE_URL=postgres://dynadoc:dynadoc@localhost:5432/dynadoc
S3_BUCKET=dynadoc
S3_REGION=us-east-1
S3_ENDPOINT=http://127.0.0.1:9000
S3_ACCESS_KEY_ID=dynadoc
S3_SECRET_ACCESS_KEY=dynadocsecret
S3_FORCE_PATH_STYLE=true
BETTER_AUTH_SECRET=dev-only-insecure-secret-change-me-32ch
BETTER_AUTH_URL=http://localhost:3000
' > .env.local
```

Start the database and object store, migrate, then run the app:

```bash
make db-up
make db-migrate
make dev
```

Open [http://localhost:3000](http://localhost:3000) and sign up. The first account becomes org admin of a new organization.

With the server running, `make health` should report the database as ok.

Use a real `BETTER_AUTH_SECRET` outside local development.

---

## Configuration

Required locally: Postgres URLs, S3/MinIO settings, and Better Auth URL/secret (values above match Docker Compose).

| Optional | Purpose |
| -------- | ------- |
| `SMTP_URL`, `EMAIL_FROM` | Send invite emails. Without SMTP, the accept link is logged and shown on the Organization page. |
| `INGEST_LLM`, `OPENAI_API_KEY` | Optional LLM classify for ingest. Heuristics are the default. |
| `DROPBOX_SIGN_API_KEY` | E-sign issued PDFs. Test mode unless `DROPBOX_SIGN_TEST_MODE=false`. Callbacks: `POST /api/webhooks/dropbox-sign`. |

Local files go to MinIO. Point `S3_ENDPOINT` at Cloudflare R2 or AWS S3 for other environments (`S3_FORCE_PATH_STYLE=false` on AWS if required).

Schema changes: `make db-generate` then `make db-migrate`. Do not use `drizzle-kit push` in production.

---

## Commands

Prefer Make (`make help`). npm scripts are the implementation.

| Command | What it does |
| ------- | ------------ |
| `make install` | Install dependencies |
| `make dev` | Development server |
| `make build` / `make start` | Production build and serve |
| `make lint` / `make format` | ESLint / Prettier |
| `make test` | Tests (Postgres integration tests skip if the DB is down) |
| `make check` | Lint, tests, and production build |
| `make health` | `GET /api/health` (server must already be running) |
| `make db-up` / `make db-down` | Start or stop Postgres and MinIO |
| `make db-generate` / `make db-migrate` | Drizzle generate / apply |
| `make db-studio` | Drizzle Studio |
| `make db-smoke` | Query `health_checks` |
| `make storage-smoke` | Upload a PNG to MinIO and fetch it via signed URL |

---

## Stack

Next.js App Router, React, TypeScript, Tailwind, Drizzle ORM, PostgreSQL, MinIO (S3-compatible), Better Auth.
