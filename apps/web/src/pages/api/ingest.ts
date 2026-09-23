import type { APIRoute } from "astro";
import { getIngestStatus, startIngest } from "../../lib/operations";

export const prerender = false;

export const GET: APIRoute = async () =>
  Response.json(getIngestStatus(), { headers: { "cache-control": "no-store" } });

export const POST: APIRoute = async () =>
  Response.json(startIngest(), { status: 202, headers: { "cache-control": "no-store" } });
