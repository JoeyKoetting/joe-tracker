import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import {
  classifyJobType,
  classifyRegion,
  decodeEntities,
  SEASON_START,
  type ChartSlice,
  type ListingFilters,
  type MarkState,
} from "@joe/core";
import type { Db } from "./client";
import { listing, listingJel, listingLocation, mark } from "./schema";

export type ListingRow = typeof listing.$inferSelect;
export type MarkRow = typeof mark.$inferSelect;

export interface ListingWithRelations extends ListingRow {
  mark: MarkRow | null;
  locations: Array<typeof listingLocation.$inferSelect>;
  jel: Array<typeof listingJel.$inferSelect>;
}

function postedSince(within: ListingFilters["postedWithin"]): string | null {
  if (!within || within === "all") return null;
  const days = within === "30d" ? 30 : within === "90d" ? 90 : 365;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function effectiveDateSql() {
  return sql`COALESCE(${listing.dateActive}, substr(${listing.firstSeenAt}, 1, 10))`;
}

function firstSeenDate(firstSeenAt: string): string {
  const date = new Date(firstSeenAt);
  if (Number.isNaN(date.getTime())) return firstSeenAt.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export async function countMarks(db: Db): Promise<{
  all: number;
  interested: number;
  appliedTo: number;
  notInterested: number;
}> {
  const [rows, totalRows] = await Promise.all([
    db
      .select({ state: mark.state, n: count() })
      .from(mark)
      .groupBy(mark.state),
    db.select({ n: count() }).from(listing),
  ]);
  const all = totalRows[0]?.n ?? 0;
  let interested = 0;
  let appliedTo = 0;
  let notInterested = 0;
  for (const row of rows) {
    if (row.state === "interested") interested = row.n;
    if (row.state === "applied_to") appliedTo = row.n;
    if (row.state === "not_interested") notInterested = row.n;
  }
  return { all, interested, appliedTo, notInterested };
}

async function attachRelations(
  db: Db,
  rows: ListingRow[],
): Promise<ListingWithRelations[]> {
  if (rows.length === 0) return [];
  const cleanedRows = rows.map((row) => ({
    ...row,
    section: row.section ? decodeEntities(row.section) : null,
    title: row.title ? decodeEntities(row.title) : null,
    institution: row.institution ? decodeEntities(row.institution) : null,
    division: row.division ? decodeEntities(row.division) : null,
    department: row.department ? decodeEntities(row.department) : null,
    salaryRange: row.salaryRange ? decodeEntities(row.salaryRange) : null,
    keywords: row.keywords ? decodeEntities(row.keywords) : null,
    fullText: row.fullText ? decodeEntities(row.fullText) : null,
    applicationRequirements: row.applicationRequirements
      ? decodeEntities(row.applicationRequirements)
      : null,
    referenceInstructions: row.referenceInstructions
      ? decodeEntities(row.referenceInstructions)
      : null,
    applicationInstructions: row.applicationInstructions
      ? decodeEntities(row.applicationInstructions)
      : null,
  }));
  const ids = cleanedRows.map((r) => r.jpId);

  const groups: number[][] = [];
  for (let i = 0; i < ids.length; i += 400) groups.push(ids.slice(i, i + 400));
  const related = await Promise.all(
    groups.map(async (group) =>
      Promise.all([
        db.select().from(mark).where(inArray(mark.jpId, group)),
        db.select().from(listingLocation).where(inArray(listingLocation.jpId, group)),
        db.select().from(listingJel).where(inArray(listingJel.jpId, group)),
      ]),
    ),
  );
  const marks = related.flatMap(([groupMarks]) => groupMarks);
  const locs = related.flatMap(([, groupLocations]) => groupLocations);
  const jels = related.flatMap(([, , groupJels]) => groupJels);

  const markMap = new Map(marks.map((m) => [m.jpId, m]));
  const locMap = new Map<number, typeof locs>();
  for (const loc of locs) {
    const list = locMap.get(loc.jpId) ?? [];
    list.push(loc);
    locMap.set(loc.jpId, list);
  }
  const jelMap = new Map<number, typeof jels>();
  for (const j of jels) {
    const list = jelMap.get(j.jpId) ?? [];
    list.push(j);
    jelMap.set(j.jpId, list);
  }

  return cleanedRows.map((r) => ({
    ...r,
    mark: markMap.get(r.jpId) ?? null,
    locations: (locMap.get(r.jpId) ?? []).map((location) => ({
      ...location,
      country: decodeEntities(location.country),
      state: decodeEntities(location.state),
      city: decodeEntities(location.city),
    })),
    jel: (jelMap.get(r.jpId) ?? []).map((item) => ({
      ...item,
      code: decodeEntities(item.code),
      description: item.description ? decodeEntities(item.description) : null,
    })),
  }));
}

/** All listings in a mark state, without the browse page's pagination limit. */
export async function listAllByMark(
  db: Db,
  state: MarkState,
): Promise<ListingWithRelations[]> {
  const rows = await db
    .select({ listing })
    .from(listing)
    .innerJoin(mark, eq(mark.jpId, listing.jpId))
    .where(eq(mark.state, state))
    .orderBy(desc(effectiveDateSql()), desc(listing.jpId));
  return attachRelations(
    db,
    rows.map((row) => row.listing),
  );
}

export async function queryListings(
  db: Db,
  filters: ListingFilters = {},
): Promise<{ rows: ListingWithRelations[]; total: number }> {
  const limit = Math.min(filters.limit ?? 50, 100);
  const conditions: SQL[] = [];

  if (filters.q) {
    const likeQ = `%${filters.q}%`;
    conditions.push(
      or(
        like(listing.title, likeQ),
        like(listing.institution, likeQ),
        like(listing.fullText, likeQ),
        like(listing.keywords, likeQ),
      )!,
    );
  }

  if (filters.section && filters.section.length > 0) {
    conditions.push(inArray(listing.section, filters.section));
  }

  // Hard floor: Aug 2026 season onward.
  const since = postedSince(filters.postedWithin ?? "all");
  const floor = since && since > SEASON_START ? since : SEASON_START;
  conditions.push(sql`${effectiveDateSql()} >= ${floor}`);


  if (filters.deadlineBefore) {
    conditions.push(lte(listing.applicationDeadline, filters.deadlineBefore));
  }

  if (filters.jobType) {
    // Approximate via section patterns in SQL
    if (filters.jobType === "industry") {
      conditions.push(
        or(
          like(listing.section, "%Nonacademic%"),
          like(listing.section, "%Non-academic%"),
        )!,
      );
    } else if (filters.jobType === "non_tenure_academic") {
      conditions.push(
        or(
          like(listing.section, "%Temporary%"),
          like(listing.section, "%Visiting%"),
          like(listing.section, "%Part-Time%"),
          like(listing.section, "%Adjunct%"),
          like(listing.section, "%Non-Tenure%"),
        )!,
      );
    } else if (filters.jobType === "tenure_track") {
      conditions.push(
        or(
          like(listing.section, "%Tenure%"),
          like(listing.section, "%Full-Time Academic%"),
          like(listing.section, "%Permanent%"),
        )!,
      );
    }
  }

  // Mark filter via subquery / join
  if (
    filters.mark === "interested" ||
    filters.mark === "applied_to" ||
    filters.mark === "not_interested"
  ) {
    conditions.push(
      sql`${listing.jpId} IN (SELECT jp_id FROM mark WHERE state = ${filters.mark})`,
    );
  } else if (filters.mark === "unmarked") {
    conditions.push(
      sql`${listing.jpId} NOT IN (SELECT jp_id FROM mark)`,
    );
  } else if (filters.mark === "active") {
    conditions.push(
      sql`${listing.jpId} NOT IN (SELECT jp_id FROM mark WHERE state = 'not_interested')`,
    );
  }

  if (filters.country && filters.country.length > 0) {
    conditions.push(
      sql`${listing.jpId} IN (SELECT jp_id FROM listing_location WHERE country IN (${sql.join(
        filters.country.map((c) => sql`${c}`),
        sql`, `,
      )}))`,
    );
  }

  if (filters.region) {
    // Pull candidates and filter in JS for region — or use known country lists in SQL.
    // For performance use a rough SQL filter for US; others filtered post-query if needed.
    if (filters.region === "us") {
      conditions.push(
        sql`${listing.jpId} IN (SELECT jp_id FROM listing_location WHERE country LIKE 'UNITED STATES%')`,
      );
    }
  }

  if (filters.jel && filters.jel.length > 0) {
    conditions.push(
      sql`${listing.jpId} IN (SELECT jp_id FROM listing_jel WHERE code IN (${sql.join(
        filters.jel.map((c) => sql`${c}`),
        sql`, `,
      )}))`,
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const totalRows = await db.select({ total: count() }).from(listing).where(where);
  const total = totalRows[0]?.total ?? 0;
  const pageNumber = Math.max(1, Math.floor(filters.page ?? 1));

  const sort = filters.sort ?? "date_desc";
  const orderBy =
    sort === "date_asc"
      ? [asc(effectiveDateSql()), asc(listing.jpId)]
      : sort === "deadline_asc"
        ? [
            asc(sql`COALESCE(${listing.applicationDeadline}, ${listing.reviewDate}, '9999-12-31')`),
            desc(listing.jpId),
          ]
        : sort === "institution_asc"
          ? [asc(listing.institution), desc(listing.jpId)]
          : [desc(effectiveDateSql()), desc(listing.jpId)];

  const raw = await db
    .select()
    .from(listing)
    .where(where)
    .orderBy(...orderBy)
    .limit(limit)
    .offset((pageNumber - 1) * limit);

  // Post-filter region for non-US (canada_europe / asia) using attached locations
  let withRel = await attachRelations(db, raw);
  if (filters.region && filters.region !== "us") {
    withRel = withRel.filter((row) => {
      const country = row.locations[0]?.country;
      return classifyRegion(country) === filters.region;
    });
  }
  if (filters.jobType) {
    withRel = withRel.filter(
      (row) => classifyJobType(row.section) === filters.jobType,
    );
  }

  return { rows: withRel, total };
}

export async function getListing(
  db: Db,
  jpId: number,
): Promise<ListingWithRelations | null> {
  const rows = await db.select().from(listing).where(eq(listing.jpId, jpId)).limit(1);
  if (rows.length === 0) return null;
  const [withRel] = await attachRelations(db, rows);
  return withRel ?? null;
}

export async function setMark(
  db: Db,
  jpId: number,
  state: MarkState | null,
  note?: string | null,
): Promise<void> {
  const now = new Date().toISOString();
  if (state == null) {
    await db.delete(mark).where(eq(mark.jpId, jpId));
    return;
  }
  await db
    .insert(mark)
    .values({
      jpId,
      state,
      note: note ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: mark.jpId,
      set: {
        state,
        note: note ?? null,
        updatedAt: now,
      },
    });
}

export async function updateMarkNote(
  db: Db,
  jpId: number,
  note: string | null,
): Promise<void> {
  await db
    .update(mark)
    .set({ note, updatedAt: new Date().toISOString() })
    .where(eq(mark.jpId, jpId));
}

export async function listByMark(
  db: Db,
  state: MarkState,
): Promise<ListingWithRelations[]> {
  const { rows } = await queryListings(db, {
    mark: state,
    postedWithin: "all",
    limit: 100,
    sort: state === "interested" ? "deadline_asc" : "date_desc",
  });
  return rows;
}

export async function distinctSections(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ section: listing.section })
    .from(listing)
    .where(sql`${listing.section} IS NOT NULL`)
    .orderBy(asc(listing.section));
  return rows.map((r) => r.section!).filter(Boolean);
}

export async function distinctCountries(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ country: listingLocation.country })
    .from(listingLocation)
    .orderBy(asc(listingLocation.country));
  return rows.map((r) => r.country);
}

