import type { FastifyReply, FastifyRequest } from "fastify";
import { getLastCollectorResults } from "../collector/githubCollector.js";
import { readLimitedGitHubContents } from "./githubContentResolver.js";
import { createNodeFromRaw, emptyProtocolStats, parseNodeRawsFromText } from "./nodeParser.js";
import { clearNodePool, getNodePoolStatus, listNodes, upsertNodes } from "./nodeStore.js";
import type { ImportSummary, NodePoolItem, NodeProtocol, NodeSource } from "./nodeTypes.js";

type ImportTextBody = {
  text?: string;
  sourceName?: string;
};

type ParseHistoryItem = {
  ranAt: string;
  sourceType: "github" | "manual";
  processedSources: number;
  fetchedFiles: number;
  found: number;
  inserted: number;
  duplicated: number;
  rateLimited: boolean;
  lastError: string | null;
};

const parseHistory: ParseHistoryItem[] = [];

function pushHistory(item: ParseHistoryItem): void {
  parseHistory.unshift(item);
  parseHistory.splice(20);
}

function emptyImportSummary(): ImportSummary {
  return {
    found: 0,
    inserted: 0,
    duplicated: 0,
    protocolStats: emptyProtocolStats()
  };
}

function summarizeProtocolStats(nodes: NodePoolItem[]): Record<NodeProtocol, number> {
  const stats = emptyProtocolStats();
  for (const node of nodes) {
    stats[node.protocol] += 1;
  }
  return stats;
}

async function importText(text: string, source: NodeSource): Promise<ImportSummary> {
  const raws = parseNodeRawsFromText(text);
  const nodes = raws
    .map((raw) => createNodeFromRaw(raw, source))
    .filter((node): node is NodePoolItem => Boolean(node));

  if (nodes.length === 0) {
    return emptyImportSummary();
  }

  const summary = await upsertNodes(nodes);
  summary.protocolStats = summarizeProtocolStats(nodes);
  return summary;
}

export async function getNodePoolStatusHandler() {
  return getNodePoolStatus();
}

export async function listNodesHandler(request: FastifyRequest) {
  const query = request.query as { limit?: string; protocol?: string; sourceType?: string };
  return listNodes({
    limit: query.limit ? Number(query.limit) : 50,
    protocol: query.protocol || "",
    sourceType: query.sourceType || ""
  });
}

export async function importTextHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as ImportTextBody;

  if (!body?.text || body.text.length > 1024 * 1024) {
    reply.code(400);
    return {
      ok: false,
      error: "请提供 1MB 以内的 text 字段。"
    };
  }

  const summary = await importText(body.text, {
    sourceType: "manual",
    sourceRepository: null,
    sourcePath: body.sourceName || "manual",
    sourceUrl: ""
  });

  pushHistory({
    ranAt: new Date().toISOString(),
    sourceType: "manual",
    processedSources: 1,
    fetchedFiles: 0,
    found: summary.found,
    inserted: summary.inserted,
    duplicated: summary.duplicated,
    rateLimited: false,
    lastError: null
  });

  return {
    ok: true,
    ...summary
  };
}

export async function parseLastGitHubResultsHandler() {
  const lastResults = getLastCollectorResults();

  if (lastResults.resultCount === 0) {
    const empty = {
      ok: true,
      processedSources: 0,
      fetchedFiles: 0,
      found: 0,
      inserted: 0,
      duplicated: 0,
      rateLimited: false,
      lastError: "暂无最近 GitHub 搜索结果。"
    };
    pushHistory({
      ranAt: new Date().toISOString(),
      sourceType: "github",
      processedSources: empty.processedSources,
      fetchedFiles: empty.fetchedFiles,
      found: empty.found,
      inserted: empty.inserted,
      duplicated: empty.duplicated,
      rateLimited: empty.rateLimited,
      lastError: empty.lastError
    });
    return empty;
  }

  const contentResult = await readLimitedGitHubContents();
  let found = 0;
  let inserted = 0;
  let duplicated = 0;

  for (const content of contentResult.contents) {
    const summary = await importText(content.text, {
      sourceType: "github",
      sourceRepository: content.repository,
      sourcePath: content.path,
      sourceUrl: content.url
    });
    found += summary.found;
    inserted += summary.inserted;
    duplicated += summary.duplicated;
  }

  const result = {
    ok: true,
    processedSources: contentResult.processedSources,
    fetchedFiles: contentResult.fetchedFiles,
    found,
    inserted,
    duplicated,
    rateLimited: contentResult.rateLimited,
    lastError: contentResult.lastError
  };

  pushHistory({
    ranAt: new Date().toISOString(),
    sourceType: "github",
    processedSources: result.processedSources,
    fetchedFiles: result.fetchedFiles,
    found,
    inserted,
    duplicated,
    rateLimited: result.rateLimited,
    lastError: result.lastError
  });

  return result;
}

export function getParseHistoryHandler() {
  return {
    ok: true,
    items: parseHistory
  };
}

export async function clearNodePoolHandler() {
  const result = await clearNodePool();
  parseHistory.splice(0);
  return result;
}
