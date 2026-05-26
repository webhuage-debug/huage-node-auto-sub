export type CollectorResultSummary = {
  keyword: string;
  repository: string;
  path: string;
  url: string;
  fetchedAt: string;
};

export type GitHubRateLimitSummary = {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
};

type CollectorMemoryState = {
  running: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  rateLimited: boolean;
  rateLimitReason: string | null;
  requestCountThisRun: number;
  lastResults: CollectorResultSummary[];
  githubRateLimit: GitHubRateLimitSummary | null;
};

const state: CollectorMemoryState = {
  running: false,
  lastRunAt: null,
  lastError: null,
  rateLimited: false,
  rateLimitReason: null,
  requestCountThisRun: 0,
  lastResults: [],
  githubRateLimit: null
};

export function getCollectorState(): CollectorMemoryState {
  return {
    ...state,
    lastResults: [...state.lastResults],
    githubRateLimit: state.githubRateLimit ? { ...state.githubRateLimit } : null
  };
}

export function markCollectorStarted(): void {
  state.running = true;
  state.lastRunAt = new Date().toISOString();
  state.lastError = null;
  state.rateLimited = false;
  state.rateLimitReason = null;
  state.requestCountThisRun = 0;
  state.githubRateLimit = null;
}

export function incrementRequestCount(): void {
  state.requestCountThisRun += 1;
}

export function updateGitHubRateLimit(summary: GitHubRateLimitSummary): void {
  state.githubRateLimit = summary;
}

export function markRateLimited(reason: string): void {
  state.rateLimited = true;
  state.rateLimitReason = reason;
}

export function markCollectorFinished(results: CollectorResultSummary[]): void {
  state.running = false;
  state.lastResults = results;
}

export function markCollectorFailed(error: string): void {
  state.running = false;
  state.lastError = error;
}
