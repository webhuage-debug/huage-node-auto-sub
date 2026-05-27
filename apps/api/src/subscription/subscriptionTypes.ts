export type SubscriptionFile = {
  version: 1;
  token: string | null;
  contentBase64: string;
  nodeCount: number;
  targetNodeCount: number;
  minNodeCount: number;
  lastGeneratedAt: string | null;
  warning: string | null;
  lastAutoRefreshAt?: string | null;
  nextAutoRefreshAt?: string | null;
  lastAutoRefreshOk?: boolean | null;
  lastAutoRefreshWarning?: string | null;
  lastAutoRefreshError?: string | null;
};

export type SubscriptionStatus = {
  ok: true;
  generated: boolean;
  tokenCreated: boolean;
  safeSubscriptionUrl: string | null;
  nodeCount: number;
  targetNodeCount: number;
  minNodeCount: number;
  lastGeneratedAt: string | null;
  warning: string | null;
  autoRefreshEnabled: boolean;
  refreshIntervalMinutes: number;
  lastAutoRefreshAt: string | null;
  nextAutoRefreshAt: string | null;
  lastAutoRefreshOk: boolean | null;
  lastAutoRefreshWarning: string | null;
  lastAutoRefreshError: string | null;
};

export type SubscriptionAutoRefreshRuntime = {
  autoRefreshEnabled: boolean;
  refreshIntervalMinutes: number;
  nextAutoRefreshAt: string | null;
};
