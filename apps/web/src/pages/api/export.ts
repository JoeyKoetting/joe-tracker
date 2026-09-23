import type { APIRoute } from "astro";
import type { MarkState } from "@joe/core";
import { listAllByMark } from "@joe/db";
import { getDb } from "../../lib/db";

export const prerender = false;

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+@\-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function displayDate(value: string | null): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${Number(match[2])}/${Number(match[3])}/${match[1]!.slice(-2)}`;
}

export const GET: APIRoute = async ({ url }) => {
  const selected = new Set(url.searchParams.getAll("state"));
  const states: MarkState[] = [];
  if (selected.has("interested")) states.push("interested");
  if (selected.has("applied-to")) states.push("applied_to");
  if (
    states.length === 0 ||
    [...selected].some((state) => !["interested", "applied-to"].includes(state))
  ) {
    return new Response("Select Interested, Applied to, or both to export.", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const db = getDb();
  const listings = (await Promise.all(states.map((state) => listAllByMark(db, state))))
    .flat()
    .sort((a, b) => {
      const dateA = a.dateActive ?? a.firstSeenAt.slice(0, 10);
      const dateB = b.dateActive ?? b.firstSeenAt.slice(0, 10);
      return dateB.localeCompare(dateA) || b.jpId - a.jpId;
    });
  const headers = [
    "Employer",
    "Department",
    "Job",
    "Deadline",
    "Applied?",
    "Interviewed?",
    "Preferred Field",
    "URL",
    "Notes",
  ];
  const rows = listings.map((listing) => [
    listing.institution,
    listing.department,
    listing.title,
    displayDate(listing.applicationDeadline),
    listing.mark?.state === "applied_to" ? 1 : "",
    "",
    "",
    `https://www.aeaweb.org/joe/listing.php?JOE_ID=${listing.jpId}`,
    "",
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");

  return new Response(`\uFEFF${csv}`, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="Joe Tracker.csv"',
      "cache-control": "no-store",
    },
  });
};
