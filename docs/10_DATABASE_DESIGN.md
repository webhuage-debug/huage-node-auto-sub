# 10 数据库设计

## 文档目的

记录节点池、订阅缓存和后续数据存储方案的边界。

## 当前版本范围

当前版本仍不使用数据库，继续使用本地 JSON 文件：

- 节点池文件：`data/node_pool.json`
- 订阅缓存文件：`data/subscription.json`
- `data/` 不提交 Git。
- 后台接口不返回 raw 节点或完整订阅内容。

v0.3.0 节点池使用 JSON 文件保存节点基础字段。

v0.4.0 检测字段仍写入 JSON 节点池，包括 `lastTestedAt`、`detectionCore`、`responseMs`、`failureReason`、`testCount`、`successCount`、`failCount`。

v0.4.5 节点池新增人工校正字段：`manualOverride`、`manualStatus`、`manualReason`、`manualUpdatedAt`。

v0.5.0 新增运行时订阅缓存文件 `data/subscription.json`，保存 token、base64 订阅内容、节点数量、目标数量、最低保底数量、最后生成时间和 warning。

v0.7.0 订阅缓存增加活动级有效期字段：

- `expiresAt`：当前安全订阅的到期时间。
- `validityDays`：生成或续期时使用的有效期天数。
- `expirationUpdatedAt`：最近一次手动续期时间。

## 后续待补充内容

如果后续节点池规模变大，再评估迁移 SQLite，并补充节点表、来源表、检测记录表、订阅访问记录表和迁移方案。
