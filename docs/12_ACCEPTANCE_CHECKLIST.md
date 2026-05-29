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

v0.4.4 验收项：

- `/api/status` 返回 `version=v0.4.4`。
- VLESS Reality TCP `xtls-rprx-vision` 节点不返回 `unsupported`。
- Reality TCP 配置不生成 `tlsSettings`、`wsSettings`、`grpcSettings`。
- `shortId` 缺失时使用 `""`。
- `spiderX` 缺失时使用 `/`，debug 摘要能显示 `spiderXValueType=/`。
- failureReason 对 bad record mac 明确提示检查 `publicKey/serverName/shortId/spiderX/flow`。
- 不暴露 raw 节点，不提交 `cores/` 和 `data/`。

v0.4.5 验收项：

- `/api/status` 返回 `version=v0.4.5`。
- `POST /api/node-pool/nodes/:id/manual-status` 可以标记可用、不可用和恢复待检测。
- 手动标记可用后节点写入 `manualOverride=true`、`manualStatus=available`、`manualReason`、`manualUpdatedAt`。
- 手动标记不可用后节点写入 `manualOverride=true`、`manualStatus=unavailable`。
- 恢复待检测后节点写入 `status=untested`，并清空人工校正字段。
- `/api/node-pool/status` 返回 `manualAvailable`、`manualUnavailable`、`autoAvailable`、`autoUnavailable`。
- 前端节点列表提供手动操作按钮，且不展示 raw 节点。
- 不生成订阅，不新增菜单，不提交 `cores/` 和 `data/`。

v0.5.0 验收项：

- `/api/status` 返回 `version=v0.5.0`。
- `/api/subscription/status` 正常返回，且不返回 raw 节点或完整订阅内容。
- `POST /api/subscription/rebuild` 可以生成安全订阅链接。
- `/sub/:token` 在 token 正确时返回 base64 订阅内容，token 错误时不能访问。
- 手动确认可用节点可以进入订阅，手动确认不可用节点不能进入订阅。
- 订阅管理页只显示一个安全订阅链接，不再显示 raw/base64 两个链接。
- 不做二维码、领取页、Telegram Bot 或自动定时刷新。
- 不新增菜单，不提交 `cores/` 和 `data/`。

## 后续待补充内容

补充 Docker 启动检查、接口测试、页面截图检查和真实业务版本验收项。

## v0.6.0 验收项

- `/api/status` 返回 `version=v0.6.0`。
- `/api/subscription/status` 返回 `autoRefreshEnabled`、`refreshIntervalMinutes`、`lastAutoRefreshAt`、`nextAutoRefreshAt`、`lastAutoRefreshOk`、`lastAutoRefreshWarning`、`lastAutoRefreshError`。
- 自动刷新默认开启，默认间隔为 5 分钟。
- 自动刷新复用已有 token，不会定时更换安全订阅链接。
- 有可用节点时自动刷新能更新订阅缓存。
- 无可用节点时不清空已有订阅内容，只记录 warning。
- 手动刷新订阅仍然可用。
- 订阅管理页显示自动刷新状态，仍然只显示一个安全订阅链接。
- API 和页面不暴露 raw 节点。
- 不新增菜单，不提交 `data/` 或 `cores/`。

## v0.6.1 验收项

- `/api/status` 返回 `version=v0.6.1`。
- 订阅管理页不明文显示完整安全订阅链接。
- 订阅管理页不显示 `/sub/{token}` 或 token。
- “复制安全订阅链接”按钮可以复制完整订阅地址。
- 订阅管理页仍只显示一个安全订阅入口。
- 不恢复 raw/base64 两个链接。
- 自动刷新状态仍显示。
- 不修改后端订阅生成逻辑，不提交 `data/` 或 `cores/`。

## v0.6.2 验收项

