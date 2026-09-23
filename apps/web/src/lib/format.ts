import type { ListingWithRelations } from "@joe/db";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-09-15" -> "Sep 15". Returns null for empty/unparseable input. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86400000);
}

export type DeadlineTone = "past" | "soon" | "later";

export function deadlineTone(days: number | null): DeadlineTone | null {
  if (days == null) return null;
  if (days < 0) return "past";
  return days <= 30 ? "soon" : "later";
}

export function postedDate(listing: ListingWithRelations): string | null {
  if (listing.dateActive) return listing.dateActive;
  const firstSeen = new Date(listing.firstSeenAt);
  if (Number.isNaN(firstSeen.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(firstSeen);
}

export function locationLabel(
  listing: ListingWithRelations,
): string | null {
  const location = listing.locations[0];
  if (!location) return null;
  return (
    [location.city, location.state, location.country]
      .filter(Boolean)
      .join(", ") || null
  );
}
