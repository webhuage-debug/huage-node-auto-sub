import { appConfig } from "../config.js";
import { readSubscriptionFile, toSubscriptionStatus } from "../subscription/subscriptionStore.js";
import type { PublishCheckItem, PublishCheckResponse, PublishCheckStatus } from "./publishCheckTypes.js";

const REQUEST_TIMEOUT_MS = 5000;

function getPublicSubscriptionBaseUrl(): string | null {
  const value = process.env.SUBSCRIPTION_PUBLIC_BASE_URL?.trim();
  return value ? value.replace(/\/+$/g, "") : null;
}

function hasClaimAccessCode(): boolean {
  return Boolean(process.env.CLAIM_ACCESS_CODE?.trim());
}

function joinPublicPath(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/g, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
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

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

function publicBaseCheck(publicBaseUrl: string | null): PublishCheckItem {
  return publicBaseUrl
    ? {
        key: "publicBaseUrl",
        label: "公开订阅域名",
        status: "pass",
        message: `公开订阅域名已配置：${publicBaseUrl}`
      }
    : {
        key: "publicBaseUrl",
        label: "公开订阅域名",
        status: "fail",
        message: "未配置 SUBSCRIPTION_PUBLIC_BASE_URL"
      };
}

async function checkClaimPage(publicBaseUrl: string | null): Promise<PublishCheckItem> {
  if (!publicBaseUrl) {
    return {
      key: "publicClaimPage",
      label: "公开领取页",
      status: "warning",
      message: "公开订阅域名未配置，无法检查 /claim"
    };
  }

  const url = joinPublicPath(publicBaseUrl, "/claim");
  try {
    const response = await fetchWithTimeout(url, { method: "HEAD" });
    return response.status === 200
      ? {
          key: "publicClaimPage",
          label: "公开领取页",
          status: "pass",
          message: "/claim 可访问，返回 200"
        }
      : {
          key: "publicClaimPage",
          label: "公开领取页",
          status: "fail",
          message: `/claim 返回 ${response.status}，预期 200`
        };
  } catch (error) {
    return {
      key: "publicClaimPage",
      label: "公开领取页",
      status: "warning",
      message: `服务端网络检查失败：${getErrorMessage(error)}`
    };
  }
}

async function checkClaimVerify(publicBaseUrl: string | null): Promise<PublishCheckItem> {
  if (!publicBaseUrl) {
    return {
      key: "publicClaimVerify",
      label: "公开验证接口",
      status: "warning",
      message: "公开订阅域名未配置，无法检查 /api/claim/verify"
    };
  }

  const url = joinPublicPath(publicBaseUrl, "/api/claim/verify");
  try {
    const response = await fetchWithTimeout(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code: "__publish_check_probe__" })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (payload?.error === "INVALID_CLAIM_CODE") {
      return {
        key: "publicClaimVerify",
        label: "公开口令验证接口",
        status: "pass",
        message: "领取验证接口可达，错误口令返回预期结果",
        detail: "INVALID_CLAIM_CODE"
      };
    }

    if (payload?.error === "CLAIM_TOO_MANY_ATTEMPTS") {
      return {
        key: "publicClaimVerify",
        label: "公开口令验证接口",
        status: "warning",
        message: "领取验证接口可达，但当前已进入防刷冷却期，稍后再试。",
        detail: "CLAIM_TOO_MANY_ATTEMPTS"
      };
    }

    if (response.status === 404) {
      return {
        key: "publicClaimVerify",
        label: "公开口令验证接口",
        status: "fail",
        message: "/api/claim/verify 返回 404，公开领取页无法验证口令",
        detail: "HTTP_404"
      };
    }

    if (response.status >= 500) {
      return {
        key: "publicClaimVerify",
        label: "公开口令验证接口",
        status: "fail",
        message: `/api/claim/verify 返回 ${response.status}，公开验证接口异常`,
        detail: `HTTP_${response.status}`
      };
    }

    return {
      key: "publicClaimVerify",
      label: "公开口令验证接口",
      status: "warning",
      message: `/api/claim/verify 返回 ${response.status}，未识别为预期错误码`,
      detail: payload?.error || `HTTP_${response.status}`
    };
  } catch (error) {
    return {
      key: "publicClaimVerify",
      label: "公开口令验证接口",
      status: "warning",
      message: `服务端网络检查失败：${getErrorMessage(error)}`,
      detail: "NETWORK_CHECK_FAILED"
    };
  }
}

