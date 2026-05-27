# 华哥自动节点订阅池

华哥自动节点订阅池是一个自用后台项目，不是 SaaS，不面向客户或粉丝开放登录。本项目目标是逐步实现公开节点采集、解析、可用性检测、节点池维护和订阅输出。

## 当前版本

当前版本为 `v0.4.4`，已经完成项目骨架、GitHub 线索搜索、节点解析、本地 JSON 节点池基础、节点池清理，以及 VLESS Reality 临时 Xray 配置细节修复。

`v0.2.0` 在骨架基础上增加 GitHub 公开线索采集链路：

- 读取关键词配置
- 读取采集限速规则
- 支持 GitHub Token 配置
- 手动触发 GitHub 搜索
- 采集状态展示
- 搜索结果摘要展示

`v0.2.0` 只搜索 GitHub 线索，不解析节点、不检测节点、不生成订阅。

`v0.3.0` 实现：

- 从 GitHub 搜索结果读取有限内容
- 解析 vmess/vless/trojan/ss/ssr 节点
- 节点去重
- 本地 JSON 节点池
- 节点池统计
- 手动导入文本解析
- 页面显示节点池基础数据

当前版本不检测节点可用性，不生成订阅。

`v0.3.1` 实现：

- 新增清空节点池接口
- 新增前端清空节点池按钮
- 修复采集结果表格链接列显示
- 版本号更新到 v0.3.1

当前版本仍不检测节点可用性，不生成订阅。

`v0.4.0` 实现：

- Xray-core 检测状态接口
- 单节点手动检测
- 待检测节点批量检测
- 检测结果写回节点池
- 检测管理页面接入真实状态

当前版本不会自动下载 Xray-core。需要将 Xray-core 放到 `cores/xray/xray`，或通过 `XRAY_BINARY_PATH` 指定路径。当前版本不生成订阅。

`v0.4.2` 实现：

- 增强 Xray 节点参数兼容
- 增强 VLESS Reality / TLS / WS / gRPC 支持
- 增强 Trojan TLS / WS / gRPC 支持
- 增强 Shadowsocks URL 解析
- 增强 VMess base64 JSON 解析
- 不支持参数返回 unsupported，不导致服务崩溃

该版本仍不生成订阅，只做 Xray-core 检测兼容增强。

`v0.4.3` 实现：

- 修复 VLESS Reality outbound 参数映射
- 确认 SOCKS 检测请求真正通过 Xray inbound
- 增加检测失败原因区分
- 增加安全 debug 摘要
- 不暴露 raw 节点

当前版本仍不生成订阅。当前版本重点验证 Xray 检测准确性。

`v0.4.4` 实现：

- 对齐 VLESS Reality TCP `xtls-rprx-vision` 临时 Xray outbound 结构
- Reality 缺失 `shortId` 时使用空字符串
- Reality 缺失 `spiderX` 时默认使用 `/`
- debug 摘要增加 hasPublicKey、hasServerName、hasShortId、spiderXValueType 等安全字段
- bad record mac 类失败明确提示检查 publicKey、serverName、shortId、spiderX、flow

当前版本仍不生成订阅。当前版本继续聚焦 Xray Reality 检测准确性。

## 本地开发命令

```bash
npm install
npm run build
npm run dev
```

开发服务默认监听 `0.0.0.0:3000`。

## Docker 部署命令

```bash
docker compose up -d --build
```

Docker Compose 预留给后续 VPS 部署使用，服务名、容器名和镜像名均按项目规范配置。

## 后续版本路线

- `v0.1.0`：项目骨架和配置文件
- `v0.2.0`：GitHub 采集与限速
- `v0.3.0`：节点解析与节点池
- `v0.3.1`：节点池清理与 UI 小修
- `v0.4.0`：Xray-core 可用性检测
- `v0.4.2`：Xray 节点参数兼容增强
- `v0.4.3`：VLESS Reality 检测链路修复
- `v0.4.4`：VLESS Reality 临时 Xray 配置细节修复
- `v0.5.0`：自动订阅刷新
- `v0.6.0`：二维码和订阅有效期
- `v0.7.0`：统计面板完善
- `v0.8.0`：sing-box / Mihomo 内核管理
- `v0.9.0`：Telegram Bot 只读订阅接口

## 安全说明

- 不提交 `.env`、数据库、日志、token、密码或密钥。
- 不提交 `data/`、节点池 JSON、内核二进制文件或构建产物。
- `GET /api/config-preview` 只返回配置摘要，不读取 `.env`。
- GitHub Token 只从环境变量读取，只用于请求头，不在接口返回或日志中输出。
- 节点池接口只返回脱敏节点，不返回完整 raw 节点。
- 本项目后台仅供华哥自用，不设计多用户、会员、支付或 SaaS 能力。
