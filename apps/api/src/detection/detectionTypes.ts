import type { NodeDetectionDebug, NodeStatus } from "../nodePool/nodeTypes.js";

export type DetectionStatus = NodeStatus;

export type DetectionDebug = NodeDetectionDebug & {
  hasServer?: boolean;
  hasPort?: boolean;
  hasId?: boolean;
  hasPublicKey?: boolean;
  hasServerName?: boolean;
  hasFingerprint?: boolean;
  hasShortId?: boolean;
  spiderXValueType?: "/" | "empty" | "custom";
};

export type DetectionResult = {
  nodeId: string;
  status: DetectionStatus;
  responseMs: number | null;
  failureReason: string | null;
  debug?: DetectionDebug;
};

export type DetectionHistoryItem = {
  runAt: string;
  core: "xray";
  tested: number;
  available: number;
  unavailable: number;
  unsupported: number;
  error: number;
};

export type DetectionSettings = {
  xrayBinaryPath: string;
  testUrl: string;
  timeoutSeconds: number;
  maxConcurrent: number;
  batchDefaultLimit: number;
  batchMaxLimit: number;
};
