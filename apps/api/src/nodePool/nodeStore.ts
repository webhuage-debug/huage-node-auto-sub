import fs from "node:fs/promises";
import path from "node:path";
import { resolveProjectPath } from "../config.js";
import type { ImportSummary, ManualNodeStatus, NodeDetectionDebug, NodePoolFile, NodePoolItem, NodeProtocol, NodeSourceType, NodeStatus, PublicNodePoolItem } from "./nodeTypes.js";
import { emptyProtocolStats } from "./nodeParser.js";

const defaultFile: NodePoolFile = {
  version: 1,
  updatedAt: null,
  nodes: []
};

function getNodePoolFilePath(): string {
  const dataDir = process.env.DATA_DIR || "./data";
  return resolveProjectPath(process.env.NODE_POOL_FILE || `${dataDir}/node_pool.json`);
}

async function ensureNodePoolFile(): Promise<void> {
  const filePath = getNodePoolFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, `${JSON.stringify(defaultFile, null, 2)}\n`, "utf8");
  }
}

async function readNodePoolFile(): Promise<NodePoolFile> {
  await ensureNodePoolFile();
  const raw = await fs.readFile(getNodePoolFilePath(), "utf8");
  const parsed = JSON.parse(raw) as NodePoolFile;
  return {
    version: 1,
    updatedAt: parsed.updatedAt || null,
    nodes: Array.isArray(parsed.nodes) ? parsed.nodes : []
  };
}

