import type { NodeDetectionDebug, NodePoolItem } from "../nodePool/nodeTypes.js";

type BuildResult =
  | { ok: true; outbound: Record<string, unknown> }
  | { ok: false; reason: string };

type ParsedShadowsocks = {
  method: string;
  password: string;
  host: string;
  port: number;
};

const supportedNetworks = new Set(["tcp", "ws", "grpc"]);
const supportedSecurity = new Set(["", "none", "tls", "reality"]);
const supportedVlessFlows = new Set(["", "xtls-rprx-vision"]);
const supportedShadowsocksMethods = new Set([
  "aes-128-gcm",
  "aes-256-gcm",
  "chacha20-poly1305",
  "chacha20-ietf-poly1305",
  "xchacha20-poly1305",
  "xchacha20-ietf-poly1305",
  "2022-blake3-aes-128-gcm",
  "2022-blake3-aes-256-gcm",
  "2022-blake3-chacha20-poly1305"
]);

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function firstParam(params: URLSearchParams, names: string[]): string {
  for (const name of names) {
    const value = params.get(name);
    if (value) {
      return value;
    }
  }
  return "";
}

function booleanParam(value: string): boolean {
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function splitList(value: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parsePort(value: string): number | null {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
}

function getStreamSettings(params: URLSearchParams, options: { allowReality: boolean }): BuildResult {
  const network = firstParam(params, ["type", "network"]) || "tcp";
  const security = firstParam(params, ["security", "tls"]) || "";

  if (!supportedNetworks.has(network)) {
    return { ok: false, reason: `暂不支持该 transport：${network}` };
  }

  if (!supportedSecurity.has(security)) {
    return { ok: false, reason: `暂不支持该 security：${security}` };
  }

  if (security === "reality" && !options.allowReality) {
    return { ok: false, reason: "当前协议暂不支持 Reality 参数" };
  }

  const streamSettings: Record<string, unknown> = {
    network
  };

  if (security === "tls") {
    const alpn = splitList(firstParam(params, ["alpn"]));
    streamSettings.security = "tls";
    streamSettings.tlsSettings = {
      serverName: firstParam(params, ["sni", "serverName", "host"]) || undefined,
      fingerprint: firstParam(params, ["fp", "fingerprint"]) || undefined,
      alpn,
      allowInsecure: booleanParam(firstParam(params, ["allowInsecure"]))
    };
  }

  if (security === "reality") {
    const publicKey = firstParam(params, ["pbk", "publicKey"]);
    if (!publicKey) {
      return { ok: false, reason: "Reality 缺少 publicKey" };
    }
    streamSettings.security = "reality";
    streamSettings.realitySettings = {
      serverName: firstParam(params, ["sni", "serverName"]),
      fingerprint: firstParam(params, ["fp", "fingerprint"]) || "chrome",
      publicKey,
      shortId: firstParam(params, ["sid", "shortId"]),
      spiderX: firstParam(params, ["spx", "spiderX"]) || "/"
    };
  }

  if (network === "ws") {
    const host = firstParam(params, ["host", "authority"]);
    streamSettings.wsSettings = {
      path: firstParam(params, ["path"]) || "/",
      headers: host ? { Host: host } : undefined
    };
  }

  if (network === "grpc") {
    const authority = firstParam(params, ["authority", "host"]);
    streamSettings.grpcSettings = {
      serviceName: firstParam(params, ["serviceName", "service", "path"]) || "",
      authority: authority || undefined
    };
  }

  return { ok: true, outbound: streamSettings };
}

function requireHostPort(url: URL): { host: string; port: number } | { reason: string } {
  const port = parsePort(url.port);
  if (!url.hostname || !port) {
    return { reason: "缺少 server 或 port" };
  }
  return { host: url.hostname, port };
}

function buildVless(raw: string): BuildResult {
  const url = parseUrl(raw);
  if (!url || !url.username) {
    return { ok: false, reason: "缺少 VLESS uuid" };
  }

  const hostPort = requireHostPort(url);
  if ("reason" in hostPort) {
    return { ok: false, reason: hostPort.reason };
  }

  const flow = firstParam(url.searchParams, ["flow"]);
  if (!supportedVlessFlows.has(flow)) {
    return { ok: false, reason: "暂不支持该 VLESS flow" };
  }

  const stream = getStreamSettings(url.searchParams, { allowReality: true });
  if (!stream.ok) {
    return stream;
  }

  return {
    ok: true,
    outbound: {
      protocol: "vless",
      settings: {
        vnext: [
          {
            address: hostPort.host,
            port: hostPort.port,
            users: [
              {
                id: decodeURIComponent(url.username),
                encryption: "none",
                flow: flow || undefined
              }
            ]
          }
        ]
      },
      streamSettings: stream.outbound
    }
  };
}

function buildTrojan(raw: string): BuildResult {
  const url = parseUrl(raw);
  if (!url || !url.username) {
    return { ok: false, reason: "缺少 Trojan password" };
  }

  const hostPort = requireHostPort(url);
  if ("reason" in hostPort) {
    return { ok: false, reason: hostPort.reason };
  }

  const stream = getStreamSettings(url.searchParams, { allowReality: false });
  if (!stream.ok) {
    return stream;
  }

  return {
    ok: true,
    outbound: {
      protocol: "trojan",
      settings: {
        servers: [
          {
            address: hostPort.host,
            port: hostPort.port,
            password: decodeURIComponent(url.username)
          }
        ]
      },
      streamSettings: stream.outbound
    }
  };
}

function parseHostPort(value: string): { host: string; port: number } | null {
  const bracketMatch = value.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracketMatch) {
    const port = parsePort(bracketMatch[2]);
    return port ? { host: bracketMatch[1], port } : null;
  }

  const lastColon = value.lastIndexOf(":");
  if (lastColon < 1) {
    return null;
  }
  const host = value.slice(0, lastColon);
  const port = parsePort(value.slice(lastColon + 1));
  return host && port ? { host, port } : null;
}

function parseMethodPassword(value: string): { method: string; password: string } | null {
  const firstColon = value.indexOf(":");
  if (firstColon < 1) {
    return null;
  }
  return {
    method: decodeURIComponent(value.slice(0, firstColon)),
    password: decodeURIComponent(value.slice(firstColon + 1))
  };
}

function parseShadowsocksRaw(raw: string): ParsedShadowsocks | null {
  const withoutProtocol = raw.replace(/^ss:\/\//i, "");
  const withoutRemark = withoutProtocol.split("#")[0] || "";
  const withoutQuery = withoutRemark.split("?")[0] || "";
  const decodedInput = decodeURIComponent(withoutQuery);

  if (decodedInput.includes("@")) {
    const atIndex = decodedInput.lastIndexOf("@");
    const userPart = decodedInput.slice(0, atIndex);
    const hostPart = decodedInput.slice(atIndex + 1);
    const hostPort = parseHostPort(hostPart);
    if (!hostPort) {
      return null;
    }

    const direct = parseMethodPassword(userPart);
    if (direct) {
      return { ...direct, ...hostPort };
    }

    try {
      const decodedUser = decodeBase64Url(userPart);
      const parsed = parseMethodPassword(decodedUser);
      return parsed ? { ...parsed, ...hostPort } : null;
    } catch {
      return null;
    }
  }

  try {
    const decoded = decodeBase64Url(decodedInput);
    const atIndex = decoded.lastIndexOf("@");
    if (atIndex < 0) {
      return null;
    }
    const userPart = decoded.slice(0, atIndex);
    const hostPart = decoded.slice(atIndex + 1);
    const parsed = parseMethodPassword(userPart);
    const hostPort = parseHostPort(hostPart);
    return parsed && hostPort ? { ...parsed, ...hostPort } : null;
  } catch {
    return null;
  }
}

function buildShadowsocks(raw: string): BuildResult {
  const parsed = parseShadowsocksRaw(raw);
  if (!parsed) {
    return { ok: false, reason: "Shadowsocks URL 解析失败" };
  }

  if (!supportedShadowsocksMethods.has(parsed.method)) {
    return { ok: false, reason: "Shadowsocks method 暂不支持" };
  }

  return {
    ok: true,
    outbound: {
      protocol: "shadowsocks",
      settings: {
        servers: [
          {
            address: parsed.host,
            port: parsed.port,
            method: parsed.method,
            password: parsed.password
          }
        ]
      }
    }
  };
}

function valueOf(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return value === undefined || value === null ? "" : String(value);
}

function streamSettingsFromVmess(config: Record<string, unknown>): BuildResult {
  const network = valueOf(config, "net") || "tcp";
  if (!supportedNetworks.has(network)) {
    return { ok: false, reason: `暂不支持该 transport：${network}` };
  }

  const streamSettings: Record<string, unknown> = {
    network
  };
  const tls = valueOf(config, "tls");
  if (tls && tls !== "none") {
    if (tls !== "tls") {
      return { ok: false, reason: `暂不支持该 VMess tls：${tls}` };
    }
    streamSettings.security = "tls";
    streamSettings.tlsSettings = {
      serverName: valueOf(config, "sni") || valueOf(config, "host") || undefined,
      fingerprint: valueOf(config, "fp") || undefined,
      alpn: splitList(valueOf(config, "alpn")),
      allowInsecure: false
    };
  }

  if (network === "ws") {
    const host = valueOf(config, "host");
    streamSettings.wsSettings = {
      path: valueOf(config, "path") || "/",
      headers: host ? { Host: host } : undefined
    };
  }

  if (network === "grpc") {
    streamSettings.grpcSettings = {
      serviceName: valueOf(config, "path") || valueOf(config, "serviceName") || "",
      authority: valueOf(config, "host") || undefined
    };
  }

  return { ok: true, outbound: streamSettings };
}

function buildVmess(raw: string): BuildResult {
  try {
    const encoded = raw.replace(/^vmess:\/\//i, "");
    const config = JSON.parse(decodeBase64Url(encoded)) as Record<string, unknown>;
    const address = valueOf(config, "add");
    const port = parsePort(valueOf(config, "port"));
    const id = valueOf(config, "id");

    if (!address || !port) {
      return { ok: false, reason: "缺少 server 或 port" };
    }
    if (!id) {
      return { ok: false, reason: "缺少 VMess id" };
    }

    const stream = streamSettingsFromVmess(config);
    if (!stream.ok) {
      return stream;
    }

    return {
      ok: true,
      outbound: {
        protocol: "vmess",
        settings: {
          vnext: [
            {
              address,
              port,
              users: [
                {
                  id,
                  alterId: Number(valueOf(config, "aid") || 0),
                  security: valueOf(config, "scy") || "auto"
                }
              ]
            }
          ]
        },
        streamSettings: stream.outbound
      }
    };
  } catch {
    return { ok: false, reason: "VMess JSON 解析失败" };
  }
}

export function getNodeDetectionDebug(node: NodePoolItem, testUrl: string): NodeDetectionDebug {
  const fallback: NodeDetectionDebug = {
    protocol: node.protocol,
    network: "unknown",
    security: "unknown",
    flow: "",
    proxyType: "socks",
    testUrl,
    detectionCore: "xray"
  };

  if (node.protocol === "vless" || node.protocol === "trojan") {
    const url = parseUrl(node.raw);
    if (!url) {
      return fallback;
    }

    return {
      ...fallback,
      network: firstParam(url.searchParams, ["type", "network"]) || "tcp",
      security: firstParam(url.searchParams, ["security", "tls"]) || "none",
      flow: firstParam(url.searchParams, ["flow"])
    };
  }

  if (node.protocol === "vmess") {
    try {
      const encoded = node.raw.replace(/^vmess:\/\//i, "");
      const config = JSON.parse(decodeBase64Url(encoded)) as Record<string, unknown>;
      return {
        ...fallback,
        network: valueOf(config, "net") || "tcp",
        security: valueOf(config, "tls") || "none",
        flow: ""
      };
    } catch {
      return fallback;
    }
  }

  if (node.protocol === "ss") {
    return {
      ...fallback,
      network: "tcp",
      security: "none"
    };
  }

  return fallback;
}

export function buildXrayConfig(node: NodePoolItem, localPort: number): BuildResult {
  let outbound: BuildResult;

  if (node.protocol === "vless") {
    outbound = buildVless(node.raw);
  } else if (node.protocol === "trojan") {
    outbound = buildTrojan(node.raw);
  } else if (node.protocol === "ss") {
    outbound = buildShadowsocks(node.raw);
  } else if (node.protocol === "vmess") {
    outbound = buildVmess(node.raw);
  } else {
    outbound = { ok: false, reason: "当前版本暂不支持该节点协议" };
  }

  if (!outbound.ok) {
    return outbound;
  }

  return {
    ok: true,
    outbound: {
      log: {
        loglevel: "warning"
      },
      inbounds: [
        {
          listen: "127.0.0.1",
          port: localPort,
          protocol: "socks",
          settings: {
            udp: false,
            auth: "noauth"
          },
          sniffing: {
            enabled: false
          }
        }
      ],
      outbounds: [
        outbound.outbound,
        {
          protocol: "freedom",
          tag: "direct"
        },
        {
          protocol: "blackhole",
          tag: "blocked"
        }
      ],
      routing: {
        domainStrategy: "AsIs",
        rules: []
      }
    }
  };
}
