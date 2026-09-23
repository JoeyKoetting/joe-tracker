import type { NormalizedListing } from "./types";

/** Stable hash of listing content (excludes first/last seen timestamps). */
export async function contentHash(
  listing: Omit<NormalizedListing, "dateActive"> & { dateActive: string | null },
): Promise<string> {
  const payload = JSON.stringify({
    joeYear: listing.joeYear,
    joeIssueId: listing.joeIssueId,
    section: listing.section,
    title: listing.title,
    institution: listing.institution,
    division: listing.division,
    department: listing.department,
    salaryRange: listing.salaryRange,
    keywords: listing.keywords,
    fullText: listing.fullText,
    applicationDeadline: listing.applicationDeadline,
    reviewDate: listing.reviewDate,
    applicationRequirements: listing.applicationRequirements,
    referenceInstructions: listing.referenceInstructions,
    applicationInstructions: listing.applicationInstructions,
    applicationUrl: listing.applicationUrl,
    referenceUrl: listing.referenceUrl,
    status: listing.status,
    dateActive: listing.dateActive,
    locations: listing.locations,
    jel: listing.jel,
  });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** Decode HTML/XML entities, including values escaped more than once by JOE. */
export function decodeEntities(value: string): string {
  let decoded = value;
  for (let i = 0; i < 4; i++) {
    const next = decoded
      .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
        String.fromCodePoint(Number.parseInt(n, 16)),
      )
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&nbsp;/gi, " ")
      .replace(/&ndash;/gi, "–")
      .replace(/&mdash;/gi, "—")
      .replace(/&ldquo;|&rdquo;/gi, '"')
      .replace(/&lsquo;|&rsquo;/gi, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&amp;/gi, "&");
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

/** Parse JOE datetime strings like `2025-10-17 00:00:00` → `2025-10-17`. */
export function parseJoeDate(value: string | null | undefined): string | null {
  const v = emptyToNull(value);
  if (!v) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v);
  return m ? m[1]! : null;
}

export function nowIso(): string {
  return new Date().toISOString();
}
