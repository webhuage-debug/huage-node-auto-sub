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
