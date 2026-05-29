export type NodeProtocol = "vmess" | "vless" | "trojan" | "ss" | "ssr";

export type NodeSourceType = "github" | "manual";

export type NodeStatus = "untested" | "testing" | "available" | "unavailable" | "unsupported" | "error";

export type ManualNodeStatus = "available" | "unavailable";

export type NodeDetectionDebug = {
  protocol: string;
  network: string;
  security: string;
  flow: string;
  proxyType: "socks";
  testUrl: string;
  detectionCore: "xray";
  configBuildOk?: boolean;
  xrayStarted?: boolean;
  socksPort?: number;
  curlExitCode?: number | null;
  httpCode?: string | null;
  failureStage?: "config_build" | "xray_start" | "socks_wait" | "curl" | "result_parse" | "process_cleanup" | "unknown" | null;
  safeFailureReason?: string | null;
};

export type NodePoolItem = {
  id: string;
  hash: string;
  protocol: NodeProtocol;
  raw: string;
  masked: string;
  sourceType: NodeSourceType;
  sourceRepository: string | null;
  sourcePath: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  status: NodeStatus;
  region: string;
  remark: string;
  lastTestedAt?: string | null;
  detectionCore?: string | null;
  responseMs?: number | null;
  failureReason?: string | null;
  detectionDebug?: NodeDetectionDebug;
  detectionRuntimeDebug?: NodeDetectionDebug;
  debug?: NodeDetectionDebug;
  manualOverride?: boolean;
  manualStatus?: ManualNodeStatus | null;
  manualReason?: string | null;
  manualUpdatedAt?: string | null;
  testCount?: number;
  successCount?: number;
  failCount?: number;
};

export type PublicNodePoolItem = Omit<NodePoolItem, "raw" | "hash">;

export type NodePoolFile = {
  version: 1;
  updatedAt: string | null;
  nodes: NodePoolItem[];
};

export type NodeSource = {
  sourceType: NodeSourceType;
  sourceRepository: string | null;
  sourcePath: string;
  sourceUrl: string;
};

export type ImportSummary = {
  found: number;
  inserted: number;
  duplicated: number;
  protocolStats: Record<NodeProtocol, number>;
};
