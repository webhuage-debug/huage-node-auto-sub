export type NodeProtocol = "vmess" | "vless" | "trojan" | "ss" | "ssr";

export type NodeSourceType = "github" | "manual";

export type NodeStatus = "untested" | "available" | "unavailable";

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
