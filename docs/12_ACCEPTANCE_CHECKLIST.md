# 12 验收清单

## 文档目的

记录每个版本完成后的检查项。

## 当前版本范围

- 项目目录存在
- docs 目录包含 12 个文档
- config 目录包含 4 个配置文件
- apps/api 和 apps/web 存在
- 前端只有 7 个菜单
- 后端提供最小健康检查和配置预览接口

v0.2.0 验收项：

- `/api/collector/status` 可返回采集状态。
- `/api/collector/github/search-once` 可手动触发一轮有限搜索。
- `/api/collector/results` 可查看最近一次结果摘要。
- 后端读取 `config/search_keywords.json`。
- 后端读取 `config/collector_rules.json`。
- GitHub Token 不在接口返回或日志中暴露。
- 前端采集管理页面显示状态、限速、关键词数量和搜索结果摘要。
- 前端手动搜索按钮运行中禁用。
- 当前版本不解析节点、不检测节点、不生成订阅。

v0.3.0 验收项：

- `/api/status` 返回 `version=v0.3.0`。
- `/api/node-pool/status` 可返回节点池统计。
- `/api/node-pool/import-text` 可解析测试文本。
- `/api/node-pool/nodes` 只返回脱敏节点列表，不返回 raw。
- `/api/node-pool/parse-last-github-results` 可从最近 GitHub 搜索结果尝试解析节点。
- 重复节点不会重复插入，只更新 `seenCount` 和 `lastSeenAt`。
- 节点池默认 `status=untested`。
- 节点池默认 `region=未知`。
- 前端统计数据页面显示真实节点池统计。
- 前端采集管理页面有“解析最近 GitHub 线索”按钮。
- `data/` 不提交 Git。
- 当前版本不做节点可用性检测，不生成订阅。

## 后续待补充内容

补充 Docker 启动检查、接口测试、页面截图检查和真实业务版本验收项。
