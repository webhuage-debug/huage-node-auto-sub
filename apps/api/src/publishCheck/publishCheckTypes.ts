export type PublishCheckStatus = "pass" | "warning" | "fail";

export type PublishCheckItem = {
  key: string;
  label: string;
  status: PublishCheckStatus;
  message: string;
  detail?: string;
};

export type PublishCheckResponse = {
  ok: true;
  version: string;
  canPublish: boolean;
  level: PublishCheckStatus;
  summary: string;
  checks: PublishCheckItem[];
  reminders: string[];
};

export type PublishPrepareResponse =
  | {
      ok: true;
      message: string;
      tokenReset: true;
      expirationRenewed: true;
      expiresAt: string | null;
      remainingDays: number;
      subscriptionAccessible: boolean;
      publicBaseUrlConfigured: boolean;
    }
  | {
      ok: false;
      error: "PUBLISH_PREPARE_FAILED";
      message: string;
    };
