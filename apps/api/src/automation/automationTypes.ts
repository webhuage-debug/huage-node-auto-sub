export type AutomationSummary = {
  githubRequests: number;
  foundLinks: number;
  addedNodes: number;
  testedNodes: number;
  availableNodes: number;
  subscriptionRebuilt: boolean;
};

export type AutomationLogItem = {
  id: string;
  type: "run_once";
  ok: boolean;
  createdAt: string;
  summary: AutomationSummary;
  safeMessage: string;
};

export type AutomationStateFile = {
  version: 1;
  enabled: boolean;
  intervalMinutes: number;
  running: boolean;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastError: string | null;
  lastSummary: AutomationSummary;
  logs: AutomationLogItem[];
};
