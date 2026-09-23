export interface PostingLink {
  href: string;
  label: string;
  host: string;
}

/** Extract plain-text URLs embedded in JOE's full posting text. */
export function postingLinks(text: string | null | undefined): PostingLink[] {
  if (!text) return [];
  const matches = [...text.matchAll(/(?:https?:\/\/|www\.)[^\s<>"']+/gi)];
  const seen = new Set<string>();
  const seenLabels = new Set<string>();

  return matches.flatMap((match) => {
    const raw = match[0]?.replace(/[),.;!?]+$/g, "");
    if (!raw) return [];
    const href = raw.startsWith("www.") ? `https://${raw}` : raw;
    if (seen.has(href)) return [];
    seen.add(href);

    let host = href;
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      // Keep the source text as the visible host if parsing fails.
    }

    const start = match.index ?? 0;
    const context = text.slice(Math.max(0, start - 100), start).toLowerCase();
    const label = /apply|application|submit|jobs?\b|careers?\b/.test(context) ||
      /jobs|careers|apply|application/i.test(host)
      ? "Application site"
      : "School website";

    if (seenLabels.has(label)) return [];
    seenLabels.add(label);

    return [{ href, label, host }];
  });
}
