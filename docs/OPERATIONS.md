# 运维与部署手册

本文面向接手 ECS、数据库和发布工作的开发/运维人员。密码、密钥和连接串必须从
安全的密码管理工具获取，不得写入仓库或聊天记录。

## 1. 生产环境

- 系统：Alibaba Cloud Linux 3
- 入口：HTTP 80（当前无域名/HTTPS）
- 应用：Next.js standalone 容器 `trendpilot-app`
- 数据库：PostgreSQL 16 容器 `trendpilot-db`
- Docker 网络：`trendpilot-net`
- 配置目录：`/opt/trendpilot`
- 应用环境文件：`/opt/trendpilot/app.env`，权限应为 `600`
- 数据库环境文件：`/opt/trendpilot/.env`，权限应为 `600`

## 2. 环境变量

| 名称 | 必需 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `AUTH_USERNAME` | 是 | 环境管理员用户名 |
| `AUTH_PASSWORD` | 是 | 环境管理员密码 |
| `SESSION_SECRET` | 是 | 会话签名密钥，至少 32 字符 |
| `AUTOMATION_SECRET` | 是 | 定时任务接口密钥，至少 32 字符 |
| `AI_PROVIDER` | 是 | `siliconflow` 或 `openai` |
| `AI_MODEL` | 是 | 模型标识 |
| `SILICONFLOW_API_KEY` | 按供应商 | SiliconFlow Key |
| `OPENAI_API_KEY` | 按供应商 | OpenAI Key |
| `CANDIDATE_FEED_URL` | 自动商品采集时 | 可下载的 HTTPS CSV 地址 |
| `CANDIDATE_FEED_NAME` | 否 | 采集日志中的渠道名称 |

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
  --env-file /opt/trendpilot/app.env \
  -p 80:3000 \
  --memory=850m \
  --memory-reservation=512m \
  trendpilot-app:<version>
```

发布后检查：

```bash
docker ps --filter name=trendpilot-app
docker logs --tail 100 trendpilot-app
curl --fail http://127.0.0.1/
```

回滚时使用上一版本镜像按相同参数重新创建容器。数据库迁移需另行确认兼容性。

## 4. 数据库初始化

新环境先启动 PostgreSQL，再执行：

```bash
docker exec -i trendpilot-db \
  psql -v ON_ERROR_STOP=1 -U trendpilot -d trendpilot \
  < deploy/postgres.sql
```

`deploy/postgres.sql` 是 ECS/PostgreSQL 的完整建表入口；`drizzle/` 保留历史迁移记录，
不要在不了解目标数据库状态时重复执行历史迁移。

## 5. 定时任务

生产 cron 位于 `/etc/cron.d/trendpilot`：

- 每天 09:00：Google Trends 公开趋势采集。
- 每天 09:30：ASIN 数据质量巡检（新鲜度、价格、评分、BSR）。
- 每 6 小时：商品 CSV Feed（未配置地址时安全跳过）。
- 每天 03:00：PostgreSQL 备份。

| 时间（Asia/Shanghai） | 任务 |
| --- | --- |
| 每天 03:00 | PostgreSQL 备份 |
| 每天 09:00 | Google Trends 美国站采集 |
| 每 6 小时第 15 分 | 商品 CSV Feed；未配置 URL 时跳过 |

日志写入 `/var/log/trendpilot-automation.log`，备份日志写入
`/var/log/trendpilot-backup.log`。

## 6. 备份与恢复

备份目录为 `/opt/trendpilot/backups`，文件权限由 `umask 077` 限制，保留 14 天。

恢复前必须先创建新的安全备份并停止应用写入。恢复到空数据库的示例：

```bash
gunzip -c /opt/trendpilot/backups/trendpilot-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i trendpilot-db psql -v ON_ERROR_STOP=1 -U trendpilot -d trendpilot
```

恢复属于破坏性操作，必须先确认目标数据库和备份日期。当前仅确认备份文件已生成，
仍需安排一次恢复演练。

## 7. 常用检查

```bash
docker ps
docker logs --tail 100 trendpilot-app
docker logs --tail 100 trendpilot-db
df -h /
free -m
tail -n 100 /var/log/trendpilot-automation.log
```

## 8. 上线前安全清单

- 绑定域名，签发证书并强制 HTTPS。
- 仅开放 80/443；SSH 只允许受信任来源，PostgreSQL 不开放公网。
- 删除临时 SSH 公钥，轮换曾在聊天中出现过的密码和 API Key。
- 为登录增加速率限制，建立只读/编辑/管理员权限。
- 设置云监控：CPU、内存、磁盘、容器退出和 5xx 告警。
