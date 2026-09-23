import type { APIRoute } from "astro";
import { checkForUpdate, requestAppUpdate } from "../../lib/operations";

export const prerender = false;

export const GET: APIRoute = async () =>
  Response.json(await checkForUpdate(), { headers: { "cache-control": "no-store" } });

export const POST: APIRoute = async () => {
  const result = await requestAppUpdate();
  return Response.json(result, {
    status: result.started ? 202 : 409,
    headers: { "cache-control": "no-store" },
  });
};
