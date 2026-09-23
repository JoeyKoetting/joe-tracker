import { decodeEntities, emptyToNull } from "./hash";
import type { NormalizedListing } from "./types";

export interface JoePageDetails {
  jpId: number;
  dateActive: string | null;
  applicationDeadline: string | null;
  applicationRequirements: string | null;
  referenceInstructions: string | null;
  applicationInstructions: string | null;
  applicationUrl: string | null;
  referenceUrl: string | null;
}

const MONTHS: Record<string, string> = {
  jan: "01", january: "01", feb: "02", february: "02", mar: "03", march: "03",
  apr: "04", april: "04", may: "05", jun: "06", june: "06", jul: "07",
  july: "07", aug: "08", august: "08", sep: "09", sept: "09", september: "09",
  oct: "10", october: "10", nov: "11", november: "11", dec: "12", december: "12",
};

function usDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  return `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
}

function htmlText(html: string | undefined): string | null {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return emptyToNull(text);
}

function instruction(segment: string, heading: string): string | null {
  const pattern = new RegExp(
    `${heading}\\s*:<\\/h6>\\s*<div[^>]*class=["'][^"']*app-instruct-desc[^"']*["'][^>]*>([\\s\\S]*?)<\\/div>`,
    "i",
  );
  return htmlText(pattern.exec(segment)?.[1]);
}

/** Parse the current JOE listings page, which contains fields omitted by its XML export. */
export function parseJoeListingsHtml(html: string): Map<number, JoePageDetails> {
  const linkPattern = /<a\s+href=["']\/joe\/listing\.php\?JOE_ID=(\d{4})-(\d{2})_(\d+)[^"']*["'][^>]*>/gi;
  const matches = [...html.matchAll(linkPattern)];
  const details = new Map<number, JoePageDetails>();

  for (let index = 0; index < matches.length; index++) {
    const match = matches[index]!;
    const jpId = Number(match[3]);
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? html.length;
    const segment = html.slice(start, end);
    const posted = /Date Posted:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(segment)?.[1];
    const deadline = /Application deadline:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i.exec(segment)?.[1];
    const requirements = /Application Requirements:\s*<\/h6>\s*<ul[^>]*>([\s\S]*?)<\/ul>/i.exec(segment)?.[1];

    let applicationUrl: string | null = null;
    let referenceUrl: string | null = null;
    const buttonPattern = /<a[^>]*class=["'][^"']*button[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    for (const button of segment.matchAll(buttonPattern)) {
      const href = decodeEntities(button[1]!).trim();
      const label = htmlText(button[2]) ?? "";
      if (/request references/i.test(label)) referenceUrl ??= href;
      else if (/apply for this job/i.test(label)) applicationUrl ??= href;
    }

    details.set(jpId, {
      jpId,
      dateActive: usDate(posted),
      applicationDeadline: usDate(deadline),
      applicationRequirements: htmlText(requirements),
      referenceInstructions: instruction(segment, "Reference Instructions"),
      applicationInstructions: instruction(segment, "Application\\s+Instructions"),
      applicationUrl,
      referenceUrl,
    });
  }

  return details;
}

/** Find an employer's first/priority review date in free-form posting text. */
export function extractReviewDate(text: string | null, defaultYear: number | null): string | null {
  if (!text) return null;
  const decoded = decodeEntities(text);
  const datePattern = /\b(January|February|March|April|May|June|July|August|September|Sept\.?|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Oct\.?|Nov\.?|Dec\.?)\s+(\d{1,2})(?!\d)(?:st|nd|rd|th)?(?:,)?(?:\s+(\d{4}))?/gi;

  for (const match of decoded.matchAll(datePattern)) {
    const at = match.index ?? 0;
    const before = decoded.slice(Math.max(0, at - 120), at);
    const after = decoded.slice(at + match[0].length, Math.min(decoded.length, at + match[0].length + 100));
    const reviewLeadsToDate = /(?:first\s+review\s+date\s*(?:is|:)?|review(?:s|ed)?(?:\s+of\s+(?:applications|materials|applicants))?\s+(?:will\s+)?(?:begin|begins|beginning|start|starts|starting)(?:\s+on)?|applications?\s+(?:will\s+be\s+)?reviewed\s+(?:beginning|starting)(?:\s+on)?)\s*$/i.test(before);
    const priorityDate = /applications?\s+(?:received|submitted)\s+by\s*$/i.test(before) &&
      /priority|full consideration/i.test(after);
    if (!reviewLeadsToDate && !priorityDate) continue;
    const monthKey = match[1]!.replace(".", "").toLowerCase();
    const month = MONTHS[monthKey];
    const year = Number(match[3] ?? defaultYear);
    if (!month || !Number.isFinite(year)) continue;
    return `${year}-${month}-${match[2]!.padStart(2, "0")}`;
  }
  return null;
}

export function mergeJoePageDetails(
  listings: NormalizedListing[],
  pageDetails: Map<number, JoePageDetails>,
): NormalizedListing[] {
  return listings.map((listing) => {
    const page = pageDetails.get(listing.jpId);
    const applicationInstructions = page?.applicationInstructions ?? null;
    const reviewSource = [listing.fullText, applicationInstructions].filter(Boolean).join("\n");
    const reviewDate = extractReviewDate(reviewSource, listing.joeYear);
    return {
      ...listing,
      dateActive: page?.dateActive ?? listing.dateActive,
      applicationDeadline: page?.applicationDeadline ?? listing.applicationDeadline ?? reviewDate,
      reviewDate,
      applicationRequirements: page?.applicationRequirements ?? null,
      referenceInstructions: page?.referenceInstructions ?? null,
      applicationInstructions,
      applicationUrl: page?.applicationUrl ?? null,
      referenceUrl: page?.referenceUrl ?? null,
    };
  });
}
