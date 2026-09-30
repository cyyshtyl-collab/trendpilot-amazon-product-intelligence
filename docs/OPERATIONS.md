# 运维与部署手册

本文面向接手 ECS、数据库和发布工作的开发/运维人员。密码、密钥和连接串必须从
安全的密码管理工具获取，不得写入仓库或聊天记录。

## 固定部署通道

生产机使用绑定强制命令的固定部署公钥。该密钥只能执行以下四项操作，不能打开
root 终端，也不能进行端口、代理或 X11 转发：

- `upload`：接收不超过 1 GiB、通过 gzip 校验的 Docker 镜像包。
- `deploy`：校验镜像名、备份数据库、切换容器并执行健康检查；失败自动回滚。
- `backup`：调用生产数据库备份脚本。
- `status`：读取应用、数据库容器状态并执行健康检查。

服务端网关脚本为 `/usr/local/sbin/trendpilot-deploy-gateway`，仓库对应文件为
`deploy/fixed-deploy-gateway.sh`。固定私钥仅保存在授权运维电脑的 `~/.ssh` 中，
不得提交到仓库或通过聊天传输。

## Google Trends 海外采集

阿里云中国区无法稳定访问 Google，因此 `.github/workflows/google-trends.yml` 每天
北京时间 09:05 从 GitHub Actions 拉取公开 RSS，再把签名数据推送到生产接口。
仓库必须配置 Actions Secret `TREND_PILOT_TRENDS_SIGNING_KEY`，内容为独立的
Ed25519 私钥 PEM；私钥不得写入代码、日志或 ECS。服务端仅保存对应公钥，并拒绝
超过五分钟、签名错误或被篡改的请求。

若 GitHub 任务失败，页面会回退显示最近一次成功采集及其日期，不会把缓存数据
标记为实时数据。ECS 原定时任务继续作为 Google 直连恢复探测。

## 1. 生产环境

- 系统：Alibaba Cloud Linux 3
- 入口：HTTP 80（当前无域名/HTTPS）
- 应用：Next.js standalone 容器 `trendpilot-app`
- 数据库：PostgreSQL 16 容器 `trendpilot-db`
- Docker 网络：`trendpilot-net`
- 配置目录：`/opt/trendpilot`
- 应用环境文件：`/opt/trendpilot/app-runtime.env`，权限应为 `600`
- 数据库环境文件：`/opt/trendpilot/.env`，权限应为 `600`

自动化脚本优先读取 `app-runtime.env`，并兼容旧的 `app.env`。如使用其他路径，
通过 `TREND_PILOT_ENV_FILE` 显式指定；禁止复制出多份内容不一致的环境文件。

## 2. 环境变量

| 名称                  | 必需           | 用途                           |
| --------------------- | -------------- | ------------------------------ |
| `DATABASE_URL`        | 是             | PostgreSQL 连接串              |
| `AUTH_USERNAME`       | 是             | 环境管理员用户名               |
| `AUTH_PASSWORD`       | 是             | 环境管理员密码                 |
| `SESSION_SECRET`      | 是             | 会话签名密钥，至少 32 字符     |
| `AUTOMATION_SECRET`   | 是             | 定时任务接口密钥，至少 32 字符 |
| `AI_PROVIDER`         | 是             | `siliconflow` 或 `openai`      |
| `AI_MODEL`            | 是             | 模型标识                       |
| `SILICONFLOW_API_KEY` | 按供应商       | SiliconFlow Key                |
| `OPENAI_API_KEY`      | 按供应商       | OpenAI Key                     |

修改环境文件后必须重建应用容器，环境变量不会自动注入已运行的容器。

## 3. 发布流程

发布前：

```bash
npm ci
npm run build
git diff --check
```

构建与发布使用唯一镜像标签，禁止覆盖历史镜像。现有容器启动参数为：

```bash
docker run -d \
  --name trendpilot-app \
  --restart unless-stopped \
  --network trendpilot-net \
  --env-file /opt/trendpilot/app-runtime.env \
  -p 80:3000 \
  --memory=850m \
  --memory-reservation=512m \
  --memory-swap=1362m \
  trendpilot-app:<version>
```

