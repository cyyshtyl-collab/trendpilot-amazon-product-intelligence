# TrendPilot 0.19.0 发布基线

发布日期：2026-09-28  
镜像基线：`trendpilot-app:ecs-20260926.19`

## 本版本范围

- 四阶段工作台：数据采集、趋势分析、AI 评分和决策产出。
- PostgreSQL 持久化、内部成员登录及管理员权限边界。
- CSV/XLSX、ASIN/链接和自动 Feed 候选接入。
- 严格最终评分门槛、候选排名和周报保存/下载。
- 数据质量报告、字段来源核验和团队补数任务。
- 自动趋势采集、数据质量巡检、决策就绪修复和每日备份。

## P0 可恢复性改进

- 生产数据库基线统一为 `deploy/postgres.sql`。
- 新增有版本记录的 `deploy/migrations/` 增量升级入口。
- 新增生产结构/容器验收脚本和隔离恢复演练脚本。
- 备份改为临时文件写入、压缩校验成功后原子落盘。
- 自动化脚本统一解析 `app-runtime.env`，同时兼容旧路径。
- 文档明确区分最近一次核验数据和实时生产状态。

## 本地验收

- `npm run build`：通过，23 个应用路由生成成功。
- `git diff --check`：通过。
- 运维 Shell 语法检查：通过。
- 敏感信息扫描：未发现 API Key、私钥或明文环境密码。
- `npm run lint`：未通过；现存 React Compiler、无障碍和类型安全问题列入 P2，
  本版本不能将 lint 作为已通过的质量门禁。

## 上线后仍需执行

1. 在 ECS 执行 `deploy/apply-migrations.sh`。
2. 执行 `deploy/verify-production.sh`。
3. 选择最新备份执行 `deploy/restore-drill.sh <backup>`。
4. 核对 cron、镜像标签、磁盘、内存和备份日志。
5. 轮换曾在聊天中出现的登录凭据和第三方 API Key。
6. 删除所有不再使用的临时 SSH 公钥。

以上六项必须保留执行记录；未完成前不得将 P0 标记为全部验收。
