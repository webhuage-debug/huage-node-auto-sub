import type { FastifyReply, FastifyRequest } from "fastify";
import { readSubscriptionFile } from "../subscription/subscriptionStore.js";
import type { ClaimVerifyBody, ClaimVerifyResponse } from "./claimTypes.js";
import {
  clearClaimFailures,
  getClaimClientIp,
  getClaimRateLimitStatus,
  recordClaimFailure
} from "./claimRateLimiter.js";

function getClaimAccessCode(): string | null {
  const value = process.env.CLAIM_ACCESS_CODE?.trim();
  return value || null;
}

function getPublicSubscriptionBaseUrl(): string | null {
  const value = process.env.SUBSCRIPTION_PUBLIC_BASE_URL?.trim();
  return value ? value.replace(/\/+$/g, "") : null;
}

function joinPublicSubscriptionUrl(baseUrl: string, subscriptionPath: string): string {
  const base = baseUrl.replace(/\/+$/g, "");
  const path = subscriptionPath.startsWith("/") ? subscriptionPath : `/${subscriptionPath}`;
  return `${base}${path}`;
}

function isSubscriptionExpired(expiresAt?: string | null): boolean {
  return Boolean(expiresAt && Date.now() >= new Date(expiresAt).getTime());
}

function tooManyAttemptsResponse(retryAfterSeconds: number | null): ClaimVerifyResponse {
  return {
    ok: false,
    error: "CLAIM_TOO_MANY_ATTEMPTS",
    message: "口令错误次数过多，请稍后再试",
    claimAllowed: false,
    subscriptionReady: false,
    retryAfterSeconds: retryAfterSeconds || undefined
  };
}

export async function verifyClaimCodeHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<ClaimVerifyResponse> {
  const clientIp = getClaimClientIp(request);
  const rateLimitStatus = getClaimRateLimitStatus(clientIp);
  if (rateLimitStatus.locked) {
    reply.code(429);
    return tooManyAttemptsResponse(rateLimitStatus.retryAfterSeconds);
  }

  const configuredCode = getClaimAccessCode();
  if (!configuredCode) {
    return {
      ok: false,
      error: "CLAIM_CODE_NOT_CONFIGURED",
      message: "领取口令未配置",
      claimAllowed: false,
      subscriptionReady: false
    };
  }

  const body = request.body as ClaimVerifyBody | undefined;
  const inputCode = typeof body?.code === "string" ? body.code.trim() : "";
  if (inputCode !== configuredCode) {
    const failure = recordClaimFailure(clientIp);
    if (failure.locked) {
      reply.code(429);
      return tooManyAttemptsResponse(failure.retryAfterSeconds);
    }

    return {
      ok: false,
      error: "INVALID_CLAIM_CODE",
      message: "口令错误，请检查视频中的口令",
      claimAllowed: false,
      subscriptionReady: false,
      remainingAttempts: failure.remainingAttempts
    };
  }

  clearClaimFailures(clientIp);

  const file = await readSubscriptionFile();
  const generated = Boolean(file.token && file.lastGeneratedAt);
  if (!generated) {
    return {
      ok: false,
      error: "SUBSCRIPTION_NOT_READY",
      message: "当前订阅暂未生成，请稍后再试",
      claimAllowed: true,
      subscriptionReady: false
    };
  }

  if (isSubscriptionExpired(file.expiresAt)) {
    return {
      ok: false,
      error: "SUBSCRIPTION_EXPIRED",
      message: "当前订阅已过期，请关注新一期视频获取新的领取口令",
      claimAllowed: true,
      subscriptionReady: false
    };
  }

  const publicSubscriptionBaseUrl = getPublicSubscriptionBaseUrl();
  if (!publicSubscriptionBaseUrl) {
    return {
      ok: false,
      error: "PUBLIC_BASE_URL_NOT_CONFIGURED",
      message: "公开订阅域名未配置，请联系管理员",
      claimAllowed: true,
      subscriptionReady: false
    };
  }

  return {
    ok: true,
    message: "口令验证成功",
    claimAllowed: true,
    subscriptionReady: true,
    copyableSubscriptionUrl: joinPublicSubscriptionUrl(publicSubscriptionBaseUrl, `/sub/${file.token}`)
  };
}