发布后检查：

```bash
docker ps --filter name=trendpilot-app
docker logs --tail 100 trendpilot-app
curl --fail http://127.0.0.1/
./deploy/verify-production.sh
```

回滚时使用上一版本镜像按相同参数重新创建容器。数据库迁移需另行确认兼容性。

## 4. 数据库初始化

新环境先启动 PostgreSQL，再执行：

```bash
docker exec -i trendpilot-db \
  psql -v ON_ERROR_STOP=1 -U trendpilot -d trendpilot \
  < deploy/postgres.sql
```

`deploy/postgres.sql` 是全新 ECS/PostgreSQL 的完整建表入口。已有环境只运行：

```bash
./deploy/apply-migrations.sh
./deploy/verify-production.sh
```

增量脚本位于 `deploy/migrations/`，执行记录保存在 `schema_migrations` 表。
`db/schema.ts` 和 `drizzle/` 仅为早期 SQLite 历史资料，不是生产结构来源。
旧的 Drizzle 生成工具已从开发依赖中移除，禁止重新生成或执行这些 SQLite 迁移。

## 5. 定时任务

生产 cron 位于 `/etc/cron.d/trendpilot`：

- 每天 09:00：Google Trends 公开趋势采集。
- 每天 09:30：ASIN 数据质量巡检（新鲜度、价格、评分、BSR）。
- 每天 09:15：从历史快照补回缺失 Listing 字段，并统计新增可决策商品。
- 每 6 小时的第 15 分钟：如已配置 Feed，则执行候选增量采集。
- 每天 03:00：PostgreSQL 备份。

| 时间（Asia/Shanghai） | 任务                             |
| --------------------- | -------------------------------- |
| 每天 03:00            | PostgreSQL 备份                  |
| 每天 09:00            | Google Trends 美国站采集         |
| 每天 09:15            | 历史快照补全与可决策入池         |
| 每天 09:30            | ASIN 数据质量巡检                |
| 每 6 小时第 15 分钟   | 候选 Feed 增量采集（配置后生效） |

日志写入 `/var/log/trendpilot-automation.log`，备份日志写入
`/var/log/trendpilot-backup.log`。

## 6. 备份与恢复

备份目录为 `/opt/trendpilot/backups`，文件权限由 `umask 077` 限制，保留 14 天。

恢复前必须先创建新的安全备份并停止应用写入。恢复到空数据库的示例：

```bash
gunzip -c /opt/trendpilot/backups/trendpilot-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i trendpilot-db psql -v ON_ERROR_STOP=1 -U trendpilot -d trendpilot
```

恢复属于破坏性操作，必须先确认目标数据库和备份日期。正式恢复前，先在隔离的临时
数据库执行演练；脚本只创建并删除 `trendpilot_restore_drill`，不会覆盖生产库：

```bash
./deploy/restore-drill.sh /opt/trendpilot/backups/trendpilot-YYYYMMDD-HHMMSS.sql.gz
```

只有脚本输出 `Restore drill passed`，才可将恢复能力标记为已验收。

## 7. 常用检查

```bash
docker ps
docker logs --tail 100 trendpilot-app
docker logs --tail 100 trendpilot-db
df -h /
free -m
tail -n 100 /var/log/trendpilot-automation.log
cat RELEASE
./deploy/verify-production.sh
```

## 8. 上线前安全清单

- 绑定域名，签发证书并强制 HTTPS。
- 仅开放 80/443；SSH 只允许受信任来源，PostgreSQL 不开放公网。
- 删除临时 SSH 公钥，轮换曾在聊天中出现过的密码和 API Key。
- 为登录增加速率限制，建立只读/编辑/管理员权限。
- 设置云监控：CPU、内存、磁盘、容器退出和 5xx 告警。

## 9. 发布和恢复验收记录

每次发布必须记录：Git 提交、`RELEASE` 镜像标签、数据库迁移结果、生产验收结果、
备份文件名和回滚镜像。不得只在聊天中记录。2026-09-28 本地基线标记为
`trendpilot-app:ecs-20260926.19`；服务器实际运行版本仍需恢复 SSH 权限后复核。
