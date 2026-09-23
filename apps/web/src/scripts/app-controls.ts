const ingestButton =
  document.querySelector<HTMLButtonElement>("#ingest-trigger");
const ingestDialog =
  document.querySelector<HTMLDialogElement>("#ingest-dialog");
const ingestMessage = document.querySelector<HTMLElement>("#ingest-message");
const ingestProgress = document.querySelector<HTMLElement>("#ingest-progress");
const ingestProgressBar = document.querySelector<HTMLElement>(
  '[role="progressbar"][aria-label="Ingest progress"]',
);
const ingestProgressLabel = document.querySelector<HTMLElement>(
  "#ingest-progress-label",
);
const ingestProgressPercent = document.querySelector<HTMLElement>(
  "#ingest-progress-percent",
);
const ingestClose = document.querySelector<HTMLButtonElement>("#ingest-close");
const updateButton =
  document.querySelector<HTMLButtonElement>("#update-trigger");
const updateDialog =
  document.querySelector<HTMLDialogElement>("#update-dialog");
const updateMessage = document.querySelector<HTMLElement>("#update-message");
const ingestToast = document.querySelector<HTMLElement>("#ingest-toast");
const ingestToastMessage = document.querySelector<HTMLElement>(
  "#ingest-toast-message",
);

type IngestStatus = {
  state: "idle" | "running" | "done" | "error";
  message?: string;
};
type UpdateStatus = {
  ahead: number;
  behind: number;
  hasLocalChanges: boolean;
  canUpdate: boolean;
  error?: string;
};

const sleep = (ms: number) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

if (ingestToast && ingestToastMessage) {
  const message = window.sessionStorage.getItem("joe-ingest-toast");
  if (message) {
    window.sessionStorage.removeItem("joe-ingest-toast");
    ingestToastMessage.textContent = message;
    ingestToast.classList.remove("hidden");
    window.setTimeout(() => ingestToast.classList.add("hidden"), 5000);
  }
}

if (
  ingestButton &&
  ingestDialog &&
  ingestMessage &&
  ingestProgress &&
  ingestClose
) {
  ingestButton.addEventListener("click", async () => {
    ingestButton.disabled = true;
    ingestClose.classList.add("hidden");
    ingestProgress.style.width = "0%";
    ingestProgressBar?.setAttribute("aria-valuenow", "0");
    if (ingestProgressPercent) ingestProgressPercent.textContent = "0%";
    if (ingestProgressLabel) ingestProgressLabel.textContent = "In progress";
    ingestDialog.showModal();
    ingestMessage.textContent = "Fetching the latest JOE listings…";

    let progress = 0;
    const crawl = window.setInterval(() => {
      progress = Math.min(
        95,
        progress + Math.max(0.3, (95 - progress) * 0.035),
      );
      ingestProgress.style.width = `${progress}%`;
      ingestProgressBar?.setAttribute(
        "aria-valuenow",
        `${Math.round(progress)}`,
      );
      if (ingestProgressPercent)
        ingestProgressPercent.textContent = `${Math.round(progress)}%`;
    }, 250);

    try {
      const response = await fetch("/api/ingest", { method: "POST" });
      if (!response.ok) throw new Error("Could not start ingest.");
      let status: IngestStatus;
      do {
        await sleep(800);
        const statusResponse = await fetch("/api/ingest", {
          cache: "no-store",
        });
        if (!statusResponse.ok)
          throw new Error("Could not check ingest progress.");
        status = (await statusResponse.json()) as IngestStatus;
        if (status.state === "error")
          throw new Error(status.message || "Ingest failed.");
      } while (status.state === "running" || status.state === "idle");

      window.clearInterval(crawl);
      window.sessionStorage.setItem(
        "joe-ingest-toast",
        status.message || "Ingest complete",
      );
      ingestProgress.style.width = "100%";
      ingestProgressBar?.setAttribute("aria-valuenow", "100");
      if (ingestProgressPercent) ingestProgressPercent.textContent = "100%";
      ingestMessage.textContent = "Done";
      await sleep(1000);
      ingestDialog.close();
      window.location.reload();
    } catch (error) {
      window.clearInterval(crawl);
      ingestMessage.textContent =
        error instanceof Error ? error.message : "Ingest failed.";
      if (ingestProgressLabel)
        ingestProgressLabel.textContent = "Unable to complete";
      ingestClose.classList.remove("hidden");
      ingestClose.onclick = () => ingestDialog.close();
    } finally {
      ingestButton.disabled = false;
    }
  });
}

async function refreshUpdateStatus() {
  if (!updateButton) return;
  try {
    const response = await fetch("/api/update", { cache: "no-store" });
    if (!response.ok) throw new Error("Update check failed");
    const status = (await response.json()) as UpdateStatus;
    if (status.error) throw new Error(status.error);
    updateButton.disabled = !status.canUpdate;
    updateButton.classList.toggle("btn-good", status.canUpdate);
    updateButton.classList.toggle("btn-ghost", !status.canUpdate);
    updateButton.title = status.hasLocalChanges
      ? "Save or commit local changes before updating."
      : status.ahead > 0
        ? "Local and remote histories differ, so the app cannot update automatically."
        : status.behind === 0
          ? "The app is up to date."
          : "Install the available update and restart the app.";
  } catch {
    updateButton.disabled = true;
    updateButton.classList.remove("btn-good");
    updateButton.classList.add("btn-ghost");
  }
}

if (updateButton && updateDialog && updateMessage) {
  void refreshUpdateStatus();
  window.setInterval(() => void refreshUpdateStatus(), 10 * 60_000);

  updateButton.addEventListener("click", async () => {
    updateButton.disabled = true;
    updateDialog.showModal();
    updateMessage.textContent = "Installing the update and restarting…";
    try {
      const currentResponse = await fetch("/api/update", { cache: "no-store" });
      const current = (await currentResponse.json()) as UpdateStatus & {
        instanceId?: string;
      };
      if (!currentResponse.ok || !current.instanceId)
        throw new Error("Could not verify the running app.");
      const response = await fetch("/api/update", { method: "POST" });
      const result = (await response.json()) as {
        started: boolean;
        message?: string;
      };
      if (!response.ok || !result.started) {
        throw new Error(result.message || "Could not start the update.");
      }
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await sleep(1500);
        try {
          const statusResponse = await fetch("/api/update", {
            cache: "no-store",
          });
          const status = (await statusResponse.json()) as UpdateStatus & {
            instanceId?: string;
          };
          if (
            statusResponse.ok &&
            status.instanceId &&
            status.instanceId !== current.instanceId
          ) {
            window.location.reload();
            return;
          }
        } catch {
          // The server is expected to be briefly unavailable during restart.
        }
      }
      updateMessage.textContent =
        "The app is restarting. Refresh this page in a moment.";
    } catch (error) {
      updateMessage.textContent =
        error instanceof Error ? error.message : "Update failed.";
    }
  });
}
