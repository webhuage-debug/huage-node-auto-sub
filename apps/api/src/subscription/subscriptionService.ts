import type { FastifyReply, FastifyRequest } from "fastify";
import { listSubscriptionCandidateNodes } from "../nodePool/nodeStore.js";
import { getSubscriptionAutoRefreshRuntime } from "./subscriptionAutoRefresh.js";
import { createSubscriptionToken, readSubscriptionFile, toSubscriptionStatus, writeSubscriptionFile } from "./subscriptionStore.js";
import type { SubscriptionFile, SubscriptionStatus } from "./subscriptionTypes.js";

type SubscriptionTokenParams = {
  token?: string;
};

type RebuildSource = "manual" | "auto";

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getSubscriptionSettings() {
  return {
    targetNodeCount: numberEnv("SUBSCRIPTION_TARGET_NODE_COUNT", 20),
    minNodeCount: numberEnv("SUBSCRIPTION_MIN_NODE_COUNT", 10)
  };
}

function getPublicSubscriptionBaseUrl(): string | null {
  const value = process.env.SUBSCRIPTION_PUBLIC_BASE_URL?.trim();
  if (!value) {
    return null;
  }
  return value.replace(/\/+$/g, "");
}

function withPublicSubscriptionConfig(status: SubscriptionStatus): SubscriptionStatus {
  const publicSubscriptionBaseUrl = getPublicSubscriptionBaseUrl();
  return {
    ...status,
    publicBaseUrlConfigured: Boolean(publicSubscriptionBaseUrl),
    publicSubscriptionBaseUrl,
    copyableSubscriptionUrlReady: Boolean(publicSubscriptionBaseUrl && status.safeSubscriptionUrl)
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "未知错误";
}

function buildWarning(nodeCount: number, targetNodeCount: number, minNodeCount: number): string | null {
  if (nodeCount < minNodeCount) {
    return `当前可用节点不足 ${minNodeCount} 条，已生成保底订阅但建议继续补充节点。`;
  }
  if (nodeCount < targetNodeCount) {
    return `当前可用节点不足 ${targetNodeCount} 条。`;
  }
  return null;
}

function withAutoRefreshResult(
  file: SubscriptionFile,
  result: {
    ranAt: string;
    ok: boolean;
    warning: string | null;
    error: string | null;
    nextAutoRefreshAt: string | null;
  }
): SubscriptionFile {
  return {
    ...file,
    lastAutoRefreshAt: result.ranAt,
    nextAutoRefreshAt: result.nextAutoRefreshAt,
    lastAutoRefreshOk: result.ok,
    lastAutoRefreshWarning: result.warning,
    lastAutoRefreshError: result.error
  };
}

export async function getSubscriptionStatusHandler() {
  const file = await readSubscriptionFile();
  return withPublicSubscriptionConfig(toSubscriptionStatus(file, false, getSubscriptionAutoRefreshRuntime()));
}

export async function rebuildSubscriptionCache(
  source: RebuildSource,
  nextAutoRefreshAt: string | null = null
): Promise<{ file: SubscriptionFile; tokenCreated: boolean }> {
  const previous = await readSubscriptionFile();
  const settings = getSubscriptionSettings();
  const nodes = await listSubscriptionCandidateNodes(settings.targetNodeCount);
  const ranAt = new Date().toISOString();

  if (source === "auto" && nodes.length === 0) {
    const warning = "当前可用节点为 0，自动刷新已保留上一次订阅缓存。";
    const preserved = withAutoRefreshResult(
      {
        ...previous,
        targetNodeCount: settings.targetNodeCount,
        minNodeCount: settings.minNodeCount,
        warning
      },
      {
        ranAt,
        ok: true,
        warning,
        error: null,
        nextAutoRefreshAt
      }
    );
    await writeSubscriptionFile(preserved);
    return { file: preserved, tokenCreated: false };
  }

  const tokenCreated = !previous.token;
  const token = previous.token || createSubscriptionToken();
  const contentBase64 = Buffer.from(nodes.map((node) => node.raw).join("\n"), "utf8").toString("base64");
  const warning = buildWarning(nodes.length, settings.targetNodeCount, settings.minNodeCount);
  const nextFile: SubscriptionFile = {
    ...previous,
    version: 1,
    token,
    contentBase64,
    nodeCount: nodes.length,
    targetNodeCount: settings.targetNodeCount,
    minNodeCount: settings.minNodeCount,
    lastGeneratedAt: ranAt,
    warning
  };

  const file =
    source === "auto"
      ? withAutoRefreshResult(nextFile, {
          ranAt,
          ok: true,
          warning,
          error: null,
          nextAutoRefreshAt
        })
      : nextFile;

  await writeSubscriptionFile(file);
  return { file, tokenCreated };
}

export async function rebuildSubscriptionForAutoRefresh(nextAutoRefreshAt: string | null): Promise<SubscriptionFile> {
  try {
    const { file } = await rebuildSubscriptionCache("auto", nextAutoRefreshAt);
    return file;
  } catch (error) {
    const previous = await readSubscriptionFile();
    const failed = withAutoRefreshResult(previous, {
      ranAt: new Date().toISOString(),
      ok: false,
      warning: null,
      error: getErrorMessage(error),
      nextAutoRefreshAt
    });
    await writeSubscriptionFile(failed);
    return failed;
  }
}

export async function rebuildSubscriptionHandler() {
  const { file, tokenCreated } = await rebuildSubscriptionCache("manual");
  return withPublicSubscriptionConfig(toSubscriptionStatus(file, tokenCreated, getSubscriptionAutoRefreshRuntime()));
}

export async function resetSubscriptionTokenHandler() {
  const previous = await readSubscriptionFile();
  const settings = getSubscriptionSettings();
  const now = new Date().toISOString();
  const newToken = createSubscriptionToken();
  const hasExistingCache = Boolean(previous.token && previous.lastGeneratedAt);
  let nextFile: SubscriptionFile;

  if (hasExistingCache) {
    nextFile = {
      ...previous,
      token: newToken,
      targetNodeCount: settings.targetNodeCount,
      minNodeCount: settings.minNodeCount,
      lastGeneratedAt: now
    };
  } else {
    const nodes = await listSubscriptionCandidateNodes(settings.targetNodeCount);
    const warning = buildWarning(nodes.length, settings.targetNodeCount, settings.minNodeCount);
    nextFile = {
      ...previous,
      version: 1,
      token: newToken,
      contentBase64: Buffer.from(nodes.map((node) => node.raw).join("\n"), "utf8").toString("base64"),
      nodeCount: nodes.length,
      targetNodeCount: settings.targetNodeCount,
      minNodeCount: settings.minNodeCount,
      lastGeneratedAt: now,
      warning
    };
  }

  await writeSubscriptionFile(nextFile);
  return {
    ...withPublicSubscriptionConfig(toSubscriptionStatus(nextFile, true, getSubscriptionAutoRefreshRuntime())),
    message: "安全订阅链接已重置"
  };
}

export async function publicSubscriptionHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as SubscriptionTokenParams;
  const file = await readSubscriptionFile();

  if (!file.token || params.token !== file.token) {
    reply.code(404);
    return {
      ok: false,
      error: "SUBSCRIPTION_NOT_FOUND"
    };
  }

  reply.header("Content-Type", "text/plain; charset=utf-8");
  return file.contentBase64;
}
