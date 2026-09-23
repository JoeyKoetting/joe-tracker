import { unzipSync, strFromU8 } from "fflate";
import { decodeEntities, emptyToNull, parseJoeDate } from "./hash";
import type { ListingJel, ListingLocation, NormalizedListing } from "./types";

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  // Match each <si>...</si>, collecting all <t> text nodes inside
  const siRe = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRe.exec(xml))) {
    const inner = m[1]!;
    const parts: string[] = [];
    const tRe = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(inner))) {
      parts.push(decodeEntities(tm[1]!));
    }
    strings.push(parts.join(""));
  }
  return strings;
}

function colToIndex(col: string): number {
  let n = 0;
  for (const ch of col) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

interface Cell {
  col: number;
  value: string;
}

function parseSheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml))) {
    const inner = rm[1]!;
    const cells: Cell[] = [];
    const cellRe = /<c\b([^>]*)>(?:[\s\S]*?<v>([\s\S]*?)<\/v>)?[\s\S]*?<\/c>|<c\b([^>]*)\/>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(inner))) {
      const attrs = cm[1] ?? cm[3] ?? "";
      const rawV = cm[2];
      const refM = /\br="([A-Z]+)(\d+)"/.exec(attrs);
      if (!refM) continue;
      const col = colToIndex(refM[1]!);
      const tM = /\bt="([^"]+)"/.exec(attrs);
      const t = tM?.[1];
      let value = "";
      if (rawV != null) {
        if (t === "s") {
          value = shared[Number(rawV)] ?? "";
        } else {
          value = decodeEntities(rawV);
        }
      }
      // Inline string
      if (t === "inlineStr") {
        const isM = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(cm[0]!);
        if (isM) value = decodeEntities(isM[1]!);
      }
      cells.push({ col, value });
    }
    if (cells.length === 0) {
      rows.push([]);
      continue;
    }
    const maxCol = Math.max(...cells.map((c) => c.col));
    const row = Array.from({ length: maxCol + 1 }, () => "");
    for (const c of cells) row[c.col] = c.value;
    rows.push(row);
  }
  return rows;
}

/** Excel serial date → YYYY-MM-DD (Excel epoch 1899-12-30). */
function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function cellToDate(value: string): string | null {
  const parsed = parseJoeDate(value);
  if (parsed) return parsed;
  const n = Number(value);
  if (Number.isFinite(n) && n > 20000 && n < 100000) {
    return excelSerialToIso(n);
  }
  return null;
}

