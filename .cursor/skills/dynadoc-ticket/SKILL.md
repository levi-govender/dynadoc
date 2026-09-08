---
name: dynadoc-ticket
description: Picks the next Dynadoc Notion board ticket, implements it on a feature branch, tests, and stops for human review before commit/push/PR. Use when starting the next ticket, implementing from the board, or when the user says next ticket, pick up a ticket, or continue the board.
---

# Dynadoc ticket loop

Board: [Dynadoc](https://app.notion.com/p/3d58f3776f4f813cb179f0624cb0e76f). Data source: `collection://13c080c1-222c-4a14-af39-d8a1419c6b6f`.

## Pick

Query Ready for Sprint, then TR Ready. Skip tickets whose Blocked by are not Done. Fetch the chosen page. Set Stage to In Dev.

## Implement

Create `feat/<slug>`. Implement only that ticket. Run its Validation checks plus lint/build/tests so the app still works.

## Stop

Summarize in chat. Do not commit, push, or PR until the user reviews and asks. Do not set Stage to Done until merge.
