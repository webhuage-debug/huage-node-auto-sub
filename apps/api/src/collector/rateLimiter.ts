import { readJsonConfig } from "../utils/readJsonConfig.js";

export type SearchKeywordsConfig = {
  github_search_keywords: string[];
  protocol_keywords: string[];
  exclude_keywords: string[];
  file_keywords: string[];
};

export type CollectorRulesConfig = {
  github: {
    enabled: boolean;
    request_interval_seconds: number;
    max_requests_per_minute: number;
    max_requests_per_hour: number;
    keyword_cooldown_minutes: number;
    repo_cooldown_hours: number;
    result_cache_minutes: number;
    stop_on_rate_limit: boolean;
    backoff_on_403_minutes: number;
    backoff_on_429_minutes: number;
  };
};

export async function readSearchKeywordsConfig(): Promise<SearchKeywordsConfig> {
  return readJsonConfig<SearchKeywordsConfig>("search_keywords.json");
}

export async function readCollectorRulesConfig(): Promise<CollectorRulesConfig> {
  return readJsonConfig<CollectorRulesConfig>("collector_rules.json");
}

export function getMaxKeywordsPerRun(keywordCount: number): number {
  const configured = Number(process.env.GITHUB_SEARCH_MAX_KEYWORDS_PER_RUN || 3);
  const safeConfigured = Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3;
  return Math.min(safeConfigured, keywordCount);
}

export async function waitForRequestInterval(seconds: number): Promise<void> {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return;
  }

  await new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}