function headerIndex(headers: string[], ...names: string[]): number {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const i = lower.indexOf(name.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

function parseJelFromCell(value: string | null): ListingJel[] {
  if (!value) return [];
  const out: ListingJel[] = [];
  for (const line of value.split(/\n|;/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = /^([A-Z0-9][A-Z0-9.]*)\s*[-–—]?\s*(.*)$/i.exec(trimmed);
    if (m) {
      out.push({
        code: m[1]!.toUpperCase().replace(/\.$/, ""),
        description: emptyToNull(m[2]!) ?? trimmed,
      });
    } else {
      out.push({ code: trimmed, description: trimmed });
    }
  }
  return out;
}

/**
 * Parse free-form location strings from XLSX like:
 * `UNITED STATES OF AMERICA, Illinois, Chicago` or `DENMARK Aarhus`
 */
function parseLocationsFromCell(value: string | null): ListingLocation[] {
  if (!value) return [];
  const parts = value.split(/,/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  // Multi-part: country, state, city
  if (parts.length >= 3) {
    return [
      {
        country: parts[0]!,
        state: parts[1]!,
        city: parts.slice(2).join(", "),
      },
    ];
  }
  if (parts.length === 2) {
    // Could be COUNTRY, City or COUNTRY, State
    return [{ country: parts[0]!, state: null, city: parts[1]! }];
  }

  // Single part: "UNITED STATES New York" or "DENMARK Aarhus"
  const single = parts[0]!;
  const known = /^(UNITED STATES(?: OF AMERICA)?|CANADA|UNITED KINGDOM|CHINA|JAPAN|GERMANY|FRANCE|ITALY|SPAIN|AUSTRALIA|INDIA|SINGAPORE|HONG KONG|TAIWAN|SOUTH KOREA|KOREA|NETHERLANDS|SWEDEN|NORWAY|DENMARK|FINLAND|SWITZERLAND|AUSTRIA|BELGIUM|IRELAND|ISRAEL|BRAZIL|MEXICO|CHILE|COLOMBIA|PERU|ARGENTINA|NEW ZEALAND|PORTUGAL|POLAND|TURKEY|TÜRKIYE|RUSSIA)\b\s*(.*)$/i.exec(
    single,
  );
  if (known) {
    return [
      {
        country: known[1]!.toUpperCase(),
        state: null,
        city: emptyToNull(known[2]!),
      },
    ];
  }
  return [{ country: single, state: null, city: null }];
}

export interface XlsxParseResult {
  /** jp_id → Date_Active ISO date */
  dates: Map<number, string>;
  /** Full listings when the sheet has enough columns (backfill path). */
  listings: NormalizedListing[];
}

/**
 * Parse a JOE Native XLS (OOXML) ArrayBuffer into date map + optional full listings.
 */
export function parseJoeXlsx(buffer: ArrayBuffer | Uint8Array): XlsxParseResult {
  const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const files = unzipSync(data);
  const sharedXml = files["xl/sharedStrings.xml"]
    ? strFromU8(files["xl/sharedStrings.xml"])
    : "";
  const sheetXml = files["xl/worksheets/sheet1.xml"]
    ? strFromU8(files["xl/worksheets/sheet1.xml"])
    : "";
  if (!sheetXml) {
    return { dates: new Map(), listings: [] };
  }

  const shared = sharedXml ? parseSharedStrings(sharedXml) : [];
  const rows = parseSheetRows(sheetXml, shared);
  if (rows.length < 2) return { dates: new Map(), listings: [] };

  const headers = rows[0]!.map((h) => h.trim());
  const iJp = headerIndex(headers, "jp_id");
  const iDate = headerIndex(headers, "Date_Active", "date_active");
  const iSection = headerIndex(headers, "jp_section");
  const iTitle = headerIndex(headers, "jp_title");
  const iInst = headerIndex(headers, "jp_institution");
  const iDiv = headerIndex(headers, "jp_division");
  const iDept = headerIndex(headers, "jp_department");
  const iSalary = headerIndex(headers, "jp_salary_range");
  const iKeywords = headerIndex(headers, "jp_keywords");
  const iFull = headerIndex(headers, "jp_full_text");
  const iDeadline = headerIndex(headers, "Application_deadline", "jp_application_deadline");
  const iLoc = headerIndex(headers, "locations");
  const iJel = headerIndex(headers, "JEL_Classifications");
  const iIssue = headerIndex(headers, "joe_issue_ID");

  const dates = new Map<number, string>();
  const listings: NormalizedListing[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    const jpRaw = iJp >= 0 ? row[iJp] : undefined;
    if (!jpRaw) continue;
    const jpId = Number(jpRaw);
    if (!Number.isFinite(jpId)) continue;

    const dateActive = iDate >= 0 ? cellToDate(row[iDate] ?? "") : null;
    if (dateActive) dates.set(jpId, dateActive);

    // Only build full listings when we have title/institution (backfill sheets)
    if (iTitle < 0 && iInst < 0) continue;

    listings.push({
      jpId,
      joeYear: dateActive ? Number(dateActive.slice(0, 4)) : null,
      joeIssueId: iIssue >= 0 && row[iIssue] ? Number(row[iIssue]) || null : null,
      section: iSection >= 0 ? emptyToNull(row[iSection]) : null,
      title: iTitle >= 0 ? emptyToNull(row[iTitle]) : null,
      institution: iInst >= 0 ? emptyToNull(row[iInst]) : null,
      division: iDiv >= 0 ? emptyToNull(row[iDiv]) : null,
      department: iDept >= 0 ? emptyToNull(row[iDept]) : null,
      salaryRange: iSalary >= 0 ? emptyToNull(row[iSalary]) : null,
      keywords: iKeywords >= 0 ? emptyToNull(row[iKeywords]) : null,
      fullText: iFull >= 0 ? emptyToNull(row[iFull]) : null,
      applicationDeadline: iDeadline >= 0 ? cellToDate(row[iDeadline] ?? "") : null,
      reviewDate: null,
      applicationRequirements: null,
      referenceInstructions: null,
      applicationInstructions: null,
      applicationUrl: null,
      referenceUrl: null,
      status: null,
      dateActive,
      locations: iLoc >= 0 ? parseLocationsFromCell(emptyToNull(row[iLoc])) : [],
      jel: iJel >= 0 ? parseJelFromCell(emptyToNull(row[iJel])) : [],
    });
  }

  return { dates, listings };
}

/** Convenience: just the date map. */
export function parseJoeXlsxDates(buffer: ArrayBuffer | Uint8Array): Map<number, string> {
  return parseJoeXlsx(buffer).dates;
}
