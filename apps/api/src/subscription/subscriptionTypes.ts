export type SubscriptionFile = {
  version: 1;
  token: string | null;
  contentBase64: string;
  nodeCount: number;
  targetNodeCount: number;
  minNodeCount: number;
  lastGeneratedAt: string | null;
  warning: string | null;
};

export type SubscriptionStatus = {
  ok: true;
  generated: boolean;
  tokenCreated: boolean;
  safeSubscriptionUrl: string | null;
  nodeCount: number;
  targetNodeCount: number;
  minNodeCount: number;
  lastGeneratedAt: string | null;
  warning: string | null;
};
