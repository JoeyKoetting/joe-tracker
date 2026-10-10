import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "./client";
import { listing } from "./schema";
import {
  countMarks,
  getListing,
  listAllByMark,
  queryListings,
  setMark,
} from "./repos";

let db: Db;
beforeEach(() => {
  db = createDb(":memory:");
  migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)),
  });
  db.insert(listing)
    .values(
      [
        {
          jpId: 1,
          reviewDate: "2026-10-10",
          applicationDeadline: "2026-12-01",
        },
        {
          jpId: 2,
          reviewDate: "2026-11-01",
          applicationDeadline: "2026-11-15",
        },
        { jpId: 3, reviewDate: null, applicationDeadline: "2026-10-01" },
      ].map((row) => ({
        ...row,
        firstSeenAt: "2026-09-01",
        lastSeenAt: "2026-09-01",
        updatedAt: "2026-09-01",
        contentHash: "test",
      })),
    )
    .run();
});
afterEach(() => db.$client.close());

describe("shortlist sorting and triage", () => {
  it("sorts by first review independently of posted deadline, with missing reviews last", async () => {
    for (const id of [1, 2, 3]) await setMark(db, id, "interested");
    expect(
      (await listAllByMark(db, "interested", "review_asc")).map(
        (row) => row.jpId,
      ),
    ).toEqual([1, 2, 3]);
    expect(
      (await listAllByMark(db, "interested", "deadline_asc")).map(
        (row) => row.jpId,
      ),
    ).toEqual([3, 2, 1]);
    expect(
      (
        await queryListings(db, { mark: "interested", sort: "review_asc" })
      ).rows.map((row) => row.jpId),
    ).toEqual([1, 2, 3]);
  });

  it("persists Maybe, filters and counts it separately, and preserves notes when moving groups", async () => {
    await setMark(db, 1, "interested", "Ask my committee");
    await setMark(db, 1, "maybe");
    await setMark(db, 2, "interested");
    expect((await getListing(db, 1))?.mark?.note).toBe("Ask my committee");
    expect(
      (await queryListings(db, { mark: "maybe" })).rows.map((row) => row.jpId),
    ).toEqual([1]);
    expect(await countMarks(db)).toMatchObject({ maybe: 1, interested: 1 });
    await setMark(db, 1, "applied_to");
    expect((await getListing(db, 1))?.mark?.note).toBe("Ask my committee");
    await setMark(db, 1, null);
    expect((await countMarks(db)).maybe).toBe(0);
    expect((await getListing(db, 1))?.mark).toBeNull();
  });
});
