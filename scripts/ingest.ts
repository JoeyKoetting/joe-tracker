import {
  mergeDateActive,
  mergeJoePageDetails,
  nowIso,
  parseJoeListingsHtml,
  parseJoeXml,
  parseJoeXlsxDates,
  SEASON_START,
} from "@joe/core";
import {
  createDb,
  recordIngestRun,
  upsertListings,
  type UpsertStats,
} from "@joe/db";

const XML_URL =
  "https://www.aeaweb.org/joe/resultset_output.php?mode=full_xml";
const XLSX_URL =
  "https://www.aeaweb.org/joe/resultset_xls_output.php?mode=xls_xml";
const LISTINGS_URL = "https://www.aeaweb.org/joe/listings?lpp=all";
const UA = "joe-tracker-ingest/0.1 (+local)";

function effectiveDate(dateActive: string | null, fallbackIso: string): string {
  return (dateActive ?? fallbackIso).slice(0, 10);
}

async function runIngest(): Promise<
  UpsertStats & { skipped: boolean; dropped: number; error?: string }
> {
  const startedAt = nowIso();
  const db = createDb();

  try {
    const [xmlRes, xlsxRes, listingsRes] = await Promise.all([
      fetch(XML_URL, {
        headers: { "User-Agent": UA, Accept: "application/xml,text/xml,*/*" },
      }),
      fetch(XLSX_URL, {
        headers: {
          "User-Agent": UA,
          Accept: "application/vnd.ms-excel,application/octet-stream,*/*",
        },
      }),
      fetch(LISTINGS_URL, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      }),
    ]);

    if (!xmlRes.ok) {
      throw new Error(`XML fetch failed: HTTP ${xmlRes.status}`);
    }

    if (!xlsxRes.ok) {
      throw new Error(`XLSX fetch failed: HTTP ${xlsxRes.status}`);
    }
    if (!listingsRes.ok) {
      throw new Error(`Listings page fetch failed: HTTP ${listingsRes.status}`);
    }
    const [xmlText, xlsxBuf, listingsHtml] = await Promise.all([
      xmlRes.text(),
      xlsxRes.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      listingsRes.text(),
    ]);
    const dates = parseJoeXlsxDates(xlsxBuf);

    const all = mergeJoePageDetails(
      mergeDateActive(parseJoeXml(xmlText), dates),
      parseJoeListingsHtml(listingsHtml),
    );
    const now = nowIso();
    const listings = all.filter(
      (l) => effectiveDate(l.dateActive, now) >= SEASON_START,
    );
    const dropped = all.length - listings.length;

    const stats = await upsertListings(db, listings);

    await recordIngestRun(db, {
      startedAt,
      finishedAt: nowIso(),
      mode: "manual",
      ...stats,
    });

    return { ...stats, skipped: false, dropped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordIngestRun(db, {
      startedAt,
      finishedAt: nowIso(),
      mode: "manual",
      fetched: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      error: message,
    });
    return {
      fetched: 0,
      inserted: 0,
      updated: 0,
      unchanged: 0,
      skipped: false,
      dropped: 0,
      error: message,
    };
  }
}

const result = await runIngest();
if (result.error) {
  console.error("Ingest failed:", result.error);
  process.exit(1);
}
if (result.skipped) {
  console.log("Upstream unchanged (304). Nothing to do.");
} else {
  console.log(
    `Ingest complete: fetched=${result.fetched} inserted=${result.inserted} updated=${result.updated} unchanged=${result.unchanged} dropped_pre_season=${result.dropped}`,
  );
}
