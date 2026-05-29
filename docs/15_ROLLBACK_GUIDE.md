# 15 回滚说明

## 文档目的

记录发布异常时的安全回滚步骤，确保可以快速恢复到上一稳定版本。

## 当前版本范围

本文适用于 `v0.9.0` 发布候选版及其前后小版本。

## Git 回滚到上一版本

先查看最近提交：

```bash
cd /opt/huage-node-auto-sub
git log --oneline -10
```

确认目标提交后切换：

```bash
git checkout <stable-commit>
```

如需回到 `main` 的旧提交，请先确认不会丢弃未备份的本地修改。

## Docker Compose 重新构建

```bash
docker compose build
docker compose up -d
docker compose ps
```

回滚后检查后台版本和容器日志：

```bash
curl -s http://127.0.0.1:3000/api/status
docker compose logs --tail=120 huage-node-auto-sub
```

## 恢复 Caddy 备份

如果发布期间改过 Caddy，需要从备份恢复配置，再 reload：

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

v0.9.0 本身不要求修改 Caddy。公开域名仍应只放行 `/claim`、`/assets/*`、`/api/claim/verify` 和 `/sub/*`。

## 服务状态检查

```bash
curl -s http://127.0.0.1:3000/api/status
curl -s http://127.0.0.1:3000/api/subscription/status
curl -s http://127.0.0.1:3000/api/publish-check/status
```

不要把这些后台 API 直接暴露到公开域名。

## 公开接口检查

```bash
curl -k -I https://get.huage.us/claim
curl -k -I https://get.huage.us/api/status
curl -k -I https://get.huage.us/api/subscription/status
curl -k -I https://get.huage.us/api/node-pool/status
curl -k -I https://get.huage.us/api/detection/xray/status
```

预期后台 API 继续返回 404。

## 后续待补充内容

后续如增加数据库或多活动，需要补充数据备份和活动回滚策略。
