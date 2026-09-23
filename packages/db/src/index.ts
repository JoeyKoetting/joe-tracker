export { createDb, defaultDbPath, type Db } from "./client";
export { applyMigrations } from "./migrate";
export * from "./schema";
export {
  chunk,
  rowsPerInsert,
  SQLITE_MAX_BOUND_PARAMS,
  upsertListings,
  getMeta,
  setMeta,
  recordIngestRun,
  type UpsertStats,
} from "./write";
export {
  countMarks,
  queryListings,
  getListing,
  setMark,
  updateMarkNote,
  listByMark,
  listAllByMark,
  distinctSections,
  distinctCountries,
  distinctJelCodes,
  analyticsBreakdowns,
  weeklyCountsForSlice,
  type ListingRow,
  type MarkRow,
  type ListingWithRelations,
} from "./repos";
