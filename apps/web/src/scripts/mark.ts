import { actions } from "astro:actions";

type MarkState = "interested" | "not_interested" | null;

const ACTIVE_CLASS: Record<string, string> = {
  interested: "btn-good",
  not_interested: "btn-bad",
};

const IDLE_CLASS: Record<string, string> = {
  interested: "btn-good-idle",
  not_interested: "btn-bad-idle",
};

function paintRow(row: HTMLElement, state: MarkState) {
  row.dataset.mark = state ?? "";
  for (const btn of row.querySelectorAll<HTMLButtonElement>("button[data-state]")) {
    const target = btn.dataset.state;
    if (!target) continue;
    btn.classList.remove(
      "btn-good",
      "btn-bad",
      "btn-good-idle",
      "btn-bad-idle",
    );
    btn.classList.add(
      state === target ? ACTIVE_CLASS[target] : IDLE_CLASS[target],
    );
  }
}

function paintCounts(counts: { interested: number; notInterested: number }) {
  for (const el of document.querySelectorAll<HTMLElement>("[data-count]")) {
    const key = el.dataset.count;
    if (key === "interested") el.textContent = String(counts.interested);
    if (key === "notInterested") el.textContent = String(counts.notInterested);
  }
}

async function applyMark(jpId: string, state: MarkState, row?: HTMLElement) {
  const fd = new FormData();
  fd.set("jpId", jpId);
  fd.set("state", state ?? "");
  const { data, error } = await actions.setMark(fd);
  if (error) throw error;
  if (data?.counts) paintCounts(data.counts);

  const path = window.location.pathname;
  if (path === "/interested" && state !== "interested") {
    window.location.assign("/interested");
    return;
  }
  if (row && path === "/not-interested" && state !== "not_interested") {
    row.remove();
  }
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.classList.contains("mark-form")) {
    return;
  }

  event.preventDefault();
  const fd = new FormData(form);
  const jpId = String(fd.get("jpId") ?? "");
  const raw = String(fd.get("state") ?? "");
  const requested: MarkState =
    raw === "" ? null : (raw as "interested" | "not_interested");
  const row = form.closest<HTMLElement>(".mark-row") ?? undefined;
  const previous: MarkState = (row?.dataset.mark || null) as MarkState;

  // Clicking the active mark again clears it.
  const next: MarkState =
    requested !== null && requested === previous ? null : requested;

  if (row) paintRow(row, next);

  try {
    await applyMark(jpId, next, row);
  } catch (err) {
    if (row) paintRow(row, previous);
    console.error(err);
  }
});
