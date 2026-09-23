/**
 * Filters apply on interaction: no submit button. Selects and radios navigate
 * immediately, typing in the search box is debounced.
 */
const DEFAULTS: Record<string, string> = {
  postedWithin: "all",
  mark: "unmarked",
  sort: "date_desc",
};

const SEARCH_FOCUS_KEY = "filters:focus-search";
const DEBOUNCE_MS = 350;

function targetUrl(form: HTMLFormElement): string {
  const params = new URLSearchParams();
  for (const [key, raw] of new FormData(form)) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value || DEFAULTS[key] === value) continue;
    params.set(key, value);
  }
  const query = params.toString();
  const path = new URL(form.action, location.href).pathname;
  return query ? `${path}?${query}` : path;
}

function isSearch(target: EventTarget | null): target is HTMLInputElement {
  return target instanceof HTMLInputElement && target.type === "search";
}

for (const form of document.querySelectorAll<HTMLFormElement>(
  "form[data-filters]",
)) {
  let timer: number | undefined;

  const apply = (fromSearch: boolean) => {
    clearTimeout(timer);
    form.querySelector("[data-filter-groups]")?.classList.add("opacity-50");
    if (fromSearch) sessionStorage.setItem(SEARCH_FOCUS_KEY, "1");
    location.assign(targetUrl(form));
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    apply(isSearch(document.activeElement));
  });

  form.addEventListener("change", (event) => {
    if (!isSearch(event.target)) apply(false);
  });

  form.addEventListener("input", (event) => {
    if (!isSearch(event.target)) return;
    clearTimeout(timer);
    timer = window.setTimeout(() => apply(true), DEBOUNCE_MS);
  });
}

if (sessionStorage.getItem(SEARCH_FOCUS_KEY)) {
  sessionStorage.removeItem(SEARCH_FOCUS_KEY);
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'form[data-filters] input[type="search"]',
  );
  for (const input of inputs) {
    if (!input.offsetParent) continue;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    break;
  }
}
