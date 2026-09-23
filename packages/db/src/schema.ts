import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * jp_id from JOE is the natural primary key — every upsert is idempotent.
 * Dates are ISO text (YYYY-MM-DD / full ISO timestamps).
 */

export const listing = sqliteTable(
  "listing",
  {
    jpId: integer("jp_id").primaryKey(),
    joeYear: integer("joe_year"),
    joeIssueId: integer("joe_issue_id"),
    section: text("section"),
    title: text("title"),
    institution: text("institution"),
    division: text("division"),
    department: text("department"),
    salaryRange: text("salary_range"),
    keywords: text("keywords"),
    fullText: text("full_text"),
    applicationDeadline: text("application_deadline"),
    status: text("status"),
    /** From XLSX Date_Active when available. */
    dateActive: text("date_active"),
    firstSeenAt: text("first_seen_at").notNull(),
    lastSeenAt: text("last_seen_at").notNull(),
    contentHash: text("content_hash").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [
    index("listing_date_active_idx").on(t.dateActive),
    index("listing_section_idx").on(t.section),
    index("listing_institution_idx").on(t.institution),
    index("listing_deadline_idx").on(t.applicationDeadline),
    index("listing_first_seen_idx").on(t.firstSeenAt),
  ],
);

export const listingLocation = sqliteTable(
  "listing_location",
  {
    jpId: integer("jp_id")
      .notNull()
      .references(() => listing.jpId),
    country: text("country").notNull(),
    /** Empty string when absent — SQLite PK treats NULLs as distinct. */
    state: text("state").notNull().default(""),
    city: text("city").notNull().default(""),
  },
  (t) => [
    primaryKey({
      columns: [t.jpId, t.country, t.state, t.city],
    }),
    index("listing_location_country_idx").on(t.country),
  ],
);

export const listingJel = sqliteTable(
  "listing_jel",
  {
    jpId: integer("jp_id")
      .notNull()
      .references(() => listing.jpId),
    code: text("code").notNull(),
    description: text("description"),
  },
  (t) => [
    primaryKey({ columns: [t.jpId, t.code] }),
    index("listing_jel_code_idx").on(t.code),
  ],
);

/** Single-user marks — no user_id by design. */
export const mark = sqliteTable(
  "mark",
  {
    jpId: integer("jp_id").primaryKey(),
    state: text("state", { enum: ["interested", "applied_to", "not_interested"] }).notNull(),
    note: text("note"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => [index("mark_state_idx").on(t.state)],
);

export const ingestRun = sqliteTable("ingest_run", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at").notNull(),
  finishedAt: text("finished_at"),
  mode: text("mode").notNull(),
  fetched: integer("fetched").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  unchanged: integer("unchanged").notNull().default(0),
  error: text("error"),
});

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