- `/api/status` 返回 `version=v0.6.2`。
- 点击“复制安全订阅链接”后有成功或失败提示。
- HTTP 环境下 clipboard 不可用时会尝试 textarea fallback。
- 复制成功提示“已复制安全订阅链接”。
- 复制失败提示“自动复制失败，请检查浏览器权限或使用 HTTPS 后重试”。
- 未生成订阅链接时提示“请先生成安全订阅链接”。
- 页面不显示完整订阅链接、`/sub/{token}` 或 token。
- 页面不显示 raw/base64 两个链接。
- 不修改后端订阅生成逻辑、自动刷新逻辑，不提交 `data/` 或 `cores/`。

## v0.6.3 验收项

- `/api/status` 返回 `version=v0.6.3`。
- `/api/subscription/status` 返回 `publicBaseUrlConfigured`、`publicSubscriptionBaseUrl`、`copyableSubscriptionUrlReady`。
- 未配置 `SUBSCRIPTION_PUBLIC_BASE_URL` 时，复制按钮不复制后台访问地址或 3000 端口地址。
- 未配置时提示“请先配置公开订阅域名 SUBSCRIPTION_PUBLIC_BASE_URL”。
- 配置 `SUBSCRIPTION_PUBLIC_BASE_URL=https://get.huage.us` 后，复制结果为 `https://get.huage.us/sub/xxxx`。
- 页面不显示完整订阅链接、`/sub/xxxx` 或 token。
- 页面不显示 raw/base64 两个链接。
- 不修改订阅 token 生成规则，不修改自动刷新逻辑，不提交 `data/` 或 `cores/`。

## v0.6.4 验收项

- `/api/status` 返回 `version=v0.6.4`。
- `POST /api/subscription/reset-token` 可用。
- reset-token 后 `safeSubscriptionUrl` 改变。
- reset-token 后旧 token 访问返回 404，新 token 访问返回 200。
- reset-token 后当前订阅内容继续保留，公开订阅域名配置不变。
- 订阅管理页提供“重置安全订阅链接”按钮，并有二次确认。
- 页面不显示完整订阅链接、`/sub/xxxx` 或 token。
- 页面不显示 raw/base64 两个链接。
- 自动刷新状态仍显示，不提交 `data/` 或 `cores/`。

## v0.7.0 验收项

- `/api/status` 返回 `version=v0.7.0`。
- `/api/subscription/status` 返回 `expiresAt`、`expired`、`remainingSeconds`、`remainingDays`。
- 第一次生成订阅时会生成 `expiresAt`。
- 手动刷新、自动刷新和 reset-token 不会自动延长已有 `expiresAt`。
- `POST /api/subscription/renew-expiration` 可以续期。
- 续期后 `expiresAt` 变为当前时间加配置天数。
- 未过期 token 访问 `/sub/:token` 返回 200。
- 过期 token 访问 `/sub/:token` 返回 410。
- 错误 token 访问 `/sub/:token` 返回 404。
- 页面显示订阅有效期、到期时间和剩余时间。
- 页面不显示 token、完整链接或 raw/base64 两个链接。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.7.1 验收项

- `/api/status` 返回 `version=v0.7.1`。
- 订阅未生成时不显示二维码，并提示先生成安全订阅。
- 公开订阅域名未配置时不显示二维码，并提示配置公开域名。
- 订阅已过期时不显示二维码，并提示先续期。
- 订阅有效时显示二维码。
- 二维码内容基于公开订阅地址生成。
- 页面不显示完整订阅链接文本、`/sub/{token}`、token 或 raw/base64 两个链接。
- 下载二维码按钮可下载 `huage-secure-subscription-qr.png`。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.8.0 验收项

- `/api/status` 返回 `version=v0.8.0`。
- `/claim` 页面可以打开。
- `/claim` 页面不显示后台侧边栏、后台菜单、后台标题或节点池基础版徽章。
- `/claim` 页面不显示 token、完整订阅链接、`/sub/{token}` 或 raw/base64 链接。
- `POST /api/claim/verify` 口令错误时返回 `ok=false` 和错误提示。
- `POST /api/claim/verify` 口令正确且订阅可领取时返回 `ok=true`、`claimAllowed=true`、`subscriptionReady=true`。
- 口令未配置时返回 `CLAIM_CODE_NOT_CONFIGURED`。
- 订阅未生成、订阅过期或公开订阅域名未配置时返回明确提示。
- 口令正确后公开页可复制订阅链接，复制内容使用公开订阅域名。
- 后台订阅页原有生成、复制、重置、续期和二维码展示功能不破坏。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.8.1 验收项

