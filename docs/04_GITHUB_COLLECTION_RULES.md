# 04 GitHub 采集规则

## 文档目的

定义后续 GitHub 公开节点采集的规则边界。

## 当前版本范围

当前版本接入 GitHub 公开搜索接口，只做线索搜索和摘要保存，不解析节点、不下载仓库文件、不写数据库。

采集规则：

- 关键词来自 `config/search_keywords.json`。
- 限速规则来自 `config/collector_rules.json`。
- 默认每轮最多搜索 3 个关键词，可通过 `GITHUB_SEARCH_MAX_KEYWORDS_PER_RUN` 调整。
- 每个关键词请求之间遵守 `request_interval_seconds`。
- 遇到 GitHub API 403 或 429 时记录限流原因，并停止本轮后续请求。
- 如果 GitHub 返回 `x-ratelimit-limit`、`x-ratelimit-remaining`、`x-ratelimit-reset`，状态接口可以展示摘要。
- `GITHUB_TOKEN` 只从环境变量读取，只用于 Authorization 请求头，不在接口返回、日志或错误信息中暴露。

## 后续待补充内容

补充搜索分页、限流退避、仓库冷却、结果缓存和重复来源处理。
