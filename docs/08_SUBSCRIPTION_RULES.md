# 08 订阅规则

## 文档目的

记录订阅输出的节点选择、安全链接、内容格式和刷新边界。

## 当前版本范围

v0.5.0 只生成一个安全订阅链接，不再并列展示 raw/base64 两个链接。

- 可进入订阅的节点：`status=available`，或 `manualOverride=true` 且 `manualStatus=available`。
- 不可进入订阅的节点：`manualStatus=unavailable`、`status=unavailable`、`status=unsupported`、`status=error`、`status=untested`。
- 节点选择优先级：手动确认可用优先，自动检测可用其次，`responseMs` 较低优先，最近测试时间较新优先。
- 后台状态接口只返回安全订阅链接和统计，不返回 raw 节点。
- 公开订阅接口为 `/sub/{token}`，token 不正确时不能访问。
- 订阅内容为 raw 节点按换行拼接后做 base64 编码。
- 当前版本只支持手动生成/刷新，不做自动 5 分钟刷新，不做二维码、领取页和 Bot 接口。

## 后续待补充内容

补充自动刷新、订阅有效期、二维码、访问统计、token 轮换和更细的订阅格式策略。

## v0.6.0 自动刷新规则

- 自动刷新只刷新 `data/subscription.json` 中的订阅缓存，不采集节点、不检测节点。
- 默认通过 `SUBSCRIPTION_AUTO_REFRESH_ENABLED=true` 开启。
- 默认通过 `SUBSCRIPTION_REFRESH_INTERVAL_MINUTES=5` 每 5 分钟刷新一次。
- 服务启动时只启动定时器，不强制立刻生成订阅，避免空节点池覆盖已有缓存。
- 自动刷新复用已有 token，不会每次刷新更换安全订阅链接。
- 如果没有 token 且本轮存在可用节点，自动刷新可以生成新 token。
- 如果当前可用节点为 0，自动刷新不清空已有订阅内容，只记录 warning 并保留上一次成功缓存。
- 手动“生成/刷新安全订阅”仍然可以立即刷新缓存。
- 后台状态接口只返回安全链接和统计，不返回 raw 节点或完整订阅内容。

## v0.6.1 展示规则

- 订阅管理页不得明文显示完整安全订阅链接。
- 订阅管理页不得显示 `/sub/{token}` 或 token。
- 页面只显示“安全订阅：已生成 / 未生成”和订阅统计。
- “复制安全订阅链接”按钮内部仍可使用 `safeSubscriptionUrl` 拼接完整地址。
- 本版本不修改后端订阅生成逻辑、自动刷新逻辑或 token 生成规则。

## v0.6.3 公开订阅域名规则

- 安全订阅链接复制必须使用公开订阅域名 `SUBSCRIPTION_PUBLIC_BASE_URL`。
- 后台访问域名不能作为粉丝订阅域名。
- 不允许复制 `http://后台域名:3000/sub/token` 给粉丝。
- 未配置 `SUBSCRIPTION_PUBLIC_BASE_URL` 时，复制按钮应提示配置缺失。
- `SUBSCRIPTION_PUBLIC_BASE_URL` 末尾的 `/` 会在拼接前移除。
- 后台状态接口可以返回公开基础域名配置状态，但不返回完整带 token 的公开订阅链接。

## v0.6.4 Token 重置规则

- 后台提供 `POST /api/subscription/reset-token` 用于手动重置安全订阅 token。
- 重置后 `safeSubscriptionUrl` 变为 `/sub/{newToken}`。
- 旧 token 立即失效，旧 `/sub/{oldToken}` 应返回 404。
- 重置 token 不清空当前订阅内容，不改变自动刷新开关，不改变公开订阅域名配置。
- 如果还没有订阅缓存，重置 token 时可以按当前可用节点生成一次订阅缓存。
- API 和页面仍不返回 raw 节点、完整订阅内容或旧 token 列表。

## v0.7.0 有效期规则

- 订阅有效期是活动级有效期，不按用户或设备单独计算。
- 默认有效期由 `SUBSCRIPTION_VALIDITY_DAYS` 配置，默认 15 天。
- 第一次生成订阅时，如果没有 `expiresAt`，设置为当前时间加有效期天数。
- 手动刷新、自动刷新和 reset-token 都不会自动延长已有 `expiresAt`。
- `POST /api/subscription/renew-expiration` 会将 `expiresAt` 设置为当前时间加有效期天数，并更新 `expirationUpdatedAt`。
- `/sub/:token` 访问时 token 错误返回 404，token 正确但已过期返回 410，未过期返回 base64 订阅内容。
- 当前时间大于等于 `expiresAt` 即视为过期。

## v0.7.1 二维码规则

- 订阅二维码只在订阅已生成、公开订阅域名已配置、订阅未过期且可访问时显示。
- 二维码内容使用 `publicSubscriptionBaseUrl + safeSubscriptionUrl` 生成。
- 页面不以文本形式显示完整订阅地址、`/sub/{token}` 或 token。
- 未生成订阅时提示先生成安全订阅。
- 未配置公开订阅域名时提示配置 `SUBSCRIPTION_PUBLIC_BASE_URL`。
- 订阅过期时提示先续期。
- 二维码下载文件名为 `huage-secure-subscription-qr.png`。

## v0.8.0 公开领取规则

- 公开领取页路径为 `/claim`。
- 领取页只用于输入视频口令并复制订阅链接，不显示后台信息。
- 口令只与 `CLAIM_ACCESS_CODE` 环境变量对比，不返回真实口令。
- `config/default_settings.json` 中 `claimAccessCode` 默认保持空字符串，真实口令由部署环境配置。
- 口令正确且订阅已生成、未过期、公开订阅域名已配置时，允许复制订阅链接。
- 复制内容使用 `publicSubscriptionBaseUrl + safeSubscriptionUrl`，但页面不显示完整链接、`/sub/{token}` 或 token。
- 口令错误提示“口令错误，请检查视频中的口令。”。
- 订阅未生成提示“当前订阅暂未生成，请稍后再试。”。
- 订阅已过期提示“当前订阅已过期，请关注新一期视频获取新的领取口令。”。
- 公开订阅域名未配置提示“公开订阅域名未配置，请联系管理员。”。
- 后续公开入口建议允许 `/claim` 和 `/sub/*`，并继续阻止 `/api/*`、后台页面和根路径策略外的入口。
- 如果公开域名下需要完成口令验证，需要为 `POST /api/claim/verify` 设计受控转发策略，不能开放全部后台 API。
