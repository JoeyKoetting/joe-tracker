import type { ListingFilters, JobType, PostedWithin, Region } from "@joe/core";

export function parseFilters(params: URLSearchParams): ListingFilters {
  const postedWithin = (params.get("postedWithin") as PostedWithin | null) ?? "all";
  const jobType = (params.get("jobType") as JobType | null) || undefined;
  const region = (params.get("region") as Region | null) || undefined;
  // Default shows listings that have not been triaged yet.
  const mark =
    (params.get("mark") as ListingFilters["mark"] | null) ?? "unmarked";
  const sort =
    (params.get("sort") as ListingFilters["sort"] | null) ?? "date_desc";

  const section = params.get("section");
  const country = params.get("country");
  const jel = params.get("jel");

  return {
    q: params.get("q")?.trim() || undefined,
    postedWithin,
    jobType,
    region,
    mark,
    sort,
    section: section ? [section] : undefined,
    country: country ? [country] : undefined,
    jel: jel ? [jel] : undefined,
    cursor: params.get("cursor") || undefined,
    page: Math.max(1, Number(params.get("page") || 1) || 1),
    limit: 40,
  };
}

export function filtersToSearchParams(filters: ListingFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.postedWithin && filters.postedWithin !== "all") {
    p.set("postedWithin", filters.postedWithin);
  }
  if (filters.jobType) p.set("jobType", filters.jobType);
  if (filters.region) p.set("region", filters.region);
  if (filters.mark && filters.mark !== "unmarked") p.set("mark", filters.mark);
  if (filters.sort && filters.sort !== "date_desc") p.set("sort", filters.sort);
  if (filters.section?.[0]) p.set("section", filters.section[0]);
  if (filters.country?.[0]) p.set("country", filters.country[0]);
  if (filters.jel?.[0]) p.set("jel", filters.jel[0]);
  if (filters.cursor) p.set("cursor", filters.cursor);
  if (filters.page && filters.page > 1) p.set("page", String(filters.page));
  return p;
}
