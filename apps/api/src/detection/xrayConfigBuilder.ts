import type { NodePoolItem } from "../nodePool/nodeTypes.js";

type BuildResult =
  | { ok: true; outbound: Record<string, unknown> }
  | { ok: false; reason: string };

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function getStreamSettings(params: URLSearchParams): BuildResult {
  const network = params.get("type") || params.get("network") || "tcp";
  const security = params.get("security") || "";

  if (network === "grpc" || security === "reality") {
    return { ok: false, reason: "当前版本暂不支持该节点参数" };
  }

  const streamSettings: Record<string, unknown> = {
    network
  };

  if (security === "tls") {
    streamSettings.security = "tls";
    streamSettings.tlsSettings = {
      serverName: params.get("sni") || params.get("host") || undefined,
      allowInsecure: false
    };
  }

  if (network === "ws") {
    const host = params.get("host");
    streamSettings.wsSettings = {
      path: params.get("path") || "/",
      headers: host ? { Host: host } : undefined
    };
  }

  return { ok: true, outbound: streamSettings };
}

function buildVless(raw: string): BuildResult {
  const url = parseUrl(raw);
  if (!url || !url.username || !url.hostname || !url.port) {
    return { ok: false, reason: "当前版本暂不支持该节点参数" };
  }

  const stream = getStreamSettings(url.searchParams);
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
            address: url.hostname,
            port: Number(url.port),
            users: [
              {
                id: decodeURIComponent(url.username),
                encryption: url.searchParams.get("encryption") || "none",
                flow: url.searchParams.get("flow") || undefined
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
  if (!url || !url.username || !url.hostname || !url.port) {
    return { ok: false, reason: "当前版本暂不支持该节点参数" };
  }

  const stream = getStreamSettings(url.searchParams);
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
            address: url.hostname,
            port: Number(url.port),
            password: decodeURIComponent(url.username)
          }
        ]
      },
      streamSettings: stream.outbound
    }
  };
}

function parseShadowsocksUserInfo(url: URL): { method: string; password: string } | null {
  const direct = `${url.username}${url.password ? `:${url.password}` : ""}`;
  const decodedDirect = decodeURIComponent(direct);

  if (decodedDirect.includes(":")) {
    const [method, ...passwordParts] = decodedDirect.split(":");
    return { method, password: passwordParts.join(":") };
  }

  try {
    const decoded = decodeBase64Url(url.username);
    const [method, ...passwordParts] = decoded.split(":");
    if (method && passwordParts.length > 0) {
      return { method, password: passwordParts.join(":") };
    }
  } catch {
    return null;
  }

  return null;
}

function buildShadowsocks(raw: string): BuildResult {
  const url = parseUrl(raw);
  if (!url || !url.hostname || !url.port) {
    return { ok: false, reason: "当前版本暂不支持该节点参数" };
  }

  const userInfo = parseShadowsocksUserInfo(url);
  if (!userInfo) {
    return { ok: false, reason: "当前版本暂不支持该节点参数" };
  }

  return {
    ok: true,
    outbound: {
      protocol: "shadowsocks",
      settings: {
        servers: [
          {
            address: url.hostname,
            port: Number(url.port),
            method: userInfo.method,
            password: userInfo.password
          }
        ]
      }
    }
  };
}

function buildVmess(raw: string): BuildResult {
  try {
    const encoded = raw.replace(/^vmess:\/\//i, "");
    const config = JSON.parse(decodeBase64Url(encoded)) as Record<string, string | number | undefined>;
    const network = String(config.net || "tcp");
    const tls = String(config.tls || "");

    if (network === "grpc" || String(config.type || "") === "grpc") {
      return { ok: false, reason: "当前版本暂不支持该节点参数" };
    }

    const streamSettings: Record<string, unknown> = { network };
    if (tls === "tls") {
      streamSettings.security = "tls";
      streamSettings.tlsSettings = {
        serverName: config.sni || config.host || undefined,
        allowInsecure: false
      };
    }
    if (network === "ws") {
      streamSettings.wsSettings = {
        path: config.path || "/",
        headers: config.host ? { Host: config.host } : undefined
      };
    }

    return {
      ok: true,
      outbound: {
        protocol: "vmess",
        settings: {
          vnext: [
            {
              address: config.add,
              port: Number(config.port),
              users: [
                {
                  id: config.id,
                  alterId: Number(config.aid || 0),
                  security: config.scy || "auto"
                }
              ]
            }
          ]
        },
        streamSettings
      }
    };
  } catch {
    return { ok: false, reason: "当前版本暂不支持该节点参数" };
  }
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
          protocol: "http",
          settings: {}
        }
      ],
      outbounds: [outbound.outbound]
    }
  };
}
