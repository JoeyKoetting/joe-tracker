# joe-tracker

Track AEA Job Openings for Economists (JOE) listings locally: filter, mark interested / not interested, and chart posting trends for the Aug 2026 season onward.

## Stack

- **apps/web** — Astro 6 SSR on Node (`@astrojs/node`)
- **packages/db** — Drizzle schema + repos on a local SQLite file (`data/joe.db`)
- **packages/core** — parsers, academic-week math, filter helpers
- **scripts/ingest.ts** — fetch JOE XML + XLSX and upsert into SQLite

## Local development

```bash
make install  # install deps
make ingest   # pull / append JOE listings into SQLite
make dev      # http://localhost:4321
make lint     # prettier --write, then report lint/type errors
```

## Make targets

| Target | What it does |
|--------|----------------|
| `make install` | `pnpm install` |
| `make ingest` | Migrate, then fetch JOE exports and upsert (skips anything before 2026-08-01) |
| `make dev` | Migrate, then start the web app |
| `make lint` | Run Prettier write, then Astro/TS check (reports remaining errors) |

Extras: `make migrate`, `make reset`, `make test`.

Override the DB path with `JOE_DB_PATH=/path/to/file.db` if needed.
