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

v0.3.1 验收项：

- `/api/status` 返回 `version=v0.3.1`。
- `POST /api/node-pool/clear` 可清空节点池。
- 清空后 `/api/node-pool/status` 返回 `total=0`。
- 清空后 `/api/node-pool/nodes` 返回空列表。
- `data/node_pool.json` 文件结构仍然有效，且不删除 `data/` 目录。
- 前端统计数据页面有“清空节点池”按钮。
- 清空按钮有二次确认。
- 采集管理页面搜索结果链接不再竖排显示。
- 前端和接口不展示完整 raw 节点。
- 不新增菜单，不做节点检测，不生成订阅。

v0.4.0 验收项：

- `/api/status` 返回 `version=v0.4.0`。
- `/api/detection/xray/status` 正常返回。
- Xray 未安装时接口返回明确 JSON，不崩溃。
- `POST /api/detection/xray/test-one` 可以处理单节点检测请求。
- `POST /api/detection/xray/test-untested` 可以处理批量检测请求。
- 检测中不允许重复并发触发。
- 检测结果会写回节点池状态和检测字段。
- 状态字段支持 `available`、`unavailable`、`unsupported`、`error`、`untested`。
- 前端检测管理页面显示 Xray 状态和检测按钮。
- 前端和接口不展示完整 raw 节点。
- 临时 Xray inbound 只监听 `127.0.0.1`。
- 检测结束会清理子进程和临时文件。
- 不生成订阅，不新增菜单，不提交 `cores/` 和 `data/`。

v0.4.2 验收项：

- `/api/status` 返回 `version=v0.4.2`。
- VLESS TLS / WS / Reality 常见参数可以生成 Xray outbound。
- Trojan TLS / WS / gRPC 常见参数可以生成 Xray outbound。
- Shadowsocks 常见 URL 可以生成 Xray outbound。
- VMess base64 JSON 常见格式可以生成 Xray outbound。
- 不支持参数返回 `unsupported`，不导致服务崩溃。
- 检测临时 inbound 只监听 `127.0.0.1`。
- 前端检测管理页面显示 unsupported 原因提示。
- 不提交 `cores/`、`data/`，不展示完整 raw 节点。

v0.4.3 验收项：

- `/api/status` 返回 `version=v0.4.3`。
- VLESS Reality outbound 中 user 包含 `encryption=none`，`flow` 放在 user 对象中。
- Reality 参数写入 `realitySettings`，不误写为 `tlsSettings`。
- SOCKS 检测请求确认走 `socks5://127.0.0.1:随机端口`。
- Xray inbound 仍只监听 `127.0.0.1`。
- 检测结束清理 Xray 子进程和临时配置文件。
- failureReason 能区分 SOCKS 请求失败、检测 URL 超时、TLS/Reality 握手失败、HTTP 状态异常。
- 前端检测管理页面显示安全 debug 摘要，不展示 raw 节点。
- 不生成订阅，不新增菜单，不提交 `cores/` 和 `data/`。

## 后续待补充内容

补充 Docker 启动检查、接口测试、页面截图检查和真实业务版本验收项。
