import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

type MenuKey =
  | "overview"
  | "collector"
  | "detection"
  | "subscription"
  | "cores"
  | "stats"
  | "settings";

type MenuItem = {
  key: MenuKey;
  label: string;
};

type CollectorStatus = {
  enabled: boolean;
  keywordCount: number;
  requestIntervalSeconds: number;
  maxRequestsPerMinute: number;
  maxRequestsPerHour: number;
  backoffOn403Minutes: number;
  backoffOn429Minutes: number;
  githubTokenConfigured: boolean;
  running: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  rateLimited: boolean;
  rateLimitReason: string | null;
  requestCountThisRun: number;
  lastResultCount: number;
};

type CollectorResult = {
  keyword: string;
  repository: string;
  path: string;
  url: string;
  fetchedAt: string;
};

type CollectorResultsResponse = {
  ok: boolean;
  lastRunAt: string | null;
  resultCount: number;
  results: CollectorResult[];
};

type NodePoolStatus = {
  ok: boolean;
  total: number;
  untested: number;
  testing: number;
  available: number;
  unavailable: number;
  unsupported: number;
  error: number;
  manualAvailable: number;
  manualUnavailable: number;
  autoAvailable: number;
  autoUnavailable: number;
  protocolStats: Record<string, number>;
  sourceStats: Record<string, number>;
  regionStats: Record<string, number>;
  lastUpdatedAt: string | null;
};

type NodePoolItem = {
  id: string;
  protocol: string;
  masked: string;
  sourceType: string;
  sourceRepository: string | null;
  sourcePath: string;
  sourceUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
  status: string;
  region: string;
  remark: string;
  lastTestedAt?: string | null;
  detectionCore?: string | null;
  responseMs?: number | null;
  failureReason?: string | null;
  manualOverride?: boolean;
  manualStatus?: "available" | "unavailable" | null;
  manualReason?: string | null;
  manualUpdatedAt?: string | null;
  detectionDebug?: {
    protocol: string;
    network: string;
    security: string;
    flow: string;
    proxyType: "socks";
    testUrl: string;
    detectionCore: "xray";
  };
  testCount?: number;
  successCount?: number;
  failCount?: number;
};

type NodeListResponse = {
  ok: boolean;
  total: number;
  items: NodePoolItem[];
};

type ParseHistoryItem = {
  ranAt: string;
  sourceType: string;
  processedSources: number;
  fetchedFiles: number;
  found: number;
  inserted: number;
  duplicated: number;
  rateLimited: boolean;
  lastError: string | null;
};

type ParseHistoryResponse = {
  ok: boolean;
  items: ParseHistoryItem[];
};

type XrayDetectionStatus = {
  ok: boolean;
  core: string;
  xrayInstalled: boolean;
  xrayBinaryPath: string;
  running: boolean;
  queueSize: number;
  testingCount: number;
  lastRunAt: string | null;
  lastError: string | null;
  timeoutSeconds: number;
  maxConcurrent: number;
  proxyType: "socks";
  testUrl: string;
  message: string | null;
};

type DetectionHistoryItem = {
  runAt: string;
  core: string;
  tested: number;
  available: number;
  unavailable: number;
  unsupported: number;
  error: number;
};

type DetectionHistoryResponse = {
  ok: boolean;
  items: DetectionHistoryItem[];
};

type SubscriptionStatus = {
  ok: boolean;
  generated: boolean;
  tokenCreated: boolean;
  safeSubscriptionUrl: string | null;
  nodeCount: number;
  targetNodeCount: number;
  minNodeCount: number;
  lastGeneratedAt: string | null;
  warning: string | null;
  autoRefreshEnabled: boolean;
  refreshIntervalMinutes: number;
  lastAutoRefreshAt: string | null;
  nextAutoRefreshAt: string | null;
  lastAutoRefreshOk: boolean | null;
  lastAutoRefreshWarning: string | null;
  lastAutoRefreshError: string | null;
  publicBaseUrlConfigured: boolean;
  publicSubscriptionBaseUrl: string | null;
  copyableSubscriptionUrlReady: boolean;
  expiresAt: string | null;
  validityDays: number;
  expirationUpdatedAt: string | null;
  expired: boolean;
  remainingSeconds: number;
  remainingDays: number;
  subscriptionAccessible: boolean;
};

type ClaimVerifyResponse = {
  ok: boolean;
  message: string;
  claimAllowed: boolean;
  subscriptionReady: boolean;
  copyableSubscriptionUrl?: string;
  remainingAttempts?: number;
  retryAfterSeconds?: number;
  error?: string;
};

type PublishCheckStatus = "pass" | "warning" | "fail";

type PublishCheckItem = {
  key: string;
  label: string;
  status: PublishCheckStatus;
  message: string;
  detail?: string;
};

type PublishCheckResponse = {
  ok: boolean;
  version: string;
  canPublish: boolean;
  level: PublishCheckStatus;
  summary: string;
  checks: PublishCheckItem[];
  reminders: string[];
};

type PublishPrepareResponse = {
  ok: boolean;
  message: string;
  tokenReset?: boolean;
  expirationRenewed?: boolean;
  expiresAt?: string | null;
  remainingDays?: number;
  subscriptionAccessible?: boolean;
  publicBaseUrlConfigured?: boolean;
  error?: string;
};

const appVersion = "v1.0.0";

const menus: MenuItem[] = [
  { key: "overview", label: "总览" },
  { key: "collector", label: "采集管理" },
  { key: "detection", label: "检测管理" },
  { key: "subscription", label: "订阅管理" },
  { key: "cores", label: "内核管理" },
  { key: "stats", label: "统计数据" },
  { key: "settings", label: "系统设置" }
];

const placeholderMessage = "当前为框架版本，该功能将在后续版本实现。";

function notifyPlaceholder() {
  window.alert(placeholderMessage);
}

function formatBool(value: boolean, yes = "是", no = "否") {
  return value ? yes : no;
}

function formatDate(value: string | null) {
  if (!value) {
    return "暂无";
  }

  return new Date(value).toLocaleString("zh-CN");
}

