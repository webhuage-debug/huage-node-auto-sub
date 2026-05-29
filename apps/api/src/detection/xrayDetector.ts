import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import tls from "node:tls";
import { getFreeLocalPort } from "../utils/port.js";
import { removeTempFile, writeTempJsonFile } from "../utils/tempFile.js";
import type { NodePoolItem } from "../nodePool/nodeTypes.js";
import { buildXrayConfig, getNodeDetectionDebug } from "./xrayConfigBuilder.js";
import type { DetectionDebug, DetectionResult, DetectionSettings, XrayCoreStatus } from "./detectionTypes.js";

const xrayMissingMessage = "未检测到 Xray-core，请先安装或放置 Xray-core 到指定目录";

type SocksStage = "SOCKS_GREETING" | "SOCKS_CONNECT" | "TLS_REQUEST";

type CurlDetectionResult = {
  exitCode: number | null;
  httpCode: string;
  stderr: string;
  responseMs: number;
};

export async function isXrayInstalled(binaryPath: string): Promise<boolean> {
  return (await getXrayCoreStatus(binaryPath)).available;
}

function parseXrayVersion(output: string): string | null {
  const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0) || "";
  const match = firstLine.match(/\bXray\s+([^\s]+)/i);
  return match?.[1] || null;
}

function runXrayVersion(binaryPath: string): Promise<{ exitCode: number | null; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, ["version"], {
      stdio: "pipe"
    });

    let output = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("XRAY_VERSION_CHECK_TIMEOUT"));
    }, 5000);

    child.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      output += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timeout);
      resolve({ exitCode, output });
    });
  });
}

