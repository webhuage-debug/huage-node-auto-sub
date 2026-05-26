import { sha256, shortHash } from "../utils/hash.js";
import { maskNodeRaw } from "../utils/mask.js";
import type { NodePoolItem, NodeProtocol, NodeSource } from "./nodeTypes.js";

const supportedProtocols: NodeProtocol[] = ["vmess", "vless", "trojan", "ss", "ssr"];
const nodePattern = /\b(vmess|vless|trojan|ss|ssr):\/\/[^\s<>"'`]+/gi;
const base64MaxInputLength = 1024 * 1024;

function trimNodeCandidate(value: string): string {
  return value
    .trim()
    .replace(/^[("'[\{]+/g, "")
    .replace(/[),.;\]"'\}]+$/g, "");
}

function normalizeRaw(raw: string): string {
  return trimNodeCandidate(raw);
}

function detectProtocol(raw: string): NodeProtocol | null {
  const lower = raw.toLowerCase();
  return supportedProtocols.find((protocol) => lower.startsWith(`${protocol}://`)) || null;
}

function looksLikeBase64(text: string): boolean {
  const compact = text.replace(/\s+/g, "");
  return compact.length >= 24 && compact.length <= base64MaxInputLength && /^[A-Za-z0-9+/=_-]+$/.test(compact);
}

function decodeBase64Text(text: string): string | null {
  if (!looksLikeBase64(text)) {
    return null;
  }

  try {
    const compact = text.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
    const decoded = Buffer.from(compact, "base64").toString("utf8");
    return supportedProtocols.some((protocol) => decoded.includes(`${protocol}://`)) ? decoded : null;
  } catch {
    return null;
  }
}

function extractRawNodes(text: string): string[] {
  const found = new Set<string>();
  const matches = text.matchAll(nodePattern);

  for (const match of matches) {
    const normalized = normalizeRaw(match[0]);
    if (detectProtocol(normalized)) {
      found.add(normalized);
    }
  }

  return [...found];
}

export function parseNodeRawsFromText(text: string): string[] {
  const all = new Set<string>();

  for (const raw of extractRawNodes(text)) {
    all.add(raw);
  }

  const decoded = decodeBase64Text(text);
  if (decoded) {
    for (const raw of extractRawNodes(decoded)) {
      all.add(raw);
    }
  }

  return [...all];
}

export function createNodeFromRaw(raw: string, source: NodeSource, now = new Date().toISOString()): NodePoolItem | null {
  const normalized = normalizeRaw(raw);
  const protocol = detectProtocol(normalized);

  if (!protocol) {
    return null;
  }

  const hash = sha256(normalized);

  return {
    id: shortHash(normalized),
    hash,
    protocol,
    raw: normalized,
    masked: maskNodeRaw(normalized),
    sourceType: source.sourceType,
    sourceRepository: source.sourceRepository,
    sourcePath: source.sourcePath,
    sourceUrl: source.sourceUrl,
    firstSeenAt: now,
    lastSeenAt: now,
    seenCount: 1,
    status: "untested",
    region: "未知",
    remark: ""
  };
}

export function emptyProtocolStats(): Record<NodeProtocol, number> {
  return {
    vmess: 0,
    vless: 0,
    trojan: 0,
    ss: 0,
    ssr: 0
  };
}
