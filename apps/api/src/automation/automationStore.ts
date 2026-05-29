import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectPath } from "../config.js";
import type { AutomationLogItem, AutomationStateFile, AutomationSummary } from "./automationTypes.js";

export const emptyAutomationSummary: AutomationSummary = {
  githubRequests: 0,
  foundLinks: 0,
  addedNodes: 0,
  testedNodes: 0,
  availableNodes: 0,
  subscriptionRebuilt: false
};

const defaultAutomationState: AutomationStateFile = {
  version: 1,
  enabled: false,
  intervalMinutes: 30,
  running: false,
  lastRunAt: null,
  lastRunOk: null,
  lastError: null,
  lastSummary: emptyAutomationSummary,
  logs: []
};

function getAutomationStateFilePath(): string {
  const dataDir = process.env.DATA_DIR || "./data";
  return resolveProjectPath(process.env.AUTOMATION_STATE_FILE || `${dataDir}/automation_state.json`);
}

async function ensureAutomationStateFile(): Promise<void> {
  const filePath = getAutomationStateFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(defaultAutomationState, null, 2)}\n`, "utf8");
  }
}

export async function readAutomationState(): Promise<AutomationStateFile> {
  await ensureAutomationStateFile();
  const raw = await fs.readFile(getAutomationStateFilePath(), "utf8");
  const parsed = JSON.parse(raw) as Partial<AutomationStateFile>;

  return {
    version: 1,
    enabled: parsed.enabled === true,
    intervalMinutes: Number(parsed.intervalMinutes || 30),
    running: parsed.running === true,
    lastRunAt: parsed.lastRunAt || null,
    lastRunOk: typeof parsed.lastRunOk === "boolean" ? parsed.lastRunOk : null,
    lastError: parsed.lastError || null,
    lastSummary: parsed.lastSummary || emptyAutomationSummary,
    logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 50) : []
  };
}

export async function writeAutomationState(file: AutomationStateFile): Promise<void> {
  await ensureAutomationStateFile();
  await fs.writeFile(getAutomationStateFilePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export async function appendAutomationLog(
  state: AutomationStateFile,
  ok: boolean,
  summary: AutomationSummary,
  safeMessage: string
): Promise<AutomationStateFile> {
  const item: AutomationLogItem = {
    id: crypto.randomUUID(),
    type: "run_once",
    ok,
    createdAt: new Date().toISOString(),
    summary,
    safeMessage
  };

  return {
    ...state,
    logs: [item, ...state.logs].slice(0, 50)
  };
}
