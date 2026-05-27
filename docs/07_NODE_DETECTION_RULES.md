# 07 节点检测规则

## 文档目的

定义节点可用性检测的第一阶段目标。

## 当前版本范围

v0.3.0 会把解析进入节点池的节点统一标记为 `status=untested`，默认地区为 `未知`。

v0.4.0 增加 Xray-core 基础检测：

- 不自动下载 Xray-core，只读取 `XRAY_BINARY_PATH`，默认 `/app/cores/xray/xray`。
- Xray 临时 inbound 只能监听 `127.0.0.1`。
- 每次检测使用随机本地端口。
- 检测结束必须关闭 Xray 子进程，并删除临时配置文件。
- 默认并发为 1，本版本最大并发不超过 2。
- 单节点默认超时 10 秒。
- 批量检测默认最多 5 条，最大 20 条。
- 不在日志、接口或页面中输出完整 raw 节点。
- 支持状态：`untested`、`testing`、`available`、`unavailable`、`unsupported`、`error`。
- 检测字段写入节点池：`lastTestedAt`、`detectionCore`、`responseMs`、`failureReason`、`testCount`、`successCount`、`failCount`。
- 当前只支持 Xray-core，不支持 sing-box / Mihomo。

v0.4.2 增强解析边界：

- VLESS：支持 `security=none/tls/reality`，支持 `type=tcp/ws/grpc`，Reality 映射 `sni/fp/pbk/publicKey/sid/shortId/spiderX`，常见 `flow=xtls-rprx-vision` 可用。
- Trojan：支持 `security=none/tls`，支持 `type=tcp/ws/grpc`，TLS 映射 `sni/fp/alpn/allowInsecure`。
- Shadowsocks：支持常见 `ss://base64(method:password@host:port)`、`ss://method:password@host:port`、`ss://base64(method:password)@host:port`。
- VMess：支持 `vmess://base64(JSON)`，解析 `add/port/id/aid/net/type/host/path/tls/sni/alpn/fp`。
- 不支持的 flow、transport、method 或缺失 host/port 时返回 `unsupported` 和简洁原因。

v0.4.3 修复 VLESS Reality 检测链路：

- VLESS user 固定写入 `encryption=none`，`flow=xtls-rprx-vision` 放在 user 对象中。
- `security=reality` 时只生成 `realitySettings`，不生成 `tlsSettings`。
- Reality 参数映射为 `serverName=sni`、`fingerprint=fp`、`publicKey=pbk/publicKey`、`shortId=sid/shortId`、`spiderX=spiderX/spx`。
- 临时 Xray inbound 继续只监听 `127.0.0.1`，并使用随机本地 SOCKS 端口。
- 检测请求必须通过 `socks5://127.0.0.1:随机端口` 访问检测 URL，不使用 Node 原生 fetch 直连。
- 失败原因区分为 Xray 启动失败、SOCKS 请求失败、检测 URL 超时、TLS/Reality 握手失败、HTTP 状态异常。
- debug 摘要只允许包含协议、传输、security、flow、代理类型、检测 URL 和检测核心，不包含 raw、uuid、password、publicKey、server 或完整配置。

## 后续待补充内容

补充更完整的协议参数支持、检测失败分类、内核安装管理和检测队列优化。
