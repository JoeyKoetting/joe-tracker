.PHONY: install ingest injest migrate reset test lint dev

install:
	pnpm install

ingest: migrate
	pnpm run ingest

# Common misspelling of ingest
injest: ingest

dev: migrate
	pnpm run dev

lint:
	pnpm run format
	pnpm run lint

migrate:
	pnpm run migrate

reset:
	rm -f data/joe.db data/joe.db-wal data/joe.db-shm
	$(MAKE) migrate

test:
	pnpm test
