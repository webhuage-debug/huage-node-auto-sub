# 10 数据库设计

## 文档目的

预留后续节点池、采集记录和检测记录的数据模型说明。

## 当前版本范围

v0.3.0 不使用数据库，暂用本地 JSON 文件存储节点池。

- 默认数据目录：`data/`
- 默认节点池文件：`data/node_pool.json`
- `data/` 不提交 Git。
- 节点池只保存必要字段，不保存日志、Token、密码。
- 接口返回脱敏节点，不返回完整 raw 节点。

v0.3.1 清空节点池只重置 `data/node_pool.json` 的 `nodes` 数组，并更新 `updatedAt`，不删除 `data/` 目录，也不删除节点池文件本身。

v0.4.0 检测字段仍写入 JSON 节点池，暂不迁移数据库。新增字段包括 `lastTestedAt`、`detectionCore`、`responseMs`、`failureReason`、`testCount`、`successCount`、`failCount`。

v0.4.5 节点池继续使用 JSON 文件，新增人工校正字段：`manualOverride`、`manualStatus`、`manualReason`、`manualUpdatedAt`。手动标记不伪造自动检测计数，后续订阅生成可以把 `manualOverride=true` 且 `manualStatus=available` 的节点视为可用节点。

## 后续待补充内容

如后续节点池规模变大，再评估迁移 SQLite，并补充节点表、来源表、检测记录表、订阅访问记录和迁移方案。