async function writeNodePoolFile(file: NodePoolFile): Promise<void> {
  await ensureNodePoolFile();
  await fs.writeFile(getNodePoolFilePath(), `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

function toPublicNode(node: NodePoolItem): PublicNodePoolItem {
  const { raw: _raw, hash: _hash, ...publicNode } = node;
  return publicNode;
}

export async function upsertNodes(nodes: NodePoolItem[]): Promise<ImportSummary> {
  const file = await readNodePoolFile();
  const byHash = new Map(file.nodes.map((node) => [node.hash, node]));
  const protocolStats = emptyProtocolStats();
  let inserted = 0;
  let duplicated = 0;
  const now = new Date().toISOString();

  for (const node of nodes) {
    protocolStats[node.protocol] += 1;
    const existing = byHash.get(node.hash);

    if (existing) {
      existing.lastSeenAt = now;
      existing.seenCount += 1;
      existing.sourceType = node.sourceType;
      existing.sourceRepository = node.sourceRepository;
      existing.sourcePath = node.sourcePath;
      existing.sourceUrl = node.sourceUrl;
      duplicated += 1;
      continue;
    }

    file.nodes.push(node);
    byHash.set(node.hash, node);
    inserted += 1;
  }

  file.updatedAt = nodes.length > 0 ? now : file.updatedAt;
  await writeNodePoolFile(file);

  return {
    found: nodes.length,
    inserted,
    duplicated,
    protocolStats
  };
}

export async function getNodePoolStatus() {
  const file = await readNodePoolFile();
  const protocolStats: Record<NodeProtocol, number> = emptyProtocolStats();
  const sourceStats: Record<NodeSourceType, number> = {
    github: 0,
    manual: 0
  };
  const regionStats: Record<string, number> = {
    未知: 0
  };
  const statusStats = {
    untested: 0,
    testing: 0,
    available: 0,
    unavailable: 0,
    unsupported: 0,
    error: 0
  };
  const manualStats = {
    manualAvailable: 0,
    manualUnavailable: 0,
    autoAvailable: 0,
    autoUnavailable: 0
  };

  for (const node of file.nodes) {
    protocolStats[node.protocol] += 1;
    sourceStats[node.sourceType] += 1;
    regionStats[node.region] = (regionStats[node.region] || 0) + 1;
    statusStats[node.status] = (statusStats[node.status] || 0) + 1;

    if (node.manualOverride === true && node.manualStatus === "available") {
      manualStats.manualAvailable += 1;
    } else if (node.manualOverride === true && node.manualStatus === "unavailable") {
      manualStats.manualUnavailable += 1;
    } else if (node.status === "available") {
      manualStats.autoAvailable += 1;
    } else if (node.status === "unavailable") {
      manualStats.autoUnavailable += 1;
    }
  }

  return {
    ok: true,
    total: file.nodes.length,
    untested: statusStats.untested,
    testing: statusStats.testing,
    available: statusStats.available,
    unavailable: statusStats.unavailable,
    unsupported: statusStats.unsupported,
    error: statusStats.error,
    ...manualStats,
    protocolStats,
    sourceStats,
    regionStats,
    lastUpdatedAt: file.updatedAt
  };
}

export async function listNodes(options: {
  limit?: number;
  protocol?: string;
  sourceType?: string;
}) {
  const file = await readNodePoolFile();
  const limit = Math.min(Math.max(Number(options.limit || 50), 1), 200);
  const filtered = file.nodes.filter((node) => {
    if (options.protocol && node.protocol !== options.protocol) {
      return false;
    }
    if (options.sourceType && node.sourceType !== options.sourceType) {
      return false;
    }
    return true;
  });

  return {
    ok: true,
    total: filtered.length,
    items: filtered
      .slice()
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, limit)
      .map(toPublicNode)
  };
}

export async function listSubscriptionCandidateNodes(limit: number): Promise<NodePoolItem[]> {
  const file = await readNodePoolFile();
  const max = Math.min(Math.max(limit, 1), 200);

  return file.nodes
    .filter((node) => {
      if (node.manualOverride === true) {
        return node.manualStatus === "available";
      }
      return node.status === "available";
    })
    .sort((left, right) => {
      const manualScore = Number(right.manualOverride === true) - Number(left.manualOverride === true);
      if (manualScore !== 0) {
        return manualScore;
      }

      const leftMs = left.responseMs ?? Number.MAX_SAFE_INTEGER;
      const rightMs = right.responseMs ?? Number.MAX_SAFE_INTEGER;
      if (leftMs !== rightMs) {
        return leftMs - rightMs;
      }

      return (right.lastTestedAt || right.lastSeenAt).localeCompare(left.lastTestedAt || left.lastSeenAt);
    })
    .slice(0, max);
}

export async function clearNodePool() {
  const updatedAt = new Date().toISOString();
  await writeNodePoolFile({
    version: 1,
    updatedAt,
    nodes: []
  });

  return {
    ok: true,
    cleared: true,
    total: 0,
    updatedAt
  };
}

export async function getNodeById(id: string): Promise<NodePoolItem | null> {
  const file = await readNodePoolFile();
  return file.nodes.find((node) => node.id === id) || null;
}

export async function getPublicNodeById(id: string): Promise<PublicNodePoolItem | null> {
  const node = await getNodeById(id);
  return node ? toPublicNode(node) : null;
}

export async function listNodesByStatus(status: NodeStatus, limit: number): Promise<NodePoolItem[]> {
  const file = await readNodePoolFile();
  return file.nodes
    .filter((node) => node.status === status)
    .slice()
    .sort((a, b) => a.firstSeenAt.localeCompare(b.firstSeenAt))
    .slice(0, limit);
}

export async function updateNodeDetectionResult(
  id: string,
  result: {
    status: NodeStatus;
    detectionCore: string;
    responseMs: number | null;
    failureReason: string | null;
    debug?: NodeDetectionDebug;
  }
): Promise<PublicNodePoolItem | null> {
  const file = await readNodePoolFile();
  const node = file.nodes.find((item) => item.id === id);

  if (!node) {
    return null;
  }

  const now = new Date().toISOString();
  const previousTestCount = node.testCount || 0;
  const previousSuccessCount = node.successCount || 0;
  const previousFailCount = node.failCount || 0;
  const success = result.status === "available";

  node.status = result.status;
  node.lastTestedAt = now;
  node.detectionCore = result.detectionCore;
  node.responseMs = result.responseMs;
  node.failureReason = result.failureReason;
  node.detectionDebug = result.debug;
  node.detectionRuntimeDebug = result.debug;
  node.debug = result.debug;
  node.testCount = previousTestCount + 1;
  node.successCount = previousSuccessCount + (success ? 1 : 0);
  node.failCount = previousFailCount + (success ? 0 : 1);
  file.updatedAt = now;

  await writeNodePoolFile(file);
  return toPublicNode(node);
}

export async function updateNodeStatus(id: string, status: NodeStatus): Promise<NodePoolItem | null> {
  const file = await readNodePoolFile();
  const node = file.nodes.find((item) => item.id === id);

  if (!node) {
    return null;
  }

  node.status = status;
  file.updatedAt = new Date().toISOString();
  await writeNodePoolFile(file);
  return node;
}

export async function updateNodeManualStatus(
  id: string,
  nextStatus: ManualNodeStatus | "untested",
  reason = ""
): Promise<PublicNodePoolItem | null> {
  const file = await readNodePoolFile();
  const node = file.nodes.find((item) => item.id === id);

  if (!node) {
    return null;
  }

  const now = new Date().toISOString();

  if (nextStatus === "untested") {
    node.status = "untested";
    node.manualOverride = false;
    node.manualStatus = null;
    node.manualReason = null;
    node.manualUpdatedAt = null;
    node.responseMs = null;
    node.failureReason = null;
  } else {
    node.status = nextStatus;
    node.manualOverride = true;
    node.manualStatus = nextStatus;
    node.manualReason = reason;
    node.manualUpdatedAt = now;
    node.failureReason = null;
  }

  file.updatedAt = now;
  await writeNodePoolFile(file);
  return toPublicNode(node);
}
