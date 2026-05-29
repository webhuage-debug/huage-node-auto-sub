import type { FastifyReply, FastifyRequest } from "fastify";
import { getNodeById, getNodePoolStatus, getPublicNodeById, listNodesByStatus, updateNodeDetectionResult, updateNodeStatus } from "../nodePool/nodeStore.js";
import type { NodePoolItem, NodeStatus, PublicNodePoolItem } from "../nodePool/nodeTypes.js";
import { getDetectionState, markDetectionError, markDetectionFinished, markDetectionStarted, pushDetectionHistory, setTestingCount } from "./detectionState.js";
import type { DetectionDebug, DetectionHistoryItem, DetectionResult, DetectionSettings } from "./detectionTypes.js";
import { getXrayCoreStatus, testNodeWithXray } from "./xrayDetector.js";

type TestOneBody = {
  nodeId?: string;
};

type TestNodeParams = {
  nodeId?: string;
};

type TestUntestedBody = {
  limit?: number;
};

const xrayMissingMessage = "未检测到 Xray-core，请先安装或放置 Xray-core 到指定目录";

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getDetectionSettings(): DetectionSettings {
  const maxConcurrent = Math.min(numberEnv("DETECTION_MAX_CONCURRENT", 1), 2);
  return {
    xrayBinaryPath: process.env.XRAY_BINARY_PATH || "/app/cores/xray/xray",
    testUrl: process.env.DETECTION_TEST_URL || "https://www.gstatic.com/generate_204",
    timeoutSeconds: numberEnv("DETECTION_TIMEOUT_SECONDS", 10),
    maxConcurrent,
    batchDefaultLimit: numberEnv("DETECTION_BATCH_DEFAULT_LIMIT", 5),
    batchMaxLimit: Math.min(numberEnv("DETECTION_BATCH_MAX_LIMIT", 20), 20)
  };
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

function createRuntimeDebug(node: NodePoolItem, settings: DetectionSettings, reason: string): DetectionDebug {
  return {
    protocol: node.protocol,
    network: "unknown",
    security: "unknown",
    flow: "",
    proxyType: "socks",
    testUrl: settings.testUrl,
    detectionCore: "xray",
    configBuildOk: false,
    xrayStarted: false,
    socksPort: undefined,
    curlExitCode: null,
    httpCode: null,
    failureStage: "unknown",
    safeFailureReason: reason
  };
}

function summarizeResults(results: DetectionResult[]): Omit<DetectionHistoryItem, "runAt" | "core"> {
  return {
    tested: results.length,
    available: results.filter((item) => item.status === "available").length,
    unavailable: results.filter((item) => item.status === "unavailable").length,
    unsupported: results.filter((item) => item.status === "unsupported").length,
    error: results.filter((item) => item.status === "error").length
  };
}

async function persistDetectionResult(result: DetectionResult): Promise<void> {
  const updatedNode = await updateNodeDetectionResult(result.nodeId, {
    status: result.status as NodeStatus,
    detectionCore: "xray",
    responseMs: result.responseMs,
    failureReason: result.failureReason,
    debug: result.debug
  });

  if (!updatedNode) {
    throw new Error("节点检测结果写回失败：未找到节点。");
  }
}

async function runOneNodeDetection(node: NodePoolItem, settings: DetectionSettings): Promise<DetectionResult> {
  await updateNodeStatus(node.id, "testing");
  let result: DetectionResult;

  try {
    result = await testNodeWithXray(node, settings);
  } catch (error) {
    const reason = `单节点检测异常：${getErrorMessage(error)}`;
    result = {
      nodeId: node.id,
      status: "unavailable",
      responseMs: null,
      failureReason: reason,
      debug: createRuntimeDebug(node, settings, reason)
    };
  }

  await persistDetectionResult(result);
  return result;
}

async function runWithConcurrency(nodes: NodePoolItem[], settings: DetectionSettings): Promise<DetectionResult[]> {
  const results: DetectionResult[] = [];
  let cursor = 0;
  let active = 0;

  async function worker(): Promise<void> {
    while (cursor < nodes.length) {
      const current = nodes[cursor];
      cursor += 1;
      active += 1;
      setTestingCount(active);
      try {
        const result = await runOneNodeDetection(current, settings);
        results.push(result);
      } finally {
        active -= 1;
        setTestingCount(active);
      }
    }
  }

  const workers = Array.from({ length: Math.min(settings.maxConcurrent, nodes.length) }, () => worker());
  await Promise.all(workers);
  setTestingCount(0);
  return results;
}

export async function getXrayDetectionStatus() {
  const settings = getDetectionSettings();
  const state = getDetectionState();
  const coreStatus = await getXrayCoreStatus(settings.xrayBinaryPath);

  return {
    ok: true,
    core: "xray",
    installed: coreStatus.installed,
    available: coreStatus.available,
    binaryPath: coreStatus.binaryPath,
    version: coreStatus.version,
    failureReason: coreStatus.failureReason,
    xrayInstalled: coreStatus.installed,
    xrayBinaryPath: settings.xrayBinaryPath,
    running: state.running,
    queueSize: state.queueSize,
    testingCount: state.testingCount,
    lastRunAt: state.lastRunAt,
    lastError: state.lastError,
    timeoutSeconds: settings.timeoutSeconds,
    maxConcurrent: settings.maxConcurrent,
    proxyType: "socks",
    testUrl: settings.testUrl,
    message: coreStatus.message
  };
}

export async function testOneNodeHandler(request: FastifyRequest, reply: FastifyReply) {
  const state = getDetectionState();
  if (state.running) {
    reply.code(409);
    return {
      ok: false,
      error: "DETECTION_RUNNING",
      message: "Xray 检测正在运行中，请等待本轮完成。"
    };
  }

  const settings = getDetectionSettings();

  const coreStatus = await getXrayCoreStatus(settings.xrayBinaryPath);
  if (!coreStatus.available) {
    reply.code(400);
    return {
      ok: false,
      error: "XRAY_NOT_INSTALLED",
      failureReason: coreStatus.failureReason,
      message: coreStatus.message
    };
  }

  const body = request.body as TestOneBody | undefined;
  const params = request.params as TestNodeParams | undefined;
  const nodeId = body?.nodeId || params?.nodeId || "";

  if (!nodeId) {
    reply.code(400);
    return { ok: false, error: "NODE_ID_REQUIRED", message: "请提供 nodeId。" };
  }

  const node = await getNodeById(nodeId);
  if (!node) {
    reply.code(404);
    return { ok: false, error: "NODE_NOT_FOUND", message: "未找到指定节点。" };
  }

  markDetectionStarted(1);
  let result: DetectionResult;
  let persistedNode: PublicNodePoolItem | null = null;

  try {
    setTestingCount(1);
    result = await runOneNodeDetection(node, settings);
    if (result.status !== "available") {
      const reason = result.failureReason || result.debug?.safeFailureReason || "单节点检测未通过";
      result = {
        ...result,
        status: "unavailable",
        responseMs: null,
        failureReason: reason,
        debug: {
          ...(result.debug || createRuntimeDebug(node, settings, reason)),
          safeFailureReason: reason,
          failureStage: result.debug?.failureStage || "unknown"
        }
      };
      await persistDetectionResult(result);
    }
    persistedNode = await getPublicNodeById(node.id);
    setTestingCount(0);
    const summary = summarizeResults([result]);
    pushDetectionHistory({
      runAt: new Date().toISOString(),
      core: "xray",
      ...summary
    });
    markDetectionFinished();
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测失败";
    markDetectionError(message);
    reply.code(500);
    return {
      ok: false,
      error: "DETECTION_FAILED",
      message
    };
  }

  if (!persistedNode) {
    reply.code(500);
    return {
      ok: false,
      error: "DETECTION_RESULT_NOT_PERSISTED",
      message: "检测已执行，但未能重新读取写回后的节点。"
    };
  }

  return {
    ok: true,
    nodeId: persistedNode.id,
    status: persistedNode.status,
    responseMs: persistedNode.responseMs ?? null,
    failureReason: persistedNode.failureReason ?? null,
    detectionCore: persistedNode.detectionCore || "xray",
    lastTestedAt: persistedNode.lastTestedAt || null,
    detectionDebug: persistedNode.detectionDebug || null,
    detectionRuntimeDebug: persistedNode.detectionRuntimeDebug || null,
    debug: persistedNode.debug || null,
    node: persistedNode
  };
}

export async function testUntestedNodesHandler(request: FastifyRequest, reply: FastifyReply) {
  const state = getDetectionState();
  if (state.running) {
    reply.code(409);
    return {
      ok: false,
      error: "DETECTION_RUNNING",
      message: "Xray 检测正在运行中，请等待本轮完成。"
    };
  }

  const settings = getDetectionSettings();
  const coreStatus = await getXrayCoreStatus(settings.xrayBinaryPath);
  if (!coreStatus.available) {
    reply.code(400);
    return {
      ok: false,
      error: "XRAY_NOT_INSTALLED",
      failureReason: coreStatus.failureReason,
      message: coreStatus.message
    };
  }

  const body = request.body as TestUntestedBody | undefined;
  const requestedLimit = Math.min(Math.max(Number(body?.limit || settings.batchDefaultLimit), 1), settings.batchMaxLimit);
  const nodes = await listNodesByStatus("untested", requestedLimit);
  markDetectionStarted(nodes.length);

  try {
    const results = await runWithConcurrency(nodes, settings);
    const summary = summarizeResults(results);
    const history = {
      runAt: new Date().toISOString(),
      core: "xray" as const,
      ...summary
    };
    pushDetectionHistory(history);
    markDetectionFinished();

    return {
      ok: true,
      requested: requestedLimit,
      ...summary
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测失败";
    markDetectionError(message);
    reply.code(500);
    return {
      ok: false,
      error: "DETECTION_FAILED",
      message
    };
  }
}

export function getDetectionHistoryHandler() {
  return {
    ok: true,
    items: getDetectionState().history
  };
}

export async function getDetectionNodePoolStatus() {
  return getNodePoolStatus();
}
