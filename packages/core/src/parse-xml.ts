import { emptyToNull, parseJoeDate } from "./hash";
import type { ListingJel, ListingLocation, NormalizedListing } from "./types";

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function tagText(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = re.exec(block);
  if (!m) return null;
  // Strip nested tags if any
  const raw = m[1]!.replace(/<[^>]+>/g, "");
  return emptyToNull(decodeXmlEntities(raw));
}

function attrInt(openTag: string, name: string): number | null {
  const re = new RegExp(`\\b${name}="([^"]*)"`, "i");
  const m = re.exec(openTag);
  if (!m || m[1] === "") return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function parseLocations(block: string): ListingLocation[] {
  const locsBlock = /<locations\b[^>]*>([\s\S]*?)<\/locations>/i.exec(block)?.[1];
  if (!locsBlock) return [];
  const out: ListingLocation[] = [];
  const locRe = /<location\b[^>]*>([\s\S]*?)<\/location>/gi;
  let m: RegExpExecArray | null;
  while ((m = locRe.exec(locsBlock))) {
    const inner = m[1]!;
    const country = tagText(inner, "country");
    if (!country) continue;
    out.push({
      country,
      state: tagText(inner, "state"),
      city: tagText(inner, "city"),
    });
  }
  return out;
}

function parseJel(block: string): ListingJel[] {
  const jelBlock =
    /<JEL_Classifications\b[^>]*>([\s\S]*?)<\/JEL_Classifications>/i.exec(block)?.[1];
  if (!jelBlock) return [];
  const out: ListingJel[] = [];
  const jelRe = /<jel_class\b[^>]*>([\s\S]*?)<\/jel_class>/gi;
  let m: RegExpExecArray | null;
  while ((m = jelRe.exec(jelBlock))) {
    const inner = m[1]!;
    const codeRaw = tagText(inner, "jc_code");
    if (!codeRaw) continue;
    const letter = /^([A-Z0-9]+)/i.exec(codeRaw)?.[1]?.toUpperCase() ?? codeRaw;
    out.push({
      code: letter,
      description: tagText(inner, "jc_description") ?? codeRaw,
    });
  }
  return out;
}

function parsePosition(
  block: string,
  openTag: string,
  joeYear: number | null,
  joeIssueId: number | null,
): NormalizedListing | null {
  const jpId = attrInt(openTag, "jp_id");
  if (jpId == null) return null;

  return {
    jpId,
    joeYear,
    joeIssueId,
    section: tagText(block, "jp_section"),
    title: tagText(block, "jp_title"),
    institution: tagText(block, "jp_institution"),
    division: tagText(block, "jp_division"),
    department: tagText(block, "jp_department"),
    salaryRange: tagText(block, "jp_salary_range"),
    keywords: tagText(block, "jp_keywords"),
    fullText: tagText(block, "jp_full_text"),
    applicationDeadline: parseJoeDate(tagText(block, "jp_application_deadline")),
    status: tagText(block, "jp_status"),
    dateActive: null,
    locations: parseLocations(block),
    jel: parseJel(block),
  };
}

/**
 * Parse JOE `full_xml` export with a regex parser (no DOMParser dependency).
 */
export function parseJoeXml(xml: string): NormalizedListing[] {
  const listings: NormalizedListing[] = [];

  // Prefer year → issue → position nesting
  const yearRe = /<year\b([^>]*)>([\s\S]*?)<\/year>/gi;
  let ym: RegExpExecArray | null;
  let foundNested = false;

  while ((ym = yearRe.exec(xml))) {
    foundNested = true;
    const joeYear = attrInt(ym[1]!, "joe_year_ID");
    const yearBody = ym[2]!;
    const issueRe = /<issue\b([^>]*)>([\s\S]*?)<\/issue>/gi;
    let im: RegExpExecArray | null;
    while ((im = issueRe.exec(yearBody))) {
      const joeIssueId = attrInt(im[1]!, "joe_issue_ID");
      const issueBody = im[2]!;
      const posRe = /<position\b([^>]*)>([\s\S]*?)<\/position>/gi;
      let pm: RegExpExecArray | null;
      while ((pm = posRe.exec(issueBody))) {
        const listing = parsePosition(pm[2]!, pm[1]!, joeYear, joeIssueId);
        if (listing) listings.push(listing);
      }
    }
  }

  if (!foundNested) {
    const posRe = /<position\b([^>]*)>([\s\S]*?)<\/position>/gi;
    let pm: RegExpExecArray | null;
    while ((pm = posRe.exec(xml))) {
      const listing = parsePosition(pm[2]!, pm[1]!, null, null);
      if (listing) listings.push(listing);
    }
  }

  return listings;
}

/** Merge Date_Active from the XLSX map onto XML-parsed listings. */
export function mergeDateActive(
  listings: NormalizedListing[],
  dates: Map<number, string>,
): NormalizedListing[] {
  return listings.map((l) => ({
    ...l,
    dateActive: dates.get(l.jpId) ?? l.dateActive,
  }));
}
