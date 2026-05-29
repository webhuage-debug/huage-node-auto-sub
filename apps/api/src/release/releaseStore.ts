import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectPath } from "../config.js";
import type { ReleaseHistoryItem, ReleaseHistoryType, ReleaseStateFile } from "./releaseTypes.js";

const defaultReleaseState: ReleaseStateFile = {
  version: 1,
  claimCode: null,
  lastTokenResetAt: null,
  lastSubscriptionRebuildAt: null,
  history: []
};

function getReleaseStateFilePath(): string {
  const dataDir = process.env.DATA_DIR || "./data";
  return resolveProjectPath(process.env.RELEASE_STATE_FILE || `${dataDir}/release_state.json`);
}

async function ensureReleaseStateFile(): Promise<void> {
  const filePath = getReleaseStateFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(defaultReleaseState, null, 2)}\n`, "utf8");
  }
}

export async function readReleaseState(): Promise<ReleaseStateFile> {
  await ensureReleaseStateFile();
  const raw = await fs.readFile(getReleaseStateFilePath(), "utf8");
  const parsed = JSON.parse(raw) as Partial<ReleaseStateFile>;

  return {
    version: 1,
    claimCode: typeof parsed.claimCode === "string" ? parsed.claimCode : null,
    lastTokenResetAt: parsed.lastTokenResetAt || null,
    lastSubscriptionRebuildAt: parsed.lastSubscriptionRebuildAt || null,
    history: Array.isArray(parsed.history) ? parsed.history.slice(0, 50) : []
  };
}

export async function writeReleaseState(file: ReleaseStateFile): Promise<void> {
  await ensureReleaseStateFile();
  await fs.writeFile(getReleaseStateFilePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export async function getCurrentClaimCode(): Promise<string | null> {
  const state = await readReleaseState();
  const storedCode = state.claimCode?.trim();
  const envCode = process.env.CLAIM_ACCESS_CODE?.trim();
  return storedCode || envCode || null;
}

export async function appendReleaseHistory(
  state: ReleaseStateFile,
  type: ReleaseHistoryType,
  message: string,
  safeDetail: ReleaseHistoryItem["safeDetail"] = {}
): Promise<ReleaseStateFile> {
  const item: ReleaseHistoryItem = {
    id: crypto.randomUUID(),
    type,
    message,
    createdAt: new Date().toISOString(),
    safeDetail
  };

  return {
    ...state,
    history: [item, ...state.history].slice(0, 50)
  };
}
