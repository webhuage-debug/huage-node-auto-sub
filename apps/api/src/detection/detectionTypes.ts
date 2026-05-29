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
  configBuildOk?: boolean;
  xrayStarted?: boolean;
  socksPort?: number;
  curlExitCode?: number | null;
  httpCode?: string | null;
  failureStage?: "config_build" | "xray_start" | "socks_wait" | "curl" | "result_parse" | "process_cleanup" | "unknown" | null;
  safeFailureReason?: string | null;
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

export type XrayCoreStatus = {
  installed: boolean;
  available: boolean;
  binaryPath: string;
  version: string | null;
  failureReason: "XRAY_BINARY_NOT_FOUND" | "XRAY_BINARY_NOT_EXECUTABLE" | "XRAY_VERSION_CHECK_FAILED" | null;
  message: string;
};
