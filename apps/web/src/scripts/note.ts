import { actions } from "astro:actions";

const SAVE_DELAY_MS = 800;

function statusEl(form: HTMLFormElement) {
  return form.querySelector<HTMLElement>(".note-status");
}

async function save(form: HTMLFormElement) {
  const status = statusEl(form);
  if (status) status.textContent = "Saving…";
  try {
    const { error } = await actions.updateNote(new FormData(form));
    if (error) throw error;
    if (status) status.textContent = "Changes save automatically";
  } catch (err) {
    if (status) status.textContent = "Could not save note";
    console.error(err);
  }
}

for (const form of document.querySelectorAll<HTMLFormElement>(".note-form")) {
  let timer: number | undefined;

  form.addEventListener("input", () => {
    const status = statusEl(form);
    if (status) status.textContent = "Saving…";
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void save(form), SAVE_DELAY_MS);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });
}