export async function distinctJelCodes(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ code: listingJel.code })
    .from(listingJel)
    .orderBy(asc(listingJel.code));
  return rows.map((r) => r.code);
}

export async function analyticsBreakdowns(db: Db) {
  const rows = await db
    .select({
      jpId: listing.jpId,
      section: listing.section,
      dateActive: listing.dateActive,
      firstSeenAt: listing.firstSeenAt,
      applicationDeadline: listing.applicationDeadline,
    })
    .from(listing)
    .where(
      sql`${listing.dateActive} >= ${SEASON_START} OR ${listing.dateActive} IS NULL`,
    );
  const seasonRows = rows.filter(
    (row) => (row.dateActive ?? firstSeenDate(row.firstSeenAt)) >= SEASON_START,
  );

  const ids = seasonRows.map((row) => row.jpId);
  const idGroups: number[][] = [];
  for (let i = 0; i < ids.length; i += 400) idGroups.push(ids.slice(i, i + 400));
  const relationGroups = await Promise.all(
    idGroups.map(async (group) =>
      Promise.all([
        db
          .select({ jpId: listingLocation.jpId, country: listingLocation.country })
          .from(listingLocation)
          .where(inArray(listingLocation.jpId, group)),
        db
          .select({ jpId: listingJel.jpId, code: listingJel.code })
          .from(listingJel)
          .where(inArray(listingJel.jpId, group)),
      ]),
    ),
  );
  const locations = relationGroups.flatMap(([groupLocations]) => groupLocations);
  const jels = relationGroups.flatMap(([, groupJels]) => groupJels);

  const countryById = new Map<number, string>();
  for (const location of locations) {
    if (!countryById.has(location.jpId)) countryById.set(location.jpId, location.country);
  }

  const jobTypeLabels = {
    tenure_track: "Tenure track",
    non_tenure_academic: "Non-tenure academic",
    industry: "Industry / nonacademic",
    unknown: "Unclassified",
  } as const;
  const jobTypeCounts = new Map<string, number>();
  for (const row of seasonRows) {
    const type = classifyJobType(row.section) ?? "unknown";
    jobTypeCounts.set(type, (jobTypeCounts.get(type) ?? 0) + 1);
  }

  const regionLabels = {
    us: "United States",
    canada_europe: "Canada + Europe",
    asia: "Asia / Oceania",
    other: "Other / unknown",
  } as const;
  const regionCounts = new Map<string, number>();
  for (const row of seasonRows) {
    const region = classifyRegion(countryById.get(row.jpId));
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
  }

  const jelCounts = new Map<string, number>();
  for (const jel of jels) {
    if (jel.code === "00") continue;
    jelCounts.set(jel.code, (jelCounts.get(jel.code) ?? 0) + 1);
  }

  const deadlineCounts = new Map<string, number>();
  for (const row of seasonRows) {
    const deadline = row.applicationDeadline;
    const match = deadline ? /^(\d{4})-(\d{2})-\d{2}$/.exec(deadline) : null;
    if (!match) continue;
    const monthKey = `${match[1]}-${match[2]}`;
    deadlineCounts.set(monthKey, (deadlineCounts.get(monthKey) ?? 0) + 1);
  }

  return {
    jobTypes: Object.entries(jobTypeLabels).map(([id, label]) => ({
      id,
      label,
      count: jobTypeCounts.get(id) ?? 0,
    })),
    regions: Object.entries(regionLabels).map(([id, label]) => ({
      id,
      label,
      count: regionCounts.get(id) ?? 0,
    })),
    jel: [...jelCounts.entries()]
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
      .slice(0, 10),
    deadlines: [...deadlineCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count })),
    dateCoverage: {
      total: seasonRows.length,
      sourceDate: seasonRows.filter((row) => row.dateActive != null).length,
      firstSeenFallback: seasonRows.filter((row) => row.dateActive == null).length,
    },
  };
}