- `/api/status` 返回 `version=v0.8.1`。
- `/claim` 页面不调用 `/api/subscription/status`。
- `POST /api/claim/verify` 口令错误时不返回 `copyableSubscriptionUrl`。
- `POST /api/claim/verify` 口令正确且订阅可领取时返回 `copyableSubscriptionUrl`。
- `copyableSubscriptionUrl` 使用公开订阅域名和安全订阅路径拼接。
- `/claim` 页面不显示完整链接、`/sub/{token}`、token、后台信息或 raw/base64 内容。
- 点击复制按钮复制 `copyableSubscriptionUrl`。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.8.2 验收项

- `/api/status` 返回 `version=v0.8.2`。
- `POST /api/claim/verify` 口令错误会累计失败次数。
- 达到失败阈值后返回 HTTP 429 和 `CLAIM_TOO_MANY_ATTEMPTS`。
- 冷却期内不返回 `copyableSubscriptionUrl`。
- 口令正确后返回 `copyableSubscriptionUrl`，并清除该 IP 的失败计数。
- `/claim` 页面显示错误次数或冷却提示。
- `/claim` 页面不显示 token、完整订阅链接、后台信息或 raw/base64 内容。
- 订阅管理页不再直接显示二维码图片。
- 订阅管理页仍有“下载二维码”按钮。
- 点击下载二维码后能下载 `huage-secure-subscription-qr.png`。
- 下载的二维码内容仍是公开订阅地址。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.8.3 验收项

- `/api/status` 返回 `version=v0.8.3`。
- `/api/publish-check/status` 可访问。
- 发布前检查返回 `canPublish`、`level`、`checks` 和 `reminders`。
- 检查结果不包含 token、完整订阅链接、`CLAIM_ACCESS_CODE`、raw/base64 内容或 raw 节点。
- 检查项包含订阅生成、订阅有效期、节点数量、公开订阅域名、复制链接准备、领取口令配置、公开领取页、公开验证接口和后台 API 暴露检查。
- 系统设置页显示发布前检查结果，并提供“刷新检查”按钮。
- 页面不显示 token、完整订阅链接、真实口令、raw/base64 链接或 raw 节点。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.8.5 验收项

- `/api/status` 返回 `version=v0.8.5`。
- `POST /api/publish-check/prepare` 可调用。
- prepare 会重置安全订阅 token。
- prepare 会续期订阅有效期。
- prepare 不返回 token、完整订阅链接、真实口令、raw/base64 内容或 raw 节点。
- 系统设置页发布前检查区域有“执行发布前准备”按钮。
- 点击按钮前有确认弹窗。
- 成功后自动刷新发布前检查结果。
- 页面不显示 token、完整订阅链接、真实口令、raw/base64 链接或 raw 节点。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。

## v0.8.4 验收项

- `/api/status` 返回 `version=v0.8.4`。
- `/api/publish-check/status` 可访问。
- `INVALID_CLAIM_CODE` 被识别为公开口令验证接口可达，状态为 `pass`。
- `CLAIM_TOO_MANY_ATTEMPTS` 被识别为接口可达但进入防刷冷却期，状态为 `warning`。
- 公开后台 API 暴露检查仍然严格，公开域名下后台 API 非 404 必须 `fail`。
- 页面能清晰显示通过、警告、失败和安全 detail。
- 页面不显示 token、完整订阅链接、真实口令、raw/base64 链接或 raw 节点。
- 不修改 Caddy/Docker，不提交 `data/` 或 `cores/`。
# v0.9.0 验收项

