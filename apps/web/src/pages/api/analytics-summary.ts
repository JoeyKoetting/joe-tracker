import type { APIRoute } from "astro";
import { analyticsBreakdowns } from "@joe/db";
import { getDb } from "../../lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  const summary = await analyticsBreakdowns(getDb());
  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
};