async function checkBlockedPublicApi(publicBaseUrl: string | null): Promise<PublishCheckItem> {
  const paths = [
    "/api/status",
    "/api/subscription/status",
    "/api/node-pool/status",
    "/api/detection/xray/status"
  ];

  if (!publicBaseUrl) {
    return {
      key: "publicApiBlocked",
      label: "后台 API 暴露检查",
      status: "warning",
      message: "公开订阅域名未配置，无法检查后台 API 暴露"
    };
  }

  try {
    const results = await Promise.all(
      paths.map(async (path) => {
        const response = await fetchWithTimeout(joinPublicPath(publicBaseUrl, path), { method: "HEAD" });
        return { path, status: response.status };
      })
    );
    const exposed = results.filter((item) => item.status !== 404);

    return exposed.length === 0
      ? {
          key: "publicApiBlocked",
          label: "后台 API 暴露检查",
          status: "pass",
          message: "公开域名下后台 API 均返回 404"
        }
      : {
          key: "publicApiBlocked",
          label: "后台 API 暴露检查",
          status: "fail",
          message: `存在未被 404 阻止的后台 API：${exposed.map((item) => `${item.path}=${item.status}`).join("，")}`
        };
  } catch (error) {
    return {
      key: "publicApiBlocked",
      label: "后台 API 暴露检查",
      status: "warning",
      message: `服务端网络检查失败：${getErrorMessage(error)}`
    };
  }
}

function summarizeLevel(checks: PublishCheckItem[]): { canPublish: boolean; level: PublishCheckStatus; summary: string } {
  const hasFail = checks.some((item) => item.status === "fail");
  const hasWarning = checks.some((item) => item.status === "warning");

  if (hasFail) {
    return {
      canPublish: false,
      level: "fail",
      summary: "暂不建议发布，存在失败项"
    };
  }

  if (hasWarning) {
    return {
      canPublish: true,
      level: "warning",
      summary: "可以发布，但存在警告项"
    };
  }

  return {
    canPublish: true,
    level: "pass",
    summary: "可以发布，检查项全部通过"
  };
}

export async function getPublishCheckStatusHandler(): Promise<PublishCheckResponse> {
  const publicBaseUrl = getPublicSubscriptionBaseUrl();
  const subscriptionStatus = toSubscriptionStatus(await readSubscriptionFile());
  const checks: PublishCheckItem[] = [
    {
      key: "systemVersion",
      label: "系统版本",
      status: appConfig.version === "v0.8.4" ? "pass" : "warning",
      message: `当前版本：${appConfig.version}`
    },
    {
      key: "subscriptionGenerated",
      label: "订阅已生成",
      status: subscriptionStatus.generated ? "pass" : "fail",
      message: subscriptionStatus.generated ? "安全订阅已生成" : "安全订阅尚未生成"
    },
    {
      key: "subscriptionExpiration",
      label: "订阅有效期",
      status: subscriptionStatus.expired ? "fail" : subscriptionStatus.remainingDays < 3 ? "warning" : "pass",
      message: subscriptionStatus.expired
        ? `订阅已过期，到期时间：${subscriptionStatus.expiresAt || "暂无"}`
        : `到期时间：${subscriptionStatus.expiresAt || "暂无"}，剩余 ${subscriptionStatus.remainingDays} 天`
    },
    {
      key: "nodeCount",
      label: "订阅节点数量",
      status:
        subscriptionStatus.nodeCount === 0
          ? "fail"
          : subscriptionStatus.nodeCount < subscriptionStatus.minNodeCount
            ? "warning"
            : "pass",
      message: `当前 ${subscriptionStatus.nodeCount} 条，最低保底 ${subscriptionStatus.minNodeCount} 条`
    },
    publicBaseCheck(publicBaseUrl),
    {
      key: "copyableSubscriptionUrlReady",
      label: "复制链接准备",
      status: publicBaseUrl && subscriptionStatus.safeSubscriptionUrl && !subscriptionStatus.expired ? "pass" : "fail",
      message: publicBaseUrl && subscriptionStatus.safeSubscriptionUrl && !subscriptionStatus.expired
        ? "公开订阅链接可复制"
        : "公开订阅链接尚未准备好"
    },
    {
      key: "claimCodeConfigured",
      label: "领取口令配置",
      status: hasClaimAccessCode() ? "pass" : "fail",
      message: hasClaimAccessCode() ? "领取口令已配置" : "未配置 CLAIM_ACCESS_CODE"
    },
    await checkClaimPage(publicBaseUrl),
    await checkClaimVerify(publicBaseUrl),
    await checkBlockedPublicApi(publicBaseUrl)
  ];
  const summary = summarizeLevel(checks);

  return {
    ok: true,
    version: appConfig.version,
    ...summary,
    checks,
    reminders: [
      "正式发布前建议最后重置一次安全订阅 token",
      "确认 CLAIM_ACCESS_CODE 已改成本期视频口令",
      "公开领取页只应该暴露 /claim、/assets/*、/api/claim/verify 和 /sub/*"
    ]
  };
}
