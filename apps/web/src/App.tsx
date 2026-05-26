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
  available: number;
  unavailable: number;
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

const appVersion = "v0.3.1";

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

function formatStats(stats: Record<string, number> | undefined) {
  if (!stats || Object.keys(stats).length === 0) {
    return "暂无数据";
  }

  return Object.entries(stats)
    .map(([key, value]) => `${key}：${value}`)
    .join("，");
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

function NodeListTable({ nodes }: { nodes: NodePoolItem[] }) {
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
            <th>首次发现时间</th>
            <th>最近发现时间</th>
          </tr>
        </thead>
        <tbody>
          {nodes.length === 0 ? (
            <tr>
              <td colSpan={7}>暂无节点池数据</td>
            </tr>
          ) : (
            nodes.map((node) => (
              <tr key={node.id}>
                <td>{node.protocol}</td>
                <td className="masked-node">{node.masked}</td>
                <td>{node.sourceType}</td>
                <td>{node.sourceRepository || "-"}</td>
                <td>{node.status}</td>
                <td>{formatDate(node.firstSeenAt)}</td>
                <td>{formatDate(node.lastSeenAt)}</td>
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
      <SectionNote>当前版本已支持节点解析与本地 JSON 节点池，但不检测可用性，不生成订阅。</SectionNote>
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchNodePoolStatus()
      .then(setStatus)
      .catch((error: Error) => setMessage(error.message));
  }, []);

  return (
    <>
      <InfoGrid
        items={[
          ["待检测", String(status?.untested ?? 0)],
          ["检测中", "0"],
          ["可用", String(status?.available ?? 0)],
          ["不可用", String(status?.unavailable ?? 0)],
          ["当前检测内核", "未选择"],
          ["最近检测时间", "暂无"]
        ]}
      />
      {message ? <div className="inline-message">{message}</div> : null}
      <SectionNote>节点可用性检测将在 v0.4.0 实现，当前节点池默认状态为 untested。</SectionNote>
    </>
  );
}

function SubscriptionPage() {
  return (
    <>
      <InfoGrid
        items={[
          ["自动刷新间隔", "5 分钟"],
          ["目标订阅节点数", "20"],
          ["最低保底节点数", "10"],
          ["订阅有效期", "15 天"],
          ["raw 订阅链接", "未生成"],
          ["base64 订阅链接", "未生成"],
          ["领取页链接", "未生成"],
          ["Telegram Bot 只读接口", "未生成"],
          ["二维码", "未生成"]
        ]}
      />
      <div className="action-row">
        <button onClick={notifyPlaceholder}>复制 raw 链接，占位按钮</button>
        <button onClick={notifyPlaceholder}>复制 base64 链接，占位按钮</button>
        <button onClick={notifyPlaceholder}>复制二维码，占位按钮</button>
        <button onClick={notifyPlaceholder}>下载二维码，占位按钮</button>
        <button onClick={notifyPlaceholder}>手动刷新订阅，占位按钮</button>
      </div>
      <SectionNote>本软件只负责维护订阅，不负责外部分发。当前版本不生成订阅。</SectionNote>
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
          ["可用节点数", String(status?.available ?? 0)],
          ["不可用节点数", String(status?.unavailable ?? 0)],
          ["按协议统计", formatStats(status?.protocolStats)],
          ["按来源统计", formatStats(status?.sourceStats)],
          ["地区统计", formatStats(status?.regionStats)],
          ["最近更新时间", formatDate(status?.lastUpdatedAt || null)]
        ]}
      />
      {message ? <div className="inline-message">{message}</div> : null}

      <h3 className="subheading">最近节点列表</h3>
      <NodeListTable nodes={nodes} />
      <SectionNote>统计数据来自本地 JSON 节点池，页面只展示脱敏节点，不展示 raw 节点。</SectionNote>
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
