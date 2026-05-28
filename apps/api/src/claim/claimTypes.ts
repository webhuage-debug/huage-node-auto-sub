export type ClaimVerifyBody = {
  code?: string;
};

export type ClaimVerifyResponse = {
  ok: boolean;
  message: string;
  claimAllowed: boolean;
  subscriptionReady: boolean;
  copyableSubscriptionUrl?: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;
  error?:
    | "CLAIM_CODE_NOT_CONFIGURED"
    | "INVALID_CLAIM_CODE"
    | "SUBSCRIPTION_NOT_READY"
    | "SUBSCRIPTION_EXPIRED"
    | "PUBLIC_BASE_URL_NOT_CONFIGURED"
    | "CLAIM_TOO_MANY_ATTEMPTS";
};
