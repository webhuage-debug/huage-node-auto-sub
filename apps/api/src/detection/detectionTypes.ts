import type { NodeStatus } from "../nodePool/nodeTypes.js";

export type DetectionStatus = NodeStatus;

export type DetectionResult = {
  nodeId: string;
  status: DetectionStatus;
  responseMs: number | null;
  failureReason: string | null;
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
