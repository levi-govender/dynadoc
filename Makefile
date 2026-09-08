# Dynadoc developer commands. Add targets as tickets land (db, auth, pdf, …).

.PHONY: help install dev build start lint format check health

help:
	@echo "Dynadoc"
	@echo "  make install  npm install"
	@echo "  make dev      Next.js dev server"
	@echo "  make build    production build"
	@echo "  make start    serve production build (needs make build)"
	@echo "  make lint     ESLint"
	@echo "  make format   Prettier"
	@echo "  make check    lint + production build"
	@echo "  make health   GET /api/health (server must already be running)"

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

check: lint build

health:
	curl -sS http://127.0.0.1:3000/api/health
	@echo
