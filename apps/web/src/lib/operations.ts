import { spawn } from "node:child_process";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const projectRoot = findProjectRoot();

function findProjectRoot(): string {
  let directory = process.cwd();
  while (true) {
    if (existsSync(path.join(directory, "pnpm-workspace.yaml"))) return directory;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
}

type IngestStatus = {
  state: "idle" | "running" | "done" | "error";
  message?: string;
  inserted?: number;
  finishedAt?: string;
};

let ingestStatus: IngestStatus = { state: "idle" };

export function getIngestStatus(): IngestStatus {
  return ingestStatus;
}

export function startIngest(): IngestStatus {
  if (ingestStatus.state === "running") return ingestStatus;
  ingestStatus = { state: "running", message: "Fetching the latest JOE listings…" };
  const child = spawn("pnpm", ["run", "ingest"], {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });
  let output = "";
  let errors = "";
  child.stdout?.on("data", (chunk: Buffer | string) => {
    output = `${output}${chunk.toString()}`.slice(-8192);
  });
  child.stderr?.on("data", (chunk: Buffer | string) => {
    errors = `${errors}${chunk.toString()}`.slice(-8192);
  });
  child.once("error", (error) => {
    ingestStatus = {
      state: "error",
      message: error.message,
      finishedAt: new Date().toISOString(),
    };
  });
  child.once("close", (code) => {
    if (ingestStatus.state !== "running") return;
    const inserted = Number(output.match(/inserted=(\d+)/)?.[1] ?? 0);
    ingestStatus = {
      state: code === 0 ? "done" : "error",
      message:
        code === 0
          ? inserted === 0
            ? "No new listings posted"
            : `${inserted} new listing${inserted === 1 ? "" : "s"} added`
          : errors.trim() || `Ingest failed (exit ${code ?? "unknown"})`,
      inserted,
      finishedAt: new Date().toISOString(),
    };
  });
  return ingestStatus;
}

export interface UpdateStatus {
  instanceId: string;
  branch: string;
  ahead: number;
  behind: number;
  hasLocalChanges: boolean;
  canUpdate: boolean;
  error?: string;
}

let cachedUpdate: UpdateStatus | null = null;
let updateCheckedAt = 0;
let updateCheckPromise: Promise<UpdateStatus> | null = null;

export async function checkForUpdate(force = false): Promise<UpdateStatus> {
  if (updateCheckPromise) return updateCheckPromise;
  if (!force && cachedUpdate && Date.now() - updateCheckedAt < 9 * 60_000) {
    return cachedUpdate;
  }

  updateCheckPromise = (async () => {
    const runGit = async (args: string[]) =>
      (await execFileAsync("git", args, { cwd: projectRoot, timeout: 90_000 })).stdout.trim();
    try {
      const branch = await runGit(["branch", "--show-current"]);
      await runGit(["fetch", "--quiet"]);
      const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]);
      const [aheadText, behindText] = (await runGit(["rev-list", "--left-right", "--count", `HEAD...${upstream}`])).split(/\s+/);
      const ahead = Number(aheadText) || 0;
      const behind = Number(behindText) || 0;
      const workingTree = await runGit(["status", "--porcelain", "--untracked-files=normal"]);
      return {
        instanceId,
        branch,
        ahead,
        behind,
        hasLocalChanges: workingTree.length > 0,
        canUpdate: behind > 0 && ahead === 0 && workingTree.length === 0,
      };
    } catch (error) {
      return {
        instanceId,
        branch: "",
        ahead: 0,
        behind: 0,
        hasLocalChanges: true,
        canUpdate: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  })();

  try {
    cachedUpdate = await updateCheckPromise;
    updateCheckedAt = Date.now();
    return cachedUpdate;
  } finally {
    updateCheckPromise = null;
  }
}

export async function requestAppUpdate(): Promise<
  { started: true } | { started: false; message: string }
> {
  const status = await checkForUpdate(true);
  if (status.error) return { started: false, message: `Could not check for updates: ${status.error}` };
  if (status.hasLocalChanges) {
    return { started: false, message: "Update blocked: commit or remove local changes first." };
  }
  if (status.ahead > 0) {
    return { started: false, message: "Update blocked: local and remote history differ." };
  }
  if (status.behind === 0) return { started: false, message: "The app is already up to date." };

  const updater = spawn(
    "bash",
    [path.join(projectRoot, "scripts", "update-app.sh"), String(process.pid)],
    { cwd: projectRoot, detached: true, stdio: "ignore", env: process.env },
  );
  updater.unref();
  return { started: true };
}