/** Raw weekly counts for chart series, optionally filtered by slice. */
export async function weeklyCountsForSlice(
  db: Db,
  slice: ChartSlice,
): Promise<Array<{ dateActive: string; jpId: number; section: string | null; institution: string | null }>> {
  // Pull candidate rows with an effective date; filter slice in JS for Fed/finance/region.
  const rows = await db
    .select({
      jpId: listing.jpId,
      dateActive: listing.dateActive,
      firstSeenAt: listing.firstSeenAt,
      section: listing.section,
      institution: listing.institution,
    })
    .from(listing)
    .where(
      sql`${listing.dateActive} >= ${SEASON_START} OR ${listing.dateActive} IS NULL`,
    );

  let filtered = rows.map((r) => ({
    jpId: r.jpId,
    dateActive: (r.dateActive ?? firstSeenDate(r.firstSeenAt)) as string,
    section: r.section,
    institution: r.institution,
  })).filter((row) => row.dateActive >= SEASON_START);

  if (slice === "overall") return filtered;

  if (slice === "fed") {
    const { isFedInstitution } = await import("@joe/core");
    return filtered.filter((r) => isFedInstitution(r.institution));
  }

  if (slice === "tenure_track" || slice === "non_tenure_academic" || slice === "industry") {
    return filtered.filter((r) => classifyJobType(r.section) === slice);
  }

  // Need locations / jel for remaining slices
  const ids = filtered.map((r) => r.jpId);
  if (ids.length === 0) return [];
  const idGroups: number[][] = [];
  for (let i = 0; i < ids.length; i += 400) idGroups.push(ids.slice(i, i + 400));

  if (slice === "finance") {
    const jels = (
      await Promise.all(
        idGroups.map((group) =>
          db
            .select({ jpId: listingJel.jpId, code: listingJel.code })
            .from(listingJel)
            .where(inArray(listingJel.jpId, group)),
        ),
      )
    ).flat();
    const byId = new Map<number, string[]>();
    for (const j of jels) {
      const list = byId.get(j.jpId) ?? [];
      list.push(j.code);
      byId.set(j.jpId, list);
    }
    const { isFinanceJel } = await import("@joe/core");
    return filtered.filter((r) => isFinanceJel(byId.get(r.jpId) ?? []));
  }

  const locs = (
    await Promise.all(
      idGroups.map((group) =>
        db
          .select({
            jpId: listingLocation.jpId,
            country: listingLocation.country,
          })
          .from(listingLocation)
          .where(inArray(listingLocation.jpId, group)),
      ),
    )
  ).flat();
  const countryById = new Map<number, string>();
  for (const loc of locs) {
    if (!countryById.has(loc.jpId)) countryById.set(loc.jpId, loc.country);
  }

  if (slice === "us" || slice === "region_us") {
    return filtered.filter((r) => classifyRegion(countryById.get(r.jpId)) === "us");
  }
  if (slice === "non_us") {
    return filtered.filter((r) => {
      const country = countryById.get(r.jpId);
      return country != null && classifyRegion(country) !== "us";
    });
  }
  if (slice === "region_canada_europe") {
    return filtered.filter(
      (r) => classifyRegion(countryById.get(r.jpId)) === "canada_europe",
    );
  }
  if (slice === "region_asia") {
    return filtered.filter((r) => classifyRegion(countryById.get(r.jpId)) === "asia");
  }

  return filtered;
}
