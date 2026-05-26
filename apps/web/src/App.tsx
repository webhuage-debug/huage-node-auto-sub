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
  mode: string;
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

function OverviewPage() {
  return (
    <>
      <InfoGrid
        items={[
          ["系统名称", "华哥自动节点订阅池"],
          ["当前版本", "v0.1.0-skeleton"],
          ["自动模式", "未启用"],
          ["节点池总数", "0"],
          ["可用节点数", "0"],
          ["当前订阅输出", "0"],
          ["最近订阅刷新", "暂无"],
          ["GitHub 限流状态", "未接入"],
          ["内核状态", "未安装"]
        ]}
      />
      <SectionNote>当前版本仅为项目框架，业务功能将在后续版本逐步实现。</SectionNote>
    </>
  );
}

function CollectorPage() {
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [results, setResults] = useState<CollectorResult[]>([]);
  const [lastResultCount, setLastResultCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadCollectorData = useCallback(async () => {
    const [statusResponse, resultsResponse] = await Promise.all([
      fetch("/api/collector/status"),
      fetch("/api/collector/results")
    ]);

    if (!statusResponse.ok || !resultsResponse.ok) {
      throw new Error("采集状态读取失败");
    }

    const statusData = (await statusResponse.json()) as CollectorStatus;
    const resultsData = (await resultsResponse.json()) as CollectorResultsResponse;
    setStatus(statusData);
    setResults(resultsData.results || []);
    setLastResultCount(resultsData.resultCount || 0);
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

  if (loading && !status) {
    return <SectionNote>正在读取采集配置和状态...</SectionNote>;
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
          ["最近结果数量", String(status?.lastResultCount ?? lastResultCount)]
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
      <div className="table-panel">
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
                  <td>{item.keyword}</td>
                  <td>{item.repository}</td>
                  <td>{item.path}</td>
                  <td>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      查看
                    </a>
                  </td>
                  <td>{formatDate(item.fetchedAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SectionNote>当前版本只搜索 GitHub 线索，不解析节点、不检测节点、不生成订阅。</SectionNote>
    </>
  );
}

function DetectionPage() {
  return (
    <>
      <InfoGrid
        items={[
          ["待检测", "0"],
          ["检测中", "0"],
          ["可用", "0"],
          ["不可用", "0"],
          ["当前检测内核", "未选择"],
          ["最近检测时间", "暂无"]
        ]}
      />
      <SectionNote>节点检测将在后续版本实现，第一目标是判断可用 / 不可用，不纠结延迟。</SectionNote>
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
      <SectionNote>本软件只负责维护订阅，不负责外部分发。</SectionNote>
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
  return (
    <>
      <InfoGrid
        items={[
          ["节点池总数", "0"],
          ["可用节点数", "0"],
          ["不可用节点数", "0"],
          ["今日新增节点", "0"],
          ["今日检测通过", "0"],
          ["最近 5 分钟替换数量", "0"],
          ["按地区统计", "暂无数据"],
          ["按协议统计", "暂无数据"],
          ["按来源统计", "暂无数据"],
          ["GitHub 请求次数", "0"],
          ["GitHub 剩余额度", "未接入"],
          ["订阅访问次数", "0"],
          ["Bot 接口读取次数", "0"]
        ]}
      />
      <SectionNote>统计数据以节点池质量为核心，不统计外部分发数据。</SectionNote>
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
          ["订阅刷新间隔", "5 分钟"],
          ["订阅有效期", "15 天"],
          ["目标订阅节点数", "20"],
          ["最低订阅节点数", "10"],
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
          <span className="brand-version">v0.1.0-skeleton</span>
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
            <h1>华哥自动节点订阅池 v0.1.0-skeleton</h1>
            <p>当前页面：{activeMenu.label}</p>
          </div>
          <span className="status-pill">框架版本</span>
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
