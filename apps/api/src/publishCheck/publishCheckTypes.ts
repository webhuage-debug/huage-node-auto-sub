export type PublishCheckStatus = "pass" | "warning" | "fail";

export type PublishCheckItem = {
  key: string;
  label: string;
  status: PublishCheckStatus;
  message: string;
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
