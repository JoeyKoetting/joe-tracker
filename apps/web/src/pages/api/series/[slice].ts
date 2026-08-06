import type { APIRoute } from "astro";
import {
  academicYearFor,
  adjustedWeek,
  buildWeeklySeries,
  isoWeek,
  yearsInSeries,
  type ChartSlice,
  type SeriesPayload,
} from "@joe/core";
import { weeklyCountsForSlice } from "@joe/db";
import { getDb } from "../../../lib/db";

export const prerender = false;

const SLICES = new Set<ChartSlice>([
  "overall",
  "finance",
  "fed",
  "us",
  "non_us",
  "region_us",
  "region_canada_europe",
  "region_asia",
  "tenure_track",
  "non_tenure_academic",
  "industry",
]);

export const GET: APIRoute = async ({ params, url }) => {
  const slice = (params.slice ?? "overall") as ChartSlice;
  if (!SLICES.has(slice)) {
    return new Response(JSON.stringify({ error: "unknown slice" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const interpolate = url.searchParams.get("interpolate") === "1";
  const db = getDb();
  const rows = await weeklyCountsForSlice(db, slice);

  const bucket = new Map<string, number>();
  for (const row of rows) {
    const d = new Date(row.dateActive + "T12:00:00Z");
    if (Number.isNaN(d.getTime())) continue;
    const year = academicYearFor(d);
    const week = adjustedWeek(isoWeek(d));
    const key = `${year}:${week}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  const flat = [...bucket.entries()].map(([key, count]) => {
    const [year, week] = key.split(":").map(Number);
    return { year: year!, week: week!, count };
  });

  const points = buildWeeklySeries(flat, { interpolate });
  const payload: SeriesPayload = {
    slice,
    interpolate,
    points,
    years: yearsInSeries(points),
  };

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=60",
    },
  });
};
