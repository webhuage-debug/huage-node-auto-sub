import { logger } from "../logger.js";
import { rebuildSubscriptionForAutoRefresh } from "./subscriptionService.js";
import type { SubscriptionAutoRefreshRuntime } from "./subscriptionTypes.js";

let timer: ReturnType<typeof setInterval> | null = null;
let nextAutoRefreshAt: string | null = null;
let running = false;

function booleanEnv(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (typeof value !== "string") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

export function getSubscriptionAutoRefreshRuntime(): SubscriptionAutoRefreshRuntime {
  return {
    autoRefreshEnabled: booleanEnv("SUBSCRIPTION_AUTO_REFRESH_ENABLED", true),
    refreshIntervalMinutes: numberEnv("SUBSCRIPTION_REFRESH_INTERVAL_MINUTES", 5),
    nextAutoRefreshAt
  };
}

function computeNextAutoRefreshAt(intervalMinutes: number): string {
  return new Date(Date.now() + intervalMinutes * 60 * 1000).toISOString();
}

async function runAutoRefresh(intervalMinutes: number): Promise<void> {
  if (running) {
    return;
  }

  running = true;
  const nextRunAt = computeNextAutoRefreshAt(intervalMinutes);
  nextAutoRefreshAt = nextRunAt;

  try {
    await rebuildSubscriptionForAutoRefresh(nextRunAt);
  } catch (error) {
    logger.error("subscription auto refresh failed", error);
  } finally {
    running = false;
  }
}

export function startSubscriptionAutoRefresh(): void {
  const runtime = getSubscriptionAutoRefreshRuntime();

  if (!runtime.autoRefreshEnabled || timer) {
    return;
  }

  const intervalMs = runtime.refreshIntervalMinutes * 60 * 1000;
  nextAutoRefreshAt = computeNextAutoRefreshAt(runtime.refreshIntervalMinutes);
  timer = setInterval(() => {
    void runAutoRefresh(runtime.refreshIntervalMinutes);
  }, intervalMs);
}
