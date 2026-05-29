# 13 部署说明

## 文档目的

记录 v0.9.0 发布候选版在 VPS 上部署、公开入口配置和验收检查的固定步骤。

## 当前版本范围

本文适用于 `v0.9.0` 发布候选版。该版本不新增业务功能，只整理发布、验收和回滚流程。

## VPS 拉取代码

```bash
cd /opt/huage-node-auto-sub
git fetch --all
git checkout main
git pull
```

部署前确认本地没有未提交的 `.env`、`data/`、`cores/` 或日志文件。真实口令、token、节点数据和内核二进制文件不得提交到 Git。

## Docker Compose 部署

```bash
cd /opt/huage-node-auto-sub
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100
```

部署后后台仍只监听业务容器端口，不应把后台管理入口直接公开给粉丝。

## docker-compose.override.yml 示例

以下仅为示例，不要提交真实 `.env`、真实口令或真实 token：

```yaml
services:
  huage-node-auto-sub:
    environment:
      APP_HOST: 0.0.0.0
      APP_PORT: 3000
      SUBSCRIPTION_PUBLIC_BASE_URL: https://get.huage.us
      CLAIM_ACCESS_CODE: replace-with-current-video-code
      SUBSCRIPTION_VALIDITY_DAYS: 15
      SUBSCRIPTION_AUTO_REFRESH_ENABLED: "true"
      SUBSCRIPTION_REFRESH_INTERVAL_MINUTES: 5
      XRAY_BINARY_PATH: /app/cores/xray/xray
```

## Caddy 公开入口示例

公开域名只允许必要路径：

```caddyfile
get.huage.us {
  handle /claim {
    reverse_proxy 127.0.0.1:3000
  }

  handle /assets/* {
    reverse_proxy 127.0.0.1:3000
  }

  handle /api/claim/verify {
    reverse_proxy 127.0.0.1:3000
  }

  handle /sub/* {
    reverse_proxy 127.0.0.1:3000
  }

  respond 404
}
```

不要开放全部 `/api/*`，不要公开后台域名和 3000 端口。

## HTTPS 检查命令

```bash
curl -k -I https://get.huage.us/claim
curl -k -I https://get.huage.us/api/status
curl -k -I https://get.huage.us/api/subscription/status
curl -k -I https://get.huage.us/api/node-pool/status
curl -k -I https://get.huage.us/api/detection/xray/status
```

预期 `/claim` 可访问，后台 API 在公开域名下返回 404。

## 日志检查命令

```bash
docker compose logs --tail=120 huage-node-auto-sub
```

日志中不得出现完整 token、完整订阅链接、raw 节点、真实口令或密码。

## 后续待补充内容

后续如引入多活动、多口令、统计或 Telegram Bot，再补充对应部署和验收步骤。
# v1.0.0 稳定版部署补充

部署 `v1.0.0` 前，建议先执行：

```bash
bash scripts/backup-runtime-data.sh
```

部署完成后，必须执行：

```bash
bash scripts/final-acceptance-check.sh
```

正式发视频前必须执行发布前准备、下载二维码、确认本期口令、确认公开域名只开放 `/claim`、`/assets/*`、`/api/claim/verify` 和 `/sub/*`。
