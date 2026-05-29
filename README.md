# 华哥自动节点订阅池

华哥自动节点订阅池是一个自用后台项目，不是 SaaS，不面向客户或粉丝开放登录。本项目目标是逐步实现公开节点采集、解析、可用性检测、节点池维护和订阅输出。

## 当前版本

当前版本为 `v1.0.5` 兜底增强版，已经完成项目骨架、GitHub 线索搜索、节点解析、本地 JSON 节点池基础、Xray-core 检测、节点状态手动校正、安全订阅链接、订阅缓存自动刷新、订阅页隐藏 token 展示、公开订阅域名配置、安全订阅 token 重置、订阅有效期、订阅二维码下载、公开领取页和口令验证、领取验证成功后返回可复制订阅链接、领取口令防刷、隐藏二维码预览、发布前检查页、发布前检查结果优化、发布前一键准备操作区、Xray-core 内核状态识别热修复、Xray 检测流程与手动成功流程对齐、单节点 Xray 检测结果写回修复、`test-node/:nodeId` 写回后重读验证，以及手动验证可用节点加入订阅池机制。

`v0.2.0` 在骨架基础上增加 GitHub 公开线索采集链路：

- 读取关键词配置
- 读取采集限速规则
- 支持 GitHub Token 配置
- 手动触发 GitHub 搜索
- 采集状态展示
- 搜索结果摘要展示

`v0.2.0` 只搜索 GitHub 线索，不解析节点、不检测节点、不输出订阅。

`v0.3.0` 实现：

- 从 GitHub 搜索结果读取有限内容
- 解析 vmess/vless/trojan/ss/ssr 节点
- 节点去重
- 本地 JSON 节点池
- 节点池统计
- 手动导入文本解析
- 页面显示节点池基础数据

该版本不检测节点可用性，不输出订阅。

`v0.3.1` 实现：

- 新增清空节点池接口
- 新增前端清空节点池按钮
- 修复采集结果表格链接列显示
- 版本号更新到 v0.3.1

该版本仍不检测节点可用性，不输出订阅。

`v0.4.0` 实现：

- Xray-core 检测状态接口
- 单节点手动检测
- 待检测节点批量检测
- 检测结果写回节点池
- 检测管理页面接入真实状态

该版本不会自动下载 Xray-core。需要将 Xray-core 放到 `cores/xray/xray`，或通过 `XRAY_BINARY_PATH` 指定路径。该版本不输出订阅。

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

该版本不输出订阅，重点验证 Xray 检测准确性。

`v0.4.4` 实现：

- 对齐 VLESS Reality TCP `xtls-rprx-vision` 临时 Xray outbound 结构
- Reality 缺失 `shortId` 时使用空字符串
- Reality 缺失 `spiderX` 时默认使用 `/`
- debug 摘要增加 hasPublicKey、hasServerName、hasShortId、spiderXValueType 等安全字段
- bad record mac 类失败明确提示检查 publicKey、serverName、shortId、spiderX、flow

该版本不输出订阅，继续聚焦 Xray Reality 检测准确性。

`v0.4.5` 实现：

- 节点状态手动校正
- 手动标记可用
- 手动标记不可用
- 恢复待检测
- 节点池统计区分自动检测和手动确认
- 后续订阅生成可使用手动确认可用节点

该版本不输出订阅，用于避免自动检测误判阻塞订阅池开发。

`v0.5.0` 实现：

- 从节点池筛选可用于订阅的节点
- 生成带随机 token 的安全订阅链接
- 订阅访问接口输出通用 base64 订阅内容
- 后台订阅管理页只显示一个安全订阅链接
- 支持手动生成/刷新订阅内容

`v0.6.0` 实现：

- 服务启动后按配置自动刷新订阅缓存
- 默认每 5 分钟刷新一次
- 自动刷新复用已有安全订阅 token
- 无可用节点时保留上一次成功订阅缓存
- 订阅管理页展示自动刷新状态、上次刷新时间、下次刷新时间和 warning

当前版本不做领取页、Telegram Bot 或用户身份系统。

`v0.6.1` 实现：

- 订阅管理页不再明文显示完整安全订阅链接
- 订阅管理页不再显示 `/sub/{token}` 或 token
- 复制按钮仍可复制完整安全订阅地址
- 后端订阅生成、自动刷新和 token 规则保持不变

`v0.6.2` 实现：

- 优先使用 `navigator.clipboard.writeText` 复制安全订阅链接
- 在 HTTP 或浏览器限制环境下，回退到 textarea + `document.execCommand("copy")`
- 复制成功和失败都有明确提示
- 页面仍不显示完整订阅链接、`/sub/{token}` 或 token