function formatFailureReason(value?: string | null) {
  if (!value) {
    return "-";
  }

  const lower = value.toLowerCase();
  if (lower.includes("bad record mac") || lower.includes("decryption failed") || lower.includes("reality") || lower.includes("tls")) {
    return `Reality 握手失败，可能是配置映射或节点不可达。${value}`;
  }

  return value;
}

function formatStats(stats: Record<string, number> | undefined) {
  if (!stats || Object.keys(stats).length === 0) {
    return "暂无数据";
  }

  return Object.entries(stats)
    .map(([key, value]) => `${key}：${value}`)
    .join("，");
}

function formatManualStatus(node: NodePoolItem) {
  if (!node.manualOverride) {
    return "否";
  }
  return node.manualStatus === "available" ? "手动可用" : "手动不可用";
}

function formatPublishCheckStatus(status: PublishCheckStatus) {
  if (status === "pass") {
    return "通过";
  }
  if (status === "warning") {
    return "警告";
  }
  return "失败";
}

function formatPublishCheckSummary(status: PublishCheckResponse | null) {
  if (!status) {
    return "正在读取发布前检查结果";
  }
  if (!status.canPublish) {
    return "暂不建议发布";
  }
  return status.level === "warning" ? "可以发布，但建议检查警告项" : "可以发布";
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the textarea fallback for HTTP or restricted browser contexts.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

function joinPublicSubscriptionUrl(baseUrl: string, subscriptionPath: string): string {
  const base = baseUrl.replace(/\/+$/g, "");
  const path = subscriptionPath.startsWith("/") ? subscriptionPath : `/${subscriptionPath}`;
  return `${base}${path}`;
}

function formatSubscriptionExpiration(status: SubscriptionStatus | null): string {
  if (!status?.generated) {
    return "未生成";
  }
  return status.expired ? "已过期" : "有效";
}

function formatRemainingTime(status: SubscriptionStatus | null): string {
  if (!status?.generated || !status.expiresAt) {
    return "暂无";
  }
  if (status.expired || status.remainingSeconds <= 0) {
    return "已过期";
  }
  return `${status.remainingDays} 天`;
}

function formatRetryAfter(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "请稍后再试。";
  }

  const minutes = Math.ceil(seconds / 60);
  return `大约 ${minutes} 分钟后再试。`;
}

function getQrUnavailableReason(status: SubscriptionStatus | null): string | null {
  if (!status?.generated || !status.safeSubscriptionUrl) {
    return "请先生成安全订阅。";
  }
  if (!status.publicBaseUrlConfigured || !status.publicSubscriptionBaseUrl) {
    return "请先配置公开订阅域名 SUBSCRIPTION_PUBLIC_BASE_URL。";
  }
  if (status.expired || !status.subscriptionAccessible) {
    return "订阅已过期，请先续期。";
  }
  if (!status.copyableSubscriptionUrlReady) {
    return "公开订阅链接暂不可用，请检查公开订阅域名配置。";
  }
  return null;
}

function getPublicSubscriptionUrl(status: SubscriptionStatus | null): string | null {
  const unavailableReason = getQrUnavailableReason(status);
  if (unavailableReason || !status?.publicSubscriptionBaseUrl || !status.safeSubscriptionUrl) {
    return null;
  }

  return joinPublicSubscriptionUrl(status.publicSubscriptionBaseUrl, status.safeSubscriptionUrl);
}

