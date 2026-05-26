import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import tls from "node:tls";
import { getFreeLocalPort } from "../utils/port.js";
import { removeTempFile, writeTempJsonFile } from "../utils/tempFile.js";
import type { NodePoolItem } from "../nodePool/nodeTypes.js";
import { buildXrayConfig } from "./xrayConfigBuilder.js";
import type { DetectionResult, DetectionSettings } from "./detectionTypes.js";

const xrayMissingMessage = "未检测到 Xray-core，请先安装或放置 Xray-core 到指定目录";

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

function requestThroughHttpProxy(proxyPort: number, targetUrl: string, timeoutMs: number): Promise<number> {
  const startedAt = Date.now();
  const url = new URL(targetUrl);

  return new Promise((resolve, reject) => {
    const socket = net.connect(proxyPort, "127.0.0.1");
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error("检测超时"));
    }, timeoutMs);

    socket.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    socket.once("connect", () => {
      socket.write(`CONNECT ${url.hostname}:443 HTTP/1.1\r\nHost: ${url.hostname}:443\r\n\r\n`);
    });

    let connected = false;
    let responseBuffer = "";

    socket.on("data", (chunk) => {
      if (connected) {
        return;
      }

      responseBuffer += chunk.toString("utf8");
      if (!responseBuffer.includes("\r\n\r\n")) {
        return;
      }

      if (!responseBuffer.startsWith("HTTP/1.1 200") && !responseBuffer.startsWith("HTTP/1.0 200")) {
        clearTimeout(timeout);
        socket.destroy();
        reject(new Error("代理连接失败"));
        return;
      }

      connected = true;
      const secureSocket = tls.connect({
        socket,
        servername: url.hostname
      });

      secureSocket.once("secureConnect", () => {
        secureSocket.write(`GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: ${url.hostname}\r\nConnection: close\r\n\r\n`);
      });

      let httpsResponse = "";
      secureSocket.on("data", (secureChunk) => {
        httpsResponse += secureChunk.toString("utf8");
      });
      secureSocket.once("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      secureSocket.once("end", () => {
        clearTimeout(timeout);
        const firstLine = httpsResponse.split("\r\n")[0] || "";
        if (/^HTTP\/\d\.\d 2\d\d/.test(firstLine) || firstLine.includes("204")) {
          resolve(Date.now() - startedAt);
          return;
        }
        reject(new Error(`检测目标返回异常：${firstLine || "无响应"}`));
      });
    });
  });
}

export async function testNodeWithXray(node: NodePoolItem, settings: DetectionSettings): Promise<DetectionResult> {
  if (!(await isXrayInstalled(settings.xrayBinaryPath))) {
    return {
      nodeId: node.id,
      status: "error",
      responseMs: null,
      failureReason: xrayMissingMessage
    };
  }

  const localPort = await getFreeLocalPort();
  const config = buildXrayConfig(node, localPort);

  if (!config.ok) {
    return {
      nodeId: node.id,
      status: "unsupported",
      responseMs: null,
      failureReason: config.reason
    };
  }

  let child: ChildProcessWithoutNullStreams | null = null;
  let configPath: string | null = null;

  try {
    configPath = await writeTempJsonFile("huage-xray-", config.outbound);
    child = spawn(settings.xrayBinaryPath, ["run", "-config", configPath], {
      stdio: "pipe"
    });
    child.stdout.on("data", () => undefined);
    child.stderr.on("data", () => undefined);

    await delay(700);
    const responseMs = await requestThroughHttpProxy(localPort, settings.testUrl, settings.timeoutSeconds * 1000);

    return {
      nodeId: node.id,
      status: "available",
      responseMs,
      failureReason: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "检测失败";
    return {
      nodeId: node.id,
      status: "unavailable",
      responseMs: null,
      failureReason: message
    };
  } finally {
    safeKill(child);
    if (configPath) {
      await removeTempFile(configPath).catch(() => undefined);
    }
  }
}