`v0.6.3` 实现：

- 修复复制订阅链接暴露后台域名和 3000 端口的问题
- 复制订阅链接时使用 `SUBSCRIPTION_PUBLIC_BASE_URL`
- 未配置公开订阅域名时不复制后台地址，并提示先配置
- 后台地址和公开订阅地址必须分离

正式分发订阅前必须配置：

```env
SUBSCRIPTION_PUBLIC_BASE_URL=https://get.huage.us
```

不要把 `http://后台域名:3000/sub/token` 发给粉丝。

`v0.6.4` 实现：

- 新增 `POST /api/subscription/reset-token`
- 后台可手动重置安全订阅 token
- 重置后旧订阅链接失效，新订阅链接继续使用原有订阅缓存内容
- 订阅管理页新增“重置安全订阅链接”按钮
- 页面仍不显示完整订阅链接、`/sub/{token}` 或 token

`v0.7.0` 实现：

- 订阅缓存增加活动级有效期
- `/sub/:token` 访问时检查是否过期
- 过期后公开订阅接口返回 `410 Gone`
- 后台订阅管理页显示到期时间、剩余时间和有效期状态
- 新增“续期订阅有效期”按钮

`v0.7.1` 实现：

- 订阅管理页显示订阅二维码区域
- 二维码内容使用公开订阅地址生成
- 页面仍不显示完整订阅链接、`/sub/{token}` 或 token
- 支持下载 `huage-secure-subscription-qr.png`

`v0.8.0` 实现：

- 新增公开领取页 `/claim`
- 新增 `POST /api/claim/verify` 口令验证接口
- 粉丝输入视频口令验证成功后，可以复制订阅链接
- 公开页不显示后台菜单、后台信息、完整订阅链接、`/sub/{token}` 或 token
- 复制内容仍使用 `SUBSCRIPTION_PUBLIC_BASE_URL + safeSubscriptionUrl`

`v0.8.1` 实现：

- `POST /api/claim/verify` 在口令正确时返回 `copyableSubscriptionUrl`
- `/claim` 页面不再调用 `/api/subscription/status`
- `copyableSubscriptionUrl` 只用于复制到剪贴板，不在页面展示
- 口令错误、订阅未生成、订阅过期或公开域名未配置时不返回订阅链接

公开入口后续需要允许 `/claim`、`/assets/*`、`/api/claim/verify` 和 `/sub/*`，继续阻止 `/api/subscription/status`、`/api/status`、其他 `/api/*`、后台页面和根路径策略外的入口。

## v0.8.2 说明

`v0.8.2` 实现：

- `POST /api/claim/verify` 增加按 IP 的内存失败次数限制。
- 连续输错达到阈值后进入冷却期，冷却期内返回 `429 CLAIM_TOO_MANY_ATTEMPTS`。
- 口令正确后清除该 IP 的失败计数。
- `/claim` 页面显示剩余尝试次数和冷却提示。
- 订阅管理页不再直接展示二维码图片，只显示二维码状态和下载按钮。
- 下载二维码时临时生成 PNG，文件名为 `huage-secure-subscription-qr.png`。

公开域名后续只应放行 `/claim`、`/assets/*`、`/api/claim/verify` 和 `/sub/*`，继续禁止 `/api/subscription/status`、`/api/status`、其他 `/api/*`、后台页面和根路径策略外的入口。

## v0.8.3 说明

`v0.8.3` 实现：

- 新增 `GET /api/publish-check/status` 发布前检查接口。
- 检查订阅是否生成、订阅有效期、节点数量、公开订阅域名、复制链接准备状态和领取口令配置。
- 检查公开领取页 `/claim`、公开验证接口 `/api/claim/verify` 和公开域名下后台 API 是否被 404 阻止。
- 系统设置页新增“发布前检查”区域，显示通过、警告、失败和是否可以发布视频。
- 固定提醒正式发布前最后重置一次安全订阅 token，并确认口令为本期视频口令。

发布前检查只返回安全摘要，不返回 token、完整订阅链接、`CLAIM_ACCESS_CODE`、raw 节点或 raw/base64 内容。

## v0.8.4 说明

`v0.8.4` 实现：

- 发布前检查将 `INVALID_CLAIM_CODE` 识别为公开口令验证接口可达，状态为通过。
- 发布前检查将 `CLAIM_TOO_MANY_ATTEMPTS` 识别为接口可达但已进入防刷冷却期，状态为警告。
- 公开后台 API 暴露检查仍保持严格，非 404 继续判定为失败。
- 系统设置页发布前检查区域更清晰展示通过、警告、失败和检查详情。