function InfoGrid({ items }: { items: Array<[string, string]> }) {
  return (
    <div className="info-grid">
      {items.map(([label, value]) => (
        <div className="info-item" key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function SectionNote({ children }: { children: string }) {
  return <div className="section-note">{children}</div>;
}

function NodeListTable({
  nodes,
  onManualStatus,
  manualActionNodeId
}: {
  nodes: NodePoolItem[];
  onManualStatus?: (node: NodePoolItem, status: "available" | "unavailable" | "untested") => void | Promise<void>;
  manualActionNodeId?: string | null;
}) {
  return (
    <div className="table-panel">
      <table>
        <thead>
          <tr>
            <th>协议</th>
            <th>脱敏节点</th>
            <th>来源</th>
            <th>仓库</th>
            <th>状态</th>
            <th>是否手动确认</th>
            <th>手动原因</th>
            <th>响应</th>
            <th>失败原因</th>
            <th>检测摘要</th>
            <th>首次发现时间</th>
            <th>最近检测时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 ? (
            <tr>
              <td colSpan={13}>暂无节点池数据</td>
            </tr>
          ) : (
            nodes.map((node) => (
              <tr key={node.id}>
                <td>{node.protocol}</td>
                <td className="masked-node">{node.masked}</td>
                <td>{node.sourceType}</td>
                <td>{node.sourceRepository || "-"}</td>
                <td>{node.status}</td>
                <td>{formatManualStatus(node)}</td>
                <td className="wrap-cell">{node.manualReason || "-"}</td>
                <td>{node.responseMs ? `${node.responseMs} ms` : "-"}</td>
                <td className="wrap-cell">{formatFailureReason(node.failureReason)}</td>
                <td className="wrap-cell">
                  {node.detectionDebug
                    ? `${node.detectionDebug.protocol} / ${node.detectionDebug.network} / ${node.detectionDebug.security} / ${node.detectionDebug.flow || "-"} / ${node.detectionDebug.detectionCore}`
                    : "-"}
                </td>
                <td>{formatDate(node.firstSeenAt)}</td>
                <td>{formatDate(node.lastTestedAt || null)}</td>
                <td>
                  {onManualStatus ? (
                    <div className="node-actions">
                      <button disabled={manualActionNodeId === node.id} onClick={() => { void onManualStatus(node, "available"); }}>
                        标记可用
                      </button>
                      <button disabled={manualActionNodeId === node.id} onClick={() => { void onManualStatus(node, "unavailable"); }}>
                        标记不可用
                      </button>
                      <button disabled={manualActionNodeId === node.id} onClick={() => { void onManualStatus(node, "untested"); }}>
                        恢复待检测
                      </button>
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

async function fetchNodePoolStatus(): Promise<NodePoolStatus> {
  const response = await fetch("/api/node-pool/status");
  if (!response.ok) {
    throw new Error("节点池状态读取失败");
  }
  return response.json();
}

async function fetchNodeList(): Promise<NodeListResponse> {
  const response = await fetch("/api/node-pool/nodes?limit=50");
  if (!response.ok) {
    throw new Error("节点列表读取失败");
  }
  return response.json();
}

async function clearNodePool(): Promise<{ ok: boolean; cleared: boolean; total: number; updatedAt: string }> {
  const response = await fetch("/api/node-pool/clear", {
    method: "POST"
  });

  if (!response.ok) {
    throw new Error("清空节点池失败");
  }

  return response.json();
}

async function updateManualNodeStatus(
  nodeId: string,
  status: "available" | "unavailable" | "untested",
  reason = ""
): Promise<{ ok: boolean; node: NodePoolItem }> {
  const response = await fetch(`/api/node-pool/nodes/${encodeURIComponent(nodeId)}/manual-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ status, reason })
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "手动状态更新失败");
  }

  return payload;
}

async function fetchXrayStatus(): Promise<XrayDetectionStatus> {
  const response = await fetch("/api/detection/xray/status");
  if (!response.ok) {
    throw new Error("Xray 检测状态读取失败");
  }
  return response.json();
}

async function fetchSubscriptionStatus(): Promise<SubscriptionStatus> {
  const response = await fetch("/api/subscription/status");
  if (!response.ok) {
    throw new Error("订阅状态读取失败");
  }
  return response.json();
}

async function rebuildSubscription(): Promise<SubscriptionStatus> {
  const response = await fetch("/api/subscription/rebuild", {
    method: "POST"
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "生成订阅失败");
  }

  return payload;
}

async function resetSubscriptionToken(): Promise<SubscriptionStatus> {
  const response = await fetch("/api/subscription/reset-token", {
    method: "POST"
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "重置安全订阅链接失败");
  }

  return payload;
}

async function renewSubscriptionExpiration(): Promise<SubscriptionStatus> {
  const response = await fetch("/api/subscription/renew-expiration", {
    method: "POST"
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "订阅续期失败，请检查服务状态");
  }

  return payload;
}

async function verifyClaimCode(code: string): Promise<ClaimVerifyResponse> {
  const response = await fetch("/api/claim/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ code })
  });
  const payload = (await response.json()) as ClaimVerifyResponse;
  return payload;
}

async function fetchPublishCheckStatus(): Promise<PublishCheckResponse> {
  const response = await fetch("/api/publish-check/status");
  if (!response.ok) {
    throw new Error("发布前检查读取失败");
  }
  return response.json();
}

async function preparePublish(): Promise<PublishPrepareResponse> {
  const response = await fetch("/api/publish-check/prepare", {
    method: "POST"
  });
  const payload = (await response.json()) as PublishPrepareResponse;

  if (!response.ok || !payload.ok) {
    throw new Error(payload.message || payload.error || "发布前准备失败，请检查服务状态");
  }

  return payload;
}

async function fetchDetectionHistory(): Promise<DetectionHistoryResponse> {
  const response = await fetch("/api/detection/history");
  if (!response.ok) {
    throw new Error("检测历史读取失败");
  }
  return response.json();
}

async function testUntestedNodes(limit: number) {
  const response = await fetch("/api/detection/xray/test-untested", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ limit })
  });
  const payload = await response.json();

  if (!response.ok || payload.ok === false) {
    throw new Error(payload.message || payload.error || "检测失败");
  }

  return payload;
}

function OverviewPage() {
  return (
    <>
      <InfoGrid
        items={[
          ["系统名称", "华哥自动节点订阅池"],
          ["当前版本", appVersion],
          ["自动模式", "未启用"],
          ["节点池总数", "0"],
          ["可用节点数", "0"],
          ["当前订阅输出", "0"],
          ["最近订阅刷新", "暂无"],
          ["GitHub 限流状态", "已接入状态展示"],
          ["内核状态", "未安装"]
        ]}
      />
      <SectionNote>当前版本已支持安全订阅链接、订阅缓存自动刷新和订阅二维码展示，但不做领取页或 Telegram Bot。</SectionNote>
    </>
  );
}

function CollectorPage() {
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [results, setResults] = useState<CollectorResult[]>([]);
  const [nodeStatus, setNodeStatus] = useState<NodePoolStatus | null>(null);
  const [parseHistory, setParseHistory] = useState<ParseHistoryItem[]>([]);
  const [manualText, setManualText] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [parsingGithub, setParsingGithub] = useState(false);
  const [importingText, setImportingText] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const latestParse = parseHistory[0] || null;

  const loadCollectorData = useCallback(async () => {
    const [statusResponse, resultsResponse, nodePoolStatus, historyResponse] = await Promise.all([
      fetch("/api/collector/status"),
      fetch("/api/collector/results"),
      fetchNodePoolStatus(),
      fetch("/api/node-pool/parse-history")
    ]);

    if (!statusResponse.ok || !resultsResponse.ok || !historyResponse.ok) {
      throw new Error("采集状态读取失败");
    }

    const statusData = (await statusResponse.json()) as CollectorStatus;
    const resultsData = (await resultsResponse.json()) as CollectorResultsResponse;
    const historyData = (await historyResponse.json()) as ParseHistoryResponse;
    setStatus(statusData);
    setResults(resultsData.results || []);
    setNodeStatus(nodePoolStatus);
    setParseHistory(historyData.items || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadCollectorData()
      .catch((error: Error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, [loadCollectorData]);

  async function handleSearchOnce() {
    setSearching(true);
    setMessage(null);

    try {
      const response = await fetch("/api/collector/github/search-once", {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "GitHub 线索搜索失败");
      }

      setMessage(`搜索完成：请求 ${payload.requestCount} 次，获得 ${payload.resultCount} 条摘要。`);
      await loadCollectorData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "GitHub 线索搜索失败");
      await loadCollectorData().catch(() => undefined);
    } finally {
      setSearching(false);
    }
  }

  async function handleParseGithubResults() {
    setParsingGithub(true);
    setMessage(null);

    try {
      const response = await fetch("/api/node-pool/parse-last-github-results", {
        method: "POST"
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "解析最近 GitHub 线索失败");
      }

      setMessage(`解析完成：发现 ${payload.found}，新增 ${payload.inserted}，重复 ${payload.duplicated}。`);
      await loadCollectorData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "解析最近 GitHub 线索失败");
    } finally {
      setParsingGithub(false);
    }
  }

  async function handleImportText() {
    setImportingText(true);
    setMessage(null);

    try {
      const response = await fetch("/api/node-pool/import-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          text: manualText,
          sourceName: "manual-test"
        })
      });
      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "手动文本解析失败");
      }

      setMessage(`手动解析完成：发现 ${payload.found}，新增 ${payload.inserted}，重复 ${payload.duplicated}。`);
      setManualText("");
      await loadCollectorData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "手动文本解析失败");
    } finally {
      setImportingText(false);
    }
  }

  if (loading && !status) {
    return <SectionNote>正在读取采集配置和节点池状态...</SectionNote>;
  }

  return (
    <>
      <h3 className="subheading">GitHub 采集状态</h3>
      <InfoGrid
        items={[
          ["是否启用", formatBool(Boolean(status?.enabled), "启用", "关闭")],
          ["是否配置 GitHub Token", formatBool(Boolean(status?.githubTokenConfigured), "已配置", "未配置")],
          ["是否正在运行", formatBool(Boolean(status?.running), "运行中", "未运行")],
          ["是否触发限流", formatBool(Boolean(status?.rateLimited), "已触发", "未触发")],
          ["最近一次运行时间", formatDate(status?.lastRunAt || null)],
          ["最近错误", status?.lastError || status?.rateLimitReason || "暂无"]
        ]}
      />

      <h3 className="subheading">关键词配置</h3>
      <InfoGrid
        items={[
          ["关键词总数", String(status?.keywordCount ?? 0)],
          ["当前关键词来源", "config/search_keywords.json"],
          ["本轮请求次数", String(status?.requestCountThisRun ?? 0)],
          ["最近线索数量", String(status?.lastResultCount ?? results.length)]
        ]}
      />

      <h3 className="subheading">限速配置</h3>
      <InfoGrid
        items={[
          ["请求间隔", `${status?.requestIntervalSeconds ?? 0} 秒`],
          ["每分钟最大请求数", String(status?.maxRequestsPerMinute ?? 0)],
          ["每小时最大请求数", String(status?.maxRequestsPerHour ?? 0)],
          ["403 退避时间", `${status?.backoffOn403Minutes ?? 0} 分钟`],
          ["429 退避时间", `${status?.backoffOn429Minutes ?? 0} 分钟`]
        ]}
      />

      <div className="action-row collector-actions">
        <button disabled={searching || Boolean(status?.running)} onClick={handleSearchOnce}>
          {searching || status?.running ? "正在搜索..." : "手动搜索一次 GitHub 线索"}
        </button>
      </div>

      {message ? <div className="inline-message">{message}</div> : null}

      <h3 className="subheading">搜索结果摘要</h3>
      <div className="table-panel search-results-table">
        <table>
          <thead>
            <tr>
              <th>关键词</th>
              <th>仓库</th>
              <th>文件路径</th>
              <th>链接</th>
              <th>获取时间</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td colSpan={5}>暂无搜索结果摘要</td>
              </tr>
            ) : (
              results.map((item) => (
                <tr key={`${item.keyword}-${item.repository}-${item.path}-${item.url}`}>
                  <td className="compact-cell">{item.keyword}</td>
                  <td className="wrap-cell">{item.repository}</td>
                  <td className="wrap-cell">{item.path}</td>
                  <td className="link-cell">
                    <a className="link-button" href={item.url} target="_blank" rel="noreferrer">
                      打开
                    </a>
                  </td>
                  <td className="time-cell">{formatDate(item.fetchedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="subheading">节点解析</h3>
      <InfoGrid
        items={[
          ["最近 GitHub 线索数量", String(results.length)],
          ["节点池总数", String(nodeStatus?.total ?? 0)],
          ["待检测节点数", String(nodeStatus?.untested ?? 0)],
          ["最近一次解析时间", formatDate(latestParse?.ranAt || null)],
          [
            "最近一次解析结果",
            latestParse ? `发现 ${latestParse.found} / 新增 ${latestParse.inserted} / 重复 ${latestParse.duplicated}` : "暂无"
          ]
        ]}
      />
      <div className="action-row collector-actions">
        <button disabled={parsingGithub} onClick={handleParseGithubResults}>
          {parsingGithub ? "正在解析..." : "解析最近 GitHub 线索"}
        </button>
      </div>

      <div className="import-box">
        <label htmlFor="manual-node-text">手动导入文本解析</label>
        <textarea
          id="manual-node-text"
          placeholder="粘贴包含 vmess://、vless://、trojan://、ss://、ssr:// 的文本或 base64 订阅文本"
          value={manualText}
          onChange={(event) => setManualText(event.target.value)}
        />
        <button disabled={importingText || manualText.trim().length === 0} onClick={handleImportText}>
          {importingText ? "正在导入..." : "解析手动文本"}
        </button>
      </div>

      <SectionNote>当前版本只负责解析节点并放入节点池，不检测可用性，不生成订阅。</SectionNote>
    </>
  );
}

function DetectionPage() {
  const [status, setStatus] = useState<NodePoolStatus | null>(null);
  const [xrayStatus, setXrayStatus] = useState<XrayDetectionStatus | null>(null);
  const [history, setHistory] = useState<DetectionHistoryItem[]>([]);
  const [nodes, setNodes] = useState<NodePoolItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [testingLimit, setTestingLimit] = useState<number | null>(null);

  const loadDetectionData = useCallback(async () => {
    const [nodeStatus, xrayData, historyData, nodeData] = await Promise.all([
      fetchNodePoolStatus(),
      fetchXrayStatus(),
      fetchDetectionHistory(),
      fetchNodeList()
    ]);
    setStatus(nodeStatus);
    setXrayStatus(xrayData);
    setHistory(historyData.items || []);
    setNodes(nodeData.items || []);
  }, []);

  useEffect(() => {
    loadDetectionData().catch((error: Error) => setMessage(error.message));
  }, [loadDetectionData]);

  async function handleTestUntested(limit: number) {
    setTestingLimit(limit);
    setMessage(null);

    try {
      const payload = await testUntestedNodes(limit);
      setMessage(`检测完成：检测 ${payload.tested} 条，可用 ${payload.available}，不可用 ${payload.unavailable}，暂不支持 ${payload.unsupported}，错误 ${payload.error}。`);
      await loadDetectionData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "检测失败");
      await loadDetectionData().catch(() => undefined);
    } finally {
      setTestingLimit(null);
    }
  }

  const detectionDisabled = Boolean(testingLimit || xrayStatus?.running || !xrayStatus?.xrayInstalled);

  return (
    <>
      <h3 className="subheading">Xray-core 状态</h3>
      <InfoGrid
        items={[
          ["是否已安装", formatBool(Boolean(xrayStatus?.xrayInstalled), "已安装", "未安装")],
          ["Xray 路径", xrayStatus?.xrayBinaryPath || "/app/cores/xray/xray"],
          ["是否正在检测", formatBool(Boolean(xrayStatus?.running), "检测中", "未运行")],
          ["当前队列数量", String(xrayStatus?.queueSize ?? 0)],
          ["最近检测时间", formatDate(xrayStatus?.lastRunAt || null)],
          ["最近错误", xrayStatus?.lastError || xrayStatus?.message || "暂无"],
          ["检测超时", `${xrayStatus?.timeoutSeconds ?? 10} 秒`],
          ["最大并发", String(xrayStatus?.maxConcurrent ?? 1)]
        ]}
      />

      <h3 className="subheading">节点检测统计</h3>
      <InfoGrid
        items={[
          ["待检测节点数", String(status?.untested ?? 0)],
          ["检测中节点数", String(status?.testing ?? xrayStatus?.testingCount ?? 0)],
          ["可用节点数", String(status?.available ?? 0)],
          ["不可用节点数", String(status?.unavailable ?? 0)],
          ["暂不支持节点数", String(status?.unsupported ?? 0)],
          ["错误节点数", String(status?.error ?? 0)]
        ]}
      />

      <div className="action-row collector-actions">
        <button disabled={detectionDisabled} onClick={() => handleTestUntested(1)}>
          {testingLimit === 1 ? "正在检测..." : "检测 1 条待检测节点"}
        </button>
        <button disabled={detectionDisabled} onClick={() => handleTestUntested(5)}>
          {testingLimit === 5 ? "正在检测..." : "检测 5 条待检测节点"}
        </button>
        <button disabled={Boolean(testingLimit)} onClick={() => loadDetectionData()}>
          刷新检测状态
        </button>
      </div>

      {message ? <div className="inline-message">{message}</div> : null}
      {(status?.unsupported ?? 0) > 0 ? (
        <div className="inline-message">
          当前节点参数暂不支持，可等待后续版本增强兼容性。请在统计数据的最近节点列表查看 failureReason。
        </div>
      ) : null}

      <h3 className="subheading">检测 debug 摘要</h3>
      <InfoGrid
        items={[
          ["代理类型", xrayStatus?.proxyType || "socks"],
          ["SOCKS 地址", "127.0.0.1:随机端口"],
          ["检测核心", "xray"],
          ["检测目标", xrayStatus?.testUrl || "https://www.gstatic.com/generate_204"]
        ]}
      />

      <h3 className="subheading">最近检测历史</h3>
      <div className="table-panel">
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>检测数量</th>
              <th>可用</th>
              <th>不可用</th>
              <th>暂不支持</th>
              <th>错误</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无检测历史</td>
              </tr>
            ) : (
              history.map((item) => (
                <tr key={`${item.runAt}-${item.tested}`}>
                  <td>{formatDate(item.runAt)}</td>
                  <td>{item.tested}</td>
                  <td>{item.available}</td>
                  <td>{item.unavailable}</td>
                  <td>{item.unsupported}</td>
                  <td>{item.error}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <h3 className="subheading">最近节点检测结果</h3>
      <NodeListTable nodes={nodes} />
      <SectionNote>当前版本只支持 Xray-core 基础检测，不支持 sing-box / Mihomo，不生成订阅。</SectionNote>
    </>
  );
}

function SubscriptionPage() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [resettingToken, setResettingToken] = useState(false);
  const [renewingExpiration, setRenewingExpiration] = useState(false);
  const qrPanelRef = useRef<HTMLDivElement | null>(null);

  const qrUnavailableReason = getQrUnavailableReason(status);
  const qrContent = getPublicSubscriptionUrl(status);

  const autoRefreshResult =
    status?.lastAutoRefreshOk === null || status?.lastAutoRefreshOk === undefined
      ? "暂无"
      : status.lastAutoRefreshOk
        ? "成功"
        : "失败";

  const loadSubscriptionStatus = useCallback(async () => {
    try {
      setStatus(await fetchSubscriptionStatus());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订阅状态读取失败");
    }
  }, []);

  useEffect(() => {
    void loadSubscriptionStatus();
  }, [loadSubscriptionStatus]);

  async function handleRebuildSubscription() {
    setRebuilding(true);
    setMessage(null);

    try {
      const nextStatus = await rebuildSubscription();
      setStatus(nextStatus);
      setMessage("安全订阅已生成/刷新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "生成订阅失败");
    } finally {
      setRebuilding(false);
    }
  }

  async function handleCopySafeLink() {
    if (!status?.safeSubscriptionUrl) {
      setMessage("请先生成安全订阅链接");
      return;
    }

    if (!status.publicSubscriptionBaseUrl) {
      setMessage("请先配置公开订阅域名 SUBSCRIPTION_PUBLIC_BASE_URL");
      return;
    }

    const copied = await copyTextToClipboard(joinPublicSubscriptionUrl(status.publicSubscriptionBaseUrl, status.safeSubscriptionUrl));
    if (copied) {
      setMessage("已复制公开安全订阅链接");
      return;
    }

    setMessage("自动复制失败，请检查浏览器权限或使用 HTTPS 后重试");
  }

  async function handleResetSubscriptionToken() {
    const confirmed = window.confirm("重置后旧订阅链接将失效，确定继续吗？");
    if (!confirmed) {
      return;
    }

    setResettingToken(true);
    setMessage(null);

    try {
      const nextStatus = await resetSubscriptionToken();
      setStatus(nextStatus);
      setMessage("安全订阅链接已重置，请重新复制新链接");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重置安全订阅链接失败");
    } finally {
      setResettingToken(false);
    }
  }

  async function handleRenewExpiration() {
    const confirmed = window.confirm("续期后订阅有效期将从现在开始重新计算，确定继续吗？");
    if (!confirmed) {
      return;
    }

    setRenewingExpiration(true);
    setMessage(null);

    try {
      const nextStatus = await renewSubscriptionExpiration();
      setStatus(nextStatus);
      setMessage("订阅有效期已续期");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "订阅续期失败，请检查服务状态");
    } finally {
      setRenewingExpiration(false);
    }
  }

  function handleDownloadQrCode() {
    if (!qrContent) {
      setMessage(qrUnavailableReason || "二维码暂不可用");
      return;
    }

    const canvas = qrPanelRef.current?.querySelector("canvas");
    if (!canvas) {
      setMessage("二维码下载失败，请检查订阅状态");
      return;
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "huage-secure-subscription-qr.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setMessage("二维码已下载");
  }

  return (
    <>
      <InfoGrid
        items={[
          ["安全订阅", status?.generated ? "已生成" : "未生成"],
          ["公开订阅域名", formatBool(Boolean(status?.publicBaseUrlConfigured), "已配置", "未配置")],
          ["订阅有效期", formatSubscriptionExpiration(status)],
          ["到期时间", formatDate(status?.expiresAt || null)],
          ["剩余时间", formatRemainingTime(status)],
          ["有效期天数", String(status?.validityDays ?? 15)],
          ["最近续期时间", formatDate(status?.expirationUpdatedAt || null)],
          ["当前订阅节点数", String(status?.nodeCount ?? 0)],
          ["目标节点数", String(status?.targetNodeCount ?? 20)],
          ["最低保底节点数", String(status?.minNodeCount ?? 10)],
          ["最后生成时间", formatDate(status?.lastGeneratedAt || null)],
          ["当前状态", status?.generated ? "已生成" : "未生成"],
          ["风险提示", status?.warning || "暂无"],
          ["自动刷新", formatBool(Boolean(status?.autoRefreshEnabled), "已开启", "未开启")],
          ["刷新间隔", `${status?.refreshIntervalMinutes ?? 5} 分钟`],
          ["上次自动刷新时间", formatDate(status?.lastAutoRefreshAt || null)],
          ["下次自动刷新时间", formatDate(status?.nextAutoRefreshAt || null)],
          ["最近自动刷新结果", autoRefreshResult],
          ["自动刷新 warning", status?.lastAutoRefreshWarning || "暂无"],
          ["自动刷新错误", status?.lastAutoRefreshError || "暂无"]
        ]}
      />
      <div className="action-row">
        <button disabled={rebuilding} onClick={handleRebuildSubscription}>
          {rebuilding ? "正在生成..." : "生成/刷新安全订阅"}
        </button>
        <button onClick={handleCopySafeLink}>
          复制安全订阅链接
        </button>
        <button disabled={!qrContent} onClick={handleDownloadQrCode}>
          下载二维码
        </button>
        <button disabled={resettingToken} onClick={handleResetSubscriptionToken}>
          {resettingToken ? "正在重置..." : "重置安全订阅链接"}
        </button>
        <button disabled={renewingExpiration} onClick={handleRenewExpiration}>
          {renewingExpiration ? "正在续期..." : "续期订阅有效期"}
        </button>
      </div>
      {message ? <div className="inline-message">{message}</div> : null}
      <section className="qr-panel">
        <h3 className="subheading">订阅二维码</h3>
        {qrContent ? (
          <div className="qr-status-card">
            <strong>订阅二维码：已生成</strong>
            <span>二维码已准备好，点击按钮可下载二维码图片；页面不会直接展示二维码内容。</span>
            <div className="qr-hidden-canvas" ref={qrPanelRef} aria-hidden="true">
              <QRCodeCanvas value={qrContent} size={220} level="M" includeMargin />
            </div>
          </div>
        ) : (
          <div className="qr-status-card unavailable">
            <strong>订阅二维码：不可用</strong>
            <span>{qrUnavailableReason}</span>
          </div>
        )}
      </section>
      <SectionNote>当前版本只生成一个安全订阅链接，订阅内容由后台缓存输出，并按配置自动刷新缓存。</SectionNote>
    </>
  );
}

function CoresPage() {
  const rows = ["Mihomo", "sing-box", "Xray-core"];

  return (
    <>
      <div className="table-panel">
        <table>
          <thead>
            <tr>
              <th>内核</th>
              <th>版本选择</th>
              <th>操作</th>
              <th>当前版本</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((name) => (
              <tr key={name}>
                <td>{name}</td>
                <td>
                  <select onChange={notifyPlaceholder} defaultValue="">
                    <option value="">选择版本，占位下拉框</option>
                  </select>
                </td>
                <td>
                  <button onClick={notifyPlaceholder}>安装/更新，占位按钮</button>
                </td>
                <td>未安装</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <SectionNote>内核仅用于节点可用性检测，不作为公开代理服务运行。第一阶段只支持 Linux amd64。</SectionNote>
    </>
  );
}

function StatsPage() {
  const [status, setStatus] = useState<NodePoolStatus | null>(null);
  const [nodes, setNodes] = useState<NodePoolItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [manualActionNodeId, setManualActionNodeId] = useState<string | null>(null);

  const loadStatsData = useCallback(async () => {
    await Promise.all([fetchNodePoolStatus(), fetchNodeList()])
      .then(([statusData, nodeData]) => {
        setStatus(statusData);
        setNodes(nodeData.items || []);
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadStatsData();
  }, [loadStatsData]);

  async function handleClearNodePool() {
    const confirmed = window.confirm("确认要清空当前节点池吗？此操作会删除本地节点池中的测试节点，但不会删除配置文件。");

    if (!confirmed) {
      return;
    }

    setClearing(true);
    setMessage(null);

    try {
      await clearNodePool();
      await loadStatsData();
      setMessage("节点池已清空。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "清空节点池失败");
    } finally {
      setClearing(false);
    }
  }

  async function handleManualStatus(node: NodePoolItem, nextStatus: "available" | "unavailable" | "untested") {
    const actionText = nextStatus === "available" ? "标记为可用" : nextStatus === "unavailable" ? "标记为不可用" : "恢复为待检测";
    const confirmed = window.confirm(`确认要将该节点${actionText}吗？`);

    if (!confirmed) {
      return;
    }

    const reason =
      nextStatus === "untested"
        ? ""
        : window.prompt("请输入手动校正原因，可留空。", nextStatus === "available" ? "客户端实测可用" : "手动确认不可用") || "";

    setManualActionNodeId(node.id);
    setMessage(null);

    try {
      await updateManualNodeStatus(node.id, nextStatus, reason);
      await loadStatsData();
      setMessage(`节点已${actionText}。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "手动状态更新失败");
    } finally {
      setManualActionNodeId(null);
    }
  }

  return (
    <>
      <div className="section-heading-row">
        <h3 className="subheading">节点池统计</h3>
        <button className="danger-button" disabled={clearing} onClick={handleClearNodePool}>
          {clearing ? "正在清空..." : "清空节点池"}
        </button>
      </div>
      <InfoGrid
        items={[
          ["节点池总数", String(status?.total ?? 0)],
          ["待检测节点数", String(status?.untested ?? 0)],
          ["检测中节点数", String(status?.testing ?? 0)],
          ["可用节点数", String(status?.available ?? 0)],
          ["不可用节点数", String(status?.unavailable ?? 0)],
          ["自动检测可用", String(status?.autoAvailable ?? 0)],
          ["自动检测不可用", String(status?.autoUnavailable ?? 0)],
          ["手动确认可用", String(status?.manualAvailable ?? 0)],
          ["手动确认不可用", String(status?.manualUnavailable ?? 0)],
          ["暂不支持节点数", String(status?.unsupported ?? 0)],
          ["错误节点数", String(status?.error ?? 0)],
          ["按协议统计", formatStats(status?.protocolStats)],
          ["按来源统计", formatStats(status?.sourceStats)],
          ["地区统计", formatStats(status?.regionStats)],
          ["最近更新时间", formatDate(status?.lastUpdatedAt || null)]
        ]}
      />
      {message ? <div className="inline-message">{message}</div> : null}

      <h3 className="subheading">最近节点列表</h3>
      <NodeListTable nodes={nodes} onManualStatus={handleManualStatus} manualActionNodeId={manualActionNodeId} />
      <SectionNote>自动检测可能误判，手动确认可用的节点后续也可进入订阅池。统计数据来自本地 JSON 节点池，页面只展示脱敏节点，不展示 raw 节点。</SectionNote>
    </>
  );
}

function SettingsPage() {
  const [publishCheck, setPublishCheck] = useState<PublishCheckResponse | null>(null);
  const [loadingPublishCheck, setLoadingPublishCheck] = useState(true);
  const [publishCheckError, setPublishCheckError] = useState<string | null>(null);
  const [preparingPublish, setPreparingPublish] = useState(false);
  const [publishPrepareMessage, setPublishPrepareMessage] = useState<string | null>(null);

  const loadPublishCheck = useCallback(async () => {
    setLoadingPublishCheck(true);
    setPublishCheckError(null);

    try {
      const result = await fetchPublishCheckStatus();
      setPublishCheck(result);
    } catch (error) {
      setPublishCheckError(error instanceof Error ? error.message : "发布前检查读取失败");
    } finally {
      setLoadingPublishCheck(false);
    }
  }, []);

  useEffect(() => {
    void loadPublishCheck();
  }, [loadPublishCheck]);

  async function handlePreparePublish() {
    const confirmed = window.confirm("执行后会重置安全订阅链接并续期，旧订阅链接将失效。确认继续吗？");
    if (!confirmed) {
      return;
    }

    setPreparingPublish(true);
    setPublishPrepareMessage(null);
    setPublishCheckError(null);

    try {
      await preparePublish();
      setPublishPrepareMessage("发布前准备已完成，安全订阅链接已重置并续期。");
      await loadPublishCheck();
    } catch (error) {
      setPublishPrepareMessage(error instanceof Error ? error.message : "发布前准备失败，请检查服务状态");
    } finally {
      setPreparingPublish(false);
    }
  }

  return (
    <>
      <InfoGrid
        items={[
          ["全自动模式", "关闭，占位"],
          ["GitHub Token", "未配置，占位，不显示真实值"],
          ["GitHub 搜索间隔", "10 秒"],
          ["每分钟最大搜索请求", "6"],
          ["每小时最大搜索请求", "300"],
          ["节点池存储", "JSON 文件"],
          ["节点默认状态", "untested"],
          ["节点默认地区", "未知"],
          ["订阅刷新间隔", "5 分钟"],
          ["首选检测内核", "Xray-core"]
        ]}
      />
      <div className="action-row">
        <button onClick={notifyPlaceholder}>保存设置，占位按钮</button>
      </div>
      <SectionNote>本页面当前只展示默认配置，保存功能后续实现。</SectionNote>

      <section className="publish-check-panel">
        <div className="section-heading-row">
          <h3 className="subheading">发布前检查</h3>
          <div className="action-row compact">
            <button disabled={preparingPublish} onClick={handlePreparePublish}>
              {preparingPublish ? "正在准备..." : "执行发布前准备"}
            </button>
            <button disabled={loadingPublishCheck || preparingPublish} onClick={() => void loadPublishCheck()}>
              {loadingPublishCheck ? "正在检查..." : "刷新检查"}
            </button>
          </div>
        </div>

        <p className="publish-prepare-note">点击后会重置安全订阅链接并续期，旧订阅链接将立即失效。执行完成后需要重新下载二维码。</p>

        <div className={`publish-summary ${publishCheck?.level || "warning"}`}>
          <strong>{formatPublishCheckSummary(publishCheck)}</strong>
          <span>{publishCheck?.summary || "正在检查订阅、口令、公开入口和后台 API 暴露状态。"}</span>
        </div>

        {publishPrepareMessage ? <div className="inline-message">{publishPrepareMessage}</div> : null}
        {publishCheckError ? <div className="inline-message">{publishCheckError}</div> : null}

        <div className="table-panel publish-check-table">
          <table>
            <thead>
              <tr>
                <th>检查项</th>
                <th>状态</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {(publishCheck?.checks || []).map((item) => (
                <tr key={item.key}>
                  <td>{item.label}</td>
                  <td>
                    <span className={`check-badge ${item.status}`}>{formatPublishCheckStatus(item.status)}</span>
                  </td>
                  <td>
                    <span>{item.message}</span>
                    {item.detail ? <small className="check-detail">{item.detail}</small> : null}
                  </td>
                </tr>
              ))}
              {!publishCheck?.checks.length ? (
                <tr>
                  <td colSpan={3}>{loadingPublishCheck ? "正在读取检查结果..." : "暂无检查结果"}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="section-note">
          <strong>固定提醒：</strong>
          <ul className="reminder-list">
            {(publishCheck?.reminders || [
              "正式发布前建议最后重置一次安全订阅 token",
              "确认视频口令已经改成本期口令",
              "执行发布前准备后，需要重新下载二维码",
              "公开域名仍不能开放全部 /api/*"
            ]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function ClaimPage() {
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"success" | "error">("success");
  const [claimSubscriptionUrl, setClaimSubscriptionUrl] = useState<string | null>(null);

  async function handleVerifyClaim() {
    setVerifying(true);
    setVerified(false);
    setClaimSubscriptionUrl(null);
    setMessage(null);

    try {
      const result = await verifyClaimCode(code);
      if (!result.ok || !result.claimAllowed || !result.subscriptionReady || !result.copyableSubscriptionUrl) {
        setMessageTone("error");
        const retryText = result.retryAfterSeconds ? ` ${formatRetryAfter(result.retryAfterSeconds)}` : "";
        const remainingText =
          typeof result.remainingAttempts === "number" ? ` 还可尝试 ${result.remainingAttempts} 次。` : "";
        setMessage(`${result.message || "口令验证失败，请稍后再试。"}${remainingText}${retryText}`);
        return;
      }

      setVerified(true);
      setClaimSubscriptionUrl(result.copyableSubscriptionUrl);
      setMessageTone("success");
      setMessage("口令验证成功，请复制订阅链接。");
    } catch {
      setMessageTone("error");
      setMessage("口令验证失败，请稍后再试。");
    } finally {
      setVerifying(false);
    }
  }

  async function handleCopyClaimSubscription() {
    if (!claimSubscriptionUrl) {
      setMessageTone("error");
      setMessage("请先验证领取口令。");
      return;
    }

    setCopying(true);
    setMessage(null);

    try {
      const copied = await copyTextToClipboard(claimSubscriptionUrl);
      setMessageTone(copied ? "success" : "error");
      setMessage(copied ? "已复制订阅链接" : "自动复制失败，请手动检查浏览器权限或使用 HTTPS 访问。");
    } catch {
      setMessageTone("error");
      setMessage("复制订阅链接失败，请稍后再试。");
    } finally {
      setCopying(false);
    }
  }

  return (
    <div className="claim-page">
      <main className="claim-card">
        <div className="claim-brand">华哥自动节点订阅池</div>
        <h1>华哥免费节点订阅领取</h1>
        <p className="claim-description">请输入视频中公布的领取口令，验证后复制订阅链接。</p>

        <label className="claim-form-label" htmlFor="claim-code">
          领取口令
        </label>
        <input
          autoComplete="off"
          id="claim-code"
          onChange={(event) => setCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && code.trim() && !verifying) {
              void handleVerifyClaim();
            }
          }}
          placeholder="请输入领取口令"
          type="text"
          value={code}
        />

        <div className="claim-actions">
          <button disabled={!code.trim() || verifying} onClick={handleVerifyClaim}>
            {verifying ? "正在验证..." : "验证并领取"}
          </button>
          {verified ? (
            <button disabled={copying || !claimSubscriptionUrl} onClick={handleCopyClaimSubscription}>
              {copying ? "正在复制..." : "复制订阅链接"}
            </button>
          ) : null}
        </div>

        {message ? <div className={messageTone === "success" ? "claim-message success" : "claim-message"}>{message}</div> : null}
        <p className="claim-footer">本订阅为免费分享，节点可用性会随时间变化，请以实际连接为准。</p>
      </main>
    </div>
  );
}

function AdminApp() {
  const [activeKey, setActiveKey] = useState<MenuKey>("overview");

  const activeMenu = useMemo(
    () => menus.find((item) => item.key === activeKey) || menus[0],
    [activeKey]
  );

  const page = {
    overview: <OverviewPage />,
    collector: <CollectorPage />,
    detection: <DetectionPage />,
    subscription: <SubscriptionPage />,
    cores: <CoresPage />,
    stats: <StatsPage />,
    settings: <SettingsPage />
  }[activeKey];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-title">华哥自动节点订阅池</span>
          <span className="brand-version">{appVersion}</span>
        </div>
        <nav>
          {menus.map((item) => (
            <button
              className={item.key === activeKey ? "nav-item active" : "nav-item"}
              key={item.key}
              onClick={() => setActiveKey(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <h1>华哥自动节点订阅池 {appVersion}</h1>
            <p>当前页面：{activeMenu.label}</p>
          </div>
          <span className="status-pill">节点池基础版</span>
        </header>

        <section className="content-section">
          <h2>{activeMenu.label}</h2>
          {page}
        </section>
      </main>
    </div>
  );
}

function App() {
  if (window.location.pathname === "/claim") {
    return <ClaimPage />;
  }

  return <AdminApp />;
}

export default App;
