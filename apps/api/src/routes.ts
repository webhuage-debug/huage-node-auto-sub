import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { appConfig, getConfigDir } from "./config.js";
import {
  getCollectorStatus,
  getLastCollectorResults,
  runGitHubSearchOnce
} from "./collector/githubCollector.js";
import {
  getNodePoolStatusHandler,
  getParseHistoryHandler,
  clearNodePoolHandler,
  importTextHandler,
  listNodesHandler,
  parseLastGitHubResultsHandler,
  updateNodeManualStatusHandler
} from "./nodePool/nodePoolService.js";
import {
  getDetectionHistoryHandler,
  getXrayDetectionStatus,
  testOneNodeHandler,
  testUntestedNodesHandler
} from "./detection/detectionService.js";
import {
  getSubscriptionStatusHandler,
  publicSubscriptionHandler,
  rebuildSubscriptionHandler
} from "./subscription/subscriptionService.js";

type JsonRecord = Record<string, unknown>;

const configFiles = [
  "search_keywords.json",
  "collector_rules.json",
  "core_sources.json",
  "default_settings.json"
] as const;

async function readJsonFile(filePath: string): Promise<JsonRecord> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as JsonRecord;
}

function summarizeConfig(fileName: string, content: JsonRecord): JsonRecord {
  if (fileName === "search_keywords.json") {
    return {
      githubSearchKeywordCount: Array.isArray(content.github_search_keywords) ? content.github_search_keywords.length : 0,
      protocolKeywordCount: Array.isArray(content.protocol_keywords) ? content.protocol_keywords.length : 0,
      excludeKeywordCount: Array.isArray(content.exclude_keywords) ? content.exclude_keywords.length : 0,
      fileKeywordCount: Array.isArray(content.file_keywords) ? content.file_keywords.length : 0
    };
  }

  if (fileName === "collector_rules.json") {
    const github = content.github as JsonRecord | undefined;
    return {
      githubEnabled: Boolean(github?.enabled),
      requestIntervalSeconds: github?.request_interval_seconds,
      maxRequestsPerMinute: github?.max_requests_per_minute,
      maxRequestsPerHour: github?.max_requests_per_hour,
      stopOnRateLimit: github?.stop_on_rate_limit
    };
  }

  if (fileName === "core_sources.json") {
    const cores = Array.isArray(content.cores) ? content.cores : [];
    return {
      coreCount: cores.length,
      cores: cores.map((core) => {
        const item = core as JsonRecord;
        return {
          key: item.key,
          displayName: item.display_name,
          platform: item.platform,
          arch: item.arch,
          enabled: item.enabled
        };
      })
    };
  }

  const automation = content.automation as JsonRecord | undefined;
  const subscription = content.subscription as JsonRecord | undefined;
  const detection = content.detection as JsonRecord | undefined;
  return {
    automationEnabled: automation?.enabled,
    collectIntervalMinutes: automation?.collect_interval_minutes,
    subscriptionRefreshIntervalMinutes: automation?.subscription_refresh_interval_minutes,
    targetNodeCount: subscription?.target_node_count,
    minimumNodeCount: subscription?.minimum_node_count,
    validDays: subscription?.valid_days,
    preferredCore: detection?.preferred_core,
    detectionTimeoutSeconds: detection?.timeout_seconds,
    detectionMaxConcurrent: detection?.max_concurrent
  };
}

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async () => ({ ok: true }));

  app.get("/api/status", async () => ({
    name: appConfig.name,
    version: appConfig.version,
    mode: "node-pool",
    automationEnabled: false
  }));

  app.get("/api/config-preview", async () => {
    const configDir = getConfigDir();
    const summaries: JsonRecord = {};

    for (const fileName of configFiles) {
      const filePath = path.join(configDir, fileName);
      const content = await readJsonFile(filePath);
      summaries[fileName] = summarizeConfig(fileName, content);
    }

    return {
      safe: true,
      note: "仅返回 config 目录配置摘要，不读取 .env 或任何密钥。",
      files: summaries
    };
  });

  app.get("/api/collector/status", async () => getCollectorStatus());

  app.post("/api/collector/github/search-once", async (_request, reply) => {
    return runGitHubSearchOnce(reply);
  });

  app.get("/api/collector/results", async () => getLastCollectorResults());

  app.get("/api/node-pool/status", async () => getNodePoolStatusHandler());

  app.get("/api/node-pool/nodes", async (request) => listNodesHandler(request));

  app.post("/api/node-pool/nodes/:id/manual-status", async (request, reply) => updateNodeManualStatusHandler(request, reply));

  app.post("/api/node-pool/import-text", async (request, reply) => importTextHandler(request, reply));

  app.post("/api/node-pool/parse-last-github-results", async () => parseLastGitHubResultsHandler());

  app.get("/api/node-pool/parse-history", async () => getParseHistoryHandler());

  app.post("/api/node-pool/clear", async () => clearNodePoolHandler());

  app.get("/api/subscription/status", async () => getSubscriptionStatusHandler());

  app.post("/api/subscription/rebuild", async () => rebuildSubscriptionHandler());

  app.get("/sub/:token", async (request, reply) => publicSubscriptionHandler(request, reply));

  app.get("/api/detection/xray/status", async () => getXrayDetectionStatus());

  app.post("/api/detection/xray/test-one", async (request, reply) => testOneNodeHandler(request, reply));

  app.post("/api/detection/xray/test-untested", async (request, reply) => testUntestedNodesHandler(request, reply));

  app.get("/api/detection/history", async () => getDetectionHistoryHandler());
}