本版本不修改领取口令验证规则、防刷规则、订阅生成逻辑或 Caddy/Docker 配置。

## v0.8.5 说明

`v0.8.5` 实现：

- 新增 `POST /api/publish-check/prepare`。
- 发布前准备会重置安全订阅 token 并续期订阅有效期。
- prepare 只返回安全脱敏结果，不返回 token、完整订阅链接、真实口令或 raw/base64 内容。
- 系统设置页“发布前检查”区域新增“执行发布前准备”按钮。
- 执行成功后自动刷新发布前检查结果。

该接口只用于后台管理端，不应公开到 `get.huage.us`。

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
- `v0.4.5`：节点状态手动校正
- `v0.5.0`：安全订阅链接基础版
- `v0.6.0`：自动订阅刷新基础版
- `v0.6.1`：订阅页隐藏 token 展示
- `v0.6.2`：订阅链接复制兼容修复
- `v0.6.3`：公开订阅域名配置
- `v0.6.4`：重置安全订阅 token
- `v0.7.0`：订阅有效期基础版
- `v0.7.1`：订阅二维码展示基础版
- `v0.8.0`：公开领取页和口令验证基础版
- `v0.8.1`：领取验证成功后返回可复制订阅链接
- `v0.8.2`：领取口令防刷和隐藏二维码预览
- `v0.8.3`：发布前检查页基础版
- `v0.8.4`：发布前检查结果优化
- `v0.8.5`：发布前一键准备操作区
- `v0.9.0`：发布候选版 RC、部署文档、回滚说明、最终验收脚本

## 安全说明

- 不提交 `.env`、数据库、日志、token、密码或密钥。
- 不提交 `data/`、节点池 JSON、内核二进制文件或构建产物。
- `GET /api/config-preview` 只返回配置摘要，不读取 `.env`。
- GitHub Token 只从环境变量读取，只用于请求头，不在接口返回或日志中输出。
- 节点池接口只返回脱敏节点，不返回完整 raw 节点。
- 本项目后台仅供华哥自用，不设计多用户、会员、支付或 SaaS 能力。
# v1.0.1 热修复

`v1.0.1` 修复 Xray-core 内核状态识别问题。后端现在通过执行 `/app/cores/xray/xray version` 判断内核是否存在、是否可执行，并解析版本号；内核管理页显示 Xray-core 已安装、版本号、可执行路径和失败原因；检测管理页在 Xray-core 可用时明确提示真实代理检测可用。

最小真实检测验收：

1. 容器内执行 `/app/cores/xray/xray version` 成功。
2. `GET /api/detection/xray/status` 返回 `installed=true`、`available=true` 和实际版本号。
3. 后台内核管理页显示 Xray-core 已安装并可执行。
4. 导入测试节点后可发起 Xray 真实检测，结果不应再是 xray not found。

# v1.0.2 热修复

`v1.0.2` 修复 Xray 检测流程误判问题。软件检测流程现在对齐 VPS 手动成功流程：生成临时 Xray JSON 配置，使用 `xray run -config` 启动临时进程，等待本地 SOCKS 端口就绪，再用 `curl --socks5-hostname 127.0.0.1:随机端口` 访问检测 URL。

检测结果判定规则：

- `http_code=204` 或 `http_code=200` 判定为 `available`。
- 只有 curl 未成功时才结合 Xray 安全日志摘要生成 failureReason。
- 安全 debug 只返回 `configBuildOk`、`xrayStarted`、`socksPort`、`curlExitCode`、`httpCode`、`failureStage`、`safeFailureReason` 等字段。
- 不输出 raw 节点、完整 publicKey、订阅 token 或完整订阅链接。

# v1.0.3 热修复

`v1.0.3` 修复单节点 Xray 真实检测结果写回问题。后台新增 `POST /api/detection/xray/test-node`，可对任意节点状态执行单节点重新检测，包括已经是 `unavailable` 的节点。检测完成后会立即写回本地节点池 JSON。

写回字段包括：

- `status`
- `lastTestedAt`
- `detectionCore=xray`
- `responseMs`
- `failureReason`
- `detectionDebug`
- `detectionRuntimeDebug`
- `debug`

运行时 debug 包含 `configBuildOk`、`xrayStarted`、`socksPort`、`curlExitCode`、`httpCode`、`failureStage`、`safeFailureReason`。`httpCode=204` 或 `httpCode=200` 必须判定为 `available`。Docker runner 阶段安装 `curl` 和 `ca-certificates`，用于真实 SOCKS 检测。页面节点行的“Xray 检测 / 重新 Xray 检测”按钮调用单节点检测接口，不再只能检测 `untested` 节点。