export async function getXrayCoreStatus(binaryPath: string): Promise<XrayCoreStatus> {
  try {
    await fs.access(binaryPath, fsConstants.F_OK);
  } catch {
    return {
      installed: false,
      available: false,
      binaryPath,
      version: null,
      failureReason: "XRAY_BINARY_NOT_FOUND",
      message: "未找到 Xray-core，请确认 cores/xray/xray 已挂载到容器"
    };
  }

  try {
    await fs.access(binaryPath, fsConstants.X_OK);
  } catch {
    return {
      installed: true,
      available: false,
      binaryPath,
      version: null,
      failureReason: "XRAY_BINARY_NOT_EXECUTABLE",
      message: "Xray-core 文件存在，但没有执行权限"
    };
  }

  try {
    const result = await runXrayVersion(binaryPath);
    const version = parseXrayVersion(result.output);

    if (result.exitCode === 0 && version) {
      return {
        installed: true,
        available: true,
        binaryPath,
        version,
        failureReason: null,
        message: "Xray-core 已安装并可执行"
      };
    }
  } catch {
    // Keep the public status response compact and safe.
  }

  return {
    installed: true,
    available: false,
    binaryPath,
    version: null,
    failureReason: "XRAY_VERSION_CHECK_FAILED",
    message: "Xray-core version 检查失败，请确认内核文件可在容器内执行"
  };
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

async function waitForSocksPort(proxyPort: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "SOCKS 端口未监听";

  while (Date.now() < deadline) {
    try {
      const socket = await connectTcp("127.0.0.1", proxyPort, 300);
      socket.destroy();
      return;
    } catch (error) {
      lastError = getErrorMessage(error);
      await delay(100);
    }
  }

  throw new Error(lastError);
}

function runCurlThroughSocks(proxyPort: number, targetUrl: string, timeoutSeconds: number): Promise<CurlDetectionResult> {
  const startedAt = Date.now();
  const args = [
    "--silent",
    "--show-error",
    "--output",
    "/dev/null",
    "--write-out",
    "%{http_code}",
    "--max-time",
    String(Math.max(1, timeoutSeconds)),
    "--socks5-hostname",
    `127.0.0.1:${proxyPort}`,
    targetUrl
  ];

  return new Promise((resolve, reject) => {
    const child = spawn("curl", args, {
      stdio: "pipe"
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", (error) => {
      reject(error);
    });
    child.once("close", (exitCode) => {
      resolve({
        exitCode,
        httpCode: stdout.trim(),
        stderr: stderr.replace(/\s+/g, " ").trim().slice(0, 200),
        responseMs: Date.now() - startedAt
      });
    });
  });
}

function isSuccessfulHttpCode(httpCode: string): boolean {
  return httpCode === "204" || httpCode === "200";
}

function buildCurlFailureReason(curlResult: CurlDetectionResult, xrayHints: string[]): string {
  if (xrayHints.length > 0) {
    return `Reality 握手失败：Xray 日志出现 TLS/Reality 相关错误。请检查 publicKey、serverName、shortId、spiderX、flow 是否和客户端一致。Xray 提示：${xrayHints.join(" | ")}`;
  }

  if (curlResult.httpCode && curlResult.httpCode !== "000") {
    return `curl socks 检测 HTTP 状态异常：http_code=${curlResult.httpCode}`;
  }

  return `curl socks 检测失败：exitCode=${curlResult.exitCode ?? "unknown"}${curlResult.stderr ? `，${curlResult.stderr}` : ""}`;
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
  const debug: DetectionDebug = {
    ...getNodeDetectionDebug(node, settings.testUrl),
    configBuildOk: false,
    xrayStarted: false,
    curlExitCode: null,
    httpCode: null,
    failureStage: null,
    safeFailureReason: null
  };

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
  debug.socksPort = localPort;
  const config = buildXrayConfig(node, localPort);

  if (!config.ok) {
    debug.failureStage = "CONFIG_BUILD";
    debug.safeFailureReason = config.reason;
    return {
      nodeId: node.id,
      status: "unsupported",
      responseMs: null,
      failureReason: config.reason,
      debug
    };
  }
  debug.configBuildOk = true;

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

    await delay(300);
    if (childStartError) {
      debug.failureStage = "XRAY_START";
      debug.safeFailureReason = `Xray 启动失败：${getErrorMessage(childStartError)}`;
      return {
        nodeId: node.id,
        status: "error",
        responseMs: null,
        failureReason: `Xray 启动失败：${getErrorMessage(childStartError)}`,
        debug
      };
    }
    if (child.exitCode !== null) {
      debug.failureStage = "XRAY_START";
      debug.safeFailureReason = `Xray 配置错误或启动失败：子进程提前退出，exitCode=${child.exitCode}`;
      return {
        nodeId: node.id,
        status: "error",
        responseMs: null,
        failureReason: `Xray 配置错误或启动失败：子进程提前退出，exitCode=${child.exitCode}`,
        debug
      };
    }
    debug.xrayStarted = true;

    try {
      await waitForSocksPort(localPort, 3000);
    } catch (error) {
      debug.failureStage = "SOCKS_LISTEN";
      debug.safeFailureReason = `Xray SOCKS 端口未就绪：${getErrorMessage(error)}`;
      return {
        nodeId: node.id,
        status: "error",
        responseMs: null,
        failureReason: debug.safeFailureReason,
        debug
      };
    }

    const curlResult = await runCurlThroughSocks(localPort, settings.testUrl, settings.timeoutSeconds);
    debug.curlExitCode = curlResult.exitCode;
    debug.httpCode = curlResult.httpCode;

    if (curlResult.exitCode === 0 && isSuccessfulHttpCode(curlResult.httpCode)) {
      debug.failureStage = null;
      debug.safeFailureReason = null;
      return {
        nodeId: node.id,
        status: "available",
        responseMs: curlResult.responseMs,
        failureReason: null,
        debug
      };
    }

    const curlFailureReason = buildCurlFailureReason(curlResult, xrayHints);
    debug.failureStage = "CURL_REQUEST";
    debug.safeFailureReason = curlFailureReason;
    return {
      nodeId: node.id,
      status: "unavailable",
      responseMs: null,
      failureReason: curlFailureReason,
      debug
    };
  } catch (error) {
    const reason = normalizeFailureReason(error);
    debug.safeFailureReason = reason;
    if (!debug.failureStage) {
      debug.failureStage = "CURL_REQUEST";
    }
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
