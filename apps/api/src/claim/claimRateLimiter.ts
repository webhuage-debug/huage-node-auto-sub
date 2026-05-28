import type { FastifyRequest } from "fastify";

type ClaimRateLimitEntry = {
  failedAttempts: number;
  windowStartedAt: number;
  lockedUntil: number | null;
};

type ClaimRateLimitConfig = {
  maxFailedAttempts: number;
  windowMs: number;
  lockMs: number;
};

const entries = new Map<string, ClaimRateLimitEntry>();

function readPositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig(): ClaimRateLimitConfig {
  return {
    maxFailedAttempts: readPositiveNumber(process.env.CLAIM_VERIFY_MAX_FAILED_ATTEMPTS, 5),
    windowMs: readPositiveNumber(process.env.CLAIM_VERIFY_WINDOW_MINUTES, 15) * 60 * 1000,
    lockMs: readPositiveNumber(process.env.CLAIM_VERIFY_LOCK_MINUTES, 15) * 60 * 1000
  };
}

function getHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export function getClaimClientIp(request: FastifyRequest): string {
  const forwardedFor = getHeaderValue(request.headers["x-forwarded-for"]);
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = getHeaderValue(request.headers["x-real-ip"]);
  if (realIp?.trim()) {
    return realIp.trim();
  }

  return request.ip || request.raw.socket.remoteAddress || "unknown";
}

export function getClaimRateLimitStatus(clientIp: string): { locked: boolean; retryAfterSeconds: number | null } {
  const now = Date.now();
  const entry = entries.get(clientIp);
  if (!entry?.lockedUntil) {
    return { locked: false, retryAfterSeconds: null };
  }

  if (now >= entry.lockedUntil) {
    entries.delete(clientIp);
    return { locked: false, retryAfterSeconds: null };
  }

  return {
    locked: true,
    retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000)
  };
}

export function recordClaimFailure(clientIp: string): {
  locked: boolean;
  remainingAttempts: number;
  retryAfterSeconds: number | null;
} {
  const now = Date.now();
  const config = getConfig();
  const current = entries.get(clientIp);
  const entry =
    current && now - current.windowStartedAt <= config.windowMs
      ? current
      : { failedAttempts: 0, windowStartedAt: now, lockedUntil: null };

  entry.failedAttempts += 1;

  if (entry.failedAttempts >= config.maxFailedAttempts) {
    entry.lockedUntil = now + config.lockMs;
    entries.set(clientIp, entry);
    return {
      locked: true,
      remainingAttempts: 0,
      retryAfterSeconds: Math.ceil(config.lockMs / 1000)
    };
  }

  entries.set(clientIp, entry);
  return {
    locked: false,
    remainingAttempts: Math.max(config.maxFailedAttempts - entry.failedAttempts, 0),
    retryAfterSeconds: null
  };
}

export function clearClaimFailures(clientIp: string): void {
  entries.delete(clientIp);
}
