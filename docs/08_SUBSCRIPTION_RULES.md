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
