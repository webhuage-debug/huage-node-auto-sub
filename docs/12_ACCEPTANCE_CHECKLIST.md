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

## 后续待补充内容

补充 Docker 启动检查、接口测试、页面截图检查和真实业务版本验收项。
