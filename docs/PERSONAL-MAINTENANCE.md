# Zzp Sub 运维说明

生产入口 `sub.zzp.moe`。旧域名在新域名验证后停用。继续使用 Cloudflare Pages 项目 `misub`、生产分支 `main`，以及原 D1、KV 和 Secrets。不恢复旧 Sub-Store，不触及 Home 或其他应用的云资源。

## 持久化与认证

- `MISUB_PERSONAL_MODE=true`，D1 为业务数据唯一来源。D1 故障不回退到 KV，不伪装成空数据。
- 原 `MISUB_DB`、`MISUB_KV` 绑定和数据标识不改。无需 schema、数据或 Token 迁移。
- `ADMIN_PASSWORD`、`COOKIE_SECRET`、`SUBSCRIPTION_TOKEN`、`PROFILE_TOKEN` 四项独立 Secrets 不读取、不导出、不轮换；发布保留已有会话和订阅凭据。
- 仅真实排障需要时读取生产订阅。普通测试使用本地合成数据，不在生产写入测试节点。
- 默认 `ENABLE_CRON=false`、`ENABLE_AUTH_DIAGNOSTICS=false`。主动定时刷新需要外部认证调度器，见 [Cron](CRON_DASHBOARD_GUIDE.md)。

## 发布顺序

1. 本地运行单元/集成测试、构建及浏览器测试；依赖变化运行 `npm audit`。
2. 确认当前生产 Pages 部署可回滚，并核对 D1/KV 绑定及四项 Secret 名称。无 schema 或数据迁移时无需导出生产私密数据。
3. 将仓库更名为 `zzp-sub`，核对 GitHub 仓库 ID 与 Pages 连接未改变；仅调整连接中的仓库名称。
4. 将 `sub.zzp.moe` 添加到同一 Pages 项目并等待 DNS/TLS 生效，新域名验证通过后移除旧域名；不保留旧入口或重定向。
5. 只修改生产环境的公开 URL/CORS 配置，不覆盖整个环境变量集合或 Secrets。CORS 仅保留当前有效来源；移除旧域名。
6. 在已验证提交上正常快进推送 `main`，等待检查和生产部署成功，核对线上 SHA、静态资源、未登录 API 隔离和订阅路径。
7. 在现有管理员会话可用的条件下检查登录、只读数据、保存与订阅输出；无法取得会话时明确记录未验证项，不读取 Secret 值来代替用户登录。

不维护 preview 分支、预览 D1/KV 或额外云服务，不创建无授权测试资源；不强推、不 reset main、不自动同步上游。

## 备份与恢复

执行生产数据变更或恢复前，使用管理员后台 JSON 导出，并保留完整 D1 SQL/Time Travel。JSON 包含业务集合、永久快照、地区纠错和独立下载计数，可能含真实节点凭据，必须存放在受控私有位置，不写公开 Git 或报告。运行时 Secrets 不随 JSON 备份恢复。

普通代码发布可回滚到上一成功 Pages 部署；**Pages 回滚不会恢复 D1 数据**。本次重构无 schema 迁移。若需恢复数据，先再次备份并核对目标数据库，再按逐字段验证的恢复计划执行，不把恢复演练放在生产。

## 故障与快照

每来源永久快照持久保存在 D1 的现有键中；上游 403、空内容、无效或异常截断保留上次成功数据。转换临时缓存另有 TTL，不代替永久快照。详见 [来源快照](source-snapshots.md)。

源站在本机可访问不代表 Cloudflare 可访问。排查使用脱敏日志或合成地址；不要把真实订阅地址、凭据或节点写入公开问题与文档。
