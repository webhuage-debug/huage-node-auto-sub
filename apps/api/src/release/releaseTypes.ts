export type ReleaseHistoryType =
  | "set_claim_code"
  | "random_claim_code"
  | "reset_subscription_token"
  | "rebuild_subscription";

export type ReleaseHistoryItem = {
  id: string;
  type: ReleaseHistoryType;
  message: string;
  createdAt: string;
  safeDetail: Record<string, string | number | boolean | null>;
};

export type ReleaseStateFile = {
  version: 1;
  claimCode: string | null;
  lastTokenResetAt: string | null;
  lastSubscriptionRebuildAt: string | null;
  history: ReleaseHistoryItem[];
};
