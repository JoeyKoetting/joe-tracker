import { actions } from "astro:actions";

type MarkState = "interested" | "applied_to" | "not_interested" | null;

const ACTIVE_CLASS: Record<string, string> = {
  interested: "btn-good",
  applied_to: "btn-applied",
  not_interested: "btn-bad",
};

const IDLE_CLASS: Record<string, string> = {
  interested: "btn-good-idle",
  applied_to: "btn-applied-idle",
  not_interested: "btn-bad-idle",
};

function paintRow(row: HTMLElement, state: MarkState) {
  row.dataset.mark = state ?? "";
  for (const button of row.querySelectorAll<HTMLButtonElement>("button[data-state]")) {
    const target = button.dataset.state;
    if (!target) continue;
    button.classList.remove(
      "btn-good",
      "btn-bad",
      "btn-good-idle",
      "btn-bad-idle",
      "btn-applied",
      "btn-applied-idle",
    );
    button.classList.add(
      state === target ? ACTIVE_CLASS[target]! : IDLE_CLASS[target]!,
    );
  }
}

function paintCounts(counts: { all: number; interested: number; appliedTo: number; notInterested: number }) {
  for (const el of document.querySelectorAll<HTMLElement>("[data-count]")) {
    const key = el.dataset.count;
    if (key === "all") el.textContent = String(counts.all);
    if (key === "interested") el.textContent = String(counts.interested);
    if (key === "appliedTo") el.textContent = String(counts.appliedTo);
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
  if (row) paintRow(row, state);

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
    raw === "" ? null : (raw as "interested" | "applied_to" | "not_interested");
  const row = form.closest<HTMLElement>(".mark-row") ?? undefined;
  const previous: MarkState = (row?.dataset.mark || null) as MarkState;

  // Clicking the active mark again clears it.
  const next: MarkState =
    requested !== null && requested === previous ? null : requested;

  try {
    await applyMark(jpId, next, row);
  } catch (err) {
    console.error(err);
  }
});
