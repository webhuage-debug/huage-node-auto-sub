import type { FastifyReply } from "fastify";
import {
  getCollectorState,
  incrementRequestCount,
  markCollectorFailed,
  markCollectorFinished,
  markCollectorStarted,
  markRateLimited,
  updateGitHubRateLimit,
  type CollectorResultSummary
} from "./collectorState.js";
import {
  getMaxKeywordsPerRun,
  readCollectorRulesConfig,
  readSearchKeywordsConfig,
  waitForRequestInterval
} from "./rateLimiter.js";

type GitHubApiItem = {
  html_url?: string;
  path?: string;
  full_name?: string;
  repository?: {
    full_name?: string;
  };
};

type GitHubApiResponse = {
  message?: string;
  items?: GitHubApiItem[];
};

function isGitHubTokenConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim());
}

function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message.replace(/token\s+[A-Za-z0-9_\-.]+/gi, "token [redacted]");
  }
  return "未知错误";
}

function buildGitHubRequest(keyword: string, tokenConfigured: boolean): string {
  if (tokenConfigured) {
    const query = `${keyword} in:file`;
    return `https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=5`;
  }

  return `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&per_page=5`;
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "huage-node-auto-sub"
  };

  if (isGitHubTokenConfigured()) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function collectRateLimitHeaders(response: { headers: { get(name: string): string | null } }) {
  return {
    limit: response.headers.get("x-ratelimit-limit"),
    remaining: response.headers.get("x-ratelimit-remaining"),
    reset: response.headers.get("x-ratelimit-reset")
  };
}

function summarizeItems(keyword: string, items: GitHubApiItem[]): CollectorResultSummary[] {
  const fetchedAt = new Date().toISOString();

  return items.map((item) => ({
    keyword,
    repository: item.repository?.full_name || item.full_name || "unknown",
    path: item.path || "repository",
    url: item.html_url || "",
    fetchedAt
  }));
}

export async function getCollectorStatus() {
  const [keywordsConfig, rulesConfig] = await Promise.all([
    readSearchKeywordsConfig(),
    readCollectorRulesConfig()
  ]);
  const currentState = getCollectorState();
  const githubRules = rulesConfig.github;

  return {
    enabled: Boolean(githubRules.enabled),
    mode: "manual",
    keywordCount: keywordsConfig.github_search_keywords.length,
    requestIntervalSeconds: githubRules.request_interval_seconds,
    maxRequestsPerMinute: githubRules.max_requests_per_minute,
    maxRequestsPerHour: githubRules.max_requests_per_hour,
    backoffOn403Minutes: githubRules.backoff_on_403_minutes,
    backoffOn429Minutes: githubRules.backoff_on_429_minutes,
    githubTokenConfigured: isGitHubTokenConfigured(),
    running: currentState.running,
    lastRunAt: currentState.lastRunAt,
    lastError: currentState.lastError,
    rateLimited: currentState.rateLimited,
    rateLimitReason: currentState.rateLimitReason,
    requestCountThisRun: currentState.requestCountThisRun,
    lastResultCount: currentState.lastResults.length,
    githubRateLimit: currentState.githubRateLimit
  };
}

export async function runGitHubSearchOnce(reply?: FastifyReply) {
  const currentState = getCollectorState();

  if (currentState.running) {
    if (reply) {
      reply.code(409);
    }
    return {
      ok: false,
      error: "GitHub 采集正在运行中，请等待本轮完成。"
    };
  }

  const [keywordsConfig, rulesConfig] = await Promise.all([
    readSearchKeywordsConfig(),
    readCollectorRulesConfig()
  ]);
  const githubRules = rulesConfig.github;
  const keywords = keywordsConfig.github_search_keywords.slice(
    0,
    getMaxKeywordsPerRun(keywordsConfig.github_search_keywords.length)
  );
  const tokenConfigured = isGitHubTokenConfigured();
  const results: CollectorResultSummary[] = [];
  const searchedKeywords: string[] = [];

  markCollectorStarted();

  try {
    for (let index = 0; index < keywords.length; index += 1) {
      const keyword = keywords[index];
      searchedKeywords.push(keyword);

      const response = await fetch(buildGitHubRequest(keyword, tokenConfigured), {
        headers: buildHeaders()
      });
      incrementRequestCount();
      updateGitHubRateLimit(collectRateLimitHeaders(response));

      const payload = (await response.json().catch(() => ({}))) as GitHubApiResponse;

      if (response.status === 403 || response.status === 429) {
        const reason = `GitHub API 返回 ${response.status}${payload.message ? `：${payload.message}` : ""}`;
        markRateLimited(reason);
        break;
      }

      if (!response.ok) {
        throw new Error(`GitHub API 返回 ${response.status}${payload.message ? `：${payload.message}` : ""}`);
      }

      results.push(...summarizeItems(keyword, Array.isArray(payload.items) ? payload.items : []));

      if (index < keywords.length - 1) {
        await waitForRequestInterval(githubRules.request_interval_seconds);
      }
    }

    const finishedState = getCollectorState();
    markCollectorFinished(results);

    return {
      ok: true,
      searchedKeywords,
      requestCount: finishedState.requestCountThisRun,
      resultCount: results.length,
      rateLimited: finishedState.rateLimited,
      rateLimitReason: finishedState.rateLimitReason,
      githubRateLimit: finishedState.githubRateLimit,
      results
    };
  } catch (error) {
    const safeError = getSafeErrorMessage(error);
    markCollectorFailed(safeError);

    if (reply) {
      reply.code(502);
    }

    return {
      ok: false,
      error: safeError,
      searchedKeywords,
      requestCount: getCollectorState().requestCountThisRun,
      resultCount: results.length,
      results
    };
  }
}

export function getLastCollectorResults() {
  const currentState = getCollectorState();

  return {
    ok: true,
    lastRunAt: currentState.lastRunAt,
    resultCount: currentState.lastResults.length,
    results: currentState.lastResults
  };
}
