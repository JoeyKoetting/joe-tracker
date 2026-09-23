export type MarkState = "interested" | "applied_to" | "not_interested";

export type JobType = "tenure_track" | "non_tenure_academic" | "industry";

export type Region = "us" | "canada_europe" | "asia" | "other";

export type ChartSlice =
  | "overall"
  | "finance"
  | "fed"
  | "us"
  | "non_us"
  | "region_us"
  | "region_canada_europe"
  | "region_asia"
  | "tenure_track"
  | "non_tenure_academic"
  | "industry";

export interface ListingLocation {
  country: string;
  state: string | null;
  city: string | null;
}

export interface ListingJel {
  code: string;
  description: string | null;
}

/** Normalized listing ready for upsert into SQLite. */
export interface NormalizedListing {
  jpId: number;
  joeYear: number | null;
  joeIssueId: number | null;
  section: string | null;
  title: string | null;
  institution: string | null;
  division: string | null;
  department: string | null;
  salaryRange: string | null;
  keywords: string | null;
  fullText: string | null;
  applicationDeadline: string | null;
  status: string | null;
  /** ISO date YYYY-MM-DD from XLSX Date_Active, if available. */
  dateActive: string | null;
  locations: ListingLocation[];
  jel: ListingJel[];
}

export type PostedWithin = "30d" | "90d" | "1y" | "all";

export interface ListingFilters {
  q?: string;
  section?: string[];
  country?: string[];
  region?: Region;
  jel?: string[];
  postedWithin?: PostedWithin;
  deadlineBefore?: string;
  jobType?: JobType;
  /** `active` excludes listings marked not interested; `any` includes everything. */
  mark?: MarkState | "unmarked" | "active" | "any";
  sort?: "date_desc" | "date_asc" | "deadline_asc" | "institution_asc";
  cursor?: string;
  page?: number;
  limit?: number;
}

export interface WeeklyPoint {
  year: number;
  week: number;
  count: number;
  cumulative: number;
  rolling4wk: number;
}

export interface SeriesPayload {
  slice: ChartSlice;
  interpolate: boolean;
  points: WeeklyPoint[];
  years: number[];
}
