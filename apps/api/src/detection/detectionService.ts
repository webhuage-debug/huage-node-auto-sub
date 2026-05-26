import type { FastifyReply, FastifyRequest } from "fastify";
import { getNodeById, getNodePoolStatus, listNodesByStatus, updateNodeDetectionResult, updateNodeStatus } from "../nodePool/nodeStore.js";
import type { NodePoolItem, NodeStatus } from "../nodePool/nodeTypes.js";
import { getDetectionState, markDetectionError, markDetectionFinished, markDetectionStarted, pushDetectionHistory, setTestingCount } from "./detectionState.js";
import type { DetectionHistoryItem, DetectionResult, DetectionSettings } from "./detectionTypes.js";
import { isXrayInstalled, testNodeWithXray } from "./xrayDetector.js";

type TestOneBody = {
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
  await updateNodeDetectionResult(result.nodeId, {
    status: result.status as NodeStatus,
    detectionCore: "xray",
    responseMs: result.responseMs,
    failureReason: result.failureReason
  });
}

async function runOneNodeDetection(node: NodePoolItem, settings: DetectionSettings): Promise<DetectionResult> {
  await updateNodeStatus(node.id, "testing");
  const result = await testNodeWithXray(node, settings);
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
  const installed = await isXrayInstalled(settings.xrayBinaryPath);

  return {
    ok: true,
    core: "xray",
    xrayInstalled: installed,
    xrayBinaryPath: settings.xrayBinaryPath,
    running: state.running,
    queueSize: state.queueSize,
    testingCount: state.testingCount,
    lastRunAt: state.lastRunAt,
    lastError: state.lastError,
    timeoutSeconds: settings.timeoutSeconds,
    maxConcurrent: settings.maxConcurrent,
    message: installed ? null : xrayMissingMessage
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

  if (!(await isXrayInstalled(settings.xrayBinaryPath))) {
    reply.code(400);
    return {
      ok: false,
      error: "XRAY_NOT_INSTALLED",
      message: xrayMissingMessage
    };
  }

  const body = request.body as TestOneBody;
  if (!body?.nodeId) {
    reply.code(400);
    return { ok: false, error: "NODE_ID_REQUIRED", message: "请提供 nodeId。" };
  }

  const node = await getNodeById(body.nodeId);
  if (!node) {
    reply.code(404);
    return { ok: false, error: "NODE_NOT_FOUND", message: "未找到指定节点。" };
  }

  markDetectionStarted(1);
  let result: DetectionResult;

  try {
    setTestingCount(1);
    result = await runOneNodeDetection(node, settings);
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

  return {
    ok: true,
    nodeId: result.nodeId,
    status: result.status,
    responseMs: result.responseMs,
    failureReason: result.failureReason,
    detectionCore: "xray"
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
  if (!(await isXrayInstalled(settings.xrayBinaryPath))) {
    reply.code(400);
    return {
      ok: false,
      error: "XRAY_NOT_INSTALLED",
      message: xrayMissingMessage
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
