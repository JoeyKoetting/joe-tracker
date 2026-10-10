// Remember each pane independently, including the horizontal list on mobile.
// Separate sort orders have separate positions; opening another job keeps its spot.
const sort = new URLSearchParams(location.search).get("sort") ?? "review_asc";
for (const pane of document.querySelectorAll<HTMLElement>(
  "[data-shortlist-scroll]",
)) {
  const key = `shortlist:${location.pathname}:${sort}:${pane.dataset.shortlistScroll}`;
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (saved && Number.isFinite(saved.top) && Number.isFinite(saved.left)) {
      pane.scrollTop = saved.top;
      pane.scrollLeft = saved.left;
    }
  } catch {
    /* Storage can be unavailable in private browsing. */
  }
  const save = () => {
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ top: pane.scrollTop, left: pane.scrollLeft }),
      );
    } catch {
      /* Navigation still works without storage. */
    }
  };
  pane.addEventListener("scroll", save, { passive: true });
  pane.addEventListener("click", save);
  window.addEventListener("pagehide", save);
}

const form = document.querySelector<HTMLFormElement>("[data-shortlist-sort]");
form
  ?.querySelector("select")
  ?.addEventListener("change", () => form.requestSubmit());
