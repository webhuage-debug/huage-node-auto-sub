import { useCallback, useEffect, useMemo, useState } from "react";

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
};

const appVersion = "v0.5.0";

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
      <SectionNote>当前版本已支持 Xray-core 基础可用性检测，但不自动下载内核，不生成订阅。</SectionNote>
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

  const safeUrl = status?.safeSubscriptionUrl ? `${window.location.origin}${status.safeSubscriptionUrl}` : "未生成";

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
      setMessage("请先生成安全订阅链接。");
      return;
    }

    try {
      await navigator.clipboard.writeText(safeUrl);
      setMessage("安全订阅链接已复制。");
    } catch {
      setMessage("当前浏览器不支持自动复制，请手动复制链接。");
    }
  }

  return (
    <>
      <InfoGrid
        items={[
          ["安全订阅链接", safeUrl],
          ["当前订阅节点数", String(status?.nodeCount ?? 0)],
          ["目标节点数", String(status?.targetNodeCount ?? 20)],
          ["最低保底节点数", String(status?.minNodeCount ?? 10)],
          ["最后生成时间", formatDate(status?.lastGeneratedAt || null)],
          ["当前状态", status?.generated ? "已生成" : "未生成"],
          ["风险提示", status?.warning || "暂无"]
        ]}
      />
      <div className="action-row">
        <button disabled={rebuilding} onClick={handleRebuildSubscription}>
          {rebuilding ? "正在生成..." : "生成/刷新安全订阅"}
        </button>
        <button disabled={!status?.safeSubscriptionUrl} onClick={handleCopySafeLink}>
          复制安全订阅链接
        </button>
      </div>
      {message ? <div className="inline-message">{message}</div> : null}
      <InfoGrid
        items={[
          ["二维码", "后续版本支持"]
        ]}
      />
      <SectionNote>当前版本只生成一个安全订阅链接，订阅内容由后台缓存输出。</SectionNote>
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
    </>
  );
}

function App() {
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

export default App;