# v1.0.4 热修复

`v1.0.4` 进一步修复路径版单节点检测接口和落盘验收：`POST /api/detection/xray/test-node/:nodeId` 会根据路径参数读取节点、执行当前 Xray 检测流程、写回节点池，然后重新读取写回后的脱敏节点并返回。

接口返回会包含 `lastTestedAt`、`detectionRuntimeDebug`、`detectionDebug`、`debug` 和脱敏 `node`，方便 VPS 验收确认节点池已经更新。前端节点行按钮改为调用路径版接口，不再依赖 body 版接口。接口和页面仍不返回 raw 节点、完整 publicKey、订阅 token 或完整订阅链接。

# v1.0.5 兜底增强

`v1.0.5` 增加“手动验证可用并加入订阅池”机制。当管理员已经在 VPS 上手动确认某条节点可用时，可以调用 `POST /api/node-pool/mark-manual-available/:nodeId` 或在后台节点行点击“标记为手动验证可用”。

写回结果：`status=available`、`manualOverride=true`、`manualStatus=available`、`detectionCore=manual`、`failureReason=null`、`lastTestedAt=当前时间`。订阅生成仍允许 `manualOverride=true` 且 `manualStatus=available` 的节点进入订阅池。页面只展示脱敏节点，不展示 raw 节点、token 或完整订阅链接。

# v1.0.0 稳定版

当前稳定版：`v1.0.0`。本版本为稳定封版，不新增业务功能，只做版本标记、稳定版发布说明、最终验收清单和运行数据备份脚本。

## 最小稳定能力

- 后台维护节点订阅池。
- 生成安全订阅链接。
- 订阅有效期、续期、重置 token。
- 订阅二维码下载。
- 公开领取页 `/claim`。
- 视频口令验证 `/api/claim/verify`。
- 领取接口基础防刷。
- 发布前检查。
- 发布前一键准备。
- 最终验收脚本。
- 运行数据备份脚本。

## v1.0.0 正式发布前必须执行

```bash
bash scripts/backup-runtime-data.sh
bash scripts/final-acceptance-check.sh
```

正式发布前还必须确认：

- `CLAIM_ACCESS_CODE` 已改成本期视频口令。
- 已执行发布前准备。
- 已下载新的二维码。
- 已测试错误口令。
- 已测试正确口令。
- 已确认公开域名没有开放全部 `/api/*`。

## v1.0.0 安全要求

- 不要公开后台地址。
- 不要公开 3000 端口。
- 不要截图 token。
- 不要显示完整订阅链接。
- 不要开放全部 `/api/*`。
- 不要提交 `.env`、`data/`、`cores/`。

后续开发必须先开新版本，不在 `v1.0.0` 稳定版上随意混入新功能。

# v0.9.0 发布候选版

当前版本为 `v0.9.0` 发布候选版 RC。本版本不新增业务功能，只做发布收口：整理发布说明、部署文档、正式发布前检查清单、回滚说明、最终验收脚本和 Codex 固定工作规则。

## 当前能力概览

- 后台可生成安全订阅链接，并隐藏 token 和完整链接。
- 订阅支持有效期、续期、重置 token、自动刷新缓存和二维码下载。
- 公开领取页 `/claim` 支持视频口令验证和基础防刷。
- 领取验证成功后只复制公开订阅地址，不在页面展示完整链接。
- 发布前检查页可以检查订阅、有效期、公开域名、口令配置、公开入口和后台 API 隔离。
- 发布前准备按钮可以重置安全订阅 token 并续期。

## 正式发布前流程

1. 确认 `CLAIM_ACCESS_CODE` 已改成本期视频口令。
2. 在后台执行“发布前准备”。
3. 下载新的二维码。
4. 打开 `/claim` 做页面访问测试。
5. 使用错误口令测试错误提示或防刷提示。
6. 使用正确口令测试复制订阅。
7. 确认公开域名下后台 API 被 404 挡住。

## 公开域名说明

`get.huage.us` 只应该开放：

- `/claim`
- `/assets/*`
- `/api/claim/verify`
- `/sub/*`

不能开放全部 `/api/*`，不能公开后台地址，不能公开 3000 端口。

## 安全提醒

- 不截图 token。
- 不在视频、截图或聊天里公开完整订阅链接。
- 不公开后台访问域名和 3000 端口。
- 正式发布前最后重置一次安全订阅 token。
- 重置 token 后需要重新下载二维码。
