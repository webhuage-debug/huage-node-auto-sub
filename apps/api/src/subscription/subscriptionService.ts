import type { FastifyReply, FastifyRequest } from "fastify";
import { listSubscriptionCandidateNodes } from "../nodePool/nodeStore.js";
import { createSubscriptionToken, readSubscriptionFile, toSubscriptionStatus, writeSubscriptionFile } from "./subscriptionStore.js";
import type { SubscriptionFile } from "./subscriptionTypes.js";

type SubscriptionTokenParams = {
  token?: string;
};

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function getSubscriptionSettings() {
  return {
    targetNodeCount: numberEnv("SUBSCRIPTION_TARGET_NODE_COUNT", 20),
    minNodeCount: numberEnv("SUBSCRIPTION_MIN_NODE_COUNT", 10)
  };
}

function buildWarning(nodeCount: number, targetNodeCount: number, minNodeCount: number): string | null {
  if (nodeCount < minNodeCount) {
    return `当前可用节点不足 ${minNodeCount} 条，已生成保底订阅但建议继续补充节点。`;
  }
  if (nodeCount < targetNodeCount) {
    return `当前可用节点不足 ${targetNodeCount} 条。`;
  }
  return null;
}

export async function getSubscriptionStatusHandler() {
  const file = await readSubscriptionFile();
  return toSubscriptionStatus(file);
}

export async function rebuildSubscriptionHandler() {
  const previous = await readSubscriptionFile();
  const settings = getSubscriptionSettings();
  const nodes = await listSubscriptionCandidateNodes(settings.targetNodeCount);
  const tokenCreated = !previous.token;
  const token = previous.token || createSubscriptionToken();
  const contentBase64 = Buffer.from(nodes.map((node) => node.raw).join("\n"), "utf8").toString("base64");
  const nextFile: SubscriptionFile = {
    version: 1,
    token,
    contentBase64,
    nodeCount: nodes.length,
    targetNodeCount: settings.targetNodeCount,
    minNodeCount: settings.minNodeCount,
    lastGeneratedAt: new Date().toISOString(),
    warning: buildWarning(nodes.length, settings.targetNodeCount, settings.minNodeCount)
  };

  await writeSubscriptionFile(nextFile);
  return toSubscriptionStatus(nextFile, tokenCreated);
}

export async function publicSubscriptionHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as SubscriptionTokenParams;
  const file = await readSubscriptionFile();

  if (!file.token || params.token !== file.token) {
    reply.code(404);
    return {
      ok: false,
      error: "SUBSCRIPTION_NOT_FOUND"
    };
  }

  reply.header("Content-Type", "text/plain; charset=utf-8");
  return file.contentBase64;
}
