import type { FastifyRequest } from "fastify";
import { runGitHubSearchOnce } from "../collector/githubCollector.js";
import { runUntestedXrayDetection } from "../detection/detectionService.js";
import { getNodePoolStatus } from "../nodePool/nodeStore.js";
import { parseLastGitHubResultsHandler } from "../nodePool/nodePoolService.js";
import { rebuildSubscriptionHandler } from "../subscription/subscriptionService.js";
import { readSubscriptionFile } from "../subscription/subscriptionStore.js";
import {
  appendAutomationLog,
  emptyAutomationSummary,
  readAutomationState,
  writeAutomationState
} from "./automationStore.js";
import type { AutomationStateFile, AutomationSummary } from "./automationTypes.js";

type AutomationSettingsBody = {
  intervalMinutes?: number;
};

let timer: ReturnType<typeof setInterval> | null = null;

function normalizeIntervalMinutes(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 30;
  }
  return Math.min(Math.max(Math.floor(parsed), 5), 1440);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/token\s+[A-Za-z0-9_\-.]+/gi, "token [redacted]");
  }
  if (typeof error === "string") {
    return error;
  }
  return "未知错误";
}

function publicState(state: AutomationStateFile) {
  return {
    enabled: state.enabled,
    running: state.running,
    intervalMinutes: state.intervalMinutes,
    lastRunAt: state.lastRunAt,
    lastRunOk: state.lastRunOk,
    lastError: state.lastError,
    lastSummary: state.lastSummary || emptyAutomationSummary
  };
}

async function saveRunningState(running: boolean): Promise<AutomationStateFile> {
  const state = await readAutomationState();
  const nextState = {
    ...state,
    running
  };
  await writeAutomationState(nextState);
  return nextState;
}

function startTimer(intervalMinutes: number): void {
  stopTimer();
  timer = setInterval(() => {
    void runAutomationOnceInternal("auto");
  }, intervalMinutes * 60 * 1000);
}

function stopTimer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

export async function startAutomationScheduler(): Promise<void> {
  const state = await saveRunningState(false);
  if (state.enabled) {
    startTimer(state.intervalMinutes);
  }
}

async function runAutomationOnceInternal(source: "manual" | "auto") {
  const state = await readAutomationState();
  if (state.running) {
    return {
      ok: false,
      error: "AUTOMATION_RUNNING",
      message: "已有自动化任务正在运行"
    };
  }

  const startedAt = new Date().toISOString();
  const startedState = {
    ...state,
    running: true,
    lastError: null
  };
  await writeAutomationState(startedState);

  let summary: AutomationSummary = { ...emptyAutomationSummary };

  try {
    const beforeStatus = await getNodePoolStatus();
    const githubResult = await runGitHubSearchOnce();
    const githubSummary = githubResult as { ok: boolean; error?: string; requestCount?: number; resultCount?: number };
    if (githubSummary.ok === false) {
      throw new Error(githubSummary.error || "GitHub 搜索失败");
    }
    summary.githubRequests = Number(githubSummary.requestCount || 0);
    summary.foundLinks = Number(githubSummary.resultCount || 0);

    const parseResult = await parseLastGitHubResultsHandler(20);
    summary.addedNodes = Number(parseResult.inserted || 0);

    const detectionResult = await runUntestedXrayDetection(5);
    if (detectionResult.ok !== false) {
      const detectionSummary = detectionResult as { tested?: number; available?: number };
      summary.testedNodes = Number(detectionSummary.tested || 0);
      summary.availableNodes = Number(detectionSummary.available || 0);
    }

    const afterStatus = await getNodePoolStatus();
    const subscriptionFile = await readSubscriptionFile();
    const shouldRebuild =
      summary.availableNodes > 0 && (afterStatus.available !== beforeStatus.available || afterStatus.available < subscriptionFile.minNodeCount);

    if (shouldRebuild) {
      await rebuildSubscriptionHandler();
      summary.subscriptionRebuilt = true;
    }

    const latestState = await readAutomationState();
    const withLog = await appendAutomationLog(
      {
        ...latestState,
        running: false,
        lastRunAt: startedAt,
        lastRunOk: true,
        lastError: null,
        lastSummary: summary
      },
      true,
      summary,
      source === "auto" ? "自动化定时运行完成" : "手动自动化运行完成"
    );
    await writeAutomationState(withLog);

    return {
      ok: true,
      ...publicState(withLog)
    };
  } catch (error) {
    const safeError = getErrorMessage(error);
    const latestState = await readAutomationState();
    const withLog = await appendAutomationLog(
      {
        ...latestState,
        running: false,
        lastRunAt: startedAt,
        lastRunOk: false,
        lastError: safeError,
        lastSummary: summary
      },
      false,
      summary,
      "自动化运行失败"
    );
    await writeAutomationState(withLog);

    return {
      ok: false,
      error: "AUTOMATION_FAILED",
      message: safeError,
      ...publicState(withLog)
    };
  }
}

export async function getAutomationStatusHandler() {
  return publicState(await readAutomationState());
}

export async function enableAutomationHandler() {
  const state = await readAutomationState();
  const nextState = {
    ...state,
    enabled: true
  };
  await writeAutomationState(nextState);
  startTimer(nextState.intervalMinutes);
  return publicState(nextState);
}

export async function disableAutomationHandler() {
  const state = await readAutomationState();
  const nextState = {
    ...state,
    enabled: false
  };
  await writeAutomationState(nextState);
  stopTimer();
  return publicState(nextState);
}

export async function runAutomationOnceHandler() {
  return runAutomationOnceInternal("manual");
}

export async function updateAutomationSettingsHandler(request: FastifyRequest) {
  const body = request.body as AutomationSettingsBody | undefined;
  const state = await readAutomationState();
  const nextState = {
    ...state,
    intervalMinutes: normalizeIntervalMinutes(body?.intervalMinutes)
  };
  await writeAutomationState(nextState);
  if (nextState.enabled) {
    startTimer(nextState.intervalMinutes);
  }
  return publicState(nextState);
}

export async function getAutomationLogsHandler() {
  const state = await readAutomationState();
  return {
    ok: true,
    items: state.logs.slice(0, 50)
  };
}
