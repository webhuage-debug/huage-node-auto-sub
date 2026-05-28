import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectPath } from "../config.js";
import type { SubscriptionAutoRefreshRuntime, SubscriptionFile, SubscriptionStatus } from "./subscriptionTypes.js";

const defaultSubscriptionFile: SubscriptionFile = {
  version: 1,
  token: null,
  contentBase64: "",
  nodeCount: 0,
  targetNodeCount: 20,
  minNodeCount: 10,
  lastGeneratedAt: null,
  warning: null,
  lastAutoRefreshAt: null,
  nextAutoRefreshAt: null,
  lastAutoRefreshOk: null,
  lastAutoRefreshWarning: null,
  lastAutoRefreshError: null,
  expiresAt: null,
  validityDays: 15,
  expirationUpdatedAt: null
};

function getSubscriptionFilePath(): string {
  const dataDir = process.env.DATA_DIR || "./data";
  return resolveProjectPath(process.env.SUBSCRIPTION_FILE || `${dataDir}/subscription.json`);
}

async function ensureSubscriptionFile(): Promise<void> {
  const filePath = getSubscriptionFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(defaultSubscriptionFile, null, 2)}\n`, "utf8");
  }
}

export async function readSubscriptionFile(): Promise<SubscriptionFile> {
  await ensureSubscriptionFile();
  const raw = await fs.readFile(getSubscriptionFilePath(), "utf8");
  const parsed = JSON.parse(raw) as Partial<SubscriptionFile>;

  return {
    version: 1,
    token: parsed.token || null,
    contentBase64: parsed.contentBase64 || "",
    nodeCount: Number(parsed.nodeCount || 0),
    targetNodeCount: Number(parsed.targetNodeCount || 20),
    minNodeCount: Number(parsed.minNodeCount || 10),
    lastGeneratedAt: parsed.lastGeneratedAt || null,
    warning: parsed.warning || null,
    lastAutoRefreshAt: parsed.lastAutoRefreshAt || null,
    nextAutoRefreshAt: parsed.nextAutoRefreshAt || null,
    lastAutoRefreshOk: typeof parsed.lastAutoRefreshOk === "boolean" ? parsed.lastAutoRefreshOk : null,
    lastAutoRefreshWarning: parsed.lastAutoRefreshWarning || null,
    lastAutoRefreshError: parsed.lastAutoRefreshError || null,
    expiresAt: parsed.expiresAt || null,
    validityDays: Number(parsed.validityDays || 15),
    expirationUpdatedAt: parsed.expirationUpdatedAt || null
  };
}

export async function writeSubscriptionFile(file: SubscriptionFile): Promise<void> {
  await ensureSubscriptionFile();
  await fs.writeFile(getSubscriptionFilePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export function createSubscriptionToken(): string {
  return crypto.randomBytes(24).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function toSubscriptionStatus(
  file: SubscriptionFile,
  tokenCreated = false,
  runtime: SubscriptionAutoRefreshRuntime = {
    autoRefreshEnabled: true,
    refreshIntervalMinutes: 5,
    nextAutoRefreshAt: file.nextAutoRefreshAt || null
  }
): SubscriptionStatus {
  const now = Date.now();
  const expiresAtTime = file.expiresAt ? new Date(file.expiresAt).getTime() : null;
  const generated = Boolean(file.token && file.lastGeneratedAt);
  const expired = Boolean(expiresAtTime && now >= expiresAtTime);
  const remainingSeconds = expiresAtTime && now < expiresAtTime ? Math.max(0, Math.floor((expiresAtTime - now) / 1000)) : 0;

  return {
    ok: true,
    generated,
    tokenCreated,
    safeSubscriptionUrl: file.token ? `/sub/${file.token}` : null,
    nodeCount: file.nodeCount,
    targetNodeCount: file.targetNodeCount,
    minNodeCount: file.minNodeCount,
    lastGeneratedAt: file.lastGeneratedAt,
    warning: file.warning,
    autoRefreshEnabled: runtime.autoRefreshEnabled,
    refreshIntervalMinutes: runtime.refreshIntervalMinutes,
    lastAutoRefreshAt: file.lastAutoRefreshAt || null,
    nextAutoRefreshAt: runtime.nextAutoRefreshAt || file.nextAutoRefreshAt || null,
    lastAutoRefreshOk: typeof file.lastAutoRefreshOk === "boolean" ? file.lastAutoRefreshOk : null,
    lastAutoRefreshWarning: file.lastAutoRefreshWarning || null,
    lastAutoRefreshError: file.lastAutoRefreshError || null,
    expiresAt: file.expiresAt || null,
    validityDays: Number(file.validityDays || 15),
    expirationUpdatedAt: file.expirationUpdatedAt || null,
    expired,
    remainingSeconds,
    remainingDays: remainingSeconds > 0 ? Math.ceil(remainingSeconds / 86400) : 0,
    subscriptionAccessible: generated && Boolean(file.token) && !expired
  };
}
