export type NodeProtocol = "vmess" | "vless" | "trojan" | "ss" | "ssr";

export type NodeSourceType = "github" | "manual";

export type NodeStatus = "untested" | "testing" | "available" | "unavailable" | "unsupported" | "error";

export type NodeDetectionDebug = {
  protocol: string;
  network: string;
  security: string;
  flow: string;
  proxyType: "socks";
  testUrl: string;
  detectionCore: "xray";
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
