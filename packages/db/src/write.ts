import { inArray, eq } from "drizzle-orm";
import {
  contentHash,
  nowIso,
  type NormalizedListing,
} from "@joe/core";
import type { Db } from "./client";
import { ingestRun, listing, listingJel, listingLocation, meta } from "./schema";

export interface UpsertStats {
  fetched: number;
  inserted: number;
  updated: number;
  unchanged: number;
}

/** SQLite default max bound parameters is 999. */
export const SQLITE_MAX_BOUND_PARAMS = 999;

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export function rowsPerInsert(columnCount: number): number {
  return Math.max(1, Math.floor(SQLITE_MAX_BOUND_PARAMS / columnCount));
}

function existingHashes(db: Db, ids: number[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const group of chunk(ids, 400)) {
    if (group.length === 0) continue;
    const rows = db
      .select({ jpId: listing.jpId, contentHash: listing.contentHash })
      .from(listing)
      .where(inArray(listing.jpId, group))
      .all();
    for (const row of rows) map.set(row.jpId, row.contentHash);
  }
  return map;
}

type WriteItem = NormalizedListing & { hash: string; isNew: boolean };

/**
 * Idempotent upsert in a single SQLite transaction.
 * Unchanged contentHash → only bump lastSeenAt.
 * firstSeenAt is insert-only.
 */
export async function upsertListings(
  db: Db,
  listings: NormalizedListing[],
): Promise<UpsertStats> {
  const stats: UpsertStats = {
    fetched: listings.length,
    inserted: 0,
    updated: 0,
    unchanged: 0,
  };
  if (listings.length === 0) return stats;

  const now = nowIso();
  const hashes = existingHashes(
    db,
    listings.map((l) => l.jpId),
  );

  const toWrite: WriteItem[] = [];
  const unchangedIds: number[] = [];

  for (const group of chunk(listings, 250)) {
    const hashed = await Promise.all(
      group.map(async (item) => ({ item, hash: await contentHash(item) })),
    );
    for (const { item, hash } of hashed) {
      const prev = hashes.get(item.jpId);
      if (prev === hash) {
        stats.unchanged += 1;
        unchangedIds.push(item.jpId);
      } else {
        toWrite.push({ ...item, hash, isNew: prev === undefined });
      }
    }
  }

  db.transaction((tx) => {
    for (const group of chunk(unchangedIds, 400)) {
      if (group.length === 0) continue;
      tx.update(listing)
        .set({ lastSeenAt: now })
        .where(inArray(listing.jpId, group))
        .run();
    }

    for (let i = 0; i < toWrite.length; i++) {
      const item = toWrite[i]!;

      tx.insert(listing)
        .values({
          jpId: item.jpId,
          joeYear: item.joeYear,
          joeIssueId: item.joeIssueId,
          section: item.section,
          title: item.title,
          institution: item.institution,
          division: item.division,
          department: item.department,
          salaryRange: item.salaryRange,
          keywords: item.keywords,
          fullText: item.fullText,
          applicationDeadline: item.applicationDeadline,
          reviewDate: item.reviewDate,
          applicationRequirements: item.applicationRequirements,
          referenceInstructions: item.referenceInstructions,
          applicationInstructions: item.applicationInstructions,
          applicationUrl: item.applicationUrl,
          referenceUrl: item.referenceUrl,
          status: item.status,
          dateActive: item.dateActive,
          firstSeenAt: now,
          lastSeenAt: now,
          contentHash: item.hash,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: listing.jpId,
          set: {
            joeYear: item.joeYear,
            joeIssueId: item.joeIssueId,
            section: item.section,
            title: item.title,
            institution: item.institution,
            division: item.division,
            department: item.department,
            salaryRange: item.salaryRange,
            keywords: item.keywords,
            fullText: item.fullText,
            applicationDeadline: item.applicationDeadline,
            reviewDate: item.reviewDate,
            applicationRequirements: item.applicationRequirements,
            referenceInstructions: item.referenceInstructions,
            applicationInstructions: item.applicationInstructions,
            applicationUrl: item.applicationUrl,
            referenceUrl: item.referenceUrl,
            status: item.status,
            dateActive: item.dateActive,
            lastSeenAt: now,
            contentHash: item.hash,
            updatedAt: now,
          },
        })
        .run();

      tx.delete(listingLocation).where(eq(listingLocation.jpId, item.jpId)).run();
      tx.delete(listingJel).where(eq(listingJel.jpId, item.jpId)).run();

      const seenLoc = new Set<string>();
      const locs = [];
      for (const loc of item.locations) {
        const key = `${loc.country}|${loc.state ?? ""}|${loc.city ?? ""}`;
        if (seenLoc.has(key)) continue;
        seenLoc.add(key);
        locs.push({
          jpId: item.jpId,
          country: loc.country,
          state: loc.state ?? "",
          city: loc.city ?? "",
        });
      }
      if (locs.length > 0) {
        for (const locGroup of chunk(locs, 100)) {
          tx.insert(listingLocation).values(locGroup).run();
        }
      }

      const seenJel = new Set<string>();
      const jels = [];
      for (const j of item.jel) {
        if (seenJel.has(j.code)) continue;
        seenJel.add(j.code);
        jels.push({
          jpId: item.jpId,
          code: j.code,
          description: j.description,
        });
      }
      if (jels.length > 0) {
        for (const jelGroup of chunk(jels, 100)) {
          tx.insert(listingJel).values(jelGroup).run();
        }
      }

      if (item.isNew) stats.inserted += 1;
      else stats.updated += 1;

      if ((i + 1) % 500 === 0) {
        console.log(`  upserted ${i + 1}/${toWrite.length}`);
      }
    }
  });

  return stats;
}

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const rows = db
    .select({ value: meta.value })
    .from(meta)
    .where(eq(meta.key, key))
    .limit(1)
    .all();
  return rows[0]?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string): Promise<void> {
  db.insert(meta)
    .values({ key, value })
    .onConflictDoUpdate({
      target: meta.key,
      set: { value },
    })
    .run();
}

export async function recordIngestRun(
  db: Db,
  input: {
    startedAt: string;
    finishedAt: string;
    mode: string;
    fetched: number;
    inserted: number;
    updated: number;
    unchanged: number;
    error?: string | null;
  },
): Promise<void> {
  db.insert(ingestRun)
    .values({
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      mode: input.mode,
      fetched: input.fetched,
      inserted: input.inserted,
      updated: input.updated,
      unchanged: input.unchanged,
      error: input.error ?? null,
    })
    .run();
}