- `/api/status` 返回 `version=v0.9.0`。
- README 已补充发布候选版能力概览、正式发布前流程、公开域名说明和安全提醒。
- `docs/13_DEPLOYMENT_GUIDE.md` 存在，并包含 VPS 拉取代码、Docker Compose 部署、环境变量示例、Caddy 公开入口示例、HTTPS 检查和日志检查。
- `docs/14_RELEASE_CHECKLIST.md` 存在，并包含正式发视频前检查项。
- `docs/15_ROLLBACK_GUIDE.md` 存在，并包含 Git 回滚、Docker 重新构建、Caddy 备份恢复、服务状态和公开接口检查。
- `docs/CODEX_WORK_RULES.md` 存在，并包含后续 Codex 固定工作规则。
- `scripts/final-acceptance-check.sh` 存在，并只执行只读验收检查。
- 最终验收脚本不输出 token 全文，不自动重置 token，不自动续期，不修改 Caddy，不修改 `data/`。
- 不修改核心业务逻辑。
- 不修改 Caddy、Dockerfile 或 docker-compose.yml。
- 不提交 `data/` 或 `cores/`。
# v1.0.1 热修复验收项

- `/api/status` 返回 `version=v1.0.1`。
- 容器内执行 `/app/cores/xray/xray version` 成功。
- `/api/detection/xray/status` 返回 `installed=true`、`available=true`、`binaryPath=/app/cores/xray/xray` 和实际版本号。
- 文件不存在时返回 `failureReason=XRAY_BINARY_NOT_FOUND`。
- 文件无执行权限时返回 `failureReason=XRAY_BINARY_NOT_EXECUTABLE`。
- version 检查失败时返回 `failureReason=XRAY_VERSION_CHECK_FAILED`。
- 内核管理页显示 Xray-core 已安装、版本号和可执行路径。
- 检测管理页在 Xray-core 可用时显示真实代理检测可用。
- 导入测试节点后，检测结果可以是 `available` 或 `unavailable`，但不能是 xray not found。
- 不提交 `cores/`、`data/` 或 `.env`。
- 不修改 Dockerfile、docker-compose.yml 或 Caddy。

# v1.0.2 热修复验收项

- `/api/status` 返回 `version=v1.0.2`。
- `/api/detection/xray/status` 继续返回 `installed=true` 和 `available=true`。
- 软件检测使用 `xray run -config` 启动临时 Xray 配置。
- 软件检测等待 `127.0.0.1` 随机 SOCKS 端口就绪。
- 软件检测使用 `curl --socks5-hostname 127.0.0.1:随机端口` 访问检测 URL。
- `http_code=204` 或 `http_code=200` 判定节点为 `available`。
- 成功检测结果写入 `status=available`、`detectionCore=xray`、`responseMs`，并清空 `failureReason`。
- 失败时返回 `failureStage` 和安全 failureReason，用于区分配置构建、Xray 启动、SOCKS 监听和 curl 请求阶段。
- 不输出 raw 节点、完整 publicKey、订阅 token、完整订阅链接或真实口令。
- 不修改 Caddy、Dockerfile 或 docker-compose.yml。
- 不提交 `.env`、`data/` 或 `cores/`。

# v1.0.0 稳定版验收项

- `/api/status` 返回 `version=v1.0.0`。
- README 标记当前稳定版为 `v1.0.0`。
- `docs/16_V1_STABLE_RELEASE_NOTES.md` 存在，并包含稳定版能力清单、主流程、安全边界、发布前操作、已知边界和后续方向。
- `scripts/backup-runtime-data.sh` 存在，并只备份运行数据到本机 `backups/` 目录。
- `scripts/backup-runtime-data.sh` 不输出 `.env` 明文。
- `scripts/backup-runtime-data.sh` 不备份 `cores/`、`node_modules/`、`dist/`、`.git/`。
- `scripts/final-acceptance-check.sh` 保持不输出 token 全文。
- 正式发布前必须执行发布前准备、下载二维码、确认口令、确认公开 API 隔离。
- 不修改订阅、领取、防刷、检测、节点池核心逻辑。
- 不修改 Caddy、Dockerfile 或 docker-compose.yml。
- 不提交 `.env`、`data/` 或 `cores/`。
