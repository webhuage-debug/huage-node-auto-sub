import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import tls from "node:tls";
import { getFreeLocalPort } from "../utils/port.js";
import { removeTempFile, writeTempJsonFile } from "../utils/tempFile.js";
import type { NodePoolItem } from "../nodePool/nodeTypes.js";
import { buildXrayConfig, getNodeDetectionDebug } from "./xrayConfigBuilder.js";
import type { DetectionResult, DetectionSettings } from "./detectionTypes.js";

const xrayMissingMessage = "未检测到 Xray-core，请先安装或放置 Xray-core 到指定目录";

type SocksStage = "SOCKS_GREETING" | "SOCKS_CONNECT" | "TLS_REQUEST";

export async function isXrayInstalled(binaryPath: string): Promise<boolean> {
  try {
    await fs.access(binaryPath);
    return true;
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeKill(child: ChildProcessWithoutNullStreams | null): void {
  if (child && !child.killed) {
    child.kill("SIGTERM");
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void, message: string): Promise<T> {
  let timeout: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeout = setTimeout(() => {
      onTimeout();
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

function waitForSocketData(socket: net.Socket, timeoutMs: number, stage: SocksStage): Promise<Buffer> {
  return withTimeout(
    new Promise<Buffer>((resolve, reject) => {
      const cleanup = () => {
        socket.off("data", onData);
        socket.off("error", onError);
      };
      const onData = (chunk: Buffer) => {
        cleanup();
        resolve(chunk);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`${stage} 失败：${error.message}`));
      };

      socket.once("data", onData);
      socket.once("error", onError);
    }),
    timeoutMs,
    () => socket.destroy(),
    `${stage} 超时`
  );
}

function connectTcp(host: string, port: number, timeoutMs: number): Promise<net.Socket> {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.connect(port, host);
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("SOCKS 连接超时"));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("error", onError);
    };
    const onConnect = () => {
      cleanup();
      resolve(socket);
    };
    const onError = (error: Error) => {
      cleanup();
      reject(new Error(`SOCKS 连接失败：${error.message}`));
    };

    socket.once("connect", onConnect);
    socket.once("error", onError);
  });
}

async function connectSocks5(proxyPort: number, targetHost: string, targetPort: number, timeoutMs: number): Promise<net.Socket> {
  const socket = await connectTcp("127.0.0.1", proxyPort, timeoutMs);

  try {
    socket.write(Buffer.from([0x05, 0x01, 0x00]));
    const greeting = await waitForSocketData(socket, timeoutMs, "SOCKS_GREETING");
    if (greeting.length < 2 || greeting[0] !== 0x05 || greeting[1] !== 0x00) {
      throw new Error("SOCKS 握手失败：代理未接受 noauth");
    }

    const host = Buffer.from(targetHost);
    if (host.length > 255) {
      throw new Error("SOCKS 请求失败：目标域名过长");
    }

    const port = Buffer.alloc(2);
    port.writeUInt16BE(targetPort, 0);
    socket.write(Buffer.concat([Buffer.from([0x05, 0x01, 0x00, 0x03, host.length]), host, port]));

    const connected = await waitForSocketData(socket, timeoutMs, "SOCKS_CONNECT");
    if (connected.length < 2 || connected[0] !== 0x05 || connected[1] !== 0x00) {
      throw new Error(`SOCKS 请求失败：代理连接目标失败，状态码 ${connected[1] ?? "unknown"}`);
    }

    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
    return socket;
  } catch (error) {
    socket.destroy();
    throw error;
  }
}

function requestHttpsOverSocket(socket: net.Socket, targetUrl: URL, timeoutMs: number): Promise<number> {
  const startedAt = Date.now();

  return withTimeout(
    new Promise<number>((resolve, reject) => {
      const secureSocket = tls.connect({
        socket,
        servername: targetUrl.hostname
      });

      const cleanup = () => {
        secureSocket.off("secureConnect", onSecureConnect);
        secureSocket.off("data", onData);
        secureSocket.off("error", onError);
        secureSocket.off("end", onEnd);
      };
      const onSecureConnect = () => {
        secureSocket.write(`GET ${targetUrl.pathname}${targetUrl.search} HTTP/1.1\r\nHost: ${targetUrl.hostname}\r\nConnection: close\r\n\r\n`);
      };
      let response = "";
      const onData = (chunk: Buffer) => {
        response += chunk.toString("utf8");
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`TLS/Reality 握手失败：${error.message}`));
      };
      const onEnd = () => {
        cleanup();
        const firstLine = response.split("\r\n")[0] || "";
        if (/^HTTP\/\d\.\d 2\d\d/.test(firstLine) || firstLine.includes("204")) {
          resolve(Date.now() - startedAt);
          return;
        }
        reject(new Error(`HTTP 状态异常：${firstLine || "无响应"}`));
      };

      secureSocket.once("secureConnect", onSecureConnect);
      secureSocket.on("data", onData);
      secureSocket.once("error", onError);
      secureSocket.once("end", onEnd);
    }),
    timeoutMs,
    () => socket.destroy(),
    "检测 URL 超时"
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "未知错误";
}

