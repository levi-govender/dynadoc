# Dynadoc developer commands. Add targets as tickets land (db, auth, pdf, ingest, …).
# Ingest classify/gates/clusters are covered by `make test`; no extra ingest Make target.

.PHONY: help install dev build start lint format check test health db-up db-down db-generate db-migrate db-studio db-smoke storage-smoke

help:
	@echo "Dynadoc"
	@echo "  make install         npm install"
	@echo "  make dev             Next.js dev server"
	@echo "  make build           production build"
	@echo "  make start           serve production build (needs make build)"
	@echo "  make lint            ESLint"
	@echo "  make format          Prettier"
	@echo "  make test            unit tests"
	@echo "  make check           lint + tests + production build"
	@echo "  make health          GET /api/health (server must already be running)"
	@echo "  make db-up           start local Postgres and MinIO (Docker)"
	@echo "  make db-down         stop local Docker services"
	@echo "  make db-generate     drizzle-kit generate"
	@echo "  make db-migrate      drizzle-kit migrate"
	@echo "  make db-studio       drizzle-kit studio"
	@echo "  make db-smoke        select from health_checks"
	@echo "  make storage-smoke   upload a PNG and fetch it via signed URL"

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

format:
	npm run format

test:
	npm test

check: lint test build

health:
	curl -sS http://127.0.0.1:3000/api/health
	@echo

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

db-generate:
	npm run db:generate

db-migrate:
	npm run db:migrate

db-studio:
	npm run db:studio

db-smoke:
	npm run db:smoke

storage-smoke:
	npm run storage:smoke
