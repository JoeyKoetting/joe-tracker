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
  distinctSections,
  distinctCountries,
  distinctJelCodes,
  weeklyCountsForSlice,
  type ListingRow,
  type MarkRow,
  type ListingWithRelations,
} from "./repos";
