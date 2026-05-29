import type { FastifyRequest } from "fastify";
import { readSubscriptionFile, toSubscriptionStatus } from "../subscription/subscriptionStore.js";
import {
  rebuildSubscriptionHandler,
  resetSubscriptionTokenHandler
} from "../subscription/subscriptionService.js";
import {
  appendReleaseHistory,
  getCurrentClaimCode,
  readReleaseState,
  writeReleaseState
} from "./releaseStore.js";
import type { ReleaseStateFile } from "./releaseTypes.js";

type SetClaimCodeBody = {
  claimCode?: string;
};

function getPublicSubscriptionBaseUrl(): string | null {
  const value = process.env.SUBSCRIPTION_PUBLIC_BASE_URL?.trim();
  return value ? value.replace(/\/+$/g, "") : null;
}

function maskSubscriptionUrl(baseUrl: string | null, generated: boolean): string | null {
  if (!baseUrl || !generated) {
    return null;
  }
  return `${baseUrl}/sub/***masked***`;
}

function getClaimPageUrl(baseUrl: string | null): string | null {
  return baseUrl ? `${baseUrl}/claim` : null;
}

function normalizeClaimCode(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateClaimCode(claimCode: string): string | null {
  if (!claimCode) {
    return "领取口令不能为空";
  }
  if (claimCode.length < 4 || claimCode.length > 32) {
    return "领取口令长度建议为 4-32 个字符";
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(claimCode)) {
    return "领取口令只支持字母、数字、下划线和短横线";
  }
  return null;
}

function buildRandomClaimCode(): string {
  const prefixes = ["huage", "node", "free"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)] || "huage";
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${prefix}${month}${day}`;
}

async function buildReleaseCurrent(state?: ReleaseStateFile) {
  const currentState = state || (await readReleaseState());
  const file = await readSubscriptionFile();
  const status = toSubscriptionStatus(file, false);
  const publicBaseUrl = getPublicSubscriptionBaseUrl();

  return {
    ok: true,
    claimCode: await getCurrentClaimCode(),
    claimPageUrl: getClaimPageUrl(publicBaseUrl),
    subscriptionGenerated: status.generated,
    nodeCount: status.nodeCount,
    targetNodeCount: status.targetNodeCount,
    minNodeCount: status.minNodeCount,
    warning: status.warning,
    subscriptionAccessible: status.subscriptionAccessible,
    expiresAt: status.expiresAt,
    remainingDays: status.remainingDays,
    lastGeneratedAt: status.lastGeneratedAt,
    lastTokenResetAt: currentState.lastTokenResetAt,
    lastSubscriptionRebuildAt: currentState.lastSubscriptionRebuildAt,
    maskedSubscriptionUrl: maskSubscriptionUrl(publicBaseUrl, status.generated),
    publicBaseUrlConfigured: Boolean(publicBaseUrl)
  };
}

export async function getReleaseCurrentHandler() {
  return buildReleaseCurrent();
}

export async function setReleaseClaimCodeHandler(request: FastifyRequest) {
  const body = request.body as SetClaimCodeBody | undefined;
  const claimCode = normalizeClaimCode(body?.claimCode);
  const validationError = validateClaimCode(claimCode);
  if (validationError) {
    return {
      ok: false,
      error: "INVALID_CLAIM_CODE",
      message: validationError
    };
  }

  const state = await readReleaseState();
  const nextState = await appendReleaseHistory(
    {
      ...state,
      claimCode
    },
    "set_claim_code",
    "手动设置本期领取口令",
    { claimCode }
  );
  await writeReleaseState(nextState);

  return {
    ...(await buildReleaseCurrent(nextState)),
    message: "本期领取口令已更新"
  };
}

export async function randomReleaseClaimCodeHandler() {
  const claimCode = buildRandomClaimCode();
  const state = await readReleaseState();
  const nextState = await appendReleaseHistory(
    {
      ...state,
      claimCode
    },
    "random_claim_code",
    "随机生成本期领取口令",
    { claimCode }
  );
  await writeReleaseState(nextState);

  return {
    ...(await buildReleaseCurrent(nextState)),
    message: "本期领取口令已随机生成"
  };
}

export async function resetReleaseSubscriptionTokenHandler() {
  await resetSubscriptionTokenHandler();
  const now = new Date().toISOString();
  const state = await readReleaseState();
  const file = await readSubscriptionFile();
  const nextState = await appendReleaseHistory(
    {
      ...state,
      lastTokenResetAt: now
    },
    "reset_subscription_token",
    "重置安全订阅 token",
    { nodeCount: file.nodeCount }
  );
  await writeReleaseState(nextState);

  return {
    ...(await buildReleaseCurrent(nextState)),
    message: "安全订阅 token 已重置"
  };
}

export async function rebuildReleaseSubscriptionHandler() {
  await rebuildSubscriptionHandler();
  const now = new Date().toISOString();
  const state = await readReleaseState();
  const file = await readSubscriptionFile();
  const nextState = await appendReleaseHistory(
    {
      ...state,
      lastSubscriptionRebuildAt: now
    },
    "rebuild_subscription",
    "刷新安全订阅",
    { nodeCount: file.nodeCount }
  );
  await writeReleaseState(nextState);

  return {
    ...(await buildReleaseCurrent(nextState)),
    message: "安全订阅已刷新"
  };
}

export async function getReleaseHistoryHandler() {
  const state = await readReleaseState();
  return {
    ok: true,
    items: state.history.slice(0, 50)
  };
}