async function requestThroughSocksProxy(proxyPort: number, targetUrl: string, timeoutMs: number): Promise<number> {
  const url = new URL(targetUrl);
  const targetPort = url.port ? Number(url.port) : 443;
  const socket = await connectSocks5(proxyPort, url.hostname, targetPort, timeoutMs);
  return requestHttpsOverSocket(socket, url, timeoutMs);
}

function normalizeFailureReason(error: unknown): string {
  const message = getErrorMessage(error);
  const lower = message.toLowerCase();

  if (message.includes("检测 URL 超时") || lower.includes("timeout") || lower.includes("timed out")) {
    return "检测 URL 超时";
  }

  if (message.includes("SOCKS")) {
    return message;
  }

  if (
    message.includes("TLS/Reality") ||
    lower.includes("bad record mac") ||
    lower.includes("decryption failed") ||
    lower.includes("ssl") ||
    lower.includes("handshake")
  ) {
    const detail = message.replace(/^TLS\/Reality 握手失败：/, "");
    return `Reality 握手失败：请检查 publicKey、serverName、shortId、spiderX、flow 是否和客户端一致。原始错误：${detail}`;
  }

  if (message.includes("HTTP 状态异常")) {
    return message;
  }

  return `检测请求失败：${message}`;
}

export async function testNodeWithXray(node: NodePoolItem, settings: DetectionSettings): Promise<DetectionResult> {
  const debug = getNodeDetectionDebug(node, settings.testUrl);

  if (!(await isXrayInstalled(settings.xrayBinaryPath))) {
    return {
      nodeId: node.id,
      status: "error",
      responseMs: null,
      failureReason: xrayMissingMessage,
      debug
    };
  }

  const localPort = await getFreeLocalPort();
  const config = buildXrayConfig(node, localPort);

  if (!config.ok) {
    return {
      nodeId: node.id,
      status: "unsupported",
      responseMs: null,
      failureReason: config.reason,
      debug
    };
  }

  let child: ChildProcessWithoutNullStreams | null = null;
  let configPath: string | null = null;
  const xrayHints: string[] = [];

  try {
    configPath = await writeTempJsonFile("huage-xray-", config.outbound);
    child = spawn(settings.xrayBinaryPath, ["run", "-config", configPath], {
      stdio: "pipe"
    });

    let childStartError: Error | null = null;
    child.once("error", (error) => {
      childStartError = error;
    });
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8");
      if (/reality|tls|handshake|bad record|decryption|ssl/i.test(text)) {
        xrayHints.push(text.replace(/\s+/g, " ").slice(0, 240));
      }
    });

    await delay(1000);
    if (childStartError) {
      return {
        nodeId: node.id,
        status: "error",
        responseMs: null,
        failureReason: `Xray 启动失败：${getErrorMessage(childStartError)}`,
        debug
      };
    }
    if (child.exitCode !== null) {
      return {
        nodeId: node.id,
        status: "error",
        responseMs: null,
        failureReason: `Xray 配置错误或启动失败：子进程提前退出，exitCode=${child.exitCode}`,
        debug
      };
    }

    const responseMs = await requestThroughSocksProxy(localPort, settings.testUrl, settings.timeoutSeconds * 1000);

    return {
      nodeId: node.id,
      status: "available",
      responseMs,
      failureReason: null,
      debug
    };
  } catch (error) {
    const reason = normalizeFailureReason(error);
    return {
      nodeId: node.id,
      status: "unavailable",
      responseMs: null,
      failureReason: xrayHints.length > 0 ? `${reason} Xray 提示：${xrayHints.join(" | ")}` : reason,
      debug
    };
  } finally {
    safeKill(child);
    if (configPath) {
      await removeTempFile(configPath).catch(() => undefined);
    }
  }
}
