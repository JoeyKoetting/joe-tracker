import type { JobType, Region } from "./types";

const FED_PATTERNS = [
  /Federal Reserve Bank/i,
  /Federal Reserve Board/i,
  /Federal Reserve System/i,
  /Board of Governors/i,
  /Federal Deposit Insurance Corporation/i,
  /Office of the Comptroller of the Currency/i,
  /\bFDIC\b/i,
  /\bOCC\b/,
];

const CANADA_EUROPE = new Set([
  "CANADA",
  "UNITED KINGDOM",
  "UK",
  "ENGLAND",
  "SCOTLAND",
  "WALES",
  "IRELAND",
  "FRANCE",
  "GERMANY",
  "ITALY",
  "SPAIN",
  "PORTUGAL",
  "NETHERLANDS",
  "BELGIUM",
  "SWITZERLAND",
  "AUSTRIA",
  "SWEDEN",
  "NORWAY",
  "DENMARK",
  "FINLAND",
  "ICELAND",
  "POLAND",
  "CZECH REPUBLIC",
  "CZECHIA",
  "HUNGARY",
  "ROMANIA",
  "GREECE",
  "TURKEY",
  "TÜRKIYE",
  "RUSSIA",
  "UKRAINE",
  "LUXEMBOURG",
  "EUROPEAN UNION",
]);

const ASIA = new Set([
  "CHINA",
  "JAPAN",
  "SOUTH KOREA",
  "KOREA",
  "KOREA, REPUBLIC OF",
  "TAIWAN",
  "HONG KONG",
  "SINGAPORE",
  "INDIA",
  "INDONESIA",
  "MALAYSIA",
  "THAILAND",
  "VIETNAM",
  "PHILIPPINES",
  "BANGLADESH",
  "PAKISTAN",
  "ISRAEL",
  "SAUDI ARABIA",
  "UNITED ARAB EMIRATES",
  "QATAR",
  "AUSTRALIA",
  "NEW ZEALAND",
]);

export function isFedInstitution(institution: string | null | undefined): boolean {
  if (!institution) return false;
  return FED_PATTERNS.some((re) => re.test(institution));
}

export function isFinanceJel(codes: string[]): boolean {
  return codes.some((c) => c === "G" || c.startsWith("G"));
}

export function classifyJobType(section: string | null | undefined): JobType | null {
  if (!section) return null;
  const s = section.toLowerCase();
  if (s.includes("nonacademic") || s.includes("non-academic")) return "industry";
  if (
    s.includes("temporary") ||
    s.includes("visiting") ||
    s.includes("part-time") ||
    s.includes("adjunct") ||
    s.includes("other non-tenure") ||
    s.includes("non-tenure")
  ) {
    return "non_tenure_academic";
  }
  if (
    s.includes("tenure") ||
    s.includes("full-time academic") ||
    s.includes("permanent")
  ) {
    return "tenure_track";
  }
  return null;
}

export function classifyRegion(country: string | null | undefined): Region {
  if (!country) return "other";
  const c = country.trim().toUpperCase();
  if (c === "UNITED STATES" || c === "USA" || c === "US" || c.startsWith("UNITED STATES")) {
    return "us";
  }
  if (CANADA_EUROPE.has(c)) return "canada_europe";
  if (ASIA.has(c)) return "asia";
  return "other";
}

export function primaryCountry(
  locations: { country: string }[],
): string | null {
  return locations[0]?.country ?? null;
}
